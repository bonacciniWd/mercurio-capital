-- Acompanhamento comercial dos leads publicos, separado do estado dos e-mails.
create table public.lead_status_comercial (
  id uuid primary key default gen_random_uuid(),
  simulacao_lead_id uuid unique references public.simulacao_leads_publicos(id) on delete cascade,
  cpc_lead_id uuid unique references public.cpc_leads_publicos(id) on delete cascade,
  status text not null check (status in ('novo', 'em_contato', 'qualificado')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint lead_status_exatamente_uma_origem check ((simulacao_lead_id is null) <> (cpc_lead_id is null))
);

create table public.lead_status_comercial_historico (
  id uuid primary key default gen_random_uuid(),
  lead_status_id uuid not null references public.lead_status_comercial(id) on delete cascade,
  status_anterior text not null check (status_anterior in ('novo', 'em_contato', 'qualificado')),
  status_novo text not null check (status_novo in ('novo', 'em_contato', 'qualificado')),
  alterado_em timestamptz not null default now(),
  alterado_por uuid references auth.users(id) on delete set null,
  check (status_anterior <> status_novo)
);
create index lead_status_comercial_historico_lead_idx
  on public.lead_status_comercial_historico (lead_status_id, alterado_em desc);

alter table public.lead_status_comercial enable row level security;
alter table public.lead_status_comercial_historico enable row level security;
create policy lead_status_comercial_admin_read on public.lead_status_comercial
  for select to authenticated using (public.app_is_admin());
create policy lead_status_comercial_historico_admin_read on public.lead_status_comercial_historico
  for select to authenticated using (public.app_is_admin());
revoke all on public.lead_status_comercial, public.lead_status_comercial_historico from public, anon, authenticated;
grant select on public.lead_status_comercial, public.lead_status_comercial_historico to authenticated;

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
    ls.updated_by as status_comercial_updated_by
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
    ls.updated_by as status_comercial_updated_by
  from public.cpc_leads_publicos c
  left join public.lead_status_comercial ls on ls.cpc_lead_id = c.id;

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
  if p_lead_id is null or p_lead_id !~ '^(simulacao|cpc):[0-9a-fA-F-]{36}$' then
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
  else
    perform 1 from public.cpc_leads_publicos where id = v_origem_id;
  end if;
  if not found then raise exception 'lead_nao_encontrado' using errcode = 'P0002'; end if;

  select * into v_estado from public.lead_status_comercial
  where (v_origem = 'simulacao' and simulacao_lead_id = v_origem_id)
     or (v_origem = 'cpc' and cpc_lead_id = v_origem_id)
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
    insert into public.lead_status_comercial (simulacao_lead_id, cpc_lead_id, status, updated_by)
    values (
      case when v_origem = 'simulacao' then v_origem_id end,
      case when v_origem = 'cpc' then v_origem_id end,
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
