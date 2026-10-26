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

  if (cliente.usuario_id) {
    const { data: linkedMirror, error: linkedMirrorErr } = await admin
      .from('usuarios')
      .select('id, role')
      .eq('id', cliente.usuario_id)
      .maybeSingle()
    if (linkedMirrorErr) {
      return jsonResponse({ ...result, session: null, reason: 'vinculo_cliente_falhou' }, 500)
    }
    if (linkedMirror && linkedMirror.role !== 'client') {
      return jsonResponse({ ...result, session: null, reason: 'usuario_papel_incompativel' }, 409)
    }
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
  if (linkErr || !link?.properties || !link.user?.id) {
    return jsonResponse({ ...result, session: null, reason: 'gen_link_falhou', detail: linkErr?.message })
  }

  // A conta do Auth precisa ficar vinculada ao cadastro comercial antes de a
  // sessão ser entregue ao navegador. Sem esse vínculo, public.me() não
  // consegue hidratar o perfil e as políticas RLS não encontram propostas.
  const authUser = link.user
  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>
  const appMetadata = (authUser.app_metadata ?? {}) as Record<string, unknown>
  const metadataRole = typeof appMetadata.role === 'string'
    ? appMetadata.role
    : typeof metadata.role === 'string'
      ? metadata.role
      : 'client'

  const { data: mirror, error: mirrorErr } = await admin
    .from('usuarios')
    .select('id, role')
    .eq('id', authUser.id)
    .maybeSingle()

  if (mirrorErr) {
    return jsonResponse({ ...result, session: null, reason: 'vinculo_cliente_falhou' }, 500)
  }

  const effectiveRole = mirror?.role ?? metadataRole
  if (effectiveRole !== 'client') {
    return jsonResponse({ ...result, session: null, reason: 'usuario_papel_incompativel' }, 409)
  }

  if (!mirror) {
    const { error: mirrorInsertErr } = await admin.from('usuarios').insert({
      id: authUser.id,
      nome_completo: cliente.nome_completo || authUser.email?.split('@')[0] || 'Cliente',
      email: authUser.email ?? cliente.email,
      role: 'client',
      telefone: null,
      telefone_ddi: '55',
      ativo: true,
    })
    if (mirrorInsertErr && mirrorInsertErr.code !== '23505') {
      return jsonResponse({ ...result, session: null, reason: 'vinculo_cliente_falhou' }, 500)
    }
  }

  const { data: anotherClient, error: anotherClientErr } = await admin
    .from('clientes')
    .select('id')
    .eq('usuario_id', authUser.id)
    .neq('id', result.cliente_id)
    .maybeSingle()

  if (anotherClientErr) {
    return jsonResponse({ ...result, session: null, reason: 'vinculo_cliente_falhou' }, 500)
  }
  if (anotherClient) {
    return jsonResponse({ ...result, session: null, reason: 'usuario_ja_vinculado' }, 409)
  }

  if (cliente.usuario_id && cliente.usuario_id !== authUser.id) {
    return jsonResponse({ ...result, session: null, reason: 'cliente_ja_vinculado' }, 409)
  }

  if (!cliente.usuario_id) {
    const { data: linkedClient, error: linkClientErr } = await admin
      .from('clientes')
      .update({ usuario_id: authUser.id })
      .eq('id', result.cliente_id)
      .is('usuario_id', null)
      .select('id')
      .maybeSingle()

    if (linkClientErr) {
      return jsonResponse({ ...result, session: null, reason: 'vinculo_cliente_falhou' }, 500)
    }

    if (!linkedClient) {
      const { data: currentClient, error: currentClientErr } = await admin
        .from('clientes')
        .select('usuario_id')
        .eq('id', result.cliente_id)
        .single()
      if (currentClientErr || currentClient?.usuario_id !== authUser.id) {
        return jsonResponse({ ...result, session: null, reason: 'cliente_ja_vinculado' }, 409)
      }
    }

    await admin.from('audit_log').insert({
      usuario_id: authUser.id,
      acao: 'cliente_usuario_vinculado',
      entidade: 'clientes',
      entidade_id: result.cliente_id,
      payload_depois: { usuario_id: authUser.id, origem: 'magic_link_consume' },
    })
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
