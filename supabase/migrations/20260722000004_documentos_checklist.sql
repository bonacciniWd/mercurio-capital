-- =============================================
-- MIGRATION — CHECKLIST DE DOCUMENTOS (placeholders "pendente")
-- =============================================
-- Requisitos por PF/PJ (proponente principal) + Imóvel (sempre).
-- Placeholders são linhas em proposta_documentos com storage_path NULL e
-- status='pendente', criadas na criação da proposta (trigger em proponentes).
-- Aditiva: novas colunas/estruturas; compat mantida com `validado`.

-- ---------------------------------------------------------------
-- 1) Coluna status + storage_path nullable (para placeholders)
-- ---------------------------------------------------------------
alter table public.proposta_documentos
  add column if not exists status text not null default 'pendente'
    check (status in ('pendente','enviado','aprovado','rejeitado'));

alter table public.proposta_documentos
  alter column storage_path drop not null;

-- Backfill: linhas existentes já possuem arquivo → enviado/aprovado.
update public.proposta_documentos
   set status = case
     when validado then 'aprovado'
     when storage_path is not null then 'enviado'
     else 'pendente'
   end
 where status = 'pendente';

-- ---------------------------------------------------------------
-- 2) Catálogo de requisitos + seed
-- ---------------------------------------------------------------
create table if not exists public.documento_requisitos (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null check (categoria in ('pessoa_fisica','pessoa_juridica','imovel')),
  tipo        public.documento_tipo not null,
  obrigatorio boolean not null default false,
  ordem       int not null default 100,
  created_at  timestamptz not null default now(),
  unique (categoria, tipo)
);

alter table public.documento_requisitos enable row level security;

drop policy if exists "admin_full_doc_requisitos" on public.documento_requisitos;
create policy "admin_full_doc_requisitos" on public.documento_requisitos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

drop policy if exists "authenticated_le_doc_requisitos" on public.documento_requisitos;
create policy "authenticated_le_doc_requisitos" on public.documento_requisitos
  for select using (auth.role() = 'authenticated');

insert into public.documento_requisitos (categoria, tipo, obrigatorio, ordem) values
  -- Pessoa Física
  ('pessoa_fisica', 'rg',                     true,  10),
  ('pessoa_fisica', 'cnh',                    false, 11),
  ('pessoa_fisica', 'comprovante_residencia', true,  20),
  ('pessoa_fisica', 'certidao_casamento',     false, 30),
  ('pessoa_fisica', 'certidao_nascimento',    false, 31),
  ('pessoa_fisica', 'irpf_declaracao',        true,  40),
  ('pessoa_fisica', 'irpf_recibo',            true,  41),
  ('pessoa_fisica', 'extrato_bancario',       false, 50),
  -- Pessoa Jurídica
  ('pessoa_juridica', 'contrato_social',        true,  10),
  ('pessoa_juridica', 'extrato_bancario',       false, 20),
  ('pessoa_juridica', 'demonstrativo_contabil', true,  30),
  -- Imóvel (sempre)
  ('imovel', 'matricula_imovel',       true,  10),
  ('imovel', 'iptu',                   true,  20),
  ('imovel', 'ficha_cadastral_imovel', false, 21),
  ('imovel', 'fotos_imovel',           false, 30),
  ('imovel', 'contrato_compra_venda',  false, 40)
on conflict (categoria, tipo) do nothing;

-- ---------------------------------------------------------------
-- 3) Sync de status a partir de storage_path/validado
-- ---------------------------------------------------------------
create or replace function public.fn_sync_documento_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.storage_path is not null and coalesce(new.status, 'pendente') = 'pendente' then
      new.status := 'enviado';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.validado is true then
      new.status := 'aprovado';
    elsif new.validado is false and new.storage_path is not null and new.status = 'aprovado' then
      new.status := 'enviado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_documento_status on public.proposta_documentos;
create trigger trg_sync_documento_status
  before insert or update on public.proposta_documentos
  for each row execute function public.fn_sync_documento_status();

-- ---------------------------------------------------------------
-- 4) RPC: proposta_documentos_seed (idempotente)
-- ---------------------------------------------------------------
create or replace function public.proposta_documentos_seed(p_proposta_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa_cat text;
  v_count      int := 0;
  v_ins        int;
begin
  -- Ownership: admin, parceiro/equipe dono ou cliente da proposta. Caso contrário no-op.
  if not (
    public.app_is_admin()
    or exists (
      select 1 from public.propostas p
       where p.id = p_proposta_id
         and (
           p.partner_id = public.app_partner_id()
           or p.equipe_id = public.app_equipe_id()
           or p.cliente_id in (select c.id from public.clientes c where c.usuario_id = auth.uid())
         )
    )
  ) then
    return 0;
  end if;

  if not exists (select 1 from public.propostas where id = p_proposta_id) then
    return 0;
  end if;

  -- Imóvel: sempre.
  insert into public.proposta_documentos (proposta_id, categoria, tipo, storage_path, status)
  select p_proposta_id, r.categoria, r.tipo, null, 'pendente'
    from public.documento_requisitos r
   where r.categoria = 'imovel'
     and not exists (
       select 1 from public.proposta_documentos d
        where d.proposta_id = p_proposta_id and d.categoria = r.categoria and d.tipo = r.tipo
     );
  get diagnostics v_ins = row_count;
  v_count := v_count + v_ins;

  -- PF/PJ pelo proponente principal (fallback: primeiro proponente).
  select case when pr.pessoa_tipo = 'PJ' then 'pessoa_juridica' else 'pessoa_fisica' end
    into v_pessoa_cat
    from public.proponentes pr
   where pr.proposta_id = p_proposta_id
   order by pr.principal desc, pr.created_at asc
   limit 1;

  if v_pessoa_cat is not null then
    insert into public.proposta_documentos (proposta_id, categoria, tipo, storage_path, status)
    select p_proposta_id, r.categoria, r.tipo, null, 'pendente'
      from public.documento_requisitos r
     where r.categoria = v_pessoa_cat
       and not exists (
         select 1 from public.proposta_documentos d
          where d.proposta_id = p_proposta_id and d.categoria = r.categoria and d.tipo = r.tipo
       );
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;
  end if;

  return v_count;
end;
$$;

revoke all on function public.proposta_documentos_seed(uuid) from public;
grant execute on function public.proposta_documentos_seed(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 5) Trigger: semear placeholders quando proponentes são criados
--    (proponentes existem após a criação da proposta em ambos os fluxos).
-- ---------------------------------------------------------------
create or replace function public.fn_seed_docs_on_proponente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.proposta_documentos_seed(new.proposta_id);
  return new;
end;
$$;

drop trigger if exists trg_seed_docs_proponente on public.proponentes;
create trigger trg_seed_docs_proponente
  after insert on public.proponentes
  for each row execute function public.fn_seed_docs_on_proponente();
