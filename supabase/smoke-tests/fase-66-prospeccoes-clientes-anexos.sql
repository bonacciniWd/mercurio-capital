-- LOCAL/ISOLADO SOMENTE. Cria identidades sintéticas dentro de uma transação.
-- Todas as fixtures (inclusive metadados Storage) são revertidas ao final.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'F66: %',label; end if; end;
$$;
create function pg_temp.expect_error(command text, expected_state text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'F66: esperado SQLSTATE %, recebido %: %',expected_state,sqlstate,sqlerrm;
  end;
  raise exception 'F66: operação deveria falhar: %',command;
end;
$$;
create function pg_temp.uid(i integer) returns uuid language sql immutable as $$
  select ('66000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
$$;
create function pg_temp.login(i integer, papel text, nivel text default 'full', aal text default 'aal2', equipe text default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.aal','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(i),'role','authenticated','aal',aal,
    'app_metadata', jsonb_build_object('role',papel,'admin_nivel',nivel,'partner_id',case when i=2 then pg_temp.uid(12) else pg_temp.uid(11) end,'equipe_id',equipe,'approved',true))::text,true);
end;
$$;

select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.prospeccoes_clientes_anexos'::regclass),'RLS habilitada');
select pg_temp.assert_true(not has_table_privilege('anon','public.prospeccoes_clientes_anexos','SELECT'),'anon sem SELECT');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.prospeccoes_clientes_anexos','INSERT,UPDATE,DELETE'),'sem escrita direta');
select pg_temp.assert_true(not has_function_privilege('anon','public.prospeccao_cliente_anexo_preparar(uuid,text,text,integer)','EXECUTE'),'anon sem RPC');
select pg_temp.assert_true((select not public and file_size_limit=2097152 from storage.buckets where id='prospeccao-clientes-anexos'),'bucket privado e tamanho');
select pg_temp.assert_true((select count(*)=5 from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('b2c_anexos_ler_restrito','b2c_anexos_upload_restrito','b2c_anexos_sem_overwrite','b2c_anexos_preservar_recebidos','b2c_anexos_anon_negado') and permissive='RESTRICTIVE'),'policies restritivas');

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
select pg_temp.uid(i),'authenticated','authenticated','smoke-f66-'||i||'@test.invalid',now(),now(),now(),jsonb_build_object('nome_completo','Fixture F66 '||i)
from generate_series(1,9) i;
update public.usuarios set role=case when id in(pg_temp.uid(1),pg_temp.uid(2)) then 'partner'::public.user_role
  when id in(pg_temp.uid(3),pg_temp.uid(4)) then 'team_member'::public.user_role
  when id=pg_temp.uid(9) then 'client'::public.user_role else 'admin'::public.user_role end
where id in(select pg_temp.uid(i) from generate_series(1,9)i);
insert into public.partners(id,usuario_id,status) values(pg_temp.uid(11),pg_temp.uid(1),'approved'),(pg_temp.uid(12),pg_temp.uid(2),'approved');
insert into public.equipes(id,partner_id,nome) values(pg_temp.uid(21),pg_temp.uid(11),'Equipe teste A'),(pg_temp.uid(22),pg_temp.uid(11),'Equipe teste B');
insert into public.equipe_membros(equipe_id,usuario_id,papel_equipe,aceito_em) values(pg_temp.uid(21),pg_temp.uid(3),'membro',now()),(pg_temp.uid(22),pg_temp.uid(4),'membro',now());
insert into public.prospeccoes_clientes(id,partner_id,equipe_id,responsavel_id,nome_completo,email,created_by,updated_by) values
(pg_temp.uid(31),pg_temp.uid(11),pg_temp.uid(21),pg_temp.uid(1),'Prospect F66 A','f66-a@test.invalid',pg_temp.uid(1),pg_temp.uid(1)),
(pg_temp.uid(32),pg_temp.uid(11),pg_temp.uid(22),pg_temp.uid(1),'Prospect F66 B','f66-b@test.invalid',pg_temp.uid(1),pg_temp.uid(1)),
(pg_temp.uid(33),pg_temp.uid(12),null,pg_temp.uid(2),'Prospect F66 C','f66-c@test.invalid',pg_temp.uid(2),pg_temp.uid(2));

set local role authenticated;
select pg_temp.login(1,'partner','full','aal1');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31)),'AAL1 negado');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_preparar(%L,''print.png'',''image/png'',100)',pg_temp.uid(31)),'42501');
select pg_temp.login(1,'partner');
select pg_temp.assert_true(public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31),true),'dono pode escrever');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_acesso(pg_temp.uid(33)),'carteira alheia negada');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_preparar(%L,''print.png'',''image/png'',3000000)',pg_temp.uid(31)),'22023');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_preparar(%L,''print.png'',''application/pdf'',100)',pg_temp.uid(31)),'22023');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_preparar(%L,''print.jpg'',''image/png'',100)',pg_temp.uid(31)),'22023');
select set_config('f66.anexo1',anexo_id::text,true),set_config('f66.path1',storage_path,true)
from public.prospeccao_cliente_anexo_preparar(pg_temp.uid(31),'print.png','image/png',100);
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_confirmar(%L)',current_setting('f66.anexo1')),'22023');
insert into storage.objects(bucket_id,name,metadata) values('prospeccao-clientes-anexos',current_setting('f66.path1'),'{"size":100,"mimetype":"image/png"}');
select public.prospeccao_cliente_anexo_confirmar(current_setting('f66.anexo1')::uuid);
select public.prospeccao_cliente_anexo_confirmar(current_setting('f66.anexo1')::uuid); -- idempotente
select pg_temp.assert_true((select count(*)=1 from public.prospeccoes_clientes_anexos where id=current_setting('f66.anexo1')::uuid and estado='recebido'),'confirmado único');
select pg_temp.assert_true((select count(*)=1 from storage.objects where bucket_id='prospeccao-clientes-anexos' and name=current_setting('f66.path1')),'leitura objeto');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_objeto_permitido('prospeccao-clientes-anexos',current_setting('f66.path1'),'cancelar'),'recebido não pode remover');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_cancelar(%L)',current_setting('f66.anexo1')),'22023');
select pg_temp.expect_error(format('insert into storage.objects(bucket_id,name) values(''prospeccao-clientes-anexos'',%L)',pg_temp.uid(31)::text||'/arbitrario.png'),'42501');

select set_config('f66.anexo2',anexo_id::text,true),set_config('f66.path2',storage_path,true)
from public.prospeccao_cliente_anexo_preparar(pg_temp.uid(31),'outro.png','image/png',100);
select set_config('f66.anexo3',anexo_id::text,true) from public.prospeccao_cliente_anexo_preparar(pg_temp.uid(31),'terceiro.png','image/png',100);
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_preparar(%L,''quarto.png'',''image/png'',100)',pg_temp.uid(31)),'22023');
select public.prospeccao_cliente_anexo_cancelar(current_setting('f66.anexo3')::uuid);
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_objeto_permitido('prospeccao-clientes-anexos',(select storage_path from public.prospeccoes_clientes_anexos where id=current_setting('f66.anexo3')::uuid),'upload'),'reserva cancelada negada');

select pg_temp.login(2,'partner');
select pg_temp.assert_true((select count(*)=0 from public.prospeccoes_clientes_anexos where prospeccao_id=pg_temp.uid(31)),'outro parceiro não lê metadados');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='prospeccao-clientes-anexos' and name=current_setting('f66.path1')),'outro parceiro não lê storage');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_confirmar(%L)',current_setting('f66.anexo2')),'42501');
select pg_temp.login(3,'team_member','full','aal1',pg_temp.uid(21)::text);
select pg_temp.assert_true(public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31)),'membro equipe correta');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_acesso(pg_temp.uid(32)),'membro não acessa outra equipe');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_confirmar(%L)',current_setting('f66.anexo2')),'42501');
select pg_temp.login(4,'team_member','full','aal2',pg_temp.uid(22)::text);
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='prospeccao-clientes-anexos' and name=current_setting('f66.path1')),'outra equipe não lê objeto');
select pg_temp.login(5,'admin','full');
select pg_temp.assert_true(public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31),true),'admin full');
select pg_temp.login(6,'admin','limitado');
select pg_temp.assert_true(public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31),true),'admin limitado');
select pg_temp.login(7,'admin','comercial');
select pg_temp.assert_true(public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31),true),'admin comercial');
select pg_temp.login(8,'admin','juridico');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31)),'jurídico negado');
select pg_temp.login(9,'client');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_acesso(pg_temp.uid(31)),'cliente negado');
reset role;

-- Expiração, mismatch de tamanho/MIME e soft delete com o mesmo escopo autenticado.
update public.prospeccoes_clientes_anexos set expira_em=now()-interval '1 second' where id=current_setting('f66.anexo2')::uuid;
set local role authenticated;
select pg_temp.login(1,'partner');
select pg_temp.assert_true(not public.prospeccao_cliente_anexo_objeto_permitido('prospeccao-clientes-anexos',current_setting('f66.path2'),'upload'),'reserva expirada não sobe');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_confirmar(%L)',current_setting('f66.anexo2')),'22023');
select set_config('f66.anexo4',anexo_id::text,true),set_config('f66.path4',storage_path,true)
from public.prospeccao_cliente_anexo_preparar(pg_temp.uid(31),'invalido.png','image/png',100);
insert into storage.objects(bucket_id,name,metadata) values('prospeccao-clientes-anexos',current_setting('f66.path4'),'{"size":99,"mimetype":"image/png"}');
select pg_temp.expect_error(format('select public.prospeccao_cliente_anexo_confirmar(%L)',current_setting('f66.anexo4')),'22023');
reset role;
update public.prospeccoes_clientes set deleted_at=now() where id=pg_temp.uid(31);
set local role authenticated;
select pg_temp.login(1,'partner');
select pg_temp.assert_true((select count(*)=0 from public.prospeccoes_clientes_anexos where prospeccao_id=pg_temp.uid(31)),'prospect removido oculta anexos');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='prospeccao-clientes-anexos' and name=current_setting('f66.path1')),'prospect removido oculta storage');
reset role;
do $$ begin raise notice 'fase66_ok: grants, RLS com roles reais, AAL, Storage, quota/reservas, confirmação, cancelamento, idempotência e soft delete'; end $$;
rollback;
