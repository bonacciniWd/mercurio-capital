-- MERX contact details: city, admin lead list, commercial status, atomic rate limit.

alter table public.merx_leads_publicos
  add column if not exists cidade text;

alter table public.merx_leads_publicos
  drop constraint if exists merx_leads_publicos_cidade_check;
alter table public.merx_leads_publicos
  add constraint merx_leads_publicos_cidade_check
  check (cidade is null or char_length(btrim(cidade)) between 2 and 100) not valid;
alter table public.merx_leads_publicos
  validate constraint merx_leads_publicos_cidade_check;

alter table public.lead_status_comercial
  add column if not exists merx_lead_id uuid unique references public.merx_leads_publicos(id) on delete cascade;
alter table public.lead_status_comercial
  drop constraint if exists lead_status_exatamente_uma_origem;
alter table public.lead_status_comercial
  add constraint lead_status_exatamente_uma_origem
  check (num_nonnulls(simulacao_lead_id, cpc_lead_id, merx_lead_id) = 1);

create or replace view public.v_admin_leads_publicos
  with (security_invoker = on)
as
  select
    ('simulacao:' || s.id::text) as id,
    s.tipo_simulacao, s.nome_completo, s.email, s.telefone,
    s.consentimento_em, s.consentimento_versao, s.valor_imovel, s.valor_credito,
    s.prazo_meses, s.taxa_juros_mensal, s.parcela_estimada, s.ltv,
    s.tipo_imovel, s.situacao_imovel, s.cep, s.renda_mensal,
    s.objetivo_credito, s.tipo_renda, s.prazo_contratacao, s.origem,
    s.data_inicio, s.periodicidade_juros, s.sistema_amortizacao,
    s.quantidade_parcelas, s.taxa_juros_informada, s.primeira_parcela,
    s.ultima_parcela, s.total_pago, s.total_juros,
    s.status_email_prospect, s.status_email_interno,
    s.created_at, s.updated_at, s.planos_amortizacao, s.resultado_com_amortizacao,
    null::text as cidade, null::text as uf, null::text as fase_projeto, null::text as resumo_projeto,
    coalesce(ls.status, 'novo') as status_comercial,
    ls.updated_at as status_comercial_updated_at,
    ls.updated_by as status_comercial_updated_by,
    null::text as interesse
  from public.v_admin_simulacao_leads_publicos s
  left join public.lead_status_comercial ls on ls.simulacao_lead_id = s.id
  union all
  select
    ('cpc:' || c.id::text) as id,
    'cpc'::text as tipo_simulacao, c.nome_completo, c.email, c.telefone,
    c.consentimento_em, c.consentimento_versao,
    null::numeric as valor_imovel, null::numeric as valor_credito,
    null::integer as prazo_meses, null::numeric as taxa_juros_mensal,
    null::numeric as parcela_estimada, null::numeric as ltv,
    null::text as tipo_imovel, null::text as situacao_imovel,
    null::text as cep, null::numeric as renda_mensal,
    null::text as objetivo_credito, null::text as tipo_renda,
    null::text as prazo_contratacao, c.origem,
    null::date as data_inicio, null::text as periodicidade_juros,
    null::text as sistema_amortizacao, null::integer as quantidade_parcelas,
    null::numeric as taxa_juros_informada, null::numeric as primeira_parcela,
    null::numeric as ultima_parcela, null::numeric as total_pago,
    null::numeric as total_juros,
    null::text as status_email_prospect, null::text as status_email_interno,
    c.created_at, c.created_at as updated_at,
    null::jsonb as planos_amortizacao, null::jsonb as resultado_com_amortizacao,
    c.cidade, c.uf, c.fase_projeto, c.resumo_projeto,
    coalesce(ls.status, 'novo') as status_comercial,
    ls.updated_at as status_comercial_updated_at,
    ls.updated_by as status_comercial_updated_by,
    null::text as interesse
  from public.cpc_leads_publicos c
  left join public.lead_status_comercial ls on ls.cpc_lead_id = c.id
  union all
  select
    ('merx:' || m.id::text) as id,
    'merx'::text as tipo_simulacao, m.nome_completo, m.email, m.telefone,
    m.consentimento_em, m.consentimento_versao,
    null::numeric as valor_imovel, null::numeric as valor_credito,
    null::integer as prazo_meses, null::numeric as taxa_juros_mensal,
    null::numeric as parcela_estimada, null::numeric as ltv,
    null::text as tipo_imovel, null::text as situacao_imovel,
    null::text as cep, null::numeric as renda_mensal,
    null::text as objetivo_credito, null::text as tipo_renda,
    null::text as prazo_contratacao, m.origem,
    null::date as data_inicio, null::text as periodicidade_juros,
    null::text as sistema_amortizacao, null::integer as quantidade_parcelas,
    null::numeric as taxa_juros_informada, null::numeric as primeira_parcela,
    null::numeric as ultima_parcela, null::numeric as total_pago,
    null::numeric as total_juros,
    null::text as status_email_prospect, null::text as status_email_interno,
    m.created_at, m.created_at as updated_at,
    null::jsonb as planos_amortizacao, null::jsonb as resultado_com_amortizacao,
    m.cidade, null::text as uf, null::text as fase_projeto, null::text as resumo_projeto,
    coalesce(ls.status, 'novo') as status_comercial,
    ls.updated_at as status_comercial_updated_at,
    ls.updated_by as status_comercial_updated_by,
    m.interesse
  from public.merx_leads_publicos m
  left join public.lead_status_comercial ls on ls.merx_lead_id = m.id;

revoke all on public.v_admin_leads_publicos from public, anon;
grant select on public.v_admin_leads_publicos to authenticated;

create or replace function public.admin_set_lead_status_comercial(
  p_lead_id text,
  p_novo_status text,
  p_status_esperado text
)
returns table(status_comercial text, status_comercial_updated_at timestamptz, status_comercial_updated_by uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origem text;
  v_origem_id uuid;
  v_estado public.lead_status_comercial%rowtype;
  v_status_atual text;
begin
  if not public.app_is_admin_operacional() or auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_novo_status is null or p_novo_status not in ('novo', 'em_contato', 'qualificado')
     or p_status_esperado is null or p_status_esperado not in ('novo', 'em_contato', 'qualificado') then
    raise exception 'status_comercial_invalido' using errcode = '22023';
  end if;
  if p_lead_id is null or p_lead_id !~ '^(simulacao|cpc|merx):[0-9a-fA-F-]{36}$' then
    raise exception 'lead_id_invalido' using errcode = '22023';
  end if;
  v_origem := split_part(p_lead_id, ':', 1);
  begin
    v_origem_id := split_part(p_lead_id, ':', 2)::uuid;
  exception when invalid_text_representation then
    raise exception 'lead_id_invalido' using errcode = '22023';
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_lead_id, 0));
  if v_origem = 'simulacao' then
    perform 1 from public.simulacao_leads_publicos where id = v_origem_id;
  elsif v_origem = 'cpc' then
    perform 1 from public.cpc_leads_publicos where id = v_origem_id;
  else
    perform 1 from public.merx_leads_publicos where id = v_origem_id;
  end if;
  if not found then raise exception 'lead_nao_encontrado' using errcode = 'P0002'; end if;

  select * into v_estado from public.lead_status_comercial
  where (v_origem = 'simulacao' and simulacao_lead_id = v_origem_id)
     or (v_origem = 'cpc' and cpc_lead_id = v_origem_id)
     or (v_origem = 'merx' and merx_lead_id = v_origem_id)
  for update;
  v_status_atual := coalesce(v_estado.status, 'novo');
  if v_status_atual <> p_status_esperado then
    raise exception 'status_comercial_conflito' using errcode = '40001';
  end if;
  if v_status_atual = p_novo_status then
    return query select v_status_atual, v_estado.updated_at, v_estado.updated_by;
    return;
  end if;

  if v_estado.id is null then
    insert into public.lead_status_comercial (simulacao_lead_id, cpc_lead_id, merx_lead_id, status, updated_by)
    values (
      case when v_origem = 'simulacao' then v_origem_id end,
      case when v_origem = 'cpc' then v_origem_id end,
      case when v_origem = 'merx' then v_origem_id end,
      p_novo_status, auth.uid()
    ) returning * into v_estado;
  else
    update public.lead_status_comercial
      set status = p_novo_status, updated_at = now(), updated_by = auth.uid()
      where id = v_estado.id returning * into v_estado;
  end if;
  insert into public.lead_status_comercial_historico
    (lead_status_id, status_anterior, status_novo, alterado_por)
  values (v_estado.id, v_status_atual, p_novo_status, auth.uid());
  return query select v_estado.status, v_estado.updated_at, v_estado.updated_by;
end;
$$;

revoke all on function public.admin_set_lead_status_comercial(text, text, text) from public, anon;
grant execute on function public.admin_set_lead_status_comercial(text, text, text) to authenticated;

-- Atomic hourly limits for email and IP keys. Only service_role can consume them.
create or replace function public.rate_limit_consume_pair(
  p_chave_email text,
  p_chave_ip text,
  p_limite_email integer,
  p_limite_ip integer,
  p_janela interval
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_count integer;
  v_now timestamptz;
begin
  if p_chave_email is null or p_chave_ip is null
     or length(p_chave_email) > 180 or length(p_chave_ip) > 180
     or p_limite_email is null or p_limite_ip is null
     or p_limite_email < 1 or p_limite_ip < 1
     or p_janela is null or p_janela <= interval '0 seconds' or p_janela > interval '1 day' then
    raise exception 'rate_limit_parameters_invalid' using errcode = '22023';
  end if;

  for v_key in
    select key from unnest(array[p_chave_email, p_chave_ip]) as keys(key) order by key
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  end loop;

  -- Start the window after acquiring both locks so contention cannot leave
  -- the cleanup/count checks anchored to a stale transaction start time.
  v_now := clock_timestamp();

  delete from public.rate_limits
  where chave in (p_chave_email, p_chave_ip)
    and janela_inicio < v_now - p_janela;

  select coalesce(sum(contagem), 0) into v_count
  from public.rate_limits where chave = p_chave_email and janela_inicio >= v_now - p_janela;
  if v_count >= p_limite_email then return false; end if;

  select coalesce(sum(contagem), 0) into v_count
  from public.rate_limits where chave = p_chave_ip and janela_inicio >= v_now - p_janela;
  if v_count >= p_limite_ip then return false; end if;

  insert into public.rate_limits (chave, contagem, janela_inicio)
  values (p_chave_email, 1, v_now), (p_chave_ip, 1, v_now)
  on conflict (chave, janela_inicio)
  do update set contagem = public.rate_limits.contagem + 1;
  return true;
end;
$$;

revoke all on function public.rate_limit_consume_pair(text, text, integer, integer, interval) from public, anon, authenticated;
grant execute on function public.rate_limit_consume_pair(text, text, integer, integer, interval) to service_role;
