-- FASE 55 — contrato de segurança e retenção do WhatsApp inbound.
-- Read-only: valida tabela, RLS, grants, deduplicação e job de expurgo.
do $$
declare
  v_job_count integer;
  v_expiry_default text;
begin
  if to_regclass('public.whatsapp_mensagens_recebidas') is null
     or to_regprocedure('public.whatsapp_mensagens_recebidas_expurgar_vencidas()') is null then
    raise exception 'FASE 55 FAIL: tabela ou rotina de expurgo ausente';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'whatsapp_mensagens_recebidas_provider_message_id_key'
  ) then
    raise exception 'FASE 55 FAIL: chave única idempotente ausente';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.whatsapp_mensagens_recebidas'::regclass) then
    raise exception 'FASE 55 FAIL: RLS desabilitada';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'whatsapp_mensagens_recebidas'
       and policyname = 'whatsapp_mensagens_recebidas_admin_read'
       and cmd = 'SELECT'
  ) then
    raise exception 'FASE 55 FAIL: policy de leitura administrativa ausente';
  end if;

  if has_table_privilege('anon', 'public.whatsapp_mensagens_recebidas', 'SELECT')
     or has_table_privilege('authenticated', 'public.whatsapp_mensagens_recebidas', 'INSERT')
     or has_function_privilege('authenticated', 'public.whatsapp_mensagens_recebidas_expurgar_vencidas()', 'EXECUTE') then
    raise exception 'FASE 55 FAIL: grants excedem o escopo';
  end if;
  if not has_table_privilege('authenticated', 'public.whatsapp_mensagens_recebidas', 'SELECT')
     or not has_table_privilege('service_role', 'public.whatsapp_mensagens_recebidas', 'INSERT') then
    raise exception 'FASE 55 FAIL: grants necessários ausentes';
  end if;

  select pg_get_expr(d.adbin, d.adrelid)
    into v_expiry_default
    from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'public.whatsapp_mensagens_recebidas'::regclass
     and a.attname = 'expires_at';
  if v_expiry_default is null or v_expiry_default not ilike '%60 days%' then
    raise exception 'FASE 55 FAIL: retenção padrão de 60 dias ausente';
  end if;

  select count(*) into v_job_count
    from cron.job
   where jobname = 'whatsapp-inbound-expurgo-diario'
     and schedule = '15 3 * * *';
  if v_job_count <> 1 then
    raise exception 'FASE 55 FAIL: expurgo diário ausente ou duplicado';
  end if;
end;
$$;

select 'FASE 55 SMOKE: OK' as resultado;
