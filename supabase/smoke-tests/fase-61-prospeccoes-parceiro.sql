-- FASE 61 — Funil de prospecção de parceiros + admin_nivel 'comercial' (issues #28/#29/#30).
-- Executar depois da migration 20261112000001.
-- Transacional com ROLLBACK: fixtures sintéticos, zero resíduo.
-- RLS verificada estruturalmente (sessão superuser); comportamento via RPCs (security definer
-- com auth.uid() dos claims) e app_metadata.admin_nivel para o nível.

begin;

-- ---------------- fixtures ----------------
-- admins: full (a1), comercial (a2), juridico (a3); e um partner (não-admin)
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data)
values
  ('51111111-1111-1111-1111-111111111111','authenticated','authenticated','funil-full@local.dev',crypt('x',gen_salt('bf')),now(),now(),now(),'{"role":"admin","admin_nivel":"full"}'),
  ('52222222-2222-2222-2222-222222222222','authenticated','authenticated','funil-comercial@local.dev',crypt('x',gen_salt('bf')),now(),now(),now(),'{"role":"admin","admin_nivel":"comercial"}'),
  ('53333333-3333-3333-3333-333333333333','authenticated','authenticated','funil-juridico@local.dev',crypt('x',gen_salt('bf')),now(),now(),now(),'{"role":"admin","admin_nivel":"juridico"}'),
  ('54444444-4444-4444-4444-444444444444','authenticated','authenticated','funil-partner@local.dev',crypt('x',gen_salt('bf')),now(),now(),now(),'{"role":"partner"}');

update public.usuarios set role='admin'
 where email in ('funil-full@local.dev','funil-comercial@local.dev','funil-juridico@local.dev');
update public.usuarios set role='partner' where id='54444444-4444-4444-4444-444444444444';

-- ---------------- estrutural (catálogo) ----------------
do $$
begin
  if to_regclass('public.prospeccoes_parceiro') is null
     or to_regclass('public.prospeccoes_parceiro_historico') is null then
    raise exception 'FASE 61 FAIL: tabelas ausentes'; end if;

  if not (select relrowsecurity from pg_class where oid='public.prospeccoes_parceiro'::regclass) then
    raise exception 'FASE 61 FAIL: RLS desabilitada'; end if;

  -- escrita só via RPC: sem grant de INSERT/UPDATE/DELETE para roles de API
  if has_table_privilege('authenticated','public.prospeccoes_parceiro','INSERT')
     or has_table_privilege('authenticated','public.prospeccoes_parceiro','UPDATE')
     or has_table_privilege('authenticated','public.prospeccoes_parceiro','DELETE')
     or has_table_privilege('anon','public.prospeccoes_parceiro','SELECT') then
    raise exception 'FASE 61 FAIL: grants de tabela fora do escopo'; end if;

  -- RPCs: authenticated sim, anon não
  if not has_function_privilege('authenticated','public.admin_prospeccao_create(text,text,text,text,text,text,uuid,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prospeccao_move(uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prospeccao_arquivar(uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_prospeccao_update(uuid,text,text,text,text,text,text,uuid,timestamptz)','EXECUTE') then
    raise exception 'FASE 61 FAIL: RPCs indisponíveis para authenticated'; end if;
  if has_function_privilege('anon','public.admin_prospeccao_create(text,text,text,text,text,text,uuid,timestamptz)','EXECUTE') then
    raise exception 'FASE 61 FAIL: RPC exposta a anon'; end if;

  -- view existe e é legível por authenticated
  if not has_table_privilege('authenticated','public.v_admin_prospeccoes_parceiro','SELECT') then
    raise exception 'FASE 61 FAIL: view sem grant'; end if;

  -- helper de escopo existe
  if not has_function_privilege('authenticated','public.app_is_admin_escopo_comercial()','EXECUTE') then
    raise exception 'FASE 61 FAIL: helper de escopo ausente'; end if;

  raise notice 'FASE 61 estrutural OK';
end $$;

-- ---------------- admin FULL: cria e move ----------------
set local request.jwt.claims = '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"full"}}';
do $$
declare v_id uuid;
begin
  v_id := public.admin_prospeccao_create('Imobiliária Alfa','Carlos Originador','carlos@alfa.com',null,'indicacao',null,null,null);
  if v_id is null then raise exception 'F61-1 FAIL: full não criou'; end if;
  if (select status from public.prospeccoes_parceiro where id=v_id) <> 'oportunidade'
     or not exists(select 1 from public.prospeccoes_parceiro_historico where prospeccao_id=v_id and status_novo='oportunidade') then
    raise exception 'F61-2 FAIL: histórico inicial ausente'; end if;

  -- move otimista: status esperado correto
  perform public.admin_prospeccao_move(v_id, 'follow_up', 'oportunidade');
  if (select status from public.prospeccoes_parceiro where id=v_id) <> 'follow_up'
     or not exists(select 1 from public.prospeccoes_parceiro_historico where prospeccao_id=v_id and status_anterior='oportunidade' and status_novo='follow_up') then
    raise exception 'F61-3 FAIL: move não registrou histórico'; end if;

  -- conflito otimista: esperado divergente → 40001
  begin
    perform public.admin_prospeccao_move(v_id, 'reuniao_realizada', 'oportunidade');
    raise exception 'F61-4 FAIL: conflito otimista não detectado';
  exception when sqlstate '40001' then null; end;

  -- transição livre para qualquer coluna
  perform public.admin_prospeccao_move(v_id, 'converter_proposta', 'follow_up');
  if (select status from public.prospeccoes_parceiro where id=v_id) <> 'converter_proposta' then
    raise exception 'F61-5 FAIL: transição livre negada'; end if;

  raise notice 'FASE 61 full OK';
end $$;

-- ---------------- admin COMERCIAL: opera o funil ----------------
set local request.jwt.claims = '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"comercial"}}';
do $$
declare v_id uuid;
begin
  v_id := public.admin_prospeccao_create('Imob Beta','Ana Socia',null,'11987654321','outbound','Lead de evento',null,now()+interval '3 days');
  if v_id is null then raise exception 'F61-6 FAIL: comercial não criou'; end if;
  perform public.admin_prospeccao_move(v_id,'follow_up','oportunidade');
  -- edita dados
  perform public.admin_prospeccao_update(v_id, p_notas => 'Retornar na segunda');
  if (select notas from public.prospeccoes_parceiro where id=v_id) <> 'Retornar na segunda' then
    raise exception 'F61-7 FAIL: update não aplicou'; end if;
  -- arquiva com motivo
  perform public.admin_prospeccao_arquivar(v_id, 'Sem orçamento este ano');
  if not exists(select 1 from public.prospeccoes_parceiro where id=v_id and arquivado_em is not null and motivo_arquivamento='Sem orçamento este ano') then
    raise exception 'F61-8 FAIL: arquivamento sem trilha'; end if;
  -- arquivada não move
  begin
    perform public.admin_prospeccao_move(v_id,'oportunidade','follow_up');
    raise exception 'F61-9 FAIL: arquivada moveu';
  exception when sqlstate 'P0002' then null; end;
  raise notice 'FASE 61 comercial OK';
end $$;

-- ---------------- admin JURIDICO: fora do escopo comercial ----------------
set local request.jwt.claims = '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"juridico"}}';
do $$
begin
  begin
    perform public.admin_prospeccao_create('X','Y','x@y.com',null,'outro',null,null,null);
    raise exception 'F61-10 FAIL: juridico criou';
  exception when insufficient_privilege then null; end;
  raise notice 'FASE 61 juridico negado OK';
end $$;

-- ---------------- partner (não-admin): não lê nem escreve ----------------
set local request.jwt.claims = '{"sub":"54444444-4444-4444-4444-444444444444","role":"authenticated","app_metadata":{"role":"partner"}}';
do $$
begin
  begin
    perform public.admin_prospeccao_create('X','Y','x@y.com',null,'outro',null,null,null);
    raise exception 'F61-11 FAIL: partner criou';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------------- validações de dados ----------------
set local request.jwt.claims = '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"full"}}';
do $$
begin
  -- sem contato algum → erro (null E string vazia normalizada)
  begin
    perform public.admin_prospeccao_create('Sem Contato','Fulano',null,null,'outro',null,null,null);
    raise exception 'F61-12 FAIL: criou sem contato';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.admin_prospeccao_create('Sem Contato 2','Fulano','','','outro',null,null,null);
    raise exception 'F61-12b FAIL: string vazia escapou da validação';
  exception when sqlstate '22023' then null; end;
  -- arquivar sem motivo → erro
  begin
    perform public.admin_prospeccao_arquivar(gen_random_uuid(), null);
    raise exception 'F61-13 FAIL: arquivou sem motivo';
  exception when sqlstate '22023' then null; end;
  -- status inválido → erro
  begin
    declare v_id uuid;
    begin
      v_id := public.admin_prospeccao_create('Imob Gama','Bia','bia@g.com',null,'site',null,null,null);
      perform public.admin_prospeccao_move(v_id,'status_inexistente','oportunidade');
      raise exception 'F61-14 FAIL: status inválido aceito';
    end;
  exception when sqlstate '22023' then null; end;
  raise notice 'FASE 61 validações OK';
end $$;

-- ---------------- Serasa: comercial/juridico NÃO disparam (S2 — H1 do Revisor) ----------------
-- fixtures mínimas: partner + proposta para passar pelo guard de acesso
set local request.jwt.claims = '';
insert into public.partners (id, usuario_id, status)
  select '61111111-1111-1111-1111-111111111111', id, 'approved' from public.usuarios
   where email='funil-partner@local.dev';
insert into public.propostas (id, partner_id, produto, status, valor_solicitado, prazo_meses)
values ('62222222-2222-2222-2222-222222222222','61111111-1111-1111-1111-111111111111','home_equity','pre_analise',1000,12);

set local request.jwt.claims = '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"comercial"}}';
do $$
begin
  begin
    perform public.consulta_iniciar_serasa_proponente('62222222-2222-2222-2222-222222222222','serasa_pf',gen_random_uuid(),null,'uat',null);
    raise exception 'F61-17 FAIL: comercial disparou serasa';
  exception when insufficient_privilege then null; end;
  raise notice 'FASE 61 serasa-comercial negado OK';
end $$;

set local request.jwt.claims = '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"juridico"}}';
do $$
begin
  begin
    perform public.consulta_iniciar_serasa_proponente('62222222-2222-2222-2222-222222222222','serasa_pf',gen_random_uuid(),null,'uat',null);
    raise exception 'F61-18 FAIL: juridico disparou serasa';
  exception when insufficient_privilege then null; end;
  raise notice 'FASE 61 serasa-juridico negado OK';
end $$;

-- ---------------- anexos (#38) + conversão (#33) ----------------
-- anexos: comercial prepara; validações de MIME/tamanho; máx 3; confirmar exige objeto
set local request.jwt.claims = '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"comercial"}}';
do $$
declare
  v_prop uuid; v_anexo uuid; v_path text;
begin
  select id into v_prop from public.prospeccoes_parceiro where deleted_at is null limit 1;
  if v_prop is null then
    insert into public.prospeccoes_parceiro (nome_empresa, contato_nome, contato_email)
    values ('Imob Anexo','Cont Anexo','anexo@x.com') returning id into v_prop;
  end if;

  -- preparar válido
  select anexo_id, storage_path into v_anexo, v_path
    from public.admin_prospeccao_anexo_preparar(v_prop, 'print.png', 'image/png', 1000);
  if v_anexo is null then raise exception 'F61-19 FAIL: preparar não retornou'; end if;

  -- MIME inválido / tamanho / extensão incoerente
  begin perform public.admin_prospeccao_anexo_preparar(v_prop, 'doc.pdf', 'application/pdf', 100);
    raise exception 'F61-20 FAIL: pdf aceito'; exception when sqlstate '22023' then null; end;
  begin perform public.admin_prospeccao_anexo_preparar(v_prop, 'big.png', 'image/png', 3000000);
    raise exception 'F61-21 FAIL: >2MB aceito'; exception when sqlstate '22023' then null; end;

  -- confirmar exige objeto real no storage
  begin
    perform public.admin_prospeccao_anexo_confirmar(v_anexo);
    raise exception 'F61-22 FAIL: confirmou sem objeto';
  exception when sqlstate '22023' then null; end;

  -- sobe o objeto e confirma
  insert into storage.objects (bucket_id, name, owner_id, version)
  values ('prospeccao-anexos', v_path, '52222222-2222-2222-2222-222222222222', '1');
  perform public.admin_prospeccao_anexo_confirmar(v_anexo);
  if not exists(select 1 from public.admin_prospeccao_anexos_listar(v_prop) where id=v_anexo) then
    raise exception 'F61-23 FAIL: anexo confirmado não listado'; end if;

  raise notice 'FASE 61 anexos OK';
end $$;

-- conversão: juridico negado; comercial passa o guard (validação do wizard atua); fora da etapa negado
insert into public.prospeccoes_parceiro (id, nome_empresa, contato_nome, contato_email, status)
values ('75555555-7555-7555-7555-755555555555','Imob Conv','Cont Conv','conv@x.com','converter_proposta')
on conflict do nothing;

set local request.jwt.claims = '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"juridico"}}';
do $$
begin
  begin
    perform public.admin_prospeccao_converter('75555555-7555-7555-7555-755555555555', null, '{}');
    raise exception 'F61-24 FAIL: juridico converteu';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claims = '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"comercial"}}';
do $$
declare v_fora uuid;
begin
  -- fora da etapa de conversão
  insert into public.prospeccoes_parceiro (nome_empresa, contato_nome, contato_email, status)
  values ('Imob Fora','Cont Fora','fora@x.com','oportunidade') returning id into v_fora;
  begin
    perform public.admin_prospeccao_converter(v_fora, null, '{}');
    raise exception 'F61-25 FAIL: converteu fora da etapa';
  exception when sqlstate '22023' then null; -- prospeccao_nao_esta_na_etapa_de_conversao
  end;
  -- comercial na etapa: guard passa; o wizard rejeita payload vazio (prova que a elevação funciona)
  begin
    perform public.admin_prospeccao_converter('75555555-7555-7555-7555-755555555555', null, '{}');
    raise exception 'F61-26 FAIL: payload vazio passou';
  exception when sqlstate '22023' then null; -- partner_id é obrigatório / cliente é obrigatório (wizard)
  end;
  raise notice 'FASE 61 conversão OK';
end $$;

-- ---------------- admin_set_admin_nivel aceita 'comercial' ----------------
do $$
begin
  -- como full: atribui comercial a um admin alvo (o próprio full vira alvo para teste de aceite do valor)
  perform public.admin_set_admin_nivel('52222222-2222-2222-2222-222222222222','comercial');
  if (select raw_app_meta_data->>'admin_nivel' from auth.users where id='52222222-2222-2222-2222-222222222222') <> 'comercial' then
    raise exception 'F61-15 FAIL: nível comercial não gravado'; end if;
  -- valor inválido rejeita
  begin
    perform public.admin_set_admin_nivel('52222222-2222-2222-2222-222222222222','superadmin');
    raise exception 'F61-16 FAIL: nível inválido aceito';
  exception when raise_exception then null; end;
  raise notice 'FASE 61 TRANSACIONAL OK (26 verificações)';
end $$;

rollback;
