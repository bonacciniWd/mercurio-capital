-- =============================================
-- SMOKE TEST FASE 14 — LGPD & PII masking
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-14-lgpd.sql
-- =============================================

begin;

do $$
declare
  v_admin     uuid;
  v_target    uuid;
  v_jwt_admin jsonb;
  v_export    jsonb;
  v_anon      jsonb;
  v_email_after text;
begin
  -- masking helpers
  if public.mask_email('jose.silva@example.com')      not like 'j%@example.com' then raise exception 'mask_email falhou'; end if;
  if public.mask_cpf('123.456.789-00')                <> '***.***.789-**'       then raise exception 'mask_cpf falhou'; end if;
  if public.mask_cnpj('12.345.678/0001-99')           <> '**.***.***/0001-**'   then raise exception 'mask_cnpj falhou'; end if;
  if public.mask_phone('+55 11 99876-5432')           not like '%5432'          then raise exception 'mask_phone falhou'; end if;

  -- pega admin e um partner como alvo
  select id into v_admin from public.usuarios where role = 'admin' limit 1;
  select usuario_id into v_target from public.partners where usuario_id <> v_admin limit 1;
  if v_admin is null or v_target is null then raise exception 'precisa de 1 admin + 1 partner'; end if;

  v_jwt_admin := jsonb_build_object('sub', v_admin::text, 'role','authenticated',
                  'app_metadata', jsonb_build_object('role','admin','two_factor_at', now()));
  perform set_config('request.jwt.claims', v_jwt_admin::text, true);

  -- export
  v_export := public.lgpd_export_meus_dados(v_target);
  if (v_export->>'titular_id')::uuid <> v_target then raise exception 'export titular inesperado'; end if;
  if v_export->'usuario' is null then raise exception 'export sem dados usuario'; end if;
  raise notice 'export OK — propostas=% docs=%',
    jsonb_array_length(v_export->'propostas'),
    jsonb_array_length(v_export->'partner_documentos');

  -- anonimizar
  v_anon := public.lgpd_anonimizar_conta(v_target, p_motivo := 'smoke test fase 14');
  if (v_anon->>'ok')::boolean is not true then raise exception 'anonimizar falhou: %', v_anon; end if;
  raise notice 'anonimizar OK — partner=% cliente=%', v_anon->>'partner_id', v_anon->>'cliente_id';

  select email into v_email_after from public.usuarios where id = v_target;
  if v_email_after not like 'anon+%@anonimizado.mercuriocapital.local' then
    raise exception 'usuario nao foi anonimizado (email=%)', v_email_after;
  end if;

  -- view de auditoria deve conter 2 entradas
  if (select count(*) from v_admin_lgpd_solicitacoes where titular_id = v_target) < 2 then
    raise exception 'view lgpd_solicitacoes deveria ter export + anonimizar';
  end if;

  raise notice 'FASE 14 SMOKE: OK';
end;
$$;

rollback;
