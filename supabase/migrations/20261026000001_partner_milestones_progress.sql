-- Aggregate milestone progress for the authenticated partner without exposing
-- proposal or client records to the browser.
create or replace function public.partner_milestones_progress()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'propostas_elegiveis', count(*)::bigint,
    'volume_solicitado', coalesce(sum(p.valor_solicitado), 0)::numeric
  )
  from public.propostas p
  where p.partner_id = public.app_partner_id()
    and p.status in (
      'registro_af',
      'recurso_liberado',
      'pagamento_comissao',
      'completo'
    );
$$;

revoke all on function public.partner_milestones_progress() from public, anon;
grant execute on function public.partner_milestones_progress() to authenticated;
