-- =============================================
-- MIGRATION 008 — ACCESS HARDENING (AUTH/RBAC)
-- =============================================

-- This migration strengthens backend auth controls without changing app routes.

-- =============================================
-- 1) HELPER FUNCTIONS FOR ACCESS DECISIONS
-- =============================================

create or replace function public.app_partner_status()
returns partner_status
language sql
stable
as $$
  select p.status
  from partners p
  where p.id = public.app_partner_id()
  limit 1
$$;

create or replace function public.app_has_verified_2fa()
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select s.verificado
      from sessoes_2fa s
      where s.usuario_id = auth.uid()
      limit 1
    ),
    false
  )
$$;

create or replace function public.app_requires_2fa()
returns boolean
language sql
stable
as $$
  select case
    when public.app_user_role() = 'admin' then true
    when public.app_user_role() = 'partner' and public.app_is_approved() then true
    else false
  end
$$;

create or replace function public.app_can_operate()
returns boolean
language sql
stable
as $$
  select case
    when auth.uid() is null then false
    when public.app_requires_2fa() and not public.app_has_verified_2fa() then false
    else true
  end
$$;

-- =============================================
-- 2) RLS HARDENING FOR CLIENTES
--    (remove broad partner/team read access)
-- =============================================

drop policy if exists "partner_team_le_clientes" on clientes;

create policy "partner_team_le_clientes_relacionados" on clientes
  for select using (
    (
      public.app_user_role() = 'partner'
      and public.app_is_approved()
      and exists (
        select 1
        from propostas p
        where p.cliente_id = clientes.id
          and p.partner_id = public.app_partner_id()
      )
    )
    or
    (
      public.app_user_role() = 'team_member'
      and exists (
        select 1
        from propostas p
        where p.cliente_id = clientes.id
          and p.equipe_id = public.app_equipe_id()
      )
    )
  );

-- =============================================
-- 3) MAGIC LINKS: SAFETY CONSTRAINTS
-- =============================================

alter table magic_links
  add constraint magic_links_expire_em_30min
  check (expires_at <= created_at + interval '30 minutes');

alter table magic_links
  add constraint magic_links_used_after_create
  check (used_at is null or used_at >= created_at);

create index if not exists magic_links_expires_idx
  on magic_links (expires_at)
  where used_at is null;

-- Increment attempts atomically and lock the link when max attempts is reached.
create or replace function public.magic_link_register_attempt(
  p_token_hash text,
  p_max_attempts int default 5
)
returns magic_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link magic_links%rowtype;
begin
  update magic_links
     set tentativas = tentativas + 1,
         used_at = case
           when tentativas + 1 >= p_max_attempts then now()
           else used_at
         end
   where token_hash = p_token_hash
     and used_at is null
     and now() < expires_at
  returning * into v_link;

  return v_link;
end;
$$;

-- =============================================
-- 4) RATE LIMIT FUNCTION (for Edge functions)
-- =============================================

create index if not exists rate_limits_lookup_idx
  on rate_limits (chave, janela_inicio desc);

create or replace function public.check_and_increment(
  p_chave text,
  p_limite int,
  p_janela interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := now() - p_janela;
  v_count int;
begin
  -- Housekeeping for old windows of the same key.
  delete from rate_limits
   where chave = p_chave
     and janela_inicio < v_inicio;

  select coalesce(sum(contagem), 0)
    into v_count
    from rate_limits
   where chave = p_chave
     and janela_inicio >= v_inicio;

  if v_count >= p_limite then
    return false;
  end if;

  insert into rate_limits (chave, contagem, janela_inicio)
  values (p_chave, 1, now());

  return true;
end;
$$;

-- =============================================
-- 5) STATUS TRANSITION VALIDATION + 2FA GATE
-- =============================================

create or replace function public.validate_proposta_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_role text := public.app_user_role();
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- 2FA requirement for admin and approved partners on operational actions.
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then
    raise exception '2fa_required';
  end if;

  if v_role = 'admin' then
    return new;
  end if;

  if v_role = 'partner' then
    -- Partner can send to pendencias after proposal and can cancel with reason.
    if (old.status = 'proposta_cliente' and new.status = 'resolucao_pendencias')
       or (new.status = 'cancelado' and coalesce(nullif(new.motivo_cancelamento, ''), '') <> '') then
      return new;
    end if;

    raise exception 'status_transition_not_allowed_for_partner: % -> %', old.status, new.status;
  end if;

  if v_role = 'team_member' then
    if old.status = 'simulacao' and new.status = 'pre_analise' then
      return new;
    end if;

    raise exception 'status_transition_not_allowed_for_team_member: % -> %', old.status, new.status;
  end if;

  raise exception 'status_transition_not_allowed_for_role: %', v_role;
end;
$$;

drop trigger if exists trg_validate_proposta_status on propostas;

create trigger trg_validate_proposta_status
  before update of status on propostas
  for each row
  execute function public.validate_proposta_status_transition();

-- =============================================
-- 6) WALLET OPERATIONS REQUIRE STRONG SESSION
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
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then
    raise exception '2fa_required';
  end if;

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
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then
    raise exception '2fa_required';
  end if;

  select * into v_wallet
    from partner_wallets
    where partner_id = p_partner
    for update;

  if not found then
    raise exception 'wallet_nao_encontrada';
  end if;

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

