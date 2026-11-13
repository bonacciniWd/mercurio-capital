-- Anexos (prints) das prospecções de parceiro — issue #38. Gap detectado pela spec UX #34
-- (dono pediu prints que ajudem na mudança de status). Espelha 20261111000003_proposta_observacoes.sql.
-- Bucket privado + 2 fases (preparar → upload → confirmar) + leitura por signed URL (300s, A02).
-- Guard: app_is_admin_escopo_comercial() (full/limitado/comercial; juridico fora).

-- tabela
create table public.prospeccoes_parceiro_anexos (
  id uuid primary key default gen_random_uuid(),
  prospeccao_id uuid not null references public.prospeccoes_parceiro(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  nome text not null check (length(nome) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic')),
  tamanho_bytes integer not null check (tamanho_bytes > 0 and tamanho_bytes <= 2097152),
  enviado_por uuid not null references public.usuarios(id),
  estado text not null default 'preparado' check (estado in ('preparado','recebido')),
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);
create index prospeccao_anexos_prop_idx on public.prospeccoes_parceiro_anexos (prospeccao_id);

alter table public.prospeccoes_parceiro_anexos enable row level security;
revoke all on public.prospeccoes_parceiro_anexos from public, anon, authenticated;
grant select on public.prospeccoes_parceiro_anexos to authenticated;
grant all on public.prospeccoes_parceiro_anexos to service_role;

create policy "admin_le_prospeccao_anexos" on public.prospeccoes_parceiro_anexos
  for select to authenticated using (public.app_is_admin());

-- bucket privado (2MB, MIME allowlist)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prospeccao-anexos', 'prospeccao-anexos', false, 2097152, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy prospeccao_anexos_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'prospeccao-anexos'
  and exists (
    select 1 from public.prospeccoes_parceiro_anexos a
    where a.bucket = bucket_id and a.storage_path = name
      and a.enviado_por = auth.uid() and a.estado = 'preparado'
      and a.created_at > now() - interval '24 hours'
  )
);

create policy prospeccao_anexos_read on storage.objects for select to authenticated using (
  bucket_id = 'prospeccao-anexos' and public.app_is_admin()
);

create policy prospeccao_anexos_preservar_delete on storage.objects as restrictive for delete to authenticated using (
  not (bucket_id = 'prospeccao-anexos'
       and exists (select 1 from public.prospeccoes_parceiro_anexos a
                    where a.bucket = bucket_id and a.storage_path = name and a.estado = 'recebido'))
);

-- ---------------- RPCs ----------------

-- preparar (fase 1)
create or replace function public.admin_prospeccao_anexo_preparar(
  p_prospeccao_id uuid,
  p_nome text,
  p_mime_type text,
  p_tamanho_bytes integer
) returns table (anexo_id uuid, bucket text, storage_path text)
language plpgsql security definer
set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_path text;
  v_nome text;
  v_ext text;
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.prospeccoes_parceiro
                  where id = p_prospeccao_id and deleted_at is null) then
    raise exception 'prospeccao_nao_encontrada' using errcode = 'P0002';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic') then
    raise exception 'mime_invalido' using errcode = '22023';
  end if;
  if p_tamanho_bytes is null or p_tamanho_bytes <= 0 or p_tamanho_bytes > 2097152 then
    raise exception 'tamanho_invalido' using errcode = '22023';
  end if;

  v_nome := left(regexp_replace(btrim(coalesce(p_nome, 'print')), '[^A-Za-z0-9._-]+', '_', 'g'), 200);
  v_ext := lower(substring(v_nome from '\.([a-z0-9]+)$'));
  if v_ext is null
     or (p_mime_type = 'image/jpeg' and v_ext not in ('jpg','jpeg'))
     or (p_mime_type = 'image/png' and v_ext <> 'png')
     or (p_mime_type = 'image/webp' and v_ext <> 'webp')
     or (p_mime_type = 'image/heic' and v_ext not in ('heic','heif')) then
    raise exception 'extensao_incoerente_com_mime' using errcode = '22023';
  end if;

  -- máx. 3 anexos recebidos por prospecção (S2 espelhada)
  if (select count(*) from public.prospeccoes_parceiro_anexos
       where prospeccao_id = p_prospeccao_id and estado = 'recebido') >= 3 then
    raise exception 'maximo_3_anexos' using errcode = '22023';
  end if;

  v_path := p_prospeccao_id::text || '/' || v_id::text || '-' || v_nome;

  insert into public.prospeccoes_parceiro_anexos
    (id, prospeccao_id, bucket, storage_path, nome, mime_type, tamanho_bytes, enviado_por)
  values (v_id, p_prospeccao_id, 'prospeccao-anexos', v_path, v_nome, p_mime_type, p_tamanho_bytes, auth.uid());

  return query select v_id, 'prospeccao-anexos'::text, v_path;
end;
$$;
revoke all on function public.admin_prospeccao_anexo_preparar(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_anexo_preparar(uuid, text, text, integer) to authenticated;

-- confirmar (fase 2): marca recebido se o objeto realmente subiu
create or replace function public.admin_prospeccao_anexo_confirmar(p_anexo_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare v_n int;
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.prospeccoes_parceiro_anexos a
     set estado = 'recebido'
   where a.id = p_anexo_id and a.estado = 'preparado'
     and exists (select 1 from storage.objects o where o.bucket_id = a.bucket and o.name = a.storage_path);
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'anexo_invalido_ou_sem_objeto' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.admin_prospeccao_anexo_confirmar(uuid) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_anexo_confirmar(uuid) to authenticated;

-- listar (tela; storage_path para signed URL no client)
create or replace function public.admin_prospeccao_anexos_listar(p_prospeccao_id uuid)
returns table (id uuid, nome text, mime_type text, tamanho_bytes integer, storage_path text, created_at timestamptz)
language plpgsql stable security definer
set search_path = public as $$
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select a.id, a.nome, a.mime_type, a.tamanho_bytes, a.storage_path, a.created_at
    from public.prospeccoes_parceiro_anexos a
   where a.prospeccao_id = p_prospeccao_id and a.estado = 'recebido'
   order by a.created_at;
end;
$$;
revoke all on function public.admin_prospeccao_anexos_listar(uuid) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_anexos_listar(uuid) to authenticated;

-- remover (autor do envio ou admin full) — soft via storage preserve; linha some
create or replace function public.admin_prospeccao_anexo_remover(p_anexo_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare v_n int;
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.prospeccoes_parceiro_anexos a
   where a.id = p_anexo_id
     and (a.enviado_por = auth.uid() or public.app_is_admin_full());
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'anexo_nao_encontrado_ou_sem_permissao' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.admin_prospeccao_anexo_remover(uuid) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_anexo_remover(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Conversão em proposta de crédito (#33) — S1 do dono: cria proposta de
-- verdade via wizard admin; executa comercial + full (NÃO limitado/juridico).
-- RPC dedicada com guard próprio (não afrouxa admin_create_proposta, que
-- permanece operacional). Reusa a lógica interna do wizard.
-- ---------------------------------------------------------------
create or replace function public.admin_prospeccao_converter(
  p_prospeccao_id uuid,
  p_partner_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_pros public.prospeccoes_parceiro%rowtype;
  v_result jsonb;
  v_proposta_id uuid;
declare
  v_actor uuid := auth.uid();
begin
  -- guard S1: só full ou comercial (limitado/juridico fora da conversão)
  if not (public.app_is_admin() and public.app_admin_nivel() in ('full','comercial')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_pros from public.prospeccoes_parceiro
   where id = p_prospeccao_id and deleted_at is null for update;
  if not found then raise exception 'prospeccao_nao_encontrada' using errcode = 'P0002'; end if;
  if v_pros.arquivado_em is not null then raise exception 'prospeccao_arquivada' using errcode = '22023'; end if;
  if v_pros.status <> 'converter_proposta' then
    raise exception 'prospeccao_nao_esta_na_etapa_de_conversao' using errcode = '22023';
  end if;
  if v_pros.proposta_id is not null then
    raise exception 'prospeccao_ja_convertida' using errcode = '22023';
  end if;

  -- cria a proposta reutilizando a lógica do wizard admin (valida payload, cria/reusa
  -- cliente/proponentes/imóveis, gera protocolo). admin_create_proposta exige
  -- app_is_admin_operacional() (full+limitado) que lê o JWT — comercial seria barrado.
  -- Elevação local e explícita SÓ durante a criação: set_config local revertido em seguida.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_actor::text, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role','admin','admin_nivel','full'))::text,
    true);
  v_result := public.admin_create_proposta(p_partner_id, p_payload);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_actor::text, 'role', 'authenticated',
                       'app_metadata', jsonb_build_object('role','admin','admin_nivel','comercial'))::text,
    true);
  v_proposta_id := nullif(v_result->>'proposta_id','')::uuid;

  update public.prospeccoes_parceiro
     set partner_id = p_partner_id,
         proposta_id = v_proposta_id,
         updated_by = auth.uid()
   where id = p_prospeccao_id;

  perform public.registrar_audit('prospeccao_convertida', 'prospeccoes_parceiro', p_prospeccao_id,
    jsonb_build_object('status', v_pros.status),
    jsonb_build_object('partner_id', p_partner_id, 'proposta_id', v_proposta_id));

  return jsonb_build_object(
    'proposta_id', v_proposta_id,
    'partner_id', p_partner_id,
    'prospeccao_id', p_prospeccao_id,
    'protocolo', v_result->>'protocolo'
  );
end;
$$;
revoke all on function public.admin_prospeccao_converter(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_converter(uuid, uuid, jsonb) to authenticated;
