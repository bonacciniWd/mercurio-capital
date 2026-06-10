-- Fase 16 — Configurações reais: dados da empresa (chave/valor)
-- Cria a chave `empresa` em configuracoes_sistema, consumida pelas telas de
-- Configurações (web e mobile). Idempotente.

insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'empresa',
  '{"razao_social":"Mercurio Capital Ltda","nome_fantasia":"Mercurio Capital","cnpj":"","inscricao_estadual":"Isento","endereco":"","email":"","telefone":""}',
  'Dados cadastrais da empresa exibidos no backoffice (web e mobile).'
)
on conflict (chave) do nothing;
