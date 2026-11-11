-- Proposal-scoped instruction evidence for covered external checks.
-- Local additive migration: no production rollout is implied.

create table if not exists public.proposta_consulta_aceites (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  usuario_id uuid references public.usuarios(id) on delete restrict,
  magic_link_id uuid references public.magic_links(id) on delete restrict,
  origem text not null check (origem in ('portal_digital', 'atestado_controlador')),
  versao_texto text not null,
  texto_exibido text not null,
  escopos text[] not null,
  aceito_em timestamptz,
  registrado_em timestamptz not null default now(),
  registrado_por uuid not null references public.usuarios(id) on delete restrict,
  atestado_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid references public.usuarios(id) on delete set null,
  constraint proposta_consulta_aceites_escopos_nao_vazios check (cardinality(escopos) > 0),
  constraint proposta_consulta_aceites_origem_campos_check check (
    (origem = 'portal_digital' and usuario_id is not null and magic_link_id is not null
      and aceito_em is not null and atestado_em is null)
    or (origem = 'atestado_controlador' and magic_link_id is null
      and aceito_em is null and atestado_em is not null)
  )
);

create index if not exists proposta_consulta_aceites_proposta_ativo_idx
  on public.proposta_consulta_aceites (proposta_id, registrado_em desc)
  where revogado_em is null;
create unique index if not exists proposta_consulta_aceites_magic_link_uidx
  on public.proposta_consulta_aceites (magic_link_id)
  where magic_link_id is not null;
drop index if exists public.proposta_consulta_aceites_versao_ativa_uidx;
create unique index if not exists proposta_consulta_aceites_versao_ativa_uidx
  on public.proposta_consulta_aceites (proposta_id, cliente_id, versao_texto, origem)
  where revogado_em is null;

alter table public.proposta_consulta_aceites enable row level security;
drop policy if exists proposta_consulta_aceites_le_escopo on public.proposta_consulta_aceites;
create policy proposta_consulta_aceites_le_escopo
  on public.proposta_consulta_aceites for select
  using (
    public.app_is_admin()
    or usuario_id = auth.uid()
    or exists (
      select 1 from public.propostas p
       where p.id = proposta_id
         and (p.partner_id = public.app_partner_id()
              or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id()))
    )
  );
revoke all on public.proposta_consulta_aceites from public, anon, authenticated;
grant select on public.proposta_consulta_aceites to authenticated;

alter table public.consulta_autorizacoes
  alter column documento_evidencia_id drop not null,
  add column if not exists aceite_consulta_id uuid references public.proposta_consulta_aceites(id) on delete restrict;

alter table public.consulta_autorizacoes
  drop constraint if exists consulta_autorizacoes_origem_check;
alter table public.consulta_autorizacoes
  add constraint consulta_autorizacoes_origem_check
  check ((documento_evidencia_id is not null) <> (aceite_consulta_id is not null));

alter table public.consulta_autorizacoes alter column base_legal drop not null;
alter table public.consulta_autorizacoes
  drop constraint if exists consulta_autorizacoes_base_legal_check;
alter table public.consulta_autorizacoes
  add constraint consulta_autorizacoes_base_legal_check
  check (base_legal is null or base_legal in ('procedimentos_preliminares_contrato', 'protecao_do_credito'));
alter table public.consulta_autorizacoes
  drop constraint if exists consulta_autorizacoes_digital_sem_base_legal_check;
alter table public.consulta_autorizacoes
  add constraint consulta_autorizacoes_digital_sem_base_legal_check
  check ((aceite_consulta_id is null and base_legal is not null)
      or (aceite_consulta_id is not null and base_legal is null));

alter table public.logs_consultas
  add column if not exists aceite_consulta_id uuid references public.proposta_consulta_aceites(id) on delete restrict;

-- This RPC is intentionally service-role only. It revalidates the consumed,
-- proposal-scoped activation link and the client-to-auth-user binding.
create or replace function public.cliente_consulta_aceite_registrar(
  p_proposta_id uuid,
  p_cliente_id uuid,
  p_usuario_id uuid,
  p_magic_link_id uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_text text := 'Confirmo que solicitei a análise desta proposta e instruo a Mercúrio Capital a encaminhar, para essa finalidade, os dados informados dos proponentes e dos imóveis vinculados a ela aos serviços de crédito, cadastro e registros imobiliários que estejam integrados e habilitados. A consulta efetiva depende da disponibilidade do serviço e das validações aplicáveis. O aceite é registrado em meu nome como cliente principal e não representa aceite individual dos demais proponentes. Novos provedores ou finalidades fora dessas categorias exigirão atualização das informações e do escopo.';
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.propostas p
    join public.clientes c on c.id = p.cliente_id
    join public.usuarios u on u.id = c.usuario_id and u.role = 'client'
    join public.magic_links m on m.id = p_magic_link_id
    where p.id = p_proposta_id and p.cliente_id = p_cliente_id
      and c.usuario_id = p_usuario_id
      and m.finalidade = 'cliente_ativacao' and m.used_at is not null
      and m.payload->>'proposta_id' = p_proposta_id::text
      and m.payload->>'cliente_id' = p_cliente_id::text
  ) then raise exception 'aceite_titular_link_ou_proposta_invalido'; end if;

  select a.id into v_id from public.proposta_consulta_aceites a
   where a.magic_link_id = p_magic_link_id;
  if found then
    if not exists (select 1 from public.proposta_consulta_aceites a
      where a.id = v_id and a.proposta_id = p_proposta_id and a.cliente_id = p_cliente_id and a.usuario_id = p_usuario_id) then
      raise exception 'chave_aceite_reutilizada_com_escopo_diferente';
    end if;
    return v_id;
  end if;

  select a.id into v_id from public.proposta_consulta_aceites a
   where a.proposta_id = p_proposta_id and a.cliente_id = p_cliente_id
     and a.versao_texto = '2026-10-v1' and a.origem = 'portal_digital'
     and a.revogado_em is null
   order by a.registrado_em desc limit 1;
  if found then return v_id; end if;

  insert into public.proposta_consulta_aceites (
    proposta_id, cliente_id, usuario_id, magic_link_id, origem, versao_texto,
    texto_exibido, escopos, aceito_em, registrado_por
  ) values (
    p_proposta_id, p_cliente_id, p_usuario_id, p_magic_link_id, 'portal_digital',
    '2026-10-v1', v_text, array['serasa_pf','serasa_pj','bacen_cpf','bacen_cnpj']::text[],
    now(), p_usuario_id
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.cliente_consulta_aceite_registrar(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cliente_consulta_aceite_registrar(uuid, uuid, uuid, uuid) to service_role;

create or replace function public.consulta_autorizacao_registrar_aceite_consulta(
  p_proposta_id uuid,
  p_tipo public.tipo_consulta,
  p_aceite_consulta_id uuid,
  p_chave_registro uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_existing public.consulta_autorizacoes%rowtype;
begin
  if p_tipo not in ('serasa_pf', 'serasa_pj') then raise exception 'tipo_consulta_invalido'; end if;
  if not exists (
    select 1 from public.propostas p where p.id = p_proposta_id and (
      public.app_is_admin() or p.partner_id = public.app_partner_id()
      or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id())
    )
  ) then raise exception 'proposta_nao_encontrada_ou_sem_acesso'; end if;
  if not exists (
    select 1 from public.proposta_consulta_aceites a
    join public.propostas p on p.id = a.proposta_id
    join public.clientes c on c.id = a.cliente_id and c.id = p.cliente_id
    where a.id = p_aceite_consulta_id and a.proposta_id = p_proposta_id
      and a.revogado_em is null and a.escopos @> array[p_tipo::text]
      and ((p_tipo = 'serasa_pf' and c.pessoa_tipo = 'PF' and length(regexp_replace(coalesce(c.cpf,''), '\D','','g')) = 11)
        or (p_tipo = 'serasa_pj' and c.pessoa_tipo = 'PJ' and length(regexp_replace(coalesce(c.cnpj,''), '\D','','g')) = 14))
  ) then raise exception 'aceite_digital_ausente_ou_escopo_invalido'; end if;

  select * into v_existing from public.consulta_autorizacoes a
   where a.registrado_por = auth.uid() and a.chave_registro = p_chave_registro;
  if found then
    if v_existing.proposta_id <> p_proposta_id or v_existing.tipo <> p_tipo
       or v_existing.aceite_consulta_id <> p_aceite_consulta_id then
      raise exception 'chave_autorizacao_reutilizada_com_escopo_diferente';
    end if;
    return v_existing.id;
  end if;
  insert into public.consulta_autorizacoes
    (proposta_id, tipo, aceite_consulta_id, chave_registro, base_legal, registrado_por)
  values
    (p_proposta_id, p_tipo, p_aceite_consulta_id, p_chave_registro,
     null, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.consulta_autorizacao_registrar_aceite_consulta(uuid, public.tipo_consulta, uuid, uuid) from public, anon;
grant execute on function public.consulta_autorizacao_registrar_aceite_consulta(uuid, public.tipo_consulta, uuid, uuid) to authenticated;

-- A retroactive backfill is an admin action with explicit, auditable provenance.
-- It never records a client click or invents the date of the earlier acceptance.
create or replace function public.admin_proposta_consulta_aceites_atestar_retroativo()
returns table (
  propostas_elegiveis bigint,
  inseridos bigint,
  ja_registrados bigint,
  excluidos_simulacao bigint,
  excluidos_cancelados bigint,
  sem_cliente bigint
)
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_total bigint;
  v_inserted bigint;
  v_simulation bigint;
  v_cancelled bigint;
  v_no_client bigint;
  v_existing bigint;
  v_now timestamptz := now();
  v_version text := '2026-10-retro-v1';
  v_text text := 'Atestado retrospectivo do controlador: segundo a confirmação do controlador, o cliente principal já havia aceitado o uso dos dados desta proposta para as categorias de consulta listadas, mas o evento original não foi persistido. Este registro documenta o atestado atual; não comprova clique digital nem informa a data original do aceite.';
begin
  if v_admin is null or not public.app_is_admin() then
    raise exception 'admin_obrigatorio' using errcode = '42501';
  end if;

  select count(*) into v_total from public.propostas p
   where p.cliente_id is not null and p.status not in ('simulacao', 'cancelado');
  select count(*) into v_simulation from public.propostas p where p.status = 'simulacao';
  select count(*) into v_cancelled from public.propostas p where p.status = 'cancelado';
  select count(*) into v_no_client from public.propostas p
   where p.status not in ('simulacao', 'cancelado') and p.cliente_id is null;

  with eligible as materialized (
    select p.id as proposta_id, p.cliente_id, c.usuario_id
      from public.propostas p
      join public.clientes c on c.id = p.cliente_id
     where p.status not in ('simulacao', 'cancelado')
  ), inserted as (
    insert into public.proposta_consulta_aceites (
      proposta_id, cliente_id, usuario_id, magic_link_id, origem,
      versao_texto, texto_exibido, escopos, aceito_em, registrado_em,
      registrado_por, atestado_em
    )
    select e.proposta_id, e.cliente_id, e.usuario_id, null, 'atestado_controlador',
      v_version, v_text,
      array['serasa_pf','serasa_pj','bacen_cpf','bacen_cnpj']::text[],
      null, v_now, v_admin, v_now
    from eligible e
    where not exists (
      select 1 from public.proposta_consulta_aceites a
       where a.proposta_id = e.proposta_id and a.cliente_id = e.cliente_id
         and a.revogado_em is null
    )
    on conflict (proposta_id, cliente_id, versao_texto, origem)
      where revogado_em is null do nothing
    returning id, proposta_id, cliente_id, versao_texto, escopos, registrado_em
  ), audited as (
    insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
    select v_admin, 'proposta_consulta_aceite_atestado_retroativo',
      'proposta_consulta_aceites', i.id,
      jsonb_build_object(
        'proposta_id', i.proposta_id,
        'cliente_id', i.cliente_id,
        'origem', 'atestado_controlador',
        'versao_texto', i.versao_texto,
        'escopos', i.escopos,
        'registrado_em', i.registrado_em,
        'aceito_em_original', null
      )
    from inserted i
    returning id
  )
  select count(*) into v_inserted from inserted;

  v_existing := greatest(v_total - v_inserted, 0);
  propostas_elegiveis := v_total;
  inseridos := v_inserted;
  ja_registrados := v_existing;
  excluidos_simulacao := v_simulation;
  excluidos_cancelados := v_cancelled;
  sem_cliente := v_no_client;
  return next;
end;
$$;
revoke all on function public.admin_proposta_consulta_aceites_atestar_retroativo() from public, anon;
grant execute on function public.admin_proposta_consulta_aceites_atestar_retroativo() to authenticated;

-- Keep legacy document-backed authorizations intact while accepting a valid
-- proposal-scoped digital receipt as the alternative evidence source.
create or replace function public.consulta_iniciar_serasa(
  p_proposta_id uuid,
  p_tipo public.tipo_consulta,
  p_chave_idempotencia uuid,
  p_autorizacao_id uuid,
  p_ambiente text
)
returns table (log_id uuid, ledger_id uuid, preco_centavos bigint, status text, reutilizada boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_partner_id uuid;
  v_preco bigint;
  v_actor uuid := auth.uid();
  v_ledger public.wallet_ledger%rowtype;
  v_log public.logs_consultas%rowtype;
  v_existing public.logs_consultas%rowtype;
  v_report text;
  v_aceite_id uuid;
begin
  if v_actor is null then raise exception 'unauthorized'; end if;
  if p_tipo not in ('serasa_pf', 'serasa_pj') then raise exception 'tipo_consulta_invalido'; end if;
  if p_ambiente not in ('uat', 'producao') then raise exception 'ambiente_invalido'; end if;

  select l.* into v_existing from public.logs_consultas l
   where l.iniciado_por = v_actor and l.chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_existing.proposta_id <> p_proposta_id or v_existing.tipo <> p_tipo
       or v_existing.autorizacao_id <> p_autorizacao_id or v_existing.ambiente <> p_ambiente then
      raise exception 'chave_idempotencia_reutilizada_com_escopo_diferente';
    end if;
    log_id := v_existing.id; ledger_id := v_existing.ledger_debito_id;
    preco_centavos := v_existing.preco_centavos; status := v_existing.status; reutilizada := true;
    return next; return;
  end if;

  select p.partner_id into v_partner_id from public.propostas p
   where p.id = p_proposta_id and (
     public.app_is_admin() or p.partner_id = public.app_partner_id()
     or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id())
   );
  if v_partner_id is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso'; end if;

  select case when p_tipo = 'serasa_pf' then c.report_pf else c.report_pj end
    into v_report from public.serasa_relatorios_config c where c.ambiente = p_ambiente and c.ativo;
  if v_report is null then raise exception 'serasa_relatorio_desativado'; end if;
  if p_tipo = 'serasa_pj' and not exists (
    select 1 from public.serasa_relatorios_config c
     where c.ambiente = p_ambiente and c.parametros_pj is not null
       and case when jsonb_typeof(c.parametros_pj->'reportParameters') = 'array'
         then jsonb_array_length(c.parametros_pj->'reportParameters') = 1 else false end
       and c.parametros_pj->'reportParameters'->0->>'name' = 'segmentCode'
       and c.parametros_pj->'reportParameters'->0->>'value' ~ '^[0-9]{3}$'
  ) then raise exception 'serasa_parametros_pj_pendentes'; end if;
  if not exists (select 1 from public.integracoes_config i where i.chave = 'serasa' and i.ativo) then
    raise exception 'serasa_integracao_desativada';
  end if;

  select a.aceite_consulta_id into v_aceite_id
    from public.consulta_autorizacoes a
    join public.propostas p on p.id = a.proposta_id
    join public.clientes c on c.id = p.cliente_id
   where a.id = p_autorizacao_id and a.proposta_id = p_proposta_id and a.tipo = p_tipo
     and a.revogado_em is null
     and ((a.documento_evidencia_id is not null and exists (
       select 1 from public.proposta_documentos d where d.id = a.documento_evidencia_id
        and d.proposta_id = p_proposta_id and d.status = 'aprovado'
        and d.validado is true and d.storage_path is not null
     )) or (a.aceite_consulta_id is not null and exists (
       select 1 from public.proposta_consulta_aceites ca where ca.id = a.aceite_consulta_id
        and ca.proposta_id = p_proposta_id and ca.revogado_em is null
        and ca.escopos @> array[p_tipo::text]
     )))
     and ((p_tipo = 'serasa_pf' and c.pessoa_tipo = 'PF' and length(regexp_replace(coalesce(c.cpf,''), '\D','','g')) = 11)
       or (p_tipo = 'serasa_pj' and c.pessoa_tipo = 'PJ' and length(regexp_replace(coalesce(c.cnpj,''), '\D','','g')) = 14));
  if not found then raise exception 'autorizacao_documento_ou_titular_invalido'; end if;

  select pc.preco_centavos into v_preco from public.precos_consulta pc
   where pc.tipo = p_tipo and pc.vigente_ate is null;
  if v_preco is null then raise exception 'preco_nao_configurado'; end if;
  v_ledger := public.wallet_debit(
    p_partner => v_partner_id, p_tipo => 'debito_consulta', p_valor => v_preco,
    p_ref_tipo => 'consulta', p_ref_id => p_proposta_id, p_correlation => p_chave_idempotencia,
    p_descricao => format('Relatório Serasa %s · proposta %s', p_tipo, p_proposta_id),
    p_metadata => jsonb_build_object('tipo_consulta', p_tipo, 'ambiente', p_ambiente, 'chave_idempotencia', p_chave_idempotencia)
  );
  insert into public.logs_consultas (
    proposta_id, partner_id, tipo, status, preco_centavos, ledger_debito_id,
    provedor, request, iniciado_por, chave_idempotencia, ambiente, produto_relatorio,
    versao_normalizador, autorizacao_id, aceite_consulta_id
  ) values (
    p_proposta_id, v_partner_id, p_tipo, 'em_andamento', v_preco, v_ledger.id,
    'serasa_experian', '{}'::jsonb, v_actor, p_chave_idempotencia, p_ambiente, v_report,
    (select c.versao_normalizador from public.serasa_relatorios_config c where c.ambiente = p_ambiente),
    p_autorizacao_id, v_aceite_id
  ) returning * into v_log;
  log_id := v_log.id; ledger_id := v_ledger.id; preco_centavos := v_preco;
  status := v_log.status; reutilizada := false; return next;
end;
$$;

-- The generic query entry point currently has real Bacen only when explicitly
-- configured; deterministic mock providers are rejected before wallet debit.
create or replace function public.consulta_iniciar(
  p_proposta_id uuid,
  p_tipo public.tipo_consulta,
  p_provedor text default null,
  p_request jsonb default '{}'
)
returns table (log_id uuid, ledger_id uuid, preco_centavos bigint)
language plpgsql security definer set search_path = public
as $$
declare
  v_partner_id uuid;
  v_preco bigint;
  v_role text := public.app_user_role();
  v_actor uuid := auth.uid();
  v_ledger public.wallet_ledger%rowtype;
  v_log_id uuid;
  v_aceite_id uuid;
begin
  if p_tipo in ('jusbrasil_cnpj','escavador_cnpj','ri_digital_matricula','nacional_consultas_bens','nacional_consultas_certidao') then
    raise exception 'provedor_mock_indisponivel';
  end if;
  if p_tipo not in ('bacen_cpf','bacen_cnpj') then raise exception 'tipo_consulta_invalido'; end if;
  select p.partner_id into v_partner_id from public.propostas p
   where p.id = p_proposta_id and (
     public.app_is_admin() or p.partner_id = public.app_partner_id()
     or (v_role = 'team_member' and p.equipe_id = public.app_equipe_id())
   );
  if v_partner_id is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso'; end if;

  select a.id into v_aceite_id from public.proposta_consulta_aceites a
   where a.proposta_id = p_proposta_id and a.revogado_em is null
     and a.escopos @> array[p_tipo::text]
   order by a.registrado_em desc limit 1;
  if v_aceite_id is null then raise exception 'aceite_digital_ausente_ou_escopo_invalido'; end if;

  select pc.preco_centavos into v_preco from public.precos_consulta pc
   where pc.tipo = p_tipo and pc.vigente_ate is null;
  if v_preco is null then raise exception 'preco_nao_configurado' using detail = format('tipo=%s', p_tipo); end if;
  v_ledger := public.wallet_debit(
    p_partner => v_partner_id, p_tipo => 'debito_consulta', p_valor => v_preco,
    p_ref_tipo => 'consulta', p_ref_id => p_proposta_id, p_correlation => p_proposta_id,
    p_descricao => format('Consulta %s · proposta %s', p_tipo, p_proposta_id),
    p_metadata => jsonb_build_object('tipo_consulta', p_tipo, 'aceite_consulta_id', v_aceite_id)
  );
  insert into public.logs_consultas (
    proposta_id, partner_id, tipo, status, preco_centavos, ledger_debito_id,
    provedor, request, iniciado_por, aceite_consulta_id
  ) values (
    p_proposta_id, v_partner_id, p_tipo, 'em_andamento', v_preco, v_ledger.id,
    p_provedor, p_request, v_actor, v_aceite_id
  ) returning id into v_log_id;
  log_id := v_log_id; ledger_id := v_ledger.id; preco_centavos := v_preco; return next;
end;
$$;
revoke all on function public.consulta_iniciar(uuid, public.tipo_consulta, text, jsonb) from public, anon;
grant execute on function public.consulta_iniciar(uuid, public.tipo_consulta, text, jsonb) to authenticated;

-- Do not permit direct client-created receipts. Read policies above support the
-- partner's proposal review and the client's own portal.
