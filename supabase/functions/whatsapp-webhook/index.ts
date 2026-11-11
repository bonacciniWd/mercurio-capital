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
import { hash } from '../_shared/whatsapp-runtime.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getWhatsAppWebhookChallenge, validWhatsAppSignature } from '../_shared/whatsapp-webhook-security.ts'
import { extractWhatsAppInboundMessages, isWhatsAppDuplicateInsert } from '../_shared/whatsapp-webhook-events.ts'

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

interface CloudStatus { id?: string; status?: string; errors?: unknown }
interface CloudEvent {
  object?: string
  entry?: Array<{ changes?: Array<{ value?: { statuses?: CloudStatus[]; messages?: unknown[] } }> }>
}

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024

async function readBoundedBody(req: Request): Promise<{ raw: string | null; tooLarge: boolean }> {
  const declaredLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return { raw: null, tooLarge: true }
  }
  if (!req.body) return { raw: '', tooLarge: false }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel()
      return { raw: null, tooLarge: true }
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { raw: new TextDecoder('utf-8', { fatal: true }).decode(bytes), tooLarge: false }
  } catch {
    return { raw: null, tooLarge: false }
  }
}

Deno.serve(async (req) => {
  // 1) Verificação (GET) — exigida pela Meta ao salvar o webhook
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const challenge = getWhatsAppWebhookChallenge(url, VERIFY_TOKEN)
    if (challenge !== null) {
      return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
    }
    return new Response('forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const body = await readBoundedBody(req)
  if (body.tooLarge) return new Response('payload_too_large', { status: 413 })
  if (body.raw === null) return new Response('invalid_encoding', { status: 400 })
  const raw = body.raw
  if (!(await validWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'), APP_SECRET))) {
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
    const { data: stored, error: lookupError } = await service.from('whatsapp_mensagens').select('id').eq('evolution_message_id', st.id).maybeSingle()
    if (lookupError) return new Response('status_persistence_failed', { status: 503 })
    if (stored) {
      const { error } = await service.rpc('whatsapp_mensagem_marcar', { p_id: stored.id, p_status: interno, p_erro: interno === 'erro' ? 'provedor_informou_falha' : null })
      if (error) return new Response('status_persistence_failed', { status: 503 })
    }
  }

  // 3) Persiste mensagens recebidas com apenas os campos necessários.
  // Não associar remetente a usuário/proposta usando somente o telefone.
  const inboundMessages = extractWhatsAppInboundMessages(payload)
  for (const message of inboundMessages) {
    const interaction = message.interacao
    const safe = interaction?.flow_token ? { ...interaction, flow_token_hash: await hash(interaction.flow_token) } : interaction
    if (safe && 'flow_token' in safe) delete safe.flow_token
    const { error } = await service.from('whatsapp_mensagens_recebidas').insert({ ...message, ...(safe ? { interacao: safe } : {}) })
    if (error && !isWhatsAppDuplicateInsert(error)) {
      // Retorno 5xx faz a Meta tentar novamente; a chave única evita duplicidade.
      return new Response('inbound_persistence_failed', { status: 503 })
    }
  }

  // Sempre confirmar após persistência; conflitos de ID são entregas repetidas válidas.
  return new Response('ok', { status: 200 })
})
