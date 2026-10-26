-- Captura pública isolada para solicitações de Crédito para Construção.
-- A gravação permanece desligada até a publicação da Política de Privacidade.

create table if not exists public.cpc_leads_publicos (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  nome_completo text not null
    check (char_length(btrim(nome_completo)) between 3 and 160),
  email text not null
    check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  cidade text check (cidade is null or char_length(btrim(cidade)) between 1 and 100),
  uf text check (uf is null or uf = any(array[
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
    'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ]::text[])),
  fase_projeto text not null check (fase_projeto in (
    'terreno_definido', 'projeto_aprovado', 'orcamento_cronograma', 'obra_iniciada', 'outro'
  )),
  resumo_projeto text check (resumo_projeto is null or char_length(btrim(resumo_projeto)) <= 2000),
  consentimento_em timestamptz not null default now(),
  consentimento_versao text not null default 'cpc_site_v1'
    check (consentimento_versao = 'cpc_site_v1'),
  origem text not null default 'Site da Mercúrio · CPC'
    check (origem = 'Site da Mercúrio · CPC'),
  created_at timestamptz not null default now()
);

create index if not exists cpc_leads_publicos_created_idx
  on public.cpc_leads_publicos (created_at desc);
create index if not exists cpc_leads_publicos_email_idx
  on public.cpc_leads_publicos (lower(email), created_at desc);

alter table public.cpc_leads_publicos enable row level security;
drop policy if exists cpc_leads_publicos_admin_read on public.cpc_leads_publicos;
create policy cpc_leads_publicos_admin_read on public.cpc_leads_publicos
  for select to authenticated using (public.app_is_admin());

revoke all on public.cpc_leads_publicos from public, anon, authenticated;
grant select on public.cpc_leads_publicos to authenticated;
grant insert, select on public.cpc_leads_publicos to service_role;

create or replace view public.v_admin_leads_publicos
  with (security_invoker = on)
as
  select
    ('simulacao:' || s.id::text) as id,
    s.tipo_simulacao,
    s.nome_completo,
    s.email,
    s.telefone,
    s.consentimento_em,
    s.consentimento_versao,
    s.valor_imovel,
    s.valor_credito,
    s.prazo_meses,
    s.taxa_juros_mensal,
    s.parcela_estimada,
    s.ltv,
    s.tipo_imovel,
    s.situacao_imovel,
    s.cep,
    s.renda_mensal,
    s.objetivo_credito,
    s.tipo_renda,
    s.prazo_contratacao,
    s.origem,
    s.data_inicio,
    s.periodicidade_juros,
    s.sistema_amortizacao,
    s.quantidade_parcelas,
    s.taxa_juros_informada,
    s.primeira_parcela,
    s.ultima_parcela,
    s.total_pago,
    s.total_juros,
    s.status_email_prospect,
    s.status_email_interno,
    s.created_at,
    s.updated_at,
    s.planos_amortizacao,
    s.resultado_com_amortizacao,
    null::text as cidade,
    null::text as uf,
    null::text as fase_projeto,
    null::text as resumo_projeto
  from public.v_admin_simulacao_leads_publicos s
  union all
  select
    ('cpc:' || c.id::text) as id,
    'cpc'::text as tipo_simulacao,
    c.nome_completo,
    c.email,
    c.telefone,
    c.consentimento_em,
    c.consentimento_versao,
    null::numeric as valor_imovel,
    null::numeric as valor_credito,
    null::integer as prazo_meses,
    null::numeric as taxa_juros_mensal,
    null::numeric as parcela_estimada,
    null::numeric as ltv,
    null::text as tipo_imovel,
    null::text as situacao_imovel,
    null::text as cep,
    null::numeric as renda_mensal,
    null::text as objetivo_credito,
    null::text as tipo_renda,
    null::text as prazo_contratacao,
    c.origem,
    null::date as data_inicio,
    null::text as periodicidade_juros,
    null::text as sistema_amortizacao,
    null::integer as quantidade_parcelas,
    null::numeric as taxa_juros_informada,
    null::numeric as primeira_parcela,
    null::numeric as ultima_parcela,
    null::numeric as total_pago,
    null::numeric as total_juros,
    null::text as status_email_prospect,
    null::text as status_email_interno,
    c.created_at,
    c.created_at as updated_at,
    null::jsonb as planos_amortizacao,
    null::jsonb as resultado_com_amortizacao,
    c.cidade,
    c.uf,
    c.fase_projeto,
    c.resumo_projeto
  from public.cpc_leads_publicos c;

revoke all on public.v_admin_leads_publicos from public, anon;
grant select on public.v_admin_leads_publicos to authenticated;

insert into public.configuracoes_sistema (chave, valor, descricao)
values
  ('cpc_captura_publica_ativa', 'false'::jsonb, 'Habilita a captura pública de leads CPC após a publicação da política de privacidade.'),
  ('rate_limit_cpc_publico', '{"max":3,"janela_min":60}'::jsonb, 'Limite de captura de leads CPC por e-mail e endereço de rede.')
on conflict (chave) do nothing;
