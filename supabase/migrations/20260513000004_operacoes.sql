-- =============================================
-- MIGRATION 004 — OPERAÇÕES (CONTRATOS & COMISSÕES)
-- =============================================

-- =============================================
-- CONTRATOS
-- =============================================

create table contratos (
  id                   uuid primary key default gen_random_uuid(),
  proposta_id          uuid not null unique references propostas(id) on delete restrict,
  pdf_storage_path     text,
  provedor_assinatura  text check (provedor_assinatura in ('d4sign','clicksign')),
  provider_envelope_id text,
  gerado_por           uuid references usuarios(id) on delete set null,
  gerado_em            timestamptz,
  assinado_em          timestamptz,
  registrado_em        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table contratos enable row level security;

create policy "admin_full_contratos" on contratos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_le_contrato" on contratos
  for select using (
    proposta_id in (
      select id from propostas where partner_id = public.app_partner_id()
    )
  );

create policy "cliente_le_contrato" on contratos
  for select using (
    proposta_id in (
      select id from propostas
      where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

create trigger trg_contratos_updated_at
  before update on contratos
  for each row execute function set_updated_at();

-- =============================================
-- ASSINATURAS_CONTRATO
-- =============================================

create table assinaturas_contrato (
  id                  uuid primary key default gen_random_uuid(),
  contrato_id         uuid not null references contratos(id) on delete cascade,
  signatario_nome     text not null,
  signatario_email    text not null,
  signatario_cpf_cnpj text,
  papel               text not null check (papel in ('tomador','conjuge','vendedor','testemunha')),
  status              text not null default 'pendente' check (status in ('pendente','assinado','rejeitado')),
  assinado_em         timestamptz,
  ip_assinatura       inet
);

alter table assinaturas_contrato enable row level security;

create policy "admin_full_assinaturas" on assinaturas_contrato
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_le_assinaturas" on assinaturas_contrato
  for select using (
    contrato_id in (
      select c.id from contratos c
      join propostas p on p.id = c.proposta_id
      where p.partner_id = public.app_partner_id()
    )
  );

create policy "cliente_le_assinaturas" on assinaturas_contrato
  for select using (
    contrato_id in (
      select c.id from contratos c
      join propostas p on p.id = c.proposta_id
      where p.cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

-- =============================================
-- LIBERACOES_RECURSO
-- =============================================

create table liberacoes_recurso (
  id                       uuid primary key default gen_random_uuid(),
  proposta_id              uuid not null references propostas(id) on delete restrict,
  valor_liberado           numeric(14,2) not null,
  data_liberacao           date not null,
  comprovante_storage_path text,
  created_at               timestamptz not null default now()
);

alter table liberacoes_recurso enable row level security;

create policy "admin_full_liberacoes" on liberacoes_recurso
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_le_liberacoes" on liberacoes_recurso
  for select using (
    proposta_id in (
      select id from propostas where partner_id = public.app_partner_id()
    )
  );

create policy "cliente_le_liberacoes" on liberacoes_recurso
  for select using (
    proposta_id in (
      select id from propostas
      where cliente_id in (select id from clientes where usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

-- =============================================
-- COMISSOES
-- =============================================

create table comissoes (
  id          uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references propostas(id) on delete restrict,
  partner_id  uuid not null references partners(id) on delete restrict,
  percentual  numeric(5,2) not null,
  valor       numeric(14,2) not null,
  status      text not null default 'prevista' check (status in ('prevista','aprovada','paga')),
  paga_em     timestamptz,
  created_at  timestamptz not null default now()
);

create index comissoes_partner_idx on comissoes (partner_id, status);

alter table comissoes enable row level security;

create policy "admin_full_comissoes" on comissoes
  for all using (public.app_is_admin()) with check (public.app_is_admin());

create policy "partner_le_proprias_comissoes" on comissoes
  for select using (partner_id = public.app_partner_id());

