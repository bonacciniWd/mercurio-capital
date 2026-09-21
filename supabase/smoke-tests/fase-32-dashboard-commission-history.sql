-- SMOKE FASE 32 — standby e semântica temporal do dashboard
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_partner uuid := gen_random_uuid();
  v_producao uuid;
  v_standby uuid;
  v_json jsonb; v_old uuid; v_missing uuid;
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
  if (v_json->>'total_propostas')::int <> 2 then raise exception 'FASE 32 FAIL: produção'; end if;
  if (v_json->>'standby')::int <> 1 then raise exception 'FASE 32 FAIL: standby'; end if;
  if (v_json->>'ativas')::int <> 1 then raise exception 'FASE 32 FAIL: ativas'; end if;
  if (v_json->>'volume_ganho')::numeric <> 3000000 then raise exception 'FASE 32 FAIL: volume ganho'; end if;
  if (v_json->>'volume_liberado')::numeric <> 0 then raise exception 'FASE 32 FAIL: volume liberado'; end if;

  if (v_json->>'taxa_conversao')::numeric <> 100 then raise exception 'Standby alterou conversao'; end if;
  if (v_json->>'volume_solicitado')::numeric <> 3000000 then raise exception 'Standby alterou volume'; end if;
  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses,status,created_at)
    values(v_partner,'home_equity',500000,120,'completo','2026-07-10') returning id into v_old;
  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses,status,created_at)
    values(v_partner,'home_equity',700000,120,'completo','2026-07-10') returning id into v_missing;
  insert into public.proposta_status_historico(proposta_id,status_anterior,status_novo,created_at)
    values(v_old,'recurso_liberado','pagamento_comissao','2026-09-01 03:00:00+00'),
          (v_old,'recurso_liberado','pagamento_comissao','2026-10-03 12:00:00+00');
  v_json := public.admin_dashboard_analytics('2026-09-01','2026-09-30',null,v_partner,null);
  if (v_json->>'volume_liberado')::numeric <> 500000 then raise exception 'Comissao fora do mes de entrada'; end if;
  if (v_json->>'liberadas_sem_data')::int <> 1 then raise exception 'Historico ausente oculto'; end if;
  if (v_json->>'volume_liberado_sem_data')::numeric <> 700000 then raise exception 'Valor sem data incorreto'; end if;
  if (v_json->>'total_propostas')::int <> 2 then raise exception 'Comissao alterou criadas'; end if;
  if (v_json->'top_parceiros'->0->>'volume_liberado')::numeric <> 500000 then raise exception 'Ranking omitiu comissao antiga'; end if;
  if (v_json->'top_parceiros'->0->>'volume_ganho')::numeric <> 3000000 then raise exception 'Ranking duplicou ganho'; end if;
  v_json := public.admin_dashboard_analytics('2026-10-01','2026-10-31',null,v_partner,null);
  if (v_json->>'volume_liberado')::numeric <> 0 then raise exception 'Reentrada duplicou comissao'; end if;
  v_json := public.admin_dashboard_analytics('2026-08-01','2026-08-31',null,v_partner,null);
  if (v_json->>'volume_liberado')::numeric <> 0 then raise exception 'Fronteira Sao Paulo incorreta'; end if;
  v_json := public.admin_dashboard_analytics('2026-09-01','2026-09-30',null,gen_random_uuid(),null);
  if (v_json->>'volume_liberado')::numeric <> 0 then raise exception 'Filtro parceiro ignorado'; end if;
end $$;

rollback;
\echo 'FASE 32 SMOKE OK'
