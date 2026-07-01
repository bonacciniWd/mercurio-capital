-- =============================================
-- FIX: app_user_role/app_is_admin com fallback em usuarios
-- Motivo: alguns fluxos de login podem ter JWT sem app_metadata.role
-- e isso gera falso 403 em RPCs admin_* que dependem de app_is_admin().
-- =============================================

create or replace function public.app_user_role()
  returns text
  language plpgsql
  stable
  security definer
  set search_path = public, auth
as $$
declare
  v_claim_role text;
  v_db_role text;
begin
  -- Prioriza claim no JWT (caminho atual esperado)
  v_claim_role := nullif(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if v_claim_role is not null then
    return v_claim_role;
  end if;

  -- Fallback resiliente: papel persistido na tabela espelho de usuarios
  select u.role::text
    into v_db_role
    from public.usuarios u
   where u.id = auth.uid();

  return coalesce(v_db_role, 'public');
end;
$$;

create or replace function public.app_is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, auth
as $$
  select public.app_user_role() = 'admin'
$$;
