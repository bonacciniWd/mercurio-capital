-- =============================================
-- MIGRATION 006 — PLATAFORMA
-- (Audit, Notificações, Config, Feature Flags, Rate Limits)
-- =============================================

-- =============================================
-- AUDIT_LOG (append-only)
-- =============================================

create table audit_log (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid,   -- null = ação do sistema
  acao           text not null,
  entidade       text not null,
  entidade_id    uuid,
  payload_antes  jsonb,
  payload_depois jsonb,
  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now()
);

create index audit_log_entidade_idx on audit_log (entidade, entidade_id, created_at desc);
create index audit_log_usuario_idx  on audit_log (usuario_id, created_at desc);

alter table audit_log enable row level security;

create policy "admin_le_audit" on audit_log
  for select using (public.app_is_admin());

-- audit_log é imutável
create policy "ninguem_atualiza_audit" on audit_log
  for update using (false);

create policy "ninguem_deleta_audit" on audit_log
  for delete using (false);

-- INSERT somente por funções SECURITY DEFINER (edge / triggers)
create policy "service_insere_audit" on audit_log
  for insert with check (false);

-- Função genérica de auditoria (chamada por triggers e edges)
create or replace function registrar_audit(
  p_acao        text,
  p_entidade    text,
  p_entidade_id uuid,
  p_antes       jsonb default null,
  p_depois      jsonb default null
)
returns void language plpgsql security definer as $$
begin
  insert into audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (auth.uid(), p_acao, p_entidade, p_entidade_id, p_antes, p_depois);
end;
$$;

-- =============================================
-- TRIGGERS DE AUDITORIA NAS TABELAS SENSÍVEIS
-- =============================================

-- Auditoria genérica de UPDATE — grava diff em audit_log
create or replace function audit_update_trigger()
  returns trigger language plpgsql security definer as $$
begin
  perform registrar_audit(
    'update',
    tg_table_name,
    new.id,
    to_jsonb(old),
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger trg_audit_partners
  after update on partners
  for each row execute function audit_update_trigger();

create trigger trg_audit_propostas
  after update on propostas
  for each row execute function audit_update_trigger();

create trigger trg_audit_contratos
  after update on contratos
  for each row execute function audit_update_trigger();

create trigger trg_audit_comissoes
  after update on comissoes
  for each row execute function audit_update_trigger();

create trigger trg_audit_partner_wallets
  after update on partner_wallets
  for each row execute function audit_update_trigger();

-- =============================================
-- NOTIFICACOES
-- =============================================

create table notificacoes (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  canal      notificacao_canal not null,
  titulo     text not null,
  mensagem   text not null,
  link       text,
  lida_em    timestamptz,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index notificacoes_usuario_idx
  on notificacoes (usuario_id, lida_em nulls first, created_at desc);

alter table notificacoes enable row level security;

create policy "usuario_le_proprias_notif" on notificacoes
  for select using (usuario_id = auth.uid() or public.app_is_admin());

create policy "usuario_marca_lida" on notificacoes
  for update using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- =============================================
-- PUSH_DEVICES
-- =============================================

create table push_devices (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  plataforma text not null check (plataforma in ('web','android','ios')),
  token      text not null unique,
  ultimo_uso timestamptz not null default now()
);

alter table push_devices enable row level security;

create policy "usuario_gerencia_dispositivos" on push_devices
  for all using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "admin_full_devices" on push_devices
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- =============================================
-- CONFIGURACOES_SISTEMA (chave/valor versionado)
-- =============================================

create table configuracoes_sistema (
  chave      text primary key,
  valor      jsonb not null,
  descricao  text,
  updated_by uuid references usuarios(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table configuracoes_sistema enable row level security;

create policy "autenticados_le_config" on configuracoes_sistema
  for select using (auth.role() = 'authenticated');

create policy "admin_full_config" on configuracoes_sistema
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- trigger de auditoria de configurações
create trigger trg_audit_config
  after update on configuracoes_sistema
  for each row execute function audit_update_trigger();

-- =============================================
-- FEATURE_FLAGS
-- =============================================

create table feature_flags (
  id        uuid primary key default gen_random_uuid(),
  chave     text not null unique,
  descricao text,
  regras    jsonb not null default '{}',  -- {roles:[], partner_ids:[], percent:100}
  ativo     boolean not null default false
);

alter table feature_flags enable row level security;

create policy "autenticados_le_flags" on feature_flags
  for select using (auth.role() = 'authenticated');

create policy "admin_full_flags" on feature_flags
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- =============================================
-- RATE_LIMITS (controle de abuso por IP/endpoint)
-- =============================================

create table rate_limits (
  chave         text not null,
  contagem      int not null default 1,
  janela_inicio timestamptz not null default now(),
  primary key (chave, janela_inicio)
);

alter table rate_limits enable row level security;

-- acesso exclusivo por service_role (edge functions)
create policy "somente_service_role_rate" on rate_limits
  for all using (false);

-- =============================================
-- CAMPANHAS
-- =============================================

create table campanhas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  publico_alvo  jsonb not null default '{}',  -- {roles:[], partner_ids:[], filtros:{}}
  canais        text[] not null default '{}',  -- ['whatsapp','email','push']
  template      text not null,
  agendado_para timestamptz,
  status        text not null default 'rascunho'
                  check (status in ('rascunho','agendada','enviada','cancelada')),
  metricas      jsonb not null default '{}',
  created_by    uuid references usuarios(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table campanhas enable row level security;

create policy "admin_full_campanhas" on campanhas
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_campanhas_updated_at
  before update on campanhas
  for each row execute function set_updated_at();


