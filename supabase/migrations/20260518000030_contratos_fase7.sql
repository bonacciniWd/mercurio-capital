-- =============================================
-- MIGRATION 030 — FASE 7: Contratos, Liberação, Comissões, Financeiro
-- =============================================
-- Tabelas base já existem em 20260513000004_operacoes.sql (contratos,
-- assinaturas_contrato, liberacoes_recurso, comissoes). Esta migration
-- acrescenta colunas, RPCs, triggers, view, buckets e inbox webhooks.
-- =============================================

-- ---------------------------------------------
-- 1) AJUSTES DE SCHEMA
-- ---------------------------------------------

-- contratos: versão e corpo HTML (template renderizado)
alter table contratos
  add column if not exists versao int not null default 1,
  add column if not exists corpo_html text;

-- assinaturas_contrato: ordem e link individual
alter table assinaturas_contrato
  add column if not exists ordem int not null default 1,
  add column if not exists provider_request_signature_key text;

-- liberacoes_recurso: created_by + observação
alter table liberacoes_recurso
  add column if not exists criado_por uuid references usuarios(id) on delete set null,
  add column if not exists observacao text;

-- comissoes: paga_em já existe; adicionar aprovada_em e observacao
alter table comissoes
  add column if not exists aprovada_em timestamptz,
  add column if not exists liberacao_id uuid references liberacoes_recurso(id) on delete set null,
  add column if not exists observacao text;

-- ---------------------------------------------
-- 2) INBOX CLICKSIGN (idempotência)
-- ---------------------------------------------

create table if not exists clicksign_webhooks_inbox (
  id            text primary key,        -- event_id da Clicksign (uuid)
  tipo          text not null,
  recebido_em   timestamptz not null default now(),
  processado_em timestamptz,
  payload       jsonb not null
);

alter table clicksign_webhooks_inbox enable row level security;
drop policy if exists "somente_service_role_clicksign" on clicksign_webhooks_inbox;
create policy "somente_service_role_clicksign" on clicksign_webhooks_inbox
  for all using (false);

-- ---------------------------------------------
-- 3) AJUSTE DO TRIGGER DE TRANSIÇÃO DE STATUS
-- Permite:
--   * service_role / contexto sem auth (auth.uid is null) → qualquer transição
--     (RPCs SECURITY DEFINER chamadas por webhooks / edges usam esse caminho)
--   * partner: emissao_contrato → aguardando_assinatura (gera contrato)
-- ---------------------------------------------

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

  -- contexto sem usuário autenticado (service_role / SECURITY DEFINER de webhook)
  if auth.uid() is null then
    return new;
  end if;

  -- 2FA requirement
  if public.app_requires_2fa() and not public.app_has_verified_2fa() then
    raise exception '2fa_required';
  end if;

  if v_role = 'admin' then
    return new;
  end if;

  if v_role = 'partner' then
    if (old.status = 'proposta_cliente' and new.status = 'resolucao_pendencias')
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

-- ---------------------------------------------
-- 4) RPC: contrato_gerar
-- Partner ou admin gera contrato (insere linha + assinaturas).
-- Move proposta para aguardando_assinatura.
-- ---------------------------------------------

create or replace function public.contrato_gerar(
  p_proposta_id uuid,
  p_pdf_path    text,
  p_corpo_html  text,
  p_signatarios jsonb            -- [{nome, email, cpf, papel, ordem?}]
)
returns contratos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text := public.app_user_role();
  v_proposta propostas%rowtype;
  v_contrato contratos%rowtype;
  v_versao   int;
  v_sig      jsonb;
  v_idx      int := 1;
begin
  if v_role not in ('partner','admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_proposta from propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_nao_encontrada';
  end if;

  if v_role = 'partner' and v_proposta.partner_id <> public.app_partner_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_proposta.status <> 'emissao_contrato' then
    raise exception 'status_invalido' using detail =
      format('proposta deve estar em emissao_contrato (atual: %s)', v_proposta.status);
  end if;

  if p_signatarios is null or jsonb_typeof(p_signatarios) <> 'array' or jsonb_array_length(p_signatarios) = 0 then
    raise exception 'signatarios_invalidos';
  end if;

  -- versão = (último versionado da proposta) + 1
  select coalesce(max(versao), 0) + 1 into v_versao
    from contratos where proposta_id = p_proposta_id;

  -- contratos é único por proposta_id; se já existir, atualiza
  insert into contratos (
    proposta_id, pdf_storage_path, corpo_html, versao,
    gerado_por, gerado_em
  ) values (
    p_proposta_id, p_pdf_path, p_corpo_html, v_versao,
    auth.uid(), now()
  )
  on conflict (proposta_id) do update set
    pdf_storage_path = excluded.pdf_storage_path,
    corpo_html       = excluded.corpo_html,
    versao           = excluded.versao,
    gerado_por       = excluded.gerado_por,
    gerado_em        = excluded.gerado_em,
    provedor_assinatura = null,
    provider_envelope_id = null,
    assinado_em      = null,
    registrado_em    = null,
    updated_at       = now()
  returning * into v_contrato;

  -- limpa assinaturas antigas se for re-geração
  delete from assinaturas_contrato where contrato_id = v_contrato.id;

  for v_sig in select * from jsonb_array_elements(p_signatarios)
  loop
    insert into assinaturas_contrato (
      contrato_id, signatario_nome, signatario_email,
      signatario_cpf_cnpj, papel, ordem
    ) values (
      v_contrato.id,
      coalesce(v_sig->>'nome', 'Signatário'),
      coalesce(v_sig->>'email', ''),
      v_sig->>'cpf',
      coalesce(v_sig->>'papel', 'tomador'),
      coalesce((v_sig->>'ordem')::int, v_idx)
    );
    v_idx := v_idx + 1;
  end loop;

  -- move proposta para aguardando_assinatura
  update propostas set status = 'aguardando_assinatura', updated_at = now()
   where id = p_proposta_id;

  return v_contrato;
end;
$$;

revoke all on function public.contrato_gerar(uuid, text, text, jsonb) from public;
grant execute on function public.contrato_gerar(uuid, text, text, jsonb) to authenticated;

-- ---------------------------------------------
-- 5) RPC: contrato_marcar_assinado (webhook clicksign)
-- ---------------------------------------------

create or replace function public.contrato_marcar_assinado(
  p_contrato_id uuid,
  p_envelope_id text,
  p_provedor    text default 'clicksign'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposta_id uuid;
begin
  update contratos
     set assinado_em = coalesce(assinado_em, now()),
         provider_envelope_id = coalesce(p_envelope_id, provider_envelope_id),
         provedor_assinatura = coalesce(provedor_assinatura, p_provedor),
         updated_at = now()
   where id = p_contrato_id
   returning proposta_id into v_proposta_id;

  if v_proposta_id is null then
    raise exception 'contrato_nao_encontrado';
  end if;

  update assinaturas_contrato
     set status = 'assinado',
         assinado_em = coalesce(assinado_em, now())
   where contrato_id = p_contrato_id and status <> 'rejeitado';

  update propostas
     set status = 'em_registro', updated_at = now()
   where id = v_proposta_id and status = 'aguardando_assinatura';
end;
$$;

grant execute on function public.contrato_marcar_assinado(uuid, text, text) to authenticated;

-- ---------------------------------------------
-- 6) RPC: contrato_enviar_marcacao (chamada pela edge contrato-enviar-assinatura)
-- Apenas atualiza provedor + envelope_id após upload na Clicksign.
-- ---------------------------------------------

create or replace function public.contrato_marcar_enviado(
  p_contrato_id uuid,
  p_envelope_id text,
  p_provedor    text default 'clicksign'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update contratos
     set provedor_assinatura = p_provedor,
         provider_envelope_id = p_envelope_id,
         updated_at = now()
   where id = p_contrato_id;
end;
$$;

grant execute on function public.contrato_marcar_enviado(uuid, text, text) to authenticated;

-- ---------------------------------------------
-- 7) RPC: contrato_registrar (admin)
-- ---------------------------------------------

create or replace function public.contrato_registrar(
  p_contrato_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposta_id uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update contratos
     set registrado_em = coalesce(registrado_em, now()),
         updated_at = now()
   where id = p_contrato_id
   returning proposta_id into v_proposta_id;

  if v_proposta_id is null then
    raise exception 'contrato_nao_encontrado';
  end if;

  update propostas
     set status = 'contrato_registrado', updated_at = now()
   where id = v_proposta_id;
end;
$$;

grant execute on function public.contrato_registrar(uuid) to authenticated;

-- ---------------------------------------------
-- 8) RPC: liberacao_registrar (admin)
-- ---------------------------------------------

create or replace function public.liberacao_registrar(
  p_proposta_id   uuid,
  p_valor         numeric,
  p_data          date,
  p_comprovante   text default null,
  p_observacao    text default null
)
returns liberacoes_recurso
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposta propostas%rowtype;
  v_lib      liberacoes_recurso%rowtype;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor_invalido';
  end if;

  select * into v_proposta from propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_nao_encontrada';
  end if;
  if v_proposta.status not in ('contrato_registrado','em_registro') then
    raise exception 'status_invalido' using detail =
      format('proposta deve estar em contrato_registrado (atual: %s)', v_proposta.status);
  end if;

  insert into liberacoes_recurso (
    proposta_id, valor_liberado, data_liberacao,
    comprovante_storage_path, criado_por, observacao
  ) values (
    p_proposta_id, p_valor, p_data, p_comprovante, auth.uid(), p_observacao
  ) returning * into v_lib;

  update propostas
     set status = 'recurso_liberado', updated_at = now()
   where id = p_proposta_id;

  return v_lib;
end;
$$;

grant execute on function public.liberacao_registrar(uuid, numeric, date, text, text) to authenticated;

-- ---------------------------------------------
-- 9) TRIGGER: cálculo automático de comissão ao liberar recurso
-- ---------------------------------------------

create or replace function public.fn_calcular_comissao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_percentual numeric(5,2);
  v_valor      numeric(14,2);
begin
  select partner_id into v_partner_id
    from propostas where id = new.proposta_id;

  if v_partner_id is null then
    return new;
  end if;

  select coalesce(comissao_percentual, 1.5) into v_percentual
    from partners where id = v_partner_id;

  if v_percentual is null or v_percentual <= 0 then
    v_percentual := 1.5;
  end if;

  v_valor := round(new.valor_liberado * v_percentual / 100, 2);

  insert into comissoes (
    proposta_id, partner_id, percentual, valor, status, liberacao_id
  ) values (
    new.proposta_id, v_partner_id, v_percentual, v_valor, 'prevista', new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_calcular_comissao on liberacoes_recurso;
create trigger trg_calcular_comissao
  after insert on liberacoes_recurso
  for each row execute function public.fn_calcular_comissao();

-- ---------------------------------------------
-- 10) RPCs: comissao_aprovar / comissao_marcar_paga (admin)
-- ---------------------------------------------

create or replace function public.comissao_aprovar(
  p_comissao_id uuid,
  p_observacao  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update comissoes
     set status = 'aprovada',
         aprovada_em = coalesce(aprovada_em, now()),
         observacao = coalesce(p_observacao, observacao)
   where id = p_comissao_id
     and status = 'prevista';
end;
$$;

create or replace function public.comissao_marcar_paga(
  p_comissao_id uuid,
  p_data        date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update comissoes
     set status = 'paga',
         paga_em = coalesce(p_data::timestamptz, now())
   where id = p_comissao_id
     and status in ('prevista','aprovada');
end;
$$;

grant execute on function public.comissao_aprovar(uuid, text) to authenticated;
grant execute on function public.comissao_marcar_paga(uuid, date) to authenticated;

-- ---------------------------------------------
-- 11) VIEW: v_financeiro_admin (KPIs do dashboard)
-- ---------------------------------------------

create or replace view public.v_financeiro_admin as
  with liberacoes_mes as (
    select date_trunc('month', data_liberacao)::date as mes,
           count(*)                        as qtd,
           coalesce(sum(valor_liberado),0) as volume
      from liberacoes_recurso
     group by 1
  ),
  comissoes_agg as (
    select status,
           count(*)              as qtd,
           coalesce(sum(valor),0) as total
      from comissoes
     group by status
  )
  select
    (select coalesce(sum(valor_liberado),0) from liberacoes_recurso
       where data_liberacao >= date_trunc('month', now()))    as volume_mes,
    (select coalesce(sum(valor_liberado),0) from liberacoes_recurso) as volume_total,
    (select coalesce(avg(valor_liberado),0) from liberacoes_recurso) as ticket_medio,
    (select count(*) from liberacoes_recurso)                 as liberacoes_total,
    (select coalesce(total,0) from comissoes_agg where status='prevista') as comissoes_previstas,
    (select coalesce(total,0) from comissoes_agg where status='aprovada') as comissoes_aprovadas,
    (select coalesce(total,0) from comissoes_agg where status='paga')     as comissoes_pagas,
    (select count(*) from comissoes where status='prevista')              as comissoes_qtd_prevista,
    (select json_agg(json_build_object(
       'mes', mes, 'qtd', qtd, 'volume', volume) order by mes desc)
       from (select * from liberacoes_mes order by mes desc limit 12) m) as historico_mensal;

-- view auxiliar: comissões com nome do parceiro
create or replace view public.v_comissoes_admin as
  select c.id, c.proposta_id, c.partner_id, c.percentual, c.valor,
         c.status, c.paga_em, c.aprovada_em, c.created_at,
         c.observacao,
         u.nome_completo as partner_nome,
         u.email         as partner_email,
         pr.protocolo
    from comissoes c
    join partners p on p.id = c.partner_id
    join usuarios u on u.id = p.usuario_id
    left join propostas pr on pr.id = c.proposta_id;

grant select on public.v_financeiro_admin to authenticated;
grant select on public.v_comissoes_admin to authenticated;

-- ---------------------------------------------
-- 12) NOTIFICAÇÕES: contrato assinado e recurso liberado
-- ---------------------------------------------

create or replace function public.fn_notifica_contrato_assinado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_partner_id uuid;
  v_proposta_id uuid := new.proposta_id;
  v_protocolo text;
begin
  if old.assinado_em is not null or new.assinado_em is null then
    return new;
  end if;

  select partner_id, protocolo into v_partner_id, v_protocolo
    from propostas where id = v_proposta_id;
  if v_partner_id is null then return new; end if;

  for v_user in
    select u.id from usuarios u
     where u.partner_id = v_partner_id
       and u.role in ('partner','team_member')
       and u.deleted_at is null
  loop
    insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
    values (v_user, 'in_app', 'Contrato assinado',
      format('O contrato da proposta %s foi assinado por todos os signatários.', coalesce(v_protocolo,'')),
      format('/p/propostas/%s', v_proposta_id),
      jsonb_build_object('contrato_id', new.id));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_contrato_assinado on contratos;
create trigger trg_notifica_contrato_assinado
  after update of assinado_em on contratos
  for each row execute function public.fn_notifica_contrato_assinado();

create or replace function public.fn_notifica_recurso_liberado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_partner_id uuid;
  v_protocolo text;
begin
  select partner_id, protocolo into v_partner_id, v_protocolo
    from propostas where id = new.proposta_id;
  if v_partner_id is null then return new; end if;

  for v_user in
    select u.id from usuarios u
     where u.partner_id = v_partner_id
       and u.role in ('partner','team_member')
       and u.deleted_at is null
  loop
    insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
    values (v_user, 'in_app', 'Recurso liberado',
      format('A liberação da proposta %s foi registrada — valor R$ %s.',
        coalesce(v_protocolo,''),
        to_char(new.valor_liberado, 'FM999G999G990D00')),
      format('/p/propostas/%s', new.proposta_id),
      jsonb_build_object('liberacao_id', new.id));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notifica_recurso_liberado on liberacoes_recurso;
create trigger trg_notifica_recurso_liberado
  after insert on liberacoes_recurso
  for each row execute function public.fn_notifica_recurso_liberado();

-- ---------------------------------------------
-- 13) STORAGE BUCKETS: contratos e comprovantes
-- ---------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contratos','contratos', false, 20 * 1024 * 1024,
  array['application/pdf','text/html','application/octet-stream']
) on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes','comprovantes', false, 20 * 1024 * 1024,
  array['application/pdf','image/png','image/jpeg','image/webp']
) on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- helper para checar acesso por proposta no path
create or replace function public.app_can_access_contrato_path(p_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.propostas p
     where p.id::text = split_part(p_name, '/', 1)
       and (
         public.app_is_admin()
         or p.partner_id = public.app_partner_id()
         or p.equipe_id  = public.app_equipe_id()
         or p.cliente_id in (select c.id from public.clientes c where c.usuario_id = auth.uid())
       )
  )
$$;

drop policy if exists "contratos_select" on storage.objects;
drop policy if exists "contratos_insert" on storage.objects;
drop policy if exists "contratos_admin_all" on storage.objects;

create policy "contratos_select"
  on storage.objects for select
  using (bucket_id = 'contratos'
    and (public.app_is_admin() or public.app_can_access_contrato_path(name)));

create policy "contratos_insert"
  on storage.objects for insert
  with check (bucket_id = 'contratos'
    and (public.app_is_admin() or public.app_can_access_contrato_path(name)));

create policy "contratos_admin_all"
  on storage.objects for update
  using (bucket_id = 'contratos' and public.app_is_admin())
  with check (bucket_id = 'contratos' and public.app_is_admin());

drop policy if exists "comprovantes_select" on storage.objects;
drop policy if exists "comprovantes_insert_admin" on storage.objects;
drop policy if exists "comprovantes_admin_all" on storage.objects;

create policy "comprovantes_select"
  on storage.objects for select
  using (bucket_id = 'comprovantes'
    and (public.app_is_admin() or public.app_can_access_contrato_path(name)));

create policy "comprovantes_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'comprovantes' and public.app_is_admin());

create policy "comprovantes_admin_all"
  on storage.objects for update
  using (bucket_id = 'comprovantes' and public.app_is_admin())
  with check (bucket_id = 'comprovantes' and public.app_is_admin());

-- ---------------------------------------------
-- 14) REALTIME (opcional): contratos
-- ---------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'contratos'
  ) then
    execute 'alter publication supabase_realtime add table contratos';
  end if;
exception when others then null;
end$$;

