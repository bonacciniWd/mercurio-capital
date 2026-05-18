// supabase/functions/magic-link-issue/index.ts
// Reemite o magic link de uma proposta para o parceiro (autenticado) repassar ao cliente.
// Body: { proposta_id: string, send_email?: boolean }
// Retorna: { magic_token, url, protocolo, expires_in_min }
//
// Auth: requer JWT do parceiro (Authorization: Bearer <user_token>).
// O JWT é forward-ado para o cliente Supabase para que a RPC herde o auth.uid().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

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

  // Envio opcional por e-mail (fire-and-forget; falha não bloqueia retorno).
  if (body.send_email) {
    try {
      // Resolve email do cliente via admin
      const { data: prop } = await admin
        .from('propostas')
        .select('cliente:clientes(email, nome_completo)')
        .eq('id', body.proposta_id)
        .single()
      const cliente = (prop as { cliente?: { email?: string; nome_completo?: string } } | null)?.cliente
      if (cliente?.email) {
        // Usa o endpoint de e-mail nativo via Supabase Auth admin (magiclink redireciona ao /magic/:token padrão Supabase).
        // Para este fluxo customizado preferimos um e-mail simples sem OTP nativo; deixamos a integração com provider externo como TODO.
        // Por ora apenas registramos a intenção em audit log (tabela existente).
        await admin.from('audit_log').insert({
          usuario_id: userId,
          acao: 'magic_link_issue_email',
          entidade: 'propostas',
          entidade_id: body.proposta_id,
          payload_depois: { email: cliente.email, url },
        })
      }
    } catch (_err) {
      // best-effort
    }
  }

  return jsonResponse({
    ...data,
    url,
  })
})
