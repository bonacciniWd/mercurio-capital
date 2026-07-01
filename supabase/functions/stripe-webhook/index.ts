// supabase/functions/stripe-webhook/index.ts
// Recebe eventos do Stripe. Idempotente via stripe_webhooks_inbox.
// Eventos suportados:
//   - checkout.session.completed       → wallet topup OU ativa assinatura LMS (decide por metadata.proposito)
//   - payment_intent.succeeded         → fallback wallet
//   - payment_intent.payment_failed    → marca topup/intent como failed
//   - customer.subscription.created/updated/deleted → upsert assinaturas_universidade
//   - invoice.payment_succeeded        → marca assinatura ativa + atualiza current_period_end
//   - invoice.payment_failed           → marca assinatura past_due
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
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event)
        break
      case 'payment_intent.succeeded':
        await handleSucceeded(event)
        break
      case 'payment_intent.payment_failed':
        await handleFailed(event)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event)
        break
    }

    await service.from('stripe_webhooks_inbox')
      .update({ processado_em: new Date().toISOString() }).eq('id', event.id)

    return new Response('ok', { status: 200 })
  } catch (err) {
    return new Response(`handler_error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 })
  }
})

// -----------------------------------------------------------
// CHECKOUT (decide entre wallet_topup e lms_subscription)
// -----------------------------------------------------------
async function handleCheckoutCompleted(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const metadata = (obj.metadata ?? {}) as Record<string, string>
  const proposito = metadata.proposito ?? (obj.mode === 'subscription' ? 'lms_subscription' : 'wallet_topup')

  if (proposito === 'lms_subscription') {
    await activateLmsSubscriptionFromCheckout(obj, metadata)
  } else {
    await handleSucceeded(event)
  }
}

async function handleSucceeded(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const intentId = (obj.payment_intent as string) ?? (obj.id as string)
  if (!intentId) throw new Error('missing_intent_id')

  // Se for assinatura LMS, ignora (já tratado por subscription/checkout handlers)
  const { data: pi } = await service.from('stripe_payment_intents')
    .select('proposito').eq('id', intentId).maybeSingle()
  if (pi?.proposito === 'lms_subscription') return

  const metadata = (obj.metadata ?? {}) as Record<string, string>
  const partnerId = metadata.partner_id

  // Localiza topup
  const { data: topup, error: tErr } = await service.from('wallet_topups')
    .select('id, partner_id, wallet_id, valor_centavos, status, ledger_id')
    .eq('provider_intent_id', intentId).maybeSingle()
  if (tErr || !topup) throw new Error('topup_nao_encontrado')
  if (topup.status === 'succeeded' && topup.ledger_id) return // já creditado

  const { data: existingLedger, error: lErr } = await service
    .from('wallet_ledger')
    .select('id')
    .eq('referencia_tipo', 'topup')
    .eq('referencia_id', topup.id)
    .eq('tipo', 'recarga')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lErr) throw new Error(`ledger_lookup_fail: ${lErr.message}`)

  if (existingLedger?.id) {
    await service.from('wallet_topups').update({
      status: 'succeeded',
      confirmado_em: new Date().toISOString(),
      ledger_id: existingLedger.id,
    }).eq('id', topup.id)

    await service.from('stripe_payment_intents').update({
      status: 'succeeded',
    }).eq('id', intentId)

    return
  }

  const { data: ledger, error: cErr } = await service.rpc('wallet_credit', {
    p_partner: topup.partner_id,
    p_tipo: 'recarga',
    p_valor: topup.valor_centavos,
    p_ref_tipo: 'topup',
    p_ref_id: topup.id,
    p_correlation: topup.id,
    p_descricao: 'Recarga via Stripe',
    p_metadata: { intent_id: intentId, partner_id: partnerId },
  })

  let ledgerId = (ledger as { id?: string } | null)?.id ?? null
  if (cErr) {
    if (cErr.code === '23505') {
      const { data: existingAfterDuplicate, error: l2Err } = await service
        .from('wallet_ledger')
        .select('id')
        .eq('referencia_tipo', 'topup')
        .eq('referencia_id', topup.id)
        .eq('tipo', 'recarga')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (l2Err) throw new Error(`ledger_lookup_fail: ${l2Err.message}`)
      ledgerId = existingAfterDuplicate?.id ?? null
    } else {
      throw new Error(`wallet_credit_fail: ${cErr.message}`)
    }
  }

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

// -----------------------------------------------------------
// LMS SUBSCRIPTION
// -----------------------------------------------------------
async function activateLmsSubscriptionFromCheckout(
  obj: Record<string, unknown>,
  metadata: Record<string, string>,
) {
  const usuarioId = metadata.usuario_id
  if (!usuarioId) return

  const subscriptionId = obj.subscription as string | undefined
  const customerId = obj.customer as string | undefined
  const ciclo = (metadata.ciclo === 'anual' ? 'anual' : 'mensal') as 'mensal' | 'anual'

  await service.from('assinaturas_universidade').upsert({
    usuario_id: usuarioId,
    status: 'ativa',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    ciclo,
  }, { onConflict: 'usuario_id' })

  await service.from('notificacoes').insert({
    usuario_id: usuarioId, canal: 'in_app',
    titulo: 'Assinatura Universidade ativa',
    mensagem: 'Bem-vindo(a) à Universidade Mercurio! Acesse os cursos.',
    link: '/c/universidade',
    metadata: { subscription_id: subscriptionId, ciclo },
  })
}

async function handleSubscriptionChange(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const subId = obj.id as string
  const status = (obj.status as string) ?? 'active'
  const metadata = (obj.metadata ?? {}) as Record<string, string>
  const usuarioId = metadata.usuario_id
  if (!usuarioId) return

  const map: Record<string, string> = {
    active: 'ativa',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelada',
    incomplete: 'trialing',
    incomplete_expired: 'expirada',
    unpaid: 'past_due',
  }
  const mapped = map[status] ?? 'ativa'
  const currentPeriodEnd = obj.current_period_end as number | undefined
  const items = (obj.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data
  const priceId = items?.[0]?.price?.id

  await service.from('assinaturas_universidade').upsert({
    usuario_id: usuarioId,
    status: mapped,
    stripe_subscription_id: subId,
    stripe_customer_id: obj.customer as string | undefined,
    stripe_price_id: priceId,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : undefined,
    cancelada_em: mapped === 'cancelada' ? new Date().toISOString() : null,
  }, { onConflict: 'usuario_id' })
}

async function handleInvoicePaid(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const subId = obj.subscription as string | undefined
  if (!subId) return
  const periodEnd = obj.period_end as number | undefined
  await service.from('assinaturas_universidade').update({
    status: 'ativa',
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
  }).eq('stripe_subscription_id', subId)
}

async function handleInvoiceFailed(event: StripeEvent) {
  const obj = event.data.object as Record<string, unknown>
  const subId = obj.subscription as string | undefined
  if (!subId) return
  await service.from('assinaturas_universidade').update({
    status: 'past_due',
  }).eq('stripe_subscription_id', subId)
}

