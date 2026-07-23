-- =============================================
-- SMOKE TEST — Permissão de criação de proposta por admin_nivel
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-28-admin-nivel-proposta-permissao.sql
-- Transação reversível (rollback ao final). Cobre:
--   1) admin FULL cria proposta (admin_create_proposta) OK;
--   2) admin LIMITADO cria proposta OK;
--   3) admin JURIDICO recebe forbidden em admin_create_proposta;
--   4) LIMITADO e JURIDICO conseguem LER propostas (leitura preservada);
--   5) app_is_admin_operacional coerente por nível.

begin;

do $$
declare
  v_admin_full_uid uuid := gen_random_uuid();
  v_admin_lim_uid  uuid := gen_random_uuid();
  v_admin_jur_uid  uuid := gen_random_uuid();
  v_partner_uid    uuid := gen_random_uuid();
  v_partner        uuid;
  v_payload        jsonb;
  v_res            jsonb;
  v_cnt            int;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_full_uid, 'permprop.full.' || replace(v_admin_full_uid::text, '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role','admin','admin_nivel','full'),     now(), now()),
    (v_admin_lim_uid,  'permprop.lim.'  || replace(v_admin_lim_uid::text,  '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role','admin','admin_nivel','limitado'), now(), now()),
    (v_admin_jur_uid,  'permprop.jur.'  || replace(v_admin_jur_uid::text,  '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role','admin','admin_nivel','juridico'), now(), now()),
    (v_partner_uid,    'permprop.part.' || replace(v_partner_uid::text,    '-', '') || '@test.local', '{}'::jsonb, '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin',   nome_completo = 'PermProp Full'     where id = v_admin_full_uid;
  update public.usuarios set role = 'admin',   nome_completo = 'PermProp Limitado'  where id = v_admin_lim_uid;
  update public.usuarios set role = 'admin',   nome_completo = 'PermProp Juridico'  where id = v_admin_jur_uid;
  update public.usuarios set role = 'partner', nome_completo = 'PermProp Partner'   where id = v_partner_uid;

  insert into public.partners (usuario_id, status) values (v_partner_uid, 'approved') returning id into v_partner;

  -- Payload PF solteiro válido (1 proponente principal, 1 imóvel).
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PF',
    'valor_solicitado', 300000, 'prazo_meses', 120, 'carencia_meses', 0,
    'cliente', jsonb_build_object('nome_completo','Titular Perm','cpf','39053344705','estado_civil','solteiro'),
    'proponentes', jsonb_build_array(
      jsonb_build_object('nome','Titular Perm','cpf_cnpj','39053344705','principal',true)
    ),
    'imoveis', jsonb_build_array(jsonb_build_object('tipo','apartamento','valor',800000))
  );

  -- ---------------------------------------------------------------
  -- 1) admin FULL cria proposta OK
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_full_uid::text, 'app_metadata', json_build_object('role','admin','admin_nivel','full'))::text,
    true
  );
  v_res := public.admin_create_proposta(v_partner, v_payload);
  if v_res is null or (v_res->>'proposta_id') is null then
    raise exception 'FASE 28 FAIL: admin FULL deveria criar proposta';
  end if;

  -- ---------------------------------------------------------------
  -- 2) admin LIMITADO cria proposta OK
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_lim_uid::text, 'app_metadata', json_build_object('role','admin','admin_nivel','limitado'))::text,
    true
  );
  if not public.app_is_admin_operacional() then
    raise exception 'FASE 28 FAIL: admin limitado deveria ser operacional';
  end if;
  v_res := public.admin_create_proposta(v_partner, v_payload);
  if v_res is null or (v_res->>'proposta_id') is null then
    raise exception 'FASE 28 FAIL: admin LIMITADO deveria criar proposta';
  end if;

  -- ---------------------------------------------------------------
  -- 3) admin JURIDICO recebe forbidden em admin_create_proposta
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_jur_uid::text, 'app_metadata', json_build_object('role','admin','admin_nivel','juridico'))::text,
    true
  );
  if public.app_is_admin_operacional() then
    raise exception 'FASE 28 FAIL: admin juridico NAO deveria ser operacional';
  end if;
  begin
    perform public.admin_create_proposta(v_partner, v_payload);
    raise exception 'FASE 28 FAIL: admin JURIDICO nao deveria criar proposta';
  exception when others then
    if sqlerrm not like 'forbidden%' then
      raise exception 'FASE 28 FAIL: esperado forbidden para juridico em admin_create_proposta, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- 4) LIMITADO e JURIDICO conseguem LER propostas (leitura preservada)
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_lim_uid::text, 'app_metadata', json_build_object('role','admin','admin_nivel','limitado'))::text,
    true
  );
  set local role authenticated;
  select count(*) into v_cnt from public.propostas where partner_id = v_partner;
  reset role;
  if v_cnt < 2 then
    raise exception 'FASE 28 FAIL: admin limitado deveria ler >=2 propostas, obteve %', v_cnt;
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_jur_uid::text, 'app_metadata', json_build_object('role','admin','admin_nivel','juridico'))::text,
    true
  );
  set local role authenticated;
  select count(*) into v_cnt from public.propostas where partner_id = v_partner;
  reset role;
  if v_cnt < 2 then
    raise exception 'FASE 28 FAIL: admin juridico deveria ler >=2 propostas, obteve %', v_cnt;
  end if;

  raise notice 'FASE 28 OK: criacao restrita a operacional (full/limitado), juridico forbidden, leitura preservada.';
end $$;

rollback;
