-- Verificações estruturais/read-only do backfill limitado aos 138 protocolos.
-- Não chama o RPC de escrita nem cria atestados.
do $$
declare
  v_count bigint;
  v_unique bigint;
begin
  if to_regprocedure('public.admin_proposta_consulta_aceites_atestar_retroativo()') is not null then
    raise exception 'RPC amplo sem escopo ainda está instalado';
  end if;

  if has_function_privilege('anon', 'public.admin_proposta_consulta_aceites_atestar_retroativo_preview()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_proposta_consulta_aceites_atestar_retroativo_preview()', 'execute') then
    raise exception 'ACL da prévia Admin incorreta';
  end if;

  if has_function_privilege('anon', 'public.admin_proposta_consulta_aceites_atestar_retroativo_revisado()', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_proposta_consulta_aceites_atestar_retroativo_revisado()', 'execute') then
    raise exception 'ACL da execução Admin incorreta';
  end if;

  if has_schema_privilege('authenticated', 'private', 'usage')
     or has_function_privilege('authenticated', 'private.proposta_consulta_aceites_protocolos_revisados()', 'execute') then
    raise exception 'A lista fixa não deve ser acessível diretamente pelo cliente';
  end if;

  select count(*), count(distinct protocolo)
    into v_count, v_unique
    from private.proposta_consulta_aceites_protocolos_revisados();

  if v_count <> 138 or v_unique <> 138 then
    raise exception 'Lista revisada inválida: % linhas, % protocolos distintos', v_count, v_unique;
  end if;
end;
$$;
