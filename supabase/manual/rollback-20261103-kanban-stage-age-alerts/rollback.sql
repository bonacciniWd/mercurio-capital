-- Execute only to revert migration 20261103000001_kanban_stage_age_alerts.sql.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'kanban-etapa-alertas-diarios'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$$;

delete from public.notificacoes
 where metadata ->> 'tipo' = 'proposta_etapa_atrasada';

drop function if exists public.kanban_etapa_alertas_gerar_diarios();
drop function if exists public.admin_kanban_etapa_alertas_preview(timestamptz);
drop function if exists public.admin_kanban_etapa_inicio(uuid[]);
drop index if exists public.notificacoes_proposta_etapa_alerta_unico;
