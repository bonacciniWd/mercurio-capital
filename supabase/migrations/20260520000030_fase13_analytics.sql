-- =============================================
-- FASE 13 — Analytics, Network Graph & Feature Flags
-- =============================================
-- 1) Materialized views para dashboards pesados
-- 2) Função admin_rede_graph (rede de parceiros/equipes/membros)
-- 3) RPCs admin_feature_flag_upsert/_delete + view v_admin_feature_flags
-- 4) Função admin_refresh_mvs() para refresh manual/cron
-- =============================================

-- ---------- MV: partners metrics ----------
drop materialized view if exists public.mv_admin_partners_metrics cascade;

create materialized view public.mv_admin_partners_metrics as
  select
    p.id                                                                       as partner_id,
    p.status,
    u.nome_completo                                                            as nome,
    coalesce(w.saldo_centavos, 0)                                              as saldo_centavos,
    (select count(*) from public.equipes e where e.partner_id = p.id)          as equipes_count,
    (select count(*) from public.equipe_membros em
       join public.equipes e on e.id = em.equipe_id
       where e.partner_id = p.id)                                              as membros_count,
    (select count(*) from public.propostas pr where pr.partner_id = p.id)      as propostas_total,
    (select count(*) from public.propostas pr
       where pr.partner_id = p.id
         and pr.status not in ('cancelado'))                                   as propostas_ativas,
    (select coalesce(sum(pr.valor_solicitado),0)::bigint from public.propostas pr
       where pr.partner_id = p.id)                                             as volume_solicitado,
    (select coalesce(sum(pr.valor_solicitado),0)::bigint from public.propostas pr
       where pr.partner_id = p.id
         and pr.status in (
           'emissao_contrato','aguardando_assinatura','em_registro',
           'contrato_registrado','recurso_liberado'
         ))                                                                    as volume_aprovado,
    now()                                                                      as refreshed_at
  from public.partners p
  join public.usuarios u on u.id = p.usuario_id
  left join public.partner_wallets w on w.partner_id = p.id;

create unique index mv_admin_partners_metrics_pk
  on public.mv_admin_partners_metrics (partner_id);

create index mv_admin_partners_metrics_status_idx
  on public.mv_admin_partners_metrics (status);

grant select on public.mv_admin_partners_metrics to authenticated;


-- ---------- MV: funil de parceiros (agregado global) ----------
drop materialized view if exists public.mv_admin_funil_global cascade;

create materialized view public.mv_admin_funil_global as
  select
    count(*) filter (where pi.status in ('sent','accepted','expired','revoked'))         as convidados,
    count(*) filter (where pi.status = 'accepted')                                       as aceitos,
    (select count(*) from public.partners where status = 'pending')                     as em_analise,
    (select count(*) from public.partners where status = 'approved')                     as aprovados,
    (select count(*) from public.partners p
       where p.status = 'approved'
         and exists(select 1 from public.propostas pr where pr.partner_id = p.id))       as com_proposta,
    (select count(distinct pr.partner_id) from public.propostas pr
       where pr.status = 'recurso_liberado')                                             as com_comissao_paga,
    now()                                                                                as refreshed_at
  from public.partner_invites pi;

grant select on public.mv_admin_funil_global to authenticated;


-- ---------- Refresh helper ----------
create or replace function public.admin_refresh_mvs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz := clock_timestamp();
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  refresh materialized view concurrently public.mv_admin_partners_metrics;
  -- funil global não tem unique index → refresh normal
  refresh materialized view public.mv_admin_funil_global;

  return jsonb_build_object(
    'ok', true,
    'duracao_ms', (extract(epoch from clock_timestamp() - v_started) * 1000)::int,
    'refreshed_at', now()
  );
end;
$$;

revoke all on function public.admin_refresh_mvs() from public;
grant execute on function public.admin_refresh_mvs() to authenticated;


-- ---------- Rede graph ----------
create or replace function public.admin_rede_graph(
  p_status text default 'approved',
  p_limit  int  default 50
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_nodes jsonb := '[]'::jsonb;
  v_edges jsonb := '[]'::jsonb;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- admin root
  v_nodes := v_nodes || jsonb_build_array(jsonb_build_object(
    'id','admin','tipo','admin','label','Mercúrio Capital'
  ));

  -- partners (limit)
  with sel as (
    select p.id, u.nome_completo, p.status,
      (select count(*) from public.propostas pr where pr.partner_id = p.id) as propostas
    from public.partners p
    join public.usuarios u on u.id = p.usuario_id
    where (p_status is null or p.status = p_status::partner_status)
    order by propostas desc, p.created_at desc
    limit greatest(p_limit, 1)
  )
  select
    coalesce(v_nodes || jsonb_agg(jsonb_build_object(
      'id', 'partner-' || s.id,
      'tipo','partner',
      'label', s.nome_completo,
      'status', s.status,
      'propostas', s.propostas
    )), v_nodes),
    coalesce(v_edges || jsonb_agg(jsonb_build_object(
      'id', 'e-admin-partner-' || s.id,
      'source','admin',
      'target','partner-' || s.id
    )), v_edges)
  into v_nodes, v_edges from sel s;

  -- equipes dos partners selecionados
  with sel_eq as (
    select e.id, e.partner_id, e.nome,
      (select count(*) from public.equipe_membros em where em.equipe_id = e.id) as membros
    from public.equipes e
    where e.partner_id in (
      select p.id from public.partners p
      where (p_status is null or p.status = p_status::partner_status)
      order by p.created_at desc limit greatest(p_limit, 1)
    )
  )
  select
    coalesce(v_nodes || jsonb_agg(jsonb_build_object(
      'id','equipe-' || e.id,
      'tipo','equipe',
      'label', e.nome,
      'membros', e.membros
    )), v_nodes),
    coalesce(v_edges || jsonb_agg(jsonb_build_object(
      'id','e-partner-equipe-' || e.id,
      'source','partner-' || e.partner_id,
      'target','equipe-' || e.id
    )), v_edges)
  into v_nodes, v_edges from sel_eq e;

  return jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
end;
$$;

revoke all on function public.admin_rede_graph(text, int) from public;
grant execute on function public.admin_rede_graph(text, int) to authenticated;


-- ---------- Feature flags RPCs ----------
create or replace function public.admin_feature_flag_upsert(
  p_chave     text,
  p_descricao text default null,
  p_regras    jsonb default '{}'::jsonb,
  p_ativo     boolean default false,
  p_id        uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.feature_flags (chave, descricao, regras, ativo)
    values (p_chave, p_descricao, coalesce(p_regras,'{}'::jsonb), coalesce(p_ativo,false))
    on conflict (chave) do update
      set descricao = excluded.descricao,
          regras    = excluded.regras,
          ativo     = excluded.ativo
    returning id into v_id;
  else
    update public.feature_flags
       set chave     = p_chave,
           descricao = p_descricao,
           regras    = coalesce(p_regras,'{}'::jsonb),
           ativo     = coalesce(p_ativo,false)
     where id = p_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_feature_flag_upsert(text, text, jsonb, boolean, uuid) from public;
grant execute on function public.admin_feature_flag_upsert(text, text, jsonb, boolean, uuid) to authenticated;


create or replace function public.admin_feature_flag_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.feature_flags where id = p_id;
end;
$$;

revoke all on function public.admin_feature_flag_delete(uuid) from public;
grant execute on function public.admin_feature_flag_delete(uuid) to authenticated;


-- ---------- View para listagem ----------
create or replace view public.v_admin_feature_flags
with (security_invoker = on)
as
  select id, chave, descricao, regras, ativo
  from public.feature_flags
  order by chave;

grant select on public.v_admin_feature_flags to authenticated;

-- =============================================
-- Refresh inicial
-- =============================================
refresh materialized view public.mv_admin_partners_metrics;
refresh materialized view public.mv_admin_funil_global;
