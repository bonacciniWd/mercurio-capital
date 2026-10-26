-- Fase 46 — relatório Serasa: controles de autorização, configuração e carteira.
-- Read-only: executar após a migration em banco descartável/homologação.
-- Não executa consulta, não lê dados de clientes e não movimenta carteira.
do $$
declare
  v_uat public.serasa_relatorios_config%rowtype;
  v_prod public.serasa_relatorios_config%rowtype;
  v_constraint text;
begin
  if to_regclass('public.consulta_autorizacoes') is null
    or to_regclass('public.serasa_relatorios_config') is null then
    raise exception 'serasa_tables_missing';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.consulta_autorizacoes'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.serasa_relatorios_config'::regclass) then
    raise exception 'serasa_rls_disabled';
  end if;
  if has_table_privilege('anon', 'public.consulta_autorizacoes', 'select')
    or has_table_privilege('anon', 'public.serasa_relatorios_config', 'select') then
    raise exception 'anonymous_serasa_config_or_authorization_read_forbidden';
  end if;

  select * into v_uat from public.serasa_relatorios_config where ambiente='uat';
  select * into v_prod from public.serasa_relatorios_config where ambiente='producao';
  if not coalesce(v_uat.ativo, false)
    or v_uat.report_pf <> 'RELATORIO_AVANCADO_TOP_SCORE_PF'
    or v_uat.report_pj <> 'RELATORIO_AVANCADO_PJ_ANALITICO' then
    raise exception 'serasa_uat_products_or_flag_invalid';
  end if;
  if coalesce(v_prod.ativo, true) then
    raise exception 'serasa_production_must_remain_disabled';
  end if;

  if has_column_privilege('authenticated', 'public.logs_consultas', 'request', 'select')
    or has_column_privilege('authenticated', 'public.logs_consultas', 'response', 'select') then
    raise exception 'provider_payload_exposed_to_authenticated_role';
  end if;

  if not has_function_privilege('authenticated',
      'public.consulta_autorizacao_registrar(uuid,public.tipo_consulta,uuid,text,uuid)', 'execute')
    or has_function_privilege('anon',
      'public.consulta_autorizacao_registrar(uuid,public.tipo_consulta,uuid,text,uuid)', 'execute') then
    raise exception 'authorization_rpc_grants_invalid';
  end if;
  if not has_function_privilege('authenticated',
      'public.consulta_iniciar_serasa(uuid,public.tipo_consulta,uuid,uuid,text)', 'execute')
    or has_function_privilege('anon',
      'public.consulta_iniciar_serasa(uuid,public.tipo_consulta,uuid,uuid,text)', 'execute') then
    raise exception 'serasa_start_rpc_grants_invalid';
  end if;

  if has_function_privilege('authenticated', 'public.consulta_concluir(uuid,jsonb,jsonb,text)', 'execute')
    or has_function_privilege('authenticated', 'public.consulta_estornar(uuid,text)', 'execute')
    or has_function_privilege('authenticated',
      'public.wallet_debit(uuid,public.wallet_movimento_tipo,bigint,text,uuid,uuid,text,jsonb)', 'execute')
    or has_function_privilege('authenticated',
      'public.wallet_credit(uuid,public.wallet_movimento_tipo,bigint,text,uuid,uuid,text,jsonb)', 'execute') then
    raise exception 'trusted_completion_or_wallet_helpers_exposed';
  end if;
  if not has_function_privilege('service_role', 'public.consulta_concluir(uuid,jsonb,jsonb,text)', 'execute')
    or not has_function_privilege('service_role', 'public.consulta_estornar(uuid,text)', 'execute') then
    raise exception 'service_role_completion_grants_missing';
  end if;

  select pg_get_constraintdef(oid) into v_constraint
    from pg_constraint
   where conrelid='public.logs_consultas'::regclass
     and conname='logs_consultas_status_check';
  if coalesce(v_constraint, '') not ilike '%reconciliacao_pendente%' then
    raise exception 'reconciliation_status_constraint_missing';
  end if;

  raise notice 'fase-46 serasa: config, RLS, privacidade, RPC grants e produção bloqueada OK';
end $$;
