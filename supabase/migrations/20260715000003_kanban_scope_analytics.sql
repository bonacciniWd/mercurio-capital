create or replace function public.partner_list_kanban_propostas(p_limit int default 500)
returns table (
  id uuid, protocolo text, produto public.produto_tipo, status public.proposta_status,
  valor_solicitado numeric, valor_imoveis_total numeric, created_at timestamptz,
  updated_at timestamptz, partner_id uuid, partner_nome text,
  cliente_id uuid, cliente_nome text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text := public.app_user_role();
begin
  if auth.uid() is null or v_role not in ('partner', 'team_member') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.app_is_approved() then
    raise exception 'partner_not_approved' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.protocolo, p.produto, p.status, p.valor_solicitado,
    p.valor_imoveis_total, p.created_at, p.updated_at, p.partner_id,
    pu.nome_completo, p.cliente_id, c.nome_completo
  from public.propostas p
  join public.partners pt on pt.id = p.partner_id and pt.status = 'approved'
  join public.usuarios pu on pu.id = pt.usuario_id
  left join public.clientes c on c.id = p.cliente_id
  where
    (v_role = 'partner' and p.partner_id = public.app_partner_id())
    or
    (v_role = 'team_member' and p.equipe_id = public.app_equipe_id())
  order by p.updated_at desc
  limit least(1000, greatest(1, coalesce(p_limit, 500)));
end;
$$;

create or replace function public.partner_set_proposta_status(
  p_id uuid,
  p_status public.proposta_status,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.app_user_role();
  v_old public.proposta_status;
begin
  if auth.uid() is null or v_role not in ('partner', 'team_member') or not public.app_is_approved() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select p.status into v_old
    from public.propostas p
    join public.partners pt on pt.id = p.partner_id and pt.status = 'approved'
   where p.id = p_id
     and ((v_role = 'partner' and p.partner_id = public.app_partner_id())
       or (v_role = 'team_member' and p.equipe_id = public.app_equipe_id()));

  if v_old is null then
    raise exception 'proposta_not_found_or_forbidden' using errcode = '42501';
  end if;
  if v_old = p_status then return; end if;

  update public.propostas set status = p_status, updated_at = now() where id = p_id;

  if p_motivo is not null and length(btrim(p_motivo)) > 0 then
    update public.proposta_status_historico set motivo = p_motivo
     where id = (select h.id from public.proposta_status_historico h
       where h.proposta_id = p_id and h.status_novo = p_status
       order by h.created_at desc limit 1);
  end if;
end;
$$;

drop materialized view if exists public.mv_admin_partners_metrics;
create materialized view public.mv_admin_partners_metrics as
select
  p.id as partner_id, p.status, u.nome_completo as nome,
  coalesce(w.saldo_centavos, 0) as saldo_centavos,
  (select count(*) from public.equipes e where e.partner_id = p.id) as equipes_count,
  (select count(*) from public.equipe_membros em join public.equipes e on e.id = em.equipe_id where e.partner_id = p.id) as membros_count,
  (select count(*) from public.propostas pr where pr.partner_id = p.id) as propostas_total,
  (select count(*) from public.propostas pr where pr.partner_id = p.id and pr.status not in ('cancelado', 'completo', 'contrato_registrado')) as propostas_ativas,
  (select coalesce(sum(pr.valor_solicitado), 0)::bigint from public.propostas pr where pr.partner_id = p.id) as volume_solicitado,
  (select coalesce(sum(pr.valor_solicitado), 0)::bigint from public.propostas pr
    where pr.partner_id = p.id and pr.status in (
      'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'protocolo_cartorio',
      'exigencias_cartorio', 'custas_cartorio', 'contrato_registrado', 'registro_af',
      'recurso_liberado', 'pagamento_comissao', 'completo'
    )) as volume_aprovado,
  now() as refreshed_at
from public.partners p
join public.usuarios u on u.id = p.usuario_id
left join public.partner_wallets w on w.partner_id = p.id;

create unique index mv_admin_partners_metrics_pk on public.mv_admin_partners_metrics (partner_id);
create index mv_admin_partners_metrics_status_idx on public.mv_admin_partners_metrics (status);
grant select on public.mv_admin_partners_metrics to authenticated;

drop materialized view if exists public.mv_admin_funil_global;
create materialized view public.mv_admin_funil_global as
select
  count(*) filter (where pi.status in ('sent', 'accepted', 'expired', 'revoked')) as convidados,
  count(*) filter (where pi.status = 'accepted') as aceitos,
  (select count(*) from public.partners where status = 'pending') as em_analise,
  (select count(*) from public.partners where status = 'approved') as aprovados,
  (select count(*) from public.partners p where p.status = 'approved'
    and exists(select 1 from public.propostas pr where pr.partner_id = p.id)) as com_proposta,
  (select count(distinct pr.partner_id) from public.propostas pr
    where pr.status in ('pagamento_comissao', 'completo')) as com_comissao_paga,
  now() as refreshed_at
from public.partner_invites pi;

grant select on public.mv_admin_funil_global to authenticated;