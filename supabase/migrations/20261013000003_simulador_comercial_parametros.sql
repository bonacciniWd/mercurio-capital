-- Premissas do simulador comercial. Valores começam pendentes e não alteram
-- qualquer cálculo até revisão financeira e uma ativação em release posterior.

insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'simulador_parametros',
  jsonb_build_object(
    'schema_version', 1,
    'versao', 0,
    'status', 'aguardando_validacao_financeira',
    'vigente_desde', null,
    'iof', jsonb_build_object(
      'percentual_adicional', null,
      'percentual_diario', null,
      'limite_dias', null,
      'base', null
    ),
    'tac', jsonb_build_object(
      'percentual', null,
      'minimo_reais', null,
      'base', null
    ),
    'registro', jsonb_build_object('faixas', '[]'::jsonb),
    'seguros', jsonb_build_object(
      'mip_percentual_mensal', null,
      'mip_base', null,
      'dfi_percentual_mensal', null,
      'dfi_base', null
    )
  ),
  'Rascunho de premissas do simulador comercial; pendente de validação financeira.'
)
on conflict (chave) do nothing;

-- Não permitir leitura direta desta chave: parceiros recebem apenas o estado
-- seguro por RPC e a configuração completa fica reservada ao admin full.
drop policy if exists "autenticados_le_config" on public.configuracoes_sistema;
create policy "autenticados_le_config" on public.configuracoes_sistema
  for select using (auth.role() = 'authenticated' and chave <> 'simulador_parametros');

-- Toda leitura de configuração geral continua disponível a admin full pelo
-- policy acima; esta política impede escrita ou remoção direta do parâmetro.
drop policy if exists "admin_full_config" on public.configuracoes_sistema;
create policy "admin_full_config" on public.configuracoes_sistema
  for all
  using (public.app_is_admin_full() and chave <> 'simulador_parametros')
  with check (public.app_is_admin_full() and chave <> 'simulador_parametros');

create or replace function public._simulador_json_numero(
  p_value jsonb,
  p_label text,
  p_max numeric default null,
  p_integer boolean default false
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text;
  v_number numeric;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'number' then
    raise exception '% precisa ser um número.', p_label using errcode = '22023';
  end if;
  v_text := p_value #>> '{}';
  v_number := v_text::numeric;
  if v_number < 0 or (p_max is not null and v_number > p_max) then
    raise exception '% está fora do intervalo permitido.', p_label using errcode = '22023';
  end if;
  if p_integer and trunc(v_number) <> v_number then
    raise exception '% precisa ser inteiro.', p_label using errcode = '22023';
  end if;
  return v_number;
end;
$$;
revoke all on function public._simulador_json_numero(jsonb, text, numeric, boolean) from public, anon, authenticated;

create or replace function public._simulador_validar_base(p_value jsonb, p_label text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base text;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then return null; end if;
  if jsonb_typeof(p_value) <> 'string' then
    raise exception '% inválida.', p_label using errcode = '22023';
  end if;
  v_base := p_value #>> '{}';
  if v_base not in ('credito_liquido', 'principal_bruto', 'saldo_devedor', 'valor_garantia') then
    raise exception '% inválida.', p_label using errcode = '22023';
  end if;
  return v_base;
end;
$$;
revoke all on function public._simulador_validar_base(jsonb, text) from public, anon, authenticated;

create or replace function public.simulador_parametros_publicos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_rate jsonb;
  v_status text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not public.app_is_admin_full()
    and not (public.app_user_role() = 'admin')
    and not (
      public.app_user_role() = 'partner'
      and public.app_is_approved()
      and public.app_partner_status() = 'approved'
    ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select valor into v_config
    from public.configuracoes_sistema where chave = 'simulador_parametros';
  select valor into v_rate
    from public.configuracoes_sistema where chave = 'taxa_juros_mensal_default';

  -- A leitura pública não pode reativar encargos por um registro legado ou
  -- alterado fora do RPC; esta versão sempre comunica estado pendente.
  v_status := 'aguardando_validacao_financeira';
  v_result := jsonb_build_object(
    'status', v_status,
    'versao', coalesce((v_config->>'versao')::integer, 0),
    'vigente_desde', v_config->'vigente_desde',
    'taxa_juros_mensal_default', case
      when jsonb_typeof(v_rate) = 'number' then v_rate
      when jsonb_typeof(v_rate) = 'string' and (v_rate #>> '{}') ~ '^[0-9]+([.][0-9]+)?$' then to_jsonb((v_rate #>> '{}')::numeric)
      else 'null'::jsonb
    end
  );
  return v_result;
end;
$$;
revoke all on function public.simulador_parametros_publicos() from public, anon;
grant execute on function public.simulador_parametros_publicos() to authenticated;

create or replace function public.admin_simulador_parametros_obter()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_rate jsonb;
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode = '42501'; end if;
  select valor into v_config from public.configuracoes_sistema where chave = 'simulador_parametros';
  select valor into v_rate from public.configuracoes_sistema where chave = 'taxa_juros_mensal_default';
  return jsonb_build_object(
    'simulador_parametros', v_config,
    'taxa_juros_mensal_default', case
      when jsonb_typeof(v_rate) = 'number' then v_rate
      when jsonb_typeof(v_rate) = 'string' and (v_rate #>> '{}') ~ '^[0-9]+([.][0-9]+)?$' then to_jsonb((v_rate #>> '{}')::numeric)
      else 'null'::jsonb
    end
  );
end;
$$;
revoke all on function public.admin_simulador_parametros_obter() from public, anon;
grant execute on function public.admin_simulador_parametros_obter() to authenticated;

create or replace function public.admin_simulador_parametros_salvar(
  p_parametros jsonb,
  p_taxa_juros_mensal_default numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_rate_before jsonb;
  v_clean jsonb;
  v_ranges jsonb;
  v_range jsonb;
  v_version integer;
  v_base text;
  v_uf text;
  v_min numeric;
  v_max numeric;
  v_fee numeric;
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode = '42501'; end if;
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_parametros is null or jsonb_typeof(p_parametros) <> 'object' then
    raise exception 'parâmetros inválidos.' using errcode = '22023';
  end if;
  if p_taxa_juros_mensal_default is null or p_taxa_juros_mensal_default < 0 or p_taxa_juros_mensal_default > 100 then
    raise exception 'A taxa mensal deve estar entre 0 e 100.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_parametros->'iof') <> 'object'
    or jsonb_typeof(p_parametros->'tac') <> 'object'
    or jsonb_typeof(p_parametros->'registro') <> 'object'
    or jsonb_typeof(p_parametros->'seguros') <> 'object' then
    raise exception 'Estrutura das premissas inválida.' using errcode = '22023';
  end if;

  perform public._simulador_json_numero(p_parametros #> '{iof,percentual_adicional}', 'IOF adicional', 100, false);
  perform public._simulador_json_numero(p_parametros #> '{iof,percentual_diario}', 'IOF diário', 100, false);
  perform public._simulador_json_numero(p_parametros #> '{iof,limite_dias}', 'Limite de dias do IOF', 3650, true);
  v_base := public._simulador_validar_base(p_parametros #> '{iof,base}', 'Base do IOF');
  perform public._simulador_json_numero(p_parametros #> '{tac,percentual}', 'TAC', 100, false);
  perform public._simulador_json_numero(p_parametros #> '{tac,minimo_reais}', 'TAC mínima', 1000000000, false);
  v_base := public._simulador_validar_base(p_parametros #> '{tac,base}', 'Base da TAC');
  perform public._simulador_json_numero(p_parametros #> '{seguros,mip_percentual_mensal}', 'Seguro MIP', 100, false);
  v_base := public._simulador_validar_base(p_parametros #> '{seguros,mip_base}', 'Base do MIP');
  perform public._simulador_json_numero(p_parametros #> '{seguros,dfi_percentual_mensal}', 'Seguro DFI', 100, false);
  v_base := public._simulador_validar_base(p_parametros #> '{seguros,dfi_base}', 'Base do DFI');

  v_ranges := coalesce(p_parametros #> '{registro,faixas}', '[]'::jsonb);
  if jsonb_typeof(v_ranges) <> 'array' then raise exception 'A tabela de registro precisa ser uma lista.' using errcode = '22023'; end if;
  for v_range in select value from jsonb_array_elements(v_ranges) loop
    if jsonb_typeof(v_range) <> 'object' then raise exception 'Faixa de registro inválida.' using errcode = '22023'; end if;
    v_uf := upper(btrim(coalesce(v_range->>'uf', '')));
    if v_uf <> '*' and v_uf !~ '^[A-Z]{2}$' then raise exception 'Informe uma UF válida ou * na tabela de registro.' using errcode = '22023'; end if;
    v_min := public._simulador_json_numero(v_range->'valor_minimo', 'Valor mínimo de registro', 1000000000000, false);
    v_max := public._simulador_json_numero(v_range->'valor_maximo', 'Valor máximo de registro', 1000000000000, false);
    v_fee := public._simulador_json_numero(v_range->'tarifa', 'Tarifa de registro', 1000000000, false);
    if v_min is null or v_fee is null then raise exception 'Faixa de registro precisa de valor mínimo e tarifa.' using errcode = '22023'; end if;
    if v_max is not null and v_max <= v_min then raise exception 'Valor máximo da faixa deve ser maior que o mínimo.' using errcode = '22023'; end if;
  end loop;
  if exists (
    select 1
      from jsonb_array_elements(v_ranges) with ordinality a(value, ordinality)
      join jsonb_array_elements(v_ranges) with ordinality b(value, ordinality)
        on a.ordinality < b.ordinality
     where upper(btrim(coalesce(a.value->>'uf', ''))) = upper(btrim(coalesce(b.value->>'uf', '')))
       and (a.value->>'valor_maximo' is null or (b.value->>'valor_minimo')::numeric < (a.value->>'valor_maximo')::numeric)
       and (b.value->>'valor_maximo' is null or (a.value->>'valor_minimo')::numeric < (b.value->>'valor_maximo')::numeric)
  ) then
    raise exception 'A tabela de registro contém faixas sobrepostas.' using errcode = '22023';
  end if;

  select valor into v_before from public.configuracoes_sistema where chave = 'simulador_parametros' for update;
  select valor into v_rate_before from public.configuracoes_sistema where chave = 'taxa_juros_mensal_default' for update;
  v_version := coalesce((v_before->>'versao')::integer, 0) + 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'uf', upper(btrim(coalesce(value->>'uf', ''))),
    'valor_minimo', value->'valor_minimo',
    'valor_maximo', value->'valor_maximo',
    'tarifa', value->'tarifa'
  ) order by upper(btrim(coalesce(value->>'uf', ''))), (value->>'valor_minimo')::numeric), '[]'::jsonb)
    into v_ranges from jsonb_array_elements(v_ranges);

  v_clean := jsonb_build_object(
    'schema_version', 1,
    'versao', v_version,
    'status', 'aguardando_validacao_financeira',
    'vigente_desde', null,
    'iof', jsonb_build_object(
      'percentual_adicional', p_parametros #> '{iof,percentual_adicional}',
      'percentual_diario', p_parametros #> '{iof,percentual_diario}',
      'limite_dias', p_parametros #> '{iof,limite_dias}',
      'base', p_parametros #> '{iof,base}'
    ),
    'tac', jsonb_build_object(
      'percentual', p_parametros #> '{tac,percentual}',
      'minimo_reais', p_parametros #> '{tac,minimo_reais}',
      'base', p_parametros #> '{tac,base}'
    ),
    'registro', jsonb_build_object('faixas', v_ranges),
    'seguros', jsonb_build_object(
      'mip_percentual_mensal', p_parametros #> '{seguros,mip_percentual_mensal}',
      'mip_base', p_parametros #> '{seguros,mip_base}',
      'dfi_percentual_mensal', p_parametros #> '{seguros,dfi_percentual_mensal}',
      'dfi_base', p_parametros #> '{seguros,dfi_base}'
    )
  );

  insert into public.configuracoes_sistema (chave, valor, descricao, updated_by, updated_at)
  values ('simulador_parametros', v_clean, 'Premissas financeiras do simulador comercial.', auth.uid(), now())
  on conflict (chave) do update set valor = excluded.valor, descricao = excluded.descricao, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.configuracoes_sistema (chave, valor, descricao, updated_by, updated_at)
  values ('taxa_juros_mensal_default', to_jsonb(p_taxa_juros_mensal_default), 'Taxa de juros mensal padrão (% a.m. sobre IPCA)', auth.uid(), now())
  on conflict (chave) do update set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  if v_before is null then
    perform public.registrar_audit('create', 'configuracoes_sistema', null, null,
      jsonb_build_object('chave', 'simulador_parametros', 'valor', v_clean));
  end if;
  if v_rate_before is null then
    perform public.registrar_audit('create', 'configuracoes_sistema', null, null,
      jsonb_build_object('chave', 'taxa_juros_mensal_default', 'valor', to_jsonb(p_taxa_juros_mensal_default)));
  end if;

  return jsonb_build_object('simulador_parametros', v_clean, 'taxa_juros_mensal_default', to_jsonb(p_taxa_juros_mensal_default));
end;
$$;
revoke all on function public.admin_simulador_parametros_salvar(jsonb, numeric) from public, anon;
grant execute on function public.admin_simulador_parametros_salvar(jsonb, numeric) to authenticated;
