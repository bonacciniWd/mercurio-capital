-- =============================================
-- MIGRATION 015 — PENDÊNCIAS: RPCs de resolução e resposta
-- =============================================

-- Helper: confere se a proposta pertence ao partner/equipe do usuário
create or replace function public.app_can_manage_proposta(p_proposta uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from propostas p
     where p.id = p_proposta
       and (
         public.app_is_admin()
         or (
           public.app_user_role() in ('partner','team_member')
           and (p.partner_id = public.app_partner_id() or p.equipe_id = public.app_equipe_id())
         )
       )
  );
$$;

revoke all on function public.app_can_manage_proposta(uuid) from public;
grant execute on function public.app_can_manage_proposta(uuid) to authenticated;

-- =============================================
-- Resolver / rejeitar pendência (admin ou parceiro/team_member dono)
-- =============================================

create or replace function public.pendencia_resolver(
  p_id uuid,
  p_status pendencia_status
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_proposta uuid;
begin
  if p_status not in ('resolvida','rejeitada') then
    raise exception 'status inválido (apenas resolvida ou rejeitada)' using errcode = '22023';
  end if;

  select proposta_id into v_proposta
    from proposta_pendencias
   where id = p_id;

  if v_proposta is null then
    raise exception 'pendência não encontrada' using errcode = 'P0002';
  end if;

  if not public.app_can_manage_proposta(v_proposta) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update proposta_pendencias
     set status = p_status,
         resolvida_em = case when p_status = 'resolvida' then now() else null end,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.pendencia_resolver(uuid, pendencia_status) from public;
grant execute on function public.pendencia_resolver(uuid, pendencia_status) to authenticated;

-- =============================================
-- Cliente responde pendência (marca como em_analise)
-- =============================================

create or replace function public.cliente_responder_pendencia(
  p_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_proposta uuid;
  v_status   pendencia_status;
begin
  select proposta_id, status into v_proposta, v_status
    from proposta_pendencias
   where id = p_id;

  if v_proposta is null then
    raise exception 'pendência não encontrada' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from propostas p
      join clientes c on c.id = p.cliente_id
     where p.id = v_proposta
       and c.usuario_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_status not in ('aberta','em_analise') then
    raise exception 'pendência já encerrada' using errcode = '22023';
  end if;

  update proposta_pendencias
     set status = 'em_analise',
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.cliente_responder_pendencia(uuid) from public;
grant execute on function public.cliente_responder_pendencia(uuid) to authenticated;

-- =============================================
-- UPDATE policy faltante para parceiro/team_member
-- (admin já tem "for all"; este complementa para que o front
--  possa, em casos futuros, atualizar campos como prazo/descrição)
-- =============================================

drop policy if exists "partner_team_atualiza_pendencia" on proposta_pendencias;

create policy "partner_team_atualiza_pendencia" on proposta_pendencias
  for update using (
    proposta_id in (
      select id from propostas
       where partner_id = public.app_partner_id()
          or equipe_id  = public.app_equipe_id()
    )
    and public.app_user_role() in ('partner','team_member')
  )
  with check (
    proposta_id in (
      select id from propostas
       where partner_id = public.app_partner_id()
          or equipe_id  = public.app_equipe_id()
    )
  );
