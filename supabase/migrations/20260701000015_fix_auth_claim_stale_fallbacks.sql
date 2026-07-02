-- =============================================
-- FIX: auth helpers com fallback em banco (claim stale)
-- Motivo: parceiros aprovados pelo admin podiam manter JWT antigo
-- (approved=false) e receber 403 indevido em RPCs operacionais.
-- =============================================

create or replace function public.app_partner_id()
  returns uuid
  language plpgsql
  stable
  security definer
  set search_path = public, auth
as $$
declare
  v_claim_partner_id uuid;
  v_partner_id uuid;
begin
  begin
    v_claim_partner_id := nullif(auth.jwt() -> 'app_metadata' ->> 'partner_id', '')::uuid;
  exception when others then
    v_claim_partner_id := null;
  end;

  if v_claim_partner_id is not null then
    return v_claim_partner_id;
  end if;

  select p.id
    into v_partner_id
    from public.partners p
   where p.usuario_id = auth.uid()
   limit 1;

  if v_partner_id is not null then
    return v_partner_id;
  end if;

  select e.partner_id
    into v_partner_id
    from public.equipe_membros em
    join public.equipes e on e.id = em.equipe_id
   where em.usuario_id = auth.uid()
     and em.aceito_em is not null
   order by em.aceito_em desc nulls last, em.created_at desc
   limit 1;

  return v_partner_id;
end;
$$;

create or replace function public.app_equipe_id()
  returns uuid
  language plpgsql
  stable
  security definer
  set search_path = public, auth
as $$
declare
  v_claim_equipe_id uuid;
  v_equipe_id uuid;
begin
  begin
    v_claim_equipe_id := nullif(auth.jwt() -> 'app_metadata' ->> 'equipe_id', '')::uuid;
  exception when others then
    v_claim_equipe_id := null;
  end;

  if v_claim_equipe_id is not null then
    return v_claim_equipe_id;
  end if;

  select em.equipe_id
    into v_equipe_id
    from public.equipe_membros em
   where em.usuario_id = auth.uid()
     and em.aceito_em is not null
   order by em.aceito_em desc nulls last, em.created_at desc
   limit 1;

  return v_equipe_id;
end;
$$;

create or replace function public.app_is_approved()
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public, auth
as $$
declare
  v_role text := public.app_user_role();
  v_partner_status public.partner_status;
  v_team_member_ok boolean;
  v_claim_approved boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  if v_role = 'admin' then
    return true;
  end if;

  if v_role = 'partner' then
    select p.status
      into v_partner_status
      from public.partners p
     where p.usuario_id = auth.uid()
     limit 1;

    return coalesce(v_partner_status = 'approved', false);
  end if;

  if v_role = 'team_member' then
    select (
      em.aceito_em is not null
      and coalesce(em.permissoes ->> 'suspenso', 'false') <> 'true'
    )
      into v_team_member_ok
      from public.equipe_membros em
     where em.usuario_id = auth.uid()
     order by em.aceito_em desc nulls last, em.created_at desc
     limit 1;

    return coalesce(v_team_member_ok, false);
  end if;

  begin
    v_claim_approved := (auth.jwt() -> 'app_metadata' ->> 'approved')::boolean;
  exception when others then
    v_claim_approved := false;
  end;

  return coalesce(v_claim_approved, v_role = 'client');
end;
$$;
