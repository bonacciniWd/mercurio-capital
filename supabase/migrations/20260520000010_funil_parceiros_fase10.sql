-- =============================================
-- MIGRATION 020 — FASE 10
-- Equipes Admin · Funil de Parceiros · Webhook de Bounce
-- =============================================

-- =============================================
-- 1) Funil de parceiros — function security definer
-- =============================================
-- Retorna 6 contadores agregados. security definer pois lê auth/usuarios sem
-- depender de RLS por linha (a checagem é app_is_admin no início).

create or replace function public.admin_funil_parceiros()
returns table (
  convidados         integer,
  ativaram           integer,
  enviaram_docs      integer,
  aprovados          integer,
  com_proposta       integer,
  com_comissao_paga  integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    -- não admin: retorna zeros (não vaza dado de funil)
    return query select 0,0,0,0,0,0;
    return;
  end if;

  return query
  select
    (select count(*)::int from public.partner_invites)                                              as convidados,
    (select count(*)::int from public.partners p
        join public.usuarios u on u.id = p.usuario_id
        where u.ultimo_login_at is not null)                                                       as ativaram,
    (select count(distinct p.id)::int from public.partners p
        where exists (select 1 from public.partner_documentos pd where pd.partner_id = p.id))      as enviaram_docs,
    (select count(*)::int from public.partners where status = 'approved')                          as aprovados,
    (select count(distinct p.id)::int from public.partners p
        where exists (select 1 from public.propostas pr where pr.partner_id = p.id))               as com_proposta,
    (select count(distinct p.id)::int from public.partners p
        where exists (select 1 from public.comissoes c where c.partner_id = p.id and c.status = 'paga')) as com_comissao_paga;
end;
$$;

revoke all on function public.admin_funil_parceiros() from public;
grant execute on function public.admin_funil_parceiros() to authenticated;

-- View sugar para consumir mais facilmente do cliente
create or replace view public.v_admin_funil_parceiros
with (security_invoker = on) as
  select * from public.admin_funil_parceiros();

grant select on public.v_admin_funil_parceiros to authenticated;


-- =============================================
-- 2) Tabela email_bounces_inbox (idempotência + auditoria)
-- =============================================

create table if not exists public.email_bounces_inbox (
  event_id     text primary key,
  provider     text not null,
  email        text not null,
  reason       text,
  payload      jsonb not null default '{}'::jsonb,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  invite_id    uuid references public.partner_invites(id) on delete set null
);

create index if not exists email_bounces_inbox_email_idx
  on public.email_bounces_inbox (lower(email), received_at desc);

alter table public.email_bounces_inbox enable row level security;

drop policy if exists "admin_read_bounces" on public.email_bounces_inbox;
create policy "admin_read_bounces" on public.email_bounces_inbox
  for select using (public.app_is_admin());

-- writes apenas via RPC security definer (sem policy de insert/update)


-- =============================================
-- 3) RPC process_email_bounce — chamada pela Edge (service role)
-- =============================================

create or replace function public.process_email_bounce(
  p_event_id text,
  p_provider text,
  p_email    text,
  p_reason   text default null,
  p_payload  jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id     uuid;
  v_already       boolean := false;
  v_emails_clean  text := lower(trim(p_email));
begin
  if p_event_id is null or length(p_event_id) = 0 then
    raise exception 'event_id_obrigatorio';
  end if;
  if v_emails_clean is null or length(v_emails_clean) = 0 then
    raise exception 'email_obrigatorio';
  end if;

  -- idempotência total: se o event_id já existe, retorna noop
  perform 1 from public.email_bounces_inbox where event_id = p_event_id;
  if found then
    v_already := true;
  else
    insert into public.email_bounces_inbox (event_id, provider, email, reason, payload)
    values (p_event_id, coalesce(p_provider, 'unknown'), v_emails_clean, p_reason, coalesce(p_payload, '{}'::jsonb));
  end if;

  -- marca o convite pendente mais recente do mesmo email como expirado
  update public.partner_invites
     set status = 'expired'
   where id = (
     select id from public.partner_invites
      where lower(email) = v_emails_clean
        and status = 'sent'
      order by created_at desc
      limit 1
   )
  returning id into v_invite_id;

  if v_invite_id is not null then
    update public.email_bounces_inbox
       set processed_at = now(),
           invite_id    = v_invite_id
     where event_id = p_event_id;
  else
    update public.email_bounces_inbox
       set processed_at = now()
     where event_id = p_event_id
       and processed_at is null;
  end if;

  -- auditoria
  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    null, 'email_bounce_received', 'partner_invites', v_invite_id,
    jsonb_build_object(
      'event_id',  p_event_id,
      'provider',  p_provider,
      'email',     v_emails_clean,
      'reason',    p_reason,
      'duplicate', v_already
    )
  );

  return jsonb_build_object(
    'event_id',   p_event_id,
    'duplicate',  v_already,
    'invite_id',  v_invite_id,
    'expired',    v_invite_id is not null
  );
end;
$$;

revoke all on function public.process_email_bounce(text, text, text, text, jsonb) from public;
revoke all on function public.process_email_bounce(text, text, text, text, jsonb) from authenticated;
grant execute on function public.process_email_bounce(text, text, text, text, jsonb) to service_role;


-- =============================================
-- 4) RPC admin_revoke_equipe_membro_convite
-- =============================================

create or replace function public.admin_revoke_equipe_membro_convite(
  p_magic_link_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link magic_links%rowtype;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.magic_links
     set used_at = now()
   where id = p_magic_link_id
     and finalidade = 'membro_convite'
     and used_at is null
   returning * into v_link;

  if not found then
    raise exception 'convite_nao_encontrado_ou_ja_processado';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'revoke_equipe_convite', 'magic_links', p_magic_link_id,
          jsonb_build_object('payload', v_link.payload));
end;
$$;

revoke all on function public.admin_revoke_equipe_membro_convite(uuid) from public;
grant execute on function public.admin_revoke_equipe_membro_convite(uuid) to authenticated;


-- =============================================
-- 5) RPC admin_set_equipe_membro_suspenso
-- =============================================

create or replace function public.admin_set_equipe_membro_suspenso(
  p_equipe_id  uuid,
  p_usuario_id uuid,
  p_suspenso   boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select permissoes into v_old
    from public.equipe_membros
   where equipe_id = p_equipe_id and usuario_id = p_usuario_id;

  if v_old is null then
    raise exception 'membro_nao_encontrado';
  end if;

  update public.equipe_membros
     set permissoes = jsonb_set(coalesce(permissoes, '{}'::jsonb), '{suspenso}', to_jsonb(coalesce(p_suspenso, false)), true)
   where equipe_id = p_equipe_id and usuario_id = p_usuario_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    case when p_suspenso then 'suspend_equipe_membro' else 'reactivate_equipe_membro' end,
    'equipe_membros', null,
    jsonb_build_object('equipe_id', p_equipe_id, 'usuario_id', p_usuario_id, 'permissoes', v_old),
    jsonb_build_object('equipe_id', p_equipe_id, 'usuario_id', p_usuario_id, 'suspenso', coalesce(p_suspenso, false))
  );
end;
$$;

revoke all on function public.admin_set_equipe_membro_suspenso(uuid, uuid, boolean) from public;
grant execute on function public.admin_set_equipe_membro_suspenso(uuid, uuid, boolean) to authenticated;


-- =============================================
-- 6) Helper de leitura: equipes + contagens para a tela admin
-- =============================================

create or replace view public.v_admin_partner_equipes
with (security_invoker = on) as
  select
    e.id              as equipe_id,
    e.partner_id,
    e.nome,
    e.isolamento_estrito,
    e.created_at,
    (select count(*) from public.equipe_membros em where em.equipe_id = e.id)                                            as membros_total,
    (select count(*) from public.equipe_membros em where em.equipe_id = e.id and (em.permissoes->>'suspenso')::boolean is true) as membros_suspensos,
    (select count(*) from public.magic_links ml
       where ml.finalidade = 'membro_convite'
         and ml.used_at is null
         and ml.expires_at > now()
         and (ml.payload->>'equipe_id')::uuid = e.id)                                                                    as convites_abertos
  from public.equipes e;

grant select on public.v_admin_partner_equipes to authenticated;
