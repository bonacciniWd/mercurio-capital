-- Novos valores do fluxo operacional. Isolado em migration própria porque o
-- PostgreSQL não permite usar valores recém-adicionados no mesmo transaction block.
alter type public.proposta_status add value if not exists 'diligencia_juridica';
alter type public.proposta_status add value if not exists 'protocolo_cartorio';
alter type public.proposta_status add value if not exists 'exigencias_cartorio';
alter type public.proposta_status add value if not exists 'custas_cartorio';
alter type public.proposta_status add value if not exists 'registro_af';
alter type public.proposta_status add value if not exists 'pagamento_comissao';
alter type public.proposta_status add value if not exists 'completo';