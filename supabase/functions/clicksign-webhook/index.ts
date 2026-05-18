// supabase/functions/clicksign-webhook/index.ts
// Webhook da Clicksign — idempotente via clicksign_webhooks_inbox.
// Eventos tratados:
//   - 'sign'                → assinatura individual
//   - 'auto_close' | 'finish' → todos assinaram → marca contrato como assinado
//   - 'cancel'              → opcional: marca assinatura como rejeitada
//
// Header esperado para HMAC: 'Content-Hmac' (padrão da Clicksign) = "sha256=..."

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SECRET       = Deno.env.get('CLICKSIGN_WEBHOOK_SECRET') ?? ''

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function verifyHmac(payload: string, header: string, secret: string): Promise<boolean> {
  const expected = header.startsWith('sha256=') ? header.slice(7) : header
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
  return hex === expected
}

interface ClicksignEvent {
  event?: { name?: string; occurred_at?: string; data?: Record<string, unknown> }
  document?: { key?: string; status?: string }
  signers?: Array<{ key?: string; sign_as?: string; email?: string }>
  list?: { request_signature_key?: string }
  // root-level fields used as id fallback
  occurred_at?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  const raw = await req.text()

  if (SECRET) {
    const sigHeader = req.headers.get('content-hmac') ?? req.headers.get('x-clicksign-signature') ?? ''
    const ok = await verifyHmac(raw, sigHeader, SECRET)
    if (!ok) return new Response('invalid_signature', { status: 400 })
  }

  let payload: ClicksignEvent
  try { payload = JSON.parse(raw) } catch { return new Response('invalid_json', { status: 400 }) }

  const evtName = payload.event?.name ?? 'unknown'
  const documentKey = payload.document?.key
  const evtId = `${documentKey ?? 'anon'}:${evtName}:${payload.event?.occurred_at ?? payload.occurred_at ?? Date.now()}`

  // idempotência
  const { error: inboxErr } = await service.from('clicksign_webhooks_inbox')
    .insert({ id: evtId, tipo: evtName, payload })
  if (inboxErr) {
    if (inboxErr.code === '23505') return new Response('already_processed', { status: 200 })
    return new Response(`inbox_error: ${inboxErr.message}`, { status: 500 })
  }

  try {
    if (!documentKey) return finish(evtId, 'no_document_key')

    // localiza contrato por envelope_id
    const { data: contrato } = await service.from('contratos')
      .select('id, proposta_id').eq('provider_envelope_id', documentKey).maybeSingle()
    if (!contrato) return finish(evtId, 'contrato_nao_encontrado')

    if (evtName === 'sign') {
      const reqKey = payload.list?.request_signature_key
      if (reqKey) {
        await service.from('assinaturas_contrato').update({
          status: 'assinado', assinado_em: new Date().toISOString(),
        }).eq('provider_request_signature_key', reqKey)
      }
    } else if (evtName === 'auto_close' || evtName === 'finish' || evtName === 'close' || evtName === 'document_signed') {
      await service.rpc('contrato_marcar_assinado', {
        p_contrato_id: contrato.id,
        p_envelope_id: documentKey,
        p_provedor: 'clicksign',
      })
    } else if (evtName === 'cancel' || evtName === 'refusal' || evtName === 'document_refused') {
      const reqKey = payload.list?.request_signature_key
      if (reqKey) {
        await service.from('assinaturas_contrato').update({ status: 'rejeitado' })
          .eq('provider_request_signature_key', reqKey)
      }
    }

    return finish(evtId, 'ok')
  } catch (err) {
    return new Response(`handler_error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
  }
})

async function finish(id: string, msg: string) {
  await service.from('clicksign_webhooks_inbox')
    .update({ processado_em: new Date().toISOString() }).eq('id', id)
  return new Response(msg, { status: 200 })
}

