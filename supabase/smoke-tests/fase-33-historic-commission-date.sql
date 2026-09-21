begin;
do $$
declare v_admin uuid:=gen_random_uuid(); v_partner uuid:=gen_random_uuid(); v_id uuid; v_json jsonb;
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,aud,role,email_confirmed_at)
    values(v_admin,'smoke33-admin@example.com','{"role":"admin"}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now());
  insert into public.partners(id,usuario_id,status) values(v_partner,v_admin,'approved');
  insert into public.propostas(partner_id,produto,valor_solicitado,prazo_meses,status,created_at)
    values(v_partner,'home_equity',900000,120,'completo','2026-07-10') returning id into v_id;
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','admin','app_metadata',json_build_object('role','admin'))::text,true);
  perform public.admin_corrigir_entrada_pagamento_comissao(v_id,'2026-09-05','Comprovante conferido');
  v_json:=public.admin_dashboard_analytics('2026-09-01','2026-09-30',null,v_partner,null);
  if (v_json->>'volume_liberado')::numeric<>900000 then raise exception 'FASE 33 FAIL: correcao nao entrou'; end if;
  if (select count(*) from public.proposta_status_historico where proposta_id=v_id and metadata->>'correcao_historica'='true')<>1 then raise exception 'FASE 33 FAIL: historico'; end if;
  begin perform public.admin_corrigir_entrada_pagamento_comissao(v_id,'2026-06-01','Data invalida'); raise exception 'FASE 33 FAIL: data anterior aceita'; exception when others then if sqlerrm like 'FASE 33 FAIL%' then raise; end if; end;
end $$;
rollback;
\echo 'FASE 33 SMOKE OK'
