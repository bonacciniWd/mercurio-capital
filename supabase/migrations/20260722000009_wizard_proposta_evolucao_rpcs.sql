-- =============================================
-- MIGRATION — WIZARD NOVA PROPOSTA (evolução Step 2/3): RPCs de criação
-- =============================================
-- Reescreve por completo partner_create_proposta(jsonb) e
-- admin_create_proposta(uuid, jsonb) preservando o comportamento vigente:
--   - taxa padrão 1.29
--   - magic link de ativação do cliente com validade de 30 minutos
--   - enqueue de e-mail transacional (enqueue_proposta_criada_email)
-- e acrescentando:
--   - validação de payload via proposta_payload_validar (cônjuge PF, PJ total, 50%)
--   - persistência dos novos campos de Step 2 (renda, endereço, dados PJ)
--   - persistência dos novos campos de Step 3 (imóvel principal + geolocalização)
--   - persistência da flag limite_50_aplicado na proposta
--
-- Conflito de produto resolvido (baseline oficial):
--   admin_create_proposta aceita parceiro 'approved' OU 'pending';
--   bloqueia 'rejected'/'suspended'. partner_create_proposta permanece
--   restrita ao próprio parceiro aprovado.

-- ===============================================================
-- partner_create_proposta(jsonb)
-- ===============================================================
create or replace function public.partner_create_proposta(p_payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  v_partner_id    uuid;
  v_role          text;
  v_pessoa_tipo   pessoa_tipo;
  v_cliente_id    uuid;
  v_proposta_id   uuid;
  v_protocolo     text;
  v_cliente_jsonb jsonb;
  v_cpf           text;
  v_cnpj          text;
  v_proponente    jsonb;
  v_imovel        jsonb;
  v_token         text;
  v_token_hash    text;
begin
  v_role := public.app_user_role();
  if v_role not in ('partner','team_member') then
    raise exception 'forbidden: apenas parceiros podem criar propostas' using errcode = '42501';
  end if;
  if not public.app_is_approved() then
    raise exception 'forbidden: parceiro não aprovado' using errcode = '42501';
  end if;
  v_partner_id := public.app_partner_id();
  if v_partner_id is null then
    raise exception 'forbidden: parceiro inválido' using errcode = '42501';
  end if;

  if p_payload->'cliente' is null then
    raise exception 'cliente é obrigatório' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'proponentes','[]'::jsonb)) = 0 then
    raise exception 'pelo menos um proponente é obrigatório' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'imoveis','[]'::jsonb)) = 0 then
    raise exception 'pelo menos um imóvel é obrigatório' using errcode = '22023';
  end if;

  -- Validações de negócio (cônjuge PF, PJ total, regra 50%)
  perform public.proposta_payload_validar(p_payload);

  v_pessoa_tipo   := coalesce((p_payload->>'pessoa_tipo')::pessoa_tipo, 'PF');
  v_cliente_jsonb := p_payload->'cliente';
  v_cpf           := nullif(v_cliente_jsonb->>'cpf','');
  v_cnpj          := nullif(v_cliente_jsonb->>'cnpj','');

  if v_pessoa_tipo = 'PF' and v_cpf is not null then
    select id into v_cliente_id from clientes where cpf = v_cpf and pessoa_tipo = 'PF' limit 1;
  elsif v_pessoa_tipo = 'PJ' and v_cnpj is not null then
    select id into v_cliente_id from clientes where cnpj = v_cnpj and pessoa_tipo = 'PJ' limit 1;
  end if;

  if v_cliente_id is null then
    insert into clientes (
      pessoa_tipo, nome_completo, cpf, cnpj, email, telefone, data_nascimento, estado_civil,
      modelo_renda, renda_mensal,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado,
      razao_social, email_responsavel, celular_comercial, tipo_empresa, ramo_atuacao,
      data_abertura, faturamento_mensal
    ) values (
      v_pessoa_tipo,
      coalesce(nullif(v_cliente_jsonb->>'nome_completo',''), nullif(v_cliente_jsonb->>'razao_social',''), 'Cliente'),
      v_cpf, v_cnpj,
      nullif(v_cliente_jsonb->>'email',''),
      nullif(v_cliente_jsonb->>'telefone',''),
      nullif(v_cliente_jsonb->>'data_nascimento','')::date,
      nullif(v_cliente_jsonb->>'estado_civil','')::estado_civil,
      nullif(v_cliente_jsonb->>'modelo_renda','')::modelo_renda_tipo,
      nullif(v_cliente_jsonb->>'renda_mensal','')::numeric,
      nullif(v_cliente_jsonb->>'endereco_cep',''),
      nullif(v_cliente_jsonb->>'endereco_logradouro',''),
      nullif(v_cliente_jsonb->>'endereco_numero',''),
      nullif(v_cliente_jsonb->>'endereco_complemento',''),
      nullif(v_cliente_jsonb->>'endereco_bairro',''),
      nullif(v_cliente_jsonb->>'endereco_cidade',''),
      nullif(v_cliente_jsonb->>'endereco_estado','')::char(2),
      nullif(v_cliente_jsonb->>'razao_social',''),
      nullif(v_cliente_jsonb->>'email_responsavel',''),
      nullif(v_cliente_jsonb->>'celular_comercial',''),
      nullif(v_cliente_jsonb->>'tipo_empresa',''),
      nullif(v_cliente_jsonb->>'ramo_atuacao',''),
      nullif(v_cliente_jsonb->>'data_abertura','')::date,
      nullif(v_cliente_jsonb->>'faturamento_mensal','')::numeric
    ) returning id into v_cliente_id;
  else
    -- Reuso de cliente: enriquece campos novos sem apagar dados existentes.
    update clientes set
      email                = coalesce(nullif(v_cliente_jsonb->>'email',''), email),
      telefone             = coalesce(nullif(v_cliente_jsonb->>'telefone',''), telefone),
      estado_civil         = coalesce(nullif(v_cliente_jsonb->>'estado_civil','')::estado_civil, estado_civil),
      modelo_renda         = coalesce(nullif(v_cliente_jsonb->>'modelo_renda','')::modelo_renda_tipo, modelo_renda),
      renda_mensal         = coalesce(nullif(v_cliente_jsonb->>'renda_mensal','')::numeric, renda_mensal),
      endereco_cep         = coalesce(nullif(v_cliente_jsonb->>'endereco_cep',''), endereco_cep),
      endereco_logradouro  = coalesce(nullif(v_cliente_jsonb->>'endereco_logradouro',''), endereco_logradouro),
      endereco_numero      = coalesce(nullif(v_cliente_jsonb->>'endereco_numero',''), endereco_numero),
      endereco_complemento = coalesce(nullif(v_cliente_jsonb->>'endereco_complemento',''), endereco_complemento),
      endereco_bairro      = coalesce(nullif(v_cliente_jsonb->>'endereco_bairro',''), endereco_bairro),
      endereco_cidade      = coalesce(nullif(v_cliente_jsonb->>'endereco_cidade',''), endereco_cidade),
      endereco_estado      = coalesce(nullif(v_cliente_jsonb->>'endereco_estado','')::char(2), endereco_estado),
      razao_social         = coalesce(nullif(v_cliente_jsonb->>'razao_social',''), razao_social),
      email_responsavel    = coalesce(nullif(v_cliente_jsonb->>'email_responsavel',''), email_responsavel),
      celular_comercial    = coalesce(nullif(v_cliente_jsonb->>'celular_comercial',''), celular_comercial),
      tipo_empresa         = coalesce(nullif(v_cliente_jsonb->>'tipo_empresa',''), tipo_empresa),
      ramo_atuacao         = coalesce(nullif(v_cliente_jsonb->>'ramo_atuacao',''), ramo_atuacao),
      data_abertura        = coalesce(nullif(v_cliente_jsonb->>'data_abertura','')::date, data_abertura),
      faturamento_mensal   = coalesce(nullif(v_cliente_jsonb->>'faturamento_mensal','')::numeric, faturamento_mensal)
    where id = v_cliente_id;
  end if;

  insert into propostas (
    partner_id, cliente_id, produto, valor_solicitado, prazo_meses, carencia_meses,
    taxa_juros_mensal, correcao, amortizacao, indexador, limite_50_aplicado
  ) values (
    v_partner_id, v_cliente_id,
    (p_payload->>'produto')::produto_tipo,
    (p_payload->>'valor_solicitado')::numeric,
    (p_payload->>'prazo_meses')::int,
    coalesce((p_payload->>'carencia_meses')::int, 0),
    coalesce((p_payload->>'taxa_juros_mensal')::numeric, 1.29),
    coalesce((p_payload->>'correcao')::correcao_tipo, 'pos_fixado'),
    coalesce((p_payload->>'amortizacao')::amortizacao_tipo, 'price'),
    coalesce(p_payload->>'indexador', 'IPCA'),
    coalesce((p_payload->>'limite_50_aplicado')::boolean, false)
  ) returning id, protocolo into v_proposta_id, v_protocolo;

  for v_proponente in select * from jsonb_array_elements(p_payload->'proponentes') loop
    insert into proponentes (
      proposta_id, cliente_id, principal, pessoa_tipo, nome, cpf_cnpj,
      estado_civil, relacao, dados_complementares,
      modelo_renda, renda_mensal,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado,
      razao_social, email_responsavel, celular_comercial, tipo_empresa, ramo_atuacao,
      data_abertura, faturamento_mensal
    ) values (
      v_proposta_id,
      case when coalesce((v_proponente->>'principal')::boolean, false) then v_cliente_id else null end,
      coalesce((v_proponente->>'principal')::boolean, false),
      coalesce((v_proponente->>'pessoa_tipo')::pessoa_tipo, v_pessoa_tipo),
      v_proponente->>'nome',
      nullif(v_proponente->>'cpf_cnpj',''),
      nullif(v_proponente->>'estado_civil','')::estado_civil,
      nullif(v_proponente->>'relacao',''),
      coalesce(v_proponente->'dados_complementares','{}'::jsonb),
      nullif(v_proponente->>'modelo_renda','')::modelo_renda_tipo,
      nullif(v_proponente->>'renda_mensal','')::numeric,
      nullif(v_proponente->>'endereco_cep',''),
      nullif(v_proponente->>'endereco_logradouro',''),
      nullif(v_proponente->>'endereco_numero',''),
      nullif(v_proponente->>'endereco_complemento',''),
      nullif(v_proponente->>'endereco_bairro',''),
      nullif(v_proponente->>'endereco_cidade',''),
      nullif(v_proponente->>'endereco_estado','')::char(2),
      nullif(v_proponente->>'razao_social',''),
      nullif(v_proponente->>'email_responsavel',''),
      nullif(v_proponente->>'celular_comercial',''),
      nullif(v_proponente->>'tipo_empresa',''),
      nullif(v_proponente->>'ramo_atuacao',''),
      nullif(v_proponente->>'data_abertura','')::date,
      nullif(v_proponente->>'faturamento_mensal','')::numeric
    );
  end loop;

  for v_imovel in select * from jsonb_array_elements(p_payload->'imoveis') loop
    insert into imoveis (
      proposta_id, tipo, cep, estado, cidade, bairro, logradouro, numero, sem_numero,
      complemento, valor, vagas_garagem, principal, latitude, longitude,
      alugado, valor_aluguel,
      financiado, instituicao_financiadora, saldo_devedor,
      possui_debitos, debitos_iptu, debitos_condominio
    ) values (
      v_proposta_id,
      coalesce((v_imovel->>'tipo')::imovel_tipo, 'apartamento'),
      nullif(v_imovel->>'cep',''),
      nullif(v_imovel->>'estado','')::char(2),
      nullif(v_imovel->>'cidade',''),
      nullif(v_imovel->>'bairro',''),
      nullif(v_imovel->>'logradouro',''),
      nullif(v_imovel->>'numero',''),
      coalesce((v_imovel->>'sem_numero')::boolean, false),
      nullif(v_imovel->>'complemento',''),
      (v_imovel->>'valor')::numeric,
      coalesce((v_imovel->>'vagas_garagem')::int, 0),
      coalesce((v_imovel->>'principal')::boolean, false),
      nullif(v_imovel->>'latitude','')::numeric,
      nullif(v_imovel->>'longitude','')::numeric,
      coalesce((v_imovel->>'alugado')::boolean, false),
      case when coalesce((v_imovel->>'alugado')::boolean, false)
           then nullif(v_imovel->>'valor_aluguel','0')::numeric else null end,
      coalesce((v_imovel->>'financiado')::boolean, false),
      case when coalesce((v_imovel->>'financiado')::boolean, false)
           then nullif(v_imovel->>'instituicao_financiadora','') else null end,
      case when coalesce((v_imovel->>'financiado')::boolean, false)
           then nullif(v_imovel->>'saldo_devedor','0')::numeric else null end,
      coalesce((v_imovel->>'possui_debitos')::boolean, false),
      case when coalesce((v_imovel->>'possui_debitos')::boolean, false)
           then nullif(v_imovel->>'debitos_iptu','0')::numeric else null end,
      case when coalesce((v_imovel->>'possui_debitos')::boolean, false)
           then nullif(v_imovel->>'debitos_condominio','0')::numeric else null end
    );
  end loop;

  -- Magic link de ativação do cliente (validade 30 minutos — limite da constraint).
  v_token := public.gen_magic_token(40);
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into magic_links (token_hash, finalidade, payload, expires_at)
  values (
    v_token_hash,
    'cliente_ativacao',
    jsonb_build_object('proposta_id', v_proposta_id, 'cliente_id', v_cliente_id),
    now() + interval '30 minutes'
  );

  return jsonb_build_object(
    'proposta_id', v_proposta_id,
    'protocolo', v_protocolo,
    'cliente_id', v_cliente_id,
    'magic_token', v_token
  ) || public.enqueue_proposta_criada_email(v_proposta_id, v_token);
end;
$$;

revoke all on function public.partner_create_proposta(jsonb) from public;
grant execute on function public.partner_create_proposta(jsonb) to authenticated;

-- ===============================================================
-- admin_create_proposta(uuid, jsonb)
-- ===============================================================
create or replace function public.admin_create_proposta(
  p_partner_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_partner_status public.partner_status;
  v_pessoa_tipo    pessoa_tipo;
  v_cliente_id     uuid;
  v_proposta_id    uuid;
  v_protocolo      text;
  v_cliente_jsonb  jsonb;
  v_cpf            text;
  v_cnpj           text;
  v_proponente     jsonb;
  v_imovel         jsonb;
  v_token          text;
  v_token_hash     text;
  v_prazo          int;
  v_carencia       int;
  v_valor          numeric;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden: apenas admin pode criar proposta para parceiro'
      using errcode = '42501';
  end if;

  if p_partner_id is null then
    raise exception 'partner_id é obrigatório' using errcode = '22023';
  end if;

  select p.status
    into v_partner_status
    from public.partners p
   where p.id = p_partner_id
   for update;

  if not found then
    raise exception 'partner_not_found' using errcode = 'P0001';
  end if;

  -- Baseline oficial: admin pode criar para parceiro approved OU pending.
  if v_partner_status not in ('approved', 'pending') then
    raise exception 'forbidden: parceiro alvo deve estar pending ou approved'
      using errcode = '42501';
  end if;

  if p_payload->'cliente' is null then
    raise exception 'cliente é obrigatório' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'proponentes', '[]'::jsonb)) = 0 then
    raise exception 'pelo menos um proponente é obrigatório' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'imoveis', '[]'::jsonb)) = 0 then
    raise exception 'pelo menos um imóvel é obrigatório' using errcode = '22023';
  end if;

  -- Validações de negócio (cônjuge PF, PJ total, regra 50%)
  perform public.proposta_payload_validar(p_payload);

  v_prazo := (p_payload->>'prazo_meses')::int;
  v_carencia := coalesce((p_payload->>'carencia_meses')::int, 0);
  v_valor := (p_payload->>'valor_solicitado')::numeric;

  if v_prazo < 12 or v_prazo > 240 then
    raise exception 'prazo_meses fora da faixa permitida (12..240)' using errcode = '22023';
  end if;

  if v_carencia < 0 or v_carencia > 3 then
    raise exception 'carencia_meses fora da faixa permitida (0..3)' using errcode = '22023';
  end if;

  if coalesce(v_valor, 0) <= 0 then
    raise exception 'valor_solicitado inválido' using errcode = '22023';
  end if;

  v_pessoa_tipo   := coalesce((p_payload->>'pessoa_tipo')::pessoa_tipo, 'PF');
  v_cliente_jsonb := p_payload->'cliente';
  v_cpf           := nullif(v_cliente_jsonb->>'cpf', '');
  v_cnpj          := nullif(v_cliente_jsonb->>'cnpj', '');

  if v_pessoa_tipo = 'PF' and v_cpf is not null then
    select c.id into v_cliente_id from public.clientes c
     where c.cpf = v_cpf and c.pessoa_tipo = 'PF' limit 1;
  elsif v_pessoa_tipo = 'PJ' and v_cnpj is not null then
    select c.id into v_cliente_id from public.clientes c
     where c.cnpj = v_cnpj and c.pessoa_tipo = 'PJ' limit 1;
  end if;

  if v_cliente_id is null then
    insert into public.clientes (
      pessoa_tipo, nome_completo, cpf, cnpj, email, telefone, data_nascimento, estado_civil,
      modelo_renda, renda_mensal,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado,
      razao_social, email_responsavel, celular_comercial, tipo_empresa, ramo_atuacao,
      data_abertura, faturamento_mensal
    ) values (
      v_pessoa_tipo,
      coalesce(nullif(v_cliente_jsonb->>'nome_completo',''), nullif(v_cliente_jsonb->>'razao_social',''), 'Cliente'),
      v_cpf, v_cnpj,
      nullif(v_cliente_jsonb->>'email', ''),
      nullif(v_cliente_jsonb->>'telefone', ''),
      nullif(v_cliente_jsonb->>'data_nascimento', '')::date,
      nullif(v_cliente_jsonb->>'estado_civil', '')::estado_civil,
      nullif(v_cliente_jsonb->>'modelo_renda','')::modelo_renda_tipo,
      nullif(v_cliente_jsonb->>'renda_mensal','')::numeric,
      nullif(v_cliente_jsonb->>'endereco_cep',''),
      nullif(v_cliente_jsonb->>'endereco_logradouro',''),
      nullif(v_cliente_jsonb->>'endereco_numero',''),
      nullif(v_cliente_jsonb->>'endereco_complemento',''),
      nullif(v_cliente_jsonb->>'endereco_bairro',''),
      nullif(v_cliente_jsonb->>'endereco_cidade',''),
      nullif(v_cliente_jsonb->>'endereco_estado','')::char(2),
      nullif(v_cliente_jsonb->>'razao_social',''),
      nullif(v_cliente_jsonb->>'email_responsavel',''),
      nullif(v_cliente_jsonb->>'celular_comercial',''),
      nullif(v_cliente_jsonb->>'tipo_empresa',''),
      nullif(v_cliente_jsonb->>'ramo_atuacao',''),
      nullif(v_cliente_jsonb->>'data_abertura','')::date,
      nullif(v_cliente_jsonb->>'faturamento_mensal','')::numeric
    )
    returning id into v_cliente_id;
  else
    update public.clientes set
      email                = coalesce(nullif(v_cliente_jsonb->>'email',''), email),
      telefone             = coalesce(nullif(v_cliente_jsonb->>'telefone',''), telefone),
      estado_civil         = coalesce(nullif(v_cliente_jsonb->>'estado_civil','')::estado_civil, estado_civil),
      modelo_renda         = coalesce(nullif(v_cliente_jsonb->>'modelo_renda','')::modelo_renda_tipo, modelo_renda),
      renda_mensal         = coalesce(nullif(v_cliente_jsonb->>'renda_mensal','')::numeric, renda_mensal),
      endereco_cep         = coalesce(nullif(v_cliente_jsonb->>'endereco_cep',''), endereco_cep),
      endereco_logradouro  = coalesce(nullif(v_cliente_jsonb->>'endereco_logradouro',''), endereco_logradouro),
      endereco_numero      = coalesce(nullif(v_cliente_jsonb->>'endereco_numero',''), endereco_numero),
      endereco_complemento = coalesce(nullif(v_cliente_jsonb->>'endereco_complemento',''), endereco_complemento),
      endereco_bairro      = coalesce(nullif(v_cliente_jsonb->>'endereco_bairro',''), endereco_bairro),
      endereco_cidade      = coalesce(nullif(v_cliente_jsonb->>'endereco_cidade',''), endereco_cidade),
      endereco_estado      = coalesce(nullif(v_cliente_jsonb->>'endereco_estado','')::char(2), endereco_estado),
      razao_social         = coalesce(nullif(v_cliente_jsonb->>'razao_social',''), razao_social),
      email_responsavel    = coalesce(nullif(v_cliente_jsonb->>'email_responsavel',''), email_responsavel),
      celular_comercial    = coalesce(nullif(v_cliente_jsonb->>'celular_comercial',''), celular_comercial),
      tipo_empresa         = coalesce(nullif(v_cliente_jsonb->>'tipo_empresa',''), tipo_empresa),
      ramo_atuacao         = coalesce(nullif(v_cliente_jsonb->>'ramo_atuacao',''), ramo_atuacao),
      data_abertura        = coalesce(nullif(v_cliente_jsonb->>'data_abertura','')::date, data_abertura),
      faturamento_mensal   = coalesce(nullif(v_cliente_jsonb->>'faturamento_mensal','')::numeric, faturamento_mensal)
    where id = v_cliente_id;
  end if;

  insert into public.propostas (
    partner_id, cliente_id, produto, valor_solicitado, prazo_meses, carencia_meses,
    taxa_juros_mensal, correcao, amortizacao, indexador, limite_50_aplicado
  ) values (
    p_partner_id, v_cliente_id,
    (p_payload->>'produto')::produto_tipo,
    v_valor, v_prazo, v_carencia,
    coalesce((p_payload->>'taxa_juros_mensal')::numeric, 1.29),
    coalesce((p_payload->>'correcao')::correcao_tipo, 'pos_fixado'),
    coalesce((p_payload->>'amortizacao')::amortizacao_tipo, 'price'),
    coalesce(p_payload->>'indexador', 'IPCA'),
    coalesce((p_payload->>'limite_50_aplicado')::boolean, false)
  )
  returning id, protocolo into v_proposta_id, v_protocolo;

  for v_proponente in select * from jsonb_array_elements(p_payload->'proponentes') loop
    insert into public.proponentes (
      proposta_id, cliente_id, principal, pessoa_tipo, nome, cpf_cnpj,
      estado_civil, relacao, dados_complementares,
      modelo_renda, renda_mensal,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado,
      razao_social, email_responsavel, celular_comercial, tipo_empresa, ramo_atuacao,
      data_abertura, faturamento_mensal
    ) values (
      v_proposta_id,
      case when coalesce((v_proponente->>'principal')::boolean, false) then v_cliente_id else null end,
      coalesce((v_proponente->>'principal')::boolean, false),
      coalesce((v_proponente->>'pessoa_tipo')::pessoa_tipo, v_pessoa_tipo),
      v_proponente->>'nome',
      nullif(v_proponente->>'cpf_cnpj', ''),
      nullif(v_proponente->>'estado_civil', '')::estado_civil,
      nullif(v_proponente->>'relacao', ''),
      coalesce(v_proponente->'dados_complementares', '{}'::jsonb),
      nullif(v_proponente->>'modelo_renda','')::modelo_renda_tipo,
      nullif(v_proponente->>'renda_mensal','')::numeric,
      nullif(v_proponente->>'endereco_cep',''),
      nullif(v_proponente->>'endereco_logradouro',''),
      nullif(v_proponente->>'endereco_numero',''),
      nullif(v_proponente->>'endereco_complemento',''),
      nullif(v_proponente->>'endereco_bairro',''),
      nullif(v_proponente->>'endereco_cidade',''),
      nullif(v_proponente->>'endereco_estado','')::char(2),
      nullif(v_proponente->>'razao_social',''),
      nullif(v_proponente->>'email_responsavel',''),
      nullif(v_proponente->>'celular_comercial',''),
      nullif(v_proponente->>'tipo_empresa',''),
      nullif(v_proponente->>'ramo_atuacao',''),
      nullif(v_proponente->>'data_abertura','')::date,
      nullif(v_proponente->>'faturamento_mensal','')::numeric
    );
  end loop;

  for v_imovel in select * from jsonb_array_elements(p_payload->'imoveis') loop
    insert into public.imoveis (
      proposta_id, tipo, cep, estado, cidade, bairro, logradouro, numero, sem_numero,
      complemento, valor, vagas_garagem, principal, latitude, longitude,
      alugado, valor_aluguel,
      financiado, instituicao_financiadora, saldo_devedor,
      possui_debitos, debitos_iptu, debitos_condominio
    ) values (
      v_proposta_id,
      coalesce((v_imovel->>'tipo')::imovel_tipo, 'apartamento'),
      nullif(v_imovel->>'cep', ''),
      nullif(v_imovel->>'estado', '')::char(2),
      nullif(v_imovel->>'cidade', ''),
      nullif(v_imovel->>'bairro', ''),
      nullif(v_imovel->>'logradouro', ''),
      nullif(v_imovel->>'numero', ''),
      coalesce((v_imovel->>'sem_numero')::boolean, false),
      nullif(v_imovel->>'complemento', ''),
      (v_imovel->>'valor')::numeric,
      coalesce((v_imovel->>'vagas_garagem')::int, 0),
      coalesce((v_imovel->>'principal')::boolean, false),
      nullif(v_imovel->>'latitude','')::numeric,
      nullif(v_imovel->>'longitude','')::numeric,
      coalesce((v_imovel->>'alugado')::boolean, false),
      case when coalesce((v_imovel->>'alugado')::boolean, false)
           then nullif(v_imovel->>'valor_aluguel', '0')::numeric else null end,
      coalesce((v_imovel->>'financiado')::boolean, false),
      case when coalesce((v_imovel->>'financiado')::boolean, false)
           then nullif(v_imovel->>'instituicao_financiadora', '') else null end,
      case when coalesce((v_imovel->>'financiado')::boolean, false)
           then nullif(v_imovel->>'saldo_devedor', '0')::numeric else null end,
      coalesce((v_imovel->>'possui_debitos')::boolean, false),
      case when coalesce((v_imovel->>'possui_debitos')::boolean, false)
           then nullif(v_imovel->>'debitos_iptu', '0')::numeric else null end,
      case when coalesce((v_imovel->>'possui_debitos')::boolean, false)
           then nullif(v_imovel->>'debitos_condominio', '0')::numeric else null end
    );
  end loop;

  -- Magic link de ativação do cliente (validade 30 minutos — limite da constraint).
  v_token := public.gen_magic_token(40);
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.magic_links (token_hash, finalidade, payload, expires_at)
  values (
    v_token_hash,
    'cliente_ativacao',
    jsonb_build_object('proposta_id', v_proposta_id, 'cliente_id', v_cliente_id),
    now() + interval '30 minutes'
  );

  return jsonb_build_object(
    'proposta_id', v_proposta_id,
    'protocolo', v_protocolo,
    'cliente_id', v_cliente_id,
    'magic_token', v_token
  ) || public.enqueue_proposta_criada_email(v_proposta_id, v_token);
end;
$$;

revoke all on function public.admin_create_proposta(uuid, jsonb) from public;
grant execute on function public.admin_create_proposta(uuid, jsonb) to authenticated;
