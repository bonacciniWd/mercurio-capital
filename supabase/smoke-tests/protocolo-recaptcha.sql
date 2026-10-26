-- Execute in local/test DB after migration; transaction rolls back counters.
begin;
do $$
begin
  if has_function_privilege('anon','public.public_consulta_protocolo(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.public_consulta_protocolo(text,text)','EXECUTE') then
    raise exception 'public_lookup_still_executable';
  end if;
  if not has_function_privilege('service_role','public.public_consulta_protocolo(text,text)','EXECUTE') then
    raise exception 'service_lookup_not_executable';
  end if;
  if has_function_privilege('anon','public.public_protocolo_rate_consume(text)','EXECUTE')
    or has_function_privilege('authenticated','public.public_protocolo_rate_consume(text)','EXECUTE') then
    raise exception 'rate_rpc_public';
  end if;
end $$;
set local role service_role;
do $$
declare k text := 'protocolo-ip::' || repeat('a',64); i int;
begin
  for i in 1..5 loop
    if not public.public_protocolo_rate_consume(k) then raise exception 'rate_premature'; end if;
  end loop;
  if public.public_protocolo_rate_consume(k) then raise exception 'rate_not_enforced'; end if;
  if public.public_consulta_protocolo('SYNTHETIC-NONEXISTENT',null) <> '{"encontrado":false}'::jsonb then
    raise exception 'unexpected_lookup_contract';
  end if;
end $$;
rollback;
