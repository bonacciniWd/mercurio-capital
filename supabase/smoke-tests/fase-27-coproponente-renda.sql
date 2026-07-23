-- =============================================
-- SMOKE TEST — Co-proponente: composição de renda mínima
-- =============================================
-- Transação reversível (rollback ao final). Cobre:
--   1) co-proponente sem compoe_renda → bloqueia (compoe_renda_obrigatorio);
--   2) co-proponente compoe_renda=true sem renda → bloqueia (renda_coproponente_obrigatoria);
--   3) co-proponente compoe_renda=true com renda → cria e persiste;
--   4) co-proponente compoe_renda=false → cria sem exigir renda.

begin;

do $$
declare
  v_admin_uid   uuid := gen_random_uuid();
  v_partner_uid uuid := gen_random_uuid();
  v_partner     uuid;
  v_payload     jsonb;
  v_res         jsonb;
  v_prop        uuid;
  v_cnt         int;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_uid,   'crenda.admin.'   || replace(v_admin_uid::text,   '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role','admin'), now(), now()),
    (v_partner_uid, 'crenda.partner.' || replace(v_partner_uid::text, '-', '') || '@test.local', '{}'::jsonb, '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin',   nome_completo = 'CRenda Admin'   where id = v_admin_uid;
  update public.usuarios set role = 'partner', nome_completo = 'CRenda Partner' where id = v_partner_uid;

  insert into public.partners (usuario_id, status) values (v_partner_uid, 'approved') returning id into v_partner;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_uid::text, 'app_metadata', json_build_object('role','admin'))::text,
    true
  );

  -- base: PF solteiro (sem cônjuge obrigatório) + 1 co-proponente "socio"
  -- 1) co-proponente sem compoe_renda → erro
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PF',
    'valor_solicitado', 300000, 'prazo_meses', 120, 'carencia_meses', 0,
    'cliente', jsonb_build_object('nome_completo','Titular','cpf','39053344705','estado_civil','solteiro'),
    'proponentes', jsonb_build_array(
      jsonb_build_object('nome','Titular','cpf_cnpj','39053344705','principal',true),
      jsonb_build_object('nome','Socio X','cpf_cnpj','11144477735','principal',false,'relacao','socio')
    ),
    'imoveis', jsonb_build_array(jsonb_build_object('tipo','apartamento','valor',800000))
  );
  begin
    perform public.admin_create_proposta(v_partner, v_payload);
    raise exception 'FASE 27 FAIL: co-proponente sem compoe_renda deveria bloquear';
  exception when others then
    if sqlerrm not like 'compoe_renda_obrigatorio%' then
      raise exception 'FASE 27 FAIL: esperado compoe_renda_obrigatorio, obtido %', sqlerrm;
    end if;
  end;

  -- 2) compoe_renda=true sem renda → erro
  v_payload := jsonb_set(v_payload, '{proponentes,1,compoe_renda}', 'true'::jsonb);
  begin
    perform public.admin_create_proposta(v_partner, v_payload);
    raise exception 'FASE 27 FAIL: compoe_renda=true sem renda deveria bloquear';
  exception when others then
    if sqlerrm not like 'renda_coproponente_obrigatoria%' then
      raise exception 'FASE 27 FAIL: esperado renda_coproponente_obrigatoria, obtido %', sqlerrm;
    end if;
  end;

  -- 3) compoe_renda=true com renda → cria e persiste
  v_payload := jsonb_set(v_payload, '{proponentes,1,renda_mensal}', '9000'::jsonb);
  v_res := public.admin_create_proposta(v_partner, v_payload);
  v_prop := (v_res->>'proposta_id')::uuid;
  select count(*) into v_cnt from public.proponentes
   where proposta_id = v_prop and principal = false and compoe_renda = true and renda_mensal = 9000;
  if v_cnt <> 1 then
    raise exception 'FASE 27 FAIL: co-proponente compoe_renda=true/renda não persistiu (cnt=%)', v_cnt;
  end if;

  -- 4) compoe_renda=false → cria sem exigir renda
  v_payload := jsonb_build_object(
    'produto','home_equity','pessoa_tipo','PF',
    'valor_solicitado', 300000, 'prazo_meses', 120, 'carencia_meses', 0,
    'cliente', jsonb_build_object('nome_completo','Titular 2','cpf','39053344705','estado_civil','solteiro'),
    'proponentes', jsonb_build_array(
      jsonb_build_object('nome','Titular 2','cpf_cnpj','39053344705','principal',true),
      jsonb_build_object('nome','Outro Y','cpf_cnpj','11144477735','principal',false,'relacao','outro','compoe_renda',false)
    ),
    'imoveis', jsonb_build_array(jsonb_build_object('tipo','apartamento','valor',800000))
  );
  v_res := public.admin_create_proposta(v_partner, v_payload);
  v_prop := (v_res->>'proposta_id')::uuid;
  select count(*) into v_cnt from public.proponentes
   where proposta_id = v_prop and principal = false and compoe_renda = false;
  if v_cnt <> 1 then
    raise exception 'FASE 27 FAIL: co-proponente compoe_renda=false não persistiu (cnt=%)', v_cnt;
  end if;

  raise notice '✓ FASE 27 SMOKE: OK — compoe_renda obrigatório + renda condicional + persistência';
end $$;

rollback;
