-- FASE 56 — contrato de segurança da automação WhatsApp.
-- Executar depois das migrations 20261106000001 e 20261106000002.
-- Somente leitura: valida esquema, retenção, grants e jobs.
do $$
declare
  v_jobs integer;
begin
  if to_regclass('public.whatsapp_template_versoes') is null
     or to_regclass('public.whatsapp_fluxo_versoes') is null
     or to_regclass('public.whatsapp_eventos') is null
     or to_regclass('public.whatsapp_atendimentos') is null
     or to_regclass('public.whatsapp_consentimentos') is null then
    raise exception 'FASE 56 FAIL: entidades da automacao ausentes';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.whatsapp_atendimentos'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.whatsapp_eventos'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.whatsapp_consentimentos'::regclass) then
    raise exception 'FASE 56 FAIL: RLS desabilitada';
  end if;

  if has_table_privilege('anon','public.whatsapp_atendimentos','SELECT')
     or has_table_privilege('authenticated','public.whatsapp_eventos','SELECT') = false
     or has_table_privilege('authenticated','public.whatsapp_consentimentos','SELECT') = false
     or has_function_privilege('anon','public.whatsapp_eventos_pull(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.whatsapp_eventos_pull(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.whatsapp_evento_concluir(uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE') then
    raise exception 'FASE 56 FAIL: grants fora do escopo';
  end if;

  if not has_function_privilege('service_role','public.whatsapp_eventos_pull(integer)','EXECUTE')
     or not has_function_privilege('service_role','public.whatsapp_evento_concluir(uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.whatsapp_outbox_destinatario_valido(uuid)','EXECUTE') then
    raise exception 'FASE 56 FAIL: grants do worker ausentes';
  end if;

  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='whatsapp_atendimento_aberto')
     or not exists(select 1 from pg_indexes where schemaname='public' and indexname='whatsapp_saida_idempotencia')
     or not exists(select 1 from pg_indexes where schemaname='public' and indexname='whatsapp_evento_execucao') then
    raise exception 'FASE 56 FAIL: indices de unicidade ausentes';
  end if;

  select count(*) into v_jobs from cron.job
   where jobname in ('whatsapp-worker-dispatch','whatsapp-conteudo-expurgo-diario');
  if v_jobs <> 2 then raise exception 'FASE 56 FAIL: jobs ausentes ou duplicados'; end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_mensagens' and column_name='destinatario_papel')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_mensagens' and column_name='solicitado_por') then
    raise exception 'FASE 56 FAIL: revalidacao de destinatario/operador incompleta';
  end if;
end;
$$;

select 'FASE 56 SMOKE: OK' as resultado;
