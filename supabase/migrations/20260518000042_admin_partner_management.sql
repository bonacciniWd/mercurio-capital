-- =============================================
-- MIGRATION 042 — ADMIN PARTNER MANAGEMENT
-- =============================================
-- Habilita a tela /admin/parceiros com dados reais:
--   1) View v_admin_partners (lista completa com agregados)
--   2) RPC admin_suspend_partner / admin_reactivate_partner
--   3) Tabela partner_invites + RPC admin_invite_partner_record
--      (a Edge Function `admin-invite-partner` orquestra auth.admin)
-- Não altera nenhum objeto existente; apenas adiciona novos.

-- =============================================
-- 1) VIEW v_admin_partners
-- =============================================

create or replace view public.v_admin_partners
with (security_invoker = true)
as
  select
    p.id                                  as partner_id,
    p.usuario_id,
    p.status,
    p.cpf,
    p.comissao_percentual,
    p.endereco_cidade,
    p.endereco_estado,
    p.created_at,
    p.aprovado_em,
    p.aprovado_por,
    p.motivo_rejeicao,
    u.nome_completo                       as nome,
    u.email,
    u.telefone,
    u.telefone_ddi,
    u.ultimo_login_at,
    u.ativo                               as usuario_ativo,
    coalesce(w.saldo_centavos, 0)         as saldo_centavos,
    coalesce(w.bloqueada, false)          as wallet_bloqueada,
    (select count(*) from public.partner_documentos d
       where d.partner_id = p.id)         as docs_count,
    (select count(*) from public.equipes e
       where e.partner_id = p.id)         as equipes_count,
    (select count(*) from public.equipe_membros em
       join public.equipes e on e.id = em.equipe_id
       where e.partner_id = p.id)         as membros_count,
    (select count(*) from public.propostas pr
       where pr.partner_id = p.id)        as propostas_total,
    (select count(*) from public.propostas pr
       where pr.partner_id = p.id
         and pr.status not in ('cancelado'))                       as propostas_ativas,
    (select coalesce(sum(pr.valor_solicitado), 0) from public.propostas pr
       where pr.partner_id = p.id)        as volume_solicitado,
    (select coalesce(sum(pr.valor_solicitado), 0) from public.propostas pr
       where pr.partner_id = p.id
         and pr.status in (
           'emissao_contrato','aguardando_assinatura','em_registro',
           'contrato_registrado','recurso_liberado'
         )) as volume_aprovado
  from public.partners p
  join public.usuarios u on u.id = p.usuario_id
  left join public.partner_wallets w on w.partner_id = p.id;

grant select on public.v_admin_partners to authenticated;


-- =============================================
-- 2) RPC admin_suspend_partner
-- =============================================
create or replace function public.admin_suspend_partner(
  p_partner_id uuid,
  p_motivo     text
)
returns partners
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row partners%rowtype;
  v_uid uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'motivo_obrigatorio';
  end if;

  select * into v_row from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;

  v_uid := v_row.usuario_id;

  -- Bloqueia carteira para impedir débitos enquanto suspenso.
  update public.partner_wallets
    set bloqueada = true,
        motivo_bloqueio = coalesce(motivo_bloqueio, p_motivo)
    where partner_id = p_partner_id;

  -- Marca o usuário como inativo (o JWT continua válido até refresh; RLS
  -- bloqueia operacionais via app_is_approved()).
  update public.usuarios set ativo = false where id = v_uid;

  update public.partners
    set status = 'suspended',
        motivo_rejeicao = p_motivo,
        aprovado_por = auth.uid(),
        aprovado_em = now()
    where id = p_partner_id
    returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_suspend_partner(uuid, text) to authenticated;


-- =============================================
-- 3) RPC admin_reactivate_partner
-- =============================================
create or replace function public.admin_reactivate_partner(
  p_partner_id uuid
)
returns partners
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row partners%rowtype;
  v_uid uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found'; end if;

  v_uid := v_row.usuario_id;

  -- Re-sincroniza claim do JWT.
  update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'partner')
    where id = v_uid;

  update public.usuarios set role = 'partner', ativo = true where id = v_uid;

  update public.partner_wallets
    set bloqueada = false,
        motivo_bloqueio = null
    where partner_id = p_partner_id;

  update public.partners
    set status = 'approved',
        motivo_rejeicao = null,
        aprovado_por = auth.uid(),
        aprovado_em = now()
    where id = p_partner_id
    returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_reactivate_partner(uuid) to authenticated;


-- =============================================
-- 4) TABELA partner_invites
-- =============================================
create table if not exists public.partner_invites (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  nome_completo     text not null,
  telefone_ddi      text not null default '55',
  telefone          text,
  observacoes       text,
  status            text not null default 'sent'
                    check (status in ('sent','accepted','revoked','expired')),
  partner_id        uuid references public.partners(id) on delete set null,
  usuario_id        uuid references public.usuarios(id) on delete set null,
  created_by        uuid references public.usuarios(id) on delete set null,
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  metadata          jsonb not null default '{}'
);

create index if not exists partner_invites_email_idx
  on public.partner_invites (lower(email), created_at desc);

create index if not exists partner_invites_status_idx
  on public.partner_invites (status, created_at desc);

alter table public.partner_invites enable row level security;

drop policy if exists "admin_full_partner_invites" on public.partner_invites;
create policy "admin_full_partner_invites" on public.partner_invites
  for all using (public.app_is_admin()) with check (public.app_is_admin());


-- =============================================
-- 5) RPC admin_invite_partner_record
-- =============================================
-- Apenas registra o convite + cria o partners(status='pending') vinculado.
-- A Edge Function `admin-invite-partner` é quem aciona o `auth.admin.inviteUserByEmail`
-- e depois chama esta RPC com o usuario_id já criado.
create or replace function public.admin_invite_partner_record(
  p_email          text,
  p_nome_completo  text,
  p_usuario_id     uuid,
  p_telefone       text default null,
  p_telefone_ddi   text default '55',
  p_observacoes    text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner partners%rowtype;
  v_invite  partner_invites%rowtype;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_usuario_id is null then
    raise exception 'usuario_id_obrigatorio';
  end if;

  -- Garante role=partner na espelho local (o claim do JWT é sincronizado pela Edge).
  update public.usuarios set role = 'partner' where id = p_usuario_id;

  insert into public.partners (usuario_id, status)
  values (p_usuario_id, 'pending')
  on conflict (usuario_id) do update
    set status = case when partners.status = 'rejected' then 'pending' else partners.status end
  returning * into v_partner;

  insert into public.partner_invites (
    email, nome_completo, telefone, telefone_ddi, observacoes,
    partner_id, usuario_id, created_by, status
  )
  values (
    p_email, p_nome_completo, p_telefone, coalesce(p_telefone_ddi, '55'),
    p_observacoes, v_partner.id, p_usuario_id, auth.uid(), 'sent'
  )
  returning * into v_invite;

  return json_build_object(
    'partner_id', v_partner.id,
    'usuario_id', p_usuario_id,
    'invite_id',  v_invite.id
  );
end;
$$;

grant execute on function public.admin_invite_partner_record(text, text, uuid, text, text, text) to authenticated;


-- =============================================
-- 6) RPC admin_revoke_partner_invite
-- =============================================
create or replace function public.admin_revoke_partner_invite(
  p_invite_id uuid
)
returns partner_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row partner_invites%rowtype;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.partner_invites
    set status = 'revoked',
        revoked_at = now()
    where id = p_invite_id
      and status = 'sent'
    returning * into v_row;

  if not found then raise exception 'invite_nao_encontrado_ou_ja_processado'; end if;

  return v_row;
end;
$$;

grant execute on function public.admin_revoke_partner_invite(uuid) to authenticated;


-- =============================================
-- 7) VIEW v_admin_partner_invites
-- =============================================
create or replace view public.v_admin_partner_invites
with (security_invoker = true)
as
  select
    i.id,
    i.email,
    i.nome_completo,
    i.telefone,
    i.telefone_ddi,
    i.observacoes,
    i.status,
    i.partner_id,
    i.usuario_id,
    i.created_at,
    i.accepted_at,
    i.revoked_at,
    u.nome_completo as criado_por_nome,
    p.status        as partner_status
  from public.partner_invites i
  left join public.usuarios u on u.id = i.created_by
  left join public.partners p on p.id = i.partner_id;

grant select on public.v_admin_partner_invites to authenticated;

