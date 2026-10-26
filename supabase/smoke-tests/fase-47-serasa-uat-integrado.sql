-- Fase 47 — assertions pós-consulta Serasa PF UAT.
-- Invocado pelo scripts/smoke-serasa-uat-disposable.mjs usando somente UUIDs.
-- Não imprime relatório, documento, token ou credenciais.

\set ON_ERROR_STOP on

select count(*) = 1 as smoke_one_completed_log
  from public.logs_consultas
 where id = :'log_id'::uuid
   and proposta_id = :'proposta_id'::uuid
   and partner_id = :'partner_id'::uuid
   and status = 'concluida'
   and ambiente = 'uat'
   and produto_relatorio = 'RELATORIO_AVANCADO_TOP_SCORE_PF'
   and resumo->>'product' = 'RELATORIO_AVANCADO_TOP_SCORE_PF'
   and resumo->>'source' = 'serasa_experian'
   and resumo->>'identityAvailable' = 'true'
   and resumo->'score'->>'calculation' = 'calculado'
   and request = '{}'::jsonb
   and not (resumo ?| array['cpf','cnpj','document','documento','raw']);
\gset
\if :smoke_one_completed_log
  \echo 'OK: uma consulta UAT concluída com resumo sem documento ou resposta bruta'
\else
  \echo 'FAIL: consulta concluída/resumo não atende aos critérios'
  \quit 1
\endif

select count(*) = 1 as smoke_single_wallet_debit
  from public.wallet_ledger
 where partner_id = :'partner_id'::uuid
   and correlation_id = :'idempotency_key'::uuid
   and tipo = 'debito_consulta'
   and valor_centavos = :'price_centavos'::bigint;
\gset
\if :smoke_single_wallet_debit
  \echo 'OK: exatamente um débito de carteira para a chave idempotente'
\else
  \echo 'FAIL: contagem/valor de débito inesperado'
  \quit 1
\endif

select count(*) = 1 as smoke_wallet_balance
  from public.partner_wallets
 where partner_id = :'partner_id'::uuid
   and saldo_centavos = :'starting_balance'::bigint - :'price_centavos'::bigint;
\gset
\if :smoke_wallet_balance
  \echo 'OK: saldo reduziu apenas pelo preço de uma consulta'
\else
  \echo 'FAIL: saldo final da carteira inesperado'
  \quit 1
\endif

select not has_column_privilege('authenticated','public.logs_consultas','request','select')
   and not has_column_privilege('authenticated','public.logs_consultas','response','select')
   and not has_function_privilege('anon','public.consulta_iniciar_serasa(uuid,public.tipo_consulta,uuid,uuid,text)','execute')
   as smoke_private_columns_and_rpc;
\gset
\if :smoke_private_columns_and_rpc
  \echo 'OK: payload restrito e RPC de início indisponível para anon'
\else
  \echo 'FAIL: privilégio de payload/RPC inesperado'
  \quit 1
\endif
