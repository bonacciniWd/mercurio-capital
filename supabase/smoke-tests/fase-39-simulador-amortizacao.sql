-- Fase 39 — smoke test do simulador público de amortização.
-- Executar no projeto Supabase somente após publicar a migration/Edge Function
-- e com autorização para criar um registro sintético.

select to_regclass('public.simulacao_leads_publicos') as tabela_leads,
       to_regclass('public.v_admin_simulacao_leads_publicos') as view_leads,
       to_regprocedure('public.capture_public_simulacao_amortizacao_lead(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text)') as funcao_amortizacao;

select codigo, ativo
  from public.templates_mensagem
 where codigo in (
   'simulacao_publica_amortizacao_resultado_v1',
   'simulacao_publica_amortizacao_novo_lead_interno_v1'
 );

-- Após a captura sintética, validar:
-- 1. tipo_simulacao = 'amortizacao';
-- 2. Price mantém primeira_parcela = ultima_parcela; SAC reduz a parcela;
-- 3. taxa_juros_mensal corresponde à taxa informada/periodicidade;
-- 4. total_pago >= valor_credito e total_juros = total_pago - valor_credito;
-- 5. existem duas mensagens em email_outbox, uma prospect e uma interno;
-- 6. status de ambos chega a enviado pelo dispatcher;
-- 7. anon não consegue consultar a view e admin consegue.
