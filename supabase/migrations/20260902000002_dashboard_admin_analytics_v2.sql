-- Dashboard admin v2: resumo global, metricas de periodo, serie temporal e
-- separacao explicita entre volume solicitado/ganho e valor liberado.
create or replace function public.admin_dashboard_analytics(
  p_inicio date,p_fim date,p_fundo uuid default null,p_partner uuid default null,p_equipe uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb; v_granularidade text;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim-p_inicio>3660 then raise exception 'filtro_invalido'; end if;
  v_granularidade := case when p_fim-p_inicio<=45 then 'day' when p_fim-p_inicio<=180 then 'week' else 'month' end;

  with propostas_dimensionadas as (
    select p.* from public.propostas p
    where (p_partner is null or p.partner_id=p_partner)
      and (p_equipe is null or p.equipe_id=p_equipe)
      and (p_fundo is null or exists(select 1 from public.proposta_fundos pf where pf.proposta_id=p.id and pf.fundo_id=p_fundo))
  ), propostas_periodo as (
    select p.* from propostas_dimensionadas p
    where p.created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and p.created_at < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
  ), liberacoes_periodo as (
    select l.*,p.partner_id from public.liberacoes_recurso l
    join propostas_dimensionadas p on p.id=l.proposta_id
    where l.data_liberacao between p_inicio and p_fim
  ), serie as (
    select date_trunc(v_granularidade,p.created_at at time zone 'America/Sao_Paulo')::date periodo,
      count(*)::int propostas,
      count(*) filter(where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      coalesce(sum(p.valor_solicitado),0) volume_solicitado,
      coalesce(sum(p.valor_solicitado) filter(where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho
    from propostas_periodo p group by 1 order by 1
  ), top_operacao as (
    select p.partner_id,u.nome_completo partner_nome,count(*)::int total,
      count(*) filter(where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      coalesce(sum(p.valor_solicitado) filter(where p.status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho
    from propostas_periodo p join public.partners pa on pa.id=p.partner_id join public.usuarios u on u.id=pa.usuario_id
    group by p.partner_id,u.nome_completo
  ), liberado_partner as (
    select partner_id,coalesce(sum(valor_liberado),0) volume_liberado from liberacoes_periodo group by partner_id
  ), top_parceiros as (
    select t.*,coalesce(l.volume_liberado,0) volume_liberado
    from top_operacao t left join liberado_partner l using(partner_id)
    order by t.volume_ganho desc,t.total desc limit 10
  ), resumo_global as (
    select count(*)::int total_propostas,
      count(*) filter(where status not in ('cancelado','completo'))::int ativas,
      count(*) filter(where status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      count(*) filter(where status='cancelado')::int canceladas,
      count(distinct partner_id)::int parceiros_ativos
    from public.propostas
  )
  select jsonb_build_object(
    'total_propostas',count(*)::int,
    'ativas',count(*) filter(where status not in ('cancelado','completo'))::int,
    'ganhas',count(*) filter(where status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int,
    'canceladas',count(*) filter(where status='cancelado')::int,
    'taxa_conversao',case when count(*)=0 then 0 else round(100.0*count(*) filter(where status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo'))/count(*),1) end,
    'volume_solicitado',coalesce(sum(valor_solicitado),0),
    'volume_ganho',coalesce(sum(valor_solicitado) filter(where status in ('contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0),
    'volume_operacional',coalesce((select sum(valor_liberado) from liberacoes_periodo),0),
    'parceiros_ativos',count(distinct partner_id)::int,
    'granularidade',v_granularidade,
    'resumo_global',(select to_jsonb(g) from resumo_global g),
    'serie',coalesce((select jsonb_agg(to_jsonb(s)) from serie s),'[]'::jsonb),
    'top_parceiros',coalesce((select jsonb_agg(to_jsonb(t)) from top_parceiros t),'[]'::jsonb)
  ) into v_result from propostas_periodo;
  return v_result;
end; $$;

revoke all on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) from public;
grant execute on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) to authenticated;
