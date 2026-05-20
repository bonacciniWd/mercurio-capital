-- =============================================
-- SMOKE TEST FASE 12 — Fluxos / Templates / Campanhas / Email Outbox
-- =============================================
-- Roda em transação reversível: nenhum dado fica persistido.
-- Uso: psql "$DATABASE_URL" -f supabase/smoke-tests/fase-12-fluxos.sql

begin;

do $$
declare
  v_admin     uuid;
  v_jwt_admin jsonb;
  v_tpl_id    uuid;
  v_fluxo_id  uuid;
  v_exec_id   uuid;
  v_camp_id   uuid;
  v_disparo   jsonb;
  v_in_app_ct int;
  v_email_ct  int;
  v_exec_st   text;
begin
  select id into v_admin from usuarios where role = 'admin' limit 1;
  if v_admin is null then raise exception 'precisa de 1 admin'; end if;

  v_jwt_admin := jsonb_build_object('sub', v_admin::text, 'role', 'authenticated',
                  'app_metadata', jsonb_build_object('role','admin','two_factor_at', now()));
  perform set_config('request.jwt.claims', v_jwt_admin::text, true);

  -- 1) Template upsert
  v_tpl_id := admin_template_upsert(
    p_codigo := 'smoke_f12_tpl',
    p_canal  := 'in_app',
    p_nome   := 'Smoke F12',
    p_corpo  := 'Olá {{nome}}, seu fluxo rodou.',
    p_assunto := 'smoke',
    p_variaveis := array['nome']
  );
  raise notice 'template criado: %', v_tpl_id;

  -- 2) Fluxo upsert
  v_fluxo_id := admin_fluxo_upsert(
    p_nome := 'Smoke Fluxo F12',
    p_trigger_evento := 'manual',
    p_descricao := 'fluxo de smoke',
    p_acoes := jsonb_build_array(
      jsonb_build_object('tipo','notificar','template','smoke_f12_tpl','canais',array['in_app'],'titulo','Smoke')
    )
  );
  raise notice 'fluxo criado: %', v_fluxo_id;

  -- 3) Executar manualmente o fluxo
  v_exec_id := admin_fluxo_executar(p_fluxo_id := v_fluxo_id, p_usuario_id := v_admin,
                                    p_payload := jsonb_build_object('nome','Admin'));
  select status into v_exec_st from fluxo_execucoes where id = v_exec_id;
  if v_exec_st not in ('sucesso','parcial') then
    raise exception 'fluxo_execucoes status inesperado: %', v_exec_st;
  end if;
  raise notice 'execução: % (status %)', v_exec_id, v_exec_st;

  -- 4) Campanha upsert
  v_camp_id := admin_campanha_upsert(
    p_nome := 'Smoke Campanha F12',
    p_template := 'smoke_f12_tpl',
    p_publico_alvo := jsonb_build_object('roles', array['admin']),
    p_canais := array['in_app']::text[]
  );
  raise notice 'campanha criada: %', v_camp_id;

  v_disparo := admin_campanha_disparar(v_camp_id);
  v_in_app_ct := coalesce((v_disparo->>'in_app')::int, 0);
  v_email_ct  := coalesce((v_disparo->>'email_enfileirados')::int, 0);
  raise notice 'disparo: in_app=% email=%', v_in_app_ct, v_email_ct;
  if v_in_app_ct < 1 then
    raise exception 'disparo deveria enfileirar pelo menos 1 in_app';
  end if;

  -- 5) Verifica que notificação foi criada
  if not exists (
    select 1 from notificacoes
     where usuario_id = v_admin
       and metadata->>'origem' = 'campanha'
       and (metadata->>'campanha_id')::uuid = v_camp_id
  ) then
    raise exception 'notificação da campanha não foi criada';
  end if;

  -- 6) Verifica views
  perform 1 from v_admin_fluxos where id = v_fluxo_id;
  perform 1 from v_admin_campanhas where id = v_camp_id;
  perform 1 from v_admin_templates where id = v_tpl_id;

  raise notice 'FASE 12 SMOKE: OK';
end;
$$;

rollback;
