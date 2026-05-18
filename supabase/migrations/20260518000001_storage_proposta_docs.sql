-- =============================================
-- MIGRATION 014 — STORAGE BUCKET (proposta-docs)
-- =============================================
-- Bucket privado para documentos vinculados a propostas.
-- Convenção de path: {proposta_id}/{categoria}/{uuid}.{ext}
--   ex.: 9d3e..a1/pessoa_fisica/4b2c..ff.pdf
-- O primeiro segmento do path É o proposta_id e governa o acesso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposta-docs',
  'proposta-docs',
  false,
  20 * 1024 * 1024, -- 20 MB
  array[
    'application/pdf',
    'image/png','image/jpeg','image/webp',
    'image/heic','image/heif'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =============================================
-- Helper: confere se o primeiro segmento do path do objeto é uma proposta
-- a qual o auth.uid() tem acesso (parceiro dono, equipe responsável ou cliente vinculado).
-- =============================================
create or replace function public.app_can_access_proposta_path(p_name text)
  returns boolean
  language sql
  stable
as $$
  select exists (
    select 1
    from public.propostas p
    where p.id::text = split_part(p_name, '/', 1)
      and (
        p.partner_id = public.app_partner_id()
        or p.equipe_id = public.app_equipe_id()
        or p.cliente_id in (
          select c.id from public.clientes c where c.usuario_id = auth.uid()
        )
      )
  )
$$;

-- =============================================
-- POLICIES — storage.objects (bucket = proposta-docs)
-- =============================================

drop policy if exists "proposta_docs_select" on storage.objects;
drop policy if exists "proposta_docs_insert" on storage.objects;
drop policy if exists "proposta_docs_update_admin" on storage.objects;
drop policy if exists "proposta_docs_delete_admin" on storage.objects;

create policy "proposta_docs_select"
  on storage.objects for select
  using (
    bucket_id = 'proposta-docs'
    and (public.app_is_admin() or public.app_can_access_proposta_path(name))
  );

create policy "proposta_docs_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'proposta-docs'
    and (public.app_is_admin() or public.app_can_access_proposta_path(name))
  );

create policy "proposta_docs_update_admin"
  on storage.objects for update
  using (bucket_id = 'proposta-docs' and public.app_is_admin())
  with check (bucket_id = 'proposta-docs' and public.app_is_admin());

create policy "proposta_docs_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'proposta-docs' and public.app_is_admin());
