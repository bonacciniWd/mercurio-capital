-- Planos de amortizacao, mensagem de WhatsApp configuravel e comparativo final.
-- A captura continua server-side via Edge Function/service_role.

alter table public.simulacao_leads_publicos
  add column if not exists planos_amortizacao jsonb not null default '[]'::jsonb,
  add column if not exists resultado_com_amortizacao jsonb;

alter table public.simulacao_leads_publicos
  drop constraint if exists simulacao_leads_publicos_planos_amortizacao_check,
  add constraint simulacao_leads_publicos_planos_amortizacao_check
    check (case when jsonb_typeof(planos_amortizacao) = 'array' then jsonb_array_length(planos_amortizacao) <= 10 else false end),
  drop constraint if exists simulacao_leads_publicos_resultado_com_amortizacao_check,
  add constraint simulacao_leads_publicos_resultado_com_amortizacao_check
    check (resultado_com_amortizacao is null or jsonb_typeof(resultado_com_amortizacao) = 'object');

create or replace view public.v_admin_simulacao_leads_publicos
  with (security_invoker = on)
as
  select
    id, tipo_simulacao, nome_completo, email, telefone, consentimento_em, consentimento_versao,
    valor_imovel, valor_credito, prazo_meses, taxa_juros_mensal, parcela_estimada, ltv,
    tipo_imovel, situacao_imovel, cep, renda_mensal, objetivo_credito, tipo_renda,
    prazo_contratacao, origem, data_inicio, periodicidade_juros, sistema_amortizacao,
    quantidade_parcelas, taxa_juros_informada, primeira_parcela, ultima_parcela,
    total_pago, total_juros, status_email_prospect, status_email_interno, created_at, updated_at,
    planos_amortizacao, resultado_com_amortizacao
  from public.simulacao_leads_publicos;

revoke all on public.v_admin_simulacao_leads_publicos from public, anon;
grant select on public.v_admin_simulacao_leads_publicos to authenticated;

create table if not exists public.config_mensagens_simulador (
  id boolean primary key default true check (id),
  fallback text not null,
  regras jsonb not null default '[]'::jsonb check (jsonb_typeof(regras) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.config_mensagens_simulador enable row level security;
drop policy if exists config_mensagens_simulador_admin_full_read on public.config_mensagens_simulador;
create policy config_mensagens_simulador_admin_full_read
  on public.config_mensagens_simulador for select to authenticated
  using (public.app_is_admin_full());
revoke all on public.config_mensagens_simulador from public, anon, authenticated;
grant select on public.config_mensagens_simulador to authenticated;

insert into public.config_mensagens_simulador (id, fallback, regras)
values (
  true,
  'Olá {{nome}}, notamos que você recentemente realizou uma consulta em nossa calculadora de {{tipo_calculadora}}, no valor de {{valor_simulado}}. Você gostaria de uma ajuda?',
  '[]'::jsonb
)
on conflict (id) do nothing;

create or replace function public.admin_config_mensagens_simulador_atualizar(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fallback text;
  v_regras jsonb;
  v_regra jsonb;
  v_mensagem text;
  v_tipo text;
  v_prioridade integer;
  v_min numeric;
  v_max numeric;
  v_antes jsonb;
  v_depois jsonb;
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'config_invalida'; end if;
  v_fallback := btrim(coalesce(p_config->>'fallback', ''));
  v_regras := p_config->'regras';
  if length(v_fallback) not between 1 and 2000 or jsonb_typeof(v_regras) is distinct from 'array' then raise exception 'config_invalida'; end if;
  if jsonb_array_length(v_regras) > 20 then raise exception 'limite_regras_excedido'; end if;

  for v_regra in select value from jsonb_array_elements(v_regras)
  loop
    if jsonb_typeof(v_regra) is distinct from 'object' then raise exception 'regra_invalida'; end if;
    if length(btrim(coalesce(v_regra->>'id', ''))) not between 1 and 80 then raise exception 'regra_id_invalida'; end if;
    if jsonb_typeof(v_regra->'ativo') is distinct from 'boolean' then raise exception 'regra_ativa_invalida'; end if;
    if jsonb_typeof(v_regra->'prioridade') is distinct from 'number' then raise exception 'regra_prioridade_invalida'; end if;
    if (v_regra->>'prioridade')::numeric <> trunc((v_regra->>'prioridade')::numeric) then raise exception 'regra_prioridade_invalida'; end if;
    v_prioridade := (v_regra->>'prioridade')::integer;
    if v_prioridade not between 0 and 10000 then raise exception 'regra_prioridade_invalida'; end if;
    v_tipo := v_regra->>'tipo_simulacao';
    if v_tipo is null or v_tipo not in ('todos', 'home_equity', 'amortizacao') then raise exception 'regra_tipo_invalido'; end if;
    v_mensagem := btrim(coalesce(v_regra->>'mensagem', ''));
    if length(v_mensagem) not between 1 and 2000 then raise exception 'regra_mensagem_invalida'; end if;
    if regexp_replace(v_mensagem, '\{\{(nome|tipo_calculadora|valor_simulado)\}\}', '', 'g') ~ '\{\{[^}]+\}\}' then raise exception 'variavel_mensagem_invalida'; end if;
    v_min := null;
    v_max := null;
    if v_regra ? 'valor_minimo' and jsonb_typeof(v_regra->'valor_minimo') <> 'null' then
      if jsonb_typeof(v_regra->'valor_minimo') <> 'number' then raise exception 'regra_faixa_invalida'; end if;
      v_min := (v_regra->>'valor_minimo')::numeric;
      if v_min < 0 then raise exception 'regra_faixa_invalida'; end if;
    end if;
    if v_regra ? 'valor_maximo' and jsonb_typeof(v_regra->'valor_maximo') <> 'null' then
      if jsonb_typeof(v_regra->'valor_maximo') <> 'number' then raise exception 'regra_faixa_invalida'; end if;
      v_max := (v_regra->>'valor_maximo')::numeric;
      if v_max < 0 then raise exception 'regra_faixa_invalida'; end if;
    end if;
    if v_min is not null and v_max is not null and v_min > v_max then raise exception 'regra_faixa_invalida'; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(v_regras)) <> (select count(distinct value->>'id') from jsonb_array_elements(v_regras)) then raise exception 'regra_id_duplicada'; end if;

  select jsonb_build_object('fallback', fallback, 'regras', regras)
    into v_antes from public.config_mensagens_simulador where id = true;
  insert into public.config_mensagens_simulador (id, fallback, regras, updated_at, updated_by)
  values (true, v_fallback, v_regras, now(), auth.uid())
  on conflict (id) do update set fallback = excluded.fallback, regras = excluded.regras, updated_at = now(), updated_by = auth.uid();
  v_depois := jsonb_build_object('fallback', v_fallback, 'regras', v_regras);
  perform public.registrar_audit('mensagens_simulador_atualizadas', 'config_mensagens_simulador', null, v_antes, v_depois);
  return v_depois;
end;
$$;

revoke all on function public.admin_config_mensagens_simulador_atualizar(jsonb) from public, anon;
grant execute on function public.admin_config_mensagens_simulador_atualizar(jsonb) to authenticated;

create or replace function public.capture_public_simulacao_amortizacao_lead_v2(
  p_idempotency_key uuid,
  p_nome_completo text,
  p_email text,
  p_telefone text,
  p_valor_credito numeric,
  p_prazo_meses integer,
  p_data_inicio date,
  p_taxa_juros_informada numeric,
  p_periodicidade_juros text,
  p_sistema_amortizacao text,
  p_quantidade_parcelas integer,
  p_taxa_juros_mensal numeric,
  p_primeira_parcela numeric,
  p_ultima_parcela numeric,
  p_total_pago numeric,
  p_total_juros numeric,
  p_tipo_imovel text,
  p_situacao_imovel text,
  p_cep text,
  p_renda_mensal numeric default null,
  p_objetivo_credito text default null,
  p_tipo_renda text default null,
  p_prazo_contratacao text default null,
  p_origem text default null,
  p_consentimento_versao text default 'simulador_publico_v2',
  p_planos_amortizacao jsonb default '[]'::jsonb,
  p_resultado_com_amortizacao jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_lead_id uuid;
  v_plan jsonb;
  v_amount numeric;
  v_after integer;
  v_email_summary text;
begin
  if jsonb_typeof(p_planos_amortizacao) is distinct from 'array' then raise exception 'planos_amortizacao_invalidos'; end if;
  if jsonb_array_length(p_planos_amortizacao) > 10 then raise exception 'planos_amortizacao_invalidos'; end if;
  for v_plan in select value from jsonb_array_elements(p_planos_amortizacao)
  loop
    if jsonb_typeof(v_plan) is distinct from 'object' then raise exception 'plano_amortizacao_invalido'; end if;
    if jsonb_typeof(v_plan->'valor_extra') is distinct from 'number' then raise exception 'plano_valor_invalido'; end if;
    v_amount := (v_plan->>'valor_extra')::numeric;
    if v_amount <= 0 or v_amount > p_valor_credito then raise exception 'plano_valor_invalido'; end if;
    if v_plan->>'objetivo' is null or v_plan->>'objetivo' not in ('prazo', 'parcela') or v_plan->>'frequencia' is null or v_plan->>'frequencia' not in ('unica', 'mensal') then raise exception 'plano_opcao_invalida'; end if;
    if jsonb_typeof(v_plan->'apos_parcela') is distinct from 'number' then raise exception 'plano_parcela_invalida'; end if;
    if (v_plan->>'apos_parcela')::numeric <> trunc((v_plan->>'apos_parcela')::numeric) then raise exception 'plano_parcela_invalida'; end if;
    v_after := (v_plan->>'apos_parcela')::integer;
    if v_after not between 1 and p_prazo_meses then raise exception 'plano_parcela_invalida'; end if;
  end loop;
  if jsonb_typeof(p_resultado_com_amortizacao) is distinct from 'object'
     or p_resultado_com_amortizacao #>> '{sem_antecipacao,total_pago}' is null
     or p_resultado_com_amortizacao #>> '{com_antecipacao,total_pago}' is null
     or p_resultado_com_amortizacao #>> '{com_antecipacao,total_juros}' is null then raise exception 'resultado_amortizacao_invalido'; end if;

  v_result := public.capture_public_simulacao_amortizacao_lead(
    p_idempotency_key => p_idempotency_key,
    p_nome_completo => p_nome_completo,
    p_email => p_email,
    p_telefone => p_telefone,
    p_valor_credito => p_valor_credito,
    p_prazo_meses => p_prazo_meses,
    p_data_inicio => p_data_inicio,
    p_taxa_juros_informada => p_taxa_juros_informada,
    p_periodicidade_juros => p_periodicidade_juros,
    p_sistema_amortizacao => p_sistema_amortizacao,
    p_quantidade_parcelas => p_quantidade_parcelas,
    p_taxa_juros_mensal => p_taxa_juros_mensal,
    p_primeira_parcela => p_primeira_parcela,
    p_ultima_parcela => p_ultima_parcela,
    p_total_pago => p_total_pago,
    p_total_juros => p_total_juros,
    p_tipo_imovel => p_tipo_imovel,
    p_situacao_imovel => p_situacao_imovel,
    p_cep => p_cep,
    p_renda_mensal => p_renda_mensal,
    p_objetivo_credito => p_objetivo_credito,
    p_tipo_renda => p_tipo_renda,
    p_prazo_contratacao => p_prazo_contratacao,
    p_origem => p_origem,
    p_consentimento_versao => p_consentimento_versao
  );
  if coalesce((v_result->>'created')::boolean, false) is false then return v_result; end if;
  v_lead_id := (v_result->>'lead_id')::uuid;

  update public.simulacao_leads_publicos
     set planos_amortizacao = p_planos_amortizacao,
         resultado_com_amortizacao = p_resultado_com_amortizacao
   where id = v_lead_id;

  v_email_summary := '<hr><h2>Comparativo com os planos de amortização extra</h2>'
    || '<p><strong>Sem antecipação:</strong> total estimado de R$ ' || to_char((p_resultado_com_amortizacao #>> '{sem_antecipacao,total_pago}')::numeric, 'FM999G999G999G990D00')
    || ', juros de R$ ' || to_char((p_resultado_com_amortizacao #>> '{sem_antecipacao,total_juros}')::numeric, 'FM999G999G999G990D00')
    || ' em ' || (p_resultado_com_amortizacao #>> '{sem_antecipacao,quantidade_parcelas}') || ' parcelas.</p>'
    || '<p><strong>Com os planos:</strong> total estimado de R$ ' || to_char((p_resultado_com_amortizacao #>> '{com_antecipacao,total_pago}')::numeric, 'FM999G999G999G990D00')
    || ', juros de R$ ' || to_char((p_resultado_com_amortizacao #>> '{com_antecipacao,total_juros}')::numeric, 'FM999G999G999G990D00')
    || ' em ' || (p_resultado_com_amortizacao #>> '{com_antecipacao,quantidade_parcelas}') || ' parcelas.</p>'
    || '<p>Economia estimada em juros: R$ ' || to_char(greatest((p_resultado_com_amortizacao->>'economia_juros')::numeric, 0), 'FM999G999G999G990D00') || '.</p>'
    || '<p>Esta simulação é estimativa e não representa aprovação de crédito.</p>';

  update public.email_outbox set corpo = corpo || v_email_summary
   where origem = 'simulacao_publica' and referencia_id = v_lead_id;

  perform public.registrar_audit('simulacao_publica_planos_amortizacao_capturados', 'simulacao_leads_publicos', v_lead_id, null,
    jsonb_build_object('quantidade_planos', jsonb_array_length(p_planos_amortizacao), 'resultado_com_amortizacao', p_resultado_com_amortizacao));

  return v_result || jsonb_build_object('planos_amortizacao', jsonb_array_length(p_planos_amortizacao));
end;
$$;

revoke all on function public.capture_public_simulacao_amortizacao_lead_v2(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.capture_public_simulacao_amortizacao_lead_v2(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text,jsonb,jsonb) to service_role;
