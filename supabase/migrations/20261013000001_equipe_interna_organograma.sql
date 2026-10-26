-- Perfil organizacional interno e leitura segura do organograma.
create table if not exists public.departamentos_internos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departamentos_internos_nome_unique unique (nome),
  constraint departamentos_internos_nome_check check (length(btrim(nome)) between 2 and 100)
);

create table if not exists public.cargos_internos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cargos_internos_nome_unique unique (nome),
  constraint cargos_internos_nome_check check (length(btrim(nome)) between 2 and 100)
);

create table if not exists public.usuarios_internos (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  departamento_id uuid references public.departamentos_internos(id) on delete set null,
  cargo_id uuid references public.cargos_internos(id) on delete set null,
  gestor_usuario_id uuid references public.usuarios_internos(usuario_id) on delete set null,
  foto_path text,
  data_inicio date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_internos_sem_auto_gestor check (gestor_usuario_id is null or gestor_usuario_id <> usuario_id),
  constraint usuarios_internos_foto_path check (foto_path is null or (left(foto_path, length(usuario_id::text) + 1) = usuario_id::text || '/' and length(foto_path) <= 300))
);

create index if not exists usuarios_internos_gestor_idx on public.usuarios_internos (gestor_usuario_id);
create index if not exists usuarios_internos_departamento_idx on public.usuarios_internos (departamento_id);
create index if not exists usuarios_internos_cargo_idx on public.usuarios_internos (cargo_id);

insert into public.usuarios_internos (usuario_id)
select id from public.usuarios where role = 'admin'
on conflict (usuario_id) do nothing;

create or replace function public.validate_usuario_interno_manager()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_role public.user_role; v_active boolean; v_cycle boolean;
begin
  -- Serializa alterações de gestor para impedir ciclos criados por gravações simultâneas.
  perform pg_advisory_xact_lock(431001337);
  select role, ativo into v_role, v_active from public.usuarios where id = new.usuario_id;
  if not found or v_role <> 'admin' then raise exception 'usuario_interno_deve_ser_admin' using errcode = '23514'; end if;
  if new.gestor_usuario_id is not null then
    select u.role, u.ativo into v_role, v_active
      from public.usuarios_internos ui join public.usuarios u on u.id = ui.usuario_id
     where ui.usuario_id = new.gestor_usuario_id;
    if not found or v_role <> 'admin' or not v_active then
      raise exception 'gestor_deve_ser_admin_ativo' using errcode = '23514';
    end if;
    with recursive ancestors(id, gestor_id, path) as (
      select ui.usuario_id, ui.gestor_usuario_id, array[ui.usuario_id]
        from public.usuarios_internos ui where ui.usuario_id = new.gestor_usuario_id
      union all
      select ui.usuario_id, ui.gestor_usuario_id, a.path || ui.usuario_id
        from ancestors a join public.usuarios_internos ui on ui.usuario_id = a.gestor_id
       where not ui.usuario_id = any(a.path)
    ) select exists(select 1 from ancestors where id = new.usuario_id) into v_cycle;
    if v_cycle then raise exception 'ciclo_hierarquia_invalido' using errcode = '23514'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_validate_usuario_interno_manager on public.usuarios_internos;
create trigger trg_validate_usuario_interno_manager before insert or update on public.usuarios_internos
for each row execute function public.validate_usuario_interno_manager();

drop trigger if exists trg_departamentos_internos_updated_at on public.departamentos_internos;
create trigger trg_departamentos_internos_updated_at before update on public.departamentos_internos
for each row execute function public.set_updated_at();
drop trigger if exists trg_cargos_internos_updated_at on public.cargos_internos;
create trigger trg_cargos_internos_updated_at before update on public.cargos_internos
for each row execute function public.set_updated_at();

alter table public.departamentos_internos enable row level security;
alter table public.cargos_internos enable row level security;
alter table public.usuarios_internos enable row level security;
drop policy if exists departamentos_internos_admin_full on public.departamentos_internos;
create policy departamentos_internos_admin_full on public.departamentos_internos for all
  using (public.app_is_admin_full()) with check (public.app_is_admin_full());
drop policy if exists cargos_internos_admin_full on public.cargos_internos;
create policy cargos_internos_admin_full on public.cargos_internos for all
  using (public.app_is_admin_full()) with check (public.app_is_admin_full());
drop policy if exists usuarios_internos_admin_full on public.usuarios_internos;
create policy usuarios_internos_admin_full on public.usuarios_internos for all
  using (public.app_is_admin_full()) with check (public.app_is_admin_full());
drop policy if exists usuarios_internos_admin_read on public.usuarios_internos;
create policy usuarios_internos_admin_read on public.usuarios_internos for select
  using (public.app_is_admin());

revoke all on public.departamentos_internos, public.cargos_internos, public.usuarios_internos from public, anon, authenticated;
grant select on public.departamentos_internos, public.cargos_internos, public.usuarios_internos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares-internos', 'avatares-internos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists avatares_internos_admin_read on storage.objects;
create policy avatares_internos_admin_read on storage.objects for select to authenticated
using (bucket_id = 'avatares-internos' and public.app_is_admin());
drop policy if exists avatares_internos_admin_full_insert on storage.objects;
create policy avatares_internos_admin_full_insert on storage.objects for insert to authenticated
with check (bucket_id = 'avatares-internos' and public.app_is_admin_full() and exists (
  select 1 from public.usuarios u where u.id::text = (storage.foldername(name))[1] and u.role='admin'
));
drop policy if exists avatares_internos_admin_full_update on storage.objects;
create policy avatares_internos_admin_full_update on storage.objects for update to authenticated
using (bucket_id = 'avatares-internos' and public.app_is_admin_full() and exists (
  select 1 from public.usuarios u where u.id::text = (storage.foldername(name))[1] and u.role='admin'
))
with check (bucket_id = 'avatares-internos' and public.app_is_admin_full() and exists (
  select 1 from public.usuarios u where u.id::text = (storage.foldername(name))[1] and u.role='admin'
));
drop policy if exists avatares_internos_admin_full_delete on storage.objects;
create policy avatares_internos_admin_full_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatares-internos' and public.app_is_admin_full() and exists (
  select 1 from public.usuarios u where u.id::text = (storage.foldername(name))[1] and u.role='admin'
));

create or replace function public.admin_internal_team_update(
  p_usuario_id uuid, p_cargo_id uuid, p_departamento_id uuid, p_gestor_usuario_id uuid,
  p_foto_path text, p_data_inicio date
) returns void language plpgsql security definer set search_path = public, auth as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists (select 1 from public.usuarios where id=p_usuario_id and role='admin') then raise exception 'usuario_interno_nao_encontrado'; end if;
  if p_cargo_id is not null and not exists (select 1 from public.cargos_internos where id=p_cargo_id and ativo) then raise exception 'cargo_inativo_ou_nao_encontrado'; end if;
  if p_departamento_id is not null and not exists (select 1 from public.departamentos_internos where id=p_departamento_id and ativo) then raise exception 'departamento_inativo_ou_nao_encontrado'; end if;
  select to_jsonb(ui) into v_before from public.usuarios_internos ui where ui.usuario_id=p_usuario_id;
  insert into public.usuarios_internos(usuario_id,cargo_id,departamento_id,gestor_usuario_id,foto_path,data_inicio)
  values(p_usuario_id,p_cargo_id,p_departamento_id,p_gestor_usuario_id,p_foto_path,p_data_inicio)
  on conflict(usuario_id) do update set cargo_id=excluded.cargo_id, departamento_id=excluded.departamento_id,
    gestor_usuario_id=excluded.gestor_usuario_id, foto_path=excluded.foto_path, data_inicio=excluded.data_inicio;
  select to_jsonb(ui) into v_after from public.usuarios_internos ui where ui.usuario_id=p_usuario_id;
  insert into public.audit_log(usuario_id,acao,entidade,entidade_id,payload_antes,payload_depois)
  values(auth.uid(),'cadastro_usuario_interno_alterado','usuarios_internos',p_usuario_id,v_before,v_after);
end $$;
revoke all on function public.admin_internal_team_update(uuid,uuid,uuid,uuid,text,date) from public, anon;
grant execute on function public.admin_internal_team_update(uuid,uuid,uuid,uuid,text,date) to authenticated;

create or replace function public.admin_internal_team_graph()
returns table(usuario_id uuid,nome_completo text,foto_path text,cargo text,departamento text,gestor_usuario_id uuid,data_inicio date)
language sql stable security definer set search_path = public, auth as $$
  select ui.usuario_id, u.nome_completo, ui.foto_path, c.nome, d.nome,
    case when exists (select 1 from public.usuarios manager where manager.id=ui.gestor_usuario_id and manager.ativo and manager.role='admin')
      then ui.gestor_usuario_id else null end,
    ui.data_inicio
    from public.usuarios_internos ui join public.usuarios u on u.id=ui.usuario_id
    left join public.cargos_internos c on c.id=ui.cargo_id
    left join public.departamentos_internos d on d.id=ui.departamento_id
   where public.app_is_admin() and u.role='admin' and u.ativo
   order by coalesce(ui.gestor_usuario_id::text,''), u.nome_completo
$$;
revoke all on function public.admin_internal_team_graph() from public, anon;
grant execute on function public.admin_internal_team_graph() to authenticated;

create or replace function public.admin_internal_team_catalogs()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object(
    'cargos', coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'ativo',ativo) order by nome) from public.cargos_internos),'[]'::jsonb),
    'departamentos', coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'ativo',ativo) order by nome) from public.departamentos_internos),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_internal_team_catalogs() from public, anon;
grant execute on function public.admin_internal_team_catalogs() to authenticated;

create or replace function public.admin_internal_team_list()
returns table(usuario_id uuid,nome_completo text,email text,ativo boolean,ultimo_login_at timestamptz,admin_nivel text,
  cargo_id uuid,cargo text,departamento_id uuid,departamento text,gestor_usuario_id uuid,gestor_nome text,foto_path text,data_inicio date)
language sql stable security definer set search_path = public, auth as $$
  select u.id,u.nome_completo,u.email,u.ativo,u.ultimo_login_at,
    coalesce(au.raw_app_meta_data->>'admin_nivel','full'),ui.cargo_id,c.nome,ui.departamento_id,d.nome,
    ui.gestor_usuario_id,g.nome_completo,ui.foto_path,ui.data_inicio
  from public.usuarios u left join public.usuarios_internos ui on ui.usuario_id=u.id
  left join public.cargos_internos c on c.id=ui.cargo_id
  left join public.departamentos_internos d on d.id=ui.departamento_id
  left join public.usuarios g on g.id=ui.gestor_usuario_id
  left join auth.users au on au.id=u.id
  where public.app_is_admin_full() and u.role='admin'
  order by u.nome_completo
$$;
revoke all on function public.admin_internal_team_list() from public, anon;
grant execute on function public.admin_internal_team_list() to authenticated;

create or replace function public.admin_internal_team_catalog_upsert(p_tipo text,p_id uuid,p_nome text,p_descricao text,p_ativo boolean)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid; v_nome text:=btrim(coalesce(p_nome,''));
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode='42501'; end if;
  if coalesce(p_tipo,'') not in ('cargo','departamento') or length(v_nome) not between 2 and 100 then raise exception 'dados_invalidos'; end if;
  if p_tipo='cargo' then
    insert into public.cargos_internos(id,nome,descricao,ativo) values(coalesce(p_id,gen_random_uuid()),v_nome,nullif(btrim(p_descricao),''),coalesce(p_ativo,true))
    on conflict(id) do update set nome=excluded.nome,descricao=excluded.descricao,ativo=excluded.ativo returning id into v_id;
  else
    insert into public.departamentos_internos(id,nome,descricao,ativo) values(coalesce(p_id,gen_random_uuid()),v_nome,nullif(btrim(p_descricao),''),coalesce(p_ativo,true))
    on conflict(id) do update set nome=excluded.nome,descricao=excluded.descricao,ativo=excluded.ativo returning id into v_id;
  end if;
  insert into public.audit_log(usuario_id,acao,entidade,entidade_id,payload_depois)
  values(auth.uid(),'catalogo_interno_alterado','catalogo_'||p_tipo,v_id,jsonb_build_object('nome',v_nome,'ativo',coalesce(p_ativo,true)));
  return v_id;
end $$;
revoke all on function public.admin_internal_team_catalog_upsert(text,uuid,text,text,boolean) from public, anon;
grant execute on function public.admin_internal_team_catalog_upsert(text,uuid,text,text,boolean) to authenticated;
