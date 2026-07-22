-- =============================================
-- SMOKE TEST — MODELOS DE CONTRATO POR PROPOSTA (RLS)
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-24-contrato-modelos.sql
-- Transação reversível (rollback ao final). Cobre:
--   admin adiciona modelo; partner dono e cliente conseguem SELECT;
--   partner NÃO consegue inserir (RLS) nem via RPC (forbidden).

begin;

do $$
declare
  v_admin_uid    uuid := gen_random_uuid();
  v_partner_uid  uuid := gen_random_uuid();
  v_client_uid   uuid := gen_random_uuid();
  v_partner      uuid;
  v_cliente      uuid;
  v_prop         uuid;
  v_modelo       uuid;
  v_cnt          int;
begin
  perform set_config('request.jwt.claims', '', true);

  -- auth.users seed (superuser); o trigger handle_new_user cria o espelho em public.usuarios
  insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_uid,   'modelo.smoke.admin.'   || replace(v_admin_uid::text,   '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_partner_uid, 'modelo.smoke.partner.' || replace(v_partner_uid::text, '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_client_uid,  'modelo.smoke.client.'  || replace(v_client_uid::text,  '-', '') || '@test.local', '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin',   nome_completo = 'Modelo Smoke Admin'   where id = v_admin_uid;
  update public.usuarios set role = 'partner', nome_completo = 'Modelo Smoke Partner' where id = v_partner_uid;
  update public.usuarios set role = 'client',  nome_completo = 'Modelo Smoke Client'  where id = v_client_uid;

  insert into public.partners (usuario_id, status)
  values (v_partner_uid, 'approved')
  returning id into v_partner;

  insert into public.clientes (pessoa_tipo, nome_completo, usuario_id)
  values ('PF', 'Cliente Modelo', v_client_uid)
  returning id into v_cliente;

  insert into public.propostas (partner_id, cliente_id, produto, valor_solicitado, prazo_meses)
  values (v_partner, v_cliente, 'home_equity', 100000, 24)
  returning id into v_prop;

  -- ---------------------------------------------------------------
  -- ADMIN: adiciona modelo via RPC
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_uid::text, 'app_metadata', json_build_object('role', 'admin'))::text,
    true
  );
  v_modelo := public.proposta_contrato_modelo_add(v_prop, v_prop::text || '/modelos/smoke.pdf', 'smoke.pdf');
  if v_modelo is null then
    raise exception 'FASE 24 FAIL: proposta_contrato_modelo_add nao retornou id';
  end if;

  -- path inválido deve falhar
  begin
    perform public.proposta_contrato_modelo_add(v_prop, 'outra-proposta/modelos/x.pdf', 'x.pdf');
    raise exception 'FASE 24 FAIL: path invalido deveria falhar';
  exception when others then
    if sqlerrm <> 'storage_path_invalido' then
      raise exception 'FASE 24 FAIL: esperado storage_path_invalido, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- PARTNER dono: SELECT permitido, INSERT/RPC negados
  -- ---------------------------------------------------------------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_partner_uid::text, 'app_metadata', json_build_object('role', 'partner', 'approved', true, 'partner_id', v_partner::text))::text,
    true
  );

  begin
    select count(*) into v_cnt from public.proposta_contrato_modelos where proposta_id = v_prop;
  exception when insufficient_privilege then v_cnt := -1;
  end;
  if v_cnt <> 1 then
    raise exception 'FASE 24 FAIL: partner dono deveria ver 1 modelo, obtido %', v_cnt;
  end if;

  begin
    insert into public.proposta_contrato_modelos (proposta_id, storage_path, nome_arquivo)
    values (v_prop, v_prop::text || '/modelos/hack.pdf', 'hack.pdf');
    raise exception 'FASE 24 FAIL: partner conseguiu INSERT direto (RLS falhou)';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate <> '42501' then
        raise exception 'FASE 24 FAIL: erro inesperado no INSERT do partner (sqlstate %, %)', sqlstate, sqlerrm;
      end if;
  end;
  reset role;

  -- partner via RPC → forbidden (RPC é security definer, guard por JWT)
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_partner_uid::text, 'app_metadata', json_build_object('role', 'partner', 'approved', true, 'partner_id', v_partner::text))::text,
    true
  );
  begin
    perform public.proposta_contrato_modelo_add(v_prop, v_prop::text || '/modelos/hack2.pdf', 'hack2.pdf');
    raise exception 'FASE 24 FAIL: partner deveria ser barrado no RPC';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 24 FAIL: esperado forbidden para partner no RPC, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- CLIENTE da proposta: SELECT permitido
  -- ---------------------------------------------------------------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_client_uid::text, 'app_metadata', json_build_object('role', 'client'))::text,
    true
  );
  begin
    select count(*) into v_cnt from public.proposta_contrato_modelos where proposta_id = v_prop;
  exception when insufficient_privilege then v_cnt := -1;
  end;
  if v_cnt <> 1 then
    raise exception 'FASE 24 FAIL: cliente deveria ver 1 modelo, obtido %', v_cnt;
  end if;
  reset role;

  raise notice '✓ FASE 24 SMOKE: OK — modelo de contrato (admin escreve, partner/cliente leem, partner nao escreve)';
end $$;

rollback;
