-- =============================================
-- SIMULADOR PÚBLICO V2 — CAPTURA DE LEADS E E-MAILS
-- =============================================

create table if not exists public.simulacao_leads_publicos (
  id                      uuid primary key default gen_random_uuid(),
  idempotency_key         uuid not null unique,
  nome_completo           text not null check (char_length(btrim(nome_completo)) between 3 and 160),
  email                   text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  telefone                text not null check (telefone ~ '^[0-9]{10,11}$'),
  consentimento_em        timestamptz not null default now(),
  consentimento_versao    text not null default 'simulador_publico_v2',
  valor_imovel            numeric(14,2) not null check (valor_imovel >= 280000),
  valor_credito           numeric(14,2) not null check (valor_credito >= 100000),
  prazo_meses             int not null check (prazo_meses between 12 and 240),
  taxa_juros_mensal       numeric(6,4) not null check (taxa_juros_mensal >= 0),
  parcela_estimada        numeric(14,2) not null check (parcela_estimada >= 0),
  ltv                     numeric(6,4) not null check (ltv between 0 and 1),
  tipo_imovel             text not null,
  situacao_imovel         text not null,
  cep                     text not null check (cep ~ '^[0-9]{8}$'),
  renda_mensal            numeric(14,2) check (renda_mensal is null or renda_mensal >= 0),
  objetivo_credito        text,
  tipo_renda              text,
  prazo_contratacao       text,
  origem                  text,
  status_email_prospect   text not null default 'pendente'
                            check (status_email_prospect in ('pendente','enviado','erro','sem_template')),
  status_email_interno    text not null default 'pendente'
                            check (status_email_interno in ('pendente','enviado','erro','sem_destinatarios','sem_template')),
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists simulacao_leads_publicos_created_idx
  on public.simulacao_leads_publicos (created_at desc);
create index if not exists simulacao_leads_publicos_email_idx
  on public.simulacao_leads_publicos (lower(email), created_at desc);
create index if not exists simulacao_leads_publicos_email_status_idx
  on public.simulacao_leads_publicos (status_email_prospect, status_email_interno);

alter table public.simulacao_leads_publicos enable row level security;
drop policy if exists simulacao_leads_publicos_admin_read on public.simulacao_leads_publicos;
create policy simulacao_leads_publicos_admin_read on public.simulacao_leads_publicos
  for select using (public.app_is_admin());

drop trigger if exists trg_simulacao_leads_publicos_updated_at on public.simulacao_leads_publicos;
create trigger trg_simulacao_leads_publicos_updated_at
  before update on public.simulacao_leads_publicos
  for each row execute function public.set_updated_at();

create or replace function public.html_escape(p_value text)
returns text
language sql
immutable
as $$
  select replace(
    replace(
      replace(
        replace(
          replace(coalesce(p_value, ''), '&', '&amp;'),
          '<', '&lt;'
        ),
        '>', '&gt;'
      ),
      '"', '&quot;'
    ),
    '''', '&#39;'
  )
$$;

revoke all on function public.html_escape(text) from public;
grant execute on function public.html_escape(text) to service_role;

create or replace view public.v_admin_simulacao_leads_publicos
  with (security_invoker = on)
as
  select
    id,
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
    status_email_prospect,
    status_email_interno,
    created_at,
    updated_at
  from public.simulacao_leads_publicos;

revoke all on public.v_admin_simulacao_leads_publicos from public, anon;
revoke all on public.simulacao_leads_publicos from public, anon;
grant select on public.v_admin_simulacao_leads_publicos to authenticated;
grant select on public.simulacao_leads_publicos to authenticated;

insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'simulador_contato_url',
  to_jsonb(''::text),
  'URL pública opcional usada como CTA nos e-mails do simulador.'
), (
  'rate_limit_simulador_publico',
  '{"max":3,"janela_min":60}'::jsonb,
  'Limite de envios do simulador público por e-mail e origem de rede.'
)
on conflict (chave) do nothing;

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
    'simulacao_publica_novo_lead_interno_v1'
  ]::text[])
$$;

revoke all on function public.app_template_is_critical(text) from public;
grant execute on function public.app_template_is_critical(text) to authenticated, service_role;

insert into public.templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo)
values
(
  'simulacao_publica_resultado_v1',
  'email',
  'Resultado do simulador público',
  'Sua simulação de crédito foi recebida',
  E'<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#102f52;background:#fff">\n  <div style="background:#0b0b0d;padding:28px 32px;text-align:center"><strong style="color:#fff;font-size:22px;letter-spacing:.08em">MERCÚRIO CAPITAL</strong></div>\n  <div style="padding:34px 32px">\n    <p style="display:inline-block;margin:0 0 22px;padding:10px 16px;border-radius:999px;background:#eff5ff;color:#113de6;font-weight:700">Sua solicitação foi recebida</p>\n    <h1 style="font-size:28px;margin:0 0 12px;color:#101010">Olá, {{nome}}!</h1>\n    <p style="font-size:17px;line-height:1.55;color:#454545">Recebemos sua simulação de crédito com garantia de imóvel. Confira os valores estimados:</p>\n    <div style="margin:24px 0;padding:24px;border-radius:18px;background:#132de4;color:#fff">\n      <div style="font-size:14px;letter-spacing:.08em;opacity:.8">VALOR DO CRÉDITO</div>\n      <div style="font-size:30px;font-weight:700;margin-top:8px">{{valor_credito}}</div>\n    </div>\n    <div style="padding:22px;border:1px solid #dedede;border-radius:18px">\n      <span style="display:inline-block;width:48%;color:#777">VALOR DA PARCELA<br><strong style="display:block;color:#111;font-size:18px;margin-top:5px">{{parcela_estimada}}</strong></span>\n      <span style="display:inline-block;width:48%;color:#777">TOTAL DE MESES<br><strong style="display:block;color:#111;font-size:18px;margin-top:5px">{{prazo_meses}} meses</strong></span>\n    </div>\n    <p style="font-size:16px;line-height:1.55;color:#454545">Nossa equipe poderá entrar em contato para entender sua necessidade e apresentar os próximos passos.</p>\n    <p style="text-align:center;margin:28px 0"><a href="{{contato_url}}" style="display:inline-block;padding:15px 26px;border-radius:999px;background:#132de4;color:#fff;text-decoration:none;font-weight:700">Falar com a equipe</a></p>\n    <p style="padding:16px;border-radius:14px;background:#eff5ff;color:#113de6;font-size:14px">Esta simulação não representa aprovação imediata. IOF, tarifas, análise de crédito e condições finais podem alterar os valores.</p>\n    <p style="margin-top:32px;font-weight:700;color:#113de6">Atenciosamente,<br><span style="color:#111">Equipe Mercúrio Capital</span></p>\n  </div>\n</div>',
  '{nome,valor_credito,parcela_estimada,prazo_meses,contato_url}',
  true
),
(
  'simulacao_publica_novo_lead_interno_v1',
  'email',
  'Novo lead do simulador público',
  'Novo lead do simulador: {{nome}}',
  E'<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#102f52">\n  <h1>Novo lead recebido pelo simulador</h1>\n  <p><strong>{{nome}}</strong> enviou uma simulação em {{criado_em}}.</p>\n  <table style="width:100%;border-collapse:collapse">\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">E-mail</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{email}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Telefone</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{telefone}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Crédito</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{valor_credito}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Parcela estimada</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{parcela_estimada}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Imóvel</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{tipo_imovel}} · {{situacao_imovel}}</strong></td></tr>\n    <tr><td style="padding:8px;border-bottom:1px solid #ddd">Perfil</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>{{objetivo_credito}} · {{tipo_renda}}</strong></td></tr>\n  </table>\n  <p style="margin-top:24px"><a href="{{admin_link}}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#132de4;color:#fff;text-decoration:none;font-weight:700">Abrir leads no Admin</a></p>\n</div>',
  '{nome,email,telefone,valor_credito,parcela_estimada,tipo_imovel,situacao_imovel,objetivo_credito,tipo_renda,criado_em,admin_link}',
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

create unique index if not exists email_outbox_public_simulacao_event_uidx
  on public.email_outbox (
    referencia_id,
    (metadata->>'evento'),
    (metadata->>'destinatario_tipo'),
    destinatario
  )
  where metadata->>'evento' = 'simulacao_publica_email';

create or replace function public.sync_public_simulacao_email_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_tipo text;
begin
  if new.referencia_id is null or new.metadata->>'evento' <> 'simulacao_publica_email' then
    return new;
  end if;

  v_tipo := new.metadata->>'destinatario_tipo';
  v_status := case new.status
    when 'enviado' then 'enviado'
    when 'erro' then 'erro'
    else 'pendente'
  end;

  if v_tipo = 'prospect' then
    update public.simulacao_leads_publicos
       set status_email_prospect = v_status,
           updated_at = now()
     where id = new.referencia_id;
  elsif v_tipo = 'interno' then
    update public.simulacao_leads_publicos
       set status_email_interno = v_status,
           updated_at = now()
     where id = new.referencia_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_public_simulacao_email_status() from public;
grant execute on function public.sync_public_simulacao_email_status() to service_role;

drop trigger if exists trg_sync_public_simulacao_email_status on public.email_outbox;
create trigger trg_sync_public_simulacao_email_status
  after insert or update of status on public.email_outbox
  for each row execute function public.sync_public_simulacao_email_status();

create or replace function public.capture_public_simulacao_lead(
  p_idempotency_key      uuid,
  p_nome_completo        text,
  p_email                text,
  p_telefone             text,
  p_valor_imovel         numeric,
  p_valor_credito        numeric,
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
  v_max_ltv numeric;
  v_ltv numeric;
  v_taxa numeric := 1.29;
  v_prazo int := 240;
  v_parcela numeric;
  v_contato_url text;
  v_internal_count int := 0;
  v_admin record;
begin
  if p_idempotency_key is null then raise exception 'idempotency_key_obrigatoria'; end if;
  if length(btrim(coalesce(p_nome_completo, ''))) < 3 then raise exception 'nome_invalido'; end if;
  if lower(btrim(coalesce(p_email, ''))) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'email_invalido'; end if;
  if coalesce(p_telefone, '') !~ '^[0-9]{10,11}$' then raise exception 'telefone_invalido'; end if;
  if p_valor_imovel is null or p_valor_imovel < 280000 then raise exception 'valor_imovel_invalido'; end if;
  if p_valor_credito is null or p_valor_credito < 100000 then raise exception 'valor_credito_invalido'; end if;
  if coalesce(p_cep, '') !~ '^[0-9]{8}$' then raise exception 'cep_invalido'; end if;
  if p_renda_mensal is not null and p_renda_mensal < 0 then raise exception 'renda_invalida'; end if;

  v_max_ltv := case lower(coalesce(p_tipo_imovel, ''))
    when 'apartamento' then 0.60
    when 'casa' then 0.50
    when 'casa_condominio' then 0.50
    when 'comercial' then 0.40
    when 'predio' then 0.40
    when 'galpao' then 0.40
    when 'fabrica' then 0.40
    when 'terreno' then 0.30
    when 'terreno_condominio' then 0.30
    else 0.40
  end;
  if p_valor_credito > floor(p_valor_imovel * v_max_ltv) then
    raise exception 'valor_credito_acima_do_limite';
  end if;

  v_ltv := p_valor_credito / nullif(p_valor_imovel, 0);
  v_parcela := round(
    case when v_taxa = 0 then p_valor_credito / v_prazo
         else p_valor_credito * (v_taxa / 100) / (1 - power(1 + v_taxa / 100, -v_prazo))
    end,
    2
  );

  insert into public.simulacao_leads_publicos (
    idempotency_key, nome_completo, email, telefone, valor_imovel, valor_credito,
    prazo_meses, taxa_juros_mensal, parcela_estimada, ltv, tipo_imovel,
    situacao_imovel, cep, renda_mensal, objetivo_credito, tipo_renda,
    prazo_contratacao, origem, consentimento_versao, metadata
  ) values (
    p_idempotency_key,
    btrim(p_nome_completo),
    lower(btrim(p_email)),
    p_telefone,
    round(p_valor_imovel, 2),
    round(p_valor_credito, 2),
    v_prazo,
    v_taxa,
    v_parcela,
    v_ltv,
    lower(btrim(coalesce(p_tipo_imovel, 'outros'))),
    lower(btrim(coalesce(p_situacao_imovel, ''))),
    p_cep,
    case when p_renda_mensal is null or p_renda_mensal = 0 then null else round(p_renda_mensal, 2) end,
    nullif(btrim(p_objetivo_credito), ''),
    nullif(btrim(p_tipo_renda), ''),
    nullif(btrim(p_prazo_contratacao), ''),
    nullif(btrim(p_origem), ''),
    coalesce(nullif(btrim(p_consentimento_versao), ''), 'simulador_publico_v2'),
    jsonb_build_object('origem', 'simulador_publico', 'versao', 'v2')
  )
  on conflict (idempotency_key) do nothing
  returning * into v_lead;

  if found then
    v_created := true;
  else
    select * into v_lead from public.simulacao_leads_publicos where idempotency_key = p_idempotency_key;
    if not found then raise exception 'lead_nao_encontrado'; end if;
    return jsonb_build_object('created', false, 'lead_id', v_lead.id, 'parcela_estimada', v_lead.parcela_estimada, 'ltv', v_lead.ltv);
  end if;

  select * into v_template_prospect
    from public.templates_mensagem
   where codigo = 'simulacao_publica_resultado_v1' and canal = 'email' and ativo
   limit 1;
  select * into v_template_interno
    from public.templates_mensagem
   where codigo = 'simulacao_publica_novo_lead_interno_v1' and canal = 'email' and ativo
   limit 1;

  select coalesce(nullif(trim(c.valor #>> '{}'), ''), '')
    into v_contato_url
    from public.configuracoes_sistema c
   where c.chave = 'simulador_contato_url';
  v_contato_url := case when v_contato_url ~* '^https://' then v_contato_url else public.public_app_base_url() || '/simulador' end;

  if v_template_prospect.id is null then
    update public.simulacao_leads_publicos set status_email_prospect = 'sem_template' where id = v_lead.id;
  else
    v_vars := jsonb_build_object(
      'nome', public.html_escape(v_lead.nome_completo),
      'valor_credito', 'R$ ' || to_char(v_lead.valor_credito, 'FM999G999G999G990D00'),
      'parcela_estimada', 'R$ ' || to_char(v_lead.parcela_estimada, 'FM999G999G999G990D00'),
      'prazo_meses', v_lead.prazo_meses,
      'contato_url', v_contato_url
    );
    v_assunto := public.render_template(v_template_prospect.assunto, v_vars);
    v_corpo := public.render_template(v_template_prospect.corpo, v_vars);
    insert into public.email_outbox (destinatario, assunto, corpo, origem, referencia_id, metadata)
    values (
      v_lead.email, v_assunto, v_corpo, 'simulacao_publica', v_lead.id,
      jsonb_build_object('evento', 'simulacao_publica_email', 'destinatario_tipo', 'prospect', 'template', v_template_prospect.codigo)
    ) on conflict do nothing;
  end if;

  if v_template_interno.id is null then
    update public.simulacao_leads_publicos set status_email_interno = 'sem_template' where id = v_lead.id;
  else
    for v_admin in
      select id, email from public.usuarios
       where role = 'admin' and ativo and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    loop
      v_vars := jsonb_build_object(
        'nome', public.html_escape(v_lead.nome_completo),
        'email', public.html_escape(v_lead.email),
        'telefone', public.html_escape(v_lead.telefone),
        'valor_credito', 'R$ ' || to_char(v_lead.valor_credito, 'FM999G999G999G990D00'),
        'parcela_estimada', 'R$ ' || to_char(v_lead.parcela_estimada, 'FM999G999G999G990D00'),
        'tipo_imovel', public.html_escape(v_lead.tipo_imovel),
        'situacao_imovel', public.html_escape(v_lead.situacao_imovel),
        'objetivo_credito', public.html_escape(coalesce(v_lead.objetivo_credito, 'Não informado')),
        'tipo_renda', public.html_escape(coalesce(v_lead.tipo_renda, 'Não informado')),
        'criado_em', to_char(v_lead.created_at, 'DD/MM/YYYY HH24:MI'),
        'admin_link', public.public_app_base_url() || '/admin/leads/simulacoes'
      );
      v_assunto := public.render_template(v_template_interno.assunto, v_vars);
      v_corpo := public.render_template(v_template_interno.corpo, v_vars);
      insert into public.email_outbox (destinatario, usuario_id, assunto, corpo, origem, referencia_id, metadata)
      values (
        lower(v_admin.email), v_admin.id, v_assunto, v_corpo, 'simulacao_publica', v_lead.id,
        jsonb_build_object('evento', 'simulacao_publica_email', 'destinatario_tipo', 'interno', 'template', v_template_interno.codigo)
      ) on conflict do nothing;
      v_internal_count := v_internal_count + 1;
    end loop;
    if v_internal_count = 0 then
      update public.simulacao_leads_publicos set status_email_interno = 'sem_destinatarios' where id = v_lead.id;
    end if;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'lead_id', v_lead.id,
    'parcela_estimada', v_lead.parcela_estimada,
    'ltv', v_lead.ltv,
    'email_prospect', v_lead.status_email_prospect,
    'email_interno', v_lead.status_email_interno
  );
exception when others then
  raise;
end;
$$;

revoke all on function public.capture_public_simulacao_lead(uuid,text,text,text,numeric,numeric,text,text,text,numeric,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.capture_public_simulacao_lead(uuid,text,text,text,numeric,numeric,text,text,text,numeric,text,text,text,text,text) to service_role;
