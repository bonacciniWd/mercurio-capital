-- =============================================
-- SMOKE FASE 20 — Gestão/teste admin de templates de e-mail
-- =============================================

begin;

do $$
declare
  v_admin uuid;
  v_template public.templates_mensagem%rowtype;
  v_result jsonb;
  v_outbox_id uuid;
begin
  select id into v_admin
    from public.usuarios
   where role = 'admin' and ativo
   limit 1;

  if v_admin is null then
    raise exception 'FASE 20 FAIL: admin ativo ausente';
  end if;

  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin::text,
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin')
  )::text, true);

  select * into v_template
    from public.templates_mensagem
   where codigo = 'proposta_status_changed_v1';

  if not found or v_template.canal <> 'email' or not v_template.ativo then
    raise exception 'FASE 20 FAIL: template crítico de status ausente/inativo';
  end if;

  v_result := public.admin_email_template_test_enqueue(
    v_template.id,
    'email-interno-smoke@mercuriocapitalsa.com.br',
    jsonb_build_object(
      'cliente_nome', 'Cliente Smoke',
      'protocolo', 'MERC-SMOKE-20',
      'status_anterior', 'Pré-análise',
      'status_novo', 'Análise jurídica'
    )
  );

  v_outbox_id := (v_result->>'outbox_id')::uuid;
  if v_result->>'status' <> 'enfileirado' or v_outbox_id is null then
    raise exception 'FASE 20 FAIL: teste não enfileirado: %', v_result;
  end if;

  if not exists (
    select 1 from public.email_outbox
     where id = v_outbox_id
       and metadata->>'evento' = 'template_teste'
       and metadata->>'template' = 'proposta_status_changed_v1'
       and metadata->>'origem' = 'admin_templates'
       and status = 'pendente'
  ) then
    raise exception 'FASE 20 FAIL: metadata/status da outbox inválidos';
  end if;

  begin
    perform public.admin_template_delete(v_template.id);
    raise exception 'FASE 20 FAIL: template crítico foi removido';
  exception when sqlstate '42501' then
    null;
  end;

  perform public.admin_template_upsert(
    p_codigo := v_template.codigo,
    p_canal := v_template.canal,
    p_nome := v_template.nome,
    p_corpo := v_template.corpo,
    p_id := v_template.id,
    p_assunto := v_template.assunto,
    p_variaveis := v_template.variaveis,
    p_ativo := true,
    p_wa_template_nome := v_template.wa_template_nome,
    p_wa_idioma := v_template.wa_idioma
  );

  raise notice 'FASE 20 SMOKE: OK (enqueue teste + proteção crítica + edição)';
end
$$;

rollback;
