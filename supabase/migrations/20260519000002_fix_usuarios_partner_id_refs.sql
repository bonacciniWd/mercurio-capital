-- =============================================
-- MIGRATION 044 — FIX usuarios.partner_id / usuarios.deleted_at refs
-- =============================================
-- A tabela `usuarios` NUNCA teve as colunas `partner_id` nem `deleted_at`.
-- Cinco funções de notificação criadas nas fases 5 e 7 usavam essas colunas
-- inexistentes, causando 42703 ("column u.partner_id does not exist") em
-- vários gatilhos (ex.: ao suspender parceiro via admin_suspend_partner,
-- que faz UPDATE em partner_wallets e dispara fn_notifica_wallet_bloqueio).
--
-- O relacionamento correto parceiro ↔ usuário é:
--   - dono:    partners.usuario_id  →  usuarios.id
--   - equipe:  equipe_membros.usuario_id  →  usuarios.id  (via equipes.partner_id)
--
-- Aqui recriamos um helper `app_partner_user_ids(uuid)` (security definer,
-- ignora RLS) e reescrevemos as 5 funções para usá-lo.

-- =============================================
-- Helper: ids de usuários vinculados ao parceiro (dono + membros de equipe)
-- =============================================
create or replace function public.app_partner_user_ids(p_partner_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.usuario_id
    from public.partners p
   where p.id = p_partner_id
     and p.usuario_id is not null
  union
  select em.usuario_id
    from public.equipe_membros em
    join public.equipes e on e.id = em.equipe_id
   where e.partner_id = p_partner_id
     and em.usuario_id is not null
     and em.aceito_em is not null;
$$;

grant execute on function public.app_partner_user_ids(uuid) to authenticated;


-- =============================================
-- FIX 1) fn_notifica_wallet_movimento (fase 5)
-- =============================================
create or replace function public.fn_notifica_wallet_movimento()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user      uuid;
  v_saldo     bigint := new.saldo_depois;
  v_partner   uuid := new.partner_id;
  v_threshold bigint := 5000_00;
begin
  if new.tipo = 'recarga' then
    for v_user in
      select u.id from public.app_partner_user_ids(v_partner) as t(uid) join public.usuarios u on u.id = t.uid
      where u.role in ('partner','team_member') and u.ativo
    loop
      insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
      values (v_user, 'in_app',
        'Recarga confirmada',
        format('R$ %s,%s creditados na sua carteira.',
               (new.valor_centavos/100)::text,
               lpad((new.valor_centavos%100)::text, 2, '0')),
        '/p/carteira',
        jsonb_build_object('ledger_id', new.id, 'tipo', 'recarga'));
    end loop;
  end if;

  if new.tipo in ('debito_consulta','ajuste_debito','tarifa')
     and v_saldo < v_threshold
     and new.saldo_antes >= v_threshold then
    for v_user in
      select u.id from public.app_partner_user_ids(v_partner) as t(uid) join public.usuarios u on u.id = t.uid
      where u.role = 'partner' and u.ativo
    loop
      insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
      values (v_user, 'in_app',
        'Saldo baixo',
        format('Sua carteira está com R$ %s,%s. Recarregue para evitar interrupções.',
               (v_saldo/100)::text,
               lpad((v_saldo%100)::text, 2, '0')),
        '/p/carteira',
        jsonb_build_object('saldo_centavos', v_saldo));
    end loop;
  end if;

  return new;
end;
$$;


-- =============================================
-- FIX 2) fn_notifica_wallet_bloqueio (fase 5)
-- =============================================
create or replace function public.fn_notifica_wallet_bloqueio()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user uuid;
begin
  if old.bloqueada is distinct from new.bloqueada then
    for v_user in
      select uid from public.app_partner_user_ids(new.partner_id) as uid
      join public.usuarios u on u.id = uid
      where u.role = 'partner' and u.ativo
    loop
      insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
      values (v_user, 'in_app',
        case when new.bloqueada then 'Carteira bloqueada' else 'Carteira reativada' end,
        coalesce(new.motivo_bloqueio,
          case when new.bloqueada then 'Sua carteira foi bloqueada pelo administrador.'
               else 'Sua carteira foi reativada.' end),
        '/p/carteira',
        jsonb_build_object('bloqueada', new.bloqueada));
    end loop;
  end if;
  return new;
end;
$$;


-- =============================================
-- FIX 3) fn_notifica_contrato_assinado (fase 7)
-- =============================================
create or replace function public.fn_notifica_contrato_assinado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid;
  v_partner_id  uuid;
  v_proposta_id uuid := new.proposta_id;
  v_protocolo   text;
begin
  if old.assinado_em is not null or new.assinado_em is null then
    return new;
  end if;

  select partner_id, protocolo into v_partner_id, v_protocolo
    from propostas where id = v_proposta_id;
  if v_partner_id is null then return new; end if;

  for v_user in
    select u.id from public.app_partner_user_ids(v_partner_id) as t(uid) join public.usuarios u on u.id = t.uid
    where u.role in ('partner','team_member') and u.ativo
  loop
    insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
    values (v_user, 'in_app', 'Contrato assinado',
      format('O contrato da proposta %s foi assinado por todos os signatários.', coalesce(v_protocolo,'')),
      format('/p/propostas/%s', v_proposta_id),
      jsonb_build_object('contrato_id', new.id));
  end loop;
  return new;
end;
$$;


-- =============================================
-- FIX 4) fn_notifica_recurso_liberado (fase 7)
-- =============================================
create or replace function public.fn_notifica_recurso_liberado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid;
  v_partner_id uuid;
  v_protocolo  text;
begin
  select partner_id, protocolo into v_partner_id, v_protocolo
    from propostas where id = new.proposta_id;
  if v_partner_id is null then return new; end if;

  for v_user in
    select u.id from public.app_partner_user_ids(v_partner_id) as t(uid) join public.usuarios u on u.id = t.uid
    where u.role in ('partner','team_member') and u.ativo
  loop
    insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
    values (v_user, 'in_app', 'Recurso liberado',
      format('A liberação da proposta %s foi registrada — valor R$ %s.',
        coalesce(v_protocolo,''),
        to_char(new.valor_liberado, 'FM999G999G990D00')),
      format('/p/propostas/%s', new.proposta_id),
      jsonb_build_object('liberacao_id', new.id));
  end loop;
  return new;
end;
$$;

