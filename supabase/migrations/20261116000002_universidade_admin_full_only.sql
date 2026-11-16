-- FASE 63 — Escrita na Universidade restrita a admin full.
-- Admins comerciais continuam podendo ler conteúdo, mas não alterá-lo.

-- Cursos
drop policy if exists cursos_admin_all on public.cursos;
drop policy if exists cursos_admin_insert_full on public.cursos;
drop policy if exists cursos_admin_update_full on public.cursos;
drop policy if exists cursos_admin_delete_full on public.cursos;

create policy cursos_admin_insert_full on public.cursos
  for insert with check (public.app_is_admin_full());
create policy cursos_admin_update_full on public.cursos
  for update using (public.app_is_admin_full())
  with check (public.app_is_admin_full());
create policy cursos_admin_delete_full on public.cursos
  for delete using (public.app_is_admin_full());

-- Módulos
drop policy if exists modulos_admin_all on public.modulos;
drop policy if exists modulos_admin_insert_full on public.modulos;
drop policy if exists modulos_admin_update_full on public.modulos;
drop policy if exists modulos_admin_delete_full on public.modulos;

create policy modulos_admin_insert_full on public.modulos
  for insert with check (public.app_is_admin_full());
create policy modulos_admin_update_full on public.modulos
  for update using (public.app_is_admin_full())
  with check (public.app_is_admin_full());
create policy modulos_admin_delete_full on public.modulos
  for delete using (public.app_is_admin_full());

-- Aulas
drop policy if exists aulas_admin_all on public.aulas;
drop policy if exists aulas_admin_insert_full on public.aulas;
drop policy if exists aulas_admin_update_full on public.aulas;
drop policy if exists aulas_admin_delete_full on public.aulas;

create policy aulas_admin_insert_full on public.aulas
  for insert with check (public.app_is_admin_full());
create policy aulas_admin_update_full on public.aulas
  for update using (public.app_is_admin_full())
  with check (public.app_is_admin_full());
create policy aulas_admin_delete_full on public.aulas
  for delete using (public.app_is_admin_full());

-- Publicação de curso
create or replace function public.admin_curso_publicar(
  p_curso_id uuid,
  p_status   curso_status default 'publicado'
)
returns cursos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso  cursos%rowtype;
  v_qmod   int;
  v_qaula  int;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status = 'publicado' then
    select count(*) into v_qmod from modulos where curso_id = p_curso_id;
    select count(*) into v_qaula
      from aulas a join modulos m on m.id = a.modulo_id
     where m.curso_id = p_curso_id;
    if v_qmod = 0 or v_qaula = 0 then
      raise exception 'curso_sem_conteudo' using detail =
        'um curso precisa ter ao menos 1 módulo e 1 aula para ser publicado';
    end if;
  end if;

  update cursos set status = p_status, updated_at = now()
   where id = p_curso_id
   returning * into v_curso;
  if not found then
    raise exception 'curso_nao_encontrado';
  end if;
  return v_curso;
end;
$$;

grant execute on function public.admin_curso_publicar(uuid, curso_status) to authenticated;

-- Storage LMS: leitura mantém as policies existentes; toda escrita passa a exigir full.
drop policy if exists "lms_capas_admin_all" on storage.objects;
drop policy if exists "lms_capas_admin_insert_full" on storage.objects;
drop policy if exists "lms_capas_admin_update_full" on storage.objects;
drop policy if exists "lms_capas_admin_delete_full" on storage.objects;

create policy "lms_capas_admin_insert_full" on storage.objects
  for insert with check (bucket_id = 'lms-capas' and public.app_is_admin_full());
create policy "lms_capas_admin_update_full" on storage.objects
  for update using (bucket_id = 'lms-capas' and public.app_is_admin_full())
  with check (bucket_id = 'lms-capas' and public.app_is_admin_full());
create policy "lms_capas_admin_delete_full" on storage.objects
  for delete using (bucket_id = 'lms-capas' and public.app_is_admin_full());

drop policy if exists "lms_recursos_admin_all" on storage.objects;
drop policy if exists "lms_recursos_admin_insert_full" on storage.objects;
drop policy if exists "lms_recursos_admin_update_full" on storage.objects;
drop policy if exists "lms_recursos_admin_delete_full" on storage.objects;

create policy "lms_recursos_admin_insert_full" on storage.objects
  for insert with check (bucket_id = 'lms-recursos' and public.app_is_admin_full());
create policy "lms_recursos_admin_update_full" on storage.objects
  for update using (bucket_id = 'lms-recursos' and public.app_is_admin_full())
  with check (bucket_id = 'lms-recursos' and public.app_is_admin_full());
create policy "lms_recursos_admin_delete_full" on storage.objects
  for delete using (bucket_id = 'lms-recursos' and public.app_is_admin_full());
