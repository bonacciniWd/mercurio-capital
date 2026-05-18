-- =============================================
-- Fase 6 — Integrações Externas Pagas (M12)
-- =============================================
-- Tabela logs_consultas, RPCs consulta_iniciar / consulta_concluir /
-- consulta_estornar e view v_consultas_proposta.
--
-- Fluxo (a partir da Edge `consulta-executar`):
--   1. authenticated cliente JS chama Edge com { proposta_id, tipo }
--   2. Edge resolve partner_id, busca preço vigente
--   3. Edge chama RPC consulta_iniciar() → debita wallet e cria log
--      em status 'em_andamento', retornando { log_id, ledger_id }
--   4. Edge chama provedor externo
--   5a. Sucesso → RPC consulta_concluir(log_id, response_jsonb)
--   5b. Falha   → RPC consulta_estornar(log_id, motivo) que credita
--                 valor original (tipo='estorno') e marca log='estornada'
-- =============================================

-- ---------------------------------------------
-- 1. Tabela
-- ---------------------------------------------

create table logs_consultas (
  id                  uuid primary key default gen_random_uuid(),
  proposta_id         uuid not null references propostas(id) on delete cascade,
  partner_id          uuid not null references partners(id) on delete restrict,
  tipo                tipo_consulta not null,
  status              text not null default 'em_andamento'
                       check (status in ('em_andamento','concluida','falha','estornada')),
  preco_centavos      bigint not null check (preco_centavos > 0),
  ledger_debito_id    uuid references wallet_ledger(id) on delete set null,
  ledger_estorno_id   uuid references wallet_ledger(id) on delete set null,
  provedor            text,
  request             jsonb not null default '{}',
  response            jsonb,        -- payload completo (visível só admin/partner)
  resumo              jsonb,        -- versão enxuta (score, status, totals) — usada no UI
  erro                text,
  iniciado_por        uuid references usuarios(id) on delete set null,
  iniciado_em         timestamptz not null default now(),
  concluido_em        timestamptz,
  duracao_ms          int
);

create index logs_consultas_proposta_idx on logs_consultas (proposta_id, iniciado_em desc);
create index logs_consultas_partner_idx  on logs_consultas (partner_id, iniciado_em desc);
create index logs_consultas_tipo_status_idx on logs_consultas (tipo, status);

alter table logs_consultas enable row level security;

create policy "partner_le_logs_proprias"
  on logs_consultas for select
  using (partner_id = public.app_partner_id());

create policy "team_le_logs_equipe"
  on logs_consultas for select
  using (
    public.app_user_role() = 'team_member'
    and proposta_id in (
      select id from propostas where equipe_id = public.app_equipe_id()
    )
  );

create policy "cliente_le_logs_proprias"
  on logs_consultas for select
  using (
    public.app_user_role() = 'client'
    and proposta_id in (
      select p.id from propostas p
        join clientes c on c.id = p.cliente_id
       where c.usuario_id = auth.uid()
    )
  );

create policy "admin_full_logs" on logs_consultas
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- INSERT/UPDATE somente via funções SECURITY DEFINER abaixo.

-- ---------------------------------------------
-- 2. RPC consulta_iniciar
-- ---------------------------------------------

create or replace function consulta_iniciar(
  p_proposta_id uuid,
  p_tipo        tipo_consulta,
  p_provedor    text default null,
  p_request     jsonb default '{}'
)
returns table (log_id uuid, ledger_id uuid, preco_centavos bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_preco      bigint;
  v_role       text := public.app_user_role();
  v_actor      uuid := auth.uid();
  v_ledger     wallet_ledger;
  v_log_id     uuid;
begin
  -- Autorização: partner dono OU team_member da equipe OU admin
  select p.partner_id into v_partner_id
    from propostas p
    where p.id = p_proposta_id
      and (
        public.app_is_admin()
        or p.partner_id = public.app_partner_id()
        or (v_role = 'team_member' and p.equipe_id = public.app_equipe_id())
      );
  if v_partner_id is null then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso';
  end if;

  -- Preço vigente
  select preco_centavos into v_preco
    from precos_consulta
    where tipo = p_tipo and vigente_ate is null;
  if v_preco is null then
    raise exception 'preco_nao_configurado' using detail = format('tipo=%s', p_tipo);
  end if;

  -- Debita carteira (lança saldo_insuficiente / wallet_bloqueada)
  v_ledger := wallet_debit(
    p_partner     => v_partner_id,
    p_tipo        => 'debito_consulta',
    p_valor       => v_preco,
    p_ref_tipo    => 'consulta',
    p_ref_id      => p_proposta_id,
    p_correlation => p_proposta_id,
    p_descricao   => format('Consulta %s · proposta %s', p_tipo, p_proposta_id),
    p_metadata    => jsonb_build_object('tipo_consulta', p_tipo)
  );

  insert into logs_consultas (
    proposta_id, partner_id, tipo, status,
    preco_centavos, ledger_debito_id, provedor,
    request, iniciado_por
  ) values (
    p_proposta_id, v_partner_id, p_tipo, 'em_andamento',
    v_preco, v_ledger.id, p_provedor,
    p_request, v_actor
  )
  returning id into v_log_id;

  log_id := v_log_id;
  ledger_id := v_ledger.id;
  preco_centavos := v_preco;
  return next;
end;
$$;

grant execute on function consulta_iniciar(uuid, tipo_consulta, text, jsonb) to authenticated;

-- ---------------------------------------------
-- 3. RPC consulta_concluir
-- ---------------------------------------------

create or replace function consulta_concluir(
  p_log_id    uuid,
  p_response  jsonb,
  p_resumo    jsonb default null,
  p_provedor  text  default null
)
returns logs_consultas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log logs_consultas;
begin
  update logs_consultas
    set status        = 'concluida',
        response      = p_response,
        resumo        = coalesce(p_resumo, response_to_resumo(p_response)),
        provedor      = coalesce(p_provedor, provedor),
        concluido_em  = now(),
        duracao_ms    = extract(epoch from (now() - iniciado_em))::int * 1000
    where id = p_log_id and status = 'em_andamento'
  returning * into v_log;

  if not found then
    raise exception 'log_invalido_ou_ja_concluido';
  end if;

  return v_log;
end;
$$;

-- helper: extrai resumo padrão
create or replace function response_to_resumo(p_response jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'status', coalesce(p_response->>'status', 'ok'),
    'score',  p_response->'score',
    'totals', p_response->'totals'
  )
$$;

grant execute on function consulta_concluir(uuid, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------
-- 4. RPC consulta_estornar
-- ---------------------------------------------

create or replace function consulta_estornar(
  p_log_id uuid,
  p_motivo text
)
returns logs_consultas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log    logs_consultas;
  v_ledger wallet_ledger;
begin
  select * into v_log from logs_consultas
   where id = p_log_id and status = 'em_andamento'
   for update;
  if not found then
    raise exception 'log_invalido_para_estorno';
  end if;

  v_ledger := wallet_credit(
    p_partner     => v_log.partner_id,
    p_tipo        => 'estorno',
    p_valor       => v_log.preco_centavos,
    p_ref_tipo    => 'consulta',
    p_ref_id      => v_log.proposta_id,
    p_correlation => v_log.proposta_id,
    p_descricao   => format('Estorno consulta %s · %s', v_log.tipo, p_motivo),
    p_metadata    => jsonb_build_object('log_id', v_log.id, 'motivo', p_motivo)
  );

  update logs_consultas
    set status            = 'estornada',
        erro              = p_motivo,
        ledger_estorno_id = v_ledger.id,
        concluido_em      = now(),
        duracao_ms        = extract(epoch from (now() - iniciado_em))::int * 1000
    where id = p_log_id
  returning * into v_log;

  return v_log;
end;
$$;

grant execute on function consulta_estornar(uuid, text) to authenticated;

-- ---------------------------------------------
-- 5. View v_consultas_proposta (UI)
-- ---------------------------------------------

create or replace view v_consultas_proposta as
select
  l.id,
  l.proposta_id,
  l.partner_id,
  l.tipo,
  l.status,
  l.preco_centavos,
  l.resumo,
  l.erro,
  l.provedor,
  l.iniciado_em,
  l.concluido_em,
  l.duracao_ms,
  u.nome_completo as iniciado_por_nome
from logs_consultas l
left join usuarios u on u.id = l.iniciado_por
order by l.iniciado_em desc;

grant select on v_consultas_proposta to authenticated;
