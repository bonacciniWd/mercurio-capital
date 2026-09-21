-- Volume liberado: primeira entrada em pagamento_comissao, por proposta, em Sao Paulo.
create or replace function public.admin_dashboard_analytics(
  p_inicio date,p_fim date,p_fundo uuid default null,p_partner uuid default null,p_equipe uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb; v_granularidade text;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim-p_inicio>3660 then raise exception 'filtro_invalido'; end if;
  v_granularidade := case when p_fim-p_inicio<=45 then 'day' when p_fim-p_inicio<=180 then 'week' else 'month' end;
  with base as (
    select p.* from public.propostas p
    where (p_partner is null or p.partner_id=p_partner) and (p_equipe is null or p.equipe_id=p_equipe)
      and (p_fundo is null or exists(select 1 from public.proposta_fundos pf where pf.proposta_id=p.id and pf.fundo_id=p_fundo))
  ), periodo as (
    select * from base where created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and created_at < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
  ), liberacoes as (
    select l.*,p.partner_id,p.status from public.liberacoes_recurso l join base p on p.id=l.proposta_id
    where l.data_liberacao between p_inicio and p_fim
  ), comissionaveis as (
    select p.id,p.partner_id,p.valor_solicitado,
      (select min(h.created_at) from public.proposta_status_historico h
       where h.proposta_id=p.id and h.status_novo='pagamento_comissao'
         and h.status_anterior is distinct from h.status_novo) entrada_comissao
    from base p where p.status in ('pagamento_comissao','completo')
  ), comissoes_periodo as (
    select * from comissionaveis
    where entrada_comissao >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and entrada_comissao < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
  ), serie as (
    select date_trunc(v_granularidade,created_at at time zone 'America/Sao_Paulo')::date periodo,count(*)::int propostas,
      count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      coalesce(sum(valor_solicitado) filter(where status <> 'standby'),0) volume_solicitado,
      coalesce(sum(valor_solicitado) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho
    from periodo group by 1 order by 1
  ), resumo as (
    select count(*)::int total_propostas,count(*) filter(where status not in ('cancelado','completo','standby'))::int ativas,
      count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      count(*) filter(where status='standby')::int standby,count(*) filter(where status='cancelado')::int canceladas,count(distinct partner_id)::int parceiros_ativos
    from public.propostas
  )
  select jsonb_build_object(
    'total_propostas',count(*)::int,'ativas',count(*) filter(where status not in ('cancelado','completo','standby'))::int,
    'ganhas',count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int,
    'standby',count(*) filter(where status='standby')::int,'canceladas',count(*) filter(where status='cancelado')::int,
    'taxa_conversao',case when count(*) filter(where status <> 'standby')=0 then 0 else round(100.0*count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))/(count(*) filter(where status <> 'standby')),1) end,
    'volume_solicitado',coalesce(sum(valor_solicitado) filter(where status <> 'standby'),0),
    'volume_ganho',coalesce(sum(valor_solicitado) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo')),0),
    'volume_liberado',coalesce((select sum(valor_solicitado) from comissoes_periodo),0),
    'liberadas_sem_data',(select count(*) from comissionaveis where entrada_comissao is null),
    'volume_liberado_sem_data',coalesce((select sum(valor_solicitado) from comissionaveis where entrada_comissao is null),0),
    'volume_operacional',coalesce((select sum(valor_liberado) from liberacoes),0),'parceiros_ativos',count(distinct partner_id)::int,
    'granularidade',v_granularidade,'resumo_global',(select to_jsonb(r) from resumo r),
    'serie',coalesce((select jsonb_agg(to_jsonb(s)) from serie s),'[]'::jsonb),
    'top_parceiros',coalesce((select jsonb_agg(to_jsonb(t)) from (
      select p.partner_id,u.nome_completo partner_nome,count(*) filter(where p.id in (select id from periodo))::int total,
        count(*) filter(where p.id in (select id from periodo) and p.status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
        coalesce(sum(p.valor_solicitado) filter(where p.id in (select id from periodo) and p.status in ('registro_af','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho,
        coalesce((select sum(c.valor_solicitado) from comissoes_periodo c where c.partner_id=p.partner_id),0) volume_liberado
      from (
        select * from periodo where status <> 'standby'
        union
        select b.* from base b join comissoes_periodo c on c.id=b.id
      ) p join public.partners pa on pa.id=p.partner_id join public.usuarios u on u.id=pa.usuario_id
      group by p.partner_id,u.nome_completo order by volume_ganho desc,total desc limit 10
    ) t),'[]'::jsonb)
  ) into v_result from periodo;
  return v_result;
end; $$;
revoke all on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) from public;
grant execute on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) to authenticated;
