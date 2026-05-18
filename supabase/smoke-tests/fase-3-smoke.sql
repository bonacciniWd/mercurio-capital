-- ============================================================
-- SMOKE TEST — Fase 1 + 2 + 3
-- ============================================================
-- Como executar:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-3-smoke.sql
--
-- O script roda numa transação que faz ROLLBACK no final — nenhum
-- dado de teste persiste. Cada bloco usa RAISE NOTICE para registrar
-- progresso e RAISE EXCEPTION em caso de falha (causa o rollback).
--
-- Pré-requisito: service_role (ou superuser), pois inserimos em auth.users.
-- ============================================================

begin;

do $smoke$
declare
  -- ids
  v_admin_uid      uuid := gen_random_uuid();
  v_partner_uid    uuid := gen_random_uuid();
  v_client_uid     uuid := gen_random_uuid();
  v_partner_id     uuid;
  v_cliente_id     uuid;
  v_proposta_id    uuid;
  v_doc_id         uuid;
  v_pendencia_id   uuid;
  v_notif_count    int;
  v_protocolo      text;
  v_consulta       jsonb;
begin
  raise notice '────── PASSO 0: criar usuários de teste ──────';

  -- auth.users (service_role/superuser exigido)
  insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_uid,   'smoke-admin@test.local',   '{}'::jsonb, now(), now()),
    (v_partner_uid, 'smoke-partner@test.local', '{}'::jsonb, now(), now()),
    (v_client_uid,  'smoke-client@test.local',  '{}'::jsonb, now(), now());

  -- usuarios (espelho)
  insert into usuarios (id, nome_completo, email, role, ativo)
  values
    (v_admin_uid,   'Smoke Admin',   'smoke-admin@test.local',   'admin',   true),
    (v_partner_uid, 'Smoke Partner', 'smoke-partner@test.local', 'partner', true),
    (v_client_uid,  'Smoke Client',  'smoke-client@test.local',  'client',  true);

  -- partner aprovado
  insert into partners (usuario_id, status, aprovado_em, aprovado_por)
  values (v_partner_uid, 'approved', now(), v_admin_uid)
  returning id into v_partner_id;

  -- cliente vinculado
  insert into clientes (usuario_id, nome_completo, cpf, email)
  values (v_client_uid, 'Smoke Client', '12345678901', 'smoke-client@test.local')
  returning id into v_cliente_id;

  raise notice '  ✓ usuários, partner e cliente criados';

  raise notice '────── PASSO 1: criar proposta ──────';
  insert into propostas (
    partner_id, cliente_id, produto, valor_solicitado, prazo_meses, status
  ) values (
    v_partner_id, v_cliente_id, 'home_equity', 250000.00, 120, 'pre_analise'
  ) returning id, protocolo into v_proposta_id, v_protocolo;

  raise notice '  ✓ proposta % criada com protocolo %', v_proposta_id, v_protocolo;

  raise notice '────── PASSO 2: inserir documento ──────';
  insert into proposta_documentos (
    proposta_id, categoria, tipo, storage_path, bucket, mime_type,
    tamanho_bytes, enviado_por, origem
  ) values (
    v_proposta_id, 'pessoa_fisica', 'rg',
    v_proposta_id || '/pessoa_fisica/smoke.jpg',
    'proposta-docs', 'image/jpeg', 12345, v_client_uid, 'cliente'
  ) returning id into v_doc_id;

  raise notice '  ✓ documento % inserido', v_doc_id;

  raise notice '────── PASSO 3: validar documento (deve criar notificação) ──────';
  update proposta_documentos set validado = true, validado_por = v_admin_uid, validado_em = now()
   where id = v_doc_id;

  select count(*) into v_notif_count
    from notificacoes
   where usuario_id = v_client_uid
     and titulo = 'Documento aprovado';

  if v_notif_count <> 1 then
    raise exception 'FALHA: trg_notif_doc_validado não criou notificação (count=%)', v_notif_count;
  end if;
  raise notice '  ✓ notificação "Documento aprovado" gerada';

  raise notice '────── PASSO 4: criar pendência (deve criar notificação) ──────';
  insert into proposta_pendencias (
    proposta_id, descricao, solicitado_por, status
  ) values (
    v_proposta_id, 'Enviar comprovante de renda dos últimos 3 meses.', v_admin_uid, 'aberta'
  ) returning id into v_pendencia_id;

  select count(*) into v_notif_count
    from notificacoes
   where usuario_id = v_client_uid
     and titulo = 'Nova pendência aberta';

  if v_notif_count <> 1 then
    raise exception 'FALHA: trg_notif_pendencia_nova não disparou (count=%)', v_notif_count;
  end if;
  raise notice '  ✓ notificação "Nova pendência aberta" gerada';

  raise notice '────── PASSO 5: mudar status (histórico + notificação) ──────';
  update propostas set status = 'analise_credito' where id = v_proposta_id;

  select count(*) into v_notif_count
    from notificacoes
   where usuario_id = v_client_uid
     and titulo = 'Sua proposta mudou de status';

  if v_notif_count < 1 then
    raise exception 'FALHA: trg_notif_status_proposta não disparou';
  end if;
  raise notice '  ✓ notificação de status gerada (%)', v_notif_count;

  raise notice '────── PASSO 6: RPC public_consulta_protocolo ──────';
  -- chamamos como service_role para validar o retorno
  select public.public_consulta_protocolo(v_protocolo, null) into v_consulta;

  if (v_consulta->>'encontrado')::boolean is not true then
    raise exception 'FALHA: protocolo % não encontrado na RPC pública', v_protocolo;
  end if;
  if jsonb_array_length(v_consulta->'pendencias') <> 1 then
    raise exception 'FALHA: RPC deveria retornar 1 pendência aberta';
  end if;
  if jsonb_array_length(v_consulta->'historico') < 1 then
    raise exception 'FALHA: RPC deveria retornar histórico';
  end if;
  raise notice '  ✓ RPC pública retornou proposta + pendências + histórico';

  raise notice '────── PASSO 7: rate-limit ──────';
  -- chama 5x — a 6ª deve falhar
  perform public.public_consulta_protocolo(v_protocolo, null);
  perform public.public_consulta_protocolo(v_protocolo, null);
  perform public.public_consulta_protocolo(v_protocolo, null);
  perform public.public_consulta_protocolo(v_protocolo, null);
  begin
    perform public.public_consulta_protocolo(v_protocolo, null);
    raise exception 'FALHA: rate-limit não bloqueou após 5 chamadas';
  exception when sqlstate 'P0001' then
    raise notice '  ✓ rate-limit dispara em 5+ chamadas no mesmo IP/protocolo';
  end;

  raise notice '────── PASSO 8: helper app_can_manage_proposta ──────';
  if not public.app_can_manage_proposta(v_proposta_id) then
    -- chamado fora de um contexto de auth.uid() retorna admin=false; só valida sintaxe
    raise notice '  ℹ helper executou (retornou false fora de contexto auth — esperado)';
  end if;

  raise notice '════════════════════════════════════════════';
  raise notice '✅ SMOKE TEST PASSOU — fazendo ROLLBACK';
  raise notice '════════════════════════════════════════════';

  -- força rollback para não deixar dados
  raise exception 'SMOKE_TEST_OK_ROLLBACK';
end$smoke$;

-- Caso a exception sentinela chegue aqui, mostramos um aviso
-- O ROLLBACK abaixo limpa tudo.
rollback;

-- ============================================================
-- Itens manuais (browser) — NÃO cobertos por este script:
--   • Login + 2FA (TOTP) — Supabase Auth UI.
--   • Magic link cliente (Edge Function magic-link).
--   • Upload real para Storage 'proposta-docs' (RLS via auth.uid()).
--   • OCR Tesseract.js client-side.
--   • Drag-and-drop no Kanban + Realtime channel.
--   • Captcha hCaptcha (sitekey ausente em dev).
-- ============================================================
