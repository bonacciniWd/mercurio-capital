-- FASE 54 — alertas diarios por tempo na etapa do Kanban.
-- Read-only: valida contratos, grants, chave de idempotencia e cron.
do $$
declare
  v_job_count integer;
begin
  if to_regprocedure('public.admin_kanban_etapa_inicio(uuid[])') is null
     or to_regprocedure('public.admin_kanban_etapa_alertas_preview(timestamp with time zone)') is null
     or to_regprocedure('public.kanban_etapa_alertas_gerar_diarios()') is null then
    raise exception 'FASE 54 FAIL: funcao necessaria ausente';
  end if;

  if has_function_privilege('anon', 'public.admin_kanban_etapa_inicio(uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_kanban_etapa_alertas_preview(timestamp with time zone)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.kanban_etapa_alertas_gerar_diarios()', 'EXECUTE') then
    raise exception 'FASE 54 FAIL: grants fora do escopo';
  end if;

  if not has_function_privilege('authenticated', 'public.admin_kanban_etapa_inicio(uuid[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_kanban_etapa_alertas_preview(timestamp with time zone)', 'EXECUTE') then
    raise exception 'FASE 54 FAIL: RPC administrativa indisponivel para authenticated';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'notificacoes_proposta_etapa_alerta_unico'
  ) then
    raise exception 'FASE 54 FAIL: indice idempotente ausente';
  end if;

  select count(*) into v_job_count
    from cron.job where jobname = 'kanban-etapa-alertas-diarios'
      and schedule = '0 12 * * *';
  if v_job_count <> 1 then
    raise exception 'FASE 54 FAIL: cron diario ausente ou duplicado';
  end if;
end;
$$;

select 'FASE 54 SMOKE: OK' as resultado;
