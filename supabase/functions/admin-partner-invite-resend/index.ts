// supabase/functions/admin-partner-invite-resend/index.ts
// Reenvia o convite de um parceiro pendente (origem='convite').
// Body: { invite_id }
// Fluxo:
//   1) Valida JWT do admin e chama a RPC `admin_partner_invite_resend` (guard
//      app_is_admin_full + audita em audit_log) — mesma separação de
//      responsabilidades usada em `admin-invite-partner`.
//   2) Service-role: gera um novo magiclink (Auth Admin API) e reenfileira o
//      e-mail em `email_outbox` (mesma trilha usada pelo script de manutenção
//      `resend-pending-partner-invites.mjs`).
// Retorno: { action_link, email_sent }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

type Body = {
  invite_id?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

  const inviteId = (body.invite_id ?? '').trim()
  if (!inviteId) return jsonResponse({ error: 'invite_id_obrigatorio' }, { status: 400 })

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  const userRes = await userClient.auth.getUser()
  if (!userRes.data.user) return jsonResponse({ error: 'unauthorized' }, { status: 401 })

  const role = (userRes.data.user.app_metadata as { role?: string } | null)?.role
  if (role !== 'admin') {
    return jsonResponse({ error: 'forbidden' }, { status: 403 })
  }

  // 1) Valida (guard app_is_admin_full) + audita via RPC (mesmo JWT do admin).
  const rpc = await userClient.rpc('admin_partner_invite_resend', { p_invite_id: inviteId })
  if (rpc.error) {
    const status = rpc.error.message.includes('forbidden') ? 403 : 400
    return jsonResponse({ error: 'rpc_falhou', detail: rpc.error.message }, { status })
  }

  const invite = rpc.data as { invite_id: string; email: string; nome_completo: string; partner_id: string; usuario_id: string | null }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 2) Gera novo magiclink e reenfileira o e-mail (service role).
  const linkRes = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: invite.email,
    options: { redirectTo: `${SITE_URL}/auth/partner-bootstrap` },
  })

  if (linkRes.error || !linkRes.data.properties?.action_link) {
    return jsonResponse({ error: 'link_falhou', detail: linkRes.error?.message }, { status: 500 })
  }

  const actionLink = linkRes.data.properties.action_link
  const nome = invite.nome_completo || invite.email.split('@')[0]
  const safeNome = escapeHtml(nome)
  const safeLink = escapeHtml(actionLink)

  const { error: outboxError } = await admin.from('email_outbox').insert({
    destinatario: invite.email,
    usuario_id: invite.usuario_id,
    assunto: 'Seu convite para acessar a Mercurio Capital',
    corpo: `
      <p>Olá ${safeNome},</p>
      <p>Reenviamos seu convite para acessar a Mercurio Capital.</p>
      <p><a href="${safeLink}">Acessar convite</a></p>
      <p>Se o botão não abrir, copie e cole este link no navegador:</p>
      <p>${safeLink}</p>
      <p>Mercurio Capital</p>
    `,
    origem: 'transacional',
    referencia_id: invite.invite_id,
    metadata: {
      evento: 'admin_partner_invite_resend',
      partner_id: invite.partner_id,
    },
  })

  if (outboxError) {
    return jsonResponse({ error: 'outbox_falhou', detail: outboxError.message }, { status: 500 })
  }

  return jsonResponse({ action_link: actionLink, email_sent: true })
})
