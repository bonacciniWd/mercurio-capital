-- =============================================
-- MIGRATION — ADMIN NÍVEL (full | limitado)
-- =============================================
-- Introduz o conceito de "admin limitado": continua sendo role='admin'
-- (app_is_admin() = true), porém com acesso restrito a um subconjunto de
-- telas/RPCs. O nível é persistido em auth.users.raw_app_meta_data.admin_nivel
-- (mesmo local dos demais claims lidos pelas funções helper de RLS).
--
-- Aditiva: não altera comportamento de admins existentes (default = 'full').

-- ---------------------------------------------------------------
-- Helper: nível do admin corrente (default 'full' quando ausente)
-- ---------------------------------------------------------------
create or replace function public.app_admin_nivel()
  returns text
  language sql stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'admin_nivel', ''),
    'full'
  )
$$;

-- ---------------------------------------------------------------
-- Helper: admin com privilégios completos
-- ---------------------------------------------------------------
create or replace function public.app_is_admin_full()
  returns boolean
  language sql stable
as $$
  select public.app_is_admin() and public.app_admin_nivel() = 'full'
$$;

-- ---------------------------------------------------------------
-- RPC: admin_set_admin_nivel — define o nível de um admin alvo.
-- Guard: apenas admin FULL. Grava claim em auth.users e audita.
-- ---------------------------------------------------------------
create or replace function public.admin_set_admin_nivel(
  p_user_id uuid,
  p_nivel   text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role   text;
  v_before text;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id_obrigatorio';
  end if;

  if coalesce(p_nivel, '') not in ('full', 'limitado') then
    raise exception 'nivel_invalido' using hint = 'use full ou limitado';
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', '')
    into v_role
    from auth.users u
   where u.id = p_user_id;

  if not found then
    raise exception 'usuario_nao_encontrado' using errcode = 'P0002';
  end if;

  if v_role <> 'admin' then
    raise exception 'alvo_nao_e_admin';
  end if;

  v_before := coalesce(
    (select u.raw_app_meta_data ->> 'admin_nivel' from auth.users u where u.id = p_user_id),
    'full'
  );

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('admin_nivel', p_nivel)
   where id = p_user_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'admin_nivel_alterado',
    'auth.users',
    p_user_id,
    jsonb_build_object('admin_nivel', v_before),
    jsonb_build_object('admin_nivel', p_nivel)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'admin_nivel', p_nivel
  );
end;
$$;

revoke all on function public.admin_set_admin_nivel(uuid, text) from public;
grant execute on function public.admin_set_admin_nivel(uuid, text) to authenticated;
