-- =============================================
-- MIGRATION — MODELOS DE CONTRATO POR PROPOSTA
-- =============================================
-- Modelo de contrato enviado pelo admin (interno), varia por proposta.
-- Disponível para download por admin, parceiro dono e cliente da proposta.
-- É DISTINTO do PDF gerado pelo fluxo Clicksign (tabela contratos).
-- Reusa o bucket privado `contratos` (path: {proposta_id}/modelos/{uuid}.ext).
-- Aditiva.

create table if not exists public.proposta_contrato_modelos (
  id            uuid primary key default gen_random_uuid(),
  proposta_id   uuid not null references public.propostas(id) on delete cascade,
  storage_path  text not null,
  nome_arquivo  text not null,
  enviado_por   uuid references public.usuarios(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists proposta_contrato_modelos_proposta_idx
  on public.proposta_contrato_modelos (proposta_id, created_at desc);

alter table public.proposta_contrato_modelos enable row level security;

-- Admin: escrita/leitura total.
drop policy if exists "admin_full_contrato_modelos" on public.proposta_contrato_modelos;
create policy "admin_full_contrato_modelos" on public.proposta_contrato_modelos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- Parceiro dono (ou equipe responsável): apenas leitura.
drop policy if exists "partner_le_contrato_modelos" on public.proposta_contrato_modelos;
create policy "partner_le_contrato_modelos" on public.proposta_contrato_modelos
  for select using (
    proposta_id in (
      select id from public.propostas
       where partner_id = public.app_partner_id()
          or equipe_id  = public.app_equipe_id()
    )
  );

-- Cliente da proposta: apenas leitura.
drop policy if exists "cliente_le_contrato_modelos" on public.proposta_contrato_modelos;
create policy "cliente_le_contrato_modelos" on public.proposta_contrato_modelos
  for select using (
    proposta_id in (
      select id from public.propostas
       where cliente_id in (select c.id from public.clientes c where c.usuario_id = auth.uid())
    )
    and public.app_user_role() = 'client'
  );

-- ---------------------------------------------------------------
-- RPC: registra metadados do modelo (upload do arquivo é feito no
-- storage pelo cliente admin, seguindo o padrão dos demais uploads).
-- ---------------------------------------------------------------
create or replace function public.proposta_contrato_modelo_add(
  p_proposta_id  uuid,
  p_storage_path text,
  p_nome_arquivo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.propostas where id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada' using errcode = 'P0002';
  end if;

  if length(coalesce(btrim(p_storage_path), '')) = 0 then
    raise exception 'storage_path_obrigatorio' using errcode = '22023';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_proposta_id::text then
    raise exception 'storage_path_invalido' using errcode = '22023', hint = 'path deve iniciar com {proposta_id}/';
  end if;

  insert into public.proposta_contrato_modelos (proposta_id, storage_path, nome_arquivo, enviado_por)
  values (p_proposta_id, btrim(p_storage_path), coalesce(nullif(btrim(p_nome_arquivo), ''), 'modelo'), auth.uid())
  returning id into v_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'contrato_modelo_adicionado', 'proposta_contrato_modelos', v_id,
          jsonb_build_object('proposta_id', p_proposta_id, 'nome_arquivo', p_nome_arquivo));

  return v_id;
end;
$$;

revoke all on function public.proposta_contrato_modelo_add(uuid, text, text) from public;
grant execute on function public.proposta_contrato_modelo_add(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------
-- RPC: remove um modelo (apenas admin). Retorna o storage_path
-- para o cliente remover o objeto do bucket.
-- ---------------------------------------------------------------
create or replace function public.proposta_contrato_modelo_remove(
  p_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.proposta_contrato_modelos
   where id = p_id
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'modelo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes)
  values (auth.uid(), 'contrato_modelo_removido', 'proposta_contrato_modelos', p_id,
          jsonb_build_object('storage_path', v_path));

  return v_path;
end;
$$;

revoke all on function public.proposta_contrato_modelo_remove(uuid) from public;
grant execute on function public.proposta_contrato_modelo_remove(uuid) to authenticated;
