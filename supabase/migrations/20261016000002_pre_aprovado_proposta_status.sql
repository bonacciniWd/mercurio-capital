-- Adiciona a etapa operacional intermediária entre análise de crédito e imóvel.
alter type public.proposta_status
  add value if not exists 'pre_aprovado' after 'analise_credito';

-- Clientes e parceiros podem continuar usando clientes móveis antigos que
-- interpretem um status desconhecido como aprovado. A leitura de artefatos de
-- contrato fica bloqueada para essa etapa no banco; admin mantém acesso.
-- Comparar status::text evita depender do novo valor enum em casts da policy.
create or replace function public.app_can_read_contract_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.propostas p
     where p.id::text = split_part(p_name, '/', 1)
       and (
         public.app_is_admin()
         or (
           p.status::text <> 'pre_aprovado'
           and (
             p.partner_id = public.app_partner_id()
             or p.equipe_id = public.app_equipe_id()
             or p.cliente_id in (
               select c.id
                 from public.clientes c
                where c.usuario_id = auth.uid()
             )
           )
         )
       )
  );
$$;

revoke all on function public.app_can_read_contract_path(text) from public, anon;
grant execute on function public.app_can_read_contract_path(text) to authenticated;

-- Protege metadados do contrato e assinaturas para leitura direta via PostgREST.
drop policy if exists "partner_le_contrato" on public.contratos;
create policy "partner_le_contrato" on public.contratos
  for select using (
    proposta_id in (
      select id from public.propostas
       where partner_id = public.app_partner_id()
         and status::text <> 'pre_aprovado'
    )
  );

drop policy if exists "cliente_le_contrato" on public.contratos;
create policy "cliente_le_contrato" on public.contratos
  for select using (
    proposta_id in (
      select id from public.propostas
       where cliente_id in (select id from public.clientes where usuario_id = auth.uid())
         and status::text <> 'pre_aprovado'
    )
    and public.app_user_role() = 'client'
  );

drop policy if exists "partner_le_assinaturas" on public.assinaturas_contrato;
create policy "partner_le_assinaturas" on public.assinaturas_contrato
  for select using (
    contrato_id in (
      select c.id
        from public.contratos c
        join public.propostas p on p.id = c.proposta_id
       where p.partner_id = public.app_partner_id()
         and p.status::text <> 'pre_aprovado'
    )
  );

drop policy if exists "cliente_le_assinaturas" on public.assinaturas_contrato;
create policy "cliente_le_assinaturas" on public.assinaturas_contrato
  for select using (
    contrato_id in (
      select c.id
        from public.contratos c
        join public.propostas p on p.id = c.proposta_id
       where p.cliente_id in (select id from public.clientes where usuario_id = auth.uid())
         and p.status::text <> 'pre_aprovado'
    )
    and public.app_user_role() = 'client'
  );

-- Modelos também são arquivos de contrato e devem obedecer ao mesmo bloqueio.
drop policy if exists "partner_le_contrato_modelos" on public.proposta_contrato_modelos;
create policy "partner_le_contrato_modelos" on public.proposta_contrato_modelos
  for select using (
    proposta_id in (
      select id from public.propostas
       where (partner_id = public.app_partner_id() or equipe_id = public.app_equipe_id())
         and status::text <> 'pre_aprovado'
    )
  );

drop policy if exists "cliente_le_contrato_modelos" on public.proposta_contrato_modelos;
create policy "cliente_le_contrato_modelos" on public.proposta_contrato_modelos
  for select using (
    proposta_id in (
      select id from public.propostas
       where cliente_id in (select id from public.clientes where usuario_id = auth.uid())
         and status::text <> 'pre_aprovado'
    )
    and public.app_user_role() = 'client'
  );

-- Mantém o acesso a comprovantes inalterado; somente arquivos do bucket
-- privado de contratos usam o helper com a restrição da etapa Pré-aprovado.
drop policy if exists "contratos_select" on storage.objects;
create policy "contratos_select" on storage.objects
  for select using (
    bucket_id = 'contratos'
    and public.app_can_read_contract_path(name)
  );

notify pgrst, 'reload schema';
