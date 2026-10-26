-- Smoke read-only: validar existência, estado seguro inicial e privilégios.
-- Executar depois de aplicar 20261013000003 em ambiente de teste.

begin;

do $$
declare
  v_config jsonb;
begin
  if to_regprocedure('public.simulador_parametros_publicos()') is null
    or to_regprocedure('public.admin_simulador_parametros_obter()') is null
    or to_regprocedure('public.admin_simulador_parametros_salvar(jsonb,numeric)') is null then
    raise exception 'RPCs do simulador não foram encontradas.';
  end if;

  if has_function_privilege('anon', 'public.simulador_parametros_publicos()', 'EXECUTE')
    or has_function_privilege('anon', 'public.admin_simulador_parametros_obter()', 'EXECUTE')
    or has_function_privilege('anon', 'public.admin_simulador_parametros_salvar(jsonb,numeric)', 'EXECUTE') then
    raise exception 'Uma RPC de parâmetros está executável por anon.';
  end if;

  select valor into v_config
    from public.configuracoes_sistema
   where chave = 'simulador_parametros';
  if v_config is null then raise exception 'Configuração pendente não foi criada.'; end if;
  if v_config->>'status' <> 'aguardando_validacao_financeira' then
    raise exception 'Os encargos não começam bloqueados.';
  end if;
  if v_config #>> '{iof,percentual_adicional}' is not null
    or v_config #>> '{iof,percentual_diario}' is not null
    or v_config #>> '{tac,percentual}' is not null
    or v_config #>> '{seguros,mip_percentual_mensal}' is not null
    or v_config #>> '{seguros,dfi_percentual_mensal}' is not null then
    raise exception 'A configuração não deveria conter valores comerciais padrão.';
  end if;
end;
$$;

-- Como authenticated, a chave financeira não pode ser lida diretamente.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"role":"partner","approved":true,"partner_id":"00000000-0000-0000-0000-000000000000"}}',
  true
);
select 1 / case when count(*) = 0 then 1 else 0 end as config_privada_oculta
  from public.configuracoes_sistema
 where chave = 'simulador_parametros';
reset role;

rollback;
