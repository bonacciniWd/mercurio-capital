-- =============================================
-- SMOKE TEST FASE 13 — Analytics MVs, Rede Graph, Feature Flags
-- =============================================
-- psql "$DATABASE_URL" -f supabase/smoke-tests/fase-13-analytics.sql

begin;

do $$
declare
  v_admin     uuid;
  v_jwt_admin jsonb;
  v_refresh   jsonb;
  v_graph     jsonb;
  v_flag_id   uuid;
  v_n_nodes   int;
  v_n_edges   int;
begin
  select id into v_admin from usuarios where role = 'admin' limit 1;
  if v_admin is null then raise exception 'precisa de 1 admin'; end if;

  v_jwt_admin := jsonb_build_object('sub', v_admin::text, 'role', 'authenticated',
                  'app_metadata', jsonb_build_object('role','admin','two_factor_at', now()));
  perform set_config('request.jwt.claims', v_jwt_admin::text, true);

  -- 1) refresh MVs
  v_refresh := admin_refresh_mvs();
  if (v_refresh->>'ok')::boolean is not true then
    raise exception 'refresh falhou: %', v_refresh;
  end if;
  raise notice 'refresh MVs: %ms', v_refresh->>'duracao_ms';

  -- 2) MV presente
  perform 1 from mv_admin_funil_global limit 1;
  perform 1 from mv_admin_partners_metrics limit 1;

  -- 3) rede graph
  v_graph := admin_rede_graph(p_status := 'approved', p_limit := 10);
  v_n_nodes := jsonb_array_length(v_graph->'nodes');
  v_n_edges := jsonb_array_length(v_graph->'edges');
  raise notice 'rede graph: nodes=% edges=%', v_n_nodes, v_n_edges;
  if v_n_nodes < 1 then raise exception 'graph deveria conter pelo menos admin'; end if;

  -- 4) feature flag upsert + delete
  v_flag_id := admin_feature_flag_upsert(
    p_chave := 'smoke_f13_flag',
    p_descricao := 'flag de teste',
    p_regras := jsonb_build_object('roles', array['admin'], 'percent', 100),
    p_ativo := true
  );
  raise notice 'flag criada: %', v_flag_id;

  perform 1 from v_admin_feature_flags where id = v_flag_id;

  perform admin_feature_flag_delete(v_flag_id);
  if exists(select 1 from feature_flags where id = v_flag_id) then
    raise exception 'delete não removeu flag';
  end if;

  raise notice 'FASE 13 SMOKE: OK';
end;
$$;

rollback;
