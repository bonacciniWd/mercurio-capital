-- Align the configured PF product with the Advanced PF contract.
-- The Top Score product is not part of the confirmed account configuration.
update public.serasa_relatorios_config
   set report_pf = 'RELATORIO_AVANCADO_PF',
       atualizado_em = now()
 where report_pf = 'RELATORIO_AVANCADO_TOP_SCORE_PF';
