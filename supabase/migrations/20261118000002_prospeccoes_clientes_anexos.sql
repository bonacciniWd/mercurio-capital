-- Prints privados da carteira B2C; nenhum grant do domínio B2B é ampliado.
create table public.prospeccoes_clientes_anexos (
  id uuid primary key default gen_random_uuid(),
  prospeccao_id uuid not null references public.prospeccoes_clientes(id) on delete restrict,
  bucket text not null default 'prospeccao-clientes-anexos' check (bucket = 'prospeccao-clientes-anexos'),
  storage_path text not null,
  nome text not null check (length(nome) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic')),
  tamanho_bytes integer not null check (tamanho_bytes between 1 and 2097152),
  estado text not null default 'preparado' check (estado in ('preparado','recebido')),
  expira_em timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.usuarios(id),
  updated_by uuid not null references public.usuarios(id),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);
create index prospeccoes_clientes_anexos_prospeccao_idx
  on public.prospeccoes_clientes_anexos(prospeccao_id) where deleted_at is null;
create trigger trg_prospeccoes_clientes_anexos_updated_at before update on public.prospeccoes_clientes_anexos
  for each row execute function public.set_updated_at();

create function public.prospeccao_cliente_anexo_acesso(p_id uuid, p_escrita boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.app_can_operate() and exists (
    select 1 from public.prospeccoes_clientes p
    where p.id = p_id and p.deleted_at is null
      and (not p_escrita or p.status <> 'proposta_criada')
      and (
        public.app_is_admin_escopo_comercial()
        or (public.app_user_role() = 'partner' and public.app_is_approved() and p.partner_id = public.app_partner_id())
        or (public.app_user_role() = 'team_member' and public.app_is_approved() and p.equipe_id = public.app_equipe_id())
      )
  );
$$;
revoke all on function public.prospeccao_cliente_anexo_acesso(uuid,boolean) from public, anon;
grant execute on function public.prospeccao_cliente_anexo_acesso(uuid,boolean) to authenticated;

alter table public.prospeccoes_clientes_anexos enable row level security;
revoke all on public.prospeccoes_clientes_anexos from public, anon, authenticated;
grant select on public.prospeccoes_clientes_anexos to authenticated;
grant all on public.prospeccoes_clientes_anexos to service_role;
create policy prospeccoes_clientes_anexos_ler on public.prospeccoes_clientes_anexos for select to authenticated using (
  deleted_at is null and public.prospeccao_cliente_anexo_acesso(prospeccao_id)
  and (estado = 'recebido' or created_by = auth.uid())
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('prospeccao-clientes-anexos','prospeccao-clientes-anexos',false,2097152,
  array['image/jpeg','image/png','image/webp','image/heic']);

-- RLS de upload/delete também bloqueia a reserva, coordenando cancelar/confirmar.
-- Ordem de bloqueios em todos os caminhos: prospect -> reserva.
create function public.prospeccao_cliente_anexo_objeto_permitido(p_bucket text, p_path text, p_operacao text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_row public.prospeccoes_clientes_anexos%rowtype; v_id uuid;
begin
  if p_bucket <> 'prospeccao-clientes-anexos' or p_operacao not in ('upload','cancelar') then return false; end if;
  select prospeccao_id into v_id from public.prospeccoes_clientes_anexos where storage_path = p_path and bucket = p_bucket;
  if not public.prospeccao_cliente_anexo_acesso(v_id, p_operacao = 'upload') then return false; end if;
  perform 1 from public.prospeccoes_clientes where id = v_id for update;
  select * into v_row from public.prospeccoes_clientes_anexos where storage_path = p_path and bucket = p_bucket for update;
  return found and v_row.deleted_at is null and v_row.estado = 'preparado' and v_row.created_by = auth.uid()
    and public.prospeccao_cliente_anexo_acesso(v_id, p_operacao = 'upload')
    and (p_operacao = 'cancelar' or v_row.expira_em > now());
end;
$$;
revoke all on function public.prospeccao_cliente_anexo_objeto_permitido(text,text,text) from public,anon;
grant execute on function public.prospeccao_cliente_anexo_objeto_permitido(text,text,text) to authenticated;

-- Restritivas impedem que policies permissivas genéricas liberem este bucket.
create policy b2c_anexos_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'prospeccao-clientes-anexos' and public.prospeccao_cliente_anexo_objeto_permitido(bucket_id,name,'upload')
);
create policy b2c_anexos_upload_restrito on storage.objects as restrictive for insert to authenticated with check (
  bucket_id <> 'prospeccao-clientes-anexos' or public.prospeccao_cliente_anexo_objeto_permitido(bucket_id,name,'upload')
);
create policy b2c_anexos_ler on storage.objects for select to authenticated using (
  bucket_id = 'prospeccao-clientes-anexos' and exists (
    select 1 from public.prospeccoes_clientes_anexos a where a.bucket = bucket_id and a.storage_path = name
      and a.deleted_at is null and public.prospeccao_cliente_anexo_acesso(a.prospeccao_id)
      and (a.estado = 'recebido' or a.created_by = auth.uid())
  )
);
create policy b2c_anexos_ler_restrito on storage.objects as restrictive for select to authenticated using (
  bucket_id <> 'prospeccao-clientes-anexos' or exists (
    select 1 from public.prospeccoes_clientes_anexos a where a.bucket = bucket_id and a.storage_path = name
      and a.deleted_at is null and public.prospeccao_cliente_anexo_acesso(a.prospeccao_id)
      and (a.estado = 'recebido' or a.created_by = auth.uid())
  )
);
create policy b2c_anexos_sem_overwrite on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'prospeccao-clientes-anexos') with check (bucket_id <> 'prospeccao-clientes-anexos');
create policy b2c_anexos_cancelar_rascunho on storage.objects for delete to authenticated using (
  bucket_id = 'prospeccao-clientes-anexos' and public.prospeccao_cliente_anexo_objeto_permitido(bucket_id,name,'cancelar')
);
create policy b2c_anexos_preservar_recebidos on storage.objects as restrictive for delete to authenticated using (
  bucket_id <> 'prospeccao-clientes-anexos' or public.prospeccao_cliente_anexo_objeto_permitido(bucket_id,name,'cancelar')
);
create policy b2c_anexos_anon_negado on storage.objects as restrictive for all to anon
  using (bucket_id <> 'prospeccao-clientes-anexos') with check (bucket_id <> 'prospeccao-clientes-anexos');

create function public.prospeccao_cliente_anexo_preparar(p_prospeccao_id uuid, p_nome text, p_mime_type text, p_tamanho_bytes integer)
returns table(anexo_id uuid, bucket text, storage_path text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_nome text; v_ext text; v_path text;
begin
  if not public.prospeccao_cliente_anexo_acesso(p_prospeccao_id,true) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.prospeccoes_clientes where id = p_prospeccao_id for update;
  if not public.prospeccao_cliente_anexo_acesso(p_prospeccao_id,true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_mime_type is null or p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic') then raise exception 'mime_invalido' using errcode = '22023'; end if;
  if p_tamanho_bytes is null or p_tamanho_bytes not between 1 and 2097152 then raise exception 'tamanho_invalido' using errcode = '22023'; end if;
  v_nome := left(regexp_replace(btrim(coalesce(p_nome,'')), '[^A-Za-z0-9._-]+', '_','g'),200);
  v_ext := lower(substring(v_nome from '\.([a-z0-9]+)$'));
  if length(v_nome) = 0 or v_ext is null
    or (p_mime_type = 'image/jpeg' and v_ext not in ('jpg','jpeg'))
    or (p_mime_type = 'image/png' and v_ext <> 'png')
    or (p_mime_type = 'image/webp' and v_ext <> 'webp')
    or (p_mime_type = 'image/heic' and v_ext not in ('heic','heif')) then raise exception 'extensao_invalida' using errcode = '22023'; end if;
  if (select count(*) from public.prospeccoes_clientes_anexos a where a.prospeccao_id = p_prospeccao_id
    and a.deleted_at is null and (a.estado = 'recebido' or a.expira_em > now())) >= 3 then
    raise exception 'maximo_3_anexos' using errcode = '22023';
  end if;
  v_path := p_prospeccao_id::text || '/' || v_id::text || '.' || v_ext;
  insert into public.prospeccoes_clientes_anexos(id,prospeccao_id,storage_path,nome,mime_type,tamanho_bytes,created_by,updated_by)
  values(v_id,p_prospeccao_id,v_path,v_nome,p_mime_type,p_tamanho_bytes,auth.uid(),auth.uid());
  perform public.registrar_audit('prospeccao_cliente_anexo_preparado','prospeccoes_clientes_anexos',v_id,null,jsonb_build_object('prospeccao_id',p_prospeccao_id));
  return query select v_id,'prospeccao-clientes-anexos'::text,v_path;
end;
$$;

create function public.prospeccao_cliente_anexo_confirmar(p_anexo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.prospeccoes_clientes_anexos%rowtype; v_prospeccao_id uuid;
begin
  select prospeccao_id into v_prospeccao_id from public.prospeccoes_clientes_anexos where id = p_anexo_id;
  if not public.prospeccao_cliente_anexo_acesso(v_prospeccao_id,true) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.prospeccoes_clientes where id = v_prospeccao_id for update;
  select * into v_row from public.prospeccoes_clientes_anexos where id = p_anexo_id and deleted_at is null for update;
  if not found or v_row.created_by is distinct from auth.uid() or not public.prospeccao_cliente_anexo_acesso(v_prospeccao_id,true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.estado = 'recebido' then return; end if;
  if v_row.expira_em <= now() then raise exception 'reserva_expirada' using errcode = '22023'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id = v_row.bucket and o.name = v_row.storage_path
    and (o.metadata->>'size')::bigint = v_row.tamanho_bytes and o.metadata->>'mimetype' = v_row.mime_type) then
    raise exception 'anexo_sem_objeto_valido' using errcode = '22023';
  end if;
  if (select count(*) from public.prospeccoes_clientes_anexos a where a.prospeccao_id = v_prospeccao_id
    and a.estado = 'recebido' and a.deleted_at is null) >= 3 then raise exception 'maximo_3_anexos' using errcode = '22023'; end if;
  update public.prospeccoes_clientes_anexos set estado = 'recebido', updated_by = auth.uid() where id = p_anexo_id;
  perform public.registrar_audit('prospeccao_cliente_anexo_recebido','prospeccoes_clientes_anexos',p_anexo_id,null,jsonb_build_object('prospeccao_id',v_prospeccao_id));
end;
$$;

create function public.prospeccao_cliente_anexo_cancelar(p_anexo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.prospeccoes_clientes_anexos%rowtype; v_id uuid;
begin
  select prospeccao_id into v_id from public.prospeccoes_clientes_anexos where id = p_anexo_id;
  if not public.prospeccao_cliente_anexo_acesso(v_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.prospeccoes_clientes where id = v_id for update;
  select * into v_row from public.prospeccoes_clientes_anexos where id = p_anexo_id for update;
  if not found or v_row.created_by is distinct from auth.uid() or not public.prospeccao_cliente_anexo_acesso(v_row.prospeccao_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.deleted_at is not null then return; end if;
  if v_row.estado <> 'preparado' then raise exception 'anexo_ja_recebido' using errcode = '22023'; end if;
  if exists(select 1 from storage.objects where bucket_id = v_row.bucket and name = v_row.storage_path) then raise exception 'remova_objeto_pendente' using errcode = '22023'; end if;
  update public.prospeccoes_clientes_anexos set deleted_at = now(),updated_by = auth.uid() where id = p_anexo_id;
  perform public.registrar_audit('prospeccao_cliente_anexo_cancelado','prospeccoes_clientes_anexos',p_anexo_id,null,jsonb_build_object('prospeccao_id',v_row.prospeccao_id));
end;
$$;
revoke all on function public.prospeccao_cliente_anexo_preparar(uuid,text,text,integer) from public,anon;
revoke all on function public.prospeccao_cliente_anexo_confirmar(uuid) from public,anon;
revoke all on function public.prospeccao_cliente_anexo_cancelar(uuid) from public,anon;
grant execute on function public.prospeccao_cliente_anexo_preparar(uuid,text,text,integer) to authenticated;
grant execute on function public.prospeccao_cliente_anexo_confirmar(uuid) to authenticated;
grant execute on function public.prospeccao_cliente_anexo_cancelar(uuid) to authenticated;
