// supabase/functions/magic-link-consume/index.ts
// Endpoint anônimo para consumir um magic-link de proposta.
// Body: { token: string }
// Retorna: { proposta_id, protocolo, cliente_id, session?: { access_token, refresh_token, email } }
//
// Quando o cliente já possui usuário (clientes.usuario_id), gera uma sessão Supabase
// via auth.admin.generateLink('magiclink') e retorna o action_link/hashed_token
// para que o frontend conclua a autenticação chamando supabase.auth.verifyOtp.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, { status: 405 })

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 })
  }
  const token = body.token?.trim()
  if (!token) {
    return jsonResponse({ error: 'token_obrigatorio' }, { status: 400 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Rate-limit por IP (10/min)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { data: allowed, error: rlErr } = await admin.rpc('check_and_increment', {
    p_chave: `magic_link_consume::${ip}`,
    p_limite: 10,
    p_janela: '1 minute',
  })
  if (rlErr) {
    return jsonResponse({ error: 'rate_check_failed', detail: rlErr.message }, { status: 500 })
  }
  if (allowed === false) {
    return jsonResponse({ error: 'rate_limited' }, { status: 429 })
  }

  // 1) Consome o token via RPC (marca used_at, retorna proposta/cliente)
  const { data: consumed, error: consumeErr } = await admin.rpc('cliente_consume_magic', { p_token: token })
  if (consumeErr) {
    return jsonResponse({ error: 'token_invalido', detail: consumeErr.message }, { status: 400 })
  }

  const result = consumed as { proposta_id: string; cliente_id: string; protocolo: string }

  // 2) Resolve email do cliente
  const { data: cliente, error: cliErr } = await admin
    .from('clientes')
    .select('email, nome_completo, usuario_id')
    .eq('id', result.cliente_id)
    .single()
  if (cliErr || !cliente?.email) {
    return jsonResponse({ ...result, session: null, reason: 'cliente_sem_email' })
  }

  // 3) Gera sessão via Supabase Auth (magic link nativo).
  //    Se o usuário ainda não existe, generateLink com type=magiclink cria conta + envia.
  //    Retornamos hashed_token + email para o frontend chamar verifyOtp.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: cliente.email,
    options: {
      redirectTo: `${SITE_URL}/c`,
    },
  })
  if (linkErr || !link.properties) {
    return jsonResponse({ ...result, session: null, reason: 'gen_link_falhou', detail: linkErr?.message })
  }

  return jsonResponse({
    proposta_id: result.proposta_id,
    cliente_id: result.cliente_id,
    protocolo: result.protocolo,
    session: {
      email: cliente.email,
      hashed_token: link.properties.hashed_token,
      action_link: link.properties.action_link,
    },
  })
})
