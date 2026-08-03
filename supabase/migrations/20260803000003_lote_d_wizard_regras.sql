-- =============================================
-- MIGRATION — LOTE D (WIZARD STEPS 2/3/4/5)
-- =============================================
-- Aditiva; não altera RLS.
--   Replica no backend a validação de LTV máximo por tipo de imóvel do Step 3
--   do wizard (apartamento 60%, casa 50%, comercial 40%, terreno 30%, vaga 60%),
--   usando o teto mais restritivo entre os imóveis informados no payload.
--   Mantém as regras já existentes de proposta_payload_validar (cônjuge, PJ,
--   limite 50%, composição de renda do co-proponente).

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
  v_ltv_max       numeric;
  v_imovel        jsonb;
  v_prop          jsonb;
begin
  -- 0) Total do valor dos imóveis (usado nas regras 3 e 5)
  for v_imovel in
    select * from jsonb_array_elements(coalesce(p_payload->'imoveis', '[]'::jsonb))
  loop
    v_total_imoveis := v_total_imoveis + coalesce((v_imovel->>'valor')::numeric, 0);
  end loop;

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

  -- 4) Co-proponente: composição de renda mínima (Sim/Não) obrigatória.
  --    Se compõe, a renda mensal do co-proponente é obrigatória.
  for v_prop in
    select * from jsonb_array_elements(coalesce(p_payload->'proponentes', '[]'::jsonb))
  loop
    if not coalesce((v_prop->>'principal')::boolean, false) then
      if nullif(v_prop->>'compoe_renda', '') is null then
        raise exception 'compoe_renda_obrigatorio: informe se o co-proponente compõe a renda mínima da proposta'
          using errcode = '22023';
      end if;
      if (v_prop->>'compoe_renda')::boolean
         and coalesce((v_prop->>'renda_mensal')::numeric, 0) <= 0 then
        raise exception 'renda_coproponente_obrigatoria: co-proponente que compõe a renda mínima deve informar a renda mensal'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  -- 5) LTV máximo por tipo de imóvel — usa o teto mais restritivo entre os
  --    imóveis informados. apartamento 60% · casa 50% · comercial 40% ·
  --    terreno 30% · vaga 60%. Regra independente do checkbox de limite 50%.
  v_ltv_max := null;
  for v_imovel in
    select * from jsonb_array_elements(coalesce(p_payload->'imoveis', '[]'::jsonb))
  loop
    declare
      v_cap numeric := case nullif(v_imovel->>'tipo', '')
        when 'apartamento' then 0.60
        when 'casa'        then 0.50
        when 'comercial'   then 0.40
        when 'terreno'     then 0.30
        when 'vaga'        then 0.60
        else null
      end;
    begin
      if v_cap is not null and (v_ltv_max is null or v_cap < v_ltv_max) then
        v_ltv_max := v_cap;
      end if;
    end;
  end loop;

  if v_ltv_max is not null and v_total_imoveis > 0 and v_valor > 0
     and v_valor > (v_total_imoveis * v_ltv_max) then
    raise exception 'ltv_maximo_excedido: valor solicitado (%) excede o LTV máximo (%) permitido para o tipo de imóvel informado (valor total dos imóveis: %)',
      v_valor, v_ltv_max, v_total_imoveis
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.proposta_payload_validar(jsonb) from public;
grant execute on function public.proposta_payload_validar(jsonb) to authenticated;
