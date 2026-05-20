// supabase/functions/email-bounce-webhook/index.ts
//
// Recebe webhooks de bounce/dropped/blocked do provedor SMTP (SendGrid/Postmark/Mailgun)
// e marca os partner_invites correspondentes como `expired`.
//
// Deploy: `supabase functions deploy email-bounce-webhook --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt`
// Secrets: `supabase secrets set BOUNCE_WEBHOOK_SECRET=... --project-ref bhagksfvszeogtjvjtpx`
//
// Suporta provider via query string: ?provider=sendgrid|postmark|mailgun|generic (default: generic).
// Idempotência total: cada event_id é persistido na tabela email_bounces_inbox (PK).
//
// Formatos aceitos:
//   - SendGrid: array no body, items com `email`, `event` ('bounce'|'dropped'|'blocked'), `sg_event_id`, `reason`.
//   - Postmark: objeto com `Type` ('HardBounce'|'SoftBounce'|'SpamComplaint'), `Email`, `MessageID`, `Description`.
//   - Mailgun: form-encoded; usar `event-data` se vier multipart, ou body JSON via `webhook.signing_key`.
//   - generic: `{ event_id, email, reason? }` ou `{ events: [...] }`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('BOUNCE_WEBHOOK_SECRET') ?? ''

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

type Provider = 'sendgrid' | 'postmark' | 'mailgun' | 'generic'

type BounceEvent = {
  event_id: string
  email: string
  reason: string | null
  payload: Record<string, unknown>
}

const BOUNCE_EVENT_TYPES_SG = new Set(['bounce', 'dropped', 'blocked', 'spamreport'])

async function verifyHmacHex(payload: string, sigHex: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  // comparação simples (Deno < 1.40 não tem timingSafeEqual no crypto.subtle, mas a request é low-volume)
  return expected.toLowerCase() === sigHex.toLowerCase()
}

function pickEvents(provider: Provider, body: unknown): BounceEvent[] {
  const events: BounceEvent[] = []
  // SendGrid: array de eventos
  if (provider === 'sendgrid' && Array.isArray(body)) {
    for (const e of body as Record<string, unknown>[]) {
      const ev = String(e?.event ?? '').toLowerCase()
      if (!BOUNCE_EVENT_TYPES_SG.has(ev)) continue
      const email = String(e?.email ?? '').trim()
      const eid   = String(e?.sg_event_id ?? e?.['sg-event-id'] ?? '').trim()
      if (!email || !eid) continue
      events.push({
        event_id: `sg_${eid}`,
        email,
        reason: (e?.reason as string) ?? (e?.response as string) ?? ev,
        payload: e,
      })
    }
    return events
  }
  // Postmark: objeto único
  if (provider === 'postmark' && body && typeof body === 'object' && !Array.isArray(body)) {
    const e = body as Record<string, unknown>
    const type = String(e?.Type ?? '').toLowerCase()
    if (type.includes('bounce') || type.includes('spamcomplaint')) {
      const email = String(e?.Email ?? '').trim()
      const eid   = String(e?.ID ?? e?.MessageID ?? '').trim()
      if (email && eid) {
        events.push({
          event_id: `pm_${eid}`,
          email,
          reason: (e?.Description as string) ?? (e?.Details as string) ?? type,
          payload: e,
        })
      }
    }
    return events
  }
  // Mailgun: objeto { signature, "event-data" }
  if (provider === 'mailgun' && body && typeof body === 'object') {
    const e = (body as Record<string, unknown>)['event-data'] as Record<string, unknown> | undefined
    if (e) {
      const ev = String(e?.event ?? '').toLowerCase()
      if (ev === 'failed' || ev === 'rejected' || ev === 'complained') {
        const recipient = (e?.recipient as string) ?? ''
        const eid = String(e?.id ?? '').trim()
        if (recipient && eid) {
          events.push({
            event_id: `mg_${eid}`,
            email: recipient.trim(),
            reason: (e?.reason as string) ?? ev,
            payload: e,
          })
        }
      }
    }
    return events
  }
  // generic: { event_id, email, reason? } ou { events: [...] }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    const list = Array.isArray(b.events) ? b.events as Record<string, unknown>[] : [b]
    for (const e of list) {
      const eid   = String(e?.event_id ?? e?.id ?? '').trim()
      const email = String(e?.email ?? e?.recipient ?? '').trim()
      if (!eid || !email) continue
      events.push({
        event_id: eid.startsWith('gen_') ? eid : `gen_${eid}`,
        email,
        reason: (e?.reason as string) ?? null,
        payload: e,
      })
    }
  }
  return events
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const providerParam = (url.searchParams.get('provider') ?? 'generic').toLowerCase()
  const provider: Provider = (['sendgrid', 'postmark', 'mailgun', 'generic'].includes(providerParam)
    ? providerParam : 'generic') as Provider

  const raw = await req.text()

  // Assinatura HMAC opcional (recomendada).
  // Provedores reais usam headers próprios — esta verificação genérica funciona com X-Signature em hex.
  if (WEBHOOK_SECRET) {
    const sigHeader =
      req.headers.get('x-bounce-signature') ??
      req.headers.get('x-signature') ?? ''
    if (!sigHeader) {
      return new Response('missing_signature', { status: 401 })
    }
    const ok = await verifyHmacHex(raw, sigHeader, WEBHOOK_SECRET)
    if (!ok) {
      return new Response('invalid_signature', { status: 401 })
    }
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch {
    return new Response('invalid_json', { status: 400 })
  }

  const events = pickEvents(provider, body)
  if (events.length === 0) {
    // não é bounce relevante — responde 200 para o provedor não tentar de novo
    return Response.json({ ok: true, processed: 0, ignored: true })
  }

  const results: Array<{ event_id: string; expired?: boolean; duplicate?: boolean; error?: string }> = []
  for (const ev of events) {
    const { data, error } = await service.rpc('process_email_bounce', {
      p_event_id: ev.event_id,
      p_provider: provider,
      p_email:    ev.email,
      p_reason:   ev.reason,
      p_payload:  ev.payload,
    })
    if (error) {
      results.push({ event_id: ev.event_id, error: error.message })
    } else {
      const r = (data ?? {}) as { duplicate?: boolean; expired?: boolean }
      results.push({
        event_id:  ev.event_id,
        duplicate: !!r.duplicate,
        expired:   !!r.expired,
      })
    }
  }

  return Response.json({ ok: true, provider, processed: results.length, results })
})
