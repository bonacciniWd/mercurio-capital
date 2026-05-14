-- =============================================
-- MIGRATION 010 — STORAGE BUCKETS (partner_docs)
-- =============================================
-- Bucket privado para upload de documentos de parceiros durante o onboarding.
-- Convenção de path: {partner_id}/{tipo}/{uuid}.{ext}
--   ex.: 9d3e..a1/contrato_social/4b2c..ff.pdf
-- O primeiro segmento do path É o partner_id e é o que governa o acesso.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner_docs',
  'partner_docs',
  false,
  10 * 1024 * 1024, -- 10 MB
  array['application/pdf','image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: confere se o primeiro segmento do path do objeto pertence ao partner do auth.uid()
create or replace function public.app_owns_partner_path(p_name text)
  returns boolean
  language sql
  stable
as $$
  select exists (
    select 1 from public.partners
    where usuario_id = auth.uid()
      and id::text = split_part(p_name, '/', 1)
  )
$$;

-- =============================================
-- POLICIES — storage.objects (bucket = partner_docs)
-- =============================================

drop policy if exists "partner_docs_select_self_or_admin" on storage.objects;
drop policy if exists "partner_docs_insert_self_or_admin" on storage.objects;
drop policy if exists "partner_docs_update_admin_only"   on storage.objects;
drop policy if exists "partner_docs_delete_admin_only"   on storage.objects;

create policy "partner_docs_select_self_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'partner_docs'
    and (public.app_is_admin() or public.app_owns_partner_path(name))
  );

create policy "partner_docs_insert_self_or_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'partner_docs'
    and (public.app_is_admin() or public.app_owns_partner_path(name))
  );

create policy "partner_docs_update_admin_only"
  on storage.objects for update
  using (bucket_id = 'partner_docs' and public.app_is_admin())
  with check (bucket_id = 'partner_docs' and public.app_is_admin());

create policy "partner_docs_delete_admin_only"
  on storage.objects for delete
  using (bucket_id = 'partner_docs' and public.app_is_admin());
