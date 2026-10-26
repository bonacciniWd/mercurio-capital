-- Serasa credit reports: authorization evidence, idempotency and secure completion.
-- Additive migration; historical logs remain intact.

alter table public.logs_consultas
  add column if not exists chave_idempotencia uuid,
  add column if not exists ambiente text check (ambiente in ('uat', 'producao')),
  add column if not exists produto_relatorio text,
  add column if not exists versao_normalizador text,
  add column if not exists autorizacao_id uuid;

create unique index if not exists logs_consultas_actor_idempotency_uidx
  on public.logs_consultas (iniciado_por, chave_idempotencia)
  where chave_idempotencia is not null;

create table if not exists public.consulta_autorizacoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete restrict,
  tipo public.tipo_consulta not null check (tipo in ('serasa_pf', 'serasa_pj')),
  documento_evidencia_id uuid not null references public.proposta_documentos(id) on delete restrict,
  chave_registro uuid not null,
  finalidade text not null default 'analise_de_credito_solicitada'
    check (finalidade = 'analise_de_credito_solicitada'),
  base_legal text not null check (base_legal in ('procedimentos_preliminares_contrato', 'protecao_do_credito')),
  registrado_por uuid not null references public.usuarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  revogado_por uuid references public.usuarios(id) on delete set null
);
create unique index if not exists consulta_autorizacoes_actor_request_uidx
  on public.consulta_autorizacoes (registrado_por, chave_registro);

create index if not exists consulta_autorizacoes_proposta_idx
  on public.consulta_autorizacoes (proposta_id, tipo, criado_em desc)
  where revogado_em is null;

alter table public.consulta_autorizacoes enable row level security;
drop policy if exists consulta_autorizacoes_operacionais_le on public.consulta_autorizacoes;
create policy consulta_autorizacoes_operacionais_le
  on public.consulta_autorizacoes for select
  using (
    public.app_is_admin()
    or exists (
      select 1 from public.propostas p
       where p.id = proposta_id
         and (p.partner_id = public.app_partner_id()
              or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id()))
    )
  );
revoke all on public.consulta_autorizacoes from anon, authenticated;
grant select on public.consulta_autorizacoes to authenticated;

alter table public.logs_consultas
  drop constraint if exists logs_consultas_status_check;
alter table public.logs_consultas
  add constraint logs_consultas_status_check
  check (status in ('em_andamento', 'concluida', 'falha', 'estornada', 'reconciliacao_pendente'));
alter table public.logs_consultas
  add constraint logs_consultas_autorizacao_fk
  foreign key (autorizacao_id) references public.consulta_autorizacoes(id) on delete restrict;

create table if not exists public.serasa_relatorios_config (
  ambiente text primary key check (ambiente in ('uat', 'producao')),
  ativo boolean not null default false,
  report_pf text not null,
  report_pj text not null,
  parametros_pj jsonb,
  versao_normalizador text not null default '1',
  atualizado_por uuid references public.usuarios(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
alter table public.serasa_relatorios_config enable row level security;
drop policy if exists serasa_relatorios_config_admin_le on public.serasa_relatorios_config;
create policy serasa_relatorios_config_admin_le
  on public.serasa_relatorios_config for select using (public.app_is_admin());
revoke all on public.serasa_relatorios_config from anon, authenticated;
grant select on public.serasa_relatorios_config to authenticated;

insert into public.serasa_relatorios_config (ambiente, ativo, report_pf, report_pj, parametros_pj)
values
  ('uat', true, 'RELATORIO_AVANCADO_TOP_SCORE_PF', 'RELATORIO_AVANCADO_PJ_ANALITICO',
    '{"reportParameters":[{"name":"segmentCode","value":"028"}]}'::jsonb),
  ('producao', false, 'RELATORIO_AVANCADO_TOP_SCORE_PF', 'RELATORIO_AVANCADO_PJ_ANALITICO', null)
on conflict (ambiente) do nothing;

create or replace function public.admin_serasa_relatorio_config_atualizar(
  p_ambiente text,
  p_ativo boolean,
  p_segment_code text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ambiente not in ('uat', 'producao') then raise exception 'ambiente_invalido'; end if;
  if p_ambiente = 'producao' and p_ativo then
    raise exception 'serasa_producao_bloqueada_aguarda_go';
  end if;
  if p_ativo and (p_segment_code is null or p_segment_code !~ '^[0-9]{3}$') then
    raise exception 'segment_code_pj_obrigatorio';
  end if;
  update public.serasa_relatorios_config
     set ativo = p_ativo,
         parametros_pj = case when p_segment_code is null then parametros_pj
           else jsonb_build_object('reportParameters', jsonb_build_array(
             jsonb_build_object('name', 'segmentCode', 'value', p_segment_code))) end,
         atualizado_por = auth.uid(), atualizado_em = now()
   where ambiente = p_ambiente;
  if not found then raise exception 'configuracao_serasa_nao_encontrada'; end if;
end;
$$;
revoke all on function public.admin_serasa_relatorio_config_atualizar(text, boolean, text) from public, anon;
grant execute on function public.admin_serasa_relatorio_config_atualizar(text, boolean, text) to authenticated;

create or replace function public.consulta_autorizacao_registrar(
  p_proposta_id uuid,
  p_tipo public.tipo_consulta,
  p_documento_evidencia_id uuid,
  p_base_legal text,
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
  if p_base_legal not in ('procedimentos_preliminares_contrato', 'protecao_do_credito') then
    raise exception 'base_legal_invalida';
  end if;
  if not exists (
    select 1 from public.propostas p where p.id = p_proposta_id and (
      public.app_is_admin() or p.partner_id = public.app_partner_id()
      or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id())
    )
  ) then raise exception 'proposta_nao_encontrada_ou_sem_acesso'; end if;
  if not exists (
    select 1 from public.proposta_documentos d
     where d.id = p_documento_evidencia_id and d.proposta_id = p_proposta_id
       and d.status = 'aprovado' and d.validado is true and d.storage_path is not null
  ) then raise exception 'documento_autorizacao_nao_aprovado'; end if;

  select * into v_existing from public.consulta_autorizacoes a
   where a.registrado_por = auth.uid() and a.chave_registro = p_chave_registro;
  if found then
    if v_existing.proposta_id <> p_proposta_id or v_existing.tipo <> p_tipo
       or v_existing.documento_evidencia_id <> p_documento_evidencia_id
       or v_existing.base_legal <> p_base_legal then
      raise exception 'chave_autorizacao_reutilizada_com_escopo_diferente';
    end if;
    return v_existing.id;
  end if;

  insert into public.consulta_autorizacoes
    (proposta_id, tipo, documento_evidencia_id, base_legal, registrado_por, chave_registro)
  values (p_proposta_id, p_tipo, p_documento_evidencia_id, p_base_legal, auth.uid(), p_chave_registro)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.consulta_autorizacao_registrar(uuid, public.tipo_consulta, uuid, text, uuid) from public, anon;
grant execute on function public.consulta_autorizacao_registrar(uuid, public.tipo_consulta, uuid, text, uuid) to authenticated;

create or replace function public.consulta_autorizacao_revogar(p_autorizacao_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.consulta_autorizacoes a
     set revogado_em = now(), revogado_por = auth.uid()
   where a.id = p_autorizacao_id and a.revogado_em is null
     and (public.app_is_admin() or exists (
       select 1 from public.propostas p where p.id = a.proposta_id
        and (p.partner_id = public.app_partner_id()
             or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id()))
     ));
  if not found then raise exception 'autorizacao_nao_encontrada_ou_sem_acesso'; end if;
end;
$$;
revoke all on function public.consulta_autorizacao_revogar(uuid) from public, anon;
grant execute on function public.consulta_autorizacao_revogar(uuid) to authenticated;

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
    into v_report from public.serasa_relatorios_config c
   where c.ambiente = p_ambiente and c.ativo;
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
  if not exists (
    select 1 from public.consulta_autorizacoes a
    join public.propostas p on p.id = a.proposta_id
    join public.proposta_documentos d on d.id = a.documento_evidencia_id
    join public.clientes c on c.id = p.cliente_id
    where a.id = p_autorizacao_id and a.proposta_id = p_proposta_id and a.tipo = p_tipo
      and a.revogado_em is null and d.status = 'aprovado' and d.validado is true and d.storage_path is not null
      and ((p_tipo = 'serasa_pf' and c.pessoa_tipo = 'PF' and length(regexp_replace(coalesce(c.cpf,''), '\D','','g')) = 11)
        or (p_tipo = 'serasa_pj' and c.pessoa_tipo = 'PJ' and length(regexp_replace(coalesce(c.cnpj,''), '\D','','g')) = 14))
  ) then raise exception 'autorizacao_documento_ou_titular_invalido'; end if;

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
    versao_normalizador, autorizacao_id
  ) values (
    p_proposta_id, v_partner_id, p_tipo, 'em_andamento', v_preco, v_ledger.id,
    'serasa_experian', '{}'::jsonb, v_actor, p_chave_idempotencia, p_ambiente, v_report,
    (select c.versao_normalizador from public.serasa_relatorios_config c where c.ambiente = p_ambiente), p_autorizacao_id
  ) returning * into v_log;

  log_id := v_log.id; ledger_id := v_ledger.id; preco_centavos := v_preco; status := v_log.status; reutilizada := false;
  return next;
end;
$$;
revoke all on function public.consulta_iniciar_serasa(uuid, public.tipo_consulta, uuid, uuid, text) from public, anon;
grant execute on function public.consulta_iniciar_serasa(uuid, public.tipo_consulta, uuid, uuid, text) to authenticated;

create or replace function public.consulta_marcar_reconciliacao(p_log_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.logs_consultas
     set status = 'reconciliacao_pendente',
         erro = left(coalesce(p_motivo, 'resultado_incerto'), 200),
         concluido_em = now(),
         duracao_ms = extract(epoch from (now() - iniciado_em))::int * 1000
   where id = p_log_id and status = 'em_andamento';
  if not found then raise exception 'log_nao_pode_aguardar_reconciliacao'; end if;
end;
$$;
revoke all on function public.consulta_marcar_reconciliacao(uuid, text) from public, anon, authenticated;
grant execute on function public.consulta_marcar_reconciliacao(uuid, text) to service_role;

-- Completion and refund can only be performed by the trusted service-role Edge function.
revoke all on function public.consulta_concluir(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.consulta_concluir(uuid, jsonb, jsonb, text) to service_role;
revoke all on function public.consulta_estornar(uuid, text) from public, anon, authenticated;
grant execute on function public.consulta_estornar(uuid, text) to service_role;
revoke all on function public.wallet_debit(uuid, public.wallet_movimento_tipo, bigint, text, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.wallet_debit(uuid, public.wallet_movimento_tipo, bigint, text, uuid, uuid, text, jsonb)
  to service_role;
revoke all on function public.wallet_credit(uuid, public.wallet_movimento_tipo, bigint, text, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.wallet_credit(uuid, public.wallet_movimento_tipo, bigint, text, uuid, uuid, text, jsonb)
  to service_role;

-- Expose summaries only; never grant the browser access to provider request/response payloads.
revoke select on public.logs_consultas from anon, authenticated;
grant select (id, proposta_id, partner_id, tipo, status, preco_centavos, ledger_debito_id,
  ledger_estorno_id, provedor, resumo, erro, iniciado_por, iniciado_em, concluido_em, duracao_ms,
  chave_idempotencia, ambiente, produto_relatorio, versao_normalizador, autorizacao_id)
  on public.logs_consultas to authenticated;

create or replace view public.v_consultas_proposta
with (security_invoker = on) as
select l.id, l.proposta_id, l.partner_id, l.tipo, l.status, l.preco_centavos,
       l.resumo, l.erro, l.provedor, l.iniciado_em, l.concluido_em, l.duracao_ms,
       u.nome_completo as iniciado_por_nome, l.ambiente, l.produto_relatorio
  from public.logs_consultas l
  left join public.usuarios u on u.id = l.iniciado_por
 order by l.iniciado_em desc;
grant select on public.v_consultas_proposta to authenticated;
