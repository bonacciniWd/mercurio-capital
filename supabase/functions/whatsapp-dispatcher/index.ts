// supabase/functions/whatsapp-dispatcher/index.ts
//
// Worker invocado por cron (ou manualmente) que drena a fila `whatsapp_mensagens`:
//  1. Chama `whatsapp_outbox_pull(p_limit)` para lockar até N mensagens pendentes.
//  2. Envia via WhatsApp Cloud API (Graph API / Meta).
//  3. Marca cada mensagem via `whatsapp_mensagem_marcar` (enviado/erro + message id).
//
// Modo dev (sem credenciais): marca como `enviado` com metadata dev_mode, drenando a
// fila sem chamar o provedor — mesma filosofia do Serasa / single-send.
//
// Nota: este worker envia `type: text` (válido na janela de 24h). Para mensagens fora
// da janela use templates aprovados via a edge `whatsapp-send` (campo template).
//
// Deploy:
//   supabase functions deploy whatsapp-dispatcher --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt
// Secrets:
//   supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... --project-ref bhagksfvszeogtjvjtpx

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
const WHATSAPP_API_VERSION = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0'

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

interface OutboxRow {
  id: string
  telefone: string
  corpo: string
  wa_template_nome: string | null
  wa_idioma: string | null
  wa_params: string[] | null
}

function buildPayload(row: OutboxRow): Record<string, unknown> {
  // Template aprovado da Meta (obrigatório para iniciar conversa fora da janela 24h)
  if (row.wa_template_nome) {
    const params = Array.isArray(row.wa_params) ? row.wa_params : []
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: row.telefone,
      type: 'template',
      template: {
        name: row.wa_template_nome,
        language: { code: row.wa_idioma || 'pt_BR' },
        ...(params.length > 0
          ? { components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: String(t) })) }] }
          : {}),
      },
    }
  }
  // Texto livre — válido apenas dentro da janela de 24h após a última msg do cliente
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: row.telefone,
    type: 'text',
    text: { preview_url: false, body: row.corpo },
  }
}

async function sendViaCloud(row: OutboxRow): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        body: JSON.stringify(buildPayload(row)),
        signal: controller.signal,
      },
    )
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`WhatsApp ${res.status}: ${JSON.stringify(payload).slice(0, 300)}`)
    }
    return (payload?.messages?.[0]?.id as string | undefined) ?? null
  } finally {
    clearTimeout(timeout)
  }
}

async function processBatch(limit: number) {
  const { data, error } = await service.rpc('whatsapp_outbox_pull', { p_limit: limit })
  if (error) throw new Error(`pull falhou: ${error.message}`)
  const rows = (data ?? []) as OutboxRow[]
  if (rows.length === 0) return { picked: 0, sent: 0, errors: 0, dev_mode: false }

  const devMode = !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID

  if (devMode) {
    for (const r of rows) {
      await service.rpc('whatsapp_mensagem_marcar', { p_id: r.id, p_status: 'enviado', p_erro: null })
    }
    return { picked: rows.length, sent: rows.length, errors: 0, dev_mode: true }
  }

  let sent = 0, errs = 0
  for (const r of rows) {
    try {
      const messageId = await sendViaCloud(r)
      await service.rpc('whatsapp_mensagem_marcar', {
        p_id: r.id, p_status: 'enviado', p_erro: null, p_evolution_id: messageId,
      })
      sent++
    } catch (e) {
      await service.rpc('whatsapp_mensagem_marcar', {
        p_id: r.id, p_status: 'erro',
        p_erro: String((e as Error)?.message ?? e).slice(0, 500),
      })
      errs++
    }
  }
  return { picked: rows.length, sent, errors: errs, dev_mode: false }
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
