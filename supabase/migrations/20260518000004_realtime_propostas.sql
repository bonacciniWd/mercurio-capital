-- =============================================
-- MIGRATION 016 — REALTIME: habilita propostas no canal supabase_realtime
-- =============================================

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'propostas'
  ) then
    execute 'alter publication supabase_realtime add table public.propostas';
  end if;
end $$;
