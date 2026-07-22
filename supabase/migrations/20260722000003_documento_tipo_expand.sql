-- =============================================
-- MIGRATION — EXPANSÃO DO ENUM documento_tipo
-- =============================================
-- ISOLADA: apenas ALTER TYPE ... ADD VALUE. Não consome os novos valores
-- neste arquivo (PostgreSQL não permite usar um valor de enum recém-adicionado
-- na mesma transação). Os valores são usados na migration seguinte
-- (documentos_checklist), que roda em transação separada.

alter type public.documento_tipo add value if not exists 'certidao_nascimento';
alter type public.documento_tipo add value if not exists 'irpf_declaracao';
alter type public.documento_tipo add value if not exists 'irpf_recibo';
alter type public.documento_tipo add value if not exists 'extrato_bancario';
alter type public.documento_tipo add value if not exists 'demonstrativo_contabil';
alter type public.documento_tipo add value if not exists 'ficha_cadastral_imovel';
alter type public.documento_tipo add value if not exists 'fotos_imovel';
alter type public.documento_tipo add value if not exists 'contrato_compra_venda';
