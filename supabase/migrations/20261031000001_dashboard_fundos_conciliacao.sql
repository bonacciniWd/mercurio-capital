-- Reconcile winner counts and expose bounded proposal details.
create or replace function public.admin_dashboard_fundos_analytics(
  p_inicio date, p_fim date, p_fundo uuid default null,
  p_partner uuid default null, p_equipe uuid default null
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim-p_inicio>3660 then raise exception 'filtro_invalido'; end if;
  with base as (
    select p.* from public.propostas p
    where (p_partner is null or p.partner_id=p_partner)
      and (p_equipe is null or p.equipe_id=p_equipe)
      and (p_fundo is null or exists(select 1 from public.proposta_fundos x where x.proposta_id=p.id and x.fundo_id=p_fundo))
      and p.created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and p.created_at < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
  ), winners as (
    select distinct on(pf.proposta_id) pf.proposta_id,pf.fundo_id,pf.aprovado_em
    from public.proposta_fundos pf join base p on p.id=pf.proposta_id
    where pf.aprovado_em is not null order by pf.proposta_id,pf.aprovado_em,pf.fundo_id
  ), eligible as (select * from base where status<>'standby'), funds as (
    select pf.fundo_id,f.nome,f.cor_hex,
      count(distinct pf.proposta_id)::int operacoes_representadas,
      count(distinct pf.proposta_id) filter(where p.status <> 'standby' and w.fundo_id=pf.fundo_id)::int operacoes_unicas,
      coalesce(sum(p.valor_solicitado) filter(where p.status <> 'standby' and w.fundo_id=pf.fundo_id),0) volume_solicitado,
      coalesce(sum(p.valor_solicitado) filter(where w.fundo_id=pf.fundo_id and p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho,
      count(distinct pf.proposta_id) filter(where w.fundo_id=pf.fundo_id and p.status='cancelado')::int operacoes_canceladas,
      coalesce(sum(p.valor_solicitado) filter(where w.fundo_id=pf.fundo_id and p.status='cancelado'),0) volume_cancelado
    from public.proposta_fundos pf join base p on p.id=pf.proposta_id
      join public.fundos f on f.id=pf.fundo_id left join winners w on w.proposta_id=p.id
    where p_fundo is null or pf.fundo_id=p_fundo group by pf.fundo_id,f.nome,f.cor_hex
  ), no_winner as (
    select count(*)::int operations,coalesce(sum(p.valor_solicitado),0) requested,
      count(*) filter(where p.status='cancelado')::int cancelled,
      coalesce(sum(p.valor_solicitado) filter(where p.status='cancelado'),0) cancelled_volume
    from eligible p where not exists(select 1 from winners w where w.proposta_id=p.id)
  ), other_winner as (
    select count(*)::int operations,coalesce(sum(p.valor_solicitado),0) requested
    from eligible p join winners w on w.proposta_id=p.id where p_fundo is not null and w.fundo_id<>p_fundo
  )
  select jsonb_build_object(
    'fundos',coalesce((select jsonb_agg(to_jsonb(f) order by f.nome) from funds f),'[]'::jsonb),
    'operacoes_sem_fundo_vencedor',(select operations from no_winner),
    'volume_solicitado_sem_fundo_vencedor',(select requested from no_winner),
    'operacoes_canceladas_sem_fundo_vencedor',(select cancelled from no_winner),
    'volume_cancelado_sem_fundo_vencedor',(select cancelled_volume from no_winner),
    'operacoes_vencedor_em_outro_fundo',(select operations from other_winner),
    'volume_vencedor_em_outro_fundo',(select requested from other_winner),
    'operacoes_unicas',(select count(*)::int from eligible),
    'operacoes_canceladas',(select count(*)::int from eligible where status='cancelado'),
    'operacoes_ativas',(select count(*)::int from eligible where status<>'cancelado'),
    'operacoes_standby',(select count(*)::int from base where status='standby'),
    'volume_solicitado_unico',(select coalesce(sum(valor_solicitado),0) from eligible),
    'volume_cancelado',(select coalesce(sum(valor_solicitado),0) from eligible where status='cancelado'),
    'volume_ganho_unico',(select coalesce(sum(valor_solicitado),0) from eligible where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid) from public;
revoke all on function public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid) from anon;
grant execute on function public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid) to authenticated;

create or replace function public.admin_dashboard_fundo_propostas(
  p_inicio date,p_fim date,p_fundo uuid,p_partner uuid default null,p_equipe uuid default null,
  p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb; v_limit int:=least(greatest(coalesce(p_limit,50),1),50); v_offset int:=greatest(coalesce(p_offset,0),0);
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>3660 or p_fundo is null then raise exception 'filtro_invalido'; end if;
  with winners as (
    select distinct on(pf.proposta_id) pf.proposta_id,pf.fundo_id,pf.aprovado_em
    from public.proposta_fundos pf where pf.aprovado_em is not null
    order by pf.proposta_id,pf.aprovado_em,pf.fundo_id
  ), selected as (
    select p.id,p.protocolo,p.produto::text produto,p.status::text status,p.valor_solicitado,
      p.prazo_meses,p.taxa_juros_mensal,p.created_at,c.nome_completo cliente_nome,
      c.pessoa_tipo::text pessoa_tipo,case when c.pessoa_tipo='PJ' then c.cnpj else c.cpf end documento,
      pf.status_fundo::text status_vinculo,(w.fundo_id=p_fundo) fundo_vencedor,w.aprovado_em primeira_aprovacao_em
    from public.propostas p join public.proposta_fundos pf on pf.proposta_id=p.id and pf.fundo_id=p_fundo
      left join public.clientes c on c.id=p.cliente_id left join winners w on w.proposta_id=p.id
    where p.status<>'standby'
      and p.created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and p.created_at < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
      and (p_partner is null or p.partner_id=p_partner) and (p_equipe is null or p.equipe_id=p_equipe)
  ), page_rows as (select * from selected order by fundo_vencedor desc,created_at desc,id limit v_limit offset v_offset)
  select jsonb_build_object('total',(select count(*)::int from selected),'limit',v_limit,'offset',v_offset,
    'items',coalesce((select jsonb_agg(to_jsonb(r) order by r.fundo_vencedor desc,r.created_at desc,r.id) from page_rows r),'[]'::jsonb)) into v_result;
  return v_result;
end; $$;
revoke all on function public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer) from public;
revoke all on function public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer) from anon;
grant execute on function public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer) to authenticated;

create or replace function public.admin_proposta_fundos_vencedores(p_proposta_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if coalesce(cardinality(p_proposta_ids),0)>500 then raise exception 'limite_excedido'; end if;
  with winners as (
    select distinct on(pf.proposta_id) pf.proposta_id,pf.fundo_id,pf.aprovado_em
    from public.proposta_fundos pf
    where pf.proposta_id=any(coalesce(p_proposta_ids,'{}'::uuid[])) and pf.aprovado_em is not null
    order by pf.proposta_id,pf.aprovado_em,pf.fundo_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('proposta_id',w.proposta_id,'fundo_id',w.fundo_id,
      'nome',f.nome,'cor_hex',f.cor_hex,'aprovado_em',w.aprovado_em) order by w.proposta_id),'[]'::jsonb)
    into v_result
    from winners w join public.fundos f on f.id=w.fundo_id;
  return v_result;
end; $$;
revoke all on function public.admin_proposta_fundos_vencedores(uuid[]) from public;
revoke all on function public.admin_proposta_fundos_vencedores(uuid[]) from anon;
grant execute on function public.admin_proposta_fundos_vencedores(uuid[]) to authenticated;

-- Align legacy view metrics with the canonical Registro de AF stage.
create or replace view public.v_partner_dashboard_kpis as
with base as (
  select p.partner_id,p.equipe_id,p.id,p.status,p.valor_solicitado,p.created_at,
    case when p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo') then 1 else 0 end ganhou,
    case when p.status='cancelado' then 1 else 0 end perdeu,
    case when p.status in ('contrato_registrado','registro_af','completo','cancelado','standby') then 0 else 1 end ativa,
    case when p.created_at>=date_trunc('month',now()) then 1 else 0 end no_mes,
    case when p.created_at>=now()-interval '30 days' then 1 else 0 end nos_30d
  from public.propostas p where p.status<>'standby'
)
select partner_id,count(*)::int total_propostas,sum(no_mes)::int propostas_mes,
  sum(nos_30d)::int propostas_30d,sum(ativa)::int ativas,sum(ganhou)::int ganhas,
  sum(perdeu)::int canceladas,
  case when count(*)>0 then round((sum(ganhou)::numeric/count(*))*100,1) else 0 end taxa_conversao,
  coalesce(sum(case when ganhou=1 then valor_solicitado end),0) volume_ganho,
  coalesce(avg(case when ganhou=1 then valor_solicitado end),0) ticket_medio_ganho,
  coalesce(sum(valor_solicitado),0) volume_total
from base where public.app_is_admin() or partner_id=public.app_partner_id() group by partner_id;

create or replace view public.v_partner_propostas_por_mes as
select p.partner_id,date_trunc('month',p.created_at) as mes,count(*)::int quantidade,
  count(*) filter(where p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
  coalesce(sum(p.valor_solicitado),0) volume
from public.propostas p where p.status<>'standby' and p.created_at>=now()-interval '12 months'
  and (public.app_is_admin() or p.partner_id=public.app_partner_id())
group by p.partner_id,date_trunc('month',p.created_at);

create or replace view public.v_admin_dashboard_kpis as
with base as (
  select p.id,p.status,p.partner_id,p.valor_solicitado,p.created_at,
    case when p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo') then 1 else 0 end ganhou,
    case when p.status='cancelado' then 1 else 0 end perdeu,
    case when p.status in ('contrato_registrado','registro_af','completo','cancelado','standby') then 0 else 1 end ativa,
    case when p.created_at>=date_trunc('month',now()) then 1 else 0 end no_mes
  from public.propostas p where p.status<>'standby'
)
select count(*)::int total_propostas,sum(no_mes)::int propostas_mes,sum(ativa)::int ativas,
  sum(ganhou)::int ganhas,sum(perdeu)::int canceladas,
  case when count(*)>0 then round((sum(ganhou)::numeric/count(*))*100,1) else 0 end taxa_conversao,
  coalesce(sum(case when ganhou=1 then valor_solicitado end),0) volume_ganho,
  coalesce(sum(valor_solicitado),0) volume_total,count(distinct partner_id)::int parceiros_ativos
from base where public.app_is_admin();

create or replace view public.v_admin_top_partners as
select p.partner_id,u.nome_completo partner_nome,count(*)::int total,
  count(*) filter(where p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
  coalesce(sum(p.valor_solicitado),0) volume
from public.propostas p join public.partners pa on pa.id=p.partner_id join public.usuarios u on u.id=pa.usuario_id
where public.app_is_admin() and p.status<>'standby'
group by p.partner_id,u.nome_completo order by volume desc limit 20;
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
      count(*) filter(where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      coalesce(sum(valor_solicitado) filter(where status <> 'standby'),0) volume_solicitado,
      coalesce(sum(valor_solicitado) filter(where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho
    from periodo group by 1 order by 1
  ), resumo as (
    select count(*)::int total_propostas,count(*) filter(where status not in ('cancelado','completo','standby'))::int ativas,
      count(*) filter(where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      count(*) filter(where status='standby')::int standby,count(*) filter(where status='cancelado')::int canceladas,count(distinct partner_id)::int parceiros_ativos
    from public.propostas
  )
  select jsonb_build_object(
    'total_propostas',count(*)::int,'ativas',count(*) filter(where status not in ('cancelado','completo','standby'))::int,
    'ganhas',count(*) filter(where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int,
    'standby',count(*) filter(where status='standby')::int,'canceladas',count(*) filter(where status='cancelado')::int,
    'taxa_conversao',case when count(*) filter(where status <> 'standby')=0 then 0 else round(100.0*count(*) filter(where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))/(count(*) filter(where status <> 'standby')),1) end,
    'volume_solicitado',coalesce(sum(valor_solicitado) filter(where status <> 'standby'),0),
    'volume_ganho',coalesce(sum(valor_solicitado) filter(where status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0),
    'volume_liberado',coalesce((select sum(valor_solicitado) from comissoes_periodo),0),
    'liberadas_sem_data',(select count(*) from comissionaveis where entrada_comissao is null),
    'volume_liberado_sem_data',coalesce((select sum(valor_solicitado) from comissionaveis where entrada_comissao is null),0),
    'volume_operacional',coalesce((select sum(valor_liberado) from liberacoes),0),'parceiros_ativos',count(distinct partner_id)::int,
    'granularidade',v_granularidade,'resumo_global',(select to_jsonb(r) from resumo r),
    'serie',coalesce((select jsonb_agg(to_jsonb(s)) from serie s),'[]'::jsonb),
    'top_parceiros',coalesce((select jsonb_agg(to_jsonb(t)) from (
      select p.partner_id,u.nome_completo partner_nome,count(*) filter(where p.id in (select id from periodo))::int total,
        count(*) filter(where p.id in (select id from periodo) and p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
        coalesce(sum(p.valor_solicitado) filter(where p.id in (select id from periodo) and p.status in ('registro_af','contrato_registrado','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho,
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
revoke all on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) from anon;
grant execute on function public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) to authenticated;
