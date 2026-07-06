-- =====================================================================
-- Partner Milestones CRUD
-- Cria tabela `partner_milestones` para gerenciar premios de milestones
-- pelo admin, com RLS, bucket de storage para imagens e seed dos 3
-- premios que hoje estao hardcoded no front (Rolex / BMW / Corvette).
-- =====================================================================

-- 1) TABELA -----------------------------------------------------------
create table if not exists public.partner_milestones (
  id                  uuid primary key default gen_random_uuid(),
  order_index         int not null,
  label               text not null,                     -- ex: "R$ 5 Milhoes"
  prize               text not null,                     -- ex: "Rolex Oyster Perpetual"
  descricao           text,                              -- copy exibida no card
  target_centavos     bigint not null check (target_centavos > 0),
  color               text not null default '#D4AF37',   -- hex usado nos gradientes
  image_url           text,                              -- URL publica (bucket ou /public)
  image_storage_path  text,                              -- caminho no bucket (opcional)
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint partner_milestones_order_unique unique (order_index)
);

comment on table public.partner_milestones is
  'Premios de milestones exibidos ao parceiro conforme volume liberado de CGI.';

create index if not exists idx_partner_milestones_ativo_order
  on public.partner_milestones (ativo, order_index);

-- trigger updated_at
drop trigger if exists trg_partner_milestones_updated_at on public.partner_milestones;
create trigger trg_partner_milestones_updated_at
  before update on public.partner_milestones
  for each row execute function public.set_updated_at();

-- 2) RLS --------------------------------------------------------------
alter table public.partner_milestones enable row level security;

drop policy if exists "milestones_select_authenticated" on public.partner_milestones;
create policy "milestones_select_authenticated" on public.partner_milestones
  for select to authenticated
  using (ativo or public.app_is_admin());

drop policy if exists "milestones_admin_all" on public.partner_milestones;
create policy "milestones_admin_all" on public.partner_milestones
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

-- 3) STORAGE BUCKET ---------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-images', 'milestone-images', true, 2 * 1024 * 1024,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
) on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "milestone_images_select" on storage.objects;
create policy "milestone_images_select" on storage.objects
  for select using (bucket_id = 'milestone-images');

drop policy if exists "milestone_images_admin_all" on storage.objects;
create policy "milestone_images_admin_all" on storage.objects
  for all
  using (bucket_id = 'milestone-images' and public.app_is_admin())
  with check (bucket_id = 'milestone-images' and public.app_is_admin());

-- 4) SEED (idempotente) ----------------------------------------------
insert into public.partner_milestones
  (order_index, label, prize, descricao, target_centavos, color, image_url, ativo)
values
  (1, 'R$ 5 Milhoes',   'Rolex Oyster Perpetual',
   'O icone do sucesso. Conquiste R$ 5M em liberacoes CGI e ganhe um Rolex Submariner.',
   500000000,   '#D4AF37', '/milestones/prem1.svg', true),
  (2, 'R$ 50 Milhoes',  'BMW 330e M Sport',
   'Performance hibrida e luxo. Libere R$ 50M em CGI e ganhe um BMW 330e M Sport.',
   5000000000,  '#60a5fa', '/milestones/prem2.svg', true),
  (3, 'R$ 100 Milhoes', 'Corvette C8',
   'O apice dos milestones. Libere R$ 100M em CGI e conquiste um Corvette C8.',
   10000000000, '#f87171', '/milestones/prem3.svg', true)
on conflict (order_index) do nothing;

