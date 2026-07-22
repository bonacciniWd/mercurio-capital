-- =============================================
-- MIGRATION — ADMIN NÍVEL · HARDENING (opção B)
-- =============================================
-- Restringe RPCs/policies sensíveis (fora do escopo do admin limitado) para
-- exigir admin FULL (public.app_is_admin_full()). Admin limitado continua com
-- app_is_admin() = true, mas recebe 'forbidden' nessas operações.
--
-- NÃO altera (permanecem em app_is_admin()): aprovações de parceiro,
-- admin_set_proposta_status, rede, dashboards, kanban, detalhe de proposta.
--
-- Aditiva: apenas troca o guard; corpos idênticos aos originais.

-- ================================================================
-- CARTEIRAS
-- ================================================================
create or replace function public.admin_wallet_ajuste(
  p_partner    uuid,
  p_tipo       text,
  p_valor      bigint,
  p_descricao  text default null
) returns wallet_ledger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_entry  wallet_ledger;
  v_corr   uuid := gen_random_uuid();
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden';
  end if;
  if p_tipo not in ('ajuste_credito','ajuste_debito') then
    raise exception 'tipo_invalido' using hint = 'use ajuste_credito ou ajuste_debito';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor_invalido';
  end if;

  if p_tipo = 'ajuste_credito' then
    v_entry := public.wallet_credit(p_partner, 'ajuste_credito'::wallet_movimento_tipo,
      p_valor, 'manual', null, v_corr, p_descricao, jsonb_build_object('admin', auth.uid()));
  else
    v_entry := public.wallet_debit(p_partner, 'ajuste_debito'::wallet_movimento_tipo,
      p_valor, 'manual', null, v_corr, p_descricao, jsonb_build_object('admin', auth.uid()));
  end if;

  update wallet_ledger set criado_por = auth.uid() where id = v_entry.id;
  return v_entry;
end;
$$;
grant execute on function public.admin_wallet_ajuste(uuid, text, bigint, text) to authenticated;

create or replace function public.admin_wallet_set_bloqueio(
  p_partner uuid,
  p_bloqueada boolean,
  p_motivo text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden';
  end if;
  update partner_wallets
     set bloqueada = p_bloqueada,
         motivo_bloqueio = case when p_bloqueada then p_motivo else null end,
         updated_at = now()
   where partner_id = p_partner;
end;
$$;
grant execute on function public.admin_wallet_set_bloqueio(uuid, boolean, text) to authenticated;

-- ================================================================
-- PREÇOS
-- ================================================================
create or replace function public.admin_precos_upsert(
  p_tipo                       tipo_consulta,
  p_preco_centavos             bigint,
  p_custo_fornecedor_centavos  bigint default 0,
  p_descricao                  text   default null
) returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_novo_id uuid;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden';
  end if;
  if p_preco_centavos is null or p_preco_centavos <= 0 then
    raise exception 'preco_invalido';
  end if;

  update precos_consulta
     set vigente_ate = now()
   where tipo = p_tipo and vigente_ate is null;

  insert into precos_consulta(tipo, preco_centavos, custo_fornecedor_centavos, descricao, criado_por)
  values (p_tipo, p_preco_centavos, p_custo_fornecedor_centavos, p_descricao, auth.uid())
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;
grant execute on function public.admin_precos_upsert(tipo_consulta, bigint, bigint, text) to authenticated;

-- ================================================================
-- FEATURE FLAGS
-- ================================================================
create or replace function public.admin_feature_flag_upsert(
  p_chave     text,
  p_descricao text default null,
  p_regras    jsonb default '{}'::jsonb,
  p_ativo     boolean default false,
  p_id        uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_id is null then
    insert into public.feature_flags (chave, descricao, regras, ativo)
    values (p_chave, p_descricao, coalesce(p_regras,'{}'::jsonb), coalesce(p_ativo,false))
    on conflict (chave) do update
      set descricao = excluded.descricao,
          regras    = excluded.regras,
          ativo     = excluded.ativo
    returning id into v_id;
  else
    update public.feature_flags
       set chave     = p_chave,
           descricao = p_descricao,
           regras    = coalesce(p_regras,'{}'::jsonb),
           ativo     = coalesce(p_ativo,false)
     where id = p_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.admin_feature_flag_upsert(text, text, jsonb, boolean, uuid) from public;
grant execute on function public.admin_feature_flag_upsert(text, text, jsonb, boolean, uuid) to authenticated;

create or replace function public.admin_feature_flag_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.feature_flags where id = p_id;
end;
$$;
revoke all on function public.admin_feature_flag_delete(uuid) from public;
grant execute on function public.admin_feature_flag_delete(uuid) to authenticated;

-- ================================================================
-- LGPD / ANONIMIZAÇÃO
-- ================================================================
create or replace function public.lgpd_anonimizar_conta(
  p_user_id uuid,
  p_motivo  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_id        text;
  v_anon_email     text;
  v_anon_nome      text;
  v_partner_id     uuid;
  v_cliente_id     uuid;
  v_propostas_ct   int := 0;
  v_docs_ct        int := 0;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id obrigatorio';
  end if;

  v_anon_id    := substr(replace(p_user_id::text, '-', ''), 1, 12);
  v_anon_email := 'anon+' || v_anon_id || '@anonimizado.mercuriocapital.local';
  v_anon_nome  := 'Titular anonimizado ' || v_anon_id;

  -- usuarios
  update public.usuarios
     set nome_completo = v_anon_nome,
         email         = v_anon_email,
         telefone      = null,
         avatar_url    = null,
         ativo         = false
   where id = p_user_id;

  -- partners
  select id into v_partner_id from public.partners where usuario_id = p_user_id;
  if v_partner_id is not null then
    update public.partners
       set cpf                   = null,
           endereco_cep          = null,
           endereco_logradouro   = null,
           endereco_numero       = null,
           endereco_complemento  = null,
           endereco_bairro       = null,
           endereco_cidade       = null,
           endereco_estado       = null,
           dados_bancarios       = null,
           status                = 'suspended'
     where id = v_partner_id;

    select count(*) into v_docs_ct
      from public.partner_documentos where partner_id = v_partner_id;
  end if;

  -- clientes
  select id into v_cliente_id from public.clientes where usuario_id = p_user_id;
  if v_cliente_id is not null then
    update public.clientes
       set nome_completo  = v_anon_nome,
           cpf            = null,
           cnpj           = null,
           data_nascimento= null,
           estado_civil   = null,
           email          = v_anon_email,
           telefone       = null
     where id = v_cliente_id;

    select count(*) into v_propostas_ct
      from public.propostas where cliente_id = v_cliente_id;
  end if;

  -- notificacoes: limpar conteúdo
  update public.notificacoes
     set titulo   = '[anonimizado]',
         mensagem = '[anonimizado]',
         metadata = '{}'::jsonb
   where usuario_id = p_user_id;

  -- audit: registrar (não deletar histórico)
  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'lgpd_anonimizar', 'usuarios', p_user_id,
          jsonb_build_object(
            'motivo', p_motivo,
            'partner_id', v_partner_id,
            'cliente_id', v_cliente_id,
            'propostas_preservadas', v_propostas_ct,
            'documentos_preservados', v_docs_ct
          ));

  return jsonb_build_object(
    'ok', true,
    'titular_id', p_user_id,
    'anon_email', v_anon_email,
    'partner_id', v_partner_id,
    'cliente_id', v_cliente_id,
    'propostas_preservadas', v_propostas_ct,
    'documentos_preservados', v_docs_ct,
    'executado_em', now()
  );
end;
$$;
revoke all on function public.lgpd_anonimizar_conta(uuid, text) from public;
grant execute on function public.lgpd_anonimizar_conta(uuid, text) to authenticated;

-- ================================================================
-- INTEGRAÇÕES / WHATSAPP
-- ================================================================
create or replace function public.admin_integracao_toggle(p_chave text, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.integracoes_config
     set ativo = p_ativo,
         updated_at = now()
   where chave = p_chave;

  if not found then
    raise exception 'integracao_nao_encontrada' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.admin_integracao_toggle(text, boolean) to authenticated;

create or replace function public.admin_integracao_config_set(
  p_chave text,
  p_configuracoes jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_full() then
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

-- ================================================================
-- FLUXOS
-- ================================================================
create or replace function public.admin_fluxo_upsert(
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
  if not public.app_is_admin_full() then
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
grant execute on function public.admin_fluxo_upsert(text, text, uuid, text, jsonb, jsonb, boolean) to authenticated;

create or replace function public.admin_fluxo_delete(p_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from fluxos_evolution where id = p_id;
  insert into audit_log (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'fluxo_removido', 'fluxos_evolution', p_id);
end;
$$;
grant execute on function public.admin_fluxo_delete(uuid) to authenticated;

create or replace function public.admin_fluxo_executar(
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
  if not public.app_is_admin_full() then
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
grant execute on function public.admin_fluxo_executar(uuid, uuid, jsonb) to authenticated;

-- ================================================================
-- CAMPANHAS
-- ================================================================
create or replace function public.admin_campanha_upsert(
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
  if not public.app_is_admin_full() then
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
grant execute on function public.admin_campanha_upsert(text, text, uuid, jsonb, text[], timestamptz, text) to authenticated;

create or replace function public.admin_campanha_cancelar(p_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update campanhas set status = 'cancelada'
   where id = p_id and status in ('rascunho','agendada');
  insert into audit_log (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'campanha_cancelada', 'campanhas', p_id);
end;
$$;
grant execute on function public.admin_campanha_cancelar(uuid) to authenticated;

create or replace function public.admin_campanha_disparar(p_id uuid)
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
  if not public.app_is_admin_full() then
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
grant execute on function public.admin_campanha_disparar(uuid) to authenticated;

-- ================================================================
-- TEMPLATES DE E-MAIL / WHATSAPP
-- ================================================================
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_atual public.templates_mensagem%rowtype;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if length(coalesce(btrim(p_codigo), '')) < 3 then
    raise exception 'codigo_invalido' using errcode = '22023';
  end if;

  if length(coalesce(btrim(p_nome), '')) < 3 then
    raise exception 'nome_invalido' using errcode = '22023';
  end if;

  if length(coalesce(btrim(p_corpo), '')) = 0 then
    raise exception 'corpo_obrigatorio' using errcode = '22023';
  end if;

  if p_id is null then
    if public.app_template_is_critical(p_codigo) then
      raise exception 'template_critico_ja_gerenciado_pelo_sistema' using errcode = '23505';
    end if;

    insert into public.templates_mensagem
      (codigo, canal, nome, assunto, corpo, variaveis, ativo, created_by, wa_template_nome, wa_idioma)
    values
      (btrim(p_codigo), p_canal, btrim(p_nome), p_assunto, p_corpo, coalesce(p_variaveis, '{}'), coalesce(p_ativo, true), auth.uid(),
       nullif(btrim(coalesce(p_wa_template_nome, '')), ''), coalesce(nullif(btrim(coalesce(p_wa_idioma, '')), ''), 'pt_BR'))
    returning id into v_id;
  else
    select * into v_atual
      from public.templates_mensagem
     where id = p_id
     for update;

    if not found then
      raise exception 'template_nao_encontrado' using errcode = 'P0001';
    end if;

    if public.app_template_is_critical(v_atual.codigo) then
      if p_codigo <> v_atual.codigo or p_canal <> v_atual.canal then
        raise exception 'template_critico_nao_permite_alterar_codigo_ou_canal' using errcode = '42501';
      end if;
      if not coalesce(p_ativo, true) then
        raise exception 'template_critico_nao_pode_ser_inativado' using errcode = '42501';
      end if;
    end if;

    update public.templates_mensagem
       set codigo = btrim(p_codigo),
           canal = p_canal,
           nome = btrim(p_nome),
           assunto = p_assunto,
           corpo = p_corpo,
           variaveis = coalesce(p_variaveis, '{}'),
           ativo = coalesce(p_ativo, true),
           wa_template_nome = case
             when p_canal = 'whatsapp' then nullif(btrim(coalesce(p_wa_template_nome, '')), '')
             else null
           end,
           wa_idioma = coalesce(nullif(btrim(coalesce(p_wa_idioma, '')), ''), 'pt_BR')
     where id = p_id
    returning id into v_id;
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    case when p_id is null then 'template_criado' else 'template_atualizado' end,
    'templates_mensagem',
    v_id,
    jsonb_build_object('codigo', p_codigo, 'canal', p_canal, 'ativo', p_ativo)
  );

  return v_id;
end;
$$;
revoke all on function public.admin_template_upsert(text, notificacao_canal, text, text, uuid, text, text[], boolean, text, text) from public;
grant execute on function public.admin_template_upsert(text, notificacao_canal, text, text, uuid, text, text[], boolean, text, text) to authenticated;

create or replace function public.admin_template_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select codigo into v_codigo
    from public.templates_mensagem
   where id = p_id
   for update;

  if not found then
    raise exception 'template_nao_encontrado' using errcode = 'P0001';
  end if;

  if public.app_template_is_critical(v_codigo) then
    raise exception 'template_critico_nao_pode_ser_removido' using errcode = '42501';
  end if;

  delete from public.templates_mensagem where id = p_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes)
  values (auth.uid(), 'template_removido', 'templates_mensagem', p_id, jsonb_build_object('codigo', v_codigo));
end;
$$;
revoke all on function public.admin_template_delete(uuid) from public;
grant execute on function public.admin_template_delete(uuid) to authenticated;

create or replace function public.admin_email_template_test_enqueue(
  p_template_id uuid,
  p_destinatario text,
  p_variaveis jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.templates_mensagem%rowtype;
  v_email text := lower(btrim(coalesce(p_destinatario, '')));
  v_vars jsonb := coalesce(p_variaveis, '{}'::jsonb);
  v_outbox_id uuid;
  v_assunto text;
  v_corpo text;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email_destino_invalido' using errcode = '22023';
  end if;

  if jsonb_typeof(v_vars) <> 'object' then
    raise exception 'variaveis_devem_ser_objeto_json' using errcode = '22023';
  end if;

  select * into v_template
    from public.templates_mensagem
   where id = p_template_id
     and canal = 'email'
     and ativo;

  if not found then
    raise exception 'template_email_ativo_nao_encontrado' using errcode = 'P0001';
  end if;

  v_assunto := public.render_template(coalesce(v_template.assunto, v_template.nome), v_vars);
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
    v_email,
    null,
    v_assunto,
    v_corpo,
    'transacional',
    v_template.id,
    jsonb_build_object(
      'evento', 'template_teste',
      'template', v_template.codigo,
      'origem', 'admin_templates',
      'solicitado_por', auth.uid()
    )
  )
  returning id into v_outbox_id;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    'template_email_teste_enfileirado',
    'email_outbox',
    v_outbox_id,
    jsonb_build_object('template', v_template.codigo, 'destinatario', public.mask_email(v_email))
  );

  return jsonb_build_object(
    'outbox_id', v_outbox_id,
    'status', 'enfileirado',
    'template', v_template.codigo
  );
end;
$$;
revoke all on function public.admin_email_template_test_enqueue(uuid, text, jsonb) from public;
grant execute on function public.admin_email_template_test_enqueue(uuid, text, jsonb) to authenticated;

-- ================================================================
-- POLICIES SENSÍVEIS (escrita direta em tabela)
-- ================================================================
-- Configurações do sistema: escrita apenas admin FULL (leitura inalterada).
drop policy if exists "admin_full_config" on public.configuracoes_sistema;
create policy "admin_full_config" on public.configuracoes_sistema
  for all using (public.app_is_admin_full()) with check (public.app_is_admin_full());

-- Feature flags: escrita apenas admin FULL (leitura inalterada).
drop policy if exists "admin_full_flags" on public.feature_flags;
create policy "admin_full_flags" on public.feature_flags
  for all using (public.app_is_admin_full()) with check (public.app_is_admin_full());

-- Campanhas: escrita apenas admin FULL.
drop policy if exists "admin_full_campanhas" on public.campanhas;
create policy "admin_full_campanhas" on public.campanhas
  for all using (public.app_is_admin_full()) with check (public.app_is_admin_full());
