-- =============================================
-- MIGRATION 041 — Hotfix: quebra recursão RLS propostas ↔ clientes
-- =============================================
-- Erro original (cliente lendo /rest/v1/propostas):
--   "infinite recursion detected in policy for relation propostas" (42P17)
--
-- Causa: cliente_le_propria_proposta (em propostas) consulta clientes;
-- partner_team_le_clientes_relacionados (em clientes) consulta propostas.
-- O planner do Postgres detecta o ciclo e aborta.
--
-- Solução: substituir as duas subconsultas por helpers SECURITY DEFINER
-- (rodam como owner, ignoram RLS, quebram o ciclo).
-- =============================================

-- 1) Helper: ids de clientes vinculados ao usuário autenticado
create or replace function public.app_my_cliente_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.clientes where usuario_id = auth.uid();
$$;

grant execute on function public.app_my_cliente_ids() to authenticated;

-- 2) Helper: o parceiro/equipe logado "tem" relação com este cliente?
create or replace function public.app_partner_owns_cliente(p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.propostas p
     where p.cliente_id = p_cliente
       and (
         (public.app_user_role() = 'partner'
            and p.partner_id = public.app_partner_id())
         or
         (public.app_user_role() = 'team_member'
            and p.equipe_id = public.app_equipe_id())
       )
  );
$$;

grant execute on function public.app_partner_owns_cliente(uuid) to authenticated;

-- 3) Reescreve propostas.cliente_le_propria_proposta sem subquery direta em clientes
drop policy if exists "cliente_le_propria_proposta" on public.propostas;
create policy "cliente_le_propria_proposta" on public.propostas
  for select using (
    public.app_user_role() = 'client'
    and cliente_id in (select public.app_my_cliente_ids())
  );

-- 4) Reescreve clientes.partner_team_le_clientes_relacionados sem subquery direta em propostas
drop policy if exists "partner_team_le_clientes_relacionados" on public.clientes;
create policy "partner_team_le_clientes_relacionados" on public.clientes
  for select using (
    public.app_user_role() in ('partner','team_member')
    and public.app_partner_owns_cliente(clientes.id)
  );

