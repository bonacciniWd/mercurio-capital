-- Fase 44 — captura de solicitações CPC.
-- Read-only: executar após a migration em ambiente de teste.
-- Não cria leads nem habilita a captura.
do $$
declare
  v_enabled jsonb;
begin
  if to_regclass('public.cpc_leads_publicos') is null then
    raise exception 'Tabela cpc_leads_publicos ausente';
  end if;
  if to_regclass('public.v_admin_leads_publicos') is null then
    raise exception 'View v_admin_leads_publicos ausente';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.cpc_leads_publicos'::regclass) then
    raise exception 'RLS nao habilitada em cpc_leads_publicos';
  end if;
  if has_table_privilege('anon', 'public.cpc_leads_publicos', 'select')
    or has_table_privilege('anon', 'public.cpc_leads_publicos', 'insert')
    or has_table_privilege('authenticated', 'public.cpc_leads_publicos', 'insert') then
    raise exception 'Acesso direto de anon/authenticated em cpc_leads_publicos';
  end if;
  if not has_table_privilege('authenticated', 'public.v_admin_leads_publicos', 'select') then
    raise exception 'Leitura autenticada da view administrativa ausente';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'cpc_leads_publicos'
       and policyname = 'cpc_leads_publicos_admin_read'
       and cmd = 'SELECT'
  ) then
    raise exception 'Policy administrativa de leitura CPC ausente';
  end if;
  if not has_table_privilege('service_role', 'public.cpc_leads_publicos', 'insert') then
    raise exception 'Privilégio de gravação da Edge Function ausente';
  end if;

  select valor into v_enabled from public.configuracoes_sistema where chave='cpc_captura_publica_ativa';
  if v_enabled is distinct from 'false'::jsonb then
    raise exception 'A captura CPC deve permanecer desativada até a política ser publicada';
  end if;

  raise notice 'fase-44 leads CPC: tabela, view, RLS, privilégios e captura desativada OK';
end $$;
