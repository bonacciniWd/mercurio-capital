-- Observações por proposta no Kanban (histórico + prints) — plano aprovado em
-- prompts/2026-11-11-kanban-observacoes-proposta.md (issues #18/#19/#20).
-- Interno apenas (admin + parceiro/equipe dona); cliente nunca alcança.
-- Carimbo de etapa server-side; janela de edição 15 min no servidor; soft delete com trilha.

-- ---------------------------------------------------------------
-- 1) Helpers de escopo (espelha o Kanban: partner_list_kanban_propostas)
-- ---------------------------------------------------------------
-- Espelha o Kanban vigente (20260925000004): exige aprovação vigente
-- (partner approved; team_member aceito e não suspenso) e cobre a carteira
-- direta do analista (responsavel_id).
create or replace function public.proposta_obs_pode_ver(p_proposta_id uuid)
returns boolean
language sql stable security definer
set search_path = public as $$
  select public.app_is_admin() is true or (
    public.app_is_approved() and exists (
      select 1 from public.propostas p
      where p.id = p_proposta_id
        and (p.partner_id = public.app_partner_id()
             or p.equipe_id = public.app_equipe_id()
             or (public.app_user_role() = 'team_member' and p.responsavel_id = auth.uid()))
    )
  );
$$;
revoke all on function public.proposta_obs_pode_ver(uuid) from public, anon, authenticated;
grant execute on function public.proposta_obs_pode_ver(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 2) Tabelas
-- ---------------------------------------------------------------
create table public.proposta_observacoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id),
  autor_papel text not null check (autor_papel in ('admin','partner','team_member')),
  corpo text not null check (length(btrim(corpo)) between 1 and 4000),
  etapa_snapshot public.proposta_status not null, -- carimbo do status no insert (server-side)
  editado_em timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.usuarios(id),
  deleted_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_proposta_observacoes_updated_at
  before update on public.proposta_observacoes
  for each row execute function public.set_updated_at();

create index proposta_observacoes_timeline_idx
  on public.proposta_observacoes (proposta_id, created_at desc) where deleted_at is null;
create index proposta_observacoes_autor_idx on public.proposta_observacoes (autor_id);

create table public.proposta_observacao_anexos (
  id uuid primary key default gen_random_uuid(),
  observacao_id uuid references public.proposta_observacoes(id) on delete cascade, -- null = preparado
  proposta_id uuid not null references public.propostas(id) on delete cascade,
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

create index proposta_obs_anexos_obs_idx on public.proposta_observacao_anexos (observacao_id) where observacao_id is not null;

alter table public.proposta_observacoes enable row level security;
alter table public.proposta_observacao_anexos enable row level security;

-- Grants de tabela no padrão estrito: escrita somente via RPCs.
revoke all on public.proposta_observacoes from public, anon, authenticated;
revoke all on public.proposta_observacao_anexos from public, anon, authenticated;
grant select on public.proposta_observacoes to authenticated;
grant select on public.proposta_observacao_anexos to authenticated;
grant all on public.proposta_observacoes to service_role;
grant all on public.proposta_observacao_anexos to service_role;

-- Trilha de removidos só para admin; demais veem apenas ativos.
create policy "proposta_obs_le" on public.proposta_observacoes
  for select to authenticated
  using (public.proposta_obs_pode_ver(proposta_id) and (deleted_at is null or public.app_is_admin()));

create policy "proposta_obs_anexo_le" on public.proposta_observacao_anexos
  for select to authenticated
  using (public.proposta_obs_pode_ver(proposta_id));

-- ---------------------------------------------------------------
-- 3) Storage (padrão acervo + A02: privado, 2 MB, MIME allowlist)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposta-obs', 'proposta-obs', false, 2097152, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- Upload só com linha 'preparado' correspondente e janela de 24 h.
create policy proposta_obs_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'proposta-obs'
  and exists (
    select 1 from public.proposta_observacao_anexos a
    where a.bucket = bucket_id and a.storage_path = name
      and a.enviado_por = auth.uid() and a.estado = 'preparado'
      and a.created_at > now() - interval '24 hours'
  )
);

create or replace function public.proposta_obs_pode_ler(p_bucket text, p_path text)
returns boolean
language sql stable security definer
set search_path = public as $$
  select public.app_is_admin() is true or exists (
    select 1
      from public.proposta_observacao_anexos a
      join public.proposta_observacoes o on o.id = a.observacao_id
     where a.bucket = p_bucket and a.storage_path = p_path
       and o.deleted_at is null
       and public.proposta_obs_pode_ver(a.proposta_id)
  );
$$;
revoke all on function public.proposta_obs_pode_ler(text, text) from public, anon;
grant execute on function public.proposta_obs_pode_ler(text, text) to authenticated;

create policy proposta_obs_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'proposta-obs' and public.proposta_obs_pode_ler(bucket_id, name)
);

-- Objetos referenciados são preservados (soft delete do comentário mantém o arquivo para a trilha).
create policy proposta_obs_preservar_delete on storage.objects as restrictive for delete to authenticated using (
  not (bucket_id = 'proposta-obs'
       and exists (select 1 from public.proposta_observacao_anexos a
                    where a.bucket = bucket_id and a.storage_path = name))
);
create policy proposta_obs_preservar_update on storage.objects as restrictive for update to authenticated using (
  not (bucket_id = 'proposta-obs'
       and exists (select 1 from public.proposta_observacao_anexos a
                    where a.bucket = bucket_id and a.storage_path = name))
);

-- ---------------------------------------------------------------
-- 4) RPCs (security definer; revoke estrito + grant a authenticated)
-- ---------------------------------------------------------------

-- 4.1 Preparar anexo (fase 1 do upload)
create or replace function public.proposta_obs_anexo_preparar(
  p_proposta_id uuid,
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
  if auth.uid() is null then raise exception 'nao autenticado' using errcode = '42501'; end if;
  if not public.proposta_obs_pode_ver(p_proposta_id) then
    raise exception 'fora_do_escopo' using errcode = '42501';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic') then
    raise exception 'mime_invalido';
  end if;
  if p_tamanho_bytes is null or p_tamanho_bytes <= 0 or p_tamanho_bytes > 2097152 then
    raise exception 'tamanho_invalido';
  end if;

  -- nome sanitizado (sem separadores/travessia) e extensão obrigatória coerente com o MIME
  v_nome := left(regexp_replace(btrim(coalesce(p_nome, 'print')), '[^A-Za-z0-9._-]+', '_', 'g'), 200);
  v_ext := lower(substring(v_nome from '\.([a-z0-9]+)$'));
  if v_ext is null
     or (p_mime_type = 'image/jpeg' and v_ext not in ('jpg','jpeg'))
     or (p_mime_type = 'image/png' and v_ext <> 'png')
     or (p_mime_type = 'image/webp' and v_ext <> 'webp')
     or (p_mime_type = 'image/heic' and v_ext not in ('heic','heif')) then
    raise exception 'extensao_incoerente_com_mime';
  end if;

  v_path := p_proposta_id::text || '/' || v_id::text || '-' || v_nome;

  insert into public.proposta_observacao_anexos
    (id, proposta_id, bucket, storage_path, nome, mime_type, tamanho_bytes, enviado_por)
  values (v_id, p_proposta_id, 'proposta-obs', v_path, v_nome, p_mime_type, p_tamanho_bytes, auth.uid());

  return query select v_id, 'proposta-obs'::text, v_path;
end;
$$;
revoke all on function public.proposta_obs_anexo_preparar(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.proposta_obs_anexo_preparar(uuid, text, text, integer) to authenticated;

-- 4.2 Criar observação (carimbo de etapa server-side + vínculo de anexos + notificação)
create or replace function public.proposta_observacao_criar(
  p_proposta_id uuid,
  p_corpo text,
  p_anexo_ids uuid[] default '{}'
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_status public.proposta_status;
  v_protocolo text;
  v_autor_nome text;
  v_anexos int;
  v_link_admin text := '/admin/propostas/' || p_proposta_id::text;
  v_link_partner text := '/p/propostas/' || p_proposta_id::text;
  v_dest record;
begin
  if auth.uid() is null then raise exception 'nao autenticado' using errcode = '42501'; end if;
  if not public.proposta_obs_pode_ver(p_proposta_id) then
    raise exception 'fora_do_escopo' using errcode = '42501';
  end if;
  if p_corpo is null or length(btrim(p_corpo)) < 1 or length(p_corpo) > 4000 then
    raise exception 'corpo_invalido';
  end if;
  if coalesce(array_length(p_anexo_ids, 1), 0) > 3 then
    raise exception 'maximo_3_anexos';
  end if;

  select p.status, p.protocolo into v_status, v_protocolo
    from public.propostas p where p.id = p_proposta_id;
  if v_status is null then raise exception 'proposta_inexistente' using errcode = '42501'; end if;

  insert into public.proposta_observacoes (id, proposta_id, autor_id, autor_papel, corpo, etapa_snapshot)
  values (v_id, p_proposta_id, auth.uid(), public.app_user_role(), btrim(p_corpo), v_status);

  -- vínculo de anexos: só preparado, do próprio autor, < 24 h, e objeto real no storage
  if coalesce(array_length(p_anexo_ids, 1), 0) > 0 then
    update public.proposta_observacao_anexos a
       set observacao_id = v_id, estado = 'recebido'
     where a.id = any(p_anexo_ids)
       and a.proposta_id = p_proposta_id
       and a.observacao_id is null
       and a.estado = 'preparado'
       and a.enviado_por = auth.uid()
       and a.created_at > now() - interval '24 hours'
       and exists (select 1 from storage.objects o
                    where o.bucket_id = a.bucket and o.name = a.storage_path);
    get diagnostics v_anexos = row_count;
    if v_anexos <> array_length(p_anexo_ids, 1) then
      raise exception 'anexo_invalido_ou_expirado';
    end if;
  end if;

  select split_part(u.nome_completo, ' ', 1) into v_autor_nome
    from public.usuarios u where u.id = auth.uid();

  -- Notificação in-app (fan-out de push é automático via trigger da Frente A).
  -- Mensagem sem trecho do comentário (lock screen segura). Nunca para autor/cliente.
  for v_dest in
    select dest.usuario_id, dest.papel
    from (
      -- parceiro dono, somente se aprovado
      select pa.usuario_id, 'partner'::text as papel
        from public.propostas p join public.partners pa on pa.id = p.partner_id
       where p.id = p_proposta_id and pa.status = 'approved'
      union
      -- responsável interno (admin ou team_member: link resolvido pelo papel real)
      select p.responsavel_id, ur.role::text
        from public.propostas p join public.usuarios ur on ur.id = p.responsavel_id
       where p.id = p_proposta_id and p.responsavel_id is not null
      union
      -- admins operacionais ativos
      select u.id, 'admin'::text
        from public.usuarios u
        join auth.users au on au.id = u.id
       where u.role = 'admin' and u.ativo
         and coalesce(nullif(au.raw_app_meta_data ->> 'admin_nivel', ''), 'full') in ('full','limitado')
    ) dest
    where dest.usuario_id is not null and dest.usuario_id <> auth.uid()
  loop
    insert into public.notificacoes (usuario_id, canal, titulo, mensagem, link, metadata)
    values (
      v_dest.usuario_id,
      'in_app',
      'Nova observação na proposta ' || coalesce(v_protocolo, ''),
      v_autor_nome || ' registrou uma observação na etapa atual da proposta.',
      case when v_dest.papel = 'admin' then v_link_admin else v_link_partner end, -- partner e team_member operam em /p/
      jsonb_build_object('tipo', 'proposta_observacao_nova', 'proposta_id', p_proposta_id,
                         'observacao_id', v_id, 'etapa_snapshot', v_status::text)
    );
  end loop;

  return v_id;
end;
$$;
revoke all on function public.proposta_observacao_criar(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.proposta_observacao_criar(uuid, text, uuid[]) to authenticated;

-- 4.3 Listar timeline (anexos agregados; removidos fora, trilha só admin via tabela)
create or replace function public.proposta_observacoes_listar(p_proposta_id uuid)
returns table (
  id uuid, autor_id uuid, autor_nome text, autor_papel text, corpo text,
  etapa_snapshot public.proposta_status, editado_em timestamptz, created_at timestamptz,
  anexos jsonb
)
language plpgsql stable security definer
set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nao autenticado' using errcode = '42501'; end if;
  if not public.proposta_obs_pode_ver(p_proposta_id) then
    raise exception 'fora_do_escopo' using errcode = '42501';
  end if;

  return query
  select o.id, o.autor_id, u.nome_completo, o.autor_papel, o.corpo,
         o.etapa_snapshot, o.editado_em, o.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                     'id', a.id, 'nome', a.nome, 'mime_type', a.mime_type,
                     'tamanho_bytes', a.tamanho_bytes, 'storage_path', a.storage_path)
                    order by a.created_at)
             from public.proposta_observacao_anexos a
            where a.observacao_id = o.id and a.estado = 'recebido'
         ), '[]'::jsonb) as anexos
    from public.proposta_observacoes o
    join public.usuarios u on u.id = o.autor_id
   where o.proposta_id = p_proposta_id
     and o.deleted_at is null
   order by o.created_at desc;
end;
$$;
revoke all on function public.proposta_observacoes_listar(uuid) from public, anon, authenticated;
grant execute on function public.proposta_observacoes_listar(uuid) to authenticated;

-- 4.4 Editar (autor, janela de 15 min no relógio do servidor)
create or replace function public.proposta_observacao_editar(p_id uuid, p_corpo text)
returns void
language plpgsql security definer
set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'nao autenticado' using errcode = '42501'; end if;
  if p_corpo is null or length(btrim(p_corpo)) < 1 or length(p_corpo) > 4000 then
    raise exception 'corpo_invalido';
  end if;

  update public.proposta_observacoes
     set corpo = btrim(p_corpo), editado_em = now()
   where id = p_id
     and autor_id = auth.uid()
     and deleted_at is null
     and created_at > now() - interval '15 minutes';
  get diagnostics v_n = row_count;

  if v_n = 0 then
    if exists (select 1 from public.proposta_observacoes
                where id = p_id and autor_id = auth.uid() and deleted_at is null
                  and created_at <= now() - interval '15 minutes') then
      raise exception 'janela_edicao_expirada';
    end if;
    raise exception 'observacao_indisponivel' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.proposta_observacao_editar(uuid, text) from public, anon, authenticated;
grant execute on function public.proposta_observacao_editar(uuid, text) to authenticated;

-- 4.5 Remover (autor na janela; admin a qualquer momento) — soft delete com trilha
create or replace function public.proposta_observacao_remover(p_id uuid, p_motivo text default null)
returns void
language plpgsql security definer
set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'nao autenticado' using errcode = '42501'; end if;

  -- admin removendo comentário alheio (ou fora da janela do autor) precisa justificar
  if public.app_is_admin()
     and exists (select 1 from public.proposta_observacoes
                  where id = p_id and deleted_at is null
                    and (autor_id <> auth.uid() or created_at <= now() - interval '15 minutes'))
     and (p_motivo is null or length(btrim(p_motivo)) < 3) then
    raise exception 'motivo_obrigatorio';
  end if;

  update public.proposta_observacoes
     set deleted_at = now(),
         deleted_by = auth.uid(),
         deleted_motivo = left(nullif(btrim(coalesce(p_motivo, '')), ''), 500)
   where id = p_id
     and deleted_at is null
     and (
       (autor_id = auth.uid() and created_at > now() - interval '15 minutes')
       or public.app_is_admin()
     );
  get diagnostics v_n = row_count;

  if v_n = 0 then
    if exists (select 1 from public.proposta_observacoes
                where id = p_id and autor_id = auth.uid() and deleted_at is null) then
      raise exception 'janela_edicao_expirada';
    end if;
    raise exception 'observacao_indisponivel' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.proposta_observacao_remover(uuid, text) from public, anon, authenticated;
grant execute on function public.proposta_observacao_remover(uuid, text) to authenticated;

-- 4.6 Contagem em lote (badge do card)
create or replace function public.proposta_observacao_contagem(p_proposta_ids uuid[])
returns table (proposta_id uuid, total bigint)
language plpgsql stable security definer
set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nao autenticado' using errcode = '42501'; end if;
  if coalesce(array_length(p_proposta_ids, 1), 0) = 0 then return; end if;
  if array_length(p_proposta_ids, 1) > 2000 then raise exception 'lote_grande'; end if;

  return query
  select o.proposta_id, count(*)::bigint
    from public.proposta_observacoes o
   where o.proposta_id = any(p_proposta_ids)
     and o.deleted_at is null
     and public.proposta_obs_pode_ver(o.proposta_id)
   group by o.proposta_id;
end;
$$;
revoke all on function public.proposta_observacao_contagem(uuid[]) from public, anon, authenticated;
grant execute on function public.proposta_observacao_contagem(uuid[]) to authenticated;
