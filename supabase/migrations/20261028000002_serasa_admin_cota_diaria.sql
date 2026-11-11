-- Serasa: consultas iniciadas por Admin são despesa operacional, com cota por usuário.
-- Histórico permanece atribuído à modalidade de cobrança já existente.
alter table public.logs_consultas
  add column if not exists cobranca_modalidade text not null default 'carteira_parceiro';

alter table public.logs_consultas
  add constraint logs_consultas_cobranca_modalidade_check
  check (cobranca_modalidade in ('carteira_parceiro', 'operacao_interna'));

alter table public.logs_consultas
  add constraint logs_consultas_operacao_interna_sem_ledger_check
  check (cobranca_modalidade <> 'operacao_interna' or
    (tipo in ('serasa_pf', 'serasa_pj') and ledger_debito_id is null and ledger_estorno_id is null));

create index if not exists logs_consultas_admin_cota_idx
  on public.logs_consultas (iniciado_por, iniciado_em)
  where cobranca_modalidade = 'operacao_interna' and ambiente = 'producao'
    and tipo in ('serasa_pf', 'serasa_pj');

insert into public.configuracoes_sistema (chave, valor, descricao)
values ('serasa_admin_limite_diario', '20'::jsonb,
        'Máximo de novas consultas Serasa PF/PJ em produção por Admin e dia civil de São Paulo')
on conflict (chave) do nothing;

-- A policy legada de configuracoes_sistema permite escrita por qualquer Admin.
-- Esta chave de custo operacional exige Admin full, sem alterar outras chaves.
create or replace function public.serasa_admin_cota_config_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (case when tg_op = 'DELETE' then old.chave else new.chave end) = 'serasa_admin_limite_diario'
     or (tg_op = 'UPDATE' and old.chave = 'serasa_admin_limite_diario') then
    if auth.role() is distinct from 'service_role' and not public.app_is_admin_full() then
      raise exception 'serasa_admin_limite_edicao_restrita' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger trg_serasa_admin_cota_config_guard
  before insert or update or delete on public.configuracoes_sistema
  for each row execute function public.serasa_admin_cota_config_guard();

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
       or v_existing.autorizacao_id <> p_autorizacao_id or v_existing.ambiente <> p_ambiente then
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
           or v_existing.autorizacao_id <> p_autorizacao_id or v_existing.ambiente <> p_ambiente then
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
    versao_normalizador, autorizacao_id, aceite_consulta_id, cobranca_modalidade
  ) values (
    p_proposta_id, v_partner_id, p_tipo, 'em_andamento', v_preco, v_ledger.id,
    'serasa_experian', '{}'::jsonb, v_actor, p_chave_idempotencia, p_ambiente, v_report,
    (select c.versao_normalizador from public.serasa_relatorios_config c where c.ambiente = p_ambiente),
    p_autorizacao_id, v_aceite_id, case when v_is_admin then 'operacao_interna' else 'carteira_parceiro' end
  ) returning * into v_log;
  log_id := v_log.id; ledger_id := v_ledger.id; preco_centavos := v_preco;
  status := v_log.status; reutilizada := false; return next;
end;
$$;

-- Função de falha: consulta interna sem débito nunca gera crédito na carteira do parceiro.
create or replace function public.consulta_estornar(p_log_id uuid, p_motivo text)
returns public.logs_consultas
language plpgsql security definer set search_path = public
as $$
declare
  v_log public.logs_consultas;
  v_ledger public.wallet_ledger;
begin
  select * into v_log from public.logs_consultas
   where id = p_log_id and status = 'em_andamento'
   for update;
  if not found then raise exception 'log_invalido_para_estorno'; end if;

  if v_log.cobranca_modalidade = 'operacao_interna' then
    if v_log.ledger_debito_id is not null then raise exception 'consulta_interna_com_debito_inesperado'; end if;
    update public.logs_consultas
       set status = 'falha', erro = p_motivo, concluido_em = now(),
           duracao_ms = extract(epoch from (now() - iniciado_em))::int * 1000
     where id = p_log_id returning * into v_log;
    return v_log;
  end if;

  if v_log.ledger_debito_id is null then raise exception 'consulta_paga_sem_debito'; end if;
  v_ledger := public.wallet_credit(
    p_partner => v_log.partner_id, p_tipo => 'estorno', p_valor => v_log.preco_centavos,
    p_ref_tipo => 'consulta', p_ref_id => v_log.proposta_id,
    p_correlation => v_log.proposta_id,
    p_descricao => format('Estorno consulta %s · %s', v_log.tipo, p_motivo),
    p_metadata => jsonb_build_object('log_id', v_log.id, 'motivo', p_motivo)
  );
  update public.logs_consultas
     set status = 'estornada', erro = p_motivo, ledger_estorno_id = v_ledger.id,
         concluido_em = now(),
         duracao_ms = extract(epoch from (now() - iniciado_em))::int * 1000
   where id = p_log_id returning * into v_log;
  return v_log;
end;
$$;

revoke all on function public.consulta_iniciar_serasa(uuid, public.tipo_consulta, uuid, uuid, text)
  from public, anon;
grant execute on function public.consulta_iniciar_serasa(uuid, public.tipo_consulta, uuid, uuid, text)
  to authenticated;
revoke all on function public.consulta_estornar(uuid, text) from public, anon, authenticated;
grant execute on function public.consulta_estornar(uuid, text) to service_role;

grant select (cobranca_modalidade) on public.logs_consultas to authenticated;
create or replace view public.v_consultas_proposta
with (security_invoker = on) as
select l.id, l.proposta_id, l.partner_id, l.tipo, l.status, l.preco_centavos,
       l.resumo, l.erro, l.provedor, l.iniciado_em, l.concluido_em, l.duracao_ms,
       u.nome_completo as iniciado_por_nome, l.ambiente, l.produto_relatorio,
       l.cobranca_modalidade
  from public.logs_consultas l
  left join public.usuarios u on u.id = l.iniciado_por
 order by l.iniciado_em desc;
grant select on public.v_consultas_proposta to authenticated;
