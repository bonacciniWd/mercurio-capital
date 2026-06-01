-- =============================================
-- FIX: partner_create_proposta — magic_link com validade de 30 minutos
-- (constraint magic_links_expire_em_30min exige <= 30min)
-- =============================================

create or replace function public.partner_create_proposta(p_payload jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  v_partner_id    uuid;
  v_role          text;
  v_cliente_id    uuid;
  v_proposta_id   uuid;
  v_protocolo     text;
  v_cliente_jsonb jsonb;
  v_cpf           text;
  v_proponente    jsonb;
  v_principal_id  uuid;
  v_imovel        jsonb;
  v_imovel_id     uuid;
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

  v_cliente_jsonb := p_payload->'cliente';
  v_cpf := nullif(v_cliente_jsonb->>'cpf','');

  if v_cpf is not null then
    select id into v_cliente_id from clientes where cpf = v_cpf and pessoa_tipo = 'PF' limit 1;
  end if;

  if v_cliente_id is null then
    insert into clientes (
      pessoa_tipo, nome_completo, cpf, email, telefone, data_nascimento, estado_civil
    ) values (
      coalesce((p_payload->>'pessoa_tipo')::pessoa_tipo, 'PF'),
      v_cliente_jsonb->>'nome_completo',
      v_cpf,
      nullif(v_cliente_jsonb->>'email',''),
      nullif(v_cliente_jsonb->>'telefone',''),
      nullif(v_cliente_jsonb->>'data_nascimento','')::date,
      nullif(v_cliente_jsonb->>'estado_civil','')::estado_civil
    ) returning id into v_cliente_id;
  end if;

  insert into propostas (
    partner_id, cliente_id, produto, valor_solicitado, prazo_meses, carencia_meses,
    taxa_juros_mensal, correcao, amortizacao, indexador
  ) values (
    v_partner_id, v_cliente_id,
    (p_payload->>'produto')::produto_tipo,
    (p_payload->>'valor_solicitado')::numeric,
    (p_payload->>'prazo_meses')::int,
    coalesce((p_payload->>'carencia_meses')::int, 0),
    coalesce((p_payload->>'taxa_juros_mensal')::numeric, 1.39),
    coalesce((p_payload->>'correcao')::correcao_tipo, 'pos_fixado'),
    coalesce((p_payload->>'amortizacao')::amortizacao_tipo, 'price'),
    coalesce(p_payload->>'indexador', 'IPCA')
  ) returning id, protocolo into v_proposta_id, v_protocolo;

  for v_proponente in select * from jsonb_array_elements(p_payload->'proponentes') loop
    insert into proponentes (
      proposta_id, cliente_id, principal, pessoa_tipo, nome, cpf_cnpj,
      estado_civil, relacao, dados_complementares
    ) values (
      v_proposta_id,
      case when coalesce((v_proponente->>'principal')::boolean, false) then v_cliente_id else null end,
      coalesce((v_proponente->>'principal')::boolean, false),
      coalesce((v_proponente->>'pessoa_tipo')::pessoa_tipo, 'PF'),
      v_proponente->>'nome',
      nullif(v_proponente->>'cpf_cnpj',''),
      nullif(v_proponente->>'estado_civil','')::estado_civil,
      nullif(v_proponente->>'relacao',''),
      coalesce(v_proponente->'dados_complementares','{}'::jsonb)
    ) returning id into v_principal_id;
  end loop;

  for v_imovel in select * from jsonb_array_elements(p_payload->'imoveis') loop
    insert into imoveis (
      proposta_id, tipo, cep, estado, cidade, bairro, logradouro, numero, sem_numero,
      complemento, valor, vagas_garagem,
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
    ) returning id into v_imovel_id;
  end loop;

  -- Magic link de ativação do cliente (validade 30 minutos — limite da constraint).
  -- O parceiro pode reemitir o link na página da proposta a qualquer momento.
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
  );
end;
$$;

revoke all on function public.partner_create_proposta(jsonb) from public;
grant execute on function public.partner_create_proposta(jsonb) to authenticated;
