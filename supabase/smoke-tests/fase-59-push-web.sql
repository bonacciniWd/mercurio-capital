-- FASE 59 — contrato de segurança do Push Web (Frente A, issues #10/#12/#16).
-- Executar depois das migrations 20261111000001 e 20261111000002.
-- Somente leitura: valida esquema, RLS, grants, índices, trigger e constraints.
-- Casos comportamentais (upsert, fan-out, opt-out, backoff, sweeper, limpeza) vivem
-- em fase-59-push-web-transacional.sql — transação com ROLLBACK, sem resíduo.
do $$
begin
  -- esquema
  if to_regclass('public.push_outbox') is null then
    raise exception 'FASE 59 FAIL: push_outbox ausente';
  end if;

  if not exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='push_devices'
                   and column_name in ('ativo','user_agent','created_at','updated_at')
                 group by table_name having count(*) = 4) then
    raise exception 'FASE 59 FAIL: push_devices sem colunas de ciclo de vida';
  end if;

  if not exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='usuarios' and column_name='push_opt_out') then
    raise exception 'FASE 59 FAIL: usuarios.push_opt_out ausente';
  end if;

  -- RLS
  if not (select relrowsecurity from pg_class where oid='public.push_outbox'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.push_devices'::regclass) then
    raise exception 'FASE 59 FAIL: RLS desabilitada';
  end if;

  -- fila sem policies para authenticated/anon (RLS nega por ausência); admin só observa
  if (select count(*) from pg_policies where schemaname='public' and tablename='push_outbox') <> 1
     or not exists(select 1 from pg_policies
                    where schemaname='public' and tablename='push_outbox'
                      and policyname='admin_le_push_outbox' and cmd='SELECT') then
    raise exception 'FASE 59 FAIL: policies da push_outbox fora do esperado';
  end if;

  -- grants de tabela no padrão estrito: fila fora do alcance de anon; authenticated só lê (policy admin)
  if has_table_privilege('anon','public.push_outbox','SELECT')
     or has_table_privilege('authenticated','public.push_outbox','INSERT')
     or has_table_privilege('authenticated','public.push_outbox','UPDATE')
     or has_table_privilege('authenticated','public.push_outbox','DELETE')
     or not has_table_privilege('authenticated','public.push_outbox','SELECT')
     or not has_table_privilege('service_role','public.push_outbox','INSERT') then
    raise exception 'FASE 59 FAIL: grants de tabela da push_outbox fora do escopo';
  end if;

  -- RPCs authenticated: dispositivo e preferência
  if not has_function_privilege('authenticated','public.push_subscription_upsert(text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.push_subscription_revogar(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.push_preferencia_set(boolean)','EXECUTE') then
    raise exception 'FASE 59 FAIL: RPCs de dispositivo indisponíveis para authenticated';
  end if;
  if has_function_privilege('anon','public.push_subscription_upsert(text,text)','EXECUTE')
     or has_function_privilege('anon','public.push_subscription_revogar(text)','EXECUTE')
     or has_function_privilege('anon','public.push_preferencia_set(boolean)','EXECUTE') then
    raise exception 'FASE 59 FAIL: RPCs de dispositivo expostas a anon';
  end if;

  -- RPCs do dispatcher: somente service_role
  if not has_function_privilege('service_role','public.push_outbox_pull(integer)','EXECUTE')
     or not has_function_privilege('service_role','public.push_outbox_marcar(uuid,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.push_device_desativar(text)','EXECUTE') then
    raise exception 'FASE 59 FAIL: RPCs do dispatcher ausentes para service_role';
  end if;
  if has_function_privilege('authenticated','public.push_outbox_pull(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.push_outbox_marcar(uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.push_device_desativar(text)','EXECUTE')
     or has_function_privilege('anon','public.push_outbox_pull(integer)','EXECUTE') then
    raise exception 'FASE 59 FAIL: RPCs do dispatcher expostas';
  end if;

  -- função de trigger não é chamável por roles de API
  if has_function_privilege('authenticated','public.enqueue_push_da_notificacao()','EXECUTE')
     or has_function_privilege('anon','public.enqueue_push_da_notificacao()','EXECUTE') then
    raise exception 'FASE 59 FAIL: enqueue_push_da_notificacao exposta';
  end if;

  -- índices e unicidade
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='push_devices_usuario_ativos_idx')
     or not exists(select 1 from pg_indexes where schemaname='public' and indexname='push_outbox_fila_idx')
     or not exists(select 1 from pg_indexes where schemaname='public' and indexname='push_outbox_notificacao_id_key') then
    raise exception 'FASE 59 FAIL: índices/unicidade ausentes';
  end if;

  -- trigger de fan-out registrado em notificacoes
  if not exists(select 1 from pg_trigger t
                 join pg_class c on c.oid = t.tgrelid
                where c.relname='notificacoes' and t.tgname='trg_notificacao_enqueue_push' and not t.tgisinternal) then
    raise exception 'FASE 59 FAIL: trigger de fan-out ausente';
  end if;

  -- constraint de status cobre os estados do dispatcher
  if not exists(select 1 from pg_constraint
                 where conrelid='public.push_outbox'::regclass and conname='push_outbox_status_check'
                   and pg_get_constraintdef(oid) like '%incerto%'
                   and pg_get_constraintdef(oid) like '%cancelado%') then
    raise exception 'FASE 59 FAIL: check de status incompleto';
  end if;

  -- flag de rollout existe e nasce desligada (kill switch fail-closed)
  if not exists(select 1 from public.feature_flags
                 where chave='push_web' and ativo = false) then
    raise exception 'FASE 59 FAIL: flag push_web ausente ou nasceu ligada';
  end if;

  raise notice 'FASE 59 OK: push web (modelo, RLS, grants, fan-out, flag) verificado';
end $$;
