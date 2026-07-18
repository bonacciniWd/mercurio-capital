-- =============================================
-- Gestão e teste de templates de e-mail pelo Admin
-- =============================================

create or replace function public.app_template_is_critical(p_codigo text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_codigo, '') = any(array[
    'convite_equipe_v1',
    'proposta_cliente_magic_link_v1',
    'proposta_status_changed_v1'
  ]::text[])
$$;

revoke all on function public.app_template_is_critical(text) from public;
grant execute on function public.app_template_is_critical(text) to authenticated, service_role;

-- Preserva o contrato WhatsApp vigente e protege identidade/ativação dos templates críticos.
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
  if not public.app_is_admin() then
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
  if not public.app_is_admin() then
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
  if not public.app_is_admin() then
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
