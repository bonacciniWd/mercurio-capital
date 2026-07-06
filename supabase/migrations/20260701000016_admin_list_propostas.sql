-- =============================================
-- MIGRATION — admin_list_propostas
-- RPC SECURITY DEFINER que retorna todas as propostas
-- (do admin e de TODOS os parceiros) para as telas
-- administrativas (lista e Kanban).
--
-- Motivo: a listagem por SELECT direto depende de várias
-- políticas de RLS (propostas + joins em partners/usuarios/
-- clientes). Em cenários onde o claim `app_metadata.role`
-- do JWT do admin não é resolvido corretamente (ou onde o
-- admin também possui um `partner_id` associado), o admin
-- passa a enxergar apenas suas próprias propostas.
--
-- Esta RPC valida `app_is_admin()` no server e devolve todos
-- os campos necessários já com o nome do cliente e do
-- parceiro, sem depender de RLS nas tabelas filhas.
-- =============================================

create or replace function public.admin_list_propostas(
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
    pu.nome_completo   as partner_nome,
    p.cliente_id,
    c.nome_completo    as cliente_nome,
    c.cpf              as cliente_cpf
  from public.propostas p
  left join public.partners  pt on pt.id = p.partner_id
  left join public.usuarios  pu on pu.id = pt.usuario_id
  left join public.clientes  c  on c.id  = p.cliente_id
  where public.app_is_admin()
  order by p.updated_at desc
  limit greatest(1, coalesce(p_limit, 500));
$$;

revoke all on function public.admin_list_propostas(int) from public;
grant execute on function public.admin_list_propostas(int) to authenticated;

comment on function public.admin_list_propostas(int) is
  'Lista todas as propostas (admin + parceiros) para telas administrativas. Requer app_is_admin().';

