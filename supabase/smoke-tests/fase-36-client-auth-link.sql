-- FASE 36 — vínculo entre cliente comercial e autenticação
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-36-client-auth-link.sql
-- Transação reversível: todos os dados de teste são removidos no rollback.

begin;

do $$
declare
  v_admin_uid       uuid := gen_random_uuid();
  v_partner_uid     uuid := gen_random_uuid();
  v_client_uid      uuid := gen_random_uuid();
  v_unlinked_uid    uuid := gen_random_uuid();
  v_partner_id      uuid;
  v_client_id       uuid;
  v_unlinked_id     uuid;
  v_linked_proposal uuid;
  v_unlinked_prop   uuid;
  v_profile         json;
  v_visible_count   int;
  v_orphans         int;
begin
  -- Nenhum cliente client elegível deve permanecer sem vínculo depois da
  -- migration de backfill, salvo e-mails duplicados ou papel conflitante.
  select count(*)
    into v_orphans
    from public.clientes c
    join auth.users au on lower(btrim(au.email)) = lower(btrim(c.email))
    left join public.usuarios u on u.id = au.id
   where c.usuario_id is null
     and nullif(btrim(c.email), '') is not null
     and coalesce(
       u.role::text,
       au.raw_app_meta_data ->> 'role',
       au.raw_user_meta_data ->> 'role',
       'client'
     ) = 'client'
     and not exists (
       select 1
         from public.clientes same_email
        where same_email.usuario_id is null
          and lower(btrim(same_email.email)) = lower(btrim(c.email))
        group by lower(btrim(same_email.email))
       having count(*) > 1
     );

  if v_orphans > 0 then
    raise exception 'FASE 36 FAIL: existem % clientes com Auth client elegível sem vínculo', v_orphans;
  end if;

  insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
  values
    (v_admin_uid,    'fase36-admin-'    || replace(v_admin_uid::text,    '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_partner_uid,  'fase36-partner-'  || replace(v_partner_uid::text,  '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_client_uid,   'fase36-client-'   || replace(v_client_uid::text,   '-', '') || '@test.local', '{}'::jsonb, now(), now()),
    (v_unlinked_uid, 'fase36-unlinked-' || replace(v_unlinked_uid::text, '-', '') || '@test.local', '{}'::jsonb, now(), now());

  update public.usuarios set role = 'admin' where id = v_admin_uid;
  update public.usuarios set role = 'partner' where id = v_partner_uid;
  update public.usuarios set role = 'client' where id in (v_client_uid, v_unlinked_uid);

  insert into public.partners (usuario_id, status)
  values (v_partner_uid, 'approved')
  returning id into v_partner_id;

  insert into public.clientes (usuario_id, nome_completo, email)
  values (v_client_uid, 'Fase 36 Cliente Vinculado', 'fase36-client-' || replace(v_client_uid::text, '-', '') || '@test.local')
  returning id into v_client_id;

  insert into public.clientes (usuario_id, nome_completo, email)
  values (null, 'Fase 36 Cliente Sem Vínculo', 'fase36-unlinked-' || replace(v_unlinked_uid::text, '-', '') || '@test.local')
  returning id into v_unlinked_id;

  insert into public.propostas (partner_id, cliente_id, produto, valor_solicitado, prazo_meses)
  values (v_partner_id, v_client_id, 'home_equity', 100000, 120)
  returning id into v_linked_proposal;

  insert into public.propostas (partner_id, cliente_id, produto, valor_solicitado, prazo_meses)
  values (v_partner_id, v_unlinked_id, 'home_equity', 200000, 120)
  returning id into v_unlinked_prop;

  if not exists (select 1 from public.clientes where id = v_client_id and usuario_id = v_client_uid) then
    raise exception 'FASE 36 FAIL: cliente vinculado não preservou usuario_id';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_client_uid::text, 'app_metadata', json_build_object('role', 'client'))::text,
    true
  );
  set local role authenticated;

  select public.me() into v_profile;
  if v_profile->>'id' <> v_client_uid::text or v_profile->>'role' <> 'client' then
    raise exception 'FASE 36 FAIL: me() não retornou o perfil client vinculado';
  end if;

  select count(*) into v_visible_count from public.propostas;
  if v_visible_count <> 1 then
    raise exception 'FASE 36 FAIL: cliente viu % propostas; esperado 1', v_visible_count;
  end if;

  if exists (select 1 from public.propostas where id = v_unlinked_prop) then
    raise exception 'FASE 36 FAIL: proposta de cliente sem vínculo ficou visível';
  end if;

  reset role;
  raise notice 'FASE 36 SMOKE: OK — perfil client, vínculo e isolamento RLS';
end $$;

rollback;
