-- FASE 63 — Escrita na Universidade restrita a admin full.
-- Transacional: os registros de teste são revertidos.

begin;

do $$
declare
  v_full uuid := '63111111-1111-1111-1111-111111111111';
  v_comercial uuid := '63222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data)
  values
    (v_full, 'authenticated', 'authenticated', 'fase63-full@local.dev', crypt('x', gen_salt('bf')), now(), now(), now(), '{"role":"admin","admin_nivel":"full"}'),
    (v_comercial, 'authenticated', 'authenticated', 'fase63-comercial@local.dev', crypt('x', gen_salt('bf')), now(), now(), now(), '{"role":"admin","admin_nivel":"comercial"}');

  update public.usuarios set role = 'admin' where id in (v_full, v_comercial);
  if (select count(*) from public.usuarios where id in (v_full, v_comercial)) <> 2 then
    raise exception 'FASE 63 FAIL: fixtures de usuários ausentes';
  end if;
end $$;

-- Full cria fixtures e exerce os caminhos de escrita válidos.
set local request.jwt.claims = '{"sub":"63111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"full"}}';
set local role authenticated;
do $$
declare
  v_curso uuid;
  v_modulo uuid;
  v_aula uuid;
  v_publicado public.curso_status;
begin
  insert into public.cursos (titulo, status, gratuito, publico, criado_por)
  values ('Fase 63 smoke', 'rascunho', true, 'parceiro', auth.uid())
  returning id into v_curso;
  insert into public.modulos (curso_id, titulo, ordem)
  values (v_curso, 'Módulo smoke', 1) returning id into v_modulo;
  insert into public.aulas (modulo_id, titulo, ordem, tipo, vimeo_id, duracao_segundos)
  values (v_modulo, 'Aula smoke', 1, 'video', '863000001', 60) returning id into v_aula;

  select result.status into v_publicado
    from public.admin_curso_publicar(v_curso, 'publicado') as result;
  if v_publicado <> 'publicado' then
    raise exception 'FASE 63 FAIL: admin full não publicou curso';
  end if;

  insert into storage.objects (bucket_id, name, owner_id, version)
  values ('lms-capas', 'fase63/full-cover.png', auth.uid(), '1');
  insert into storage.objects (bucket_id, name, owner_id, version)
  values ('lms-recursos', 'fase63/full-resource.pdf', auth.uid(), '1');
  update storage.objects
     set metadata = coalesce(metadata, '{}'::jsonb) || '{"fase63":true}'::jsonb
   where bucket_id = 'lms-capas' and name = 'fase63/full-cover.png';
  if not found then raise exception 'FASE 63 FAIL: admin full não atualizou capa'; end if;
  update storage.objects
     set metadata = coalesce(metadata, '{}'::jsonb) || '{"fase63":true}'::jsonb
   where bucket_id = 'lms-recursos' and name = 'fase63/full-resource.pdf';
  if not found then raise exception 'FASE 63 FAIL: admin full não atualizou recurso'; end if;
  raise notice 'FASE 63 full: escrita e publicação permitidas';
end $$;
reset role;

-- Comercial lê o curso, mas não altera ou publica e não escreve nos buckets.
set local request.jwt.claims = '{"sub":"63222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"admin","admin_nivel":"comercial"}}';
set local role authenticated;
do $$
declare
  v_curso uuid;
  v_modulo uuid;
  v_aula uuid;
  v_status public.curso_status;
  v_rows integer;
begin
  select id into v_curso from public.cursos where titulo = 'Fase 63 smoke';
  if v_curso is null then raise exception 'FASE 63 FAIL: comercial não leu curso'; end if;
  select id into v_modulo from public.modulos where curso_id = v_curso;
  select id into v_aula from public.aulas where modulo_id = v_modulo;

  begin
    insert into public.cursos (titulo, status, gratuito, publico)
    values ('Fase 63 comercial proibido', 'rascunho', true, 'parceiro');
    raise exception 'FASE 63 FAIL: comercial criou curso';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.modulos (curso_id, titulo, ordem)
    values (v_curso, 'Módulo comercial proibido', 2);
    raise exception 'FASE 63 FAIL: comercial criou módulo';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.aulas (modulo_id, titulo, ordem, tipo, vimeo_id, duracao_segundos)
    values (v_modulo, 'Aula comercial proibida', 2, 'video', '863000002', 60);
    raise exception 'FASE 63 FAIL: comercial criou aula';
  exception when insufficient_privilege then null; end;

  update public.modulos set titulo = 'Módulo alterado' where id = v_modulo;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FASE 63 FAIL: comercial alterou módulo'; end if;
  update public.aulas set titulo = 'Aula alterada' where id = v_aula;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FASE 63 FAIL: comercial alterou aula'; end if;

  update public.cursos set status = 'arquivado' where id = v_curso;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FASE 63 FAIL: comercial alterou curso'; end if;
  select status into v_status from public.cursos where id = v_curso;
  if v_status <> 'publicado' then raise exception 'FASE 63 FAIL: status mudou para comercial'; end if;

  begin
    perform public.admin_curso_publicar(v_curso, 'arquivado');
    raise exception 'FASE 63 FAIL: comercial alterou curso via RPC';
  exception when insufficient_privilege then null; end;

  begin
    insert into storage.objects (bucket_id, name, owner_id, version)
    values ('lms-capas', 'fase63/comercial-cover.png', auth.uid(), '1');
    raise exception 'FASE 63 FAIL: comercial gravou capa';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name, owner_id, version)
    values ('lms-recursos', 'fase63/comercial-resource.pdf', auth.uid(), '1');
    raise exception 'FASE 63 FAIL: comercial gravou recurso';
  exception when insufficient_privilege then null; end;
  update storage.objects
     set metadata = coalesce(metadata, '{}'::jsonb) || '{"comercial":true}'::jsonb
   where bucket_id = 'lms-capas' and name = 'fase63/full-cover.png';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FASE 63 FAIL: comercial atualizou capa'; end if;
  update storage.objects
     set metadata = coalesce(metadata, '{}'::jsonb) || '{"comercial":true}'::jsonb
   where bucket_id = 'lms-recursos' and name = 'fase63/full-resource.pdf';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FASE 63 FAIL: comercial atualizou recurso'; end if;

  raise notice 'FASE 63 comercial: leitura permitida e escrita negada';
end $$;
reset role;

-- Verifica que todas as policies específicas de escrita estão instaladas.
do $$
declare
  v_missing text[];
begin
  select array_agg(expected.name)
    into v_missing
    from (values
      ('public','cursos','cursos_admin_insert_full','INSERT'), ('public','cursos','cursos_admin_update_full','UPDATE'), ('public','cursos','cursos_admin_delete_full','DELETE'),
      ('public','modulos','modulos_admin_insert_full','INSERT'), ('public','modulos','modulos_admin_update_full','UPDATE'), ('public','modulos','modulos_admin_delete_full','DELETE'),
      ('public','aulas','aulas_admin_insert_full','INSERT'), ('public','aulas','aulas_admin_update_full','UPDATE'), ('public','aulas','aulas_admin_delete_full','DELETE'),
      ('storage','objects','lms_capas_admin_insert_full','INSERT'), ('storage','objects','lms_capas_admin_update_full','UPDATE'), ('storage','objects','lms_capas_admin_delete_full','DELETE'),
      ('storage','objects','lms_recursos_admin_insert_full','INSERT'), ('storage','objects','lms_recursos_admin_update_full','UPDATE'), ('storage','objects','lms_recursos_admin_delete_full','DELETE')
    ) as expected(schemaname, tablename, name, cmd)
   where not exists (
     select 1 from pg_policies p
      where p.schemaname = expected.schemaname
        and p.tablename = expected.tablename
        and p.policyname = expected.name
        and p.cmd = expected.cmd
        and coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') ilike '%app_is_admin_full%'
   );
  if v_missing is not null then
    raise exception 'FASE 63 FAIL: policies ausentes: %', v_missing;
  end if;
  raise notice 'FASE 63 policies: catálogo completo';
end $$;

rollback;

select 'FASE 63 SMOKE: OK' as resultado;
