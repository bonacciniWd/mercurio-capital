-- =============================================
-- MIGRATION — Co-proponente: composição de renda mínima (Sim/Não)
-- =============================================
-- Aditiva e compatível com propostas legadas (coluna nullable; propostas antigas
-- permanecem válidas sem a flag).
--
-- Regra: todo co-proponente (principal = false) deve responder se compõe a renda
-- mínima da proposta. Se sim, renda mensal do co-proponente é obrigatória.

-- ---------------------------------------------------------------
-- Coluna de composição de renda por proponente
-- ---------------------------------------------------------------
alter table public.proponentes
  add column if not exists compoe_renda boolean;

-- ---------------------------------------------------------------
-- Validador de payload: adiciona regra de co-proponente (compoe_renda)
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
end;
$$;

revoke all on function public.proposta_payload_validar(jsonb) from public;
grant execute on function public.proposta_payload_validar(jsonb) to authenticated;

-- ---------------------------------------------------------------
-- RPCs: injeta compoe_renda no INSERT de proponentes preservando o corpo vigente.
-- (O corpo é dollar-quoted; substituição verbatim é determinística.)
-- ---------------------------------------------------------------
do $$
declare
  v_def text;
begin
  -- partner_create_proposta(jsonb)
  v_def := pg_get_functiondef('public.partner_create_proposta(jsonb)'::regprocedure);
  v_def := replace(
    v_def,
    'estado_civil, relacao, dados_complementares,',
    'estado_civil, relacao, dados_complementares, compoe_renda,'
  );
  v_def := replace(
    v_def,
    $q$coalesce(v_proponente->'dados_complementares','{}'::jsonb),$q$,
    $q$coalesce(v_proponente->'dados_complementares','{}'::jsonb),
      nullif(v_proponente->>'compoe_renda','')::boolean,$q$
  );
  execute v_def;

  -- admin_create_proposta(uuid, jsonb)
  v_def := pg_get_functiondef('public.admin_create_proposta(uuid,jsonb)'::regprocedure);
  v_def := replace(
    v_def,
    'estado_civil, relacao, dados_complementares,',
    'estado_civil, relacao, dados_complementares, compoe_renda,'
  );
  v_def := replace(
    v_def,
    $q$coalesce(v_proponente->'dados_complementares', '{}'::jsonb),$q$,
    $q$coalesce(v_proponente->'dados_complementares', '{}'::jsonb),
      nullif(v_proponente->>'compoe_renda','')::boolean,$q$
  );
  execute v_def;
end $$;
