// supabase/functions/admin-invite-partner/index.ts
// Cria/convida um novo parceiro a partir do painel admin.
// Body: { email, nome_completo, telefone?, telefone_ddi?, observacoes? }
// Fluxo:
//   1) Valida JWT do admin (precisa ter app_metadata.role = 'admin').
//   2) Service-role: chama auth.admin.inviteUserByEmail (envia e-mail) — caindo para createUser se já existir.
//   3) Service-role: define app_metadata.role = 'partner' no usuário criado.
//   4) Chama RPC admin_invite_partner_record (com o JWT do admin) para criar partners(pending) + partner_invites.
// Retorno: { partner_id, usuario_id, invite_id, action_link? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('APP_URL') ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

type Body = {
  email?: string
  nome_completo?: string
  telefone?: string
  telefone_ddi?: string
  observacoes?: string
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

  const email = (body.email ?? '').trim().toLowerCase()
  const nome = (body.nome_completo ?? '').trim()
  const telefone = body.telefone?.trim() || null
  const telefone_ddi = (body.telefone_ddi ?? '55').trim() || '55'
  const observacoes = body.observacoes?.trim() || null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'email_invalido' }, { status: 400 })
  }
  if (nome.length < 3) {
    return jsonResponse({ error: 'nome_obrigatorio' }, { status: 400 })
  }

  // Cliente com JWT do admin para validar permissão e chamar a RPC.
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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1) Convidar via e-mail; se já existir, recuperar o usuário existente.
  //    Se o Supabase rejeitar (rate-limit / SMTP indisponível), faz fallback
  //    para createUser + generateLink — convite continua válido manualmente.
  let usuarioId: string | null = null
  let actionLink: string | null = null
  let emailSent = false
  let fallbackReason: string | null = null

  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome_completo: nome, telefone, telefone_ddi, role: 'partner' },
    redirectTo: `${SITE_URL}/auth/partner-bootstrap`,
  })

  if (invite.error) {
    const msg = invite.error.message.toLowerCase()
    const alreadyExists = msg.includes('already') || msg.includes('registered') || msg.includes('exists')
    const rateLimited = msg.includes('rate') || msg.includes('limit') || msg.includes('smtp') || msg.includes('email')

    if (alreadyExists) {
      // Localiza usuário existente e gera magic-link.
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const existing = list.data.users.find((u) => u.email?.toLowerCase() === email)
      if (!existing) {
        return jsonResponse(
          { error: 'usuario_ja_existe_mas_nao_localizado', detail: invite.error.message },
          { status: 409 },
        )
      }
      usuarioId = existing.id
      const linkRes = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${SITE_URL}/auth/partner-bootstrap` },
      })
      if (!linkRes.error) actionLink = linkRes.data.properties?.action_link ?? null
      fallbackReason = 'usuario_ja_existe'
    } else if (rateLimited) {
      // Cria usuário JÁ confirmado (sem disparar e-mail) e devolve magic-link
      // para o admin compartilhar manualmente. O parceiro define a senha em
      // /auth/partner-bootstrap após clicar no link.
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { role: 'partner' },
        user_metadata: { nome_completo: nome, telefone, telefone_ddi, role: 'partner' },
      })
      if (created.error || !created.data.user) {
        const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
        const existing = list.data.users.find((u) => u.email?.toLowerCase() === email)
        if (!existing) {
          return jsonResponse(
            { error: 'invite_falhou', detail: invite.error.message, fallback_detail: created.error?.message },
            { status: 500 },
          )
        }
        usuarioId = existing.id
      } else {
        usuarioId = created.data.user.id
      }
      const linkRes = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${SITE_URL}/auth/partner-bootstrap` },
      })
      if (!linkRes.error) {
        actionLink = linkRes.data.properties?.action_link ?? null
      }
      fallbackReason = 'rate_limit_smtp'
    } else {
      return jsonResponse({ error: 'invite_falhou', detail: invite.error.message }, { status: 500 })
    }
  } else {
    usuarioId = invite.data.user?.id ?? null
    actionLink = (invite.data.properties as { action_link?: string } | null)?.action_link ?? null
    emailSent = true
  }

  if (!usuarioId) {
    return jsonResponse({ error: 'usuario_id_nao_resolvido' }, { status: 500 })
  }

  // 2) Promove o role no app_metadata (claim consumido pelo RLS).
  const upd = await admin.auth.admin.updateUserById(usuarioId, {
    app_metadata: { role: 'partner' },
    user_metadata: { nome_completo: nome, telefone, telefone_ddi, role: 'partner' },
  })
  if (upd.error) {
    return jsonResponse({ error: 'set_role_falhou', detail: upd.error.message }, { status: 500 })
  }

  // 3) Cria/garante o partners(pending) + partner_invites via RPC (com JWT do admin → audit log + RLS).
  const rpc = await userClient.rpc('admin_invite_partner_record', {
    p_email: email,
    p_nome_completo: nome,
    p_usuario_id: usuarioId,
    p_telefone: telefone,
    p_telefone_ddi: telefone_ddi,
    p_observacoes: observacoes,
  })
  if (rpc.error) {
    return jsonResponse({ error: 'rpc_falhou', detail: rpc.error.message }, { status: 500 })
  }

  return jsonResponse({
    ...(rpc.data as Record<string, unknown>),
    action_link: actionLink,
    email_sent: emailSent,
    fallback_reason: fallbackReason,
  })
})

