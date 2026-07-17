// supabase/functions/lms-assinar/index.ts
// Cria Stripe Checkout Session (mode=subscription) para a Universidade Mercurio.
// POST { ciclo?: 'mensal'|'anual', success_url?, cancel_url? }
// → { assinatura_id, checkout_url, dev_mode? }
//
// Em modo dev (sem STRIPE_SECRET_KEY) cria a assinatura local com status=ativa
// e devolve URL falsa redirecionando para /c/universidade?subscribed=1.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_URL       = (Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://mercuriocapitalsa.com.br').replace(/\/+$/, '')

const PRICE_MONTHLY = Deno.env.get('STRIPE_PRICE_ID_LMS_MONTHLY') ?? ''
const PRICE_ANNUAL  = Deno.env.get('STRIPE_PRICE_ID_LMS_ANNUAL')  ?? ''

const VALOR_MENSAL_CENTAVOS = 4990
const VALOR_ANUAL_CENTAVOS  = 49900

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

  let body: { ciclo?: 'mensal' | 'anual'; success_url?: string; cancel_url?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensal'
  const valor = ciclo === 'anual' ? VALOR_ANUAL_CENTAVOS : VALOR_MENSAL_CENTAVOS
  const priceId = ciclo === 'anual' ? PRICE_ANNUAL : PRICE_MONTHLY

  // Resolve usuário
  const { data: usuario, error: uErr } = await service
    .from('usuarios').select('id, role, email, nome_completo')
    .eq('id', ures.user.id).maybeSingle()
  if (uErr || !usuario) return jsonResponse({ error: 'usuario_nao_encontrado' }, 404)

  // Já existe assinatura ativa?
  const { data: existente } = await service
    .from('assinaturas_universidade')
    .select('id, status')
    .eq('usuario_id', usuario.id)
    .maybeSingle()
  if (existente && ['ativa', 'trialing'].includes(existente.status)) {
    return jsonResponse({
      assinatura_id: existente.id,
      checkout_url: `${APP_URL}/c/universidade?subscribed=1`,
      already_active: true,
    })
  }

  // ---- Modo dev (sem Stripe configurado) ----
  if (!STRIPE_SECRET) {
    const intentId = `pi_dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    const subId = `sub_dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`

    await service.from('stripe_payment_intents').insert({
      id: intentId,
      usuario_id: usuario.id,
      partner_id: null,
      proposito: 'lms_subscription',
      valor_centavos: valor,
      status: 'succeeded',
      payload: { dev: true, ciclo, email: usuario.email },
    })

    const { data: ass, error: aErr } = await service
      .from('assinaturas_universidade')
      .upsert({
        usuario_id: usuario.id,
        status: 'ativa',
        stripe_subscription_id: subId,
        stripe_customer_id: `cus_dev_${usuario.id.slice(0, 8)}`,
        stripe_price_id: priceId || 'price_dev_lms',
        valor_centavos: valor,
        ciclo,
        current_period_end: new Date(Date.now() + (ciclo === 'anual' ? 365 : 30) * 86400000).toISOString(),
      }, { onConflict: 'usuario_id' })
      .select('id')
      .single()
    if (aErr) return jsonResponse({ error: 'falha_assinatura', detail: aErr.message }, 500)

    // Notifica usuário
    await service.from('notificacoes').insert({
      usuario_id: usuario.id, canal: 'in_app',
      titulo: 'Assinatura Universidade ativa',
      mensagem: 'Bem-vindo(a) à Universidade Mercurio! Aproveite todos os cursos.',
      link: '/c/universidade',
      metadata: { dev: true, ciclo },
    })

    return jsonResponse({
      assinatura_id: ass.id,
      checkout_url: `${APP_URL}/c/universidade?subscribed=1&dev=1`,
      dev_mode: true,
    })
  }

  // ---- Stripe real ----
  if (!priceId) {
    return jsonResponse({ error: 'price_nao_configurado', detail: `STRIPE_PRICE_ID_LMS_${ciclo.toUpperCase()} ausente` }, 500)
  }

  const successUrl = body.success_url ?? `${APP_URL}/c/universidade?subscribed=1`
  const cancelUrl  = body.cancel_url  ?? `${APP_URL}/c/universidade?subscribed=0`

  const form = new URLSearchParams()
  form.append('mode', 'subscription')
  form.append('payment_method_types[0]', 'card')
  form.append('success_url', successUrl)
  form.append('cancel_url', cancelUrl)
  form.append('customer_email', usuario.email ?? '')
  form.append('line_items[0][price]', priceId)
  form.append('line_items[0][quantity]', '1')
  form.append('metadata[usuario_id]', usuario.id)
  form.append('metadata[proposito]', 'lms_subscription')
  form.append('metadata[ciclo]', ciclo)
  form.append('subscription_data[metadata][usuario_id]', usuario.id)
  form.append('subscription_data[metadata][proposito]', 'lms_subscription')
  form.append('subscription_data[metadata][ciclo]', ciclo)

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
    id: intentId, usuario_id: usuario.id, partner_id: null,
    proposito: 'lms_subscription', valor_centavos: valor, status: 'processing',
    payload: { session_id: session.id, ciclo, email: usuario.email },
  })

  const { data: ass } = await service.from('assinaturas_universidade').upsert({
    usuario_id: usuario.id,
    status: 'trialing',
    valor_centavos: valor,
    ciclo,
    stripe_price_id: priceId,
  }, { onConflict: 'usuario_id' }).select('id').single()

  return jsonResponse({ assinatura_id: ass?.id, checkout_url: session.url })
})

