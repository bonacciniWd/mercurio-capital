-- =============================================
-- MIGRATION 002 — IDENTIDADE & ACESSO
-- =============================================

-- =============================================
-- USUARIOS (espelho de auth.users)
-- =============================================

create table usuarios (
  id              uuid primary key references auth.users(id) on delete cascade,
  nome_completo   text not null,
  email           text not null unique,
  telefone_ddi    text not null default '55',
  telefone        text,
  role            user_role not null,
  avatar_url      text,
  ativo           boolean not null default true,
  ultimo_login_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table usuarios enable row level security;

create policy "usuario_le_proprio" on usuarios
  for select using (id = auth.uid() or public.app_is_admin());

create policy "usuario_atualiza_proprio" on usuarios
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "admin_full_usuarios" on usuarios
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_usuarios_updated_at
  before update on usuarios
  for each row execute function set_updated_at();

-- trigger: sincroniza ultimo_login_at a partir do auth.users
create or replace function sync_ultimo_login()
  returns trigger language plpgsql security definer as $$
begin
  update usuarios set ultimo_login_at = now() where id = new.id;
  return new;
end;
$$;

-- =============================================
-- PARTNERS
-- =============================================

create table partners (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null unique references usuarios(id) on delete restrict,
  cpf                  text unique,
  endereco_cep         text,
  endereco_logradouro  text,
  endereco_numero      text,
  endereco_complemento text,
  endereco_bairro      text,
  endereco_cidade      text,
  endereco_estado      char(2),
  dados_bancarios      jsonb,       -- {banco, agencia, conta, tipo, titular}
  status               partner_status not null default 'pending',
  aprovado_por         uuid references usuarios(id) on delete set null,
  aprovado_em          timestamptz,
  motivo_rejeicao      text,
  comissao_percentual  numeric(5,2) not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table partners enable row level security;

create policy "partner_le_proprio" on partners
  for select using (usuario_id = auth.uid() or public.app_is_admin());

create policy "partner_atualiza_proprio" on partners
  for update using (usuario_id = auth.uid() and public.app_user_role() = 'partner')
  with check (usuario_id = auth.uid());

create policy "admin_full_partners" on partners
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_partners_updated_at
  before update on partners
  for each row execute function set_updated_at();

-- =============================================
-- PARTNER_DOCUMENTOS
-- =============================================

create table partner_documentos (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references partners(id) on delete cascade,
  tipo          documento_tipo not null,
  storage_path  text not null,
  mime_type     text,
  tamanho_bytes bigint,
  validado      boolean not null default false,
  validado_por  uuid references usuarios(id) on delete set null,
  validado_em   timestamptz,
  observacoes   text,
  created_at    timestamptz not null default now()
);

alter table partner_documentos enable row level security;

create policy "partner_le_proprios_docs" on partner_documentos
  for select using (
    partner_id in (select id from partners where usuario_id = auth.uid())
    or public.app_is_admin()
  );

create policy "partner_insere_doc" on partner_documentos
  for insert with check (
    partner_id in (select id from partners where usuario_id = auth.uid())
  );

create policy "admin_full_partner_docs" on partner_documentos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- =============================================
-- EQUIPES
-- =============================================

create table equipes (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references partners(id) on delete cascade,
  nome               text not null,
  isolamento_estrito boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table equipes enable row level security;

create policy "equipe_visivel_ao_partner" on equipes
  for select using (partner_id = public.app_partner_id() or public.app_is_admin());

create policy "partner_gerencia_equipe" on equipes
  for all using (partner_id = public.app_partner_id() and public.app_user_role() = 'partner')
  with check (partner_id = public.app_partner_id());

create policy "admin_full_equipes" on equipes
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create trigger trg_equipes_updated_at
  before update on equipes
  for each row execute function set_updated_at();

-- =============================================
-- EQUIPE_MEMBROS
-- =============================================

create table equipe_membros (
  id                uuid primary key default gen_random_uuid(),
  equipe_id         uuid not null references equipes(id) on delete cascade,
  usuario_id        uuid not null references usuarios(id) on delete cascade,
  papel_equipe      text not null check (papel_equipe in ('admin_equipe','membro')),
  permissoes        jsonb not null default '{}',
  convite_token     text,
  convite_expira_em timestamptz,
  aceito_em         timestamptz,
  created_at        timestamptz not null default now(),
  unique (equipe_id, usuario_id)
);

alter table equipe_membros enable row level security;

create policy "membro_le_propria_equipe" on equipe_membros
  for select using (
    equipe_id = public.app_equipe_id()
    or equipe_id in (select id from equipes where partner_id = public.app_partner_id())
    or public.app_is_admin()
  );

create policy "partner_gerencia_membros" on equipe_membros
  for all using (
    equipe_id in (select id from equipes where partner_id = public.app_partner_id())
    and public.app_user_role() = 'partner'
  );

create policy "admin_full_membros" on equipe_membros
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- =============================================
-- CLIENTES
-- =============================================

create table clientes (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid unique references usuarios(id) on delete set null, -- nullable até ativar conta
  pessoa_tipo     pessoa_tipo not null default 'PF',
  nome_completo   text not null,
  cpf             text,
  cnpj            text,
  data_nascimento date,
  estado_civil    estado_civil,
  email           text,
  telefone_ddi    text not null default '55',
  telefone        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- índices de unicidade condicional
create unique index clientes_cpf_pf_unique
  on clientes (cpf) where pessoa_tipo = 'PF' and cpf is not null;
create unique index clientes_cnpj_pj_unique
  on clientes (cnpj) where pessoa_tipo = 'PJ' and cnpj is not null;

alter table clientes enable row level security;

create policy "cliente_le_proprio_perfil" on clientes
  for select using (usuario_id = auth.uid() or public.app_is_admin());

create policy "partner_team_le_clientes" on clientes
  for select using (
    public.app_user_role() in ('partner','team_member') and public.app_is_approved()
  );

create policy "admin_full_clientes" on clientes
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_team_insere_cliente" on clientes
  for insert with check (
    public.app_user_role() in ('partner','team_member') and public.app_is_approved()
  );

create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

-- =============================================
-- MAGIC_LINKS
-- =============================================

create table magic_links (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique, -- encode(digest(token,'sha256'),'hex')
  finalidade text not null check (finalidade in (
    'cliente_ativacao','partner_ativacao',
    'membro_convite','consulta_protocolo'
  )),
  payload    jsonb not null default '{}', -- {proposta_id?, equipe_id?, partner_id?}
  expires_at timestamptz not null,
  used_at    timestamptz,
  tentativas int not null default 0,
  created_by uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index magic_links_lookup_idx
  on magic_links (token_hash, expires_at)
  where used_at is null;

alter table magic_links enable row level security;

-- acesso direto apenas pelo admin; edge functions usam service_role
create policy "admin_full_magic_links" on magic_links
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- =============================================
-- SESSOES_2FA
-- =============================================

create table sessoes_2fa (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null unique references usuarios(id) on delete cascade,
  secret_encrypted text not null,
  verificado       boolean not null default false,
  recovery_codes   text[],
  created_at       timestamptz not null default now()
);

alter table sessoes_2fa enable row level security;

create policy "usuario_le_propria_2fa" on sessoes_2fa
  for select using (usuario_id = auth.uid() or public.app_is_admin());

create policy "usuario_gerencia_propria_2fa" on sessoes_2fa
  for all using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

