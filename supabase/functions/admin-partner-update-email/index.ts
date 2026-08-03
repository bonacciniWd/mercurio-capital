// supabase/functions/admin-partner-update-email/index.ts
// Altera o e-mail de login de um parceiro (auth.users + usuarios), sempre via
// service role — nunca client-side direto. Guard: admin com admin_nivel='full'.
// Body: { partner_id, new_email }
// Fluxo:
//   1) Valida JWT do admin (role='admin' e admin_nivel='full').
//   2) Resolve usuario_id do parceiro (via JWT do admin, respeitando RLS).
//   3) Service-role: valida unicidade, atualiza auth.users (Admin API) e
//      public.usuarios, e audita em audit_log.
// Retorno: { ok, email }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type Body = {
  partner_id?: string
  new_email?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, { status: 405 })

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 })
  }

  const partnerId = (body.partner_id ?? '').trim()
  const newEmail = (body.new_email ?? '').trim().toLowerCase()

  if (!partnerId) return jsonResponse({ error: 'partner_id_obrigatorio' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return jsonResponse({ error: 'email_invalido' }, { status: 400 })
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  const userRes = await userClient.auth.getUser()
  if (!userRes.data.user) return jsonResponse({ error: 'unauthorized' }, { status: 401 })

  const appMeta = userRes.data.user.app_metadata as { role?: string; admin_nivel?: string } | null
  const role = appMeta?.role
  const adminNivel = appMeta?.admin_nivel ?? 'full'
  if (role !== 'admin' || adminNivel !== 'full') {
    return jsonResponse({ error: 'forbidden' }, { status: 403 })
  }

  const partnerRes = await userClient
    .from('partners')
    .select('id, usuario_id')
    .eq('id', partnerId)
    .maybeSingle()

  if (partnerRes.error) return jsonResponse({ error: 'partner_falhou', detail: partnerRes.error.message }, { status: 400 })
  if (!partnerRes.data) return jsonResponse({ error: 'partner_not_found' }, { status: 404 })

  const usuarioId = partnerRes.data.usuario_id as string

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const before = await admin.from('usuarios').select('email').eq('id', usuarioId).maybeSingle()
  if (before.error || !before.data) {
    return jsonResponse({ error: 'usuario_not_found' }, { status: 404 })
  }
  const previousEmail = before.data.email as string

  if (previousEmail.toLowerCase() === newEmail) {
    return jsonResponse({ ok: true, email: newEmail })
  }

  const dup = await admin.from('usuarios').select('id').ilike('email', newEmail).neq('id', usuarioId).maybeSingle()
  if (dup.data) {
    return jsonResponse({ error: 'email_ja_utilizado' }, { status: 409 })
  }

  const updAuth = await admin.auth.admin.updateUserById(usuarioId, {
    email: newEmail,
    email_confirm: true,
  })
  if (updAuth.error) {
    return jsonResponse({ error: 'auth_update_falhou', detail: updAuth.error.message }, { status: 500 })
  }

  const updUsuario = await admin.from('usuarios').update({ email: newEmail }).eq('id', usuarioId)
  if (updUsuario.error) {
    return jsonResponse({ error: 'usuario_update_falhou', detail: updUsuario.error.message }, { status: 500 })
  }

  await admin.from('audit_log').insert({
    usuario_id: userRes.data.user.id,
    acao: 'admin_partner_update_email',
    entidade: 'usuarios',
    entidade_id: usuarioId,
    payload_antes: { email: previousEmail },
    payload_depois: { email: newEmail },
  })

  return jsonResponse({ ok: true, email: newEmail })
})
