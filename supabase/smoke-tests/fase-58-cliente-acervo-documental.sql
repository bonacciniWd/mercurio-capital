-- Execute after migration 20261108000003 on a local/test database.
-- Access-by-user cases were also exercised with synthetic rows in a rolled-back
-- transaction; this file keeps deploy verification free of fixture writes.
do $$
declare proposta_policy text; storage_policy text;
begin
  if not (select relrowsecurity from pg_class where oid='public.cliente_documentos'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.cliente_documento_versoes'::regclass)
     or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then
    raise exception 'cliente_acervo_rls_desativada';
  end if;

  if has_table_privilege('anon','public.cliente_documentos','SELECT')
     or has_table_privilege('anon','public.cliente_documento_versoes','SELECT')
     or has_function_privilege('anon','public.cliente_acervo_obter()','EXECUTE')
     or has_function_privilege('anon','public.cliente_documento_preparar(uuid,public.documento_tipo,text,text,text,bigint,text,uuid)','EXECUTE')
     or has_function_privilege('anon','public.cliente_documento_finalizar(uuid)','EXECUTE')
     or has_function_privilege('anon','public.cliente_documento_reutilizar(uuid,uuid)','EXECUTE') then
    raise exception 'cliente_acervo_privilegios_anonimos_invalidos';
  end if;

  if not has_function_privilege('authenticated','public.cliente_acervo_obter()','EXECUTE')
     or not has_function_privilege('authenticated','public.cliente_documento_preparar(uuid,public.documento_tipo,text,text,text,bigint,text,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.cliente_documento_finalizar(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.cliente_documento_reutilizar(uuid,uuid)','EXECUTE') then
    raise exception 'cliente_acervo_rpc_indisponivel';
  end if;

  select qual into proposta_policy from pg_policies
   where schemaname='public' and tablename='propostas' and policyname='cliente_le_propria_proposta';
  if proposta_policy is null or proposta_policy not like '%app_my_proposta_ids%' then
    raise exception 'propostas_coproponente_policy_ausente';
  end if;

  select qual into storage_policy from pg_policies
   where schemaname='storage' and tablename='objects' and policyname='cliente_acervo_storage_read';
  if storage_policy is null or storage_policy not like '%cliente_acervo_pode_ler%' then
    raise exception 'cliente_acervo_storage_nao_validado';
  end if;

  if exists(select 1 from pg_policies where schemaname='public' and tablename='proposta_documentos' and policyname='cliente_acervo_insert_via_rpc')
     or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cliente_acervo_storage_insert_via_rpc') then
    raise exception 'upload_legado_bloqueado_para_apps_instalados';
  end if;

  if to_regprocedure('public.admin_cliente_acervo_dry_run()') is null
     or not has_function_privilege('authenticated','public.admin_cliente_acervo_dry_run()','EXECUTE') then
    raise exception 'cliente_acervo_dry_run_indisponivel';
  end if;
end;
$$;
