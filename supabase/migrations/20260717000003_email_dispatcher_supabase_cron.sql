-- =============================================
-- Migra email-dispatcher do GitHub Actions para Supabase Cron
-- =============================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Idempotência: remove qualquer job anterior com o mesmo nome antes de recriar.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
      from cron.job
     where jobname = 'email-dispatcher-every-5-minutes'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$$;

select cron.schedule(
  'email-dispatcher-every-5-minutes',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/email-dispatcher?limit=20',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cron$
);
