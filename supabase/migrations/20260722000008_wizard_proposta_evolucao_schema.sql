-- =============================================
-- MIGRATION — WIZARD NOVA PROPOSTA (evolução Step 2/3): schema aditivo
-- =============================================
-- Aditiva e compatível com propostas legadas (todas as colunas novas são nullable
-- ou possuem default). Não altera migrations anteriores.
--
-- Cobre:
--   Step 2 PF: composição de renda por proponente, modelo/renda do cliente,
--              endereço do cliente e do proponente.
--   Step 2 PJ: razão social, e-mail do responsável, celular comercial, tipo de
--              empresa, ramo de atuação, data de abertura, faturamento mensal.
--   Step 3   : imóvel principal/secundário + geolocalização (mapa) + endereço já
--              suportado pelas colunas existentes de imoveis.
--   Regra 50%: flag persistida em propostas (referência = soma do valor dos imóveis).

-- ---------------------------------------------------------------
-- Enum de composição de renda (modelo de renda)
-- ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'modelo_renda_tipo') then
    create type modelo_renda_tipo as enum (
      'assalariado_clt',
      'empresario',
      'autonomo',
      'aposentado_pensionista',
      'funcionario_publico'
    );
  end if;
end $$;

-- ---------------------------------------------------------------
-- CLIENTES: renda, endereço e dados PJ
-- ---------------------------------------------------------------
alter table public.clientes
  add column if not exists modelo_renda        modelo_renda_tipo,
  add column if not exists renda_mensal         numeric(14,2),
  add column if not exists endereco_cep         text,
  add column if not exists endereco_logradouro  text,
  add column if not exists endereco_numero      text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro      text,
  add column if not exists endereco_cidade      text,
  add column if not exists endereco_estado      char(2),
  add column if not exists razao_social         text,
  add column if not exists email_responsavel    text,
  add column if not exists celular_comercial    text,
  add column if not exists tipo_empresa         text,
  add column if not exists ramo_atuacao         text,
  add column if not exists data_abertura        date,
  add column if not exists faturamento_mensal   numeric(14,2);

-- ---------------------------------------------------------------
-- PROPONENTES: renda, endereço e dados PJ (sócios adicionais)
-- ---------------------------------------------------------------
alter table public.proponentes
  add column if not exists modelo_renda        modelo_renda_tipo,
  add column if not exists renda_mensal         numeric(14,2),
  add column if not exists endereco_cep         text,
  add column if not exists endereco_logradouro  text,
  add column if not exists endereco_numero      text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro      text,
  add column if not exists endereco_cidade      text,
  add column if not exists endereco_estado      char(2),
  add column if not exists razao_social         text,
  add column if not exists email_responsavel    text,
  add column if not exists celular_comercial    text,
  add column if not exists tipo_empresa         text,
  add column if not exists ramo_atuacao         text,
  add column if not exists data_abertura        date,
  add column if not exists faturamento_mensal   numeric(14,2);

-- ---------------------------------------------------------------
-- IMOVEIS: principal/secundário + geolocalização para mapa incorporado
-- ---------------------------------------------------------------
alter table public.imoveis
  add column if not exists principal boolean not null default false,
  add column if not exists latitude  numeric(10,7),
  add column if not exists longitude numeric(10,7);

-- ---------------------------------------------------------------
-- PROPOSTAS: flag da regra de 50% (referência = soma do valor dos imóveis)
-- ---------------------------------------------------------------
alter table public.propostas
  add column if not exists limite_50_aplicado boolean not null default false;

-- ---------------------------------------------------------------
-- Validador de payload (usado pelas RPCs de criação de proposta)
-- Regras:
--   1) PF casado/união estável → cônjuge obrigatório (nome + CPF).
--   2) PJ → obrigatoriedade total do Step 2.
--   3) Regra 50% condicionada ao checkbox limite_50_aplicado.
-- Referência do limite: soma do valor dos imóveis informados no payload.
-- ---------------------------------------------------------------
create or replace function public.proposta_payload_validar(p_payload jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_pessoa_tipo   text    := coalesce(p_payload->>'pessoa_tipo', 'PF');
  v_cliente       jsonb   := coalesce(p_payload->'cliente', '{}'::jsonb);
  v_estado_civil  text    := nullif(v_cliente->>'estado_civil', '');
  v_limite50      boolean := coalesce((p_payload->>'limite_50_aplicado')::boolean, false);
  v_valor         numeric := coalesce((p_payload->>'valor_solicitado')::numeric, 0);
  v_total_imoveis numeric := 0;
  v_has_conjuge   boolean := false;
  v_imovel        jsonb;
  v_prop          jsonb;
begin
  -- 1) PF casado/união estável → cônjuge obrigatório
  if v_pessoa_tipo = 'PF' and v_estado_civil in ('casado', 'uniao_estavel') then
    for v_prop in
      select * from jsonb_array_elements(coalesce(p_payload->'proponentes', '[]'::jsonb))
    loop
      if nullif(v_prop->>'relacao', '') = 'conjuge'
         and length(coalesce(trim(v_prop->>'nome'), '')) > 0
         and length(coalesce(trim(v_prop->>'cpf_cnpj'), '')) > 0 then
        v_has_conjuge := true;
      end if;
    end loop;
    if not v_has_conjuge then
      raise exception 'conjuge_obrigatorio: informe o cônjuge (nome e CPF) para estado civil casado/união estável'
        using errcode = '22023';
    end if;
  end if;

  -- 2) PJ → obrigatoriedade total do Step 2
  if v_pessoa_tipo = 'PJ' then
    if length(coalesce(trim(v_cliente->>'cnpj'), '')) = 0
       or length(coalesce(trim(v_cliente->>'razao_social'), '')) = 0
       or length(coalesce(trim(v_cliente->>'email_responsavel'), '')) = 0
       or length(coalesce(trim(v_cliente->>'celular_comercial'), '')) = 0
       or length(coalesce(trim(v_cliente->>'tipo_empresa'), '')) = 0
       or length(coalesce(trim(v_cliente->>'ramo_atuacao'), '')) = 0
       or length(coalesce(trim(v_cliente->>'data_abertura'), '')) = 0
       or coalesce((v_cliente->>'faturamento_mensal')::numeric, 0) <= 0 then
      raise exception 'pj_campos_obrigatorios: CNPJ, razão social, e-mail do responsável, celular comercial, tipo de empresa, ramo de atuação, data de abertura e faturamento mensal são obrigatórios'
        using errcode = '22023';
    end if;
  end if;

  -- 3) Regra 50% condicionada ao checkbox
  if v_limite50 then
    for v_imovel in
      select * from jsonb_array_elements(coalesce(p_payload->'imoveis', '[]'::jsonb))
    loop
      v_total_imoveis := v_total_imoveis + coalesce((v_imovel->>'valor')::numeric, 0);
    end loop;

    if v_total_imoveis <= 0 then
      raise exception 'limite_50_sem_referencia: informe o valor dos imóveis para aplicar o limite de 50%%'
        using errcode = '22023';
    end if;

    if v_valor > (v_total_imoveis * 0.5) then
      raise exception 'limite_50_excedido: valor solicitado (%) excede 50%% do valor de referência dos imóveis (%)',
        v_valor, v_total_imoveis
        using errcode = '22023';
    end if;
  end if;
end;
$$;

revoke all on function public.proposta_payload_validar(jsonb) from public;
grant execute on function public.proposta_payload_validar(jsonb) to authenticated;
