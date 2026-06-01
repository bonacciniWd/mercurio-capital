// supabase/functions/email-dispatcher/index.ts
//
// Worker invocado por cron (ou manualmente) que processa o `email_outbox`:
//  1. Chama `email_outbox_pull(p_limit)` para lockar até N emails pendentes.
//  2. Envia via Resend API (HTTP) usando o secret RESEND_API_KEY.
//  3. Marca cada email como `enviado` ou `erro` via `email_outbox_marcar`.
//
// Deploy:
//   supabase functions deploy email-dispatcher --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt
// Secrets:
//   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM='Mercurio <no-reply@mercuriocapital.com>' --project-ref bhagksfvszeogtjvjtpx

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM    = Deno.env.get('RESEND_FROM') ?? 'Mercurio Capital <no-reply@mercuriocapital.com>'

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

interface OutboxRow {
  id: string
  destinatario: string
  assunto: string
  corpo: string
}

async function sendViaResend(row: OutboxRow): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [row.destinatario],
      subject: row.assunto,
      html: row.corpo,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
}

async function processBatch(limit: number) {
  const { data, error } = await service.rpc('email_outbox_pull', { p_limit: limit })
  if (error) throw new Error(`pull falhou: ${error.message}`)
  const rows = (data ?? []) as OutboxRow[]
  if (rows.length === 0) return { picked: 0, sent: 0, errors: 0 }

  if (!RESEND_API_KEY) {
    // sem RESEND_API_KEY configurado — marca como erro para não ficar em loop
    for (const r of rows) {
      await service.rpc('email_outbox_marcar', { p_id: r.id, p_status: 'erro', p_erro: 'RESEND_API_KEY não configurado' })
    }
    return { picked: rows.length, sent: 0, errors: rows.length }
  }

  let sent = 0, errs = 0
  for (const r of rows) {
    try {
      await sendViaResend(r)
      await service.rpc('email_outbox_marcar', { p_id: r.id, p_status: 'enviado' })
      sent++
    } catch (e) {
      await service.rpc('email_outbox_marcar', {
        p_id: r.id, p_status: 'erro',
        p_erro: String((e as Error)?.message ?? e).slice(0, 500),
      })
      errs++
    }
  }
  return { picked: rows.length, sent, errors: errs }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')))
    const result = await processBatch(limit)
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
