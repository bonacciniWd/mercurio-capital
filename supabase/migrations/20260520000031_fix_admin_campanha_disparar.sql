-- =============================================
-- FIX: admin_campanha_disparar usava u.partner_id (coluna inexistente)
-- Reescreve para resolver destinatários por role + via app_partner_user_ids
-- quando publico_alvo.partner_ids está presente.
-- =============================================

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
    with por_role as (
      select u.id, u.email, u.nome_completo
        from public.usuarios u
       where u.ativo
         and cardinality(v_roles) > 0
         and u.role::text = any(v_roles)
    ),
    por_partner as (
      select u.id, u.email, u.nome_completo
        from unnest(v_partner_ids) as pid
        join lateral public.app_partner_user_ids(pid) as t(uid) on true
        join public.usuarios u on u.id = t.uid
       where cardinality(v_partner_ids) > 0
         and u.ativo
    ),
    todos as (
      select u.id, u.email, u.nome_completo
        from public.usuarios u
       where u.ativo
         and cardinality(v_roles) = 0
         and cardinality(v_partner_ids) = 0
    )
    select * from por_role
    union
    select * from por_partner
    union
    select * from todos
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
revoke all on function admin_campanha_disparar(uuid) from public;
grant execute on function admin_campanha_disparar(uuid) to authenticated;
