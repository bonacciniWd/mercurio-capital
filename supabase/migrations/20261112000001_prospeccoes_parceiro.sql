-- Funil comercial de prospecção de parceiros + admin_nivel 'comercial'.
-- Plano aprovado: prompts/2026-11-12-funil-prospeccao-parceiros.md (S1-S5 do dono).
-- Issues #28 (modelo/RLS/view/smoke) + #29 (helper + nível) + #30 (RPCs), coesas numa migration.
-- Entidade NOVA (não reaproveita leads B2C nem partners — invariantes/LGPD diferentes).
-- Escrita SOMENTE via RPCs security definer (padrão lead_status_comercial).

-- ---------------------------------------------------------------
-- 1) Helper de escopo comercial (#29): full | limitado | comercial; juridico FORA
--    NÃO altera app_is_admin_operacional() (risco R2 do plano).
-- ---------------------------------------------------------------
create or replace function public.app_is_admin_escopo_comercial()
returns boolean
language sql stable
as $$
  select public.app_is_admin()
     and coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'admin_nivel', ''), 'full')
         in ('full','limitado','comercial')
$$;

-- ---------------------------------------------------------------
-- 2) Tabelas (#28)
-- ---------------------------------------------------------------
create table public.prospeccoes_parceiro (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null check (length(btrim(nome_empresa)) between 2 and 160),
  contato_nome text not null check (length(btrim(contato_nome)) between 3 and 160),
  contato_email text check (contato_email is null or contato_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contato_telefone text check (contato_telefone is null or contato_telefone ~ '^[0-9]{10,11}$'),
  origem text not null default 'outro' check (origem in ('indicacao','evento','outbound','site','outro')),
  notas text,
  status text not null default 'oportunidade' check (status in (
    'oportunidade','follow_up','reuniao_realizada',
    'reuniao_continuacao_a_marcar','reuniao_continuacao_realizada',
    'fechamento_documental','nca_mandato','converter_proposta'
  )),
  responsavel_id uuid references public.usuarios(id) on delete set null,
  proxima_acao_em timestamptz,
  partner_id uuid references public.partners(id) on delete set null,
  proposta_id uuid references public.propostas(id) on delete set null,
  arquivado_em timestamptz,
  motivo_arquivamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id),
  updated_by uuid references public.usuarios(id),
  deleted_at timestamptz,
  -- ao menos um canal de contato
  check (contato_email is not null or contato_telefone is not null)
);

create trigger trg_prospeccoes_updated_at
  before update on public.prospeccoes_parceiro
  for each row execute function public.set_updated_at();

create unique index prospeccoes_partner_unico
  on public.prospeccoes_parceiro (partner_id) where partner_id is not null;
create index prospeccoes_status_idx on public.prospeccoes_parceiro (status, updated_at desc) where deleted_at is null and arquivado_em is null;
create index prospeccoes_responsavel_idx on public.prospeccoes_parceiro (responsavel_id) where deleted_at is null;

create table public.prospeccoes_parceiro_historico (
  id uuid primary key default gen_random_uuid(),
  prospeccao_id uuid not null references public.prospeccoes_parceiro(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  alterado_em timestamptz not null default now(),
  alterado_por uuid references public.usuarios(id)
);
create index prospeccoes_historico_idx on public.prospeccoes_parceiro_historico (prospeccao_id, alterado_em desc);

alter table public.prospeccoes_parceiro enable row level security;
alter table public.prospeccoes_parceiro_historico enable row level security;

-- grants de tabela no padrão estrito: escrita só via RPC; leitura admin (qualquer nível lê)
revoke all on public.prospeccoes_parceiro from public, anon, authenticated;
revoke all on public.prospeccoes_parceiro_historico from public, anon, authenticated;
grant select on public.prospeccoes_parceiro to authenticated;
grant select on public.prospeccoes_parceiro_historico to authenticated;
grant all on public.prospeccoes_parceiro to service_role;
grant all on public.prospeccoes_parceiro_historico to service_role;

create policy "admin_le_prospeccoes" on public.prospeccoes_parceiro
  for select to authenticated using (public.app_is_admin());
create policy "admin_le_prospeccoes_historico" on public.prospeccoes_parceiro_historico
  for select to authenticated using (public.app_is_admin());

-- view de leitura (security_invoker) para a tela
create or replace view public.v_admin_prospeccoes_parceiro
with (security_invoker = on) as
  select p.id, p.nome_empresa, p.contato_nome, p.contato_email, p.contato_telefone,
         p.origem, p.notas, p.status, p.responsavel_id,
         u.nome_completo as responsavel_nome,
         p.proxima_acao_em, p.partner_id, p.proposta_id,
         p.arquivado_em, p.motivo_arquivamento, p.created_at, p.updated_at
    from public.prospeccoes_parceiro p
    left join public.usuarios u on u.id = p.responsavel_id
   where p.deleted_at is null;

revoke all on public.v_admin_prospeccoes_parceiro from public, anon;
grant select on public.v_admin_prospeccoes_parceiro to authenticated;

-- ---------------------------------------------------------------
-- 3) Nível 'comercial' no admin_set_admin_nivel (#29)
-- ---------------------------------------------------------------
-- estende a validação existente para aceitar 'comercial' (além de full/limitado/juridico)
create or replace function public.admin_set_admin_nivel(
  p_user_id uuid,
  p_nivel   text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role   text;
  v_before text;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id_obrigatorio';
  end if;

  if coalesce(p_nivel, '') not in ('full', 'limitado', 'juridico', 'comercial') then
    raise exception 'nivel_invalido' using hint = 'use full, limitado, juridico ou comercial';
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', '')
    into v_role
    from auth.users u
   where u.id = p_user_id;

  if not found then
    raise exception 'usuario_nao_encontrado' using errcode = 'P0002';
  end if;

  if v_role <> 'admin' then
    raise exception 'alvo_nao_e_admin';
  end if;

  v_before := coalesce(
    (select u.raw_app_meta_data ->> 'admin_nivel' from auth.users u where u.id = p_user_id),
    'full'
  );

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('admin_nivel', p_nivel)
   where id = p_user_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (
    auth.uid(),
    'admin_nivel_alterado',
    'auth.users',
    p_user_id,
    jsonb_build_object('admin_nivel', v_before),
    jsonb_build_object('admin_nivel', p_nivel)
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'admin_nivel', p_nivel
  );
end;
$$;
revoke all on function public.admin_set_admin_nivel(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_admin_nivel(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- 4) RPCs do funil (#30) — guard comercial; escrita auditada
-- ---------------------------------------------------------------

-- 4.1 criar card
create or replace function public.admin_prospeccao_create(
  p_nome_empresa text,
  p_contato_nome text,
  p_contato_email text default null,
  p_contato_telefone text default null,
  p_origem text default 'outro',
  p_notas text default null,
  p_responsavel_id uuid default null,
  p_proxima_acao_em timestamptz default null
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- normaliza ANTES de validar: '' vira null; telefone só dígitos
  p_contato_email := nullif(lower(btrim(coalesce(p_contato_email, ''))), '');
  p_contato_telefone := nullif(regexp_replace(coalesce(p_contato_telefone, ''), '\D', '', 'g'), '');
  if p_contato_email is null and p_contato_telefone is null then
    raise exception 'contato_obrigatorio' using errcode = '22023';
  end if;

  insert into public.prospeccoes_parceiro (
    id, nome_empresa, contato_nome, contato_email, contato_telefone,
    origem, notas, responsavel_id, proxima_acao_em, created_by, updated_by
  ) values (
    v_id, btrim(p_nome_empresa), btrim(p_contato_nome),
    p_contato_email, p_contato_telefone,
    coalesce(p_origem,'outro'), p_notas,
    coalesce(p_responsavel_id, auth.uid()), p_proxima_acao_em,
    auth.uid(), auth.uid()
  );

  insert into public.prospeccoes_parceiro_historico (prospeccao_id, status_anterior, status_novo, alterado_por)
  values (v_id, null, 'oportunidade', auth.uid());

  perform public.registrar_audit('prospeccao_criada', 'prospeccoes_parceiro', v_id, null,
    jsonb_build_object('nome_empresa', btrim(p_nome_empresa), 'status', 'oportunidade'));
  return v_id;
end;
$$;
revoke all on function public.admin_prospeccao_create(text,text,text,text,text,text,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_create(text,text,text,text,text,text,uuid,timestamptz) to authenticated;

-- 4.2 editar dados (não status)
create or replace function public.admin_prospeccao_update(
  p_id uuid,
  p_nome_empresa text default null,
  p_contato_nome text default null,
  p_contato_email text default null,
  p_contato_telefone text default null,
  p_origem text default null,
  p_notas text default null,
  p_responsavel_id uuid default null,
  p_proxima_acao_em timestamptz default null
) returns void
language plpgsql security definer
set search_path = public as $$
declare
  v_antes public.prospeccoes_parceiro%rowtype;
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- arquivado é terminal para edição também (coerente com move; motivo se enriquece reabrindo)
  select * into v_antes from public.prospeccoes_parceiro
   where id = p_id and deleted_at is null and arquivado_em is null for update;
  if not found then raise exception 'prospeccao_nao_encontrada' using errcode = 'P0002'; end if;

  update public.prospeccoes_parceiro set
    nome_empresa = coalesce(nullif(btrim(p_nome_empresa),''), nome_empresa),
    contato_nome = coalesce(nullif(btrim(p_contato_nome),''), contato_nome),
    contato_email = coalesce(nullif(lower(btrim(coalesce(p_contato_email,''))),''), contato_email),
    contato_telefone = coalesce(nullif(regexp_replace(coalesce(p_contato_telefone,''),'\D','','g'),''), contato_telefone),
    origem = coalesce(p_origem, origem),
    notas = coalesce(p_notas, notas),
    responsavel_id = coalesce(p_responsavel_id, responsavel_id),
    proxima_acao_em = coalesce(p_proxima_acao_em, proxima_acao_em),
    updated_by = auth.uid()
  where id = p_id;

  perform public.registrar_audit('prospeccao_editada', 'prospeccoes_parceiro', p_id,
    to_jsonb(v_antes), (select to_jsonb(p) from public.prospeccoes_parceiro p where p.id = p_id));
end;
$$;
revoke all on function public.admin_prospeccao_update(uuid,text,text,text,text,text,text,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_update(uuid,text,text,text,text,text,text,uuid,timestamptz) to authenticated;

-- 4.3 mover entre colunas (otimista + histórico) — padrão lead_status_comercial
create or replace function public.admin_prospeccao_move(
  p_id uuid,
  p_novo_status text,
  p_status_esperado text
) returns table (status text, updated_at timestamptz, updated_by uuid)
language plpgsql security definer
set search_path = public as $$
declare
  v_row public.prospeccoes_parceiro%rowtype;
  v_statuses constant text[] := array[
    'oportunidade','follow_up','reuniao_realizada',
    'reuniao_continuacao_a_marcar','reuniao_continuacao_realizada',
    'fechamento_documental','nca_mandato','converter_proposta'];
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_novo_status is null or not (p_novo_status = any(v_statuses))
     or p_status_esperado is null or not (p_status_esperado = any(v_statuses)) then
    raise exception 'status_invalido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));

  select * into v_row from public.prospeccoes_parceiro
   where id = p_id and deleted_at is null and arquivado_em is null for update;
  if not found then raise exception 'prospeccao_nao_encontrada' using errcode = 'P0002'; end if;

  if v_row.status <> p_status_esperado then
    raise exception 'status_conflito' using errcode = '40001';
  end if;
  if v_row.status = p_novo_status then
    return query select v_row.status, v_row.updated_at, v_row.updated_by;
    return;
  end if;

  update public.prospeccoes_parceiro
     set status = p_novo_status, updated_by = auth.uid()
   where id = p_id returning * into v_row;

  insert into public.prospeccoes_parceiro_historico (prospeccao_id, status_anterior, status_novo, alterado_por)
  values (p_id, p_status_esperado, p_novo_status, auth.uid());

  perform public.registrar_audit('prospeccao_movida', 'prospeccoes_parceiro', p_id,
    jsonb_build_object('status', p_status_esperado), jsonb_build_object('status', p_novo_status));

  return query select v_row.status, v_row.updated_at, v_row.updated_by;
end;
$$;
revoke all on function public.admin_prospeccao_move(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_move(uuid, text, text) to authenticated;

-- 4.4 arquivar (perda/desistência) — motivo obrigatório
create or replace function public.admin_prospeccao_arquivar(p_id uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = public as $$
declare
  v_row public.prospeccoes_parceiro%rowtype;
begin
  if not public.app_is_admin_escopo_comercial() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) < 3 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;

  select * into v_row from public.prospeccoes_parceiro where id = p_id and deleted_at is null for update;
  if not found then raise exception 'prospeccao_nao_encontrada' using errcode = 'P0002'; end if;
  if v_row.arquivado_em is not null then
    raise exception 'ja_arquivada' using errcode = '22023';
  end if;

  update public.prospeccoes_parceiro
     set arquivado_em = now(), motivo_arquivamento = btrim(p_motivo), updated_by = auth.uid()
   where id = p_id;

  perform public.registrar_audit('prospeccao_arquivada', 'prospeccoes_parceiro', p_id,
    jsonb_build_object('status', v_row.status), jsonb_build_object('arquivado_em', now(), 'motivo', btrim(p_motivo)));
end;
$$;
revoke all on function public.admin_prospeccao_arquivar(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_prospeccao_arquivar(uuid, text) to authenticated;
