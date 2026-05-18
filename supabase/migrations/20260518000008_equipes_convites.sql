-- =============================================
-- MIGRATION 020 — EQUIPES & CONVITES (Fase 4)
-- =============================================

-- =============================================
-- RPC: partner_create_equipe(nome, isolamento_estrito)
-- =============================================
create or replace function public.partner_create_equipe(
  p_nome text,
  p_isolamento_estrito boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text := public.app_user_role();
  v_partner_id uuid := public.app_partner_id();
  v_id         uuid;
begin
  if v_role <> 'partner' or v_partner_id is null then
    raise exception 'somente parceiros aprovados podem criar equipes';
  end if;
  if length(coalesce(trim(p_nome), '')) < 2 then
    raise exception 'nome de equipe invalido';
  end if;

  insert into equipes (partner_id, nome, isolamento_estrito)
  values (v_partner_id, trim(p_nome), coalesce(p_isolamento_estrito, false))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.partner_create_equipe(text, boolean) from public;
grant execute on function public.partner_create_equipe(text, boolean) to authenticated;

-- =============================================
-- RPC: partner_update_equipe(id, nome, isolamento_estrito)
-- =============================================
create or replace function public.partner_update_equipe(
  p_equipe_id uuid,
  p_nome text,
  p_isolamento_estrito boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text := public.app_user_role();
  v_partner_id uuid := public.app_partner_id();
begin
  if not (v_role = 'admin' or (v_role = 'partner' and exists (
    select 1 from equipes where id = p_equipe_id and partner_id = v_partner_id
  ))) then
    raise exception 'sem permissao para alterar equipe';
  end if;

  update equipes
     set nome = coalesce(nullif(trim(p_nome), ''), nome),
         isolamento_estrito = coalesce(p_isolamento_estrito, isolamento_estrito),
         updated_at = now()
   where id = p_equipe_id;
end;
$$;

revoke all on function public.partner_update_equipe(uuid, text, boolean) from public;
grant execute on function public.partner_update_equipe(uuid, text, boolean) to authenticated;

-- =============================================
-- RPC: partner_invite_membro(equipe_id, email, nome, papel_equipe, permissoes)
-- Cria magic_link membro_convite (TTL 30min). Retorna token plaintext (parceiro envia).
-- =============================================
create or replace function public.partner_invite_membro(
  p_equipe_id uuid,
  p_email text,
  p_nome text,
  p_papel_equipe text default 'membro',
  p_permissoes jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text := public.app_user_role();
  v_partner_id uuid := public.app_partner_id();
  v_token      text;
  v_hash       text;
  v_ttl_min    int;
  v_payload    jsonb;
begin
  if p_papel_equipe not in ('admin_equipe', 'membro') then
    raise exception 'papel invalido';
  end if;
  if length(coalesce(trim(p_email), '')) < 5 then
    raise exception 'email invalido';
  end if;

  if not (v_role = 'admin' or (v_role = 'partner' and exists (
    select 1 from equipes where id = p_equipe_id and partner_id = v_partner_id
  ))) then
    raise exception 'sem permissao para convidar nesta equipe';
  end if;

  -- invalida convites pendentes anteriores para o mesmo email/equipe
  update magic_links
     set used_at = now()
   where finalidade = 'membro_convite'
     and used_at is null
     and (payload->>'equipe_id')::uuid = p_equipe_id
     and lower(payload->>'email') = lower(trim(p_email));

  select coalesce((valor)::int, 30) into v_ttl_min
    from configuracoes_sistema
   where chave = 'magic_link_ttl_min';

  v_token := public.gen_magic_token(40);
  v_hash  := encode(digest(v_token, 'sha256'), 'hex');

  v_payload := jsonb_build_object(
    'equipe_id',    p_equipe_id,
    'email',        lower(trim(p_email)),
    'nome',         coalesce(nullif(trim(p_nome), ''), split_part(p_email, '@', 1)),
    'papel_equipe', p_papel_equipe,
    'permissoes',   p_permissoes
  );

  insert into magic_links (token_hash, finalidade, payload, expires_at, created_by)
  values (v_hash, 'membro_convite', v_payload, now() + make_interval(mins => least(v_ttl_min, 30)), auth.uid());

  return jsonb_build_object(
    'convite_token', v_token,
    'equipe_id',     p_equipe_id,
    'email',         v_payload->>'email',
    'expires_in_min', least(v_ttl_min, 30)
  );
end;
$$;

revoke all on function public.partner_invite_membro(uuid, text, text, text, jsonb) from public;
grant execute on function public.partner_invite_membro(uuid, text, text, text, jsonb) to authenticated;

-- =============================================
-- RPC: membro_accept_convite(p_token) — autenticado
-- Vincula auth.uid() ao equipe_membros, promove role para team_member.
-- =============================================
create or replace function public.membro_accept_convite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash       text;
  v_link       magic_links;
  v_uid        uuid := auth.uid();
  v_user_email text;
  v_payload    jsonb;
  v_equipe_id  uuid;
  v_papel      text;
begin
  if v_uid is null then
    raise exception 'nao autenticado';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_link from magic_links
    where token_hash = v_hash
      and used_at is null
      and expires_at > now()
      and finalidade = 'membro_convite'
    limit 1;
  if v_link.id is null then
    raise exception 'convite invalido ou expirado' using errcode = 'P0001';
  end if;

  v_payload   := v_link.payload;
  v_equipe_id := (v_payload->>'equipe_id')::uuid;
  v_papel     := v_payload->>'papel_equipe';

  select email into v_user_email from usuarios where id = v_uid;
  if v_user_email is null then
    raise exception 'usuario nao encontrado';
  end if;
  if lower(v_user_email) <> lower(v_payload->>'email') then
    raise exception 'convite emitido para outro email' using errcode = 'P0001';
  end if;

  -- promove role para team_member (se ainda for client)
  update usuarios
     set role = 'team_member'::user_role
   where id = v_uid
     and role = 'client'::user_role;

  insert into equipe_membros (equipe_id, usuario_id, papel_equipe, permissoes, aceito_em)
  values (v_equipe_id, v_uid, v_papel, coalesce(v_payload->'permissoes', '{}'::jsonb), now())
  on conflict (equipe_id, usuario_id) do update
    set papel_equipe = excluded.papel_equipe,
        permissoes   = excluded.permissoes,
        aceito_em    = now();

  update magic_links set used_at = now() where id = v_link.id;

  return jsonb_build_object(
    'equipe_id', v_equipe_id,
    'papel_equipe', v_papel
  );
end;
$$;

revoke all on function public.membro_accept_convite(text) from public;
grant execute on function public.membro_accept_convite(text) to authenticated;

-- =============================================
-- RPC: partner_remove_membro(equipe_id, usuario_id)
-- =============================================
create or replace function public.partner_remove_membro(
  p_equipe_id uuid,
  p_usuario_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       text := public.app_user_role();
  v_partner_id uuid := public.app_partner_id();
begin
  if not (v_role = 'admin' or (v_role = 'partner' and exists (
    select 1 from equipes where id = p_equipe_id and partner_id = v_partner_id
  ))) then
    raise exception 'sem permissao';
  end if;

  delete from equipe_membros where equipe_id = p_equipe_id and usuario_id = p_usuario_id;
end;
$$;

revoke all on function public.partner_remove_membro(uuid, uuid) from public;
grant execute on function public.partner_remove_membro(uuid, uuid) to authenticated;

-- =============================================
-- View: v_equipe_membros_detalhe — lista membros visíveis ao caller
-- (filtra via helpers — view roda como owner para bypassar RLS de magic_links)
-- =============================================
create or replace view public.v_equipe_membros_detalhe as
  select
    em.id,
    em.equipe_id,
    e.partner_id,
    em.usuario_id,
    u.nome_completo,
    u.email,
    em.papel_equipe,
    em.permissoes,
    em.aceito_em,
    em.created_at,
    'ativo'::text as estado
  from equipe_membros em
  join equipes e on e.id = em.equipe_id
  join usuarios u on u.id = em.usuario_id
  where public.app_is_admin()
     or e.partner_id = public.app_partner_id()
     or em.usuario_id = auth.uid();

grant select on public.v_equipe_membros_detalhe to authenticated;

create or replace view public.v_equipe_convites_pendentes as
  select
    ml.id,
    (ml.payload->>'equipe_id')::uuid as equipe_id,
    e.partner_id,
    ml.payload->>'email' as email,
    ml.payload->>'nome' as nome,
    ml.payload->>'papel_equipe' as papel_equipe,
    ml.payload->'permissoes' as permissoes,
    ml.expires_at,
    ml.created_at
  from magic_links ml
  join equipes e on e.id = (ml.payload->>'equipe_id')::uuid
  where ml.finalidade = 'membro_convite'
    and ml.used_at is null
    and ml.expires_at > now()
    and (public.app_is_admin() or e.partner_id = public.app_partner_id());

grant select on public.v_equipe_convites_pendentes to authenticated;
