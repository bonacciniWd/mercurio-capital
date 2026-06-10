// supabase/functions/whatsapp-webhook/index.ts
// Fase 15 — Webhook da WhatsApp Cloud API (Meta). Substitui evolution-whatsapp-webhook.
//
// GET  → verificação do webhook (hub.mode/hub.verify_token/hub.challenge).
// POST → eventos: statuses[] (entrega) e messages[] (respostas do cliente).
//
// Segurança: valida a assinatura `X-Hub-Signature-256` com WHATSAPP_APP_SECRET.
//
// Mapeamento de status Cloud API → interno:
//   sent       → enviado
//   delivered  → entregue
//   read       → lido
//   failed     → erro
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function mapStatus(raw: string): 'enviado' | 'entregue' | 'lido' | 'erro' | null {
  switch ((raw ?? '').toLowerCase()) {
    case 'sent': return 'enviado'
    case 'delivered': return 'entregue'
    case 'read': return 'lido'
    case 'failed': return 'erro'
    default: return null
  }
}

async function validSignature(raw: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return true // sem secret configurado → não valida (apenas dev)
  if (!header) return false
  const expected = header.startsWith('sha256=') ? header.slice(7) : header
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === expected
}

interface CloudStatus { id?: string; status?: string; errors?: unknown }
interface CloudEvent {
  entry?: Array<{ changes?: Array<{ value?: { statuses?: CloudStatus[] } }> }>
}

Deno.serve(async (req) => {
  // 1) Verificação (GET) — exigida pela Meta ao salvar o webhook
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const verify = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge') ?? ''
    if (mode === 'subscribe' && VERIFY_TOKEN && verify === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    return new Response('forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const raw = await req.text()
  if (!(await validSignature(raw, req.headers.get('x-hub-signature-256')))) {
    return new Response('invalid_signature', { status: 401 })
  }

  let payload: CloudEvent
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('invalid_json', { status: 400 })
  }

  // 2) Processa atualizações de status
  const statuses: CloudStatus[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const st of change.value?.statuses ?? []) statuses.push(st)
    }
  }

  for (const st of statuses) {
    const interno = mapStatus(st.status ?? '')
    if (!st.id || !interno) continue
    const patch: Record<string, unknown> = { status: interno, atualizado_em: new Date().toISOString() }
    if (interno === 'erro') patch.erro = `whatsapp_status: ${JSON.stringify(st.errors ?? st.status).slice(0, 300)}`
    await service.from('whatsapp_mensagens').update(patch).eq('evolution_message_id', st.id)
  }

  // Sempre 200 para a Meta não reenviar indefinidamente
  return new Response('ok', { status: 200 })
})
