-- =============================================
-- SMOKE TEST — FUNDOS (tags internas por proposta)
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-22-fundos.sql
-- Transação reversível (rollback ao final). Cobre:
--   criar fundo → atribuir → trocar status → negar SELECT a partner/client
--   e negar RPC de escrita para partner (forbidden).

begin;

do $$
declare
  v_admin_uid    uuid := gen_random_uuid();
  v_partner_uid  uuid := gen_random_uuid();
  v_client_uid   uuid := gen_random_uuid();
  v_partner      uuid;
  v_prop         uuid;
  v_fundo        uuid;
  v_status       public.fundo_status;
  v_cnt          int;
  v_msg          text;
begin
  -- ---------------------------------------------------------------
  -- Cadeia mínima (sem JWT → auth.uid() null → triggers permissivos)
  -- ---------------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);

  -- auth.users seed (superuser); o trigger handle_new_user cria o espelho em public.usuarios
  insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_uid,   'fundo.smoke.admin.'   || replace(v_admin_uid::text,   '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_partner_uid, 'fundo.smoke.partner.' || replace(v_partner_uid::text, '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_client_uid,  'fundo.smoke.client.'  || replace(v_client_uid::text,  '-', '') || '@test.local', '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin',   nome_completo = 'Fundo Smoke Admin'   where id = v_admin_uid;
  update public.usuarios set role = 'partner', nome_completo = 'Fundo Smoke Partner' where id = v_partner_uid;
  update public.usuarios set role = 'client',  nome_completo = 'Fundo Smoke Client'  where id = v_client_uid;

  insert into public.partners (usuario_id, status)
  values (v_partner_uid, 'approved')
  returning id into v_partner;

  insert into public.propostas (partner_id, produto, valor_solicitado, prazo_meses)
  values (v_partner, 'home_equity', 100000, 24)
  returning id into v_prop;

  -- ---------------------------------------------------------------
  -- ADMIN: criar fundo → atribuir → trocar status
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_uid::text, 'app_metadata', json_build_object('role', 'admin'))::text,
    true
  );

  v_fundo := public.admin_fundo_upsert(null, 'Fundo Alpha Smoke', '#123ABC');
  if v_fundo is null then
    raise exception 'FASE 22 FAIL: admin_fundo_upsert nao retornou id';
  end if;

  -- cor inválida deve falhar
  begin
    perform public.admin_fundo_upsert(null, 'Fundo Cor Ruim', 'xyz');
    raise exception 'FASE 22 FAIL: cor invalida deveria falhar';
  exception when others then
    if sqlerrm <> 'cor_invalida' then
      raise exception 'FASE 22 FAIL: esperado cor_invalida, obtido %', sqlerrm;
    end if;
  end;

  perform public.admin_proposta_fundo_set(v_prop, v_fundo, 'aguardando', 'inicial');
  select status_fundo into v_status from public.proposta_fundos where proposta_id = v_prop and fundo_id = v_fundo;
  if v_status is distinct from 'aguardando'::public.fundo_status then
    raise exception 'FASE 22 FAIL: status inicial esperado aguardando, obtido %', v_status;
  end if;

  perform public.admin_proposta_fundo_set(v_prop, v_fundo, 'aprovado', null);
  select status_fundo into v_status from public.proposta_fundos where proposta_id = v_prop and fundo_id = v_fundo;
  if v_status is distinct from 'aprovado'::public.fundo_status then
    raise exception 'FASE 22 FAIL: status esperado aprovado, obtido %', v_status;
  end if;

  -- auditoria gravada
  if not exists (
    select 1 from public.audit_log
     where entidade = 'proposta_fundos' and entidade_id = v_prop and acao = 'proposta_fundo_set'
  ) then
    raise exception 'FASE 22 FAIL: audit_log de proposta_fundo_set ausente';
  end if;

  -- ---------------------------------------------------------------
  -- PARTNER: nega SELECT (RLS) em fundos/proposta_fundos
  -- ---------------------------------------------------------------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_partner_uid::text, 'app_metadata', json_build_object('role', 'partner', 'approved', true, 'partner_id', v_partner::text))::text,
    true
  );

  begin
    select count(*) into v_cnt from public.fundos;
  exception when insufficient_privilege then v_cnt := 0;
  end;
  if v_cnt <> 0 then raise exception 'FASE 22 FAIL: partner conseguiu SELECT em fundos (% linhas)', v_cnt; end if;

  begin
    select count(*) into v_cnt from public.proposta_fundos;
  exception when insufficient_privilege then v_cnt := 0;
  end;
  if v_cnt <> 0 then raise exception 'FASE 22 FAIL: partner conseguiu SELECT em proposta_fundos (% linhas)', v_cnt; end if;
  reset role;

  -- ---------------------------------------------------------------
  -- CLIENT: nega SELECT (RLS) em fundos/proposta_fundos
  -- ---------------------------------------------------------------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_client_uid::text, 'app_metadata', json_build_object('role', 'client'))::text,
    true
  );

  begin
    select count(*) into v_cnt from public.fundos;
  exception when insufficient_privilege then v_cnt := 0;
  end;
  if v_cnt <> 0 then raise exception 'FASE 22 FAIL: client conseguiu SELECT em fundos (% linhas)', v_cnt; end if;

  begin
    select count(*) into v_cnt from public.proposta_fundos;
  exception when insufficient_privilege then v_cnt := 0;
  end;
  if v_cnt <> 0 then raise exception 'FASE 22 FAIL: client conseguiu SELECT em proposta_fundos (% linhas)', v_cnt; end if;
  reset role;

  -- ---------------------------------------------------------------
  -- PARTNER: nega RPC de escrita (forbidden)
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_partner_uid::text, 'app_metadata', json_build_object('role', 'partner', 'approved', true, 'partner_id', v_partner::text))::text,
    true
  );
  begin
    perform public.admin_fundo_upsert(null, 'Fundo Proibido', '#ABCDEF');
    raise exception 'FASE 22 FAIL: partner deveria ser barrado em admin_fundo_upsert';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 22 FAIL: esperado forbidden para partner, obtido %', sqlerrm;
    end if;
  end;

  begin
    perform public.admin_proposta_fundo_set(v_prop, v_fundo, 'rejeitado', null);
    raise exception 'FASE 22 FAIL: partner deveria ser barrado em admin_proposta_fundo_set';
  exception when others then
    if sqlerrm <> 'forbidden' then
      raise exception 'FASE 22 FAIL: esperado forbidden para partner em set, obtido %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------
  -- ADMIN: remover atribuição
  -- ---------------------------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_uid::text, 'app_metadata', json_build_object('role', 'admin'))::text,
    true
  );
  perform public.admin_proposta_fundo_remove(v_prop, v_fundo);
  if exists (select 1 from public.proposta_fundos where proposta_id = v_prop and fundo_id = v_fundo) then
    raise exception 'FASE 22 FAIL: atribuicao deveria ter sido removida';
  end if;

  raise notice '✓ FASE 22 SMOKE: OK — fundos criar/atribuir/status + isolamento partner/client';
end $$;

rollback;
