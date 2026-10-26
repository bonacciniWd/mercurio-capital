-- Verificação somente leitura após aplicar 20261013000001.
-- Não cria contas, altera perfis, envia e-mails ou faz upload de fotos.
do $$
begin
  if to_regclass('public.departamentos_internos') is null
    or to_regclass('public.cargos_internos') is null
    or to_regclass('public.usuarios_internos') is null then
    raise exception 'Tabelas de equipe interna ausentes';
  end if;
  if to_regprocedure('public.admin_internal_team_update(uuid,uuid,uuid,uuid,text,date)') is null
    or to_regprocedure('public.admin_internal_team_graph()') is null
    or to_regprocedure('public.admin_internal_team_list()') is null
    or to_regprocedure('public.admin_internal_team_catalogs()') is null
    or to_regprocedure('public.admin_internal_team_catalog_upsert(text,uuid,text,text,boolean)') is null then
    raise exception 'RPC de equipe interna ausente';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.usuarios_internos'::regclass) then
    raise exception 'RLS nao habilitada em usuarios_internos';
  end if;
  if has_table_privilege('anon','public.usuarios_internos','select')
    or has_table_privilege('authenticated','public.usuarios_internos','insert')
    or has_table_privilege('authenticated','public.usuarios_internos','update') then
    raise exception 'Privilegios diretos excessivos em usuarios_internos';
  end if;
  if has_function_privilege('anon','public.admin_internal_team_graph()','execute')
    or has_function_privilege('anon','public.admin_internal_team_update(uuid,uuid,uuid,uuid,text,date)','execute') then
    raise exception 'RPCs internas expostas a anon';
  end if;
  if not exists (select 1 from storage.buckets where id='avatares-internos' and public=false and file_size_limit=5242880) then
    raise exception 'Bucket privado de avatares internos ausente ou com limite incorreto';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.usuarios_internos'::regclass and tgname='trg_validate_usuario_interno_manager' and tgenabled <> 'D') then
    raise exception 'Validacao da hierarquia nao ativa';
  end if;
end $$;

select tablename, policyname, roles, cmd, qual, with_check
  from pg_policies
 where schemaname='public' and tablename in ('departamentos_internos','cargos_internos','usuarios_internos')
 order by tablename, policyname;

select proname, prosecdef, proconfig
  from pg_proc
 where pronamespace='public'::regnamespace
   and proname in ('admin_internal_team_update','admin_internal_team_graph','admin_internal_team_list','admin_internal_team_catalogs','admin_internal_team_catalog_upsert');
