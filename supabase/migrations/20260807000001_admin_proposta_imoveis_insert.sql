-- =============================================
-- MIGRATION — ADMIN PROPOSTA: INSERT DE IMÓVEIS NA EDIÇÃO
-- =============================================
-- Aditiva; recria admin_proposta_update_campos (mesma assinatura) para aceitar,
-- no mesmo payload de imóveis, itens com id (update, comportamento already
-- existente) e itens sem id (insert de um novo imóvel vinculado à proposta).
-- Mantém guard app_is_admin_operacional, auditoria em audit_log e demais
-- branches (proposta/cliente/proponentes) inalterados.

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
  v_imoveis_criados int := 0;
  v_novo_valor      numeric;
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

    if v_id is not null then
      -- Item existente: update (comportamento já existente, inalterado).
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
    else
      -- Item novo (sem id): insert vinculado à proposta. Demais colunas usam
      -- os defaults seguros já definidos na tabela (sem_numero, vagas_garagem,
      -- alugado, financiado, possui_debitos, principal, etc.).
      v_novo_valor := nullif(v_item->>'valor', '')::numeric;
      if v_novo_valor is null or v_novo_valor <= 0 then
        raise exception 'imovel_valor_invalido: informe um valor maior que zero para o novo imóvel'
          using errcode = '22023';
      end if;

      insert into imoveis (
        proposta_id, tipo, cidade, estado, bairro, logradouro, numero, valor, principal
      ) values (
        p_proposta_id,
        coalesce(nullif(v_item->>'tipo', '')::imovel_tipo, 'apartamento'),
        nullif(v_item->>'cidade', ''),
        nullif(v_item->>'estado', ''),
        nullif(v_item->>'bairro', ''),
        nullif(v_item->>'logradouro', ''),
        nullif(v_item->>'numero', ''),
        v_novo_valor,
        coalesce(nullif(v_item->>'principal', '')::boolean, false)
      );

      v_imoveis_criados := v_imoveis_criados + 1;
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
      'imoveis_atualizados', v_imoveis_n,
      'imoveis_criados', v_imoveis_criados
    )
  );

  return jsonb_build_object(
    'proposta_id', p_proposta_id,
    'proponentes_atualizados', v_proponentes_n,
    'imoveis_atualizados', v_imoveis_n,
    'imoveis_criados', v_imoveis_criados
  );
end;
$$;

revoke all on function public.admin_proposta_update_campos(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.admin_proposta_update_campos(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
