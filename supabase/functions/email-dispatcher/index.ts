// supabase/functions/email-dispatcher/index.ts
//
// Worker invocado por cron (ou manualmente) que processa o `email_outbox`:
//  1. Chama `email_outbox_pull(p_limit)` para lockar até N emails pendentes.
//  2. Envia via SMTP (denomailer) usando secrets SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM.
//  3. Marca cada email como `enviado` ou `erro` via `email_outbox_marcar`.
//
// Deploy:
//   supabase functions deploy email-dispatcher --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt
// Secrets:
//   supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... SMTP_FROM='Mercurio <no-reply@mercuriocapital.com>' --project-ref bhagksfvszeogtjvjtpx
// Schedule (pg_cron exemplo): a cada minuto, invocar a função.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? ''
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '587')
const SMTP_USER = Deno.env.get('SMTP_USER') ?? ''
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') ?? 'Mercurio <no-reply@mercuriocapital.com>'

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

interface OutboxRow {
  id: string
  destinatario: string
  assunto: string
  corpo: string
}

async function processBatch(limit: number) {
  const { data, error } = await service.rpc('email_outbox_pull', { p_limit: limit })
  if (error) throw new Error(`pull falhou: ${error.message}`)
  const rows = (data ?? []) as OutboxRow[]
  if (rows.length === 0) return { picked: 0, sent: 0, errors: 0 }

  if (!SMTP_HOST) {
    // sem SMTP configurado — devolve todos como erro para evitar loop infinito
    let errs = 0
    for (const r of rows) {
      await service.rpc('email_outbox_marcar', { p_id: r.id, p_status: 'erro', p_erro: 'SMTP_HOST não configurado' })
      errs++
    }
    return { picked: rows.length, sent: 0, errors: errs }
  }

  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465,
      auth: SMTP_USER ? { username: SMTP_USER, password: SMTP_PASS } : undefined,
    },
  })

  let sent = 0, errs = 0
  for (const r of rows) {
    try {
      await client.send({
        from: SMTP_FROM,
        to: r.destinatario,
        subject: r.assunto,
        content: r.corpo,
        html: r.corpo,
      })
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
  try { await client.close() } catch { /* ignore */ }
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
