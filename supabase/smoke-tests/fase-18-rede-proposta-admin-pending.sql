-- =============================================
-- SMOKE TEST FASE 18 — Rede partner scoped + admin_create_proposta para pending
-- =============================================
-- Valida:
-- 1) Admin cria proposta para partner approved e pending
-- 2) Admin não cria para rejected/suspended
-- 3) Partner pending continua bloqueado em partner_create_proposta
-- 4) partner_rede_graph() retorna apenas dados do partner logado
-- 5) Partner A não enxerga equipe do Partner B

begin;

do $$
declare
  v_admin uuid;
  v_suffix text := replace(gen_random_uuid()::text, '-', '');

  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_user_pending uuid := gen_random_uuid();
  v_user_rejected uuid := gen_random_uuid();
  v_user_suspended uuid := gen_random_uuid();

  v_partner_a uuid;
  v_partner_b uuid;
  v_partner_pending uuid;
  v_partner_rejected uuid;
  v_partner_suspended uuid;

  v_equipe_a uuid;
  v_equipe_b uuid;

  v_payload_approved jsonb;
  v_payload_pending jsonb;
  v_payload_rejected jsonb;
  v_payload_suspended jsonb;
  v_payload_partner_pending jsonb;

  v_result jsonb;
  v_graph jsonb;
begin
  select id into v_admin from public.usuarios where role = 'admin' and ativo limit 1;
  if v_admin is null then
    raise exception 'FASE 18 FAIL: precisa de pelo menos 1 admin ativo';
  end if;

  -- Usuários base para partners de teste
  insert into auth.users (id, email, raw_app_meta_data, last_sign_in_at)
  values
    (v_user_a, 'smoke-f18-a-' || v_suffix || '@mercurio.test', jsonb_build_object('role', 'partner'), now()),
    (v_user_b, 'smoke-f18-b-' || v_suffix || '@mercurio.test', jsonb_build_object('role', 'partner'), now()),
    (v_user_pending, 'smoke-f18-pending-' || v_suffix || '@mercurio.test', jsonb_build_object('role', 'partner'), now()),
    (v_user_rejected, 'smoke-f18-rejected-' || v_suffix || '@mercurio.test', jsonb_build_object('role', 'partner'), now()),
    (v_user_suspended, 'smoke-f18-suspended-' || v_suffix || '@mercurio.test', jsonb_build_object('role', 'partner'), now());

  insert into public.usuarios (id, email, nome_completo, role, ativo, ultimo_login_at)
  values
    (v_user_a, 'smoke-f18-a-' || v_suffix || '@mercurio.test', 'Smoke F18 Partner A', 'partner', true, now()),
    (v_user_b, 'smoke-f18-b-' || v_suffix || '@mercurio.test', 'Smoke F18 Partner B', 'partner', true, now()),
    (v_user_pending, 'smoke-f18-pending-' || v_suffix || '@mercurio.test', 'Smoke F18 Partner Pending', 'partner', true, now()),
    (v_user_rejected, 'smoke-f18-rejected-' || v_suffix || '@mercurio.test', 'Smoke F18 Partner Rejected', 'partner', true, now()),
    (v_user_suspended, 'smoke-f18-suspended-' || v_suffix || '@mercurio.test', 'Smoke F18 Partner Suspended', 'partner', true, now())
  on conflict (id) do update
    set email = excluded.email,
        nome_completo = excluded.nome_completo,
        role = excluded.role,
        ativo = excluded.ativo,
        ultimo_login_at = excluded.ultimo_login_at;

  insert into public.partners (usuario_id, status)
  values (v_user_a, 'approved')
  returning id into v_partner_a;

  insert into public.partners (usuario_id, status)
  values (v_user_b, 'approved')
  returning id into v_partner_b;

  insert into public.partners (usuario_id, status)
  values (v_user_pending, 'pending')
  returning id into v_partner_pending;

  insert into public.partners (usuario_id, status)
  values (v_user_rejected, 'rejected')
  returning id into v_partner_rejected;

  insert into public.partners (usuario_id, status)
  values (v_user_suspended, 'suspended')
  returning id into v_partner_suspended;

  insert into public.equipes (partner_id, nome, isolamento_estrito)
  values (v_partner_a, 'Equipe Smoke A', false)
  returning id into v_equipe_a;

  insert into public.equipes (partner_id, nome, isolamento_estrito)
  values (v_partner_b, 'Equipe Smoke B', false)
  returning id into v_equipe_b;

  -- JWT admin para chamadas admin_*
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin::text,
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin')
  )::text, true);

  v_payload_approved := jsonb_build_object(
    'produto', 'home_equity',
    'pessoa_tipo', 'PF',
    'valor_solicitado', 180000,
    'prazo_meses', 120,
    'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'correcao', 'pos_fixado',
    'amortizacao', 'price',
    'cliente', jsonb_build_object(
      'nome_completo', 'Cliente Smoke Approved',
      'cpf', 'cpf-approved-' || v_suffix,
      'email', 'cliente-approved-' || v_suffix || '@mercurio.test'
    ),
    'proponentes', jsonb_build_array(
      jsonb_build_object(
        'principal', true,
        'pessoa_tipo', 'PF',
        'nome', 'Cliente Smoke Approved',
        'cpf_cnpj', 'cpf-approved-' || v_suffix
      )
    ),
    'imoveis', jsonb_build_array(
      jsonb_build_object(
        'tipo', 'apartamento',
        'valor', 350000,
        'cidade', 'Sao Paulo',
        'estado', 'SP'
      )
    )
  );

  v_payload_pending := jsonb_build_object(
    'produto', 'home_equity',
    'pessoa_tipo', 'PF',
    'valor_solicitado', 190000,
    'prazo_meses', 120,
    'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'correcao', 'pos_fixado',
    'amortizacao', 'price',
    'cliente', jsonb_build_object(
      'nome_completo', 'Cliente Smoke Pending',
      'cpf', 'cpf-pending-' || v_suffix,
      'email', 'cliente-pending-' || v_suffix || '@mercurio.test'
    ),
    'proponentes', jsonb_build_array(
      jsonb_build_object(
        'principal', true,
        'pessoa_tipo', 'PF',
        'nome', 'Cliente Smoke Pending',
        'cpf_cnpj', 'cpf-pending-' || v_suffix
      )
    ),
    'imoveis', jsonb_build_array(
      jsonb_build_object(
        'tipo', 'casa',
        'valor', 420000,
        'cidade', 'Campinas',
        'estado', 'SP'
      )
    )
  );

  v_payload_rejected := jsonb_build_object(
    'produto', 'home_equity',
    'pessoa_tipo', 'PF',
    'valor_solicitado', 200000,
    'prazo_meses', 120,
    'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'correcao', 'pos_fixado',
    'amortizacao', 'price',
    'cliente', jsonb_build_object(
      'nome_completo', 'Cliente Smoke Rejected',
      'cpf', 'cpf-rejected-' || v_suffix,
      'email', 'cliente-rejected-' || v_suffix || '@mercurio.test'
    ),
    'proponentes', jsonb_build_array(
      jsonb_build_object(
        'principal', true,
        'pessoa_tipo', 'PF',
        'nome', 'Cliente Smoke Rejected',
        'cpf_cnpj', 'cpf-rejected-' || v_suffix
      )
    ),
    'imoveis', jsonb_build_array(
      jsonb_build_object(
        'tipo', 'apartamento',
        'valor', 330000,
        'cidade', 'Curitiba',
        'estado', 'PR'
      )
    )
  );

  v_payload_suspended := jsonb_build_object(
    'produto', 'home_equity',
    'pessoa_tipo', 'PF',
    'valor_solicitado', 210000,
    'prazo_meses', 120,
    'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'correcao', 'pos_fixado',
    'amortizacao', 'price',
    'cliente', jsonb_build_object(
      'nome_completo', 'Cliente Smoke Suspended',
      'cpf', 'cpf-suspended-' || v_suffix,
      'email', 'cliente-suspended-' || v_suffix || '@mercurio.test'
    ),
    'proponentes', jsonb_build_array(
      jsonb_build_object(
        'principal', true,
        'pessoa_tipo', 'PF',
        'nome', 'Cliente Smoke Suspended',
        'cpf_cnpj', 'cpf-suspended-' || v_suffix
      )
    ),
    'imoveis', jsonb_build_array(
      jsonb_build_object(
        'tipo', 'casa',
        'valor', 360000,
        'cidade', 'Santos',
        'estado', 'SP'
      )
    )
  );

  -- Admin cria para approved
  v_result := public.admin_create_proposta(v_partner_a, v_payload_approved);
  if coalesce(v_result->>'proposta_id', '') = '' then
    raise exception 'FASE 18 FAIL: admin_create_proposta não retornou proposta para partner approved';
  end if;

  -- Admin cria para pending
  v_result := public.admin_create_proposta(v_partner_pending, v_payload_pending);
  if coalesce(v_result->>'proposta_id', '') = '' then
    raise exception 'FASE 18 FAIL: admin_create_proposta não retornou proposta para partner pending';
  end if;

  -- Admin bloqueado para rejected
  begin
    perform public.admin_create_proposta(v_partner_rejected, v_payload_rejected);
    raise exception 'FASE 18 FAIL: admin criou proposta para partner rejected';
  exception when others then
    if sqlstate <> '42501' then raise; end if;
  end;

  -- Admin bloqueado para suspended
  begin
    perform public.admin_create_proposta(v_partner_suspended, v_payload_suspended);
    raise exception 'FASE 18 FAIL: admin criou proposta para partner suspended';
  exception when others then
    if sqlstate <> '42501' then raise; end if;
  end;

  -- Partner pending continua bloqueado para partner_create_proposta
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_user_pending::text,
    'role', 'authenticated',
    'app_metadata', json_build_object(
      'role', 'partner',
      'partner_id', v_partner_pending::text,
      'approved', false
    )
  )::text, true);

  v_payload_partner_pending := jsonb_build_object(
    'produto', 'home_equity',
    'pessoa_tipo', 'PF',
    'valor_solicitado', 170000,
    'prazo_meses', 120,
    'carencia_meses', 0,
    'taxa_juros_mensal', 1.29,
    'correcao', 'pos_fixado',
    'amortizacao', 'price',
    'cliente', jsonb_build_object(
      'nome_completo', 'Cliente Partner Pending',
      'cpf', 'cpf-partner-pending-' || v_suffix,
      'email', 'cliente-partner-pending-' || v_suffix || '@mercurio.test'
    ),
    'proponentes', jsonb_build_array(
      jsonb_build_object(
        'principal', true,
        'pessoa_tipo', 'PF',
        'nome', 'Cliente Partner Pending',
        'cpf_cnpj', 'cpf-partner-pending-' || v_suffix
      )
    ),
    'imoveis', jsonb_build_array(
      jsonb_build_object(
        'tipo', 'apartamento',
        'valor', 300000,
        'cidade', 'Sao Paulo',
        'estado', 'SP'
      )
    )
  );

  begin
    perform public.partner_create_proposta(v_payload_partner_pending);
    raise exception 'FASE 18 FAIL: partner pending conseguiu criar proposta';
  exception when others then
    if sqlstate <> '42501' then raise; end if;
  end;

  -- partner_rede_graph: escopo do partner A
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'role', 'authenticated',
    'app_metadata', json_build_object(
      'role', 'partner',
      'partner_id', v_partner_a::text,
      'approved', true
    )
  )::text, true);

  v_graph := public.partner_rede_graph();

  if not exists (
    select 1
      from jsonb_array_elements(v_graph->'nodes') n
     where n->>'id' = 'partner-' || v_partner_a::text
  ) then
    raise exception 'FASE 18 FAIL: mapa não contém partner logado';
  end if;

  if not exists (
    select 1
      from jsonb_array_elements(v_graph->'nodes') n
     where n->>'id' = 'equipe-' || v_equipe_a::text
  ) then
    raise exception 'FASE 18 FAIL: mapa não contém equipe do partner logado';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(v_graph->'nodes') n
     where n->>'id' = 'partner-' || v_partner_b::text
  ) then
    raise exception 'FASE 18 FAIL: mapa expôs partner de terceiro';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(v_graph->'nodes') n
     where n->>'id' = 'equipe-' || v_equipe_b::text
  ) then
    raise exception 'FASE 18 FAIL: mapa expôs equipe de outro partner';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(v_graph->'edges') e
     where e->>'source' = 'partner-' || v_partner_b::text
        or e->>'target' = 'partner-' || v_partner_b::text
  ) then
    raise exception 'FASE 18 FAIL: mapa expôs conexões de outro partner';
  end if;

  raise notice 'FASE 18 SMOKE: OK (admin pending/approved + isolamento partner_rede_graph)';
end
$$;

rollback;
