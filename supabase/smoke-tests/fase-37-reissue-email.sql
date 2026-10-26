-- FASE 37 — reemissão de magic link por e-mail
-- Smoke contratual, sem escrita persistente.

do $$
declare
  v_result jsonb;
begin
  if to_regprocedure('public.enqueue_proposta_magic_link_reissue_email(uuid,text)') is null then
    raise exception 'FASE 37 FAIL: RPC de reemissão de e-mail ausente';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.enqueue_proposta_magic_link_reissue_email(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'FASE 37 FAIL: RPC de reemissão não está restrita ao service_role';
  end if;

  select public.enqueue_proposta_magic_link_reissue_email(gen_random_uuid(), '')
    into v_result;

  if v_result->>'email_status' <> 'falha_enqueue'
     or v_result->>'email_erro' <> 'magic_token_ausente' then
    raise exception 'FASE 37 FAIL: validação de token ausente incorreta: %', v_result;
  end if;
end
$$;

select 'FASE 37 SMOKE: OK' as resultado;
