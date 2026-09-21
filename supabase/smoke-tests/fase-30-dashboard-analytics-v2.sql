-- SMOKE FASE 30 — dashboard analytics v2
begin;

do $$
declare
  v_admin uuid:=gen_random_uuid(); v_partner_user uuid:=gen_random_uuid(); v_partner uuid;
  v_result jsonb;
begin
  perform set_config('request.jwt.claims','',true);
  insert into auth.users(id,email,raw_user_meta_data,created_at,email_confirmed_at) values
    (v_admin,'dash.admin.'||replace(v_admin::text,'-','')||'@test.local','{}',now(),now()),
    (v_partner_user,'dash.partner.'||replace(v_partner_user::text,'-','')||'@test.local','{}',now(),now());
  update public.usuarios set role='admin',nome_completo='Dashboard Admin' where id=v_admin;
  update public.usuarios set role='partner',nome_completo='Dashboard Partner' where id=v_partner_user;
  insert into public.partners(usuario_id,status) values(v_partner_user,'approved') returning id into v_partner;
  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses,status,created_at) values
    (v_partner,'home_equity',1000,120,'analise_credito',timestamptz '2026-08-10 12:00:00-03'),
    (v_partner,'home_equity',2000000,120,'completo',timestamptz '2026-09-10 12:00:00-03');

  perform set_config('request.jwt.claims',json_build_object('sub',v_admin,'app_metadata',json_build_object('role','admin','admin_nivel','full'))::text,true);
  v_result:=public.admin_dashboard_analytics('2026-09-01','2026-09-30',null,v_partner,null);
  if (v_result->>'total_propostas')::int<>1 then raise exception 'FASE 30 FAIL: periodo/parceiro'; end if;
  if (v_result->>'volume_ganho')::numeric<>2000000 then raise exception 'FASE 30 FAIL: volume ganho'; end if;
  if (v_result->>'volume_operacional')::numeric<>0 then raise exception 'FASE 30 FAIL: volume liberado'; end if;
  if jsonb_array_length(v_result->'serie')<>1 then raise exception 'FASE 30 FAIL: serie'; end if;
  if not (v_result->'resumo_global' ? 'total_propostas') then raise exception 'FASE 30 FAIL: resumo global'; end if;
  raise notice 'FASE 30 SMOKE OK';
end $$;

rollback;
