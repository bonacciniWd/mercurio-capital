-- FASE 59 (transacional) — comportamento do Push Web com fixtures em transação + ROLLBACK.
-- Executar depois da migration 20261111000001. Não persiste nada (sempre rollback).
-- Complemento comportamental do fase-59-push-web.sql (estrutural, read-only).
begin;

-- fixture: usuário autenticado (trigger handle_new_user cria a linha em public.usuarios)
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
        'push-teste@local.dev', crypt('x', gen_salt('bf')), now(), now(), now());

-- simula chamada authenticated (auth.uid()/auth.role() leem estes claims)
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_uid uuid := '11111111-1111-1111-1111-111111111111';
  v_dev uuid; v_out uuid; v_out2 uuid;
begin
  -- 1) upsert de token registra dispositivo ativo
  v_dev := public.push_subscription_upsert('tokA', 'Mozilla/5.0 (teste)');
  if not exists(select 1 from public.push_devices where id=v_dev and ativo and usuario_id=v_uid) then
    raise exception 'B1 FAIL: token não registrado'; end if;

  -- 2) token vazio/inválido rejeitado
  begin
    perform public.push_subscription_upsert('');
    raise exception 'B2 FAIL: token vazio aceito';
  exception when raise_exception then null; -- esperado
  end;

  -- 3) notificação in_app enfileira push
  insert into public.notificacoes (usuario_id, canal, titulo, mensagem, link)
  values (v_uid, 'in_app', 'Pendência criada', 'Doc RG pendente', '/p/propostas/1');
  select id into v_out2 from public.push_outbox where usuario_id=v_uid and status='pendente';
  if v_out2 is null then
    raise exception 'B3 FAIL: fan-out in_app não enfileirou'; end if;

  -- 4) opt-out bloqueia novos enqueues e desativa tokens
  perform public.push_preferencia_set(true);
  insert into public.notificacoes (usuario_id, canal, titulo, mensagem)
  values (v_uid, 'in_app', 'Status mudou', 'Em análise');
  if (select count(*) from public.push_outbox where usuario_id=v_uid) <> 1 then
    raise exception 'B4 FAIL: opt-out não bloqueou enqueue'; end if;
  if exists(select 1 from public.push_devices where usuario_id=v_uid and ativo) then
    raise exception 'B5 FAIL: opt-out não desativou tokens'; end if;

  -- 5) pull cancela pendências de quem fez opt-out (higiene no dispatch)
  perform public.push_outbox_pull(10);
  if (select status from public.push_outbox where id=v_out2) <> 'cancelado' then
    raise exception 'B6 FAIL: pull não cancelou pendência de opt-out'; end if;

  -- 6) reativação + canal 'push' também faz fan-out
  perform public.push_preferencia_set(false);
  perform public.push_subscription_upsert('tokA', 'Mozilla/5.0 (teste)');
  insert into public.notificacoes (usuario_id, canal, titulo, mensagem)
  values (v_uid, 'push', 'Doc validado', 'RG aprovado');
  select id into v_out from public.push_outbox where usuario_id=v_uid and status='pendente';
  if v_out is null then raise exception 'B7 FAIL: canal push não enfileirou'; end if;

  -- 7) pull marca 'enviando' e incrementa tentativas; requeue aplica backoff exponencial
  perform public.push_outbox_pull(10);
  if (select status from public.push_outbox where id=v_out) <> 'enviando'
     or (select tentativas from public.push_outbox where id=v_out) <> 1 then
    raise exception 'B8 FAIL: pull não marcou enviando/tentativas'; end if;
  perform public.push_outbox_marcar(v_out, 'pendente', 'timeout FCM');
  if (select proxima_tentativa_at from public.push_outbox where id=v_out) <= now() then
    raise exception 'B9 FAIL: requeue sem backoff'; end if;

  -- 8) sweeper: 'enviando' órfão (>10 min) volta para 'pendente' no próximo pull
  --    (trigger set_updated_at sempre sobrescreve updated_at; desabilitamos só p/ o fixture)
  alter table public.push_outbox disable trigger trg_push_outbox_updated_at;
  update public.push_outbox set status='enviando', updated_at = now() - interval '11 minutes',
         proxima_tentativa_at = now() where id=v_out;
  alter table public.push_outbox enable trigger trg_push_outbox_updated_at;
  perform public.push_outbox_pull(10);
  if (select tentativas from public.push_outbox where id=v_out) <> 2 then
    raise exception 'B10 FAIL: sweeper não reenfileirou enviando órfão'; end if;

  -- 9) estado terminal: pendente com 5 tentativas vira 'falha' no pull
  update public.push_outbox set status='pendente', tentativas=5, proxima_tentativa_at=now() where id=v_out;
  perform public.push_outbox_pull(10);
  if (select status from public.push_outbox where id=v_out) <> 'falha' then
    raise exception 'B11 FAIL: pendência com 5 tentativas não virou falha'; end if;

  -- 10) limpeza de token morto (service_role)
  perform public.push_device_desativar('tokA');
  if exists(select 1 from public.push_devices where token='tokA' and ativo) then
    raise exception 'B12 FAIL: token não desativado'; end if;

  -- 11) catálogo: authenticated/anon sem EXECUTE nas RPCs do dispatcher
  --     (a sessão é superuser; a verificação de privilégio real é via pg_proc)
  if has_function_privilege('authenticated','public.push_outbox_pull(integer)','EXECUTE')
     or has_function_privilege('anon','public.push_outbox_marcar(uuid,text,text)','EXECUTE') then
    raise exception 'B13 FAIL: dispatcher exposto no catálogo'; end if;

  raise notice 'FASE 59 TRANSACIONAL OK (13 verificações)';
end $$;

rollback;
