-- =============================================
-- MIGRATION 014 — ADMIN OPS RPCs
-- Set proposta status with motivo and history
-- =============================================

create or replace function public.admin_set_proposta_status(
  p_id uuid,
  p_status proposta_status,
  p_motivo text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_old proposta_status;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status into v_old from propostas where id = p_id;
  if v_old is null then
    raise exception 'proposta not found' using errcode = 'P0002';
  end if;

  if v_old = p_status then
    return;
  end if;

  update propostas set status = p_status, updated_at = now() where id = p_id;

  -- trigger trg_proposta_status_historico já inseriu a linha; gravar motivo
  if p_motivo is not null and length(btrim(p_motivo)) > 0 then
    update proposta_status_historico
       set motivo = p_motivo
     where id = (
       select id from proposta_status_historico
        where proposta_id = p_id
          and status_novo = p_status
        order by created_at desc
        limit 1
     );
  end if;
end;
$$;

revoke all on function public.admin_set_proposta_status(uuid, proposta_status, text) from public;
grant execute on function public.admin_set_proposta_status(uuid, proposta_status, text) to authenticated;

-- =============================================
-- Validate / unvalidate documento de proposta
-- =============================================

create or replace function public.admin_set_documento_validado(
  p_id uuid,
  p_validado boolean
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update proposta_documentos
     set validado = p_validado,
         validado_por = case when p_validado then auth.uid() else null end,
         validado_em = case when p_validado then now() else null end
   where id = p_id;
end;
$$;

revoke all on function public.admin_set_documento_validado(uuid, boolean) from public;
grant execute on function public.admin_set_documento_validado(uuid, boolean) to authenticated;
