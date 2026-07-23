-- =============================================
-- SMOKE TEST — WIZARD NOVA PROPOSTA (Step 2/3 + validações)
-- =============================================
-- Uso: node runner ou psql -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-26-wizard-proposta.sql
-- Transação reversível (rollback ao final). Cobre:
--   1) proposta_payload_validar: cônjuge PF casado obrigatório;
--   2) proposta_payload_validar: PJ obrigatoriedade total;
--   3) proposta_payload_validar: regra 50% (bloqueio e liberação);
--   4) admin_create_proposta persiste novos campos (renda, endereço, PJ, imóvel principal).

begin;

do $$
declare
  v_admin_uid   uuid := gen_random_uuid();
  v_partner_uid uuid := gen_random_uuid();
  v_partner     uuid;
  v_payload     jsonb;
  v_res         jsonb;
  v_prop        uuid;
  v_cli         uuid;
  v_ok          boolean;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_uid,   'wizard.smoke.admin.'   || replace(v_admin_uid::text,   '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role','admin'), now(), now()),
    (v_partner_uid, 'wizard.smoke.partner.' || replace(v_partner_uid::text, '-', '') || '@test.local', '{}'::jsonb, '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin',   nome_completo = 'Wizard Admin'   where id = v_admin_uid;
  update public.usuarios set role = 'partner', nome_completo = 'Wizard Partner' where id = v_partner_uid;

  insert into public.partners (usuario_id, status)
  values (v_partner_uid, 'approved')
  returning id into v_partner;

  -- Claims de admin para chamar admin_create_proposta
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_uid::text, 'app_metadata', json_build_object('role','admin'))::text,
    true
  );

  -- ---------------------------------------------------------------
  -- 1) PF casado sem cônjuge → deve falhar
  -- ---------------------------------------------------------------
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PF',
    'valor_solicitado', 300000, 'prazo_meses', 120, 'carencia_meses', 0,
    'cliente', jsonb_build_object('nome_completo','Fulano PF','cpf','39053344705','estado_civil','casado'),
    'proponentes', jsonb_build_array(jsonb_build_object('nome','Fulano PF','cpf_cnpj','39053344705','principal',true)),
    'imoveis', jsonb_build_array(jsonb_build_object('tipo','apartamento','valor',800000))
  );
  begin
    perform public.admin_create_proposta(v_partner, v_payload);
    raise exception 'FASE 26 FAIL: PF casado sem cônjuge deveria falhar';
  exception when others then
    if sqlerrm not like 'conjuge_obrigatorio%' then
      raise exception 'FASE 26 FAIL: esperado conjuge_obrigatorio, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- 2) PJ incompleto → deve falhar
  -- ---------------------------------------------------------------
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PJ',
    'valor_solicitado', 300000, 'prazo_meses', 120, 'carencia_meses', 0,
    'cliente', jsonb_build_object('cnpj','11222333000181','razao_social','Empresa X'),
    'proponentes', jsonb_build_array(jsonb_build_object('nome','Empresa X','cpf_cnpj','11222333000181','principal',true,'pessoa_tipo','PJ')),
    'imoveis', jsonb_build_array(jsonb_build_object('tipo','comercial','valor',900000))
  );
  begin
    perform public.admin_create_proposta(v_partner, v_payload);
    raise exception 'FASE 26 FAIL: PJ incompleto deveria falhar';
  exception when others then
    if sqlerrm not like 'pj_campos_obrigatorios%' then
      raise exception 'FASE 26 FAIL: esperado pj_campos_obrigatorios, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- 3) Regra 50% — bloqueio (valor > 50% da soma dos imóveis)
  -- ---------------------------------------------------------------
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PF','limite_50_aplicado', true,
    'valor_solicitado', 500000, 'prazo_meses', 120, 'carencia_meses', 0,
    'cliente', jsonb_build_object('nome_completo','Solteiro PF','cpf','39053344705','estado_civil','solteiro'),
    'proponentes', jsonb_build_array(jsonb_build_object('nome','Solteiro PF','cpf_cnpj','39053344705','principal',true)),
    'imoveis', jsonb_build_array(jsonb_build_object('tipo','apartamento','valor',800000))
  );
  begin
    perform public.admin_create_proposta(v_partner, v_payload);
    raise exception 'FASE 26 FAIL: regra 50%% deveria bloquear (500k > 50%% de 800k)';
  exception when others then
    if sqlerrm not like 'limite_50_excedido%' then
      raise exception 'FASE 26 FAIL: esperado limite_50_excedido, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- 4) Criação feliz com novos campos (PF solteiro, 50% ok)
  -- ---------------------------------------------------------------
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PF','limite_50_aplicado', true,
    'valor_solicitado', 300000, 'prazo_meses', 120, 'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'cliente', jsonb_build_object(
      'nome_completo','Cliente Feliz','cpf','39053344705','estado_civil','solteiro',
      'modelo_renda','assalariado_clt','renda_mensal', 15000,
      'endereco_cep','01310100','endereco_logradouro','Av Paulista','endereco_numero','1000',
      'endereco_bairro','Bela Vista','endereco_cidade','São Paulo','endereco_estado','SP'
    ),
    'proponentes', jsonb_build_array(jsonb_build_object(
      'nome','Cliente Feliz','cpf_cnpj','39053344705','principal',true,
      'modelo_renda','assalariado_clt','renda_mensal',15000,
      'endereco_cep','01310100','endereco_cidade','São Paulo','endereco_estado','SP'
    )),
    'imoveis', jsonb_build_array(jsonb_build_object(
      'tipo','apartamento','valor',800000,'principal',true,
      'cep','01310100','estado','SP','cidade','São Paulo','bairro','Bela Vista',
      'logradouro','Av Paulista','numero','1000','latitude',-23.5613,'longitude',-46.6559
    ))
  );
  v_res := public.admin_create_proposta(v_partner, v_payload);
  v_prop := (v_res->>'proposta_id')::uuid;
  v_cli  := (v_res->>'cliente_id')::uuid;

  if v_prop is null then
    raise exception 'FASE 26 FAIL: criação feliz não retornou proposta_id';
  end if;

  -- proposta com flag 50%
  select limite_50_aplicado into v_ok from public.propostas where id = v_prop;
  if not v_ok then raise exception 'FASE 26 FAIL: limite_50_aplicado não persistiu'; end if;

  -- cliente com renda + endereço
  if not exists (
    select 1 from public.clientes
     where id = v_cli
       and modelo_renda = 'assalariado_clt'
       and renda_mensal = 15000
       and endereco_cidade = 'São Paulo'
  ) then
    raise exception 'FASE 26 FAIL: campos de renda/endereço do cliente não persistiram';
  end if;

  -- imóvel principal + geoloc
  if not exists (
    select 1 from public.imoveis
     where proposta_id = v_prop
       and principal = true
       and latitude is not null
       and longitude is not null
  ) then
    raise exception 'FASE 26 FAIL: imóvel principal/geolocalização não persistiu';
  end if;

  raise notice '✓ FASE 26 SMOKE: OK — validações (cônjuge/PJ/50%%) e persistência de novos campos';
end $$;

rollback;
