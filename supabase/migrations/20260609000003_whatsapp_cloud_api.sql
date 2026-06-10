-- Fase 15.2 — Migração do provedor de WhatsApp: Evolution API → WhatsApp Cloud API (Meta)
-- A camada de dados (whatsapp_mensagens, fila, fluxos/campanhas) é agnóstica de
-- provedor e não muda. Aqui apenas renomeamos a entrada do catálogo de integrações
-- e ajustamos a função de métricas para a nova chave 'whatsapp'.
--
-- Obs.: a coluna whatsapp_mensagens.evolution_message_id passa a guardar o
-- "wamid" (message id) retornado pela Cloud API — mantida com o mesmo nome para
-- evitar churn; semanticamente é "id da mensagem no provedor".

-- 1) Renomeia/atualiza a entrada do catálogo
update public.integracoes_config
   set chave = 'whatsapp',
       nome = 'WhatsApp Business (Cloud API)',
       provider = 'WhatsApp Cloud API (Meta)',
       descricao = 'Envio de mensagens transacionais e campanhas via WhatsApp Business Platform (Cloud API oficial da Meta).',
       -- secrets críticas para o health-check de envio; a configuração completa
       -- (webhook) está documentada em docs/operacao/whatsapp-cloud-api-setup.md
       secrets_requeridas = array['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID'],
       docs_url = 'https://developers.facebook.com/docs/whatsapp/cloud-api',
       ultimo_status = 'pendente',
       ultima_checagem = null,
       ultimo_erro = null,
       latencia_ms = null,
       updated_at = now()
 where chave = 'evolution_whatsapp';

-- Caso o ambiente nunca tenha tido a linha 'evolution_whatsapp' (instalação nova),
-- garante a presença da entrada 'whatsapp'.
insert into public.integracoes_config
  (chave, nome, categoria, descricao, provider, secrets_requeridas, docs_url, restricao_plataforma, ordem)
values
  ('whatsapp', 'WhatsApp Business (Cloud API)', 'Comunicação',
   'Envio de mensagens transacionais e campanhas via WhatsApp Business Platform (Cloud API oficial da Meta).',
   'WhatsApp Cloud API (Meta)',
   array['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID'],
   'https://developers.facebook.com/docs/whatsapp/cloud-api', null, 20)
on conflict (chave) do nothing;

-- 2) Atualiza a função de métricas para a nova chave 'whatsapp'
create or replace function public.integracao_metricas(p_chave text)
returns table (eventos_24h int, fila_pendente int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.app_is_admin() then
    return;
  end if;
  return query
  select
    (case p_chave
       when 'stripe'    then (select count(*) from public.stripe_webhooks_inbox w    where w.processado_em > now() - interval '24 hours')
       when 'clicksign' then (select count(*) from public.clicksign_webhooks_inbox w where w.processado_em > now() - interval '24 hours')
       when 'whatsapp'  then (select count(*) from public.whatsapp_mensagens m       where m.created_at   > now() - interval '24 hours')
       else 0 end)::int,
    (case p_chave
       when 'resend'   then (select count(*) from public.email_outbox e       where e.status in ('pendente','processando'))
       when 'whatsapp' then (select count(*) from public.whatsapp_mensagens m where m.status = 'pendente')
       else 0 end)::int;
end;
$$;

grant execute on function public.integracao_metricas(text) to authenticated;
