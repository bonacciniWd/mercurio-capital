-- =============================================
-- FASE 12 — Fluxos Evolution, Templates e Campanhas (M10)
-- =============================================
-- Escopo web-only. Push (FCM/Expo) fica para fase de mobile.
-- Canais habilitados: 'in_app' (notificacoes) + 'email' (email_outbox).
-- 'whatsapp' e 'push' são aceitos pelo schema mas não são despachados ainda.

-- ---------------------------------------------------------------
-- TEMPLATES DE MENSAGEM
-- ---------------------------------------------------------------
create table if not exists templates_mensagem (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  canal       notificacao_canal not null,
  nome        text not null,
  assunto     text,
  corpo       text not null,
  variaveis   text[] not null default '{}',
  ativo       boolean not null default true,
  created_by  uuid references usuarios(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table templates_mensagem enable row level security;

drop policy if exists "autenticados_le_templates" on templates_mensagem;
create policy "autenticados_le_templates" on templates_mensagem
  for select using (auth.role() = 'authenticated' and ativo);

drop policy if exists "admin_full_templates" on templates_mensagem;
create policy "admin_full_templates" on templates_mensagem
  for all using (public.app_is_admin()) with check (public.app_is_admin());

drop trigger if exists trg_templates_updated_at on templates_mensagem;
create trigger trg_templates_updated_at
  before update on templates_mensagem
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------
-- FLUXOS EVOLUTION + EXECUÇÕES
-- ---------------------------------------------------------------
create table if not exists fluxos_evolution (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  descricao       text,
  trigger_evento  text not null,
  -- estrutura: {"all":[{"field":"tipo_doc","op":"=","value":"comprovante_renda"}]}
  condicoes       jsonb not null default '{}',
  -- estrutura: [{"tipo":"notificar","template":"pendencia_doc_v1","canais":["in_app","email"]}]
  acoes           jsonb not null default '[]',
  ativo           boolean not null default true,
  created_by      uuid references usuarios(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table fluxos_evolution enable row level security;

drop policy if exists "admin_full_fluxos" on fluxos_evolution;
create policy "admin_full_fluxos" on fluxos_evolution
  for all using (public.app_is_admin()) with check (public.app_is_admin());

drop trigger if exists trg_fluxos_updated_at on fluxos_evolution;
create trigger trg_fluxos_updated_at
  before update on fluxos_evolution
  for each row execute function set_updated_at();

create table if not exists fluxo_execucoes (
  id             uuid primary key default gen_random_uuid(),
  fluxo_id       uuid not null references fluxos_evolution(id) on delete cascade,
  gatilho        text not null,
  payload        jsonb not null default '{}',
  status         text not null default 'sucesso'
                   check (status in ('sucesso','erro','parcial')),
  resultado      jsonb not null default '{}',
  duracao_ms     int,
  iniciado_em    timestamptz not null default now(),
  finalizado_em  timestamptz
);

create index if not exists fluxo_execucoes_fluxo_idx
  on fluxo_execucoes (fluxo_id, iniciado_em desc);

alter table fluxo_execucoes enable row level security;

drop policy if exists "admin_le_execucoes" on fluxo_execucoes;
create policy "admin_le_execucoes" on fluxo_execucoes
  for select using (public.app_is_admin());

-- ---------------------------------------------------------------
-- EMAIL OUTBOX (fila p/ dispatcher SMTP)
-- ---------------------------------------------------------------
create table if not exists email_outbox (
  id             uuid primary key default gen_random_uuid(),
  destinatario   text not null,
  usuario_id     uuid references usuarios(id) on delete set null,
  assunto        text not null,
  corpo          text not null,
  -- 'transacional' | 'campanha' | 'fluxo'
  origem         text not null default 'transacional',
  referencia_id  uuid,
  status         text not null default 'pendente'
                   check (status in ('pendente','processando','enviado','erro','cancelado')),
  tentativas     int not null default 0,
  ultimo_erro    text,
  agendado_para  timestamptz not null default now(),
  enviado_em     timestamptz,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists email_outbox_status_idx
  on email_outbox (status, agendado_para);

alter table email_outbox enable row level security;

drop policy if exists "admin_le_outbox" on email_outbox;
create policy "admin_le_outbox" on email_outbox
  for select using (public.app_is_admin());

-- Escritas apenas via RPCs security definer ou service_role.

-- ---------------------------------------------------------------
-- HELPER: renderiza template substituindo {{var}}
-- ---------------------------------------------------------------
create or replace function render_template(p_corpo text, p_vars jsonb)
returns text
language plpgsql immutable as $$
declare
  v_out  text := coalesce(p_corpo,'');
  v_key  text;
  v_val  text;
begin
  if p_vars is null or p_vars = '{}'::jsonb then
    return v_out;
  end if;
  for v_key, v_val in
    select k, coalesce(v::text, '')
      from jsonb_each_text(p_vars) as t(k, v)
  loop
    v_out := replace(v_out, '{{' || v_key || '}}', v_val);
  end loop;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------
-- RPCs ADMIN — TEMPLATES
-- ---------------------------------------------------------------
create or replace function admin_template_upsert(
  p_codigo     text,
  p_canal      notificacao_canal,
  p_nome       text,
  p_corpo      text,
  p_id         uuid default null,
  p_assunto    text default null,
  p_variaveis  text[] default '{}',
  p_ativo      boolean default true
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
    insert into templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo, created_by)
    values (p_codigo, p_canal, p_nome, p_assunto, p_corpo, coalesce(p_variaveis,'{}'), p_ativo, auth.uid())
    returning id into v_id;
  else
    update templates_mensagem
       set codigo = p_codigo,
           canal = p_canal,
           nome = p_nome,
           assunto = p_assunto,
           corpo = p_corpo,
           variaveis = coalesce(p_variaveis,'{}'),
           ativo = p_ativo
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
grant execute on function admin_template_upsert(text, notificacao_canal, text, text, uuid, text, text[], boolean) to authenticated;

create or replace function admin_template_delete(p_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from templates_mensagem where id = p_id;
  insert into audit_log (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'template_removido', 'templates_mensagem', p_id);
end;
$$;
grant execute on function admin_template_delete(uuid) to authenticated;

-- ---------------------------------------------------------------
-- RPCs ADMIN — FLUXOS
-- ---------------------------------------------------------------
create or replace function admin_fluxo_upsert(
  p_nome            text,
  p_trigger_evento  text,
  p_id              uuid default null,
  p_descricao       text default null,
  p_condicoes       jsonb default '{}',
  p_acoes           jsonb default '[]',
  p_ativo           boolean default true
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
    insert into fluxos_evolution (nome, descricao, trigger_evento, condicoes, acoes, ativo, created_by)
    values (p_nome, p_descricao, p_trigger_evento,
            coalesce(p_condicoes,'{}'::jsonb), coalesce(p_acoes,'[]'::jsonb),
            p_ativo, auth.uid())
    returning id into v_id;
  else
    update fluxos_evolution
       set nome = p_nome,
           descricao = p_descricao,
           trigger_evento = p_trigger_evento,
           condicoes = coalesce(p_condicoes,'{}'::jsonb),
           acoes = coalesce(p_acoes,'[]'::jsonb),
           ativo = p_ativo
     where id = p_id
    returning id into v_id;
  end if;

  insert into audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(),
          case when p_id is null then 'fluxo_criado' else 'fluxo_atualizado' end,
          'fluxos_evolution', v_id,
          jsonb_build_object('nome', p_nome, 'trigger_evento', p_trigger_evento, 'ativo', p_ativo));

  return v_id;
end;
$$;
grant execute on function admin_fluxo_upsert(text, text, uuid, text, jsonb, jsonb, boolean) to authenticated;

create or replace function admin_fluxo_delete(p_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from fluxos_evolution where id = p_id;
  insert into audit_log (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'fluxo_removido', 'fluxos_evolution', p_id);
end;
$$;
grant execute on function admin_fluxo_delete(uuid) to authenticated;

-- ---------------------------------------------------------------
-- HELPER: executar uma ação de fluxo (cria notificacoes + outbox)
-- ---------------------------------------------------------------
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
    else
      v_result := v_result || jsonb_build_object(v_canal,'nao_suportado_ainda');
    end if;
  end loop;

  return v_result;
end;
$$;
revoke all on function _fluxo_executar_acao(jsonb, uuid, text, jsonb, text, uuid) from public;

-- ---------------------------------------------------------------
-- RPC: executar um fluxo manualmente (admin)
-- ---------------------------------------------------------------
create or replace function admin_fluxo_executar(
  p_fluxo_id    uuid,
  p_usuario_id  uuid default null,
  p_payload     jsonb default '{}'
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_fluxo  fluxos_evolution%rowtype;
  v_acao   jsonb;
  v_exec   uuid;
  v_email  text;
  v_t0     timestamptz := clock_timestamp();
  v_res    jsonb := '[]'::jsonb;
  v_ok     boolean := true;
  v_one    jsonb;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_fluxo from fluxos_evolution where id = p_fluxo_id and ativo;
  if not found then
    raise exception 'fluxo nao encontrado ou inativo';
  end if;

  if p_usuario_id is not null then
    select email into v_email from usuarios where id = p_usuario_id;
  end if;

  insert into fluxo_execucoes (fluxo_id, gatilho, payload, status)
  values (v_fluxo.id, 'manual', coalesce(p_payload,'{}'::jsonb), 'sucesso')
  returning id into v_exec;

  for v_acao in select * from jsonb_array_elements(v_fluxo.acoes)
  loop
    begin
      v_one := _fluxo_executar_acao(v_acao, p_usuario_id, v_email, coalesce(p_payload,'{}'::jsonb), 'fluxo', v_fluxo.id);
      v_res := v_res || jsonb_build_array(v_one);
      if v_one ? 'erro' then v_ok := false; end if;
    exception when others then
      v_ok := false;
      v_res := v_res || jsonb_build_array(jsonb_build_object('erro', sqlerrm));
    end;
  end loop;

  update fluxo_execucoes
     set resultado = jsonb_build_object('acoes', v_res),
         status = case when v_ok then 'sucesso' else 'parcial' end,
         finalizado_em = clock_timestamp(),
         duracao_ms = (extract(epoch from clock_timestamp() - v_t0) * 1000)::int
   where id = v_exec;

  return v_exec;
end;
$$;
grant execute on function admin_fluxo_executar(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------
-- RPCs ADMIN — CAMPANHAS
-- ---------------------------------------------------------------
create or replace function admin_campanha_upsert(
  p_nome          text,
  p_template      text,
  p_id            uuid default null,
  p_publico_alvo  jsonb default '{}',
  p_canais        text[] default '{in_app}',
  p_agendado_para timestamptz default null,
  p_status        text default 'rascunho'
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
    insert into campanhas (nome, publico_alvo, canais, template, agendado_para, status, created_by)
    values (p_nome, coalesce(p_publico_alvo,'{}'::jsonb), coalesce(p_canais,'{}'),
            p_template, p_agendado_para, p_status, auth.uid())
    returning id into v_id;
  else
    update campanhas
       set nome = p_nome,
           publico_alvo = coalesce(p_publico_alvo,'{}'::jsonb),
           canais = coalesce(p_canais,'{}'),
           template = p_template,
           agendado_para = p_agendado_para,
           status = p_status
     where id = p_id
    returning id into v_id;
  end if;

  insert into audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(),
          case when p_id is null then 'campanha_criada' else 'campanha_atualizada' end,
          'campanhas', v_id,
          jsonb_build_object('nome', p_nome, 'status', p_status));

  return v_id;
end;
$$;
grant execute on function admin_campanha_upsert(text, text, uuid, jsonb, text[], timestamptz, text) to authenticated;

create or replace function admin_campanha_cancelar(p_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update campanhas set status = 'cancelada'
   where id = p_id and status in ('rascunho','agendada');
  insert into audit_log (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'campanha_cancelada', 'campanhas', p_id);
end;
$$;
grant execute on function admin_campanha_cancelar(uuid) to authenticated;

-- dispara campanha imediatamente: resolve público + enfileira notif/email
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
  v_vars     jsonb;
  v_corpo    text;
  v_assunto  text;
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
    select u.id, u.email, u.nome_completo, u.partner_id
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
      end if;
    end loop;
  end loop;

  update campanhas
     set status = 'enviada',
         metricas = jsonb_build_object(
           'in_app', v_count_in_app,
           'email_enfileirados', v_count_email,
           'disparado_em', now()
         )
   where id = p_id;

  insert into audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'campanha_disparada', 'campanhas', p_id,
          jsonb_build_object('in_app', v_count_in_app, 'email', v_count_email));

  return jsonb_build_object(
    'campanha_id', p_id,
    'in_app', v_count_in_app,
    'email_enfileirados', v_count_email
  );
end;
$$;
grant execute on function admin_campanha_disparar(uuid) to authenticated;

-- ---------------------------------------------------------------
-- RPCs OUTBOX (service_role apenas — usados pelo edge dispatcher)
-- ---------------------------------------------------------------
create or replace function email_outbox_pull(p_limit int default 20)
returns setof email_outbox
language plpgsql security definer
set search_path = public as $$
begin
  return query
  with sel as (
    select id from email_outbox
     where status = 'pendente'
       and agendado_para <= now()
     order by agendado_para asc
     limit p_limit
     for update skip locked
  )
  update email_outbox e
     set status = 'processando',
         tentativas = e.tentativas + 1
    from sel
   where e.id = sel.id
   returning e.*;
end;
$$;
revoke all on function email_outbox_pull(int) from public;
grant execute on function email_outbox_pull(int) to service_role;

create or replace function email_outbox_marcar(
  p_id    uuid,
  p_status text,
  p_erro  text default null
) returns void
language plpgsql security definer
set search_path = public as $$
begin
  if p_status not in ('enviado','erro','pendente','cancelado') then
    raise exception 'status invalido: %', p_status;
  end if;
  update email_outbox
     set status = p_status,
         ultimo_erro = p_erro,
         enviado_em = case when p_status = 'enviado' then now() else enviado_em end
   where id = p_id;
end;
$$;
revoke all on function email_outbox_marcar(uuid, text, text) from public;
grant execute on function email_outbox_marcar(uuid, text, text) to service_role;

-- ---------------------------------------------------------------
-- VIEWS PARA UI ADMIN
-- ---------------------------------------------------------------
create or replace view v_admin_templates with (security_invoker = on) as
  select t.id, t.codigo, t.canal, t.nome, t.assunto, t.corpo, t.variaveis, t.ativo,
         t.created_at, t.updated_at,
         u.nome_completo as created_by_nome
    from templates_mensagem t
    left join usuarios u on u.id = t.created_by;
grant select on v_admin_templates to authenticated;

create or replace view v_admin_fluxos with (security_invoker = on) as
  select f.id, f.nome, f.descricao, f.trigger_evento, f.condicoes, f.acoes, f.ativo,
         f.created_at, f.updated_at,
         (select count(*) from fluxo_execucoes e where e.fluxo_id = f.id) as execucoes_total,
         (select max(iniciado_em) from fluxo_execucoes e where e.fluxo_id = f.id) as ultima_execucao
    from fluxos_evolution f;
grant select on v_admin_fluxos to authenticated;

create or replace view v_admin_fluxo_execucoes with (security_invoker = on) as
  select e.id, e.fluxo_id, f.nome as fluxo_nome, e.gatilho, e.status, e.payload,
         e.resultado, e.duracao_ms, e.iniciado_em, e.finalizado_em
    from fluxo_execucoes e
    join fluxos_evolution f on f.id = e.fluxo_id;
grant select on v_admin_fluxo_execucoes to authenticated;

create or replace view v_admin_campanhas with (security_invoker = on) as
  select c.id, c.nome, c.publico_alvo, c.canais, c.template, c.agendado_para,
         c.status, c.metricas, c.created_at, c.updated_at,
         u.nome_completo as created_by_nome
    from campanhas c
    left join usuarios u on u.id = c.created_by;
grant select on v_admin_campanhas to authenticated;

create or replace view v_admin_email_outbox with (security_invoker = on) as
  select id, destinatario, assunto, origem, status, tentativas, ultimo_erro,
         agendado_para, enviado_em, created_at
    from email_outbox
   order by created_at desc;
grant select on v_admin_email_outbox to authenticated;

-- ---------------------------------------------------------------
-- SEEDS BÁSICOS DE TEMPLATES (idempotente)
-- ---------------------------------------------------------------
insert into templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo)
values
  ('boas_vindas_partner_v1', 'email', 'Boas-vindas parceiro aprovado',
   'Bem-vindo à Mercurio, {{nome}}!',
   E'Olá {{nome}},\n\nSeu cadastro foi aprovado. Acesse https://app.mercuriocapital.com.br e comece a operar.\n\nEquipe Mercurio',
   '{nome}', true),
  ('pendencia_doc_v1', 'in_app', 'Pendência de documento',
   'Documento pendente: {{nome_doc}}',
   E'A proposta {{protocolo}} precisa do documento {{nome_doc}}.',
   '{nome_doc,protocolo}', true),
  ('saldo_baixo_v1', 'in_app', 'Carteira com saldo baixo',
   'Saldo baixo na sua carteira',
   E'Olá {{nome}}, sua carteira tem apenas {{saldo}} disponível. Faça uma recarga para evitar interrupção.',
   '{nome,saldo}', true)
on conflict (codigo) do nothing;
