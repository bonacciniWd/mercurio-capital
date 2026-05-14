-- =============================================
-- MIGRATION 011 — ADMIN PARTNER APPROVAL
-- =============================================
-- RPCs invocadas pela tela /admin/parceiros/aprovacoes.
-- Atualizam o status em public.partners E sincronizam auth.users.raw_app_meta_data.role
-- (este é o claim que o app_user_role() lê para autorizar RLS).

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

  -- 1) Sincroniza claim do JWT: role = 'partner'.
  update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'partner')
    where id = v_uid;

  -- 2) Garante que public.usuarios.role também esteja como 'partner' (caso ainda esteja como client).
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

grant execute on function public.admin_approve_partner(uuid) to authenticated;


create or replace function public.admin_reject_partner(p_partner_id uuid, p_motivo text)
returns partners
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row partners%rowtype;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'motivo_obrigatorio';
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

grant execute on function public.admin_reject_partner(uuid, text) to authenticated;


-- View utilitária consumida pelo admin para listar pendências com nome/email/contagem de docs.
create or replace view public.v_admin_partner_aprovacoes
with (security_invoker = true)
as
  select
    p.id                              as partner_id,
    p.status,
    p.cpf,
    p.created_at,
    p.aprovado_em,
    p.aprovado_por,
    p.motivo_rejeicao,
    u.id                              as usuario_id,
    u.nome_completo                   as nome,
    u.email,
    u.telefone,
    u.telefone_ddi,
    (select count(*) from public.partner_documentos d where d.partner_id = p.id) as docs_count
  from public.partners p
  join public.usuarios u on u.id = p.usuario_id;

grant select on public.v_admin_partner_aprovacoes to authenticated;
