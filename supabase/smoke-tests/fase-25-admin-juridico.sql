-- =============================================
-- SMOKE TEST — ADMIN JURIDICO (upload-only modelo)
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-25-admin-juridico.sql
-- Transacao reversivel (rollback ao final).
-- Cobre:
--   1) helpers admin_nivel (operacional vs juridico);
--   2) juridico pode adicionar modelo e nao pode remover;
--   3) juridico bloqueado em RPCs operacionais;
--   4) admin operacional remove modelo com sucesso;
--   5) admin_set_admin_nivel aceita o valor juridico.

begin;

do $$
declare
  v_admin_full_uid uuid := gen_random_uuid();
  v_admin_oper_uid uuid := gen_random_uuid();
  v_admin_jur_uid  uuid := gen_random_uuid();
  v_partner_uid    uuid := gen_random_uuid();
  v_client_uid     uuid := gen_random_uuid();
  v_partner        uuid;
  v_cliente        uuid;
  v_prop           uuid;
  v_modelo         uuid;
  v_rand           uuid := gen_random_uuid();
  v_is_admin       boolean;
  v_is_full        boolean;
  v_is_oper        boolean;
  v_is_jur         boolean;
  v_cnt            int;
begin
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_full_uid, 'juridico.smoke.admin.full.' || replace(v_admin_full_uid::text, '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role', 'admin', 'admin_nivel', 'full'), now(), now()),
    (v_admin_oper_uid, 'juridico.smoke.admin.oper.' || replace(v_admin_oper_uid::text, '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role', 'admin', 'admin_nivel', 'limitado'), now(), now()),
    (v_admin_jur_uid,  'juridico.smoke.admin.jur.'  || replace(v_admin_jur_uid::text,  '-', '') || '@test.local', '{}'::jsonb, jsonb_build_object('role', 'admin', 'admin_nivel', 'juridico'), now(), now()),
    (v_partner_uid,    'juridico.smoke.partner.'    || replace(v_partner_uid::text,    '-', '') || '@test.local', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_client_uid,     'juridico.smoke.client.'     || replace(v_client_uid::text,     '-', '') || '@test.local', '{}'::jsonb, '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin', nome_completo = 'Admin Full Smoke' where id = v_admin_full_uid;
  update public.usuarios set role = 'admin', nome_completo = 'Admin Operacional Smoke' where id = v_admin_oper_uid;
  update public.usuarios set role = 'admin', nome_completo = 'Admin Juridico Smoke' where id = v_admin_jur_uid;
  update public.usuarios set role = 'partner', nome_completo = 'Partner Smoke' where id = v_partner_uid;
  update public.usuarios set role = 'client', nome_completo = 'Client Smoke' where id = v_client_uid;

  insert into public.partners (usuario_id, status)
  values (v_partner_uid, 'approved')
  returning id into v_partner;

  insert into public.clientes (pessoa_tipo, nome_completo, usuario_id)
  values ('PF', 'Cliente Juridico Smoke', v_client_uid)
  returning id into v_cliente;

  insert into public.propostas (partner_id, cliente_id, produto, valor_solicitado, prazo_meses)
  values (v_partner, v_cliente, 'home_equity', 150000, 36)
  returning id into v_prop;

  -- ---------------------------------------------------------------
  -- admin_set_admin_nivel aceita juridico
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_full_uid::text, 'app_metadata', json_build_object('role', 'admin', 'admin_nivel', 'full'))::text,
    true
  );

  perform public.admin_set_admin_nivel(v_admin_oper_uid, 'juridico');

  if (select raw_app_meta_data ->> 'admin_nivel' from auth.users where id = v_admin_oper_uid) <> 'juridico' then
    raise exception 'FASE 25 FAIL: admin_set_admin_nivel nao gravou juridico';
  end if;

  -- ---------------------------------------------------------------
  -- helper: admin operacional (limitado) = operacional true
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_oper_uid::text, 'app_metadata', json_build_object('role', 'admin', 'admin_nivel', 'limitado'))::text,
    true
  );

  select public.app_is_admin(), public.app_is_admin_full(), public.app_is_admin_operacional(), public.app_is_admin_juridico()
    into v_is_admin, v_is_full, v_is_oper, v_is_jur;

  if not v_is_admin then raise exception 'FASE 25 FAIL: admin operacional deveria ter app_is_admin()=true'; end if;
  if v_is_full then raise exception 'FASE 25 FAIL: admin operacional nao deve ser full'; end if;
  if not v_is_oper then raise exception 'FASE 25 FAIL: admin operacional deveria ter app_is_admin_operacional()=true'; end if;
  if v_is_jur then raise exception 'FASE 25 FAIL: admin operacional nao deve ter app_is_admin_juridico()=true'; end if;

  -- ---------------------------------------------------------------
  -- helper: admin juridico = juridico true e operacional false
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_jur_uid::text, 'app_metadata', json_build_object('role', 'admin', 'admin_nivel', 'juridico'))::text,
    true
  );

  select public.app_is_admin(), public.app_is_admin_full(), public.app_is_admin_operacional(), public.app_is_admin_juridico()
    into v_is_admin, v_is_full, v_is_oper, v_is_jur;

  if not v_is_admin then raise exception 'FASE 25 FAIL: admin juridico deveria ter app_is_admin()=true'; end if;
  if v_is_full then raise exception 'FASE 25 FAIL: admin juridico nao deve ser full'; end if;
  if v_is_oper then raise exception 'FASE 25 FAIL: admin juridico nao deve ser operacional'; end if;
  if not v_is_jur then raise exception 'FASE 25 FAIL: admin juridico deveria ter app_is_admin_juridico()=true'; end if;

  -- juridico adiciona modelo
  v_modelo := public.proposta_contrato_modelo_add(v_prop, v_prop::text || '/modelos/juridico-smoke.pdf', 'juridico-smoke.pdf');
  if v_modelo is null then
    raise exception 'FASE 25 FAIL: juridico nao conseguiu adicionar modelo';
  end if;

  set local role authenticated;
  select count(*) into v_cnt from public.proposta_contrato_modelos where proposta_id = v_prop;
  reset role;
  if v_cnt <> 1 then
    raise exception 'FASE 25 FAIL: juridico deveria enxergar 1 modelo, obteve %', v_cnt;
  end if;

  -- juridico nao remove modelo
  begin
    perform public.proposta_contrato_modelo_remove(v_modelo);
    raise exception 'FASE 25 FAIL: juridico nao deveria remover modelo';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 25 FAIL: esperado forbidden para juridico em remove, obtido %', sqlerrm;
    end if;
  end;

  -- juridico bloqueado em escrita operacional
  begin
    perform public.admin_set_proposta_status(v_rand, 'pre_analise'::proposta_status);
    raise exception 'FASE 25 FAIL: juridico nao deveria alterar status';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 25 FAIL: esperado forbidden para juridico em status, obtido %', sqlerrm;
    end if;
  end;

  begin
    perform public.admin_proposta_fundo_set(v_prop, gen_random_uuid(), 'aguardando', null);
    raise exception 'FASE 25 FAIL: juridico nao deveria atribuir fundo';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 25 FAIL: esperado forbidden para juridico em fundo, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- admin operacional remove modelo com sucesso
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_oper_uid::text, 'app_metadata', json_build_object('role', 'admin', 'admin_nivel', 'limitado'))::text,
    true
  );

  perform public.proposta_contrato_modelo_remove(v_modelo);

  if exists (select 1 from public.proposta_contrato_modelos where id = v_modelo) then
    raise exception 'FASE 25 FAIL: admin operacional deveria remover o modelo';
  end if;

  raise notice '✓ FASE 25 SMOKE: OK — admin juridico upload-only aplicado';
end $$;

rollback;
