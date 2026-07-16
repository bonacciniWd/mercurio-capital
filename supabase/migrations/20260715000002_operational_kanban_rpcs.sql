-- Fluxo alvo do Kanban sem migração destrutiva dos valores legados.
-- Mapeamento visual: resolucao_pendencias -> diligencia_juridica,
-- em_registro -> protocolo_cartorio, contrato_registrado -> registro_af.

create or replace function public.validate_proposta_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_role text := public.app_user_role();
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Webhooks e Edge Functions confiáveis preservam o fluxo server-side atual.
  if auth.uid() is null then
    return new;
  end if;

  if public.app_requires_2fa() and not public.app_has_verified_2fa() then
    raise exception '2fa_required';
  end if;

  if v_role = 'admin' then
    return new;
  end if;

  if v_role = 'partner' then
    if (old.status = 'proposta_cliente' and new.status in ('resolucao_pendencias', 'diligencia_juridica'))
       or (old.status = 'emissao_contrato' and new.status = 'aguardando_assinatura')
       or (new.status = 'cancelado' and coalesce(nullif(new.motivo_cancelamento, ''), '') <> '') then
      return new;
    end if;
    raise exception 'status_transition_not_allowed_for_partner: % -> %', old.status, new.status;
  end if;

  if v_role = 'team_member' then
    if old.status = 'simulacao' and new.status = 'pre_analise' then
      return new;
    end if;
    raise exception 'status_transition_not_allowed_for_team_member: % -> %', old.status, new.status;
  end if;

  raise exception 'status_transition_not_allowed_for_role: %', v_role;
end;
$$;

create or replace function public.partner_list_kanban_propostas(p_limit int default 500)
returns table (
  id uuid,
  protocolo text,
  produto public.produto_tipo,
  status public.proposta_status,
  valor_solicitado numeric,
  valor_imoveis_total numeric,
  created_at timestamptz,
  updated_at timestamptz,
  partner_id uuid,
  partner_nome text,
  cliente_id uuid,
  cliente_nome text
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

  if v_role = 'partner' and not public.app_is_approved() then
    raise exception 'partner_not_approved' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.protocolo, p.produto, p.status, p.valor_solicitado,
    p.valor_imoveis_total, p.created_at, p.updated_at, p.partner_id,
    pu.nome_completo, p.cliente_id, c.nome_completo
  from public.propostas p
  join public.partners pt on pt.id = p.partner_id
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

revoke all on function public.partner_list_kanban_propostas(int) from public;
grant execute on function public.partner_list_kanban_propostas(int) to authenticated;

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
  if auth.uid() is null or v_role not in ('partner', 'team_member') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select p.status
    into v_old
    from public.propostas p
   where p.id = p_id
     and (
       (v_role = 'partner' and public.app_is_approved() and p.partner_id = public.app_partner_id())
       or
       (v_role = 'team_member' and p.equipe_id = public.app_equipe_id())
     );

  if v_old is null then
    raise exception 'proposta_not_found_or_forbidden' using errcode = '42501';
  end if;

  if v_old = p_status then
    return;
  end if;

  update public.propostas
     set status = p_status,
         updated_at = now()
   where id = p_id;

  if p_motivo is not null and length(btrim(p_motivo)) > 0 then
    update public.proposta_status_historico
       set motivo = p_motivo
     where id = (
       select h.id
         from public.proposta_status_historico h
        where h.proposta_id = p_id
          and h.status_novo = p_status
        order by h.created_at desc
        limit 1
     );
  end if;
end;
$$;

revoke all on function public.partner_set_proposta_status(uuid, public.proposta_status, text) from public;
grant execute on function public.partner_set_proposta_status(uuid, public.proposta_status, text) to authenticated;

create or replace view public.v_partner_dashboard_kpis as
with base as (
  select
    p.partner_id, p.equipe_id, p.id, p.status, p.valor_solicitado, p.created_at,
    case when p.status in ('contrato_registrado', 'recurso_liberado', 'pagamento_comissao', 'completo') then 1 else 0 end as ganhou,
    case when p.status = 'cancelado' then 1 else 0 end as perdeu,
    case when p.status in ('contrato_registrado', 'completo', 'cancelado') then 0 else 1 end as ativa,
    case when p.created_at >= date_trunc('month', now()) then 1 else 0 end as no_mes,
    case when p.created_at >= now() - interval '30 days' then 1 else 0 end as nos_30d
  from public.propostas p
)
select
  partner_id,
  count(*)::int as total_propostas,
  sum(no_mes)::int as propostas_mes,
  sum(nos_30d)::int as propostas_30d,
  sum(ativa)::int as ativas,
  sum(ganhou)::int as ganhas,
  sum(perdeu)::int as canceladas,
  case when count(*) > 0 then round((sum(ganhou)::numeric / count(*)) * 100, 1) else 0 end as taxa_conversao,
  coalesce(sum(case when ganhou = 1 then valor_solicitado end), 0) as volume_ganho,
  coalesce(avg(case when ganhou = 1 then valor_solicitado end), 0) as ticket_medio_ganho,
  coalesce(sum(valor_solicitado), 0) as volume_total
from base
where public.app_is_admin() or partner_id = public.app_partner_id()
group by partner_id;

grant select on public.v_partner_dashboard_kpis to authenticated;

create or replace view public.v_partner_propostas_por_mes as
select
  p.partner_id,
  date_trunc('month', p.created_at) as mes,
  count(*)::int as quantidade,
  count(*) filter (where p.status in ('contrato_registrado', 'recurso_liberado', 'pagamento_comissao', 'completo'))::int as ganhas,
  coalesce(sum(p.valor_solicitado), 0) as volume
from public.propostas p
where p.created_at >= now() - interval '12 months'
  and (public.app_is_admin() or p.partner_id = public.app_partner_id())
group by p.partner_id, date_trunc('month', p.created_at);

grant select on public.v_partner_propostas_por_mes to authenticated;

create or replace view public.v_partner_gargalos as
select
  p.id, p.partner_id, p.protocolo, p.status, p.valor_solicitado, p.updated_at,
  extract(day from (now() - p.updated_at))::int as dias_parada,
  c.nome_completo as cliente_nome
from public.propostas p
left join public.clientes c on c.id = p.cliente_id
where p.status not in ('contrato_registrado', 'completo', 'cancelado')
  and p.updated_at < now() - interval '7 days'
  and (public.app_is_admin() or p.partner_id = public.app_partner_id());

grant select on public.v_partner_gargalos to authenticated;

create or replace view public.v_admin_dashboard_kpis as
with base as (
  select
    p.id, p.status, p.partner_id, p.valor_solicitado, p.created_at,
    case when p.status in ('contrato_registrado', 'recurso_liberado', 'pagamento_comissao', 'completo') then 1 else 0 end as ganhou,
    case when p.status = 'cancelado' then 1 else 0 end as perdeu,
    case when p.status in ('contrato_registrado', 'completo', 'cancelado') then 0 else 1 end as ativa,
    case when p.created_at >= date_trunc('month', now()) then 1 else 0 end as no_mes
  from public.propostas p
)
select
  count(*)::int as total_propostas,
  sum(no_mes)::int as propostas_mes,
  sum(ativa)::int as ativas,
  sum(ganhou)::int as ganhas,
  sum(perdeu)::int as canceladas,
  case when count(*) > 0 then round((sum(ganhou)::numeric / count(*)) * 100, 1) else 0 end as taxa_conversao,
  coalesce(sum(case when ganhou = 1 then valor_solicitado end), 0) as volume_ganho,
  coalesce(sum(valor_solicitado), 0) as volume_total,
  count(distinct partner_id)::int as parceiros_ativos
from base
where public.app_is_admin();

grant select on public.v_admin_dashboard_kpis to authenticated;

create or replace view public.v_admin_top_partners as
select
  p.partner_id,
  u.nome_completo as partner_nome,
  count(*)::int as total,
  count(*) filter (where p.status in ('contrato_registrado', 'recurso_liberado', 'pagamento_comissao', 'completo'))::int as ganhas,
  coalesce(sum(p.valor_solicitado), 0) as volume
from public.propostas p
join public.partners pa on pa.id = p.partner_id
join public.usuarios u on u.id = pa.usuario_id
where public.app_is_admin()
group by p.partner_id, u.nome_completo
order by volume desc
limit 20;

grant select on public.v_admin_top_partners to authenticated;