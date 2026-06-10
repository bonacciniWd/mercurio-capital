-- Fase 15.1 — Despacho real de WhatsApp (Evolution) em fluxos e campanhas
-- Transforma whatsapp_mensagens em fila (outbox) drenada por edge dispatcher,
-- liga _fluxo_executar_acao e admin_campanha_disparar ao canal 'whatsapp', e
-- adiciona configurações avançadas (não-secretas) por integração.

-- ───────────── whatsapp_mensagens como fila (outbox) ─────────────
alter table public.whatsapp_mensagens
  add column if not exists origem        text not null default 'transacional',
  add column if not exists tentativas    int  not null default 0,
  add column if not exists agendado_para timestamptz not null default now();

create index if not exists idx_whatsapp_mensagens_fila
  on public.whatsapp_mensagens (status, agendado_para);

-- ───────────── configurações avançadas por integração ─────────────
-- Apenas dados NÃO-secretos (instância, DDI padrão, throttle, eventos webhook).
-- Secrets continuam em supabase secrets / Deno.env.
alter table public.integracoes_config
  add column if not exists configuracoes jsonb not null default '{}'::jsonb;

create or replace function public.admin_integracao_config_set(
  p_chave text,
  p_configuracoes jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.integracoes_config
     set configuracoes = coalesce(p_configuracoes, '{}'::jsonb),
         updated_at = now()
   where chave = p_chave;
  if not found then
    raise exception 'integracao_nao_encontrada' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.admin_integracao_config_set(text, jsonb) to authenticated;

-- expõe configuracoes na view de admin
-- drop necessário: a coluna nova (configuracoes) altera a ordem das colunas,
-- o que `create or replace view` não permite (SQLSTATE 42P16).
drop view if exists public.v_admin_integracoes;
create view public.v_admin_integracoes with (security_invoker = on) as
select
  c.id, c.chave, c.nome, c.categoria, c.descricao, c.provider,
  c.secrets_requeridas, c.docs_url, c.restricao_plataforma, c.ativo,
  c.ultimo_status, c.ultima_checagem, c.ultimo_erro, c.latencia_ms,
  c.metricas, c.configuracoes, c.ordem, c.updated_at,
  coalesce(m.eventos_24h, 0)   as eventos_24h,
  coalesce(m.fila_pendente, 0) as fila_pendente
from public.integracoes_config c
left join lateral public.integracao_metricas(c.chave) m on true
where public.app_is_admin()
order by c.ordem, c.nome;

grant select on public.v_admin_integracoes to authenticated;

-- ───────────── helper: normaliza telefone E.164 (apenas dígitos) ─────────────
create or replace function public.wa_normalizar_telefone(p_ddi text, p_telefone text)
returns text
language sql
immutable
as $$
  select case
    when p_telefone is null or btrim(p_telefone) = '' then null
    else regexp_replace(coalesce(nullif(btrim(p_ddi), ''), '55') || regexp_replace(p_telefone, '\D', '', 'g'), '\D', '', 'g')
  end;
$$;

-- ───────────── helper: enfileira mensagem WhatsApp ─────────────
-- Resolve telefone do usuário quando p_telefone não é informado.
-- Retorna o id da mensagem enfileirada, ou null se não houver telefone.
create or replace function public.whatsapp_enqueue(
  p_usuario_id  uuid,
  p_corpo       text,
  p_telefone    text default null,
  p_template    text default null,
  p_ref_tipo    text default null,
  p_ref_id      uuid default null,
  p_origem      text default 'transacional'
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
    (usuario_id, telefone, corpo, template_codigo, referencia_tipo, referencia_id, origem, status)
  values
    (p_usuario_id, v_tel, p_corpo, p_template, p_ref_tipo, p_ref_id, p_origem, 'pendente')
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.whatsapp_enqueue(uuid, text, text, text, text, uuid, text) from public;
grant execute on function public.whatsapp_enqueue(uuid, text, text, text, text, uuid, text) to service_role;

-- ───────────── _fluxo_executar_acao: agora despacha whatsapp ─────────────
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
        p_usuario_id, v_corpo, null, v_codigo, p_origem, p_ref_id, p_origem);
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

-- ───────────── admin_campanha_disparar: agora inclui whatsapp ─────────────
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
          v_dest.id, v_corpo, null, v_tpl.codigo, 'campanha', v_camp.id, 'campanha');
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

-- ───────────── RPCs OUTBOX WhatsApp (service_role — usados pelo dispatcher) ─────────────
create or replace function public.whatsapp_outbox_pull(p_limit int default 20)
returns setof public.whatsapp_mensagens
language plpgsql security definer
set search_path = public as $$
begin
  return query
  with sel as (
    select id from public.whatsapp_mensagens
     where status = 'pendente'
       and agendado_para <= now()
     order by agendado_para asc
     limit p_limit
     for update skip locked
  )
  update public.whatsapp_mensagens w
     set status = 'processando',
         tentativas = w.tentativas + 1,
         atualizado_em = now()
    from sel
   where w.id = sel.id
   returning w.*;
end;
$$;
revoke all on function public.whatsapp_outbox_pull(int) from public;
grant execute on function public.whatsapp_outbox_pull(int) to service_role;

create or replace function public.whatsapp_mensagem_marcar(
  p_id            uuid,
  p_status        text,
  p_erro          text default null,
  p_evolution_id  text default null
) returns void
language plpgsql security definer
set search_path = public as $$
begin
  if p_status not in ('enviado','entregue','lido','erro','pendente') then
    raise exception 'status invalido: %', p_status;
  end if;
  update public.whatsapp_mensagens
     set status = p_status,
         erro = p_erro,
         evolution_message_id = coalesce(p_evolution_id, evolution_message_id),
         enviado_em = case when p_status = 'enviado' then now() else enviado_em end,
         atualizado_em = now()
   where id = p_id;
end;
$$;
revoke all on function public.whatsapp_mensagem_marcar(uuid, text, text, text) from public;
grant execute on function public.whatsapp_mensagem_marcar(uuid, text, text, text) to service_role;
