// supabase/functions/wallet-topup/index.ts
// Cria Stripe Checkout Session para recarga; insere wallet_topups + stripe_payment_intents pendentes.
// POST { valor_centavos: number, success_url?: string, cancel_url?: string }
// → { topup_id, checkout_url, dev_mode? }
// Em modo dev (sem STRIPE_SECRET_KEY) cria o topup com status processing e retorna URL falsa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

// const MIN_VALOR = 2000 // R$ 20,00
const MIN_VALOR = 50 // R$ 0,50

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: ures, error: uerr } = await userClient.auth.getUser()
  if (uerr || !ures.user) return jsonResponse({ error: 'unauthorized' }, 401)

  let body: { valor_centavos?: number; success_url?: string; cancel_url?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }
  const valor = Math.floor(Number(body.valor_centavos ?? 0))
  if (!Number.isFinite(valor) || valor < MIN_VALOR) {
    return jsonResponse({ error: 'valor_invalido', detail: `mínimo ${MIN_VALOR} centavos` }, 400)
  }

  // Resolve usuário + partner_id
  // A tabela `usuarios` NÃO possui `partner_id`. O vínculo correto é:
  //   partners.usuario_id → usuarios.id  (dono do parceiro)
  const { data: usuario, error: uErr } = await service
    .from('usuarios').select('id, role, email, nome_completo')
    .eq('id', ures.user.id).maybeSingle()
  if (uErr || !usuario) {
    return jsonResponse({ error: 'usuario_nao_encontrado', detail: uErr?.message }, 404)
  }
  if (usuario.role !== 'partner') return jsonResponse({ error: 'somente_partner' }, 403)

  const { data: partnerRow, error: pErr } = await service
    .from('partners').select('id, status')
    .eq('usuario_id', usuario.id).maybeSingle()
  if (pErr) return jsonResponse({ error: 'partner_lookup_fail', detail: pErr.message }, 500)
  if (!partnerRow) return jsonResponse({ error: 'partner_nao_vinculado' }, 403)
  if (partnerRow.status !== 'approved') {
    return jsonResponse({ error: 'partner_nao_aprovado', detail: partnerRow.status }, 403)
  }
  const partnerId = partnerRow.id

  // Garante wallet (idempotente — trigger cria, mas fallback aqui se faltar)
  let { data: wallet, error: wErr } = await service
    .from('partner_wallets').select('id, bloqueada, motivo_bloqueio')
    .eq('partner_id', partnerId).maybeSingle()
  if (wErr) return jsonResponse({ error: 'wallet_lookup_fail', detail: wErr.message }, 500)
  if (!wallet) {
    const ins = await service.from('partner_wallets')
      .insert({ partner_id: partnerId })
      .select('id, bloqueada, motivo_bloqueio').single()
    if (ins.error) return jsonResponse({ error: 'wallet_create_fail', detail: ins.error.message }, 500)
    wallet = ins.data
  }
  if (wallet.bloqueada) return jsonResponse({ error: 'wallet_bloqueada', detail: wallet.motivo_bloqueio }, 423)

  // Rate-limit: 10 recargas/h
  const { data: rl } = await service.rpc('check_and_increment', {
    chave: `topup:${partnerId}`, limite: 10, janela: '1 hour',
  })
  if (rl === false) return jsonResponse({ error: 'rate_limited' }, 429)

  // ---- Modo dev: sem STRIPE_SECRET_KEY ----
  if (!STRIPE_SECRET) {
    const intentId = `pi_dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    const { error: piErr } = await service.from('stripe_payment_intents').insert({
      id: intentId, usuario_id: usuario.id, partner_id: partnerId,
      proposito: 'wallet_topup', valor_centavos: valor, status: 'processing',
      payload: { dev: true, email: usuario.email },
    })
    if (piErr) return jsonResponse({ error: 'falha_intent', detail: piErr.message }, 500)
    const { data: topup, error: tErr } = await service.from('wallet_topups').insert({
      partner_id: partnerId, wallet_id: wallet.id, valor_centavos: valor,
      provedor: 'stripe', provider_intent_id: intentId, status: 'processing',
      metadata: { dev: true },
    }).select('id').single()
    if (tErr) return jsonResponse({ error: 'falha_topup', detail: tErr.message }, 500)
    return jsonResponse({
      topup_id: topup.id,
      checkout_url: `${APP_URL}/p/carteira/recarga?topup=${topup.id}&dev=1`,
      dev_mode: true,
    })
  }

  // ---- Stripe real ----
  const successUrl = body.success_url
    ?? `${APP_URL}/p/carteira/recarga?status=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = body.cancel_url
    ?? `${APP_URL}/p/carteira/recarga?status=cancel`

  const form = new URLSearchParams()
  form.append('mode', 'payment')
  form.append('payment_method_types[0]', 'card')
  form.append('success_url', successUrl)
  form.append('cancel_url', cancelUrl)
  form.append('customer_email', usuario.email ?? '')
  form.append('line_items[0][price_data][currency]', 'brl')
  form.append('line_items[0][price_data][unit_amount]', String(valor))
  form.append('line_items[0][price_data][product_data][name]', 'Recarga Carteira Mercurio')
  form.append('line_items[0][quantity]', '1')
  form.append('metadata[partner_id]', partnerId)
  form.append('metadata[usuario_id]', usuario.id)
  form.append('metadata[wallet_id]', wallet.id)
  form.append('metadata[proposito]', 'wallet_topup')

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${STRIPE_SECRET}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  if (!stripeRes.ok) {
    const detail = await stripeRes.text()
    return jsonResponse({ error: 'stripe_error', detail }, 502)
  }
  const session = await stripeRes.json() as { id: string; url: string; payment_intent?: string }
  const intentId = session.payment_intent ?? session.id

  await service.from('stripe_payment_intents').insert({
    id: intentId, usuario_id: usuario.id, partner_id: partnerId,
    proposito: 'wallet_topup', valor_centavos: valor, status: 'processing',
    payload: { session_id: session.id, email: usuario.email },
  })
  const { data: topup } = await service.from('wallet_topups').insert({
    partner_id: partnerId, wallet_id: wallet.id, valor_centavos: valor,
    provedor: 'stripe', provider_intent_id: intentId, status: 'processing',
    metadata: { session_id: session.id },
  }).select('id').single()

  return jsonResponse({ topup_id: topup?.id, checkout_url: session.url })
})
