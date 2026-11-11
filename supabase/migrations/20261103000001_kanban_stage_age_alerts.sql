-- Monitoramento de propostas paradas na etapa atual.
-- Limite: mais de 10 dias completos. Notificacoes diarias, por admin/proposta/etapa.

create index if not exists notificacoes_proposta_etapa_alerta_unico
  on public.notificacoes (usuario_id, (metadata ->> 'alert_key'))
  where metadata ->> 'tipo' = 'proposta_etapa_atrasada';

create or replace function public.admin_kanban_etapa_inicio(p_proposta_ids uuid[])
returns table (proposta_id uuid, status text, entrou_em timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id, p.status::text,
         coalesce(h.entrou_em, p.created_at) as entrou_em
    from public.propostas p
    left join lateral (
      select max(psh.created_at) as entrou_em
        from public.proposta_status_historico psh
       where psh.proposta_id = p.id
         and psh.status_novo = p.status
    ) h on true
   where public.app_is_admin_operacional()
     and p.id = any(coalesce(p_proposta_ids, array[]::uuid[]));
$$;

revoke all on function public.admin_kanban_etapa_inicio(uuid[]) from public, anon;
grant execute on function public.admin_kanban_etapa_inicio(uuid[]) to authenticated;

comment on function public.admin_kanban_etapa_inicio(uuid[]) is
  'Retorna o instante de entrada na etapa atual somente para Admin full/limitado e para os IDs solicitados.';

create or replace function public.admin_kanban_etapa_alertas_preview(
  p_referencia timestamptz default statement_timestamp()
)
returns table (
  proposta_id uuid,
  protocolo text,
  status text,
  entrou_em timestamptz,
  dias_parado integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with stage_age as (
    select p.id, p.protocolo, p.status::text as status,
           coalesce(h.entrou_em, p.created_at) as entrou_em
      from public.propostas p
      left join lateral (
        select max(psh.created_at) as entrou_em
          from public.proposta_status_historico psh
         where psh.proposta_id = p.id
           and psh.status_novo = p.status
      ) h on true
     where p.status::text not in ('simulacao', 'standby', 'cancelado', 'completo')
  )
  select s.id, s.protocolo, s.status, s.entrou_em,
         floor(extract(epoch from (p_referencia - s.entrou_em)) / 86400)::integer
    from stage_age s
   where public.app_is_admin_operacional()
     and p_referencia - s.entrou_em > interval '10 days'
   order by s.entrou_em asc, s.protocolo asc;
$$;

revoke all on function public.admin_kanban_etapa_alertas_preview(timestamptz) from public, anon;
grant execute on function public.admin_kanban_etapa_alertas_preview(timestamptz) to authenticated;

comment on function public.admin_kanban_etapa_alertas_preview(timestamptz) is
  'Dry-run read-only dos alertas vencidos; restrito a Admin full/limitado.';

create or replace function public.kanban_etapa_alertas_gerar_diarios()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_dia_local date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_inserted integer := 0;
begin
  with stage_age as (
    select p.id, p.protocolo, p.status::text as status,
           coalesce(h.entrou_em, p.created_at) as entrou_em
      from public.propostas p
      left join lateral (
        select max(psh.created_at) as entrou_em
          from public.proposta_status_historico psh
         where psh.proposta_id = p.id
           and psh.status_novo = p.status
      ) h on true
     where p.status::text not in ('simulacao', 'standby', 'cancelado', 'completo')
  ), overdue as (
    select s.*,
           floor(extract(epoch from (v_now - s.entrou_em)) / 86400)::integer as days_stuck
      from stage_age s
     where v_now - s.entrou_em > interval '10 days'
  ), recipients as (
    select u.id as usuario_id
      from public.usuarios u
      join auth.users au on au.id = u.id
     where u.ativo
       and u.role::text = 'admin'
       and coalesce(nullif(au.raw_app_meta_data ->> 'admin_nivel', ''), 'full')
           in ('full', 'limitado')
  )
  insert into public.notificacoes
    (usuario_id, canal, titulo, mensagem, link, metadata)
  select r.usuario_id,
         'in_app'::public.notificacao_canal,
         'Proposta parada há ' || o.days_stuck || ' dias',
         coalesce(o.protocolo, 'Proposta') || ' está há ' || o.days_stuck ||
           ' dias na etapa ' || replace(o.status, '_', ' ') || '. Verifique o acompanhamento operacional.',
         '/admin/propostas/' || o.id::text,
         jsonb_build_object(
           'tipo', 'proposta_etapa_atrasada',
           'alert_key', concat_ws(':', 'proposta_etapa_atrasada', o.id::text, o.status,
                                  to_char(o.entrou_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
                                  v_dia_local::text),
           'proposta_id', o.id,
           'status', o.status,
           'entrou_em', o.entrou_em,
           'dias_parado', o.days_stuck,
           'data_local', v_dia_local
         )
    from overdue o
    cross join recipients r
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.kanban_etapa_alertas_gerar_diarios() from public, anon, authenticated;

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

-- Supabase Cron usa UTC: 12:00 UTC = 09:00 em Sao Paulo.
select cron.schedule(
  'kanban-etapa-alertas-diarios',
  '0 12 * * *',
  'select public.kanban_etapa_alertas_gerar_diarios();'
);
