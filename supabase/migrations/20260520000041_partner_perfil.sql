-- =============================================
-- MIGRATION 041 — PERFIL DO PARCEIRO (configurações)
-- =============================================
-- Adiciona colunas para o formulário "Perfil da empresa", cria a tabela
-- de preferências de notificação por parceiro e expõe RPCs (get/update)
-- usadas pela tela /p/configuracoes. Também cria o bucket privado
-- `partner_branding` para upload de logo/avatar.

-- 1) Colunas que faltavam em partners
alter table public.partners
  add column if not exists razao_social text,
  add column if not exists website text;

-- 2) Preferências de notificação
create table if not exists public.partner_notif_prefs (
  partner_id  uuid not null references public.partners(id) on delete cascade,
  evento      text not null,
  whatsapp    boolean not null default true,
  email       boolean not null default true,
  push        boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (partner_id, evento)
);

alter table public.partner_notif_prefs enable row level security;

drop policy if exists "partner_le_proprias_prefs"  on public.partner_notif_prefs;
drop policy if exists "partner_edita_proprias_prefs" on public.partner_notif_prefs;
drop policy if exists "admin_full_prefs"            on public.partner_notif_prefs;

create policy "partner_le_proprias_prefs" on public.partner_notif_prefs
  for select using (
    exists (
      select 1 from public.partners p
      where p.id = partner_notif_prefs.partner_id
        and p.usuario_id = auth.uid()
    ) or public.app_is_admin()
  );

create policy "partner_edita_proprias_prefs" on public.partner_notif_prefs
  for all using (
    exists (
      select 1 from public.partners p
      where p.id = partner_notif_prefs.partner_id
        and p.usuario_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.partners p
      where p.id = partner_notif_prefs.partner_id
        and p.usuario_id = auth.uid()
    )
  );

create policy "admin_full_prefs" on public.partner_notif_prefs
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- 3) Bucket público para branding (logo/avatar do parceiro) — leitura
--    livre via getPublicUrl, escrita restrita pelas policies abaixo.
insert into storage.buckets (id, name, public)
values ('partner_branding', 'partner_branding', true)
on conflict (id) do update set public = true;

-- Policies de storage: cada parceiro só vê/escreve no seu prefixo <partner_id>/...
drop policy if exists "partner_branding_select_proprio" on storage.objects;
drop policy if exists "partner_branding_write_proprio"  on storage.objects;
drop policy if exists "partner_branding_admin_full"     on storage.objects;

create policy "partner_branding_select_proprio" on storage.objects
  for select using (
    bucket_id = 'partner_branding'
    and (
      public.app_is_admin()
      or exists (
        select 1 from public.partners p
        where p.usuario_id = auth.uid()
          and (storage.foldername(name))[1] = p.id::text
      )
    )
  );

create policy "partner_branding_write_proprio" on storage.objects
  for all using (
    bucket_id = 'partner_branding'
    and exists (
      select 1 from public.partners p
      where p.usuario_id = auth.uid()
        and (storage.foldername(name))[1] = p.id::text
    )
  ) with check (
    bucket_id = 'partner_branding'
    and exists (
      select 1 from public.partners p
      where p.usuario_id = auth.uid()
        and (storage.foldername(name))[1] = p.id::text
    )
  );

create policy "partner_branding_admin_full" on storage.objects
  for all using (bucket_id = 'partner_branding' and public.app_is_admin())
  with check (bucket_id = 'partner_branding' and public.app_is_admin());

-- 4) RPC — ler o perfil consolidado do parceiro logado
create or replace function public.partner_get_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select jsonb_build_object(
    'usuario_id',           u.id,
    'nome',                 u.nome_completo,
    'email',                u.email,
    'telefone',             u.telefone,
    'telefone_ddi',         u.telefone_ddi,
    'avatar_url',           u.avatar_url,
    'partner_id',           p.id,
    'partner_status',       p.status,
    'razao_social',         p.razao_social,
    'cpf',                  p.cpf,
    'website',              p.website,
    'endereco_cep',         p.endereco_cep,
    'endereco_logradouro',  p.endereco_logradouro,
    'endereco_numero',      p.endereco_numero,
    'endereco_complemento', p.endereco_complemento,
    'endereco_bairro',      p.endereco_bairro,
    'endereco_cidade',      p.endereco_cidade,
    'endereco_estado',      p.endereco_estado,
    'comissao_percentual',  p.comissao_percentual
  )
  into v_row
  from public.usuarios u
  left join public.partners p on p.usuario_id = u.id
  where u.id = v_uid;

  return coalesce(v_row, '{}'::jsonb);
end;
$$;

revoke all on function public.partner_get_profile() from public;
grant execute on function public.partner_get_profile() to authenticated;

-- 5) RPC — atualizar perfil
create or replace function public.partner_update_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_pid from public.partners where usuario_id = v_uid;
  if v_pid is null then
    raise exception 'partner_not_found';
  end if;

  update public.usuarios
     set nome_completo = coalesce(p_payload->>'nome',        nome_completo),
         telefone      = coalesce(p_payload->>'telefone',    telefone),
         telefone_ddi  = coalesce(p_payload->>'telefone_ddi', telefone_ddi),
         avatar_url    = coalesce(p_payload->>'avatar_url',  avatar_url)
   where id = v_uid;

  update public.partners
     set razao_social         = coalesce(p_payload->>'razao_social',         razao_social),
         cpf                  = coalesce(p_payload->>'cpf',                  cpf),
         website              = coalesce(p_payload->>'website',              website),
         endereco_cep         = coalesce(p_payload->>'endereco_cep',         endereco_cep),
         endereco_logradouro  = coalesce(p_payload->>'endereco_logradouro',  endereco_logradouro),
         endereco_numero      = coalesce(p_payload->>'endereco_numero',      endereco_numero),
         endereco_complemento = coalesce(p_payload->>'endereco_complemento', endereco_complemento),
         endereco_bairro      = coalesce(p_payload->>'endereco_bairro',      endereco_bairro),
         endereco_cidade      = coalesce(p_payload->>'endereco_cidade',      endereco_cidade),
         endereco_estado      = coalesce(p_payload->>'endereco_estado',      endereco_estado)
   where id = v_pid;

  return public.partner_get_profile();
end;
$$;

revoke all on function public.partner_update_profile(jsonb) from public;
grant execute on function public.partner_update_profile(jsonb) to authenticated;

-- 6) RPC — listar preferências de notificação
create or replace function public.partner_notif_prefs_list()
returns setof public.partner_notif_prefs
language sql
stable
security definer
set search_path = public
as $$
  select np.*
    from public.partner_notif_prefs np
    join public.partners p on p.id = np.partner_id
   where p.usuario_id = auth.uid()
   order by np.evento;
$$;

revoke all on function public.partner_notif_prefs_list() from public;
grant execute on function public.partner_notif_prefs_list() to authenticated;

-- 7) RPC — upsert das preferências
--    Payload: jsonb array de { evento, whatsapp, email, push }
create or replace function public.partner_notif_prefs_upsert(p_payload jsonb)
returns setof public.partner_notif_prefs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_pid from public.partners where usuario_id = v_uid;
  if v_pid is null then
    raise exception 'partner_not_found';
  end if;

  insert into public.partner_notif_prefs (partner_id, evento, whatsapp, email, push, updated_at)
  select v_pid,
         x->>'evento',
         coalesce((x->>'whatsapp')::boolean, true),
         coalesce((x->>'email')::boolean, true),
         coalesce((x->>'push')::boolean, false),
         now()
    from jsonb_array_elements(p_payload) x
  on conflict (partner_id, evento) do update
    set whatsapp   = excluded.whatsapp,
        email      = excluded.email,
        push       = excluded.push,
        updated_at = now();

  return query
    select * from public.partner_notif_prefs
     where partner_id = v_pid
     order by evento;
end;
$$;

revoke all on function public.partner_notif_prefs_upsert(jsonb) from public;
grant execute on function public.partner_notif_prefs_upsert(jsonb) to authenticated;
