-- FASE 53 — reconciliação do Dashboard de fundos
-- Read-only: valida RPCs, escopo de execução e fechamento de operações/valores.
do $$
declare
  v_eligible_count bigint;
  v_winner_count bigint;
  v_unassigned_count bigint;
  v_requested numeric;
  v_winner_requested numeric;
  v_unassigned_requested numeric;
begin
  if to_regprocedure('public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid)') is null
     or to_regprocedure('public.admin_dashboard_analytics(date,date,uuid,uuid,uuid)') is null then
    raise exception 'FASE 53 FAIL: RPCs de analytics ausentes';
  end if;
  if to_regprocedure('public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer)') is null then
    raise exception 'FASE 53 FAIL: RPC de detalhes paginados ausente';
  end if;
  if to_regprocedure('public.admin_proposta_fundos_vencedores(uuid[])') is null then
    raise exception 'FASE 53 FAIL: projeção canônica do vencedor ausente';
  end if;
  if has_function_privilege('anon', 'public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_proposta_fundos_vencedores(uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_dashboard_analytics(date,date,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'FASE 53 FAIL: RPC de reconciliação exposta a anon';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_proposta_fundos_vencedores(uuid[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_dashboard_analytics(date,date,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'FASE 53 FAIL: função indisponível para usuário autenticado';
  end if;

  with eligible as (
    select id, valor_solicitado from public.propostas where status <> 'standby'
  ), winners as (
    select distinct on (pf.proposta_id) pf.proposta_id,pf.fundo_id
    from public.proposta_fundos pf
    join eligible p on p.id=pf.proposta_id
    where pf.aprovado_em is not null
    order by pf.proposta_id,pf.aprovado_em,pf.fundo_id
  )
  select
    (select count(*) from eligible),
    (select count(*) from winners),
    (select count(*) from eligible p where not exists(select 1 from winners w where w.proposta_id=p.id)),
    (select coalesce(sum(valor_solicitado),0) from eligible),
    (select coalesce(sum(p.valor_solicitado),0) from eligible p join winners w on w.proposta_id=p.id),
    (select coalesce(sum(p.valor_solicitado),0) from eligible p where not exists(select 1 from winners w where w.proposta_id=p.id))
  into v_eligible_count,v_winner_count,v_unassigned_count,v_requested,v_winner_requested,v_unassigned_requested;

  if v_winner_count+v_unassigned_count <> v_eligible_count then
    raise exception 'FASE 53 FAIL: contagem global de operações não fecha';
  end if;
  if round(v_winner_requested+v_unassigned_requested,2) <> round(v_requested,2) then
    raise exception 'FASE 53 FAIL: valores solicitados não fecham';
  end if;
end;
$$;

select 'FASE 53 SMOKE: OK' as resultado;
