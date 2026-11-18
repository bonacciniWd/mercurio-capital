-- Seguro para produção: somente metadados/definições, sem fixtures ou dados de negócio.
-- Executar após a migration 20261118000002, preferencialmente em transação read-only.
begin read only;
do $$
declare
  assinatura text;
  assinaturas text[] := array[
    'public.prospeccao_cliente_anexo_preparar(uuid,text,text,integer)',
    'public.prospeccao_cliente_anexo_confirmar(uuid)',
    'public.prospeccao_cliente_anexo_cancelar(uuid)',
    'public.prospeccao_cliente_anexo_acesso(uuid,boolean)',
    'public.prospeccao_cliente_anexo_objeto_permitido(text,text,text)'
  ];
begin
  if to_regclass('public.prospeccoes_clientes_anexos') is null
    or not (select relrowsecurity from pg_class where oid='public.prospeccoes_clientes_anexos'::regclass) then
    raise exception 'fase66_estrutura_rls_ausente';
  end if;
  if has_table_privilege('anon','public.prospeccoes_clientes_anexos','SELECT')
    or has_table_privilege('authenticated','public.prospeccoes_clientes_anexos','INSERT,UPDATE,DELETE')
    or not has_table_privilege('authenticated','public.prospeccoes_clientes_anexos','SELECT') then
    raise exception 'fase66_estrutura_grants_incorretos';
  end if;
  foreach assinatura in array assinaturas loop
    if to_regprocedure(assinatura) is null then
      raise exception 'fase66_estrutura_rpc_ausente: %',assinatura;
    end if;
    if has_function_privilege('anon',assinatura,'EXECUTE')
      or not has_function_privilege('authenticated',assinatura,'EXECUTE')
      or not (select prosecdef from pg_proc where oid=to_regprocedure(assinatura)) then
      raise exception 'fase66_estrutura_rpc_grants_incorretos: %',assinatura;
    end if;
  end loop;
  if not exists(select 1 from storage.buckets where id='prospeccao-clientes-anexos'
    and public=false and file_size_limit=2097152
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/heic']::text[]
    and array_length(allowed_mime_types,1)=4) then
    raise exception 'fase66_estrutura_bucket_incorreto';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
    and policyname in('b2c_anexos_ler_restrito','b2c_anexos_upload_restrito','b2c_anexos_sem_overwrite',
      'b2c_anexos_preservar_recebidos','b2c_anexos_anon_negado') and permissive='RESTRICTIVE')<>5 then
    raise exception 'fase66_estrutura_policies_restritivas_ausentes';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='prospeccoes_clientes_anexos' and policyname='prospeccoes_clientes_anexos_ler'
    and qual ilike '%prospeccao_cliente_anexo_acesso%' and qual ilike '%deleted_at%') then
    raise exception 'fase66_estrutura_policy_metadados_ausente';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.prospeccoes_clientes_anexos'::regclass
    and tgname='trg_prospeccoes_clientes_anexos_updated_at' and not tgisinternal) then
    raise exception 'fase66_estrutura_trigger_ausente';
  end if;
end;
$$;
select 'fase66_estrutura_ok' as resultado,
  (select relrowsecurity from pg_class where oid='public.prospeccoes_clientes_anexos'::regclass) as rls,
  (select public from storage.buckets where id='prospeccao-clientes-anexos') as bucket_publico;
rollback;
