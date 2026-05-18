-- =============================================
-- MIGRATION 010 — Fase 5: RPCs + views + triggers wallet/notificações
-- =============================================

-- =============================================
-- RPC: partner_wallet_summary
-- =============================================
create or replace function public.partner_wallet_summary()
  returns table (
    wallet_id              uuid,
    partner_id             uuid,
    saldo_centavos         bigint,
    moeda                  text,
    bloqueada              boolean,
    motivo_bloqueio        text,
    limite_diario_centavos bigint,
    creditos_30d           bigint,
    debitos_30d            bigint,
    ultima_movimentacao    timestamptz
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select
    w.id, w.partner_id, w.saldo_centavos, w.moeda,
    w.bloqueada, w.motivo_bloqueio, w.limite_diario_centavos,
    coalesce((
      select sum(valor_centavos) from wallet_ledger
       where wallet_id = w.id
         and tipo in ('recarga','estorno','ajuste_credito')
         and created_at >= now() - interval '30 days'
    ), 0),
    coalesce((
      select sum(valor_centavos) from wallet_ledger
       where wallet_id = w.id
         and tipo in ('debito_consulta','ajuste_debito','tarifa')
         and created_at >= now() - interval '30 days'
    ), 0),
    (select max(created_at) from wallet_ledger where wallet_id = w.id)
  from partner_wallets w
  where w.partner_id = public.app_partner_id()
     or public.app_is_admin();
$$;

-- =============================================
-- VIEW: v_wallet_extrato (com criado_por nome)
-- =============================================
create or replace view public.v_wallet_extrato as
  select
    l.id, l.wallet_id, l.partner_id, l.tipo, l.valor_centavos,
    l.saldo_antes, l.saldo_depois,
    l.referencia_tipo, l.referencia_id, l.correlation_id,
    l.descricao, l.metadata, l.created_at,
    u.nome_completo as criado_por_nome
  from wallet_ledger l
  left join usuarios u on u.id = l.criado_por
  where l.partner_id = public.app_partner_id()
     or public.app_is_admin();

-- =============================================
-- VIEW: v_admin_wallets
-- =============================================
create or replace view public.v_admin_wallets as
  select
    w.id, w.partner_id, w.saldo_centavos, w.bloqueada, w.motivo_bloqueio,
    w.limite_diario_centavos, w.updated_at,
    u.nome_completo as partner_nome,
    u.email as partner_email,
    p.cpf,
    (select max(created_at) from wallet_ledger l where l.wallet_id = w.id) as ultima_movimentacao
  from partner_wallets w
  join partners p on p.id = w.partner_id
  join usuarios u on u.id = p.usuario_id
  where public.app_is_admin();

-- =============================================
-- RPC: admin_wallet_ajuste (crédito/débito manual)
-- =============================================
create or replace function public.admin_wallet_ajuste(
  p_partner    uuid,
  p_tipo       text,           -- 'ajuste_credito' ou 'ajuste_debito'
  p_valor      bigint,
  p_descricao  text default null
) returns wallet_ledger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_entry  wallet_ledger;
  v_corr   uuid := gen_random_uuid();
begin
  if not public.app_is_admin() then
    raise exception 'forbidden';
  end if;
  if p_tipo not in ('ajuste_credito','ajuste_debito') then
    raise exception 'tipo_invalido' using hint = 'use ajuste_credito ou ajuste_debito';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor_invalido';
  end if;

  if p_tipo = 'ajuste_credito' then
    v_entry := public.wallet_credit(p_partner, 'ajuste_credito'::wallet_movimento_tipo,
      p_valor, 'manual', null, v_corr, p_descricao, jsonb_build_object('admin', auth.uid()));
  else
    v_entry := public.wallet_debit(p_partner, 'ajuste_debito'::wallet_movimento_tipo,
      p_valor, 'manual', null, v_corr, p_descricao, jsonb_build_object('admin', auth.uid()));
  end if;

  update wallet_ledger set criado_por = auth.uid() where id = v_entry.id;
  return v_entry;
end;
$$;

-- =============================================
-- RPC: admin_wallet_bloquear / desbloquear
-- =============================================
create or replace function public.admin_wallet_set_bloqueio(
  p_partner uuid,
  p_bloqueada boolean,
  p_motivo text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden';
  end if;
  update partner_wallets
     set bloqueada = p_bloqueada,
         motivo_bloqueio = case when p_bloqueada then p_motivo else null end,
         updated_at = now()
   where partner_id = p_partner;
end;
$$;

-- =============================================
-- RPC: admin_precos_upsert (versiona preço — fecha vigente_ate anterior)
-- =============================================
create or replace function public.admin_precos_upsert(
  p_tipo                       tipo_consulta,
  p_preco_centavos             bigint,
  p_custo_fornecedor_centavos  bigint default 0,
  p_descricao                  text   default null
) returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_novo_id uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden';
  end if;
  if p_preco_centavos is null or p_preco_centavos <= 0 then
    raise exception 'preco_invalido';
  end if;

  update precos_consulta
     set vigente_ate = now()
   where tipo = p_tipo and vigente_ate is null;

  insert into precos_consulta(tipo, preco_centavos, custo_fornecedor_centavos, descricao, criado_por)
  values (p_tipo, p_preco_centavos, p_custo_fornecedor_centavos, p_descricao, auth.uid())
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

-- =============================================
-- TRIGGER: notifica recarga concluída + saldo baixo + bloqueio
-- =============================================
create or replace function public.fn_notifica_wallet_movimento()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_admins   uuid;
  v_saldo    bigint := new.saldo_depois;
  v_partner  uuid := new.partner_id;
  v_threshold bigint := 5000_00; -- R$ 50,00
begin
  -- recarga concluída → notifica admins do parceiro
  if new.tipo = 'recarga' then
    for v_admins in
      select u.id from usuarios u
       where u.partner_id = v_partner
         and u.role in ('partner','team_member')
         and u.deleted_at is null
    loop
      insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
      values (
        v_admins, 'in_app',
        'Recarga confirmada',
        format('R$ %s,%s creditados na sua carteira.',
               (new.valor_centavos/100)::text,
               lpad((new.valor_centavos%100)::text, 2, '0')),
        '/p/carteira',
        jsonb_build_object('ledger_id', new.id, 'tipo', 'recarga')
      );
    end loop;
  end if;

  -- saldo baixo (após débito) → notifica
  if new.tipo in ('debito_consulta','ajuste_debito','tarifa')
     and v_saldo < v_threshold
     and (new.saldo_antes >= v_threshold)
  then
    for v_admins in
      select u.id from usuarios u
       where u.partner_id = v_partner
         and u.role = 'partner'
         and u.deleted_at is null
    loop
      insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
      values (
        v_admins, 'in_app',
        'Saldo baixo',
        format('Sua carteira está com R$ %s,%s. Recarregue para evitar interrupções.',
               (v_saldo/100)::text,
               lpad((v_saldo%100)::text, 2, '0')),
        '/p/carteira',
        jsonb_build_object('saldo', v_saldo)
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_wallet_ledger_notifica on wallet_ledger;
create trigger trg_wallet_ledger_notifica
  after insert on wallet_ledger
  for each row execute function public.fn_notifica_wallet_movimento();

-- =============================================
-- TRIGGER: notifica bloqueio/desbloqueio
-- =============================================
create or replace function public.fn_notifica_wallet_bloqueio()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user uuid;
begin
  if old.bloqueada is distinct from new.bloqueada then
    for v_user in
      select u.id from usuarios u
       where u.partner_id = new.partner_id
         and u.role = 'partner'
         and u.deleted_at is null
    loop
      insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
      values (
        v_user, 'in_app',
        case when new.bloqueada then 'Carteira bloqueada' else 'Carteira reativada' end,
        coalesce(new.motivo_bloqueio,
          case when new.bloqueada then 'Sua carteira foi bloqueada pelo administrador.'
               else 'Sua carteira foi reativada.' end),
        '/p/carteira',
        jsonb_build_object('bloqueada', new.bloqueada)
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wallet_bloqueio_notifica on partner_wallets;
create trigger trg_wallet_bloqueio_notifica
  after update on partner_wallets
  for each row execute function public.fn_notifica_wallet_bloqueio();

-- =============================================
-- GRANTS
-- =============================================
grant execute on function public.partner_wallet_summary() to authenticated;
grant execute on function public.admin_wallet_ajuste(uuid, text, bigint, text) to authenticated;
grant execute on function public.admin_wallet_set_bloqueio(uuid, boolean, text) to authenticated;
grant execute on function public.admin_precos_upsert(tipo_consulta, bigint, bigint, text) to authenticated;
grant select on public.v_wallet_extrato to authenticated;
grant select on public.v_admin_wallets to authenticated;
