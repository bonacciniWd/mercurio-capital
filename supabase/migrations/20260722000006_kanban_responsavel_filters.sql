-- Expor responsavel interno nas RPCs do Kanban para UI e filtros.

drop function if exists public.admin_list_propostas(int);

create function public.admin_list_propostas(
  p_limit int default 500
)
  returns table (
    id                  uuid,
    protocolo           text,
    produto             produto_tipo,
    status              proposta_status,
    valor_solicitado    numeric,
    valor_imoveis_total numeric,
    prazo_meses         int,
    created_at          timestamptz,
    updated_at          timestamptz,
    partner_id          uuid,
    partner_nome        text,
    responsavel_id      uuid,
    responsavel_nome    text,
    cliente_id          uuid,
    cliente_nome        text,
    cliente_cpf         text
  )
  language sql
  security definer
  stable
  set search_path = public
as $$
  select
    p.id,
    p.protocolo,
    p.produto,
    p.status,
    p.valor_solicitado,
    p.valor_imoveis_total,
    p.prazo_meses,
    p.created_at,
    p.updated_at,
    p.partner_id,
    pu.nome_completo as partner_nome,
    p.responsavel_id,
    ru.nome_completo as responsavel_nome,
    p.cliente_id,
    c.nome_completo as cliente_nome,
    c.cpf as cliente_cpf
  from public.propostas p
  left join public.partners pt on pt.id = p.partner_id
  left join public.usuarios pu on pu.id = pt.usuario_id
  left join public.usuarios ru on ru.id = p.responsavel_id
  left join public.clientes c on c.id = p.cliente_id
  where public.app_is_admin()
  order by p.updated_at desc
  limit greatest(1, coalesce(p_limit, 500));
$$;

revoke all on function public.admin_list_propostas(int) from public;
grant execute on function public.admin_list_propostas(int) to authenticated;

comment on function public.admin_list_propostas(int) is
  'Lista todas as propostas para telas administrativas, incluindo parceiro, cliente e responsavel interno da proposta.';

drop function if exists public.partner_list_kanban_propostas(int);

create function public.partner_list_kanban_propostas(p_limit int default 500)
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
  responsavel_id uuid,
  responsavel_nome text,
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

  if not public.app_is_approved() then
    raise exception 'partner_not_approved' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.protocolo,
    p.produto,
    p.status,
    p.valor_solicitado,
    p.valor_imoveis_total,
    p.created_at,
    p.updated_at,
    p.partner_id,
    pu.nome_completo,
    p.responsavel_id,
    ru.nome_completo,
    p.cliente_id,
    c.nome_completo
  from public.propostas p
  join public.partners pt on pt.id = p.partner_id and pt.status = 'approved'
  join public.usuarios pu on pu.id = pt.usuario_id
  left join public.usuarios ru on ru.id = p.responsavel_id
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
