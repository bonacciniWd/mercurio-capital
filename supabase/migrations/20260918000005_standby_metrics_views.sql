-- Standby is operational backlog and must not alter financial/production KPIs.
create or replace view public.v_partner_dashboard_kpis as
with base as (
  select p.partner_id, p.equipe_id, p.id, p.status, p.valor_solicitado, p.created_at,
    case when p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo') then 1 else 0 end as ganhou,
    case when p.status = 'cancelado' then 1 else 0 end as perdeu,
    case when p.status in ('contrato_registrado','completo','cancelado','standby') then 0 else 1 end as ativa,
    case when p.created_at >= date_trunc('month', now()) then 1 else 0 end as no_mes,
    case when p.created_at >= now() - interval '30 days' then 1 else 0 end as nos_30d
  from public.propostas p
  where p.status <> 'standby'
)
select partner_id, count(*)::int total_propostas, sum(no_mes)::int propostas_mes,
  sum(nos_30d)::int propostas_30d, sum(ativa)::int ativas, sum(ganhou)::int ganhas,
  sum(perdeu)::int canceladas,
  case when count(*) > 0 then round((sum(ganhou)::numeric / count(*)) * 100, 1) else 0 end taxa_conversao,
  coalesce(sum(case when ganhou=1 then valor_solicitado end),0) volume_ganho,
  coalesce(avg(case when ganhou=1 then valor_solicitado end),0) ticket_medio_ganho,
  coalesce(sum(valor_solicitado),0) volume_total
from base where public.app_is_admin() or partner_id=public.app_partner_id() group by partner_id;

create or replace view public.v_partner_propostas_por_mes as
select p.partner_id, date_trunc('month',p.created_at) mes, count(*)::int quantidade,
  count(*) filter (where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
  coalesce(sum(p.valor_solicitado),0) volume
from public.propostas p
where p.status <> 'standby' and p.created_at >= now() - interval '12 months'
  and (public.app_is_admin() or p.partner_id=public.app_partner_id())
group by p.partner_id,date_trunc('month',p.created_at);

create or replace view public.v_partner_gargalos as
select p.id,p.partner_id,p.protocolo,p.status,p.valor_solicitado,p.updated_at,
  extract(day from (now()-p.updated_at))::int dias_parada,c.nome_completo cliente_nome
from public.propostas p left join public.clientes c on c.id=p.cliente_id
where p.status not in ('contrato_registrado','completo','cancelado','standby')
  and p.updated_at < now()-interval '7 days'
  and (public.app_is_admin() or p.partner_id=public.app_partner_id());

create or replace view public.v_admin_dashboard_kpis as
with base as (
  select p.id,p.status,p.partner_id,p.valor_solicitado,p.created_at,
    case when p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo') then 1 else 0 end ganhou,
    case when p.status='cancelado' then 1 else 0 end perdeu,
    case when p.status in ('contrato_registrado','completo','cancelado','standby') then 0 else 1 end ativa,
    case when p.created_at >= date_trunc('month',now()) then 1 else 0 end no_mes
  from public.propostas p where p.status <> 'standby'
)
select count(*)::int total_propostas,sum(no_mes)::int propostas_mes,sum(ativa)::int ativas,
  sum(ganhou)::int ganhas,sum(perdeu)::int canceladas,
  case when count(*)>0 then round((sum(ganhou)::numeric/count(*))*100,1) else 0 end taxa_conversao,
  coalesce(sum(case when ganhou=1 then valor_solicitado end),0) volume_ganho,
  coalesce(sum(valor_solicitado),0) volume_total,count(distinct partner_id)::int parceiros_ativos
from base where public.app_is_admin();

create or replace view public.v_admin_top_partners as
select p.partner_id,u.nome_completo partner_nome,count(*)::int total,
  count(*) filter(where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
  coalesce(sum(p.valor_solicitado),0) volume
from public.propostas p join public.partners pa on pa.id=p.partner_id join public.usuarios u on u.id=pa.usuario_id
where public.app_is_admin() and p.status <> 'standby'
group by p.partner_id,u.nome_completo order by volume desc limit 20;
