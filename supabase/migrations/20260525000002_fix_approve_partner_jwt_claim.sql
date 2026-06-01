-- =============================================
-- MIGRATION: FIX APPROVED CLAIM NO JWT
-- =============================================
-- admin_approve_partner gravava apenas role='partner' no raw_app_meta_data,
-- mas app_is_approved() lê o campo 'approved'. Adiciona approved=true no approve
-- e approved=false no reject.

create or replace function public.admin_approve_partner(p_partner_id uuid)
returns partners
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row    partners%rowtype;
  v_uid    uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;

  v_uid := v_row.usuario_id;

  -- 1) Sincroniza claims do JWT: role = 'partner' + approved = true.
  update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'partner', 'approved', true, 'partner_id', p_partner_id)
    where id = v_uid;

  -- 2) Garante que public.usuarios.role também esteja como 'partner'.
  update public.usuarios set role = 'partner', ativo = true where id = v_uid;

  -- 3) Atualiza o partner em si.
  update public.partners
    set status = 'approved',
        aprovado_por = auth.uid(),
        aprovado_em = now(),
        motivo_rejeicao = null
    where id = p_partner_id
    returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_reject_partner(p_partner_id uuid, p_motivo text)
returns partners
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row    partners%rowtype;
  v_uid    uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'motivo_obrigatorio';
  end if;

  select usuario_id into v_uid from public.partners where id = p_partner_id;

  -- Reverte approved para false no JWT.
  if v_uid is not null then
    update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object('approved', false)
      where id = v_uid;
  end if;

  update public.partners
    set status = 'rejected',
        motivo_rejeicao = p_motivo,
        aprovado_por = auth.uid(),
        aprovado_em = now()
    where id = p_partner_id
    returning * into v_row;

  if not found then raise exception 'partner_not_found'; end if;

  return v_row;
end;
$$;

grant execute on function public.admin_approve_partner(uuid) to authenticated;
grant execute on function public.admin_reject_partner(uuid, text) to authenticated;

-- =============================================
-- RETROATIVO: corrige parceiros já aprovados no banco
-- que nunca tiveram approved=true gravado no JWT.
-- =============================================
do $$
declare
  r record;
begin
  for r in
    select p.id as partner_id, p.usuario_id
    from public.partners p
    where p.status = 'approved'
      and p.usuario_id is not null
  loop
    update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object('role', 'partner', 'approved', true, 'partner_id', r.partner_id)
      where id = r.usuario_id;
  end loop;
end;
$$;
