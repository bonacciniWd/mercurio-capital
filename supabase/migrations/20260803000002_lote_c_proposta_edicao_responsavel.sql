-- =============================================
-- MIGRATION — LOTE C (PROPOSTA DETALHE: EDIÇÃO, RESPONSÁVEL)
-- =============================================
-- Aditiva; não altera RLS além do necessário.
--   1) RPC admin_proposta_update_campos — única porta de escrita para os campos
--      exibidos nas abas Resumo/Proponentes/Imóveis/Cliente do admin.
--   2) RPC admin_set_responsavel — define o admin responsável pela proposta.

-- =============================================
-- 1) RPC admin_proposta_update_campos
-- =============================================
create or replace function public.admin_proposta_update_campos(
  p_proposta_id uuid,
  p_proposta    jsonb default '{}'::jsonb,
  p_cliente     jsonb default '{}'::jsonb,
  p_proponentes jsonb default '[]'::jsonb,
  p_imoveis     jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before_proposta jsonb;
  v_before_cliente  jsonb;
  v_cliente_id      uuid;
  v_item            jsonb;
  v_id              uuid;
  v_proponentes_n   int := 0;
  v_imoveis_n       int := 0;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select cliente_id, to_jsonb(propostas.*) into v_cliente_id, v_before_proposta
    from propostas where id = p_proposta_id for update;
  if v_before_proposta is null then
    raise exception 'proposta_not_found' using errcode = 'P0002';
  end if;

  if v_cliente_id is not null then
    select to_jsonb(clientes.*) into v_before_cliente from clientes where id = v_cliente_id;
  end if;

  update propostas set
    produto             = coalesce(nullif(p_proposta->>'produto', '')::produto_tipo, produto),
    valor_solicitado     = coalesce(nullif(p_proposta->>'valor_solicitado', '')::numeric, valor_solicitado),
    prazo_meses          = coalesce(nullif(p_proposta->>'prazo_meses', '')::int, prazo_meses),
    carencia_meses       = coalesce(nullif(p_proposta->>'carencia_meses', '')::int, carencia_meses),
    taxa_juros_mensal    = coalesce(nullif(p_proposta->>'taxa_juros_mensal', '')::numeric, taxa_juros_mensal),
    amortizacao          = coalesce(nullif(p_proposta->>'amortizacao', '')::amortizacao_tipo, amortizacao),
    indexador            = coalesce(nullif(p_proposta->>'indexador', ''), indexador),
    correcao             = coalesce(nullif(p_proposta->>'correcao', '')::correcao_tipo, correcao),
    limite_50_aplicado   = coalesce(nullif(p_proposta->>'limite_50_aplicado', '')::boolean, limite_50_aplicado),
    created_at           = coalesce(nullif(p_proposta->>'created_at', '')::timestamptz, created_at)
  where id = p_proposta_id;

  if v_cliente_id is not null then
    update clientes set
      nome_completo        = coalesce(nullif(p_cliente->>'nome_completo', ''), nome_completo),
      cpf                  = coalesce(nullif(p_cliente->>'cpf', ''), cpf),
      cnpj                 = coalesce(nullif(p_cliente->>'cnpj', ''), cnpj),
      email                = coalesce(nullif(p_cliente->>'email', ''), email),
      telefone_ddi         = coalesce(nullif(p_cliente->>'telefone_ddi', ''), telefone_ddi),
      telefone             = coalesce(nullif(p_cliente->>'telefone', ''), telefone),
      modelo_renda         = coalesce(nullif(p_cliente->>'modelo_renda', '')::modelo_renda_tipo, modelo_renda),
      renda_mensal         = coalesce(nullif(p_cliente->>'renda_mensal', '')::numeric, renda_mensal),
      endereco_cep         = coalesce(nullif(p_cliente->>'endereco_cep', ''), endereco_cep),
      endereco_logradouro  = coalesce(nullif(p_cliente->>'endereco_logradouro', ''), endereco_logradouro),
      endereco_numero      = coalesce(nullif(p_cliente->>'endereco_numero', ''), endereco_numero),
      endereco_complemento = coalesce(p_cliente->>'endereco_complemento', endereco_complemento),
      endereco_bairro      = coalesce(nullif(p_cliente->>'endereco_bairro', ''), endereco_bairro),
      endereco_cidade      = coalesce(nullif(p_cliente->>'endereco_cidade', ''), endereco_cidade),
      endereco_estado      = coalesce(nullif(p_cliente->>'endereco_estado', ''), endereco_estado),
      razao_social         = coalesce(nullif(p_cliente->>'razao_social', ''), razao_social),
      email_responsavel    = coalesce(nullif(p_cliente->>'email_responsavel', ''), email_responsavel),
      celular_comercial    = coalesce(nullif(p_cliente->>'celular_comercial', ''), celular_comercial),
      tipo_empresa         = coalesce(nullif(p_cliente->>'tipo_empresa', ''), tipo_empresa),
      ramo_atuacao         = coalesce(nullif(p_cliente->>'ramo_atuacao', ''), ramo_atuacao),
      data_abertura        = coalesce(nullif(p_cliente->>'data_abertura', '')::date, data_abertura),
      faturamento_mensal   = coalesce(nullif(p_cliente->>'faturamento_mensal', '')::numeric, faturamento_mensal)
    where id = v_cliente_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_proponentes, '[]'::jsonb))
  loop
    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is null then continue; end if;

    update proponentes set
      nome             = coalesce(nullif(v_item->>'nome', ''), nome),
      cpf_cnpj         = coalesce(nullif(v_item->>'cpf_cnpj', ''), cpf_cnpj),
      relacao          = coalesce(nullif(v_item->>'relacao', ''), relacao),
      estado_civil     = coalesce(nullif(v_item->>'estado_civil', '')::estado_civil, estado_civil),
      pessoa_tipo      = coalesce(nullif(v_item->>'pessoa_tipo', '')::pessoa_tipo, pessoa_tipo),
      compoe_renda     = coalesce(nullif(v_item->>'compoe_renda', '')::boolean, compoe_renda),
      modelo_renda     = coalesce(nullif(v_item->>'modelo_renda', '')::modelo_renda_tipo, modelo_renda),
      renda_mensal     = coalesce(nullif(v_item->>'renda_mensal', '')::numeric, renda_mensal),
      endereco_cidade  = coalesce(nullif(v_item->>'endereco_cidade', ''), endereco_cidade),
      endereco_estado  = coalesce(nullif(v_item->>'endereco_estado', ''), endereco_estado)
    where id = v_id and proposta_id = p_proposta_id;

    if found then
      v_proponentes_n := v_proponentes_n + 1;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_imoveis, '[]'::jsonb))
  loop
    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is null then continue; end if;

    update imoveis set
      tipo        = coalesce(nullif(v_item->>'tipo', '')::imovel_tipo, tipo),
      cidade      = coalesce(nullif(v_item->>'cidade', ''), cidade),
      estado      = coalesce(nullif(v_item->>'estado', ''), estado),
      bairro      = coalesce(nullif(v_item->>'bairro', ''), bairro),
      logradouro  = coalesce(nullif(v_item->>'logradouro', ''), logradouro),
      numero      = coalesce(nullif(v_item->>'numero', ''), numero),
      valor       = coalesce(nullif(v_item->>'valor', '')::numeric, valor)
    where id = v_id and proposta_id = p_proposta_id;

    if found then
      v_imoveis_n := v_imoveis_n + 1;
    end if;
  end loop;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'admin_proposta_update_campos',
    'propostas',
    p_proposta_id,
    jsonb_build_object('proposta', v_before_proposta, 'cliente', v_before_cliente),
    jsonb_build_object(
      'proposta_patch', p_proposta,
      'cliente_patch', p_cliente,
      'proponentes_atualizados', v_proponentes_n,
      'imoveis_atualizados', v_imoveis_n
    )
  );

  return jsonb_build_object(
    'proposta_id', p_proposta_id,
    'proponentes_atualizados', v_proponentes_n,
    'imoveis_atualizados', v_imoveis_n
  );
end;
$$;

revoke all on function public.admin_proposta_update_campos(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.admin_proposta_update_campos(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- =============================================
-- 2) RPC admin_set_responsavel
-- =============================================
create or replace function public.admin_set_responsavel(
  p_proposta_id uuid,
  p_usuario_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before uuid;
  v_role   user_role;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select responsavel_id into v_before from propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_not_found' using errcode = 'P0002';
  end if;

  if p_usuario_id is not null then
    select role into v_role from usuarios where id = p_usuario_id;
    if v_role is null then
      raise exception 'usuario_not_found' using errcode = 'P0002';
    end if;
    if v_role <> 'admin' then
      raise exception 'usuario_alvo_nao_e_admin';
    end if;
  end if;

  update propostas set responsavel_id = p_usuario_id, updated_at = now() where id = p_proposta_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'admin_set_responsavel',
    'propostas',
    p_proposta_id,
    jsonb_build_object('responsavel_id', v_before),
    jsonb_build_object('responsavel_id', p_usuario_id)
  );
end;
$$;

revoke all on function public.admin_set_responsavel(uuid, uuid) from public;
grant execute on function public.admin_set_responsavel(uuid, uuid) to authenticated;
