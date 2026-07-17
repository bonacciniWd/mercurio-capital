-- =============================================
-- Links canonicos + e-mails transacionais de proposta
-- =============================================

-- Produção nunca deve gerar links externos com origem local.
insert into public.configuracoes_sistema (chave, valor, descricao)
values
  (
    'app_url',
    to_jsonb('https://mercuriocapitalsa.com.br'::text),
    'URL canônica do app para links públicos e transacionais.'
  ),
  (
    'frontend_url',
    to_jsonb('https://mercuriocapitalsa.com.br'::text),
    'URL pública do frontend web.'
  ),
  (
    'site_url',
    to_jsonb('https://mercuriocapitalsa.com.br'::text),
    'URL institucional/canônica usada como fallback seguro.'
  )
on conflict (chave) do update
set valor = excluded.valor,
    descricao = excluded.descricao,
    updated_at = now();

create or replace function public.public_app_base_url()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  select candidate.url
    into v_url
    from (
      select
        case c.chave when 'app_url' then 1 when 'site_url' then 2 else 3 end as prioridade,
        coalesce(
          nullif(trim(c.valor->>'url'), ''),
          nullif(trim(c.valor->>'app_url'), ''),
          nullif(trim(c.valor #>> '{}'), '')
        ) as url
      from public.configuracoes_sistema c
      where c.chave in ('app_url', 'site_url', 'frontend_url')
    ) candidate
   where candidate.url is not null
   order by candidate.prioridade
   limit 1;

  v_url := regexp_replace(coalesce(v_url, ''), '/+$', '');

  if v_url = ''
     or v_url !~ '^https://'
     or v_url ~* '^https?://(localhost|127\.0\.0\.1)(:|/|$)' then
    return 'https://mercuriocapitalsa.com.br';
  end if;

  return v_url;
exception when others then
  return 'https://mercuriocapitalsa.com.br';
end;
$$;

revoke all on function public.public_app_base_url() from public;
grant execute on function public.public_app_base_url() to authenticated, service_role;

insert into public.templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo)
values
  (
    'proposta_cliente_magic_link_v1',
    'email',
    'Proposta criada para o cliente',
    'Sua proposta {{protocolo}} está disponível',
    E'<p>Olá {{cliente_nome}},</p>\n<p>Sua proposta de <b>{{produto}}</b>, protocolo <b>{{protocolo}}</b>, foi criada.</p>\n<p>Valor solicitado: <b>{{valor_solicitado}}</b>.</p>\n<p><a href="{{magic_link}}">Acessar proposta</a></p>\n<p>Este link expira em {{expires_in_min}} minutos.</p>\n<p>Mercurio Capital</p>',
    '{cliente_nome,protocolo,produto,valor_solicitado,magic_link,expires_in_min}',
    true
  ),
  (
    'proposta_status_changed_v1',
    'email',
    'Status da proposta atualizado',
    'Atualização da proposta {{protocolo}}',
    E'<p>Olá {{cliente_nome}},</p>\n<p>A proposta <b>{{protocolo}}</b> mudou de <b>{{status_anterior}}</b> para <b>{{status_novo}}</b>.</p>\n<p>Acompanhe os próximos passos no portal da Mercurio Capital.</p>',
    '{cliente_nome,protocolo,status_anterior,status_novo}',
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

-- Uma criação por proposta e uma atualização por item de histórico.
create unique index if not exists email_outbox_transacional_evento_referencia_uidx
  on public.email_outbox (referencia_id, (metadata->>'evento'))
  where metadata->>'evento' in ('proposta_criada', 'proposta_status_changed');

create or replace function public.enqueue_proposta_criada_email(
  p_proposta_id uuid,
  p_magic_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_template public.templates_mensagem%rowtype;
  v_vars jsonb;
  v_link text;
  v_assunto text;
  v_corpo text;
begin
  select
    p.id,
    p.protocolo,
    p.produto::text as produto,
    p.valor_solicitado,
    c.usuario_id,
    c.nome_completo as cliente_nome,
    nullif(trim(c.email), '') as cliente_email
  into v_row
  from public.propostas p
  join public.clientes c on c.id = p.cliente_id
  where p.id = p_proposta_id;

  if not found or v_row.cliente_email is null then
    return jsonb_build_object('email_status', 'nao_enfileirado', 'email_motivo', 'cliente_sem_email');
  end if;

  if length(coalesce(trim(p_magic_token), '')) = 0 then
    return jsonb_build_object('email_status', 'falha_enqueue', 'email_erro', 'magic_token_ausente');
  end if;

  select * into v_template
    from public.templates_mensagem
   where codigo = 'proposta_cliente_magic_link_v1'
     and canal = 'email'
     and ativo
   limit 1;

  if not found then
    return jsonb_build_object('email_status', 'falha_enqueue', 'email_erro', 'template_inativo_ou_ausente');
  end if;

  v_link := public.public_app_base_url() || '/c/proposta/' || p_magic_token;
  v_vars := jsonb_build_object(
    'cliente_nome', v_row.cliente_nome,
    'protocolo', v_row.protocolo,
    'produto', v_row.produto,
    'valor_solicitado', 'R$ ' || trim(to_char(v_row.valor_solicitado, 'FM999G999G999G990D00')),
    'magic_link', v_link,
    'expires_in_min', 30
  );
  v_assunto := public.render_template(v_template.assunto, v_vars);
  v_corpo := public.render_template(v_template.corpo, v_vars);

  insert into public.email_outbox (
    destinatario,
    usuario_id,
    assunto,
    corpo,
    origem,
    referencia_id,
    metadata
  ) values (
    v_row.cliente_email,
    v_row.usuario_id,
    v_assunto,
    v_corpo,
    'transacional',
    p_proposta_id,
    jsonb_build_object(
      'evento', 'proposta_criada',
      'proposta_id', p_proposta_id,
      'protocolo', v_row.protocolo,
      'template', v_template.codigo,
      'magic_link', v_link
    )
  )
  on conflict do nothing;

  return jsonb_build_object('email_status', 'enfileirado');
exception when others then
  return jsonb_build_object(
    'email_status', 'falha_enqueue',
    'email_erro', left(sqlerrm, 300)
  );
end;
$$;

revoke all on function public.enqueue_proposta_criada_email(uuid, text) from public;
grant execute on function public.enqueue_proposta_criada_email(uuid, text) to authenticated, service_role;

-- Preserva as definições vigentes das RPCs e acrescenta o enqueue enquanto o token plaintext existe.
do $$
declare
  v_function regprocedure;
  v_definition text;
  v_anchor text := E'''magic_token'', v_token\n  );';
  v_replacement text := E'''magic_token'', v_token\n  ) || public.enqueue_proposta_criada_email(v_proposta_id, v_token);';
begin
  foreach v_function in array array[
    'public.partner_create_proposta(jsonb)'::regprocedure,
    'public.admin_create_proposta(uuid,jsonb)'::regprocedure
  ] loop
    select pg_get_functiondef(v_function) into v_definition;

    if position(v_anchor in v_definition) = 0 then
      raise exception 'âncora de retorno não encontrada em %', v_function;
    end if;

    execute replace(v_definition, v_anchor, v_replacement);
  end loop;
end
$$;

create or replace function public.enqueue_proposta_status_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_template public.templates_mensagem%rowtype;
  v_vars jsonb;
begin
  select
    p.protocolo,
    c.usuario_id,
    c.nome_completo as cliente_nome,
    nullif(trim(c.email), '') as cliente_email
  into v_row
  from public.propostas p
  join public.clientes c on c.id = p.cliente_id
  where p.id = new.proposta_id;

  if not found or v_row.cliente_email is null then
    return new;
  end if;

  select * into v_template
    from public.templates_mensagem
   where codigo = 'proposta_status_changed_v1'
     and canal = 'email'
     and ativo
   limit 1;

  if not found then
    return new;
  end if;

  v_vars := jsonb_build_object(
    'cliente_nome', v_row.cliente_nome,
    'protocolo', v_row.protocolo,
    'status_anterior', coalesce(new.status_anterior::text, 'sem status anterior'),
    'status_novo', new.status_novo::text
  );

  insert into public.email_outbox (
    destinatario,
    usuario_id,
    assunto,
    corpo,
    origem,
    referencia_id,
    metadata
  ) values (
    v_row.cliente_email,
    v_row.usuario_id,
    public.render_template(v_template.assunto, v_vars),
    public.render_template(v_template.corpo, v_vars),
    'transacional',
    new.id,
    jsonb_build_object(
      'evento', 'proposta_status_changed',
      'proposta_id', new.proposta_id,
      'status_anterior', new.status_anterior,
      'status_novo', new.status_novo,
      'protocolo', v_row.protocolo,
      'template', v_template.codigo
    )
  )
  on conflict do nothing;

  return new;
exception when others then
  -- E-mail é best-effort: nunca bloqueia a transição operacional.
  return new;
end;
$$;

drop trigger if exists trg_email_status_proposta on public.proposta_status_historico;
create trigger trg_email_status_proposta
  after insert on public.proposta_status_historico
  for each row execute function public.enqueue_proposta_status_email();
