-- Fase 15 — Integrações reais (catálogo + health) e WhatsApp via Evolution API
-- Substitui o mock das telas de Integrações por um catálogo persistido com
-- status/health real, e adiciona a infraestrutura de mensagens WhatsApp.
--
-- Tabelas:
--   integracoes_config   catálogo de integrações + último status/health
--   whatsapp_mensagens   mensagens enviadas via Evolution API + status entrega
-- View:
--   v_admin_integracoes  catálogo + métricas ao vivo (somente admin)
-- RPCs:
--   admin_integracao_toggle(chave, ativo)
--
-- Escritas de health são feitas pela edge `integracao-testar` (service_role).
-- Escritas em whatsapp_mensagens pela edge `evolution-whatsapp` (service_role).

-- ───────────────────────────── integracoes_config ─────────────────────────────
create table if not exists public.integracoes_config (
  id                    uuid primary key default gen_random_uuid(),
  chave                 text not null unique,
  nome                  text not null,
  categoria             text not null,
  descricao             text,
  provider              text,
  secrets_requeridas    text[] not null default '{}',
  docs_url              text,
  restricao_plataforma  text,                         -- null | 'ios_iap'
  ativo                 boolean not null default true,
  ultimo_status         text not null default 'pendente'
                          check (ultimo_status in ('conectado','erro','pendente','desconectado')),
  ultima_checagem       timestamptz,
  ultimo_erro           text,
  latencia_ms           integer,
  metricas              jsonb not null default '{}'::jsonb,
  ordem                 integer not null default 100,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.integracoes_config enable row level security;

drop policy if exists integracoes_config_admin_read on public.integracoes_config;
create policy integracoes_config_admin_read on public.integracoes_config
  for select using (public.app_is_admin());
-- Escritas apenas via RPC security definer ou service_role.

-- ───────────────────────────── whatsapp_mensagens ─────────────────────────────
create table if not exists public.whatsapp_mensagens (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid references public.usuarios(id) on delete set null,
  telefone            text not null,
  template_codigo     text,
  corpo               text not null,
  referencia_tipo     text,
  referencia_id       uuid,
  evolution_message_id text,
  status              text not null default 'pendente'
                        check (status in ('pendente','enviado','entregue','lido','erro')),
  erro                text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  enviado_em          timestamptz,
  atualizado_em       timestamptz not null default now()
);

create index if not exists idx_whatsapp_mensagens_status on public.whatsapp_mensagens(status);
create index if not exists idx_whatsapp_mensagens_evo on public.whatsapp_mensagens(evolution_message_id);
create index if not exists idx_whatsapp_mensagens_ref on public.whatsapp_mensagens(referencia_tipo, referencia_id);

alter table public.whatsapp_mensagens enable row level security;

drop policy if exists whatsapp_mensagens_admin_read on public.whatsapp_mensagens;
create policy whatsapp_mensagens_admin_read on public.whatsapp_mensagens
  for select using (public.app_is_admin());

-- ───────────────────────────── v_admin_integracoes ────────────────────────────
-- Métricas ao vivo (contadores) ficam numa função SECURITY DEFINER admin-gated,
-- pois os inboxes de webhook têm RLS apenas para service_role. A view segue a
-- convenção do projeto (security_invoker = on) e é filtrada por app_is_admin().
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
       when 'stripe'             then (select count(*) from public.stripe_webhooks_inbox w    where w.processado_em > now() - interval '24 hours')
       when 'clicksign'          then (select count(*) from public.clicksign_webhooks_inbox w where w.processado_em > now() - interval '24 hours')
       when 'evolution_whatsapp' then (select count(*) from public.whatsapp_mensagens m       where m.created_at   > now() - interval '24 hours')
       else 0 end)::int,
    (case p_chave
       when 'resend'             then (select count(*) from public.email_outbox e       where e.status in ('pendente','processando'))
       when 'evolution_whatsapp' then (select count(*) from public.whatsapp_mensagens m where m.status = 'pendente')
       else 0 end)::int;
end;
$$;

grant execute on function public.integracao_metricas(text) to authenticated;

create or replace view public.v_admin_integracoes with (security_invoker = on) as
select
  c.id,
  c.chave,
  c.nome,
  c.categoria,
  c.descricao,
  c.provider,
  c.secrets_requeridas,
  c.docs_url,
  c.restricao_plataforma,
  c.ativo,
  c.ultimo_status,
  c.ultima_checagem,
  c.ultimo_erro,
  c.latencia_ms,
  c.metricas,
  c.ordem,
  c.updated_at,
  coalesce(m.eventos_24h, 0)   as eventos_24h,
  coalesce(m.fila_pendente, 0) as fila_pendente
from public.integracoes_config c
left join lateral public.integracao_metricas(c.chave) m on true
where public.app_is_admin()
order by c.ordem, c.nome;

grant select on public.v_admin_integracoes to authenticated;

-- ───────────────────────────── RPC: toggle ────────────────────────────────────
create or replace function public.admin_integracao_toggle(p_chave text, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.integracoes_config
     set ativo = p_ativo,
         updated_at = now()
   where chave = p_chave;

  if not found then
    raise exception 'integracao_nao_encontrada' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_integracao_toggle(text, boolean) to authenticated;

-- ───────────────────────────── Seed do catálogo ───────────────────────────────
insert into public.integracoes_config
  (chave, nome, categoria, descricao, provider, secrets_requeridas, docs_url, restricao_plataforma, ordem)
values
  ('stripe', 'Stripe', 'Pagamentos',
   'Recargas de carteira e assinatura da Universidade. No app iOS o checkout é restrito pelas regras de IAP da Apple.',
   'Stripe',
   array['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID_LMS_MONTHLY','STRIPE_PRICE_ID_LMS_ANNUAL'],
   'https://dashboard.stripe.com', 'ios_iap', 10),

  ('evolution_whatsapp', 'WhatsApp (Evolution API)', 'Comunicação',
   'Envio de mensagens transacionais e campanhas via Evolution API (self-hosted).',
   'Evolution API',
   array['EVOLUTION_API_URL','EVOLUTION_API_KEY','EVOLUTION_INSTANCE'],
   'https://doc.evolution-api.com', null, 20),

  ('clicksign', 'Clicksign', 'Assinatura',
   'Assinatura eletrônica de contratos de parceria e operações.',
   'Clicksign',
   array['CLICKSIGN_API_TOKEN','CLICKSIGN_API_URL','CLICKSIGN_WEBHOOK_SECRET'],
   'https://developers.clicksign.com', null, 30),

  ('resend', 'Resend', 'E-mail',
   'Disparo de e-mails transacionais, campanhas e fluxos.',
   'Resend',
   array['RESEND_API_KEY','RESEND_FROM'],
   'https://resend.com/docs', null, 40),

  ('serasa', 'Serasa Experian', 'Bureau',
   'Consulta de bureau PF/PJ (Data Return).',
   'Serasa Experian',
   array['SERASA_CLIENT_ID','SERASA_CLIENT_SECRET','SERASA_API_URL'],
   'https://developer.serasaexperian.com.br', null, 50),

  ('bacen', 'Bacen SCR', 'Bureau',
   'Consulta de endividamento (SCR) por CPF/CNPJ.',
   'Banco Central', array[]::text[], null, null, 60),

  ('jusbrasil', 'Jusbrasil', 'Bureau',
   'Processos judiciais por CNPJ.',
   'Jusbrasil', array[]::text[], null, null, 70),

  ('escavador', 'Escavador', 'Bureau',
   'Histórico processual e relacionamentos.',
   'Escavador', array[]::text[], null, null, 80),

  ('ri_digital', 'RI Digital / ARISP', 'Cartórios',
   'Matrícula de imóveis e certidões registrais.',
   'RI Digital', array[]::text[], null, null, 90),

  ('nacional_consultas', 'Nacional Consultas', 'Bureau',
   'Bens, certidões e enriquecimento cadastral.',
   'Nacional Consultas', array[]::text[], null, null, 100),

  ('vimeo', 'Vimeo Pro', 'Mídia',
   'Streaming dos cursos da Universidade Mercurio.',
   'Vimeo', array[]::text[], 'https://developer.vimeo.com', null, 110)
on conflict (chave) do nothing;
