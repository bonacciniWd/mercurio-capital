// supabase/functions/stripe-webhook/index.ts
// Recebe eventos do Stripe. Idempotente via stripe_webhooks_inbox.
// Eventos suportados:
//   - checkout.session.completed → confirma topup + credita carteira
//   - payment_intent.succeeded   → fallback (mesma lógica)
//   - payment_intent.payment_failed → marca topup como failed
//
// Em modo dev (sem STRIPE_WEBHOOK_SECRET), aceita JSON simulado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
  const t = parts['t']
  const v1 = parts['v1']
  if (!t || !v1) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`))
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return expected === v1
}

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  const raw = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  if (WEBHOOK_SECRET) {
    const ok = await verifyStripeSignature(raw, sig, WEBHOOK_SECRET)
    if (!ok) return new Response('invalid_signature', { status: 400 })
  }

  let event: StripeEvent
  try { event = JSON.parse(raw) } catch { return new Response('invalid_json', { status: 400 }) }

  // Idempotência
  const { error: inboxErr } = await service.from('stripe_webhooks_inbox')
    .insert({ id: event.id, tipo: event.type, payload: event })
  if (inboxErr) {
    // duplicate key = já processado
    if (inboxErr.code === '23505') return new Response('already_processed', { status: 200 })
    return new Response(`inbox_error: ${inboxErr.message}`, { status: 500 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleSucceeded(event)
    } else if (event.type === 'payment_intent.succeeded') {
      await handleSucceeded(event)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handleFailed(event)
    }

    await service.from('stripe_webhooks_inbox')
      .update({ processado_em: new Date().toISOString() }).eq('id', event.id)

    return new Response('ok', { status: 200 })
  } catch (err) {
    return new Response(`handler_error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
  }
})

async function handleSucceeded(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const intentId = (obj.payment_intent as string) ?? (obj.id as string)
  const metadata = (obj.metadata ?? {}) as Record<string, string>
  const partnerId = metadata.partner_id
  if (!intentId) throw new Error('missing_intent_id')

  // Localiza topup
  const { data: topup, error: tErr } = await service.from('wallet_topups')
    .select('id, partner_id, wallet_id, valor_centavos, status, ledger_id')
    .eq('provider_intent_id', intentId).maybeSingle()
  if (tErr || !topup) throw new Error('topup_nao_encontrado')
  if (topup.status === 'succeeded' && topup.ledger_id) return // já creditado

  // Credita via RPC
  const { data: ledger, error: cErr } = await service.rpc('wallet_credit', {
    p_partner: topup.partner_id,
    p_tipo: 'recarga',
    p_valor: topup.valor_centavos,
    p_ref_tipo: 'topup',
    p_ref_id: topup.id,
    p_correlation: crypto.randomUUID(),
    p_descricao: 'Recarga via Stripe',
    p_metadata: { intent_id: intentId, partner_id: partnerId },
  })
  if (cErr) throw new Error(`wallet_credit_fail: ${cErr.message}`)

  const ledgerId = (ledger as { id?: string } | null)?.id ?? null

  await service.from('wallet_topups').update({
    status: 'succeeded', confirmado_em: new Date().toISOString(),
    ledger_id: ledgerId,
  }).eq('id', topup.id)

  await service.from('stripe_payment_intents').update({
    status: 'succeeded',
  }).eq('id', intentId)
}

async function handleFailed(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const intentId = obj.id as string
  if (!intentId) return
  await service.from('wallet_topups').update({ status: 'failed' })
    .eq('provider_intent_id', intentId)
  await service.from('stripe_payment_intents').update({ status: 'failed' })
    .eq('id', intentId)
}
