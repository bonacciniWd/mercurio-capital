// supabase/functions/magic-link-issue/index.ts
// Reemite o magic link de uma proposta para o parceiro (autenticado) repassar ao cliente.
// Body: { proposta_id: string, send_email?: boolean }
// Retorna: { magic_token, url, protocolo, expires_in_min, email_status }
//
// Auth: requer JWT do parceiro (Authorization: Bearer <user_token>).
// O JWT é forward-ado para o cliente Supabase para que a RPC herde o auth.uid().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, { status: 405 })

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { proposta_id?: string; send_email?: boolean }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.proposta_id) {
    return jsonResponse({ error: 'proposta_id_obrigatorio' }, { status: 400 })
  }

  // Cliente com JWT do parceiro (passa pela RLS / SECURITY DEFINER usa auth.uid())
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  // Rate-limit: max 5 reemissões/hora por usuário+proposta
  const userRes = await userClient.auth.getUser()
  const userId = userRes.data.user?.id
  if (!userId) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const rlKey = `magic_link_issue::${userId}::${body.proposta_id}`
  const { data: allowed, error: rlErr } = await admin.rpc('check_and_increment', {
    p_chave: rlKey,
    p_limite: 5,
    p_janela: '1 hour',
  })
  if (rlErr) {
    return jsonResponse({ error: 'rate_check_failed', detail: rlErr.message }, { status: 500 })
  }
  if (allowed === false) {
    return jsonResponse({ error: 'rate_limited' }, { status: 429 })
  }

  const { data, error } = await userClient.rpc('partner_reissue_magic_link', {
    p_proposta_id: body.proposta_id,
  })
  if (error) {
    return jsonResponse({ error: 'rpc_failed', detail: error.message }, { status: 400 })
  }

  const token = (data as { magic_token: string }).magic_token
  const url = `${SITE_URL}/c/proposta/${token}`

  let emailResult: Record<string, unknown> = { email_status: 'nao_solicitado' }

  // Envio opcional por e-mail; a falha não bloqueia o retorno do link manual.
  if (body.send_email) {
    const { data: queued, error: queueErr } = await admin.rpc('enqueue_proposta_magic_link_reissue_email', {
      p_proposta_id: body.proposta_id,
      p_magic_token: token,
    })

    if (queueErr) {
      emailResult = {
        email_status: 'falha_enqueue',
        email_erro: 'Não foi possível enfileirar o e-mail de reemissão.',
      }
    } else if (queued && typeof queued === 'object') {
      emailResult = queued as Record<string, unknown>
    }

    await admin.from('audit_log').insert({
      usuario_id: userId,
      acao: 'magic_link_issue_email',
      entidade: 'propostas',
      entidade_id: body.proposta_id,
      payload_depois: { email_status: emailResult.email_status },
    })
  }

  return jsonResponse({
    ...data,
    url,
    ...emailResult,
  })
})
