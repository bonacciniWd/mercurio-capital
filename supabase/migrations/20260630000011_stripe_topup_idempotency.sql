-- Fase Stripe hardening: garante 1 único crédito de recarga por topup.
-- Evita crédito duplicado em corridas entre eventos Stripe (ex.: checkout.session.completed
-- e payment_intent.succeeded chegando muito próximos).

create unique index if not exists wallet_ledger_topup_recarga_once_idx
  on public.wallet_ledger (referencia_id)
  where referencia_tipo = 'topup'
    and tipo = 'recarga';
