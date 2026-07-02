-- =============================================
-- SMOKE TEST FASE 15 — Fallback de claims auth (JWT stale)
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-15-auth-claims.sql
-- Tudo roda em transacao reversivel.

begin;

do $$
declare
  v_partner_user_id uuid;
  v_partner_id uuid;
  v_claim_partner_id uuid;
  v_approved boolean;
begin
  select p.usuario_id, p.id
    into v_partner_user_id, v_partner_id
    from public.partners p
   where p.status = 'approved'
   limit 1;

  if v_partner_user_id is null then
    raise notice 'sem partner aprovado para teste; smoke encerrado';
    return;
  end if;

  -- Simula JWT stale: role=partner, approved=false e sem partner_id no claim.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_partner_user_id::text,
      'app_metadata', json_build_object('role', 'partner', 'approved', false)
    )::text,
    true
  );

  select public.app_partner_id() into v_claim_partner_id;
  if v_claim_partner_id is distinct from v_partner_id then
    raise exception 'app_partner_id fallback falhou (esperado %, obtido %)', v_partner_id, v_claim_partner_id;
  end if;

  select public.app_is_approved() into v_approved;
  if coalesce(v_approved, false) is not true then
    raise exception 'app_is_approved fallback falhou para partner aprovado com claim stale';
  end if;

  raise notice '✓ fase 15 smoke ok — app_partner_id/app_is_approved resistentes a JWT stale';
end $$;

rollback;
