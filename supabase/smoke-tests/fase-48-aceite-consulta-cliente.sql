-- Structural smoke checks for the local client-query acceptance migration.
-- This script performs no writes and does not execute a paid consultation.
do $$
begin
  if to_regclass('public.proposta_consulta_aceites') is null then
    raise exception 'missing proposta_consulta_aceites';
  end if;
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.consulta_autorizacoes'::regclass
       and attname = 'aceite_consulta_id' and not attisdropped
  ) then raise exception 'missing consultation receipt reference on authorizations'; end if;
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.logs_consultas'::regclass
       and attname = 'aceite_consulta_id' and not attisdropped
  ) then raise exception 'missing consultation receipt reference on consultation logs'; end if;
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.proposta_consulta_aceites'::regclass
       and attname = 'origem' and not attisdropped
  ) then raise exception 'missing receipt provenance'; end if;
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.proposta_consulta_aceites'::regclass
       and attname = 'atestado_em' and not attisdropped
  ) then raise exception 'missing controller attestation timestamp'; end if;
  if not coalesce((select relrowsecurity from pg_class where oid = 'public.proposta_consulta_aceites'::regclass), false) then
    raise exception 'RLS is disabled on proposal consultation receipts';
  end if;
  if has_table_privilege('anon', 'public.proposta_consulta_aceites', 'insert')
     or has_table_privilege('authenticated', 'public.proposta_consulta_aceites', 'insert') then
    raise exception 'untrusted roles can insert consultation receipts';
  end if;
  if has_function_privilege('authenticated', 'public.cliente_consulta_aceite_registrar(uuid,uuid,uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.cliente_consulta_aceite_registrar(uuid,uuid,uuid,uuid)', 'execute') then
    raise exception 'untrusted roles can execute receipt registration';
  end if;
  if not has_function_privilege('service_role', 'public.cliente_consulta_aceite_registrar(uuid,uuid,uuid,uuid)', 'execute') then
    raise exception 'service_role cannot register a receipt';
  end if;
  if has_function_privilege('anon', 'public.admin_proposta_consulta_aceites_atestar_retroativo()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_proposta_consulta_aceites_atestar_retroativo()', 'execute') then
    raise exception 'retroactive attestation RPC grants are incorrect';
  end if;
  if position('provedor_mock_indisponivel' in pg_get_functiondef('public.consulta_iniciar(uuid,public.tipo_consulta,text,jsonb)'::regprocedure)) = 0 then
    raise exception 'generic consultation RPC does not block mock providers';
  end if;
  if position('aceite_consulta_id' in pg_get_functiondef('public.consulta_iniciar_serasa(uuid,public.tipo_consulta,uuid,uuid,text)'::regprocedure)) = 0 then
    raise exception 'Serasa consultation RPC does not validate or audit acceptance receipts';
  end if;
end;
$$;
