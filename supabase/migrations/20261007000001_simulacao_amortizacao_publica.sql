-- SIMULADOR PÚBLICO — CAPTURA DO MODO AMORTIZAÇÃO
-- A migration é aditiva e mantém os registros Home Equity já existentes.

alter table public.simulacao_leads_publicos
  add column if not exists tipo_simulacao text not null default 'home_equity',
  add column if not exists data_inicio date,
  add column if not exists periodicidade_juros text,
  add column if not exists sistema_amortizacao text,
  add column if not exists quantidade_parcelas integer,
  add column if not exists taxa_juros_informada numeric(8,4),
  add column if not exists primeira_parcela numeric(14,2),
  add column if not exists ultima_parcela numeric(14,2),
  add column if not exists total_pago numeric(14,2),
  add column if not exists total_juros numeric(14,2);

alter table public.simulacao_leads_publicos
  alter column valor_imovel drop not null,
  alter column ltv drop not null,
  alter column tipo_imovel drop not null,
  alter column situacao_imovel drop not null,
  alter column cep drop not null;

alter table public.simulacao_leads_publicos
  drop constraint if exists simulacao_leads_publicos_valor_imovel_check,
  drop constraint if exists simulacao_leads_publicos_valor_credito_check,
  drop constraint if exists simulacao_leads_publicos_prazo_meses_check,
  drop constraint if exists simulacao_leads_publicos_ltv_check,
  drop constraint if exists simulacao_leads_publicos_cep_check;

alter table public.simulacao_leads_publicos
  add constraint simulacao_leads_publicos_tipo_simulacao_check
    check (tipo_simulacao in ('home_equity', 'amortizacao')),
  add constraint simulacao_leads_publicos_operacao_check
    check (
      (
        tipo_simulacao = 'home_equity'
        and valor_imovel is not null and valor_imovel >= 280000
        and valor_credito >= 100000
        and prazo_meses between 12 and 240
        and ltv is not null and ltv between 0 and 1
        and tipo_imovel is not null and situacao_imovel is not null
        and cep is not null and cep ~ '^[0-9]{8}$'
      )
      or (
        tipo_simulacao = 'amortizacao'
        and valor_credito > 0
        and prazo_meses between 1 and 320
        and data_inicio is not null
        and periodicidade_juros in ('mensal', 'anual')
        and sistema_amortizacao in ('price', 'sac')
        and quantidade_parcelas between 1 and 320
        and taxa_juros_informada is not null and taxa_juros_informada between 0 and 100
        and primeira_parcela is not null and primeira_parcela >= 0
        and ultima_parcela is not null and ultima_parcela >= 0
        and total_pago is not null and total_pago >= 0
        and total_juros is not null and total_juros >= 0
      )
    );

create index if not exists simulacao_leads_publicos_tipo_created_idx
  on public.simulacao_leads_publicos (tipo_simulacao, created_at desc);

drop view if exists public.v_admin_simulacao_leads_publicos;

create view public.v_admin_simulacao_leads_publicos
  with (security_invoker = on)
as
  select
    id,
    tipo_simulacao,
    nome_completo,
    email,
    telefone,
    consentimento_em,
    consentimento_versao,
    valor_imovel,
    valor_credito,
    prazo_meses,
    taxa_juros_mensal,
    parcela_estimada,
    ltv,
    tipo_imovel,
    situacao_imovel,
    cep,
    renda_mensal,
    objetivo_credito,
    tipo_renda,
    prazo_contratacao,
    origem,
    data_inicio,
    periodicidade_juros,
    sistema_amortizacao,
    quantidade_parcelas,
    taxa_juros_informada,
    primeira_parcela,
    ultima_parcela,
    total_pago,
    total_juros,
    status_email_prospect,
    status_email_interno,
    created_at,
    updated_at
  from public.simulacao_leads_publicos;

revoke all on public.v_admin_simulacao_leads_publicos from public, anon;
grant select on public.v_admin_simulacao_leads_publicos to authenticated;

create or replace function public.app_template_is_critical(p_codigo text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_codigo, '') = any(array[
    'convite_equipe_v1',
    'proposta_cliente_magic_link_v1',
    'proposta_status_changed_v1',
    'simulacao_publica_resultado_v1',
    'simulacao_publica_novo_lead_interno_v1',
    'simulacao_publica_amortizacao_resultado_v1',
    'simulacao_publica_amortizacao_novo_lead_interno_v1'
  ]::text[])
$$;

insert into public.templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo)
values
(
  'simulacao_publica_amortizacao_resultado_v1',
  'email',
  'Resultado do simulador de amortização',
  'Sua simulação de amortização foi recebida',
  E'<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#102f52;background:#fff">\n  <div style="background:#0b0b0d;padding:28px 32px;text-align:center"><strong style="color:#fff;font-size:22px;letter-spacing:.08em">MERCÚRIO CAPITAL</strong></div>\n  <div style="padding:34px 32px">\n    <p style="display:inline-block;margin:0 0 22px;padding:10px 16px;border-radius:999px;background:#eff5ff;color:#113de6;font-weight:700">Sua solicitação foi recebida</p>\n    <h1 style="font-size:28px;margin:0 0 12px;color:#101010">Olá, {{nome}}!</h1>\n    <p style="font-size:17px;line-height:1.55;color:#454545">Recebemos sua simulação de amortização. Confira o resumo estimado:</p>\n    <div style="margin:24px 0;padding:24px;border-radius:18px;background:#132de4;color:#fff">\n      <div style="font-size:14px;letter-spacing:.08em;opacity:.8">VALOR DO EMPRÉSTIMO</div>\n      <div style="font-size:30px;font-weight:700;margin-top:8px">{{valor_credito}}</div>\n    </div>\n    <div style="padding:22px;border:1px solid #dedede;border-radius:18px">\n      <p style="margin:0 0 12px;color:#777">Sistema <strong style="color:#111">{{sistema_amortizacao}}</strong></p>\n      <p style="margin:0 0 12px;color:#777">Primeira parcela <strong style="color:#111">{{primeira_parcela}}</strong></p>\n      <p style="margin:0 0 12px;color:#777">Total de juros <strong style="color:#111">{{total_juros}}</strong></p>\n      <p style="margin:0;color:#777">Prazo <strong style="color:#111">{{quantidade_parcelas}} parcelas</strong></p>\n    </div>\n    <p style="font-size:16px;line-height:1.55;color:#454545">Nossa equipe poderá entrar em contato para entender sua necessidade e apresentar os próximos passos.</p>\n    <p style="text-align:center;margin:28px 0"><a href="{{contato_url}}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#132de4;color:#fff;text-decoration:none;font-weight:700">Falar com a equipe</a></p>\n    <p style="padding:16px;border-radius:14px;background:#eff5ff;color:#113de6;font-size:14px">Esta simulação não representa aprovação imediata. IOF, tarifas, análise de crédito e condições finais podem alterar os valores.</p>\n  </div>\n</div>',
  '{nome,valor_credito,sistema_amortizacao,primeira_parcela,total_juros,quantidade_parcelas,contato_url}',
  true
),
(
  'simulacao_publica_amortizacao_novo_lead_interno_v1',
  'email',
  'Novo lead do simulador de amortização',
  'Novo lead de amortização: {{nome}}',
  E'<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#102f52">\n  <h1>Novo lead do simulador de amortização</h1>\n  <p><strong>{{nome}}</strong> enviou uma simulação em {{criado_em}}.</p>\n  <table style="width:100%;border-collapse:collapse">\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">E-mail</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{email}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Telefone</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{telefone}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Empréstimo</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{valor_credito}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Sistema</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{sistema_amortizacao}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Primeira parcela</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{primeira_parcela}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Prazo</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{quantidade_parcelas}} parcelas</strong></td></tr>\n  </table>\n  <p style="margin-top:24px"><a href="{{admin_link}}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#132de4;color:#fff;text-decoration:none;font-weight:700">Abrir leads no Admin</a></p>\n</div>',
  '{nome,email,telefone,valor_credito,sistema_amortizacao,primeira_parcela,quantidade_parcelas,criado_em,admin_link}',
  true
)
on conflict (codigo) do update
set canal = excluded.canal,
    nome = excluded.nome,
    assunto = excluded.assunto,
    corpo = excluded.corpo,
    variaveis = excluded.variaveis,
    ativo = true,
    updated_at = now();

create or replace function public.capture_public_simulacao_amortizacao_lead(
  p_idempotency_key      uuid,
  p_nome_completo        text,
  p_email                text,
  p_telefone             text,
  p_valor_credito        numeric,
  p_prazo_meses          integer,
  p_data_inicio          date,
  p_taxa_juros_informada numeric,
  p_periodicidade_juros  text,
  p_sistema_amortizacao  text,
  p_quantidade_parcelas  integer,
  p_taxa_juros_mensal    numeric,
  p_primeira_parcela     numeric,
  p_ultima_parcela       numeric,
  p_total_pago            numeric,
  p_total_juros          numeric,
  p_tipo_imovel          text,
  p_situacao_imovel      text,
  p_cep                  text,
  p_renda_mensal         numeric default null,
  p_objetivo_credito     text default null,
  p_tipo_renda           text default null,
  p_prazo_contratacao    text default null,
  p_origem               text default null,
  p_consentimento_versao text default 'simulador_publico_v2'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.simulacao_leads_publicos%rowtype;
  v_created boolean := false;
  v_template_prospect public.templates_mensagem%rowtype;
  v_template_interno public.templates_mensagem%rowtype;
  v_vars jsonb;
  v_assunto text;
  v_corpo text;
  v_contato_url text;
  v_internal_count int := 0;
  v_admin record;
  v_taxa_mensal numeric;
  v_primeira numeric;
  v_ultima numeric;
  v_total_pago numeric;
  v_total_juros numeric;
  v_amortizacao numeric;
begin
  if p_idempotency_key is null then raise exception 'idempotency_key_obrigatoria'; end if;
  if length(btrim(coalesce(p_nome_completo, ''))) < 3 then raise exception 'nome_invalido'; end if;
  if lower(btrim(coalesce(p_email, ''))) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'email_invalido'; end if;
  if coalesce(p_telefone, '') !~ '^[0-9]{10,11}$' then raise exception 'telefone_invalido'; end if;
  if p_valor_credito is null or p_valor_credito <= 0 then raise exception 'valor_credito_invalido'; end if;
  if p_prazo_meses is null or p_prazo_meses not between 1 and 320 then raise exception 'prazo_invalido'; end if;
  if p_quantidade_parcelas is null or p_quantidade_parcelas <> p_prazo_meses then raise exception 'quantidade_parcelas_invalida'; end if;
  if p_data_inicio is null then raise exception 'data_inicio_invalida'; end if;
  if p_periodicidade_juros not in ('mensal', 'anual') then raise exception 'periodicidade_invalida'; end if;
  if p_sistema_amortizacao not in ('price', 'sac') then raise exception 'sistema_amortizacao_invalido'; end if;
  if p_taxa_juros_informada is null or p_taxa_juros_informada not between 0 and 100 then raise exception 'taxa_invalida'; end if;
  if p_taxa_juros_mensal is null or p_taxa_juros_mensal < 0 then raise exception 'taxa_mensal_invalida'; end if;
  if p_primeira_parcela is null or p_primeira_parcela < 0 or p_ultima_parcela is null or p_ultima_parcela < 0 then raise exception 'parcelas_invalidas'; end if;
  if p_total_pago is null or p_total_pago < 0 or p_total_juros is null or p_total_juros < 0 then raise exception 'totais_invalidos'; end if;
  if coalesce(p_tipo_imovel, '') = '' or coalesce(p_situacao_imovel, '') = '' or coalesce(p_cep, '') !~ '^[0-9]{8}$' then raise exception 'garantia_invalida'; end if;
  if p_renda_mensal is not null and p_renda_mensal < 0 then raise exception 'renda_invalida'; end if;

  v_taxa_mensal := case
    when p_periodicidade_juros = 'anual' then power(1 + p_taxa_juros_informada / 100, 1.0 / 12) - 1
    else p_taxa_juros_informada / 100
  end;
  if abs(p_taxa_juros_mensal / 100 - v_taxa_mensal) > 0.000001 then raise exception 'taxa_mensal_invalida'; end if;
  if p_sistema_amortizacao = 'price' then
    v_primeira := case when v_taxa_mensal = 0 then p_valor_credito / p_quantidade_parcelas else (p_valor_credito * v_taxa_mensal) / (1 - power(1 + v_taxa_mensal, -p_quantidade_parcelas)) end;
    v_ultima := v_primeira;
    v_total_pago := v_primeira * p_quantidade_parcelas;
  else
    v_amortizacao := p_valor_credito / p_quantidade_parcelas;
    v_primeira := v_amortizacao + p_valor_credito * v_taxa_mensal;
    v_ultima := v_amortizacao + v_amortizacao * v_taxa_mensal;
    v_total_pago := p_valor_credito + p_valor_credito * v_taxa_mensal * (p_quantidade_parcelas + 1) / 2;
  end if;
  v_total_juros := greatest(v_total_pago - p_valor_credito, 0);
  if abs(p_primeira_parcela - v_primeira) > 0.10 or abs(p_ultima_parcela - v_ultima) > 0.10 or abs(p_total_pago - v_total_pago) > 0.10 or abs(p_total_juros - v_total_juros) > 0.10 then
    raise exception 'resumo_calculo_invalido';
  end if;

  insert into public.simulacao_leads_publicos (
    idempotency_key, tipo_simulacao, nome_completo, email, telefone,
    valor_imovel, valor_credito, prazo_meses, taxa_juros_mensal,
    parcela_estimada, ltv, tipo_imovel, situacao_imovel, cep, renda_mensal,
    objetivo_credito, tipo_renda, prazo_contratacao, origem,
    consentimento_versao, data_inicio, periodicidade_juros, sistema_amortizacao,
    quantidade_parcelas, taxa_juros_informada, primeira_parcela, ultima_parcela,
    total_pago, total_juros, metadata
  ) values (
    p_idempotency_key, 'amortizacao', btrim(p_nome_completo), lower(btrim(p_email)), p_telefone,
    null, round(p_valor_credito, 2), p_prazo_meses, round(v_taxa_mensal * 100, 4),
    round(v_primeira, 2), null, lower(btrim(p_tipo_imovel)), lower(btrim(p_situacao_imovel)), p_cep,
    case when p_renda_mensal is null or p_renda_mensal = 0 then null else round(p_renda_mensal, 2) end,
    nullif(btrim(p_objetivo_credito), ''), nullif(btrim(p_tipo_renda), ''), nullif(btrim(p_prazo_contratacao), ''), nullif(btrim(p_origem), ''),
    coalesce(nullif(btrim(p_consentimento_versao), ''), 'simulador_publico_v2'), p_data_inicio, p_periodicidade_juros, p_sistema_amortizacao,
    p_quantidade_parcelas, round(p_taxa_juros_informada, 4), round(v_primeira, 2), round(v_ultima, 2), round(v_total_pago, 2), round(v_total_juros, 2),
    jsonb_build_object('origem', 'simulador_publico', 'versao', 'amortizacao_v1')
  )
  on conflict (idempotency_key) do nothing
  returning * into v_lead;

  if found then
    v_created := true;
  else
    select * into v_lead from public.simulacao_leads_publicos where idempotency_key = p_idempotency_key;
    if not found then raise exception 'lead_nao_encontrado'; end if;
    return jsonb_build_object('created', false, 'lead_id', v_lead.id, 'parcela_estimada', v_lead.parcela_estimada);
  end if;

  select * into v_template_prospect from public.templates_mensagem where codigo = 'simulacao_publica_amortizacao_resultado_v1' and canal = 'email' and ativo limit 1;
  select * into v_template_interno from public.templates_mensagem where codigo = 'simulacao_publica_amortizacao_novo_lead_interno_v1' and canal = 'email' and ativo limit 1;
  select coalesce(nullif(trim(c.valor #>> '{}'), ''), '') into v_contato_url from public.configuracoes_sistema c where c.chave = 'simulador_contato_url';
  v_contato_url := case when v_contato_url ~* '^https://' then v_contato_url else public.public_app_base_url() || '/simulador' end;

  if v_template_prospect.id is null then
    update public.simulacao_leads_publicos set status_email_prospect = 'sem_template' where id = v_lead.id;
  else
    v_vars := jsonb_build_object(
      'nome', public.html_escape(v_lead.nome_completo),
      'valor_credito', 'R$ ' || to_char(v_lead.valor_credito, 'FM999G999G999G990D00'),
      'sistema_amortizacao', case when v_lead.sistema_amortizacao = 'sac' then 'Tabela SAC — parcelas decrescentes' else 'Tabela Price — parcelas fixas' end,
      'primeira_parcela', 'R$ ' || to_char(v_lead.primeira_parcela, 'FM999G999G999G990D00'),
      'total_juros', 'R$ ' || to_char(v_lead.total_juros, 'FM999G999G999G990D00'),
      'quantidade_parcelas', v_lead.quantidade_parcelas,
      'contato_url', v_contato_url
    );
    v_assunto := public.render_template(v_template_prospect.assunto, v_vars);
    v_corpo := public.render_template(v_template_prospect.corpo, v_vars);
    insert into public.email_outbox (destinatario, assunto, corpo, origem, referencia_id, metadata)
    values (v_lead.email, v_assunto, v_corpo, 'simulacao_publica', v_lead.id, jsonb_build_object('evento', 'simulacao_publica_email', 'destinatario_tipo', 'prospect', 'simulacao_tipo', 'amortizacao', 'template', v_template_prospect.codigo))
    on conflict do nothing;
  end if;

  if v_template_interno.id is null then
    update public.simulacao_leads_publicos set status_email_interno = 'sem_template' where id = v_lead.id;
  else
    for v_admin in select id, email from public.usuarios where role = 'admin' and ativo and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    loop
      v_vars := jsonb_build_object(
        'nome', public.html_escape(v_lead.nome_completo), 'email', public.html_escape(v_lead.email), 'telefone', public.html_escape(v_lead.telefone),
        'valor_credito', 'R$ ' || to_char(v_lead.valor_credito, 'FM999G999G999G990D00'),
        'sistema_amortizacao', case when v_lead.sistema_amortizacao = 'sac' then 'Tabela SAC — parcelas decrescentes' else 'Tabela Price — parcelas fixas' end,
        'primeira_parcela', 'R$ ' || to_char(v_lead.primeira_parcela, 'FM999G999G999G990D00'), 'quantidade_parcelas', v_lead.quantidade_parcelas,
        'criado_em', to_char(v_lead.created_at, 'DD/MM/YYYY HH24:MI'), 'admin_link', public.public_app_base_url() || '/admin/leads/simulacoes'
      );
      v_assunto := public.render_template(v_template_interno.assunto, v_vars);
      v_corpo := public.render_template(v_template_interno.corpo, v_vars);
      insert into public.email_outbox (destinatario, usuario_id, assunto, corpo, origem, referencia_id, metadata)
      values (lower(v_admin.email), v_admin.id, v_assunto, v_corpo, 'simulacao_publica', v_lead.id, jsonb_build_object('evento', 'simulacao_publica_email', 'destinatario_tipo', 'interno', 'simulacao_tipo', 'amortizacao', 'template', v_template_interno.codigo))
      on conflict do nothing;
      v_internal_count := v_internal_count + 1;
    end loop;
    if v_internal_count = 0 then update public.simulacao_leads_publicos set status_email_interno = 'sem_destinatarios' where id = v_lead.id; end if;
  end if;

  return jsonb_build_object('created', v_created, 'lead_id', v_lead.id, 'parcela_estimada', v_lead.parcela_estimada, 'email_prospect', v_lead.status_email_prospect, 'email_interno', v_lead.status_email_interno);
end;
$$;

revoke all on function public.capture_public_simulacao_amortizacao_lead(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.capture_public_simulacao_amortizacao_lead(uuid,text,text,text,numeric,integer,date,numeric,text,text,integer,numeric,numeric,numeric,numeric,numeric,text,text,text,numeric,text,text,text,text,text) to service_role;
