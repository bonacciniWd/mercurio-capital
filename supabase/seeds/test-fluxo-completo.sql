-- =====================================================================
-- SEED DE TESTE — FLUXO COMPLETO CLIENTE <-> PARCEIRO <-> ADMIN
-- =====================================================================
-- Objetivo: popular o banco com usuários e dados mínimos para validar
-- ponta a ponta o fluxo das fases 1–8 (autenticação, proposta, aprovação,
-- contrato, liberação, comissão e LMS).
--
-- USO (Supabase Dashboard → SQL Editor, com service_role):
--   1. Cole este arquivo inteiro e execute.
--   2. Faça login no app com qualquer um dos 3 usuários abaixo.
--
-- CREDENCIAIS GERADAS:
--   Admin    : admin.teste@mercuriocapital.dev   / Test@1234
--   Parceiro : parceiro.teste@mercuriocapital.dev / Test@1234
--   Cliente  : cliente.teste@mercuriocapital.dev  / Test@1234
--
-- IDs determinísticos (facilita re-execução / cleanup):
--   admin_user  = 11111111-1111-1111-1111-111111111111
--   partner_usr = 22222222-2222-2222-2222-222222222222
--   cliente_usr = 33333333-3333-3333-3333-333333333333
--   partner_id  = 44444444-4444-4444-4444-444444444444
--   cliente_id  = 55555555-5555-5555-5555-555555555555
--   proposta_id = 66666666-6666-6666-6666-666666666666
--   curso_id    = 99999999-9999-9999-9999-999999999999
--
-- O script é IDEMPOTENTE: pode ser rodado mais de uma vez sem erro.
-- Para limpar tudo, veja o bloco "ROLLBACK / CLEANUP" no final (comentado).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensões necessárias (já habilitadas em Supabase, mas garantimos)
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

-- =====================================================================
-- 1) AUTH.USERS — cria os 3 usuários de teste com password "Test@1234"
-- =====================================================================
-- O trigger handle_new_user() copia para public.usuarios automaticamente
-- (lê role de raw_app_meta_data->>'role' OU raw_user_meta_data->>'role').

do $$
declare
  v_admin_id   uuid := '11111111-1111-1111-1111-111111111111';
  v_partner_id uuid := '22222222-2222-2222-2222-222222222222';
  v_cliente_id uuid := '33333333-3333-3333-3333-333333333333';
  v_password   text := crypt('Test@1234', gen_salt('bf'));
begin
  -- ---- ADMIN -------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_admin_id, 'authenticated', 'authenticated',
    'admin.teste@mercuriocapital.dev', v_password,
    now(), null, null,
    jsonb_build_object('provider','email','providers',array['email'],'role','admin'),
    jsonb_build_object('nome_completo','Admin Teste','role','admin'),
    now(), now(), '', '', '', ''
  ) on conflict (id) do update set
    encrypted_password = excluded.encrypted_password,
    raw_app_meta_data  = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    email_confirmed_at = now(),
    updated_at         = now();

  -- ---- PARCEIRO ----------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_partner_id, 'authenticated', 'authenticated',
    'parceiro.teste@mercuriocapital.dev', v_password,
    now(),
    -- role + partner_id + approved são lidos por app_partner_id()/app_is_approved()
    jsonb_build_object(
      'provider','email','providers',array['email'],
      'role','partner',
      'partner_id','44444444-4444-4444-4444-444444444444',
      'approved', true
    ),
    jsonb_build_object('nome_completo','Parceiro Teste','role','partner','telefone','11999990001'),
    now(), now(), '', '', '', ''
  ) on conflict (id) do update set
    encrypted_password = excluded.encrypted_password,
    raw_app_meta_data  = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    email_confirmed_at = now(),
    updated_at         = now();

  -- ---- CLIENTE -----------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_cliente_id, 'authenticated', 'authenticated',
    'cliente.teste@mercuriocapital.dev', v_password,
    now(),
    jsonb_build_object('provider','email','providers',array['email'],'role','client'),
    jsonb_build_object('nome_completo','Cliente Teste','role','client','telefone','11999990002'),
    now(), now(), '', '', '', ''
  ) on conflict (id) do update set
    encrypted_password = excluded.encrypted_password,
    raw_app_meta_data  = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    email_confirmed_at = now(),
    updated_at         = now();
end$$;

-- =====================================================================
-- 2) AUTH.IDENTITIES — necessário p/ login email/senha em GoTrue v2.x
-- =====================================================================
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(),
   '11111111-1111-1111-1111-111111111111',
   jsonb_build_object('sub','11111111-1111-1111-1111-111111111111','email','admin.teste@mercuriocapital.dev','email_verified',true),
   'email','11111111-1111-1111-1111-111111111111', now(), now(), now()),
  (gen_random_uuid(),
   '22222222-2222-2222-2222-222222222222',
   jsonb_build_object('sub','22222222-2222-2222-2222-222222222222','email','parceiro.teste@mercuriocapital.dev','email_verified',true),
   'email','22222222-2222-2222-2222-222222222222', now(), now(), now()),
  (gen_random_uuid(),
   '33333333-3333-3333-3333-333333333333',
   jsonb_build_object('sub','33333333-3333-3333-3333-333333333333','email','cliente.teste@mercuriocapital.dev','email_verified',true),
   'email','33333333-3333-3333-3333-333333333333', now(), now(), now())
on conflict (provider, provider_id) do nothing;

-- =====================================================================
-- 3) public.usuarios — garante perfis (trigger handle_new_user já cria,
--    mas reforçamos os campos de role aqui)
-- =====================================================================
update public.usuarios set role = 'admin',   ativo = true, nome_completo = 'Admin Teste'    where id = '11111111-1111-1111-1111-111111111111';
update public.usuarios set role = 'partner', ativo = true, nome_completo = 'Parceiro Teste' where id = '22222222-2222-2222-2222-222222222222';
update public.usuarios set role = 'client',  ativo = true, nome_completo = 'Cliente Teste'  where id = '33333333-3333-3333-3333-333333333333';

-- =====================================================================
-- 4) PARTNER aprovado + carteira
-- =====================================================================
insert into public.partners (
  id, usuario_id, cpf,
  endereco_cep, endereco_logradouro, endereco_numero,
  endereco_bairro, endereco_cidade, endereco_estado,
  dados_bancarios, status, aprovado_por, aprovado_em,
  comissao_percentual
) values (
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '12345678901',
  '01310-100','Av. Paulista','1000','Bela Vista','São Paulo','SP',
  jsonb_build_object('banco','341 - Itaú','agencia','0001','conta','12345-6','tipo','corrente','titular','Parceiro Teste'),
  'approved',
  '11111111-1111-1111-1111-111111111111',
  now(),
  1.50
) on conflict (id) do update set
    status = 'approved',
    aprovado_por = excluded.aprovado_por,
    aprovado_em  = now();

-- A trigger criar_wallet_parceiro() já criou partner_wallets ao inserir partner.
-- Vamos creditar R$ 500,00 (50000 centavos) para testes de consultas pagas.
update public.partner_wallets
  set saldo_centavos = 50000, versao = versao + 1, updated_at = now()
  where partner_id = '44444444-4444-4444-4444-444444444444'
    and saldo_centavos < 50000;

-- Registro no ledger para manter auditoria coerente
insert into public.wallet_ledger (
  wallet_id, partner_id, tipo, valor_centavos,
  saldo_antes, saldo_depois,
  referencia_tipo, referencia_id, correlation_id, descricao
)
select w.id, w.partner_id, 'ajuste_credito'::wallet_movimento_tipo, 50000,
       0, 50000, 'manual', null, gen_random_uuid(),
       'Crédito inicial de teste (seed)'
from public.partner_wallets w
where w.partner_id = '44444444-4444-4444-4444-444444444444'
  and not exists (
    select 1 from public.wallet_ledger l
    where l.wallet_id = w.id and l.descricao = 'Crédito inicial de teste (seed)'
  );

-- =====================================================================
-- 5) CLIENTE (cadastro) ligado ao auth user
-- =====================================================================
insert into public.clientes (
  id, usuario_id, pessoa_tipo,
  nome_completo, cpf, data_nascimento, estado_civil,
  email, telefone_ddi, telefone
) values (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  'PF', 'Cliente Teste', '98765432100', '1985-04-12', 'casado',
  'cliente.teste@mercuriocapital.dev', '55', '11999990002'
) on conflict (id) do update set
    usuario_id = excluded.usuario_id,
    email      = excluded.email;

-- =====================================================================
-- 6) SIMULAÇÃO + PROPOSTA (status pre_analise) com proponente + imóvel
-- =====================================================================
insert into public.simulacoes (
  id, partner_id, responsavel_id, produto, pessoa_tipo,
  cliente_nome, cliente_cpf, cliente_email, cliente_telefone,
  imovel_estado, imovel_cidade, imovel_bairro, imovel_cep,
  valor_credito, valor_imovel, prazo_meses, taxa_juros_mensal
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'home_equity', 'PF',
  'Cliente Teste', '98765432100',
  'cliente.teste@mercuriocapital.dev', '11999990002',
  'SP', 'São Paulo', 'Pinheiros', '05422-001',
  300000.00, 800000.00, 120, 1.39
) on conflict (id) do nothing;

insert into public.propostas (
  id, simulacao_id, partner_id, responsavel_id, cliente_id,
  produto, status, valor_solicitado, taxa_juros_mensal,
  indexador, correcao, amortizacao, prazo_meses, carencia_meses
) values (
  '66666666-6666-6666-6666-666666666666',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '55555555-5555-5555-5555-555555555555',
  'home_equity', 'pre_analise',
  300000.00, 1.39,
  'IPCA', 'pos_fixado', 'price', 120, 0
) on conflict (id) do update set status = 'pre_analise';

-- Proponente principal
insert into public.proponentes (
  id, proposta_id, cliente_id, principal, pessoa_tipo,
  nome, cpf_cnpj, estado_civil
) values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  true, 'PF',
  'Cliente Teste', '98765432100', 'casado'
) on conflict (id) do nothing;

-- Imóvel de garantia
insert into public.imoveis (
  id, proposta_id, tipo,
  cep, estado, cidade, bairro, logradouro, numero,
  valor, vagas_garagem
) values (
  '88888888-8888-8888-8888-888888888888',
  '66666666-6666-6666-6666-666666666666',
  'apartamento',
  '05422-001', 'SP', 'São Paulo', 'Pinheiros', 'Rua dos Pinheiros', '500',
  800000.00, 1
) on conflict (id) do nothing;

-- Vínculo proprietário ↔ imóvel
insert into public.imovel_proprietarios (imovel_id, proponente_id, percentual)
values (
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777',
  100.00
) on conflict do nothing;

-- =====================================================================
-- 7) PROPOSTA EXTRA — já em emissao_contrato (pronta para testar Fase 7)
-- =====================================================================
insert into public.propostas (
  id, partner_id, responsavel_id, cliente_id,
  produto, status, valor_solicitado, taxa_juros_mensal,
  indexador, correcao, amortizacao, prazo_meses, carencia_meses
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '55555555-5555-5555-5555-555555555555',
  'home_equity', 'emissao_contrato',
  450000.00, 1.39,
  'IPCA', 'pos_fixado', 'price', 180, 0
) on conflict (id) do update set status = 'emissao_contrato';

insert into public.proponentes (
  id, proposta_id, cliente_id, principal, pessoa_tipo, nome, cpf_cnpj, estado_civil
) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '55555555-5555-5555-5555-555555555555',
  true,'PF','Cliente Teste','98765432100','casado'
) on conflict (id) do nothing;

insert into public.imoveis (
  id, proposta_id, tipo, cep, estado, cidade, bairro, logradouro, numero, valor
) values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'casa','01310-100','SP','São Paulo','Bela Vista','Av. Paulista','1500',
  1200000.00
) on conflict (id) do nothing;

-- =====================================================================
-- 8) PENDÊNCIAS — uma aberta na proposta principal
-- =====================================================================
insert into public.proposta_pendencias (
  id, proposta_id, descricao, solicitado_por, responsavel_resolver,
  documento_solicitado_tipo, status, prazo
) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '66666666-6666-6666-6666-666666666666',
  'Enviar comprovante de residência atualizado (últimos 3 meses).',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'comprovante_residencia', 'aberta',
  now() + interval '7 days'
) on conflict (id) do nothing;

-- =====================================================================
-- 9) LMS — curso publicado + módulo + aula gratuita
-- =====================================================================
-- (Estrutura conforme migration 20260518000040_universidade_fase8.sql)
insert into public.cursos (
  id, titulo, slug, descricao, categoria, nivel, publico, status, gratuito, ordem
) values (
  '99999999-9999-9999-9999-999999999999',
  'Bem-vindo à Mercúrio Capital',
  'bem-vindo-mercurio',
  'Curso introdutório sobre Home Equity e a Universidade Mercúrio.',
  'Onboarding', 'iniciante', 'ambos', 'publicado', true, 1
) on conflict (id) do update set status = 'publicado';

insert into public.modulos (id, curso_id, titulo, ordem) values
  ('a1111111-1111-1111-1111-111111111111','99999999-9999-9999-9999-999999999999','Módulo 1 — Introdução', 1)
on conflict (id) do nothing;

insert into public.aulas (id, modulo_id, titulo, ordem, tipo, vimeo_id, duracao_segundos, gratuita) values
  ('a2222222-2222-2222-2222-222222222222',
   'a1111111-1111-1111-1111-111111111111',
   'Quem somos', 1, 'video', '76979871', 240, true)
on conflict (id) do nothing;

-- Assinatura LMS ativa para o cliente (libera todo o catálogo)
insert into public.assinaturas_universidade (
  id, usuario_id, status, valor_centavos, ciclo, current_period_end
) values (
  'a3333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'ativa', 4990, 'mensal', now() + interval '30 days'
) on conflict (id) do update set status = 'ativa', current_period_end = now() + interval '30 days';

-- =====================================================================
-- 10) NOTIFICAÇÕES iniciais (uma para cada role)
-- =====================================================================
insert into public.notificacoes (usuario_id, canal, titulo, mensagem, link, metadata) values
  ('11111111-1111-1111-1111-111111111111','in_app','Bem-vindo Admin','Ambiente populado com dados de teste.','/admin', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222','in_app','Carteira creditada','R$ 500,00 disponíveis para consultas de teste.','/p/carteira', '{}'::jsonb),
  ('33333333-3333-3333-3333-333333333333','in_app','Proposta criada','Sua proposta de Home Equity está em pré-análise.','/c/propostas', '{}'::jsonb);

-- =====================================================================
-- ✅ FIM. Cenário de teste pronto.
-- =====================================================================
-- Como validar:
--   1. Login admin    → /admin/parceiros (vê 1 parceiro aprovado)
--                     → /admin/propostas (vê 2 propostas)
--                     → /admin/financeiro (vê dados Fase 7)
--   2. Login parceiro → /p/propostas (vê 2 propostas suas)
--                     → /p/carteira  (vê saldo R$ 500,00)
--                     → /p/universidade (vê curso publicado)
--   3. Login cliente  → /c/propostas (vê suas 2 propostas)
--                     → /c/universidade (catálogo desbloqueado)
--
-- =====================================================================
-- ROLLBACK / CLEANUP (descomente para limpar tudo de uma vez)
-- =====================================================================
/*
delete from public.notificacoes        where usuario_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');
delete from public.assinaturas_universidade where id = 'a3333333-3333-3333-3333-333333333333';
delete from public.aulas    where id = 'a2222222-2222-2222-2222-222222222222';
delete from public.modulos  where id = 'a1111111-1111-1111-1111-111111111111';
delete from public.cursos   where id = '99999999-9999-9999-9999-999999999999';
delete from public.proposta_pendencias where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
delete from public.imovel_proprietarios where imovel_id in (
  '88888888-8888-8888-8888-888888888888','dddddddd-dddd-dddd-dddd-dddddddddddd');
delete from public.imoveis     where id in ('88888888-8888-8888-8888-888888888888','dddddddd-dddd-dddd-dddd-dddddddddddd');
delete from public.proponentes where id in ('77777777-7777-7777-7777-777777777777','cccccccc-cccc-cccc-cccc-cccccccccccc');
delete from public.propostas   where id in ('66666666-6666-6666-6666-666666666666','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
delete from public.simulacoes  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
delete from public.clientes    where id = '55555555-5555-5555-5555-555555555555';
delete from public.wallet_ledger   where partner_id = '44444444-4444-4444-4444-444444444444';
delete from public.partner_wallets where partner_id = '44444444-4444-4444-4444-444444444444';
delete from public.partners        where id = '44444444-4444-4444-4444-444444444444';
delete from public.usuarios where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');
delete from auth.identities where user_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');
*/

