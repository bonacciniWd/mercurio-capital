-- =============================================
-- SMOKE TEST — ADMIN NÍVEL (full vs limitado)
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-21-admin-nivel.sql
-- Tudo roda em transação reversível (rollback ao final).
--
-- Cobre:
--   1) helpers app_is_admin()/app_is_admin_full() para os dois níveis;
--   2) RPC sensível (admin_precos_upsert) barra admin limitado e permite full;
--   3) admin_set_proposta_status permite ambos (guard não bloqueia limitado).

begin;

do $$
declare
  v_admin_full    uuid := gen_random_uuid();
  v_admin_limited uuid := gen_random_uuid();
  v_rand          uuid := gen_random_uuid();
  v_is_admin      boolean;
  v_is_full       boolean;
  v_sqlstate      text;
  v_msg           text;
begin
  -- ---------------------------------------------------------------
  -- ADMIN FULL
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_admin_full::text,
      'app_metadata', json_build_object('role', 'admin', 'admin_nivel', 'full')
    )::text,
    true
  );

  select public.app_is_admin(), public.app_is_admin_full() into v_is_admin, v_is_full;
  if not v_is_admin then raise exception 'FASE 21 FAIL: admin full deveria ter app_is_admin()=true'; end if;
  if not v_is_full then raise exception 'FASE 21 FAIL: admin full deveria ter app_is_admin_full()=true'; end if;

  -- RPC sensível permite full: guard passa e falha depois na validação (preco_invalido), não em forbidden.
  begin
    perform public.admin_precos_upsert('bacen_cpf'::tipo_consulta, 0);
    raise exception 'FASE 21 FAIL: admin_precos_upsert deveria falhar em preco_invalido para full';
  exception when others then
    v_msg := sqlerrm;
    if v_msg = 'forbidden' then
      raise exception 'FASE 21 FAIL: admin full foi barrado (forbidden) em RPC sensível';
    end if;
    if v_msg <> 'preco_invalido' then
      raise exception 'FASE 21 FAIL: erro inesperado para full em admin_precos_upsert: %', v_msg;
    end if;
  end;

  -- admin_set_proposta_status permite full: guard passa, falha em proposta not found (P0002).
  begin
    perform public.admin_set_proposta_status(v_rand, 'pre_analise'::proposta_status);
    raise exception 'FASE 21 FAIL: admin_set_proposta_status deveria falhar em proposta not found para full';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if sqlerrm = 'forbidden' or v_sqlstate = '42501' then
      raise exception 'FASE 21 FAIL: admin full foi barrado em admin_set_proposta_status';
    end if;
    if v_sqlstate <> 'P0002' then
      raise exception 'FASE 21 FAIL: erro inesperado para full em admin_set_proposta_status (sqlstate %, %)', v_sqlstate, sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- ADMIN LIMITADO
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_admin_limited::text,
      'app_metadata', json_build_object('role', 'admin', 'admin_nivel', 'limitado')
    )::text,
    true
  );

  select public.app_is_admin(), public.app_is_admin_full() into v_is_admin, v_is_full;
  if not v_is_admin then raise exception 'FASE 21 FAIL: admin limitado deveria ter app_is_admin()=true'; end if;
  if v_is_full then raise exception 'FASE 21 FAIL: admin limitado deveria ter app_is_admin_full()=false'; end if;

  -- RPC sensível barra limitado: deve retornar forbidden antes de qualquer efeito.
  begin
    perform public.admin_precos_upsert('bacen_cpf'::tipo_consulta, 12900);
    raise exception 'FASE 21 FAIL: admin_precos_upsert deveria barrar admin limitado';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 21 FAIL: esperado forbidden para limitado em admin_precos_upsert, obtido: %', sqlerrm;
    end if;
  end;

  -- admin_set_proposta_status permite limitado: guard passa, falha em proposta not found (P0002).
  begin
    perform public.admin_set_proposta_status(v_rand, 'pre_analise'::proposta_status);
    raise exception 'FASE 21 FAIL: admin_set_proposta_status deveria falhar em proposta not found para limitado';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if sqlerrm = 'forbidden' or v_sqlstate = '42501' then
      raise exception 'FASE 21 FAIL: admin limitado foi barrado em admin_set_proposta_status (deveria permitir)';
    end if;
    if v_sqlstate <> 'P0002' then
      raise exception 'FASE 21 FAIL: erro inesperado para limitado em admin_set_proposta_status (sqlstate %, %)', v_sqlstate, sqlerrm;
    end if;
  end;

  raise notice '✓ FASE 21 SMOKE: OK — admin_nivel (full vs limitado) + hardening consistentes';
end $$;

rollback;
