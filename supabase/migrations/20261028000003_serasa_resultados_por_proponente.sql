-- Link new Serasa authorizations and query logs to one explicit proposal proponent.
-- Existing records remain NULL and are not backfilled or assigned retroactively.
create unique index if not exists proponentes_id_proposta_uidx
  on public.proponentes (id, proposta_id);
alter table public.consulta_autorizacoes add column if not exists proponente_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'consulta_autorizacoes_proponente_proposta_fk') then
    alter table public.consulta_autorizacoes
      add constraint consulta_autorizacoes_proponente_proposta_fk
      foreign key (proponente_id, proposta_id) references public.proponentes(id, proposta_id) on delete restrict;
  end if;
end $$;
alter table public.logs_consultas add column if not exists proponente_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'logs_consultas_proponente_proposta_fk') then
    alter table public.logs_consultas
      add constraint logs_consultas_proponente_proposta_fk
      foreign key (proponente_id, proposta_id) references public.proponentes(id, proposta_id) on delete restrict;
  end if;
end $$;
create index if not exists logs_consultas_proponente_history_idx
  on public.logs_consultas (proposta_id, proponente_id, iniciado_em desc)
  where proponente_id is not null;

create or replace function public.consulta_autorizacao_registrar_proponente(
  p_proposta_id uuid,
  p_tipo public.tipo_consulta,
  p_proponente_id uuid,
  p_documento_evidencia_id uuid,
  p_aceite_consulta_id uuid,
  p_base_legal text,
  p_chave_registro uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_existing public.consulta_autorizacoes%rowtype;
  v_pessoa_tipo text;
  v_documento text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_tipo not in ('serasa_pf', 'serasa_pj') then raise exception 'tipo_consulta_invalido'; end if;
  if (p_documento_evidencia_id is null) = (p_aceite_consulta_id is null) then
    raise exception 'autorizacao_evidencia_ou_aceite_obrigatorio';
  end if;
  if p_aceite_consulta_id is null and p_base_legal not in ('procedimentos_preliminares_contrato', 'protecao_do_credito') then
    raise exception 'base_legal_invalida';
  end if;
  if not exists (
    select 1 from public.propostas p where p.id = p_proposta_id and (
      public.app_is_admin() or p.partner_id = public.app_partner_id()
      or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id())
    )
  ) then raise exception 'proposta_nao_encontrada_ou_sem_acesso'; end if;
  select pr.pessoa_tipo, pr.cpf_cnpj into v_pessoa_tipo, v_documento
    from public.proponentes pr where pr.id = p_proponente_id and pr.proposta_id = p_proposta_id;
  if not found
     or (p_tipo = 'serasa_pf' and v_pessoa_tipo <> 'PF')
     or (p_tipo = 'serasa_pj' and v_pessoa_tipo <> 'PJ')
     or length(regexp_replace(coalesce(v_documento, ''), '\D', '', 'g')) <> (case when p_tipo = 'serasa_pf' then 11 else 14 end) then
    raise exception 'proponente_ou_documento_invalido';
  end if;
  if p_documento_evidencia_id is not null and not exists (
    select 1 from public.proposta_documentos d where d.id = p_documento_evidencia_id
      and d.proposta_id = p_proposta_id and d.status = 'aprovado'
      and d.validado is true and d.storage_path is not null
  ) then raise exception 'documento_autorizacao_nao_aprovado'; end if;
  if p_aceite_consulta_id is not null and not exists (
    select 1 from public.proposta_consulta_aceites ca where ca.id = p_aceite_consulta_id
      and ca.proposta_id = p_proposta_id and ca.revogado_em is null
      and ca.escopos @> array[p_tipo::text]
  ) then raise exception 'aceite_digital_ausente_ou_escopo_invalido'; end if;

  select * into v_existing from public.consulta_autorizacoes a
   where a.registrado_por = auth.uid() and a.chave_registro = p_chave_registro;
  if found then
    if v_existing.proposta_id <> p_proposta_id or v_existing.tipo <> p_tipo
       or v_existing.proponente_id is distinct from p_proponente_id
       or v_existing.documento_evidencia_id is distinct from p_documento_evidencia_id
       or v_existing.aceite_consulta_id is distinct from p_aceite_consulta_id
       or v_existing.base_legal is distinct from (case when p_aceite_consulta_id is null then p_base_legal else null end) then
      raise exception 'chave_autorizacao_reutilizada_com_escopo_diferente';
    end if;
    return v_existing.id;
  end if;
  insert into public.consulta_autorizacoes
    (proposta_id, tipo, proponente_id, documento_evidencia_id, aceite_consulta_id,
     base_legal, registrado_por, chave_registro)
  values (p_proposta_id, p_tipo, p_proponente_id, p_documento_evidencia_id,
          p_aceite_consulta_id, case when p_aceite_consulta_id is null then p_base_legal else null end,
          auth.uid(), p_chave_registro)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.consulta_autorizacao_registrar_proponente(uuid, public.tipo_consulta, uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.consulta_autorizacao_registrar_proponente(uuid, public.tipo_consulta, uuid, uuid, uuid, text, uuid) to authenticated;

create or replace function public.consulta_iniciar_serasa_proponente(
  p_proposta_id uuid,
  p_tipo public.tipo_consulta,
  p_chave_idempotencia uuid,
  p_autorizacao_id uuid,
  p_ambiente text,
  p_proponente_id uuid
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
  v_documento text;
  v_pessoa_tipo text;
  v_is_admin boolean;
  v_limit integer;
  v_used integer;
  v_day date;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if v_actor is null then raise exception 'unauthorized'; end if;
  if p_tipo not in ('serasa_pf', 'serasa_pj') then raise exception 'tipo_consulta_invalido'; end if;
  if p_ambiente not in ('uat', 'producao') then raise exception 'ambiente_invalido'; end if;

  select p.partner_id into v_partner_id from public.propostas p
   where p.id = p_proposta_id and (
     public.app_is_admin() or p.partner_id = public.app_partner_id()
     or (public.app_user_role() = 'team_member' and p.equipe_id = public.app_equipe_id())
   );
  if v_partner_id is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso'; end if;
  v_is_admin := public.app_is_admin();

  -- A reutilização também exige acesso atual à proposta; não devolver resultado
  -- de consulta feita antes de uma mudança de papel ou vínculo.
  select l.* into v_existing from public.logs_consultas l
   where l.iniciado_por = v_actor and l.chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_existing.proposta_id <> p_proposta_id or v_existing.tipo <> p_tipo
       or v_existing.autorizacao_id <> p_autorizacao_id or v_existing.ambiente <> p_ambiente
       or v_existing.proponente_id is distinct from p_proponente_id then
      raise exception 'chave_idempotencia_reutilizada_com_escopo_diferente';
    end if;
    log_id := v_existing.id; ledger_id := v_existing.ledger_debito_id;
    preco_centavos := v_existing.preco_centavos; status := v_existing.status; reutilizada := true;
    return next; return;
  end if;

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

  select pr.pessoa_tipo, pr.cpf_cnpj into v_pessoa_tipo, v_documento
    from public.proponentes pr
   where pr.id = p_proponente_id and pr.proposta_id = p_proposta_id;
  if not found
     or (p_tipo = 'serasa_pf' and v_pessoa_tipo <> 'PF')
     or (p_tipo = 'serasa_pj' and v_pessoa_tipo <> 'PJ')
     or length(regexp_replace(coalesce(v_documento, ''), '\D', '', 'g')) <> (case when p_tipo = 'serasa_pf' then 11 else 14 end) then
    raise exception 'proponente_ou_documento_invalido';
  end if;

  select a.aceite_consulta_id into v_aceite_id
    from public.consulta_autorizacoes a
   where a.id = p_autorizacao_id and a.proposta_id = p_proposta_id and a.tipo = p_tipo
     and a.proponente_id = p_proponente_id and a.revogado_em is null
     and ((a.documento_evidencia_id is not null and exists (
       select 1 from public.proposta_documentos d where d.id = a.documento_evidencia_id
        and d.proposta_id = p_proposta_id and d.status = 'aprovado'
        and d.validado is true and d.storage_path is not null
     )) or (a.aceite_consulta_id is not null and exists (
       select 1 from public.proposta_consulta_aceites ca where ca.id = a.aceite_consulta_id
        and ca.proposta_id = p_proposta_id and ca.revogado_em is null
        and ca.escopos @> array[p_tipo::text]
     )));
  if not found then raise exception 'autorizacao_documento_ou_titular_invalido'; end if;

  select pc.preco_centavos into v_preco from public.precos_consulta pc
   where pc.tipo = p_tipo and pc.vigente_ate is null;
  if v_preco is null then raise exception 'preco_nao_configurado'; end if;
  if v_is_admin then
    if p_ambiente = 'producao' then
      select case when jsonb_typeof(c.valor) = 'number' and c.valor::text ~ '^[0-9]+$'
        then (c.valor::text)::integer else null end
        into v_limit
        from public.configuracoes_sistema c where c.chave = 'serasa_admin_limite_diario';
      if v_limit is null or v_limit < 1 then raise exception 'serasa_admin_limite_nao_configurado'; end if;
      v_day := (now() at time zone 'America/Sao_Paulo')::date;
      v_day_start := v_day::timestamp at time zone 'America/Sao_Paulo';
      v_day_end := (v_day + 1)::timestamp at time zone 'America/Sao_Paulo';
      perform pg_advisory_xact_lock(hashtext(v_actor::text), hashtext(v_day::text));
      -- Recheck after the lock: concurrent requests with the same key reuse one log.
      select l.* into v_existing from public.logs_consultas l
       where l.iniciado_por = v_actor and l.chave_idempotencia = p_chave_idempotencia;
      if found then
        if v_existing.proposta_id <> p_proposta_id or v_existing.tipo <> p_tipo
           or v_existing.autorizacao_id <> p_autorizacao_id or v_existing.ambiente <> p_ambiente
       or v_existing.proponente_id is distinct from p_proponente_id then
          raise exception 'chave_idempotencia_reutilizada_com_escopo_diferente';
        end if;
        log_id := v_existing.id; ledger_id := v_existing.ledger_debito_id;
        preco_centavos := v_existing.preco_centavos; status := v_existing.status; reutilizada := true;
        return next; return;
      end if;
      select count(*) into v_used from public.logs_consultas l
       where l.iniciado_por = v_actor and l.cobranca_modalidade = 'operacao_interna'
         and l.ambiente = 'producao' and l.tipo in ('serasa_pf', 'serasa_pj')
         and l.iniciado_em >= v_day_start and l.iniciado_em < v_day_end;
      if v_used >= v_limit then raise exception 'serasa_admin_cota_diaria_excedida'; end if;
    end if;
  else
    v_ledger := public.wallet_debit(
      p_partner => v_partner_id, p_tipo => 'debito_consulta', p_valor => v_preco,
      p_ref_tipo => 'consulta', p_ref_id => p_proposta_id, p_correlation => p_chave_idempotencia,
      p_descricao => format('Relatório Serasa %s · proposta %s', p_tipo, p_proposta_id),
      p_metadata => jsonb_build_object('tipo_consulta', p_tipo, 'ambiente', p_ambiente, 'chave_idempotencia', p_chave_idempotencia)
    );
  end if;
  insert into public.logs_consultas (
    proposta_id, partner_id, tipo, status, preco_centavos, ledger_debito_id,
    provedor, request, iniciado_por, chave_idempotencia, ambiente, produto_relatorio,
    versao_normalizador, autorizacao_id, aceite_consulta_id, cobranca_modalidade, proponente_id
  ) values (
    p_proposta_id, v_partner_id, p_tipo, 'em_andamento', v_preco, v_ledger.id,
    'serasa_experian', '{}'::jsonb, v_actor, p_chave_idempotencia, p_ambiente, v_report,
    (select c.versao_normalizador from public.serasa_relatorios_config c where c.ambiente = p_ambiente),
    p_autorizacao_id, v_aceite_id, case when v_is_admin then 'operacao_interna' else 'carteira_parceiro' end, p_proponente_id
  ) returning * into v_log;
  log_id := v_log.id; ledger_id := v_ledger.id; preco_centavos := v_preco;
  status := v_log.status; reutilizada := false; return next;
end;
$$;

revoke all on function public.consulta_iniciar_serasa_proponente(uuid, public.tipo_consulta, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.consulta_iniciar_serasa_proponente(uuid, public.tipo_consulta, uuid, uuid, text, uuid) to authenticated;

grant select (proponente_id) on public.logs_consultas to authenticated;
create or replace view public.v_consultas_proposta
with (security_invoker = on) as
select l.id, l.proposta_id, l.partner_id, l.tipo, l.status, l.preco_centavos,
       l.resumo, l.erro, l.provedor, l.iniciado_em, l.concluido_em, l.duracao_ms,
       u.nome_completo as iniciado_por_nome, l.ambiente, l.produto_relatorio,
       l.cobranca_modalidade, l.proponente_id
  from public.logs_consultas l
  left join public.usuarios u on u.id = l.iniciado_por
 order by l.iniciado_em desc;
grant select on public.v_consultas_proposta to authenticated;
