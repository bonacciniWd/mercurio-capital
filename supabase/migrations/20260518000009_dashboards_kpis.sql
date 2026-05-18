-- =============================================
-- MIGRATION 021 — Dashboards & KPIs (Fase 4)
-- =============================================

-- Status que contam como "ganhou" (recurso liberado / contrato registrado).
-- Status terminais negativos: cancelado.

-- =============================================
-- View: v_partner_dashboard_kpis
-- Linha única por partner_id+equipe_id (visível ao próprio dono via WHERE)
-- =============================================
create or replace view public.v_partner_dashboard_kpis as
with base as (
  select
    p.partner_id,
    p.equipe_id,
    p.id,
    p.status,
    p.valor_solicitado,
    p.created_at,
    case when p.status in ('recurso_liberado','contrato_registrado') then 1 else 0 end as ganhou,
    case when p.status = 'cancelado' then 1 else 0 end as perdeu,
    case when p.status in ('recurso_liberado','contrato_registrado','cancelado') then 0 else 1 end as ativa,
    case when p.created_at >= date_trunc('month', now()) then 1 else 0 end as no_mes,
    case when p.created_at >= now() - interval '30 days' then 1 else 0 end as nos_30d
  from propostas p
)
select
  partner_id,
  count(*)::int                                       as total_propostas,
  sum(no_mes)::int                                    as propostas_mes,
  sum(nos_30d)::int                                   as propostas_30d,
  sum(ativa)::int                                     as ativas,
  sum(ganhou)::int                                    as ganhas,
  sum(perdeu)::int                                    as canceladas,
  case when count(*) > 0
       then round( (sum(ganhou)::numeric / count(*)) * 100, 1 )
       else 0 end                                      as taxa_conversao,
  coalesce(sum(case when ganhou = 1 then valor_solicitado end), 0) as volume_ganho,
  coalesce(avg(case when ganhou = 1 then valor_solicitado end), 0) as ticket_medio_ganho,
  coalesce(sum(valor_solicitado), 0)                  as volume_total
from base
where public.app_is_admin() or partner_id = public.app_partner_id()
group by partner_id;

grant select on public.v_partner_dashboard_kpis to authenticated;

-- =============================================
-- View: v_partner_funil_status — contagem por status
-- =============================================
create or replace view public.v_partner_funil_status as
  select
    p.partner_id,
    p.status,
    count(*)::int as quantidade,
    coalesce(sum(p.valor_solicitado), 0) as volume
  from propostas p
  where public.app_is_admin() or p.partner_id = public.app_partner_id()
  group by p.partner_id, p.status;

grant select on public.v_partner_funil_status to authenticated;

-- =============================================
-- View: v_partner_propostas_por_mes (últimos 12 meses)
-- =============================================
create or replace view public.v_partner_propostas_por_mes as
  select
    p.partner_id,
    date_trunc('month', p.created_at) as mes,
    count(*)::int as quantidade,
    sum(case when p.status in ('recurso_liberado','contrato_registrado') then 1 else 0 end)::int as ganhas,
    coalesce(sum(p.valor_solicitado), 0) as volume
  from propostas p
  where p.created_at >= now() - interval '12 months'
    and (public.app_is_admin() or p.partner_id = public.app_partner_id())
  group by p.partner_id, date_trunc('month', p.created_at);

grant select on public.v_partner_propostas_por_mes to authenticated;

-- =============================================
-- View: v_partner_gargalos — propostas paradas há > 7 dias
-- =============================================
create or replace view public.v_partner_gargalos as
  select
    p.id,
    p.partner_id,
    p.protocolo,
    p.status,
    p.valor_solicitado,
    p.updated_at,
    extract(day from (now() - p.updated_at))::int as dias_parada,
    c.nome_completo as cliente_nome
  from propostas p
  left join clientes c on c.id = p.cliente_id
  where p.status not in ('recurso_liberado','contrato_registrado','cancelado')
    and p.updated_at < now() - interval '7 days'
    and (public.app_is_admin() or p.partner_id = public.app_partner_id());

grant select on public.v_partner_gargalos to authenticated;

-- =============================================
-- View: v_admin_dashboard_kpis — visão global (apenas admin)
-- =============================================
create or replace view public.v_admin_dashboard_kpis as
with base as (
  select
    p.id,
    p.status,
    p.partner_id,
    p.valor_solicitado,
    p.created_at,
    case when p.status in ('recurso_liberado','contrato_registrado') then 1 else 0 end as ganhou,
    case when p.status = 'cancelado' then 1 else 0 end as perdeu,
    case when p.status in ('recurso_liberado','contrato_registrado','cancelado') then 0 else 1 end as ativa,
    case when p.created_at >= date_trunc('month', now()) then 1 else 0 end as no_mes
  from propostas p
)
select
  count(*)::int                                                          as total_propostas,
  sum(no_mes)::int                                                       as propostas_mes,
  sum(ativa)::int                                                        as ativas,
  sum(ganhou)::int                                                       as ganhas,
  sum(perdeu)::int                                                       as canceladas,
  case when count(*) > 0
       then round( (sum(ganhou)::numeric / count(*)) * 100, 1 )
       else 0 end                                                         as taxa_conversao,
  coalesce(sum(case when ganhou = 1 then valor_solicitado end), 0)       as volume_ganho,
  coalesce(sum(valor_solicitado), 0)                                     as volume_total,
  count(distinct partner_id)::int                                        as parceiros_ativos
from base
where public.app_is_admin();

grant select on public.v_admin_dashboard_kpis to authenticated;

create or replace view public.v_admin_top_partners as
  select
    p.partner_id,
    u.nome_completo as partner_nome,
    count(*)::int as total,
    sum(case when p.status in ('recurso_liberado','contrato_registrado') then 1 else 0 end)::int as ganhas,
    coalesce(sum(p.valor_solicitado), 0) as volume
  from propostas p
  join partners pa on pa.id = p.partner_id
  join usuarios u on u.id = pa.usuario_id
  where public.app_is_admin()
  group by p.partner_id, u.nome_completo
  order by volume desc
  limit 20;

grant select on public.v_admin_top_partners to authenticated;
