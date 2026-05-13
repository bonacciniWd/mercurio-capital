-- =============================================
-- MIGRATION 005 — CARTEIRA DO PARCEIRO (WALLET)
-- =============================================

-- =============================================
-- PARTNER_WALLETS (1:1 com partners)
-- =============================================

create table partner_wallets (
  id                     uuid primary key default gen_random_uuid(),
  partner_id             uuid not null unique references partners(id) on delete restrict,
  saldo_centavos         bigint not null default 0 check (saldo_centavos >= 0),
  moeda                  text not null default 'BRL',
  limite_diario_centavos bigint,           -- null = sem limite diário
  bloqueada              boolean not null default false,
  motivo_bloqueio        text,
  versao                 bigint not null default 0, -- Optimistic Concurrency Control
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table partner_wallets enable row level security;

create policy "partner_le_propria_wallet" on partner_wallets
  for select using (partner_id = public.app_partner_id() or public.app_is_admin());

create policy "team_le_wallet_equipe" on partner_wallets
  for select using (
    partner_id in (
      select p.id from partners p
      join equipes e on e.partner_id = p.id
      where e.id = public.app_equipe_id()
    )
    and public.app_user_role() = 'team_member'
  );

create policy "admin_full_wallets" on partner_wallets
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_wallets_updated_at
  before update on partner_wallets
  for each row execute function set_updated_at();

-- Cria carteira automaticamente ao inserir partner
create or replace function criar_wallet_parceiro()
  returns trigger language plpgsql security definer as $$
begin
  insert into partner_wallets (partner_id)
  values (new.id)
  on conflict (partner_id) do nothing;
  return new;
end;
$$;

create trigger trg_cria_wallet_parceiro
  after insert on partners
  for each row execute function criar_wallet_parceiro();

-- =============================================
-- WALLET_LEDGER (append-only — fonte da verdade)
-- =============================================

create table wallet_ledger (
  id              uuid primary key default gen_random_uuid(),
  wallet_id       uuid not null references partner_wallets(id) on delete restrict,
  partner_id      uuid not null references partners(id) on delete restrict, -- denormalizado
  tipo            wallet_movimento_tipo not null,
  valor_centavos  bigint not null check (valor_centavos > 0), -- sempre positivo; tipo define sinal
  saldo_antes     bigint not null,
  saldo_depois    bigint not null,
  referencia_tipo text check (referencia_tipo in ('consulta','topup','manual','assinatura_lms')),
  referencia_id   uuid,
  correlation_id  uuid,   -- mesmo id em débito + estorno
  descricao       text,
  metadata        jsonb not null default '{}',
  criado_por      uuid references usuarios(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index wallet_ledger_wallet_idx      on wallet_ledger (wallet_id, created_at desc);
create index wallet_ledger_partner_idx     on wallet_ledger (partner_id, created_at desc);
create index wallet_ledger_ref_idx         on wallet_ledger (referencia_tipo, referencia_id);
create index wallet_ledger_correlation_idx on wallet_ledger (correlation_id);

alter table wallet_ledger enable row level security;

create policy "partner_le_proprio_ledger" on wallet_ledger
  for select using (partner_id = public.app_partner_id() or public.app_is_admin());

create policy "team_le_ledger_equipe" on wallet_ledger
  for select using (
    partner_id in (
      select p.id from partners p
      join equipes e on e.partner_id = p.id
      where e.id = public.app_equipe_id()
    )
    and public.app_user_role() = 'team_member'
  );

-- ledger é imutável: bloqueia UPDATE e DELETE para todos
create policy "ninguem_atualiza_ledger" on wallet_ledger
  for update using (false);

create policy "ninguem_deleta_ledger" on wallet_ledger
  for delete using (false);

-- INSERT somente via funções SECURITY DEFINER (wallet_debit / wallet_credit)
create policy "service_insere_ledger" on wallet_ledger
  for insert with check (false); -- edge functions usam service_role

-- =============================================
-- PRECOS_CONSULTA
-- =============================================

create table precos_consulta (
  id                        uuid primary key default gen_random_uuid(),
  tipo                      tipo_consulta not null,
  preco_centavos            bigint not null check (preco_centavos > 0),
  custo_fornecedor_centavos bigint not null default 0,
  vigente_de                timestamptz not null default now(),
  vigente_ate               timestamptz,  -- null = ainda vigente
  descricao                 text,
  criado_por                uuid references usuarios(id) on delete set null,
  created_at                timestamptz not null default now()
);

-- garante único preço vigente por tipo
create unique index precos_consulta_vigente_idx
  on precos_consulta (tipo) where vigente_ate is null;

alter table precos_consulta enable row level security;

create policy "autenticados_le_precos" on precos_consulta
  for select using (auth.role() = 'authenticated');

create policy "admin_full_precos" on precos_consulta
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- =============================================
-- WALLET_TOPUPS
-- =============================================

create table wallet_topups (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references partners(id) on delete restrict,
  wallet_id          uuid not null references partner_wallets(id) on delete restrict,
  valor_centavos     bigint not null check (valor_centavos >= 2000), -- mínimo R$ 20,00
  provedor           text not null default 'stripe',
  provider_intent_id text unique,
  status             stripe_intent_status not null default 'requires_payment_method',
  confirmado_em      timestamptz,
  ledger_id          uuid references wallet_ledger(id) on delete set null,
  metadata           jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index topups_partner_idx on wallet_topups (partner_id, created_at desc);

alter table wallet_topups enable row level security;

create policy "partner_le_proprios_topups" on wallet_topups
  for select using (partner_id = public.app_partner_id() or public.app_is_admin());

create policy "admin_full_topups" on wallet_topups
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_topups_updated_at
  before update on wallet_topups
  for each row execute function set_updated_at();

-- =============================================
-- STRIPE_PAYMENT_INTENTS
-- =============================================

create table stripe_payment_intents (
  id                text primary key,  -- pi_xxx do Stripe
  cliente_stripe_id text,
  usuario_id        uuid references usuarios(id) on delete set null,
  partner_id        uuid references partners(id) on delete set null,
  proposito         text not null check (proposito in ('wallet_topup','lms_subscription')),
  valor_centavos    bigint not null,
  status            stripe_intent_status not null,
  payload           jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table stripe_payment_intents enable row level security;

create policy "admin_full_stripe_intents" on stripe_payment_intents
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_le_proprios_intents" on stripe_payment_intents
  for select using (partner_id = public.app_partner_id());

create trigger trg_stripe_intents_updated_at
  before update on stripe_payment_intents
  for each row execute function set_updated_at();

-- =============================================
-- STRIPE_WEBHOOKS_INBOX (idempotência)
-- =============================================

create table stripe_webhooks_inbox (
  id            text primary key,  -- evt_xxx do Stripe
  tipo          text not null,
  recebido_em   timestamptz not null default now(),
  processado_em timestamptz,
  payload       jsonb not null
);

alter table stripe_webhooks_inbox enable row level security;

-- acesso exclusivo por service_role (edge functions)
create policy "somente_service_role_webhooks" on stripe_webhooks_inbox
  for all using (false);

-- =============================================
-- FUNÇÃO: wallet_debit (atômica, SECURITY DEFINER)
-- Chamada pelas Edge Functions antes de cada consulta paga.
-- Usa SERIALIZABLE implicitamente quando chamada em transação isolada.
-- =============================================

create or replace function wallet_debit(
  p_partner      uuid,
  p_tipo         wallet_movimento_tipo,
  p_valor        bigint,
  p_ref_tipo     text,
  p_ref_id       uuid,
  p_correlation  uuid,
  p_descricao    text    default null,
  p_metadata     jsonb   default '{}'
)
returns wallet_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet partner_wallets%rowtype;
  v_entry  wallet_ledger%rowtype;
begin
  -- lock pessimista na linha da carteira
  select * into v_wallet
    from partner_wallets
    where partner_id = p_partner
    for update;

  if not found then
    raise exception 'wallet_nao_encontrada'
      using hint = 'Verifique o partner_id informado';
  end if;

  if v_wallet.bloqueada then
    raise exception 'wallet_bloqueada'
      using hint = coalesce(v_wallet.motivo_bloqueio, 'Carteira bloqueada pelo administrador');
  end if;

  if v_wallet.saldo_centavos < p_valor then
    raise exception 'saldo_insuficiente'
      using detail = format(
        'saldo_atual=%s centavos | preco_consulta=%s centavos',
        v_wallet.saldo_centavos, p_valor
      );
  end if;

  insert into wallet_ledger (
    wallet_id, partner_id, tipo, valor_centavos,
    saldo_antes, saldo_depois,
    referencia_tipo, referencia_id,
    correlation_id, descricao, metadata
  ) values (
    v_wallet.id, p_partner, p_tipo, p_valor,
    v_wallet.saldo_centavos, v_wallet.saldo_centavos - p_valor,
    p_ref_tipo, p_ref_id,
    p_correlation, p_descricao, p_metadata
  ) returning * into v_entry;

  update partner_wallets
    set saldo_centavos = saldo_centavos - p_valor,
        versao         = versao + 1,
        updated_at     = now()
    where id = v_wallet.id;

  return v_entry;
end;
$$;

-- =============================================
-- FUNÇÃO: wallet_credit (recarga, estorno, ajuste)
-- =============================================

create or replace function wallet_credit(
  p_partner      uuid,
  p_tipo         wallet_movimento_tipo,
  p_valor        bigint,
  p_ref_tipo     text,
  p_ref_id       uuid,
  p_correlation  uuid,
  p_descricao    text   default null,
  p_metadata     jsonb  default '{}'
)
returns wallet_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet partner_wallets%rowtype;
  v_entry  wallet_ledger%rowtype;
begin
  select * into v_wallet
    from partner_wallets
    where partner_id = p_partner
    for update;

  if not found then
    raise exception 'wallet_nao_encontrada';
  end if;

  -- carteira bloqueada: permite apenas estorno e ajuste_credito (admin)
  if v_wallet.bloqueada and p_tipo not in ('estorno','ajuste_credito') then
    raise exception 'wallet_bloqueada'
      using hint = coalesce(v_wallet.motivo_bloqueio, 'Carteira bloqueada');
  end if;

  insert into wallet_ledger (
    wallet_id, partner_id, tipo, valor_centavos,
    saldo_antes, saldo_depois,
    referencia_tipo, referencia_id,
    correlation_id, descricao, metadata
  ) values (
    v_wallet.id, p_partner, p_tipo, p_valor,
    v_wallet.saldo_centavos, v_wallet.saldo_centavos + p_valor,
    p_ref_tipo, p_ref_id,
    p_correlation, p_descricao, p_metadata
  ) returning * into v_entry;

  update partner_wallets
    set saldo_centavos = saldo_centavos + p_valor,
        versao         = versao + 1,
        updated_at     = now()
    where id = v_wallet.id;

  return v_entry;
end;
$$;


