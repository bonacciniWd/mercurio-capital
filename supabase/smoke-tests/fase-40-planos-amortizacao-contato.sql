-- Fase 40 — verificação local/remota somente leitura após publicar a migration.
-- Não insere leads nem envia mensagens.

select
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'simulacao_leads_publicos'
       and column_name = 'planos_amortizacao' and is_nullable = 'NO'
  ) as planos_persistidos_sem_cronograma,
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'simulacao_leads_publicos'
       and column_name = 'resultado_com_amortizacao'
  ) as comparativo_persistido,
  to_regclass('public.config_mensagens_simulador') as configuracao_whatsapp,
  to_regclass('public.v_admin_simulacao_leads_publicos') as view_admin_leads,
  to_regprocedure('public.capture_public_simulacao_amortizacao_lead_v2(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text,jsonb,jsonb)') as captura_server_side;

select
  not has_table_privilege('anon', 'public.simulacao_leads_publicos', 'select') as anon_nao_le_leads,
  not has_table_privilege('anon', 'public.v_admin_simulacao_leads_publicos', 'select') as anon_nao_le_view,
  not has_table_privilege('anon', 'public.config_mensagens_simulador', 'select') as anon_nao_le_config,
  not has_function_privilege('anon', 'public.capture_public_simulacao_amortizacao_lead_v2(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text,jsonb,jsonb)', 'execute') as anon_nao_chama_captura,
  has_function_privilege('service_role', 'public.capture_public_simulacao_amortizacao_lead_v2(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text,jsonb,jsonb)', 'execute') as service_role_chama_captura;

select policyname, roles, cmd, qual
  from pg_policies
 where schemaname = 'public'
   and tablename = 'config_mensagens_simulador';

-- Após um fluxo sintético autorizado, conferir pelo painel/admin SQL:
-- * um registro em simulacao_leads_publicos com planos_amortizacao e comparativo server-side;
-- * cronograma completo não está persistido no registro;
-- * email_outbox contém o resumo dos dois cenários para prospect e equipe interna;
-- * nenhuma gravação é criada antes do botão final de salvar;
-- * /admin/leads/simulacoes mostra valor, planos, comparação e link wa.me pré-preenchido;
-- * o WhatsApp abre com mensagem, sem envio automático.
