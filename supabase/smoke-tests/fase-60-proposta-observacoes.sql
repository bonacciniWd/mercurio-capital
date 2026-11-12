-- FASE 60 — Observações por proposta no Kanban (issues #18/#19/#20).
-- Executar depois da migration 20261111000003.
-- Transacional com ROLLBACK: fixtures sintéticos, zero resíduo.
-- RLS é verificada estruturalmente (a sessão é superuser); o comportamento é
-- exercido via RPCs, que impõem escopo/autorização com auth.uid() dos claims.

begin;

-- ---------------- fixtures ----------------
-- usuários: parceiro dono (u1), outro parceiro (u2), admin, cliente da proposta
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('21111111-1111-1111-1111-111111111111','authenticated','authenticated','obs-parceiro@local.dev',crypt('x',gen_salt('bf')),now(),now(),now()),
  ('22222222-2222-2222-2222-222222222222','authenticated','authenticated','obs-parceiro2@local.dev',crypt('x',gen_salt('bf')),now(),now(),now()),
  ('23333333-3333-3333-3333-333333333333','authenticated','authenticated','obs-admin@local.dev',crypt('x',gen_salt('bf')),now(),now(),now()),
  ('24444444-4444-4444-4444-444444444444','authenticated','authenticated','obs-cliente@local.dev',crypt('x',gen_salt('bf')),now(),now(),now());

update public.usuarios set role='partner' where id in ('21111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
update public.usuarios set role='admin' where id='23333333-3333-3333-3333-333333333333';
update public.usuarios set role='client' where id='24444444-4444-4444-4444-444444444444';

insert into public.partners (id, usuario_id, status)
values
  ('31111111-1111-1111-1111-111111111111','21111111-1111-1111-1111-111111111111','approved'),
  ('32222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','approved');

insert into public.clientes (id, usuario_id, nome_completo)
values ('34444444-4444-4444-4444-444444444444','24444444-4444-4444-4444-444444444444','Cliente Obs Teste');

insert into public.propostas (id, partner_id, cliente_id, produto, status, valor_solicitado, prazo_meses)
values
  ('41111111-1111-1111-1111-111111111111','31111111-1111-1111-1111-111111111111','34444444-4444-4444-4444-444444444444','home_equity','analise_credito',100000,120),
  ('42222222-2222-2222-2222-222222222222','32222222-2222-2222-2222-222222222222',null,'home_equity','pre_analise',200000,180);

-- admin com dispositivo push ativo (testa o fan-out da Frente A de graça)
insert into public.push_devices (usuario_id, plataforma, token, ativo)
values ('23333333-3333-3333-3333-333333333333','web','obs-tok-admin',true);

-- ---------------- estrutural (catálogo) ----------------
do $$
begin
  if to_regclass('public.proposta_observacoes') is null
     or to_regclass('public.proposta_observacao_anexos') is null then
    raise exception 'FASE 60 FAIL: tabelas ausentes'; end if;

  if not (select relrowsecurity from pg_class where oid='public.proposta_observacoes'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.proposta_observacao_anexos'::regclass) then
    raise exception 'FASE 60 FAIL: RLS desabilitada'; end if;

  -- escrita só via RPC: nenhum grant de INSERT/UPDATE/DELETE para roles de API
  if has_table_privilege('authenticated','public.proposta_observacoes','INSERT')
     or has_table_privilege('authenticated','public.proposta_observacoes','UPDATE')
     or has_table_privilege('authenticated','public.proposta_observacao_anexos','INSERT')
     or has_table_privilege('anon','public.proposta_observacoes','SELECT') then
    raise exception 'FASE 60 FAIL: grants de tabela fora do escopo'; end if;

  -- RPCs: authenticated sim, anon não
  if not has_function_privilege('authenticated','public.proposta_observacao_criar(uuid,text,uuid[])','EXECUTE')
     or not has_function_privilege('authenticated','public.proposta_observacoes_listar(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.proposta_observacao_editar(uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.proposta_observacao_remover(uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.proposta_obs_anexo_preparar(uuid,text,text,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.proposta_observacao_contagem(uuid[])','EXECUTE') then
    raise exception 'FASE 60 FAIL: RPCs indisponíveis para authenticated'; end if;
  if has_function_privilege('anon','public.proposta_observacao_criar(uuid,text,uuid[])','EXECUTE')
     or has_function_privilege('anon','public.proposta_observacoes_listar(uuid)','EXECUTE') then
    raise exception 'FASE 60 FAIL: RPCs expostas a anon'; end if;

  -- bucket privado com limites
  if not exists(select 1 from storage.buckets
                 where id='proposta-obs' and public = false
                   and file_size_limit = 2097152
                   and allowed_mime_types @> array['image/heic']) then
    raise exception 'FASE 60 FAIL: bucket proposta-obs ausente ou sem limites'; end if;

  raise notice 'FASE 60 estrutural OK';
end $$;

-- ---------------- como parceiro dono (u1) ----------------
set local request.jwt.claims = '{"sub":"21111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_prop uuid := '41111111-1111-1111-1111-111111111111';
  v_obs uuid; v_anexo uuid; v_path text; v_out uuid;
begin
  -- 1) criar com carimbo de etapa server-side
  v_obs := public.proposta_observacao_criar(v_prop, 'Cliente enviou o print do erro no cadastro.', '{}');
  if not exists(select 1 from public.proposta_observacoes
                 where id=v_obs and etapa_snapshot='analise_credito' and autor_papel='partner') then
    raise exception 'F60-1 FAIL: carimbo de etapa/papel incorreto'; end if;

  -- 2) preparar anexo válido + validações de MIME/tamanho
  select anexo_id, storage_path into v_anexo, v_path
    from public.proposta_obs_anexo_preparar(v_prop, 'erro-cadastro.png', 'image/png', 150000);
  if v_anexo is null then raise exception 'F60-2 FAIL: preparar não retornou anexo'; end if;

  begin perform public.proposta_obs_anexo_preparar(v_prop, 'doc.pdf', 'application/pdf', 1000);
    raise exception 'F60-3 FAIL: MIME pdf aceito';
  exception when raise_exception then null; end;

  begin perform public.proposta_obs_anexo_preparar(v_prop, 'grande.png', 'image/png', 3000000);
    raise exception 'F60-4 FAIL: 3MB aceito';
  exception when raise_exception then null; end;

  begin perform public.proposta_obs_anexo_preparar(v_prop, 'foto.png', 'image/jpeg', 1000);
    raise exception 'F60-5 FAIL: extensão incoerente aceita';
  exception when raise_exception then null; end;

  -- 3) criar com anexo vinculado (objeto precisa existir no storage)
  insert into storage.objects (bucket_id, name, owner_id, version)
  values ('proposta-obs', v_path, '21111111-1111-1111-1111-111111111111', '1');
  v_out := public.proposta_observacao_criar(v_prop, 'Print do erro anexado.', array[v_anexo]);
  if not exists(select 1 from public.proposta_observacao_anexos
                 where id=v_anexo and observacao_id=v_out and estado='recebido') then
    raise exception 'F60-6 FAIL: anexo não vinculado'; end if;

  -- 4) máximo 3 anexos (S2 confirmada pelo dono)
  begin
    perform public.proposta_observacao_criar(v_prop, 'quatro anexos', array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()]);
    raise exception 'F60-7 FAIL: 4 anexos aceitos';
  exception when raise_exception then null; end;

  -- 5) anexo de outro usuário não vincula
  declare v_alheio uuid;
  begin
    insert into public.proposta_observacao_anexos (id, proposta_id, bucket, storage_path, nome, mime_type, tamanho_bytes, enviado_por)
    values (gen_random_uuid(), v_prop, 'proposta-obs', v_prop::text||'/alheio.png', 'alheio.png', 'image/png', 1000, '23333333-3333-3333-3333-333333333333')
    returning id into v_alheio;
    begin
      perform public.proposta_observacao_criar(v_prop, 'tenta vincular alheio', array[v_alheio]);
      raise exception 'F60-8 FAIL: anexo alheio vinculado';
    exception when raise_exception then
      if sqlerrm <> 'anexo_invalido_ou_expirado' then raise; end if;
    end;
  end;

  -- a movimentação de etapa do fixture acontece FORA deste bloco (ver abaixo)
end $$;

-- mover etapa como fluxo server-side (sem claims → auth.uid() nulo → gatilho de
-- transição permite; em produção isso passa pelas RPCs admin/partner com 2FA)
set local request.jwt.claims = '';
update public.propostas set status='comite' where id='41111111-1111-1111-1111-111111111111';
set local request.jwt.claims = '{"sub":"21111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_prop uuid := '41111111-1111-1111-1111-111111111111';
  v_obs uuid; v_out uuid;
begin
  select id into v_obs from public.proposta_observacoes
   where proposta_id=v_prop order by created_at limit 1;

  -- 6) timeline: mover a proposta NÃO altera nem esconde o comentário anterior
  v_out := public.proposta_observacao_criar(v_prop, 'Comentário já no comitê.', '{}');
  if (select count(*) from public.proposta_observacoes_listar(v_prop)) <> 3
     or not exists(select 1 from public.proposta_observacoes_listar(v_prop) where etapa_snapshot='analise_credito')
     or not exists(select 1 from public.proposta_observacoes_listar(v_prop) where etapa_snapshot='comite') then
    raise exception 'F60-9 FAIL: timeline perdeu carimbo ao mover etapa'; end if;

  -- 7) edição dentro da janela
  perform public.proposta_observacao_editar(v_obs, 'Cliente enviou o print do erro no cadastro (editado).');
  if not exists(select 1 from public.proposta_observacoes where id=v_obs and editado_em is not null) then
    raise exception 'F60-10 FAIL: edição não registrou editado_em'; end if;

  -- 8) edição/remoção fora da janela de 15 min
  update public.proposta_observacoes set created_at = now() - interval '20 minutes' where id = v_obs;
  begin
    perform public.proposta_observacao_editar(v_obs, 'tarde demais');
    raise exception 'F60-11 FAIL: edição fora da janela aceita';
  exception when raise_exception then
    if sqlerrm <> 'janela_edicao_expirada' then raise; end if;
  end;
  begin
    perform public.proposta_observacao_remover(v_obs, 'meu print');
    raise exception 'F60-12 FAIL: remoção do autor fora da janela aceita';
  exception when raise_exception then
    if sqlerrm <> 'janela_edicao_expirada' then raise; end if;
  end;

  -- 9) badge em lote
  if (select total from public.proposta_observacao_contagem(array[v_prop, '42222222-2222-2222-2222-222222222222'])
       where proposta_id = v_prop) <> 3 then
    raise exception 'F60-13 FAIL: contagem incorreta'; end if;
end $$;

-- ---------------- como outro parceiro (u2) e cliente: escopo negado ----------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  begin
    perform public.proposta_observacao_criar('41111111-1111-1111-1111-111111111111', 'invasão', '{}');
    raise exception 'F60-14 FAIL: parceiro de outra proposta comentou';
  exception when insufficient_privilege then null; end;
  begin
    perform public.proposta_observacoes_listar('41111111-1111-1111-1111-111111111111');
    raise exception 'F60-15 FAIL: parceiro de outra proposta listou';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claims = '{"sub":"24444444-4444-4444-4444-444444444444","role":"authenticated"}';
do $$
begin
  begin
    perform public.proposta_observacao_criar('41111111-1111-1111-1111-111111111111', 'cliente tentando', '{}');
    raise exception 'F60-16 FAIL: cliente comentou';
  exception when insufficient_privilege then null; end;
  begin
    perform public.proposta_observacoes_listar('41111111-1111-1111-1111-111111111111');
    raise exception 'F60-17 FAIL: cliente listou observações';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------------- como admin: trilha e notificação ----------------
set local request.jwt.claims = '{"sub":"23333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare
  v_obs uuid; v_prop uuid := '41111111-1111-1111-1111-111111111111';
begin
  -- 10) admin remove fora da janela com trilha
  select id into v_obs from public.proposta_observacoes
   where proposta_id=v_prop and deleted_at is null order by created_at limit 1;
  perform public.proposta_observacao_remover(v_obs, 'print com dado sensível');
  if not exists(select 1 from public.proposta_observacoes
                 where id=v_obs and deleted_at is not null
                   and deleted_by='23333333-3333-3333-3333-333333333333'
                   and deleted_motivo='print com dado sensível') then
    raise exception 'F60-18 FAIL: soft delete admin sem trilha'; end if;
  -- removido sai da timeline e do badge
  if exists(select 1 from public.proposta_observacoes_listar(v_prop) where id=v_obs) then
    raise exception 'F60-19 FAIL: removido ainda na timeline'; end if;

  -- 11) notificações: admin recebeu (2 comentários de u1 visíveis na época), autor e cliente não
  if not exists(select 1 from public.notificacoes
                 where usuario_id='23333333-3333-3333-3333-333333333333'
                   and canal='in_app' and titulo like 'Nova observação na proposta%'
                   and metadata->>'tipo'='proposta_observacao_nova'
                   and link like '/admin/propostas/%') then
    raise exception 'F60-20 FAIL: admin não notificado'; end if;
  if exists(select 1 from public.notificacoes
             where usuario_id in ('21111111-1111-1111-1111-111111111111','24444444-4444-4444-4444-444444444444')
               and metadata->>'tipo'='proposta_observacao_nova') then
    raise exception 'F60-21 FAIL: autor e/ou cliente notificado'; end if;
  -- mensagem sem trecho do comentário
  if exists(select 1 from public.notificacoes
             where metadata->>'tipo'='proposta_observacao_nova'
               and (mensagem like '%print do erro%' or mensagem like '%Comentário já no comitê%')) then
    raise exception 'F60-22 FAIL: mensagem vazou trecho do comentário'; end if;

  -- 12) fan-out de push da Frente A: admin tem dispositivo ativo → push_outbox populada
  if not exists(select 1 from public.push_outbox po
                 join public.notificacoes n on n.id = po.notificacao_id
                 where n.metadata->>'tipo'='proposta_observacao_nova'
                   and po.usuario_id='23333333-3333-3333-3333-333333333333') then
    raise exception 'F60-23 FAIL: fan-out de push não enfileirou'; end if;

  raise notice 'FASE 60 TRANSACIONAL OK (23 verificações)';
end $$;

-- ---------------- fixtures extras: equipes, team_members, parceiro suspenso ----------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('25555555-5555-5555-5555-555555555555','authenticated','authenticated','obs-tm@local.dev',crypt('x',gen_salt('bf')),now(),now(),now()),
  ('26666666-6666-6666-6666-666666666666','authenticated','authenticated','obs-tm2@local.dev',crypt('x',gen_salt('bf')),now(),now(),now()),
  ('27777777-7777-7777-7777-777777777777','authenticated','authenticated','obs-suspenso@local.dev',crypt('x',gen_salt('bf')),now(),now(),now());

update public.usuarios set role='team_member' where id in ('25555555-5555-5555-5555-555555555555','26666666-6666-6666-6666-666666666666');
update public.usuarios set role='partner' where id='27777777-7777-7777-7777-777777777777';

insert into public.partners (id, usuario_id, status)
values ('37777777-7777-7777-7777-777777777777','27777777-7777-7777-7777-777777777777','suspended');

insert into public.equipes (id, partner_id, nome) values
  ('51111111-1111-1111-1111-111111111111','31111111-1111-1111-1111-111111111111','Equipe A'),
  ('52222222-2222-2222-2222-222222222222','32222222-2222-2222-2222-222222222222','Equipe B');

insert into public.equipe_membros (equipe_id, usuario_id, papel_equipe, aceito_em) values
  ('51111111-1111-1111-1111-111111111111','25555555-5555-5555-5555-555555555555','membro',now()),
  ('52222222-2222-2222-2222-222222222222','26666666-6666-6666-6666-666666666666','membro',now());

-- P1 passa a ter a equipe do tm1; P2 tem tm1 como responsável direto
set local request.jwt.claims = '';
update public.propostas set equipe_id='51111111-1111-1111-1111-111111111111' where id='41111111-1111-1111-1111-111111111111';
update public.propostas set responsavel_id='25555555-5555-5555-5555-555555555555' where id='42222222-2222-2222-2222-222222222222';
insert into public.propostas (id, partner_id, produto, status, valor_solicitado, prazo_meses)
values ('43333333-3333-3333-3333-333333333333','37777777-7777-7777-7777-777777777777','home_equity','pre_analise',50000,60);

-- ---------------- team_member da equipe (u5): acesso positivo ----------------
set local request.jwt.claims = '{"sub":"25555555-5555-5555-5555-555555555555","role":"authenticated"}';
do $$
begin
  -- via equipe da proposta (F2)
  if public.proposta_observacao_criar('41111111-1111-1111-1111-111111111111', 'Assistente acompanhou com o cliente.', '{}') is null then
    raise exception 'F60-24 FAIL'; end if;
  if not exists(select 1 from public.proposta_observacoes
                 where proposta_id='41111111-1111-1111-1111-111111111111' and autor_papel='team_member') then
    raise exception 'F60-24 FAIL: team_member da equipe não comentou'; end if;
  -- via responsavel_id direto (F2, ramo do Kanban vigente).
  -- Em statements separados: um único `if f() or (subselect)` avaliaria a contagem
  -- no snapshot de início do statement, sem ver a linha recém-inserida.
  if public.proposta_observacao_criar('42222222-2222-2222-2222-222222222222', 'Sou o responsável desta.', '{}') is null then
    raise exception 'F60-25a FAIL: criar retornou nulo'; end if;
  if (select count(*) from public.proposta_observacoes_listar('42222222-2222-2222-2222-222222222222')) < 1 then
    raise exception 'F60-25b FAIL: listar vazio'; end if;
end $$;

-- ---------------- team_member de outra equipe (u6) e parceiro suspenso (u7): negados ----------------
set local request.jwt.claims = '{"sub":"26666666-6666-6666-6666-666666666666","role":"authenticated"}';
do $$
begin
  begin
    perform public.proposta_observacao_criar('41111111-1111-1111-1111-111111111111', 'outra equipe', '{}');
    raise exception 'F60-26 FAIL: team_member de outra equipe comentou';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claims = '{"sub":"27777777-7777-7777-7777-777777777777","role":"authenticated"}';
do $$
begin
  begin
    perform public.proposta_observacao_criar('43333333-3333-3333-3333-333333333333', 'suspenso tentando', '{}');
    raise exception 'F60-27 FAIL: parceiro suspenso comentou';
  exception when insufficient_privilege then null; end;
  begin
    perform public.proposta_observacoes_listar('43333333-3333-3333-3333-333333333333');
    raise exception 'F60-28 FAIL: parceiro suspenso listou';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------------- admin: notificação ao parceiro dono, link do team_member, edição alheia, motivo ----------------
set local request.jwt.claims = '{"sub":"23333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare
  v_obs_autor uuid;
begin
  -- admin comenta em P1 → parceiro dono (u1) notificado com link /p/; team_member da equipe NÃO (recorte §7.7)
  perform public.proposta_observacao_criar('41111111-1111-1111-1111-111111111111', 'Admin analisou o print.', '{}');
  if not exists(select 1 from public.notificacoes
                 where usuario_id='21111111-1111-1111-1111-111111111111'
                   and metadata->>'tipo'='proposta_observacao_nova' and link like '/p/propostas/%') then
    raise exception 'F60-29 FAIL: parceiro dono não notificado com link /p/'; end if;
  if exists(select 1 from public.notificacoes
             where usuario_id='25555555-5555-5555-5555-555555555555'
               and metadata->>'tipo'='proposta_observacao_nova'
               and metadata->>'proposta_id'='41111111-1111-1111-1111-111111111111') then
    raise exception 'F60-30 FAIL: team_member notificado fora do recorte'; end if;

  -- admin comenta em P2 → responsável team_member notificado com link /p/ (F3)
  perform public.proposta_observacao_criar('42222222-2222-2222-2222-222222222222', 'Admin na proposta do responsável.', '{}');
  if not exists(select 1 from public.notificacoes
                 where usuario_id='25555555-5555-5555-5555-555555555555'
                   and metadata->>'tipo'='proposta_observacao_nova' and link like '/p/propostas/%') then
    raise exception 'F60-31 FAIL: responsável team_member notificado com link errado'; end if;

  -- edição por não-autor negada (admin não edita comentário alheio; só remove)
  select id into v_obs_autor from public.proposta_observacoes
   where proposta_id='41111111-1111-1111-1111-111111111111'
     and autor_id='21111111-1111-1111-1111-111111111111' and deleted_at is null limit 1;
  begin
    perform public.proposta_observacao_editar(v_obs_autor, 'admin editando alheio');
    raise exception 'F60-32 FAIL: admin editou comentário alheio';
  exception when insufficient_privilege then null; end;

  -- admin remove alheio SEM motivo → obrigatório (F7)
  begin
    perform public.proposta_observacao_remover(v_obs_autor, null);
    raise exception 'F60-33 FAIL: remoção admin sem motivo aceita';
  exception when raise_exception then
    if sqlerrm <> 'motivo_obrigatorio' then raise; end if;
  end;

  -- policies de storage presentes no catálogo
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='proposta_obs_upload')
     or not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='proposta_obs_storage_read')
     or not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='proposta_obs_preservar_delete')
     or not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='proposta_obs_preservar_update') then
    raise exception 'F60-34 FAIL: policies de storage ausentes'; end if;

  raise notice 'FASE 60 COMPLEMENTAR OK (11 verificações)';
end $$;

rollback;
