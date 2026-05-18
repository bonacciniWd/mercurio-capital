# Stripe — Configuração da Carteira (Fase 5)

Mapa de tudo que precisa ser configurado para colocar a recarga via Stripe em **produção**. Sem isso, o sistema opera em **modo dev** (`wallet-topup` cria registros mas não cobra; admin precisa creditar manualmente via `/admin/financeiro/carteiras`).

---

## 1. Conta Stripe

| Item | Onde | Notas |
|------|------|-------|
| Conta Stripe (modo **Test** primeiro, depois **Live**) | https://dashboard.stripe.com | Brasil — habilitar BRL e meios locais (PIX, cartão). |
| Ativar **PIX** | Settings → Payment methods | Necessário onboarding KYB. |
| Ativar **Cartão** | Settings → Payment methods | Padrão. |
| Branding | Settings → Branding | Logo Mercurio + cor `#C9A961`. |

---

## 2. Chaves & Secrets

Configurar em **Supabase Dashboard → Project → Edge Functions → Secrets** (`https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx/settings/functions`):

| Secret | Onde obter | Usado em |
|--------|------------|----------|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → **Secret key** (`sk_test_...` / `sk_live_...`) | `wallet-topup` (cria Checkout Session) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → endpoint → **Signing secret** (`whsec_...`) | `stripe-webhook` (verificação HMAC) |
| `APP_URL` | URL pública do app (ex.: `https://app.mercuriocapital.com.br`) | `wallet-topup` (success/cancel URLs) |

> ⚠️ **Nunca commitar** essas variáveis. Sem `STRIPE_SECRET_KEY` o edge entra em modo dev automaticamente.

---

## 3. Webhook endpoint

No Stripe → **Developers → Webhooks → Add endpoint**:

- **URL**: `https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/stripe-webhook`
- **Events to send** (mínimo):
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
- Copiar o **Signing secret** gerado → colar em `STRIPE_WEBHOOK_SECRET`.
- Testar com **Send test webhook** (`checkout.session.completed`) — deve retornar `200 {received: true}`.

---

## 4. Validação end-to-end

1. Logar como `partner` → `/p/carteira` → Recarregar **R$ 20,00** → deve redirecionar ao Checkout Stripe.
2. Pagar com cartão de teste `4242 4242 4242 4242` (qualquer CVC/data futura).
3. Conferir:
   - `wallet_topups.status = 'succeeded'` + `ledger_id` preenchido.
   - `wallet_ledger` com tipo `recarga`, valor +2000.
   - `partner_wallets.saldo_centavos` incrementado.
   - `notificacoes` para o parceiro (`carteira_recarga_concluida`).
   - `stripe_webhooks_inbox` com `event.id` único (idempotência).

---

## 5. Edges deployadas (já feito)

```bash
supabase functions deploy wallet-topup --project-ref bhagksfvszeogtjvjtpx
supabase functions deploy stripe-webhook --project-ref bhagksfvszeogtjvjtpx
```

- `wallet-topup` — `verify_jwt = true` (parceiro autenticado).
- `stripe-webhook` — `verify_jwt = false` (Stripe não envia JWT; autenticação via assinatura HMAC).

---

## 6. Checklist de Go-Live

- [ ] Conta Stripe verificada (KYB completo, conta bancária BR cadastrada).
- [ ] PIX + Cartão ativos em **Live mode**.
- [ ] `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live) e `APP_URL` configurados.
- [ ] Webhook em modo **Live** apontando para `/functions/v1/stripe-webhook`.
- [ ] Teste real com R$ 20 numa conta interna → reembolsar via Dashboard.
- [ ] Monitorar `stripe_webhooks_inbox` e logs do edge nas primeiras 24h.

---

## 7. Troubleshooting rápido

| Sintoma | Causa provável |
|---------|----------------|
| `dev_mode: true` no response do topup | `STRIPE_SECRET_KEY` ausente nos secrets. |
| Webhook retorna 401 | `STRIPE_WEBHOOK_SECRET` errado ou ausente. |
| Saldo não credita após pagamento | Webhook não está chegando — verificar URL e eventos selecionados no Stripe. |
| `already_processed` no log | OK — idempotência funcionando (Stripe reentrega). |
| `wallet bloqueada` | Admin precisa desbloquear em `/admin/financeiro/carteiras`. |

---

**Última revisão:** 2026-05-18 (Fase 5 entregue).
