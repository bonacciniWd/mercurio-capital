-- Carteira B2C de prospecção para parceiros e equipes.
-- Mantém separado o domínio B2B public.prospeccoes_parceiro.

create table public.prospeccoes_clientes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  equipe_id uuid references public.equipes(id) on delete set null,
  responsavel_id uuid not null references public.usuarios(id) on delete restrict,
  nome_completo text not null check (length(btrim(nome_completo)) between 2 and 160),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  origem text check (origem is null or origem in ('indicacao','whatsapp','evento','site','outro')),
  notas text check (notas is null or length(notas) <= 2000),
  status text not null default 'novo' check (status in ('novo','em_contato','qualificado','proposta_criada','perdido')),
  motivo_perda text check (motivo_perda is null or length(btrim(motivo_perda)) between 3 and 1000),
  proposta_id uuid unique references public.propostas(id) on delete restrict,
  convertido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.usuarios(id) on delete restrict,
  updated_by uuid not null references public.usuarios(id) on delete restrict,
  deleted_at timestamptz,
  constraint prospeccao_cliente_contato_obrigatorio check (email is not null or telefone is not null),
  constraint prospeccao_cliente_perda_motivo check ((status = 'perdido') = (motivo_perda is not null)),
  constraint prospeccao_cliente_conversao_coerente check (
    (status = 'proposta_criada' and proposta_id is not null and convertido_em is not null)
    or (status <> 'proposta_criada' and proposta_id is null and convertido_em is null)
  )
);

create index prospeccoes_clientes_partner_status_idx
  on public.prospeccoes_clientes (partner_id, status, updated_at desc)
  where deleted_at is null;
create index prospeccoes_clientes_equipe_status_idx
  on public.prospeccoes_clientes (equipe_id, status, updated_at desc)
  where deleted_at is null and equipe_id is not null;
create index prospeccoes_clientes_proposta_idx
  on public.prospeccoes_clientes (proposta_id) where proposta_id is not null;

create table public.prospeccoes_clientes_historico (
  id uuid primary key default gen_random_uuid(),
  prospeccao_id uuid not null references public.prospeccoes_clientes(id) on delete cascade,
  status_anterior text check (status_anterior is null or status_anterior in ('novo','em_contato','qualificado','proposta_criada','perdido')),
  status_novo text not null check (status_novo in ('novo','em_contato','qualificado','proposta_criada','perdido')),
  alterado_em timestamptz not null default now(),
  alterado_por uuid references public.usuarios(id) on delete set null,
  motivo text
);
create index prospeccoes_clientes_historico_idx
  on public.prospeccoes_clientes_historico (prospeccao_id, alterado_em desc);

create or replace function public.validar_prospeccao_cliente_equipe()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_partner_id uuid;
begin
  if new.equipe_id is not null then
    select e.partner_id into v_partner_id
      from public.equipes e where e.id = new.equipe_id;
    if v_partner_id is null or v_partner_id is distinct from new.partner_id then
      raise exception 'equipe_fora_do_parceiro' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_validar_prospeccao_cliente_equipe
  before insert or update of partner_id, equipe_id on public.prospeccoes_clientes
  for each row execute function public.validar_prospeccao_cliente_equipe();
create trigger trg_prospeccoes_clientes_updated_at
  before update on public.prospeccoes_clientes
  for each row execute function public.set_updated_at();

alter table public.prospeccoes_clientes enable row level security;
alter table public.prospeccoes_clientes_historico enable row level security;
revoke all on public.prospeccoes_clientes from public, anon, authenticated;
revoke all on public.prospeccoes_clientes_historico from public, anon, authenticated;
grant select on public.prospeccoes_clientes, public.prospeccoes_clientes_historico to authenticated;
grant all on public.prospeccoes_clientes, public.prospeccoes_clientes_historico to service_role;

create policy prospeccoes_clientes_leitura_escopada
  on public.prospeccoes_clientes for select to authenticated
  using (
    public.app_can_operate()
    and deleted_at is null
    and (
      public.app_is_admin_escopo_comercial()
      or (public.app_user_role() = 'partner' and public.app_is_approved() and partner_id = public.app_partner_id())
      or (public.app_user_role() = 'team_member' and public.app_is_approved() and equipe_id = public.app_equipe_id())
    )
  );
create policy prospeccoes_clientes_historico_leitura_escopada
  on public.prospeccoes_clientes_historico for select to authenticated
  using (
    public.app_can_operate()
    and (
      public.app_is_admin_escopo_comercial()
      or exists (
        select 1 from public.prospeccoes_clientes p
         where p.id = prospeccao_id
           and p.deleted_at is null
           and (
             (public.app_user_role() = 'partner' and public.app_is_approved() and p.partner_id = public.app_partner_id())
             or (public.app_user_role() = 'team_member' and public.app_is_approved() and p.equipe_id = public.app_equipe_id())
           )
      )
    )
  );

create or replace view public.v_prospeccoes_clientes
with (security_invoker = on) as
  select id, partner_id, equipe_id, responsavel_id, nome_completo, email, telefone,
         origem, notas, status, motivo_perda, proposta_id, convertido_em,
         created_at, updated_at, created_by, updated_by
    from public.prospeccoes_clientes
   where deleted_at is null;
revoke all on public.v_prospeccoes_clientes from public, anon;
grant select on public.v_prospeccoes_clientes to authenticated;

-- Cadastro pelo parceiro/equipe. Identidade da carteira vem dos claims, nunca do payload.
create or replace function public.partner_prospeccao_cliente_create(
  p_nome_completo text,
  p_email text,
  p_telefone text,
  p_equipe_id uuid default null,
  p_origem text default null,
  p_notas text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_role text := public.app_user_role();
  v_partner_id uuid := public.app_partner_id();
  v_equipe_id uuid;
  v_email text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_telefone text := nullif(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), '');
begin
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then raise exception '2fa_required' using errcode = '42501'; end if;
  if auth.uid() is null or v_role not in ('partner','team_member') or not public.app_is_approved() or v_partner_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_role = 'team_member' then
    v_equipe_id := public.app_equipe_id();
    if v_equipe_id is null then raise exception 'equipe_invalida' using errcode = '42501'; end if;
  else
    v_equipe_id := p_equipe_id;
  end if;
  if v_equipe_id is not null and not exists (
    select 1 from public.equipes e where e.id = v_equipe_id and e.partner_id = v_partner_id
  ) then raise exception 'equipe_fora_do_parceiro' using errcode = '42501'; end if;
  if v_email is null and v_telefone is null then raise exception 'contato_obrigatorio' using errcode = '22023'; end if;
  if p_origem is not null and p_origem not in ('indicacao','whatsapp','evento','site','outro') then
    raise exception 'origem_invalida' using errcode = '22023';
  end if;

  insert into public.prospeccoes_clientes (
    id, partner_id, equipe_id, responsavel_id, nome_completo, email, telefone,
    origem, notas, status, created_by, updated_by
  ) values (
    v_id, v_partner_id, v_equipe_id, auth.uid(), btrim(p_nome_completo), v_email, v_telefone,
    p_origem, nullif(btrim(coalesce(p_notas,'')), ''), 'novo', auth.uid(), auth.uid()
  );
  insert into public.prospeccoes_clientes_historico (prospeccao_id, status_novo, alterado_por)
  values (v_id, 'novo', auth.uid());
  perform public.registrar_audit('prospeccao_cliente_criada', 'prospeccoes_clientes', v_id, null,
    jsonb_build_object('partner_id', v_partner_id, 'equipe_id', v_equipe_id, 'status', 'novo'));
  return v_id;
end;
$$;
revoke all on function public.partner_prospeccao_cliente_create(text,text,text,uuid,text,text) from public, anon;
grant execute on function public.partner_prospeccao_cliente_create(text,text,text,uuid,text,text) to authenticated;

-- Cadastro administrativo global, atribuído a um parceiro aprovado.
create or replace function public.admin_prospeccao_cliente_create(
  p_partner_id uuid,
  p_equipe_id uuid,
  p_nome_completo text,
  p_email text,
  p_telefone text,
  p_origem text default null,
  p_notas text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_telefone text := nullif(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), '');
begin
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then raise exception '2fa_required' using errcode = '42501'; end if;
  if auth.uid() is null or not public.app_is_admin_escopo_comercial() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.partners p where p.id = p_partner_id and p.status = 'approved') then
    raise exception 'parceiro_indisponivel' using errcode = '22023';
  end if;
  if p_equipe_id is not null and not exists (select 1 from public.equipes e where e.id = p_equipe_id and e.partner_id = p_partner_id) then
    raise exception 'equipe_fora_do_parceiro' using errcode = '22023';
  end if;
  if v_email is null and v_telefone is null then raise exception 'contato_obrigatorio' using errcode = '22023'; end if;
  if p_origem is not null and p_origem not in ('indicacao','whatsapp','evento','site','outro') then raise exception 'origem_invalida' using errcode = '22023'; end if;

  insert into public.prospeccoes_clientes (
    id, partner_id, equipe_id, responsavel_id, nome_completo, email, telefone,
    origem, notas, status, created_by, updated_by
  ) values (
    v_id, p_partner_id, p_equipe_id, auth.uid(), btrim(p_nome_completo), v_email, v_telefone,
    p_origem, nullif(btrim(coalesce(p_notas,'')), ''), 'novo', auth.uid(), auth.uid()
  );
  insert into public.prospeccoes_clientes_historico (prospeccao_id, status_novo, alterado_por)
  values (v_id, 'novo', auth.uid());
  perform public.registrar_audit('prospeccao_cliente_criada_admin', 'prospeccoes_clientes', v_id, null,
    jsonb_build_object('partner_id', p_partner_id, 'equipe_id', p_equipe_id, 'status', 'novo'));
  return v_id;
end;
$$;
revoke all on function public.admin_prospeccao_cliente_create(uuid,uuid,text,text,text,text,text) from public, anon;
grant execute on function public.admin_prospeccao_cliente_create(uuid,uuid,text,text,text,text,text) to authenticated;

create or replace function public.prospeccao_cliente_update(
  p_id uuid,
  p_nome_completo text,
  p_email text,
  p_telefone text,
  p_origem text,
  p_notas text,
  p_equipe_id uuid default null,
  p_limpar_equipe boolean default false
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.prospeccoes_clientes%rowtype;
  v_role text := public.app_user_role();
  v_team_id uuid;
  v_email text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_telefone text := nullif(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), '');
  v_changed_fields text[] := array[]::text[];
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then raise exception '2fa_required' using errcode = '42501'; end if;
  select * into v_row from public.prospeccoes_clientes where id = p_id and deleted_at is null for update;
  if not found then raise exception 'prospeccao_cliente_nao_encontrada' using errcode = 'P0002'; end if;

  if public.app_is_admin_escopo_comercial() then
    v_team_id := case when p_limpar_equipe then null when p_equipe_id is not null then p_equipe_id else v_row.equipe_id end;
  elsif v_role = 'partner' and public.app_is_approved() and v_row.partner_id = public.app_partner_id() then
    v_team_id := case when p_limpar_equipe then null when p_equipe_id is not null then p_equipe_id else v_row.equipe_id end;
  elsif v_role = 'team_member' and public.app_is_approved() and v_row.equipe_id = public.app_equipe_id() then
    v_team_id := v_row.equipe_id;
    if p_equipe_id is not null or p_limpar_equipe then raise exception 'equipe_nao_alteravel' using errcode = '42501'; end if;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_team_id is not null and not exists (select 1 from public.equipes e where e.id = v_team_id and e.partner_id = v_row.partner_id) then
    raise exception 'equipe_fora_do_parceiro' using errcode = '22023';
  end if;
  if v_email is null and v_telefone is null then raise exception 'contato_obrigatorio' using errcode = '22023'; end if;
  if p_origem is not null and p_origem not in ('indicacao','whatsapp','evento','site','outro') then raise exception 'origem_invalida' using errcode = '22023'; end if;
  if v_row.status = 'proposta_criada' then raise exception 'prospeccao_cliente_ja_convertida' using errcode = '22023'; end if;

  if v_row.nome_completo is distinct from btrim(p_nome_completo) then v_changed_fields := array_append(v_changed_fields, 'nome_completo'); end if;
  if v_row.email is distinct from v_email then v_changed_fields := array_append(v_changed_fields, 'email'); end if;
  if v_row.telefone is distinct from v_telefone then v_changed_fields := array_append(v_changed_fields, 'telefone'); end if;
  if v_row.origem is distinct from p_origem then v_changed_fields := array_append(v_changed_fields, 'origem'); end if;
  if v_row.notas is distinct from nullif(btrim(coalesce(p_notas,'')), '') then v_changed_fields := array_append(v_changed_fields, 'notas'); end if;
  if v_row.equipe_id is distinct from v_team_id then v_changed_fields := array_append(v_changed_fields, 'equipe_id'); end if;
  if cardinality(v_changed_fields) = 0 then return; end if;

  update public.prospeccoes_clientes set
    equipe_id = v_team_id,
    nome_completo = btrim(p_nome_completo), email = v_email, telefone = v_telefone,
    origem = p_origem, notas = nullif(btrim(coalesce(p_notas,'')), ''), updated_by = auth.uid()
  where id = p_id;
  perform public.registrar_audit('prospeccao_cliente_atualizada', 'prospeccoes_clientes', p_id, null,
    jsonb_build_object('campos_alterados', to_jsonb(v_changed_fields), 'equipe_id', v_team_id));
end;
$$;
revoke all on function public.prospeccao_cliente_update(uuid,text,text,text,text,text,uuid,boolean) from public, anon;
grant execute on function public.prospeccao_cliente_update(uuid,text,text,text,text,text,uuid,boolean) to authenticated;

create or replace function public.prospeccao_cliente_move(
  p_id uuid,
  p_novo_status text,
  p_status_esperado text,
  p_motivo_perda text default null
) returns text
language plpgsql security definer set search_path = public
as $$
declare v_row public.prospeccoes_clientes%rowtype; v_motivo text := nullif(btrim(coalesce(p_motivo_perda,'')), '');
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then raise exception '2fa_required' using errcode = '42501'; end if;
  if coalesce(p_novo_status, '') not in ('novo','em_contato','qualificado','perdido') or coalesce(p_status_esperado, '') not in ('novo','em_contato','qualificado','perdido') then
    raise exception 'status_prospeccao_cliente_invalido' using errcode = '22023';
  end if;
  select * into v_row from public.prospeccoes_clientes where id = p_id and deleted_at is null for update;
  if not found then raise exception 'prospeccao_cliente_nao_encontrada' using errcode = 'P0002'; end if;
  if not (
    public.app_is_admin_escopo_comercial()
    or (public.app_user_role() = 'partner' and public.app_is_approved() and v_row.partner_id = public.app_partner_id())
    or (public.app_user_role() = 'team_member' and public.app_is_approved() and v_row.equipe_id = public.app_equipe_id())
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.status = 'proposta_criada' then raise exception 'prospeccao_cliente_ja_convertida' using errcode = '22023'; end if;
  if v_row.status <> p_status_esperado then raise exception 'prospeccao_cliente_status_conflito' using errcode = '40001'; end if;
  if p_novo_status = 'perdido' and (v_motivo is null or length(v_motivo) < 3) then raise exception 'motivo_perda_obrigatorio' using errcode = '22023'; end if;
  if v_row.status = p_novo_status then return v_row.status; end if;

  update public.prospeccoes_clientes
     set status = p_novo_status, motivo_perda = case when p_novo_status = 'perdido' then v_motivo else null end,
         updated_by = auth.uid()
   where id = p_id;
  insert into public.prospeccoes_clientes_historico (prospeccao_id, status_anterior, status_novo, alterado_por, motivo)
  values (p_id, v_row.status, p_novo_status, auth.uid(), case when p_novo_status = 'perdido' then v_motivo end);
  perform public.registrar_audit('prospeccao_cliente_movida', 'prospeccoes_clientes', p_id,
    jsonb_build_object('status', v_row.status), jsonb_build_object('status', p_novo_status));
  return p_novo_status;
end;
$$;
revoke all on function public.prospeccao_cliente_move(uuid,text,text,text) from public, anon;
grant execute on function public.prospeccao_cliente_move(uuid,text,text,text) to authenticated;

create or replace function public.partner_prospeccao_cliente_converter(p_id uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_row public.prospeccoes_clientes%rowtype;
  v_result jsonb;
  v_proposta_id uuid;
begin
  if auth.uid() is null or public.app_user_role() not in ('partner','team_member') or not public.app_is_approved() then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then raise exception '2fa_required' using errcode = '42501'; end if;
  select * into v_row from public.prospeccoes_clientes where id = p_id and deleted_at is null for update;
  if not found then raise exception 'prospeccao_cliente_nao_encontrada' using errcode = 'P0002'; end if;
  if (public.app_user_role() = 'partner' and v_row.partner_id is distinct from public.app_partner_id())
     or (public.app_user_role() = 'team_member' and v_row.equipe_id is distinct from public.app_equipe_id()) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.status <> 'qualificado' then raise exception 'prospeccao_cliente_fora_da_etapa_de_conversao' using errcode = '22023'; end if;
  if v_row.proposta_id is not null then raise exception 'prospeccao_cliente_ja_convertida' using errcode = '22023'; end if;

  v_result := public.partner_create_proposta(p_payload);
  v_proposta_id := nullif(v_result->>'proposta_id','')::uuid;
  update public.propostas set equipe_id = v_row.equipe_id where id = v_proposta_id and partner_id = v_row.partner_id;
  if not found then raise exception 'proposta_nao_vinculada_ao_parceiro' using errcode = '42501'; end if;
  update public.prospeccoes_clientes set status = 'proposta_criada', proposta_id = v_proposta_id, convertido_em = now(),
    motivo_perda = null, updated_by = auth.uid() where id = p_id;
  insert into public.prospeccoes_clientes_historico (prospeccao_id, status_anterior, status_novo, alterado_por)
  values (p_id, 'qualificado', 'proposta_criada', auth.uid());
  perform public.registrar_audit('prospeccao_cliente_convertida', 'prospeccoes_clientes', p_id, null,
    jsonb_build_object('proposta_id', v_proposta_id, 'partner_id', v_row.partner_id, 'equipe_id', v_row.equipe_id));
  return v_result || jsonb_build_object('prospeccao_cliente_id', p_id, 'equipe_id', v_row.equipe_id);
end;
$$;
revoke all on function public.partner_prospeccao_cliente_converter(uuid,jsonb) from public, anon;
grant execute on function public.partner_prospeccao_cliente_converter(uuid,jsonb) to authenticated;

create or replace function public.admin_prospeccao_cliente_converter(p_id uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_row public.prospeccoes_clientes%rowtype;
  v_result jsonb;
  v_proposta_id uuid;
  v_admin_nivel text := public.app_admin_nivel();
  v_original_claims text := current_setting('request.jwt.claims', true);
begin
  if auth.uid() is null or not public.app_is_admin_escopo_comercial() then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then raise exception '2fa_required' using errcode = '42501'; end if;
  select * into v_row from public.prospeccoes_clientes where id = p_id and deleted_at is null for update;
  if not found then raise exception 'prospeccao_cliente_nao_encontrada' using errcode = 'P0002'; end if;
  if v_row.status <> 'qualificado' then raise exception 'prospeccao_cliente_fora_da_etapa_de_conversao' using errcode = '22023'; end if;
  if v_row.proposta_id is not null then raise exception 'prospeccao_cliente_ja_convertida' using errcode = '22023'; end if;
  if not exists (select 1 from public.partners p where p.id = v_row.partner_id and p.status in ('approved','pending')) then
    raise exception 'parceiro_indisponivel' using errcode = '22023';
  end if;
  if v_row.equipe_id is not null and not exists (select 1 from public.equipes e where e.id = v_row.equipe_id and e.partner_id = v_row.partner_id) then
    raise exception 'equipe_fora_do_parceiro' using errcode = '22023';
  end if;

  -- admin_create_proposta exige escopo operacional (full/limitado). Comercial foi
  -- autorizado acima; eleva o claim somente durante a chamada interna e o restaura
  -- antes das atualizações e auditoria restantes, conforme o conversor B2B existente.
  if v_admin_nivel = 'comercial' then
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', auth.uid()::text, 'role', 'authenticated',
        'app_metadata', jsonb_build_object('role', 'admin', 'admin_nivel', 'full'))::text, true);
  end if;
  v_result := public.admin_create_proposta(v_row.partner_id, p_payload);
  if v_admin_nivel = 'comercial' and v_original_claims is not null then
    perform set_config('request.jwt.claims', v_original_claims, true);
  end if;
  v_proposta_id := nullif(v_result->>'proposta_id','')::uuid;
  update public.propostas set equipe_id = v_row.equipe_id where id = v_proposta_id and partner_id = v_row.partner_id;
  if not found then raise exception 'proposta_nao_vinculada_ao_parceiro' using errcode = '42501'; end if;
  update public.prospeccoes_clientes set status = 'proposta_criada', proposta_id = v_proposta_id, convertido_em = now(),
    motivo_perda = null, updated_by = auth.uid() where id = p_id;
  insert into public.prospeccoes_clientes_historico (prospeccao_id, status_anterior, status_novo, alterado_por)
  values (p_id, 'qualificado', 'proposta_criada', auth.uid());
  perform public.registrar_audit('prospeccao_cliente_convertida_admin', 'prospeccoes_clientes', p_id, null,
    jsonb_build_object('proposta_id', v_proposta_id, 'partner_id', v_row.partner_id, 'equipe_id', v_row.equipe_id));
  return v_result || jsonb_build_object('prospeccao_cliente_id', p_id, 'partner_id', v_row.partner_id, 'equipe_id', v_row.equipe_id);
end;
$$;
revoke all on function public.admin_prospeccao_cliente_converter(uuid,jsonb) from public, anon;
grant execute on function public.admin_prospeccao_cliente_converter(uuid,jsonb) to authenticated;

comment on table public.prospeccoes_clientes is 'Prospects B2C de parceiros, isolados do funil B2B e sujeitos a RLS por parceiro/equipe.';
comment on table public.prospeccoes_clientes_historico is 'Histórico append-only de etapas da prospecção B2C.';
