-- Execute after the two 20261108 mobile migrations, preferably inside a
-- transaction that is rolled back when validating a local snapshot.
do $$
begin
  if not public.mobile_documento_valido('PF', '52998224725')
     or public.mobile_documento_valido('PF', '52998224724')
     or public.mobile_documento_valido('PF', '11111111111')
     or not public.mobile_documento_valido('PJ', '11222333000181')
     or public.mobile_documento_valido('PJ', '11222333000180') then
    raise exception 'mobile_documento_valido_falhou';
  end if;

  if has_table_privilege('anon', 'public.proposta_onboarding_respostas', 'SELECT')
     or has_table_privilege('authenticated', 'public.proposta_onboarding_respostas', 'INSERT')
     or has_table_privilege('authenticated', 'public.partner_onboarding_respostas', 'UPDATE')
     or has_function_privilege('anon', 'public.mobile_cliente_onboarding_salvar(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.mobile_partner_onboarding_salvar(jsonb)', 'EXECUTE') then
    raise exception 'mobile_onboarding_permissoes_invalidas';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.proposta_onboarding_respostas'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.partner_onboarding_respostas'::regclass) then
    raise exception 'mobile_onboarding_rls_desativada';
  end if;

  if (select valor from public.configuracoes_sistema where chave = 'mobile_relock_segundos') <> '60'::jsonb then
    raise exception 'mobile_relock_default_invalido';
  end if;
end;
$$;
