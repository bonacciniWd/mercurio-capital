-- =============================================
-- SMOKE TEST FASE 8 — Universidade Mercurio (LMS)
-- =============================================
-- Roteiro de validação manual em uma transação reversível.
-- Uso: psql ... -f supabase/smoke-tests/fase-8-smoke.sql
-- Tudo roda dentro de BEGIN/ROLLBACK — nenhum dado é persistido.

begin;

-- ---- pré-requisitos ----
-- Usa um admin existente (primeiro encontrado) e um usuário "aluno"
do $$
declare
  v_admin uuid;
  v_aluno uuid;
  v_curso uuid;
  v_mod   uuid;
  v_a1    uuid;
  v_a2    uuid;
begin
  select id into v_admin from usuarios where role = 'admin' limit 1;
  select id into v_aluno from usuarios where role = 'partner' limit 1;
  if v_admin is null or v_aluno is null then
    raise notice 'precisa de pelo menos 1 admin e 1 partner no banco';
    return;
  end if;

  -- impersona admin para criar curso
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text,
                      'app_metadata', json_build_object('role','admin'))::text, true);

  insert into cursos (titulo, status, gratuito, publico, criado_por)
  values ('Smoke Test Curso', 'rascunho', true, 'parceiro', v_admin)
  returning id into v_curso;

  insert into modulos (curso_id, titulo, ordem) values (v_curso, 'Módulo 1', 0) returning id into v_mod;
  insert into aulas (modulo_id, titulo, ordem, tipo, vimeo_id, duracao_segundos)
    values (v_mod, 'Aula 1', 0, 'video', '824612345', 600) returning id into v_a1;
  insert into aulas (modulo_id, titulo, ordem, tipo, vimeo_id, duracao_segundos)
    values (v_mod, 'Aula 2', 1, 'video', '824612346', 800) returning id into v_a2;

  -- publica via RPC (valida módulos + aulas)
  perform admin_curso_publicar(v_curso, 'publicado');

  raise notice 'curso publicado: %', v_curso;

  -- impersona o aluno (partner)
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_aluno::text,
                      'app_metadata', json_build_object('role','partner','approved',true))::text, true);

  -- inscreve
  perform lms_inscrever(v_curso);

  -- progresso aula 1: 50%
  perform lms_marcar_aula(v_a1, 300, false);
  -- conclui aula 1
  perform lms_marcar_aula(v_a1, 600, true);
  -- conclui aula 2 → 100% → deve emitir certificado
  perform lms_marcar_aula(v_a2, 800, true);

  -- valida
  perform 1 from inscricoes where usuario_id = v_aluno and curso_id = v_curso and percentual = 100;
  if not found then
    raise exception 'progresso não atingiu 100%%';
  end if;

  perform 1 from certificados where usuario_id = v_aluno and curso_id = v_curso;
  if not found then
    raise exception 'certificado não foi emitido';
  end if;

  raise notice '✓ smoke test fase 8 ok — certificado emitido para usuario % no curso %', v_aluno, v_curso;
end$$;

-- ---- RLS: usuário sem assinatura em curso pago ----
-- (omitido — exige seed específico; testar no front)

rollback;

