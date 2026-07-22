-- =============================================
-- SMOKE TEST — CHECKLIST DE DOCUMENTOS (placeholders)
-- =============================================
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-23-documentos-checklist.sql
-- Transação reversível (rollback ao final). Cobre:
--   proposta PF → seed → placeholders PF + Imóvel;
--   proposta PJ → seed → placeholders PJ + Imóvel;
--   idempotência do seed.

begin;

do $$
declare
  v_uid     uuid := gen_random_uuid();
  v_partner uuid;
  v_prop_pf uuid;
  v_prop_pj uuid;
  v_cnt     int;
  v_cnt2    int;
  v_pf_req  int;
  v_pj_req  int;
  v_im_req  int;
begin
  -- sem JWT → auth.uid() null → triggers permissivos nas inserções diretas
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_pf_req from public.documento_requisitos where categoria = 'pessoa_fisica';
  select count(*) into v_pj_req from public.documento_requisitos where categoria = 'pessoa_juridica';
  select count(*) into v_im_req from public.documento_requisitos where categoria = 'imovel';

  if v_pf_req = 0 or v_pj_req = 0 or v_im_req = 0 then
    raise exception 'FASE 23 FAIL: catalogo documento_requisitos incompleto (pf=%, pj=%, imovel=%)', v_pf_req, v_pj_req, v_im_req;
  end if;

  -- auth.users seed (superuser); o trigger handle_new_user cria o espelho em public.usuarios
  insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
  values (v_uid, 'docs.smoke.' || replace(v_uid::text, '-', '') || '@test.local', '{}'::jsonb, now(), now());
  update public.usuarios set role = 'partner', nome_completo = 'Docs Smoke' where id = v_uid;

  insert into public.partners (usuario_id, status)
  values (v_uid, 'approved')
  returning id into v_partner;

  -- JWT do parceiro dono: o seed de documentos (disparado por trigger em proponentes)
  -- tem guard de ownership; sem contexto autorizado o seed vira no-op.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid::text, 'app_metadata', json_build_object('role', 'partner', 'approved', true, 'partner_id', v_partner::text))::text,
    true
  );

  -- ---------------------------------------------------------------
  -- Proposta PF
  -- ---------------------------------------------------------------
  insert into public.propostas (partner_id, produto, valor_solicitado, prazo_meses)
  values (v_partner, 'home_equity', 100000, 24)
  returning id into v_prop_pf;

  -- proponente principal PF → dispara o trigger de seed
  insert into public.proponentes (proposta_id, principal, pessoa_tipo, nome)
  values (v_prop_pf, true, 'PF', 'Fulano PF');

  select count(*) into v_cnt from public.proposta_documentos
   where proposta_id = v_prop_pf and categoria = 'pessoa_fisica' and status = 'pendente' and storage_path is null;
  if v_cnt <> v_pf_req then
    raise exception 'FASE 23 FAIL: placeholders PF esperados %, obtidos %', v_pf_req, v_cnt;
  end if;

  select count(*) into v_cnt from public.proposta_documentos
   where proposta_id = v_prop_pf and categoria = 'imovel' and status = 'pendente' and storage_path is null;
  if v_cnt <> v_im_req then
    raise exception 'FASE 23 FAIL: placeholders Imovel (PF) esperados %, obtidos %', v_im_req, v_cnt;
  end if;

  select count(*) into v_cnt from public.proposta_documentos
   where proposta_id = v_prop_pf and categoria = 'pessoa_juridica';
  if v_cnt <> 0 then
    raise exception 'FASE 23 FAIL: proposta PF nao deveria ter placeholders PJ (obtidos %)', v_cnt;
  end if;

  -- idempotência: rodar seed de novo não duplica
  select count(*) into v_cnt from public.proposta_documentos where proposta_id = v_prop_pf;
  perform public.proposta_documentos_seed(v_prop_pf);
  select count(*) into v_cnt2 from public.proposta_documentos where proposta_id = v_prop_pf;
  if v_cnt <> v_cnt2 then
    raise exception 'FASE 23 FAIL: seed nao idempotente (antes %, depois %)', v_cnt, v_cnt2;
  end if;

  -- ---------------------------------------------------------------
  -- Proposta PJ
  -- ---------------------------------------------------------------
  insert into public.propostas (partner_id, produto, valor_solicitado, prazo_meses)
  values (v_partner, 'home_equity', 200000, 36)
  returning id into v_prop_pj;

  insert into public.proponentes (proposta_id, principal, pessoa_tipo, nome)
  values (v_prop_pj, true, 'PJ', 'Empresa PJ');

  select count(*) into v_cnt from public.proposta_documentos
   where proposta_id = v_prop_pj and categoria = 'pessoa_juridica' and status = 'pendente' and storage_path is null;
  if v_cnt <> v_pj_req then
    raise exception 'FASE 23 FAIL: placeholders PJ esperados %, obtidos %', v_pj_req, v_cnt;
  end if;

  select count(*) into v_cnt from public.proposta_documentos
   where proposta_id = v_prop_pj and categoria = 'imovel' and status = 'pendente' and storage_path is null;
  if v_cnt <> v_im_req then
    raise exception 'FASE 23 FAIL: placeholders Imovel (PJ) esperados %, obtidos %', v_im_req, v_cnt;
  end if;

  select count(*) into v_cnt from public.proposta_documentos
   where proposta_id = v_prop_pj and categoria = 'pessoa_fisica';
  if v_cnt <> 0 then
    raise exception 'FASE 23 FAIL: proposta PJ nao deveria ter placeholders PF (obtidos %)', v_cnt;
  end if;

  raise notice '✓ FASE 23 SMOKE: OK — placeholders PF+Imovel / PJ+Imovel + seed idempotente';
end $$;

rollback;
