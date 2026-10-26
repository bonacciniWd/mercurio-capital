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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#171717;">
        <tr><td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr><td style="padding:0;"><img src="https://www.mercuriocapitalsa.com.br/01.png" alt="Mercúrio Capital" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
            <tr><td style="padding:32px 30px;color:#171717;">
              <p style="margin:0 0 14px;color:#b91c1c;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Convite para parceiro</p>
              <h1 style="margin:0 0 16px;color:#171717;font-size:24px;line-height:1.3;">Olá, ${safeNome}!</h1>
              <p style="margin:0 0 22px;color:#4b5563;font-size:16px;line-height:1.6;">Reenviamos seu convite para acessar a plataforma Mercúrio Capital.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;">
                <tr><td align="center" bgcolor="#b91c1c" style="border-radius:6px;"><a href="${safeLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">ACEITAR CONVITE</a></td></tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">Se o botão não abrir, copie e cole este link no navegador:<br><a href="${safeLink}" style="color:#b91c1c;word-break:break-all;">${safeLink}</a></p>
            </td></tr>
            <tr><td style="padding:18px 24px;border-top:1px solid #e5e7eb;background-color:#fafafa;text-align:center;color:#6b7280;font-size:12px;">Mercúrio Capital · Crédito estruturado com clareza e responsabilidade.</td></tr>
          </table>
        </td></tr>
      </table>
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
