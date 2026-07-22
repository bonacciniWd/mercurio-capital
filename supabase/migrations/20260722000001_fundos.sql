-- =============================================
-- MIGRATION — FUNDOS (tags internas por proposta)
-- =============================================
-- Equipe interna (role='admin') cria fundos (nome + cor) e atribui 1+ fundos a
-- uma proposta; cada fundo atribuído tem status por cores.
-- Parceiro e cliente NUNCA veem fundos (sem policy ⇒ sem acesso via RLS).
-- Aditiva: novas estruturas, sem alterar dados existentes.

-- Status por fundo (verde=aprovado, laranja=atencao, amarelo=aguardando, vermelho=rejeitado)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fundo_status') then
    create type public.fundo_status as enum ('aprovado', 'atencao', 'aguardando', 'rejeitado');
  end if;
end $$;

-- ---------------------------------------------------------------
-- Tabela: fundos (catálogo)
-- ---------------------------------------------------------------
create table if not exists public.fundos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cor_hex     text not null check (cor_hex ~ '^#[0-9A-Fa-f]{6}$'),
  ativo       boolean not null default true,
  created_by  uuid references public.usuarios(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Nome único entre fundos ativos (case-insensitive).
create unique index if not exists fundos_nome_unico_ativo_idx
  on public.fundos (lower(nome))
  where ativo;

alter table public.fundos enable row level security;

drop policy if exists "admin_full_fundos" on public.fundos;
create policy "admin_full_fundos" on public.fundos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

drop trigger if exists trg_fundos_updated_at on public.fundos;
create trigger trg_fundos_updated_at
  before update on public.fundos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Tabela: proposta_fundos (atribuição fundo ↔ proposta com status)
-- ---------------------------------------------------------------
create table if not exists public.proposta_fundos (
  proposta_id    uuid not null references public.propostas(id) on delete cascade,
  fundo_id       uuid not null references public.fundos(id) on delete cascade,
  status_fundo   public.fundo_status not null default 'aguardando',
  observacao     text,
  atribuido_por  uuid references public.usuarios(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (proposta_id, fundo_id)
);

create index if not exists proposta_fundos_fundo_idx
  on public.proposta_fundos (fundo_id);

alter table public.proposta_fundos enable row level security;

drop policy if exists "admin_full_proposta_fundos" on public.proposta_fundos;
create policy "admin_full_proposta_fundos" on public.proposta_fundos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

drop trigger if exists trg_proposta_fundos_updated_at on public.proposta_fundos;
create trigger trg_proposta_fundos_updated_at
  before update on public.proposta_fundos
  for each row execute function public.set_updated_at();
