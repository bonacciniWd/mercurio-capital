-- Smoke somente leitura: valida posição no enum e guardas RLS de contrato,
-- sem consultar propostas/PII nem alterar qualquer registro.
do $$
declare
  v_credito real;
  v_pre_aprovado real;
  v_imovel real;
  v_policy text;
  v_function text;
  v_is_security_definer boolean;
  v_search_path text[];
  v_helper_oid oid;
begin
  select enumsortorder into v_credito
    from pg_enum
   where enumtypid = 'public.proposta_status'::regtype
     and enumlabel = 'analise_credito';
  select enumsortorder into v_pre_aprovado
    from pg_enum
   where enumtypid = 'public.proposta_status'::regtype
     and enumlabel = 'pre_aprovado';
  select enumsortorder into v_imovel
    from pg_enum
   where enumtypid = 'public.proposta_status'::regtype
     and enumlabel = 'analise_imovel';

  if v_pre_aprovado is null then
    raise exception 'pre_aprovado_status_missing';
  end if;
  if not (v_credito < v_pre_aprovado and v_pre_aprovado < v_imovel) then
    raise exception 'pre_aprovado_status_order_invalid';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'public'
     and tablename = 'contratos'
     and policyname = 'cliente_le_contrato';
  if coalesce(v_policy, '') not ilike '%pre_aprovado%' then
    raise exception 'client_contract_policy_missing_pre_aprovado_guard';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'public'
     and tablename = 'contratos'
     and policyname = 'partner_le_contrato';
  if coalesce(v_policy, '') not ilike '%pre_aprovado%' then
    raise exception 'partner_contract_policy_missing_pre_aprovado_guard';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'public'
     and tablename = 'assinaturas_contrato'
     and policyname = 'cliente_le_assinaturas';
  if coalesce(v_policy, '') not ilike '%pre_aprovado%' then
    raise exception 'client_signature_policy_missing_pre_aprovado_guard';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'public'
     and tablename = 'assinaturas_contrato'
     and policyname = 'partner_le_assinaturas';
  if coalesce(v_policy, '') not ilike '%pre_aprovado%' then
    raise exception 'partner_signature_policy_missing_pre_aprovado_guard';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'public'
     and tablename = 'proposta_contrato_modelos'
     and policyname = 'cliente_le_contrato_modelos';
  if coalesce(v_policy, '') not ilike '%pre_aprovado%' then
    raise exception 'client_contract_model_policy_missing_pre_aprovado_guard';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'public'
     and tablename = 'proposta_contrato_modelos'
     and policyname = 'partner_le_contrato_modelos';
  if coalesce(v_policy, '') not ilike '%pre_aprovado%' then
    raise exception 'partner_contract_model_policy_missing_pre_aprovado_guard';
  end if;

  select qual into v_policy
    from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname = 'contratos_select';
  if coalesce(v_policy, '') not ilike '%app_can_read_contract_path%' then
    raise exception 'contract_storage_policy_missing_guard_helper';
  end if;

  select pg_get_functiondef(p.oid),
         p.prosecdef,
         p.proconfig,
         p.oid
    into v_function, v_is_security_definer, v_search_path, v_helper_oid
    from pg_proc p
   where p.oid = 'public.app_can_read_contract_path(text)'::regprocedure;
  if not (coalesce(v_function, '') ilike '%pre_aprovado%') then
    raise exception 'contract_storage_helper_missing_pre_aprovado_guard';
  end if;
  if not (coalesce(v_function, '') ilike '%app_is_admin()%') then
    raise exception 'contract_storage_helper_missing_admin_access';
  end if;
  if not coalesce(v_is_security_definer, false) then
    raise exception 'contract_storage_helper_must_bypass_proposal_rls_safely';
  end if;
  if not (coalesce(v_search_path, '{}'::text[]) @> array['search_path=public']) then
    raise exception 'contract_storage_helper_search_path_not_pinned';
  end if;
  if not has_function_privilege('authenticated', v_helper_oid, 'EXECUTE') then
    raise exception 'authenticated_missing_contract_storage_helper_execute';
  end if;
  if has_function_privilege('anon', v_helper_oid, 'EXECUTE') then
    raise exception 'anon_must_not_execute_contract_storage_helper';
  end if;

  -- O acesso administrativo continua explicitamente disponível.
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'contratos'
       and policyname = 'admin_full_contratos'
       and coalesce(qual, '') ilike '%app_is_admin%'
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'contratos'
       and policyname = 'admin_read_contratos'
       and coalesce(qual, '') ilike '%app_is_admin%'
  ) then
    raise exception 'admin_contract_policies_missing';
  end if;
end;
$$;
