-- Fase 15.3 — Envio via templates aprovados da WhatsApp Cloud API (Meta)
-- O WhatsApp só permite texto livre dentro da janela de 24h após a última mensagem
-- do cliente. Para INICIAR conversa (magic link, status, pendência) é obrigatório usar
-- um template aprovado pela Meta. Esta migração:
--   1. mapeia cada templates_mensagem (canal whatsapp) ao template aprovado da Meta;
--   2. carrega na fila whatsapp_mensagens o nome/idioma/params ordenados;
--   3. atualiza fluxos e campanhas para enfileirar com esse mapeamento.
-- Quando wa_template_nome é nulo, mantém o comportamento de texto livre (24h).

-- ───────────── 1) Mapeamento Meta no templates_mensagem ─────────────
alter table public.templates_mensagem
  add column if not exists wa_template_nome text,
  add column if not exists wa_idioma text not null default 'pt_BR';

-- ───────────── 2) Campos de template na fila whatsapp_mensagens ─────────────
alter table public.whatsapp_mensagens
  add column if not exists wa_template_nome text,
  add column if not exists wa_idioma text,
  add column if not exists wa_params jsonb not null default '[]'::jsonb;

-- ───────────── helper: monta os params ordenados ({{1}},{{2}}...) ─────────────
-- A ordem das `variaveis` do template define o mapeamento posicional da Meta.
create or replace function public.wa_build_params(p_variaveis text[], p_vars jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(coalesce(p_vars->>v, '') order by ord),
    '[]'::jsonb
  )
  from unnest(coalesce(p_variaveis, '{}'::text[])) with ordinality as t(v, ord);
$$;

-- ───────────── whatsapp_enqueue: agora aceita template Meta ─────────────
drop function if exists public.whatsapp_enqueue(uuid, text, text, text, text, uuid, text);

create or replace function public.whatsapp_enqueue(
  p_usuario_id       uuid,
  p_corpo            text,
  p_telefone         text default null,
  p_template         text default null,
  p_ref_tipo         text default null,
  p_ref_id           uuid default null,
  p_origem           text default 'transacional',
  p_wa_template_nome text default null,
  p_wa_idioma        text default null,
  p_wa_params        jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := p_telefone;
  v_id  uuid;
begin
  if v_tel is null and p_usuario_id is not null then
    select public.wa_normalizar_telefone(u.telefone_ddi, u.telefone)
      into v_tel
      from public.usuarios u
     where u.id = p_usuario_id;
  else
    -- telefone informado é tratado como número final (apenas dígitos)
    v_tel := nullif(regexp_replace(coalesce(v_tel, ''), '\D', '', 'g'), '');
  end if;

  if v_tel is null or length(v_tel) < 12 then
    return null;  -- sem telefone válido
  end if;

  insert into public.whatsapp_mensagens
    (usuario_id, telefone, corpo, template_codigo, referencia_tipo, referencia_id, origem,
     status, wa_template_nome, wa_idioma, wa_params)
  values
    (p_usuario_id, v_tel, p_corpo, p_template, p_ref_tipo, p_ref_id, p_origem,
     'pendente', p_wa_template_nome, p_wa_idioma, coalesce(p_wa_params, '[]'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.whatsapp_enqueue(uuid, text, text, text, text, uuid, text, text, text, jsonb) from public;
grant execute on function public.whatsapp_enqueue(uuid, text, text, text, text, uuid, text, text, text, jsonb) to service_role;

-- ───────────── _fluxo_executar_acao: whatsapp via template Meta ─────────────
create or replace function _fluxo_executar_acao(
  p_acao         jsonb,
  p_usuario_id   uuid,
  p_email        text,
  p_vars         jsonb,
  p_origem       text,
  p_ref_id       uuid
) returns jsonb
language plpgsql security definer
set search_path = public as $$
declare
  v_template templates_mensagem%rowtype;
  v_codigo   text := p_acao->>'template';
  v_canais   text[] := coalesce(
                        array(select jsonb_array_elements_text(p_acao->'canais')),
                        array['in_app']::text[]);
  v_canal    text;
  v_assunto  text;
  v_corpo    text;
  v_link     text := p_acao->>'link';
  v_titulo   text;
  v_result   jsonb := '{}'::jsonb;
  v_wa_id    uuid;
begin
  if v_codigo is null then
    return jsonb_build_object('erro','template ausente');
  end if;
  select * into v_template from templates_mensagem where codigo = v_codigo and ativo;
  if not found then
    return jsonb_build_object('erro','template '||v_codigo||' nao encontrado');
  end if;

  v_assunto := render_template(v_template.assunto, p_vars);
  v_corpo   := render_template(v_template.corpo, p_vars);
  v_titulo  := coalesce(p_acao->>'titulo', v_assunto, v_template.nome);

  foreach v_canal in array v_canais loop
    if v_canal = 'in_app' and p_usuario_id is not null then
      insert into notificacoes (usuario_id, canal, titulo, mensagem, link, metadata)
      values (p_usuario_id, 'in_app', v_titulo, v_corpo, v_link,
              jsonb_build_object('origem', p_origem, 'ref_id', p_ref_id, 'template', v_codigo));
      v_result := v_result || jsonb_build_object('in_app','ok');
    elsif v_canal = 'email' and p_email is not null then
      insert into email_outbox (destinatario, usuario_id, assunto, corpo, origem, referencia_id, metadata)
      values (p_email, p_usuario_id, coalesce(v_assunto, v_titulo), v_corpo, p_origem, p_ref_id,
              jsonb_build_object('template', v_codigo));
      v_result := v_result || jsonb_build_object('email','enfileirado');
    elsif v_canal = 'whatsapp' then
      v_wa_id := public.whatsapp_enqueue(
        p_usuario_id, v_corpo, null, v_codigo, p_origem, p_ref_id, p_origem,
        v_template.wa_template_nome,
        v_template.wa_idioma,
        public.wa_build_params(v_template.variaveis, p_vars));
      v_result := v_result || jsonb_build_object(
        'whatsapp', case when v_wa_id is null then 'sem_telefone' else 'enfileirado' end);
    else
      v_result := v_result || jsonb_build_object(v_canal,'nao_suportado_ainda');
    end if;
  end loop;

  return v_result;
end;
$$;
revoke all on function _fluxo_executar_acao(jsonb, uuid, text, jsonb, text, uuid) from public;

-- ───────────── admin_campanha_disparar: whatsapp via template Meta ─────────────
create or replace function admin_campanha_disparar(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public as $$
declare
  v_camp     campanhas%rowtype;
  v_tpl      templates_mensagem%rowtype;
  v_roles    text[];
  v_partner_ids uuid[];
  v_canal    text;
  v_dest     record;
  v_count_in_app int := 0;
  v_count_email  int := 0;
  v_count_wa     int := 0;
  v_vars     jsonb;
  v_corpo    text;
  v_assunto  text;
  v_wa_id    uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_camp from campanhas where id = p_id;
  if not found then raise exception 'campanha nao encontrada'; end if;
  if v_camp.status not in ('rascunho','agendada') then
    raise exception 'campanha nao pode ser disparada (status %)', v_camp.status;
  end if;

  select * into v_tpl from templates_mensagem where codigo = v_camp.template and ativo;
  if not found then raise exception 'template % nao encontrado/inativo', v_camp.template; end if;

  v_roles := coalesce(
              array(select jsonb_array_elements_text(v_camp.publico_alvo->'roles')),
              '{}'::text[]);
  v_partner_ids := coalesce(
              array(select (jsonb_array_elements_text(v_camp.publico_alvo->'partner_ids'))::uuid),
              '{}'::uuid[]);

  for v_dest in
    select u.id, u.email, u.nome_completo, u.partner_id, u.telefone_ddi, u.telefone
      from usuarios u
     where u.ativo
       and (
         (cardinality(v_roles) = 0 and cardinality(v_partner_ids) = 0)
         or (cardinality(v_roles) > 0 and u.role::text = any(v_roles))
         or (cardinality(v_partner_ids) > 0 and u.partner_id = any(v_partner_ids))
       )
  loop
    v_vars := jsonb_build_object(
      'nome', coalesce(v_dest.nome_completo, ''),
      'email', coalesce(v_dest.email, ''),
      'campanha', v_camp.nome
    );
    v_corpo := render_template(v_tpl.corpo, v_vars);
    v_assunto := render_template(v_tpl.assunto, v_vars);

    foreach v_canal in array v_camp.canais loop
      if v_canal = 'in_app' then
        insert into notificacoes (usuario_id, canal, titulo, mensagem, metadata)
        values (v_dest.id, 'in_app', coalesce(v_assunto, v_camp.nome), v_corpo,
                jsonb_build_object('origem','campanha','campanha_id', v_camp.id));
        v_count_in_app := v_count_in_app + 1;
      elsif v_canal = 'email' and v_dest.email is not null then
        insert into email_outbox (destinatario, usuario_id, assunto, corpo, origem, referencia_id, metadata)
        values (v_dest.email, v_dest.id, coalesce(v_assunto, v_camp.nome), v_corpo, 'campanha', v_camp.id,
                jsonb_build_object('template', v_tpl.codigo));
        v_count_email := v_count_email + 1;
      elsif v_canal = 'whatsapp' then
        v_wa_id := public.whatsapp_enqueue(
          v_dest.id, v_corpo, null, v_tpl.codigo, 'campanha', v_camp.id, 'campanha',
          v_tpl.wa_template_nome, v_tpl.wa_idioma,
          public.wa_build_params(v_tpl.variaveis, v_vars));
        if v_wa_id is not null then v_count_wa := v_count_wa + 1; end if;
      end if;
    end loop;
  end loop;

  update campanhas
     set status = 'enviada',
         metricas = jsonb_build_object(
           'in_app', v_count_in_app,
           'email_enfileirados', v_count_email,
           'whatsapp_enfileirados', v_count_wa,
           'disparado_em', now()
         )
   where id = p_id;

  insert into audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'campanha_disparada', 'campanhas', p_id,
          jsonb_build_object('in_app', v_count_in_app, 'email', v_count_email, 'whatsapp', v_count_wa));

  return jsonb_build_object(
    'campanha_id', p_id,
    'in_app', v_count_in_app,
    'email_enfileirados', v_count_email,
    'whatsapp_enfileirados', v_count_wa
  );
end;
$$;
grant execute on function admin_campanha_disparar(uuid) to authenticated;

-- ───────────── admin_template_upsert: passa a gravar mapeamento Meta ─────────────
drop function if exists public.admin_template_upsert(text, notificacao_canal, text, text, uuid, text, text[], boolean);

create or replace function public.admin_template_upsert(
  p_codigo            text,
  p_canal             notificacao_canal,
  p_nome              text,
  p_corpo             text,
  p_id                uuid default null,
  p_assunto           text default null,
  p_variaveis         text[] default '{}',
  p_ativo             boolean default true,
  p_wa_template_nome  text default null,
  p_wa_idioma         text default 'pt_BR'
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_id is null then
    insert into templates_mensagem
      (codigo, canal, nome, assunto, corpo, variaveis, ativo, created_by, wa_template_nome, wa_idioma)
    values
      (p_codigo, p_canal, p_nome, p_assunto, p_corpo, coalesce(p_variaveis,'{}'), p_ativo, auth.uid(),
       nullif(btrim(coalesce(p_wa_template_nome,'')), ''), coalesce(nullif(btrim(coalesce(p_wa_idioma,'')),''), 'pt_BR'))
    returning id into v_id;
  else
    update templates_mensagem
       set codigo = p_codigo,
           canal = p_canal,
           nome = p_nome,
           assunto = p_assunto,
           corpo = p_corpo,
           variaveis = coalesce(p_variaveis,'{}'),
           ativo = p_ativo,
           wa_template_nome = nullif(btrim(coalesce(p_wa_template_nome,'')), ''),
           wa_idioma = coalesce(nullif(btrim(coalesce(p_wa_idioma,'')),''), 'pt_BR')
     where id = p_id
    returning id into v_id;
  end if;

  insert into audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(),
          case when p_id is null then 'template_criado' else 'template_atualizado' end,
          'templates_mensagem', v_id,
          jsonb_build_object('codigo', p_codigo, 'canal', p_canal, 'ativo', p_ativo));

  return v_id;
end;
$$;
grant execute on function public.admin_template_upsert(text, notificacao_canal, text, text, uuid, text, text[], boolean, text, text) to authenticated;

-- ───────────── v_admin_templates: expõe o mapeamento Meta ─────────────
drop view if exists public.v_admin_templates;
create view public.v_admin_templates with (security_invoker = on) as
  select t.id, t.codigo, t.canal, t.nome, t.assunto, t.corpo, t.variaveis, t.ativo,
         t.wa_template_nome, t.wa_idioma,
         t.created_at, t.updated_at,
         u.nome_completo as created_by_nome
    from templates_mensagem t
    left join usuarios u on u.id = t.created_by;
grant select on public.v_admin_templates to authenticated;
