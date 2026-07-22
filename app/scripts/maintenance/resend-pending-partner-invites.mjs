import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const dispatch = args.has('--dispatch')
const includeOrphans = args.has('--include-orphans')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const emailArg = process.argv.find((arg) => arg.startsWith('--email='))
const sinceArg = process.argv.find((arg) => arg.startsWith('--since='))

const limit = Number(limitArg?.split('=')[1] ?? 100)
const emailFilter = emailArg?.split('=')[1]?.trim().toLowerCase()
const sinceFilter = sinceArg?.split('=')[1]?.trim()

const supabaseUrl = (process.env.SUPABASE_URL || 'https://bhagksfvszeogtjvjtpx.supabase.co').replace(/\/+$/, '')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = (
  process.env.SITE_URL ||
  process.env.APP_URL ||
  process.env.VITE_PUBLIC_APP_URL ||
  'https://mercuriocapitalsa.com.br'
).replace(/\/+$/, '')

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Export it locally before running this maintenance script.')
  process.exit(1)
}

if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
  console.error('Invalid --limit. Use an integer between 1 and 500.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { apikey: serviceRoleKey } },
})

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderEmail(invite, actionLink) {
  const nome = invite.nome_completo || invite.email.split('@')[0]
  const safeNome = escapeHtml(nome)
  const safeLink = escapeHtml(actionLink)

  return {
    subject: 'Seu convite para acessar a Mercurio Capital',
    html: `
      <p>Olá ${safeNome},</p>
      <p>Reenviamos seu convite para acessar a Mercurio Capital.</p>
      <p><a href="${safeLink}">Acessar convite</a></p>
      <p>Se o botão não abrir, copie e cole este link no navegador:</p>
      <p>${safeLink}</p>
      <p>Mercurio Capital</p>
    `,
  }
}

async function loadPendingInvites() {
  let query = supabase
    .from('partner_invites')
    .select('id,email,nome_completo,telefone,telefone_ddi,observacoes,status,partner_id,usuario_id,created_at')
    .eq('status', 'sent')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (emailFilter) query = query.eq('email', emailFilter)
  if (sinceFilter) query = query.gte('created_at', sinceFilter)

  const { data, error } = await query
  if (error) throw new Error(`Failed to load pending invites: ${error.message}`)

  const invites = data ?? []
  const partnerIds = [...new Set(invites.map((invite) => invite.partner_id).filter(Boolean))]
  const usuarioIds = [...new Set(invites.map((invite) => invite.usuario_id).filter(Boolean))]

  let validUsuarioIds = new Set()
  if (usuarioIds.length > 0) {
    const { data: usuarios, error: usuariosError } = await supabase
      .from('usuarios')
      .select('id')
      .in('id', usuarioIds)

    if (usuariosError) throw new Error(`Failed to load usuario ids: ${usuariosError.message}`)
    validUsuarioIds = new Set((usuarios ?? []).map((usuario) => usuario.id))
  }

  const invitesWithOutboxUsuario = invites.map((invite) => ({
    ...invite,
    outbox_usuario_id: invite.usuario_id && validUsuarioIds.has(invite.usuario_id) ? invite.usuario_id : null,
  }))

  if (partnerIds.length === 0) return invitesWithOutboxUsuario

  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('id,status')
    .in('id', partnerIds)

  if (partnersError) throw new Error(`Failed to load partner statuses: ${partnersError.message}`)

  const statusByPartnerId = new Map((partners ?? []).map((partner) => [partner.id, partner.status]))
  return invitesWithOutboxUsuario.filter((invite) => (statusByPartnerId.get(invite.partner_id) ?? 'pending') === 'pending')
}

function isOrphanInvite(invite) {
  return Boolean(invite.usuario_id && !invite.outbox_usuario_id)
}

async function cancelPreviousPendingResends(inviteId) {
  const { error } = await supabase
    .from('email_outbox')
    .update({
      status: 'cancelado',
      ultimo_erro: 'cancelado por novo reenvio de convite',
    })
    .eq('referencia_id', inviteId)
    .eq('metadata->>evento', 'admin_partner_invite_resend')
    .in('status', ['pendente', 'erro'])

  if (error) throw new Error(`Failed to cancel previous resend rows for ${inviteId}: ${error.message}`)
}

async function enqueueInvite(invite) {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: invite.email,
    options: { redirectTo: `${siteUrl}/auth/partner-bootstrap` },
  })

  if (linkError) throw new Error(`Failed to generate link for ${invite.email}: ${linkError.message}`)

  const actionLink = linkData?.properties?.action_link
  if (!actionLink) throw new Error(`generateLink did not return action_link for ${invite.email}`)
  if (actionLink.includes('localhost') || actionLink.includes('127.0.0.1')) {
    throw new Error(`Generated link still points to localhost for ${invite.email}`)
  }

  await cancelPreviousPendingResends(invite.id)
  const email = renderEmail(invite, actionLink)

  const { error: outboxError } = await supabase.from('email_outbox').insert({
    destinatario: invite.email,
    usuario_id: invite.outbox_usuario_id,
    assunto: email.subject,
    corpo: email.html,
    origem: 'transacional',
    referencia_id: invite.id,
    metadata: {
      evento: 'admin_partner_invite_resend',
      template: 'admin_partner_invite_resend_v1',
      partner_id: invite.partner_id,
      original_usuario_id: invite.usuario_id,
      usuario_id_orfao: Boolean(invite.usuario_id && !invite.outbox_usuario_id),
      canonical_site_url: siteUrl,
      reason: 'supabase_auth_url_corrected',
    },
  })

  if (outboxError) throw new Error(`Failed to enqueue email for ${invite.email}: ${outboxError.message}`)
}

async function dispatchOutbox() {
  const response = await fetch(`${supabaseUrl}/functions/v1/email-dispatcher?limit=100`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceRoleKey}` },
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`email-dispatcher failed: ${response.status} ${body}`)
  return body
}

const invites = await loadPendingInvites()
const processableInvites = includeOrphans ? invites : invites.filter((invite) => !isOrphanInvite(invite))
const skippedOrphans = invites.filter(isOrphanInvite)

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  dispatch,
  includeOrphans,
  supabaseUrl,
  siteUrl,
  count: invites.length,
  processable_count: processableInvites.length,
  skipped_orphan_count: skippedOrphans.length,
  invites: invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    nome_completo: invite.nome_completo,
    partner_id: invite.partner_id,
    usuario_id: invite.usuario_id,
    outbox_usuario_id: invite.outbox_usuario_id,
    usuario_id_orfao: Boolean(invite.usuario_id && !invite.outbox_usuario_id),
    created_at: invite.created_at,
  })),
  skipped_orphans: skippedOrphans.map((invite) => ({
    id: invite.id,
    email: invite.email,
    nome_completo: invite.nome_completo,
    partner_id: invite.partner_id,
    usuario_id: invite.usuario_id,
    reason: 'usuario_id nao existe em public.usuarios',
  })),
}, null, 2))

if (!apply) {
  console.log('Dry-run only. Re-run with --apply to enqueue new invite links.')
  process.exit(0)
}

let enqueued = 0
let failed = 0
for (const invite of processableInvites) {
  try {
    await enqueueInvite(invite)
    enqueued += 1
    console.log(`enqueued ${invite.email}${invite.usuario_id && !invite.outbox_usuario_id ? ' (usuario_id orfao; outbox usuario_id=null)' : ''}`)
  } catch (error) {
    failed += 1
    console.error(`failed ${invite.email}: ${error.message}`)
  }
}

console.log(JSON.stringify({ ok: failed === 0, enqueued, failed }, null, 2))

if (failed > 0) process.exitCode = 1

if (dispatch && enqueued > 0) {
  const result = await dispatchOutbox()
  console.log(result)
}