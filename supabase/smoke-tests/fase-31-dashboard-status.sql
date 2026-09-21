-- SMOKE FASE 31 — standby e semântica temporal do dashboard
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_partner uuid := gen_random_uuid();
  v_producao uuid;
  v_standby uuid;
  v_json jsonb;
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,aud,role,email_confirmed_at)
    values(v_admin,'smoke31-admin@example.com','{"role":"admin"}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now());
  insert into public.partners(id,usuario_id,status) values(v_partner,v_admin,'approved');

  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses,status,created_at)
    values(v_partner,'home_equity',3000000,120,'recurso_liberado','2026-09-10') returning id into v_producao;
  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses,status,created_at)
    values(v_partner,'home_equity',2000000,120,'standby','2026-09-10') returning id into v_standby;

  perform set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','admin','app_metadata',json_build_object('role','admin'))::text, true);
  v_json := public.admin_dashboard_analytics('2026-09-01','2026-09-30',null,v_partner,null);
  if (v_json->>'total_propostas')::int <> 2 then raise exception 'FASE 31 FAIL: produção'; end if;
  if (v_json->>'standby')::int <> 1 then raise exception 'FASE 31 FAIL: standby'; end if;
  if (v_json->>'ativas')::int <> 1 then raise exception 'FASE 31 FAIL: ativas'; end if;
  if (v_json->>'volume_ganho')::numeric <> 3000000 then raise exception 'FASE 31 FAIL: volume ganho'; end if;
  if (v_json->>'volume_liberado')::numeric <> 0 then raise exception 'FASE 31 FAIL: volume liberado'; end if;
end $$;

rollback;
\echo 'FASE 31 SMOKE OK'
