-- =============================================
-- SMOKE FASE 19 — Links canônicos + e-mails de proposta
-- =============================================
-- Transacional: nenhum dado de teste permanece no banco.

begin;

do $$
declare
  v_admin uuid;
  v_partner_user uuid := gen_random_uuid();
  v_partner uuid;
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_payload jsonb;
  v_result jsonb;
  v_proposta uuid;
  v_created_outbox uuid;
  v_status_outbox uuid;
  v_magic_link text;
begin
  select id into v_admin
    from public.usuarios
   where role = 'admin' and ativo
   limit 1;

  if v_admin is null then
    raise exception 'FASE 19 FAIL: admin ativo ausente';
  end if;

  if public.public_app_base_url() <> 'https://mercuriocapitalsa.com.br' then
    raise exception 'FASE 19 FAIL: base URL não canônica: %', public.public_app_base_url();
  end if;

  insert into auth.users (id, email, raw_app_meta_data, last_sign_in_at)
  values (
    v_partner_user,
    'smoke-f19-partner-' || v_suffix || '@mercurio.test',
    jsonb_build_object('role', 'partner'),
    now()
  );

  insert into public.usuarios (id, email, nome_completo, role, ativo, ultimo_login_at)
  values (
    v_partner_user,
    'smoke-f19-partner-' || v_suffix || '@mercurio.test',
    'Smoke F19 Partner',
    'partner',
    true,
    now()
  )
  on conflict (id) do update
    set nome_completo = excluded.nome_completo,
        role = excluded.role,
        ativo = excluded.ativo;

  insert into public.partners (usuario_id, status)
  values (v_partner_user, 'approved')
  returning id into v_partner;

  perform set_config('request.jwt.claim.aal', 'aal2', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin::text,
    'role', 'authenticated',
    'aal', 'aal2',
    'app_metadata', json_build_object('role', 'admin')
  )::text, true);

  v_payload := jsonb_build_object(
    'produto', 'home_equity',
    'pessoa_tipo', 'PF',
    'valor_solicitado', 180000,
    'prazo_meses', 120,
    'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'correcao', 'pos_fixado',
    'amortizacao', 'price',
    'cliente', jsonb_build_object(
      'nome_completo', 'Cliente Smoke Links',
      'cpf', 'cpf-f19-' || v_suffix,
      'email', 'cliente-f19-' || v_suffix || '@mercurio.test'
    ),
    'proponentes', jsonb_build_array(jsonb_build_object(
      'principal', true,
      'pessoa_tipo', 'PF',
      'nome', 'Cliente Smoke Links',
      'cpf_cnpj', 'cpf-f19-' || v_suffix
    )),
    'imoveis', jsonb_build_array(jsonb_build_object(
      'tipo', 'apartamento',
      'valor', 400000,
      'cidade', 'São Paulo',
      'estado', 'SP'
    ))
  );

  v_result := public.admin_create_proposta(v_partner, v_payload);
  v_proposta := (v_result->>'proposta_id')::uuid;

  if v_result->>'email_status' <> 'enfileirado' then
    raise exception 'FASE 19 FAIL: criação não enfileirou e-mail: %', v_result;
  end if;

  select id, metadata->>'magic_link'
    into v_created_outbox, v_magic_link
    from public.email_outbox
   where referencia_id = v_proposta
     and metadata->>'evento' = 'proposta_criada';

  if v_created_outbox is null then
    raise exception 'FASE 19 FAIL: item proposta_criada ausente';
  end if;

  if v_magic_link not like 'https://mercuriocapitalsa.com.br/c/proposta/%' then
    raise exception 'FASE 19 FAIL: magic link não canônico: %', v_magic_link;
  end if;

  if v_magic_link ~* '(localhost|127\.0\.0\.1)' then
    raise exception 'FASE 19 FAIL: magic link contém origem local: %', v_magic_link;
  end if;

  update public.propostas
       set status = 'analise_juridica'
   where id = v_proposta;

  select eo.id
    into v_status_outbox
    from public.email_outbox eo
   where eo.metadata->>'evento' = 'proposta_status_changed'
     and eo.metadata->>'proposta_id' = v_proposta::text
       and eo.metadata->>'status_anterior' = 'pre_analise'
       and eo.metadata->>'status_novo' = 'analise_juridica';

  if v_status_outbox is null then
    raise exception 'FASE 19 FAIL: item proposta_status_changed ausente';
  end if;

  if not exists (
    select 1
      from pg_proc p
     where p.oid = 'public.partner_create_proposta(jsonb)'::regprocedure
       and pg_get_functiondef(p.oid) like '%enqueue_proposta_criada_email%'
  ) then
    raise exception 'FASE 19 FAIL: partner_create_proposta sem enqueue';
  end if;

  raise notice 'FASE 19 SMOKE: OK (link canônico + proposta_criada + proposta_status_changed)';
end
$$;

rollback;
