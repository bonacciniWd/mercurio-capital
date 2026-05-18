-- =============================================
-- MIGRATION 040 — FASE 8: Universidade Mercurio (LMS)
-- =============================================
-- Cursos / módulos / aulas (vídeo Vimeo, PDF, quiz, texto), inscrições,
-- progresso por aula, certificados, assinatura mensal/anual via Stripe.
-- =============================================

-- ---------------------------------------------
-- 1) ENUMS
-- ---------------------------------------------

do $$ begin
  create type curso_nivel as enum ('iniciante','intermediario','avancado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type curso_publico as enum ('cliente','parceiro','ambos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type curso_status as enum ('rascunho','publicado','arquivado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type aula_tipo as enum ('video','pdf','quiz','texto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assinatura_lms_status as enum ('trialing','ativa','past_due','cancelada','expirada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------
-- 2) TABELAS
-- ---------------------------------------------

create table if not exists cursos (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null,
  slug                text unique,
  descricao           text,
  categoria           text,
  nivel               curso_nivel not null default 'iniciante',
  publico             curso_publico not null default 'ambos',
  status              curso_status not null default 'rascunho',
  capa_storage_path   text,
  ordem               int not null default 0,
  gratuito            boolean not null default true,
  preco_centavos      bigint,
  criado_por          uuid references usuarios(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_cursos_updated_at on cursos;
create trigger trg_cursos_updated_at before update on cursos
  for each row execute function set_updated_at();

create index if not exists cursos_status_idx on cursos(status, ordem);

create table if not exists modulos (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references cursos(id) on delete cascade,
  titulo      text not null,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists modulos_curso_idx on modulos(curso_id, ordem);

create table if not exists aulas (
  id                uuid primary key default gen_random_uuid(),
  modulo_id         uuid not null references modulos(id) on delete cascade,
  titulo            text not null,
  descricao         text,
  ordem             int not null default 0,
  tipo              aula_tipo not null default 'video',
  vimeo_id          text,
  pdf_storage_path  text,
  conteudo_md       text,
  duracao_segundos  int,
  gratuita          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_aulas_updated_at on aulas;
create trigger trg_aulas_updated_at before update on aulas
  for each row execute function set_updated_at();

create index if not exists aulas_modulo_idx on aulas(modulo_id, ordem);

create table if not exists assinaturas_universidade (
  id                      uuid primary key default gen_random_uuid(),
  usuario_id              uuid not null unique references usuarios(id) on delete cascade,
  status                  assinatura_lms_status not null default 'trialing',
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  valor_centavos          bigint,
  ciclo                   text not null default 'mensal' check (ciclo in ('mensal','anual')),
  current_period_end      timestamptz,
  cancelada_em            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists trg_assinaturas_lms_updated_at on assinaturas_universidade;
create trigger trg_assinaturas_lms_updated_at before update on assinaturas_universidade
  for each row execute function set_updated_at();

create table if not exists inscricoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  curso_id      uuid not null references cursos(id) on delete cascade,
  iniciado_em   timestamptz not null default now(),
  concluido_em  timestamptz,
  percentual    numeric(5,2) not null default 0,
  unique (usuario_id, curso_id)
);

create index if not exists inscricoes_usuario_idx on inscricoes(usuario_id);

create table if not exists aula_progresso (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references usuarios(id) on delete cascade,
  aula_id              uuid not null references aulas(id) on delete cascade,
  curso_id             uuid not null references cursos(id) on delete cascade,
  posicao_segundos     int not null default 0,
  concluida            boolean not null default false,
  concluida_em         timestamptz,
  ultima_visualizacao  timestamptz not null default now(),
  unique (usuario_id, aula_id)
);

create index if not exists aula_progresso_user_idx
  on aula_progresso(usuario_id, curso_id);

create table if not exists certificados (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios(id) on delete cascade,
  curso_id          uuid not null references cursos(id) on delete cascade,
  codigo            text not null unique,
  pdf_storage_path  text,
  emitido_em        timestamptz not null default now(),
  unique (usuario_id, curso_id)
);

-- ---------------------------------------------
-- 3) HELPER: app_has_lms_subscription
-- ---------------------------------------------
create or replace function public.app_has_lms_subscription()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from assinaturas_universidade a
     where a.usuario_id = auth.uid()
       and a.status in ('ativa','trialing')
  );
$$;

-- ---------------------------------------------
-- 4) RLS
-- ---------------------------------------------

alter table cursos                    enable row level security;
alter table modulos                   enable row level security;
alter table aulas                     enable row level security;
alter table inscricoes                enable row level security;
alter table aula_progresso            enable row level security;
alter table certificados              enable row level security;
alter table assinaturas_universidade  enable row level security;

-- cursos
drop policy if exists cursos_select on cursos;
create policy cursos_select on cursos
  for select using (status = 'publicado' or public.app_is_admin());

drop policy if exists cursos_admin_all on cursos;
create policy cursos_admin_all on cursos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- modulos (herda curso)
drop policy if exists modulos_select on modulos;
create policy modulos_select on modulos
  for select using (
    exists (
      select 1 from cursos c where c.id = modulos.curso_id
        and (c.status = 'publicado' or public.app_is_admin())
    )
  );

drop policy if exists modulos_admin_all on modulos;
create policy modulos_admin_all on modulos
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- aulas
drop policy if exists aulas_select on aulas;
create policy aulas_select on aulas
  for select using (
    public.app_is_admin()
    or exists (
      select 1
        from modulos m
        join cursos c on c.id = m.curso_id
       where m.id = aulas.modulo_id
         and c.status = 'publicado'
         and (
           c.gratuito
           or aulas.gratuita
           or public.app_has_lms_subscription()
         )
    )
  );

drop policy if exists aulas_admin_all on aulas;
create policy aulas_admin_all on aulas
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- inscricoes
drop policy if exists inscricoes_select on inscricoes;
create policy inscricoes_select on inscricoes
  for select using (usuario_id = auth.uid() or public.app_is_admin());

drop policy if exists inscricoes_insert on inscricoes;
create policy inscricoes_insert on inscricoes
  for insert with check (usuario_id = auth.uid() or public.app_is_admin());

drop policy if exists inscricoes_update_admin on inscricoes;
create policy inscricoes_update_admin on inscricoes
  for update using (public.app_is_admin()) with check (public.app_is_admin());

-- aula_progresso
drop policy if exists aula_progresso_owner on aula_progresso;
create policy aula_progresso_owner on aula_progresso
  for all using (usuario_id = auth.uid() or public.app_is_admin())
        with check (usuario_id = auth.uid() or public.app_is_admin());

-- certificados
drop policy if exists certificados_select on certificados;
create policy certificados_select on certificados
  for select using (usuario_id = auth.uid() or public.app_is_admin());

drop policy if exists certificados_admin_all on certificados;
create policy certificados_admin_all on certificados
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- assinaturas_universidade
drop policy if exists assinaturas_lms_select on assinaturas_universidade;
create policy assinaturas_lms_select on assinaturas_universidade
  for select using (usuario_id = auth.uid() or public.app_is_admin());

drop policy if exists assinaturas_lms_admin_all on assinaturas_universidade;
create policy assinaturas_lms_admin_all on assinaturas_universidade
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------------------------------------------
-- 5) SEQUENCE para código de certificado
-- ---------------------------------------------
create sequence if not exists certificado_codigo_seq start 1;

-- ---------------------------------------------
-- 6) RPC: lms_inscrever
-- ---------------------------------------------
create or replace function public.lms_inscrever(p_curso_id uuid)
returns inscricoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso  cursos%rowtype;
  v_insc   inscricoes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select * into v_curso from cursos where id = p_curso_id;
  if not found then
    raise exception 'curso_nao_encontrado';
  end if;
  if v_curso.status <> 'publicado' and not public.app_is_admin() then
    raise exception 'curso_nao_publicado';
  end if;
  if not v_curso.gratuito and not public.app_has_lms_subscription() and not public.app_is_admin() then
    raise exception 'assinatura_necessaria';
  end if;

  insert into inscricoes (usuario_id, curso_id)
  values (auth.uid(), p_curso_id)
  on conflict (usuario_id, curso_id) do update set iniciado_em = inscricoes.iniciado_em
  returning * into v_insc;

  return v_insc;
end;
$$;

revoke all on function public.lms_inscrever(uuid) from public;
grant execute on function public.lms_inscrever(uuid) to authenticated;

-- ---------------------------------------------
-- 7) RPC: lms_marcar_aula (upsert progresso)
-- ---------------------------------------------
create or replace function public.lms_marcar_aula(
  p_aula_id          uuid,
  p_posicao_segundos int default null,
  p_concluida        boolean default null
)
returns aula_progresso
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso_id uuid;
  v_row      aula_progresso%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select c.id into v_curso_id
    from aulas a
    join modulos m on m.id = a.modulo_id
    join cursos  c on c.id = m.curso_id
   where a.id = p_aula_id;
  if v_curso_id is null then
    raise exception 'aula_nao_encontrada';
  end if;

  -- garante inscrição (não bloqueia preview)
  insert into inscricoes (usuario_id, curso_id)
  values (auth.uid(), v_curso_id)
  on conflict (usuario_id, curso_id) do nothing;

  insert into aula_progresso (
    usuario_id, aula_id, curso_id,
    posicao_segundos, concluida, concluida_em, ultima_visualizacao
  ) values (
    auth.uid(), p_aula_id, v_curso_id,
    coalesce(p_posicao_segundos, 0),
    coalesce(p_concluida, false),
    case when coalesce(p_concluida, false) then now() else null end,
    now()
  )
  on conflict (usuario_id, aula_id) do update set
    posicao_segundos    = coalesce(p_posicao_segundos, aula_progresso.posicao_segundos),
    concluida           = coalesce(p_concluida, aula_progresso.concluida),
    concluida_em        = case
                            when coalesce(p_concluida, aula_progresso.concluida)
                                 and aula_progresso.concluida_em is null
                            then now()
                            else aula_progresso.concluida_em
                          end,
    ultima_visualizacao = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.lms_marcar_aula(uuid, int, boolean) to authenticated;

-- ---------------------------------------------
-- 8) FUNÇÃO: gerar certificado (interno + RPC admin)
-- ---------------------------------------------
create or replace function public.lms_gerar_certificado_interno(
  p_usuario_id uuid,
  p_curso_id   uuid
)
returns certificados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente certificados%rowtype;
  v_novo      certificados%rowtype;
  v_codigo    text;
  v_protocolo text;
begin
  select * into v_existente from certificados
   where usuario_id = p_usuario_id and curso_id = p_curso_id;
  if found then
    return v_existente;
  end if;

  v_codigo := 'MC-CERT-' || lpad(nextval('certificado_codigo_seq')::text, 6, '0');

  insert into certificados (usuario_id, curso_id, codigo)
  values (p_usuario_id, p_curso_id, v_codigo)
  returning * into v_novo;

  -- notificação in_app
  insert into notificacoes(usuario_id, canal, titulo, mensagem, link, metadata)
  values (
    p_usuario_id, 'in_app',
    'Certificado emitido',
    format('Parabéns! Você concluiu o curso e recebeu o certificado %s.', v_codigo),
    '/p/universidade',
    jsonb_build_object('certificado_id', v_novo.id, 'curso_id', p_curso_id)
  );

  return v_novo;
end;
$$;

create or replace function public.lms_gerar_certificado(p_inscricao_id uuid)
returns certificados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insc inscricoes%rowtype;
begin
  select * into v_insc from inscricoes where id = p_inscricao_id;
  if not found then
    raise exception 'inscricao_nao_encontrada';
  end if;
  if v_insc.usuario_id <> auth.uid() and not public.app_is_admin() then
    raise exception 'forbidden';
  end if;
  if v_insc.percentual < 100 then
    raise exception 'curso_nao_concluido';
  end if;
  return public.lms_gerar_certificado_interno(v_insc.usuario_id, v_insc.curso_id);
end;
$$;

grant execute on function public.lms_gerar_certificado(uuid) to authenticated;

-- ---------------------------------------------
-- 9) TRIGGER: recalcula progresso da inscrição
-- ---------------------------------------------
create or replace function public.fn_calcular_progresso_curso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total       int;
  v_concluidas  int;
  v_pct         numeric(5,2);
begin
  -- total de aulas do curso
  select count(*) into v_total
    from aulas a
    join modulos m on m.id = a.modulo_id
   where m.curso_id = new.curso_id;
  if v_total = 0 then
    return new;
  end if;

  select count(*) into v_concluidas
    from aula_progresso ap
    join aulas a on a.id = ap.aula_id
    join modulos m on m.id = a.modulo_id
   where m.curso_id = new.curso_id
     and ap.usuario_id = new.usuario_id
     and ap.concluida = true;

  v_pct := round(v_concluidas::numeric * 100.0 / v_total, 2);

  insert into inscricoes (usuario_id, curso_id, percentual)
  values (new.usuario_id, new.curso_id, v_pct)
  on conflict (usuario_id, curso_id) do update set
    percentual    = v_pct,
    concluido_em  = case when v_pct >= 100 and inscricoes.concluido_em is null
                         then now()
                         else inscricoes.concluido_em end;

  -- emite certificado ao atingir 100%
  if v_pct >= 100 then
    perform public.lms_gerar_certificado_interno(new.usuario_id, new.curso_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_calcular_progresso on aula_progresso;
create trigger trg_calcular_progresso
  after insert or update of concluida on aula_progresso
  for each row execute function public.fn_calcular_progresso_curso();

-- ---------------------------------------------
-- 10) RPC ADMIN: publicar curso (com validação)
-- ---------------------------------------------
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
  if not public.app_is_admin() then
    raise exception 'forbidden';
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

-- ---------------------------------------------
-- 11) VIEWS
-- ---------------------------------------------

-- Catálogo: 1 linha por curso publicado + dados agregados + inscrição do usuário
create or replace view public.v_lms_catalogo as
  select
    c.id, c.titulo, c.slug, c.descricao, c.categoria, c.nivel, c.publico,
    c.status, c.capa_storage_path, c.gratuito, c.preco_centavos, c.ordem,
    coalesce(mc.qtd_modulos, 0)             as qtd_modulos,
    coalesce(ac.qtd_aulas, 0)               as qtd_aulas,
    coalesce(ac.duracao_total_segundos, 0)  as duracao_total_segundos,
    i.id                                    as inscricao_id,
    coalesce(i.percentual, 0)               as percentual_concluido,
    i.iniciado_em,
    i.concluido_em,
    cert.id                                 as certificado_id,
    cert.codigo                             as certificado_codigo
  from cursos c
  left join lateral (
    select count(*) as qtd_modulos from modulos m where m.curso_id = c.id
  ) mc on true
  left join lateral (
    select count(*) as qtd_aulas,
           sum(coalesce(a.duracao_segundos,0)) as duracao_total_segundos
      from aulas a
      join modulos m on m.id = a.modulo_id
     where m.curso_id = c.id
  ) ac on true
  left join inscricoes i
    on i.curso_id = c.id and i.usuario_id = auth.uid()
  left join certificados cert
    on cert.curso_id = c.id and cert.usuario_id = auth.uid()
  where c.status = 'publicado' or public.app_is_admin();

grant select on public.v_lms_catalogo to authenticated;

-- Estrutura do curso para o player (módulos → aulas + progresso do usuário)
create or replace view public.v_lms_curso_estrutura as
  select
    c.id            as curso_id,
    c.titulo        as curso_titulo,
    c.gratuito,
    m.id            as modulo_id,
    m.titulo        as modulo_titulo,
    m.ordem         as modulo_ordem,
    a.id            as aula_id,
    a.titulo        as aula_titulo,
    a.descricao     as aula_descricao,
    a.tipo          as aula_tipo,
    a.vimeo_id,
    a.pdf_storage_path,
    a.conteudo_md,
    a.duracao_segundos,
    a.gratuita,
    a.ordem         as aula_ordem,
    ap.posicao_segundos,
    ap.concluida,
    ap.concluida_em
  from cursos c
  join modulos m on m.curso_id = c.id
  join aulas a on a.modulo_id = m.id
  left join aula_progresso ap
    on ap.aula_id = a.id and ap.usuario_id = auth.uid()
  where c.status = 'publicado' or public.app_is_admin();

grant select on public.v_lms_curso_estrutura to authenticated;

-- ---------------------------------------------
-- 12) STORAGE BUCKETS LMS
-- ---------------------------------------------

-- capas: público (qualquer um pode ver), só admin escreve
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lms-capas','lms-capas', true, 2 * 1024 * 1024,
  array['image/png','image/jpeg','image/webp']
) on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- recursos: privado (PDF de aulas + certificados HTML)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lms-recursos','lms-recursos', false, 50 * 1024 * 1024,
  array['application/pdf','text/html','image/png','image/jpeg']
) on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- helper: usuário pode acessar recurso lms? (assinatura ativa ou curso gratuito)
create or replace function public.app_can_access_lms_path(p_name text)
returns boolean
language sql
stable
as $$
  -- path pattern aceito:
  --   certificados/<usuario_id>/<codigo>.html  → só o dono ou admin
  --   <curso_id>/<aula_id>/<arquivo>           → curso publicado e (gratuito ou assinatura)
  select case
    when split_part(p_name, '/', 1) = 'certificados' then
      split_part(p_name, '/', 2) = auth.uid()::text
      or public.app_is_admin()
    else
      public.app_is_admin()
      or exists (
        select 1 from cursos c
         where c.id::text = split_part(p_name, '/', 1)
           and c.status = 'publicado'
           and (c.gratuito or public.app_has_lms_subscription())
      )
  end
$$;

drop policy if exists "lms_capas_select" on storage.objects;
create policy "lms_capas_select" on storage.objects
  for select using (bucket_id = 'lms-capas');

drop policy if exists "lms_capas_admin_all" on storage.objects;
create policy "lms_capas_admin_all" on storage.objects
  for all using (bucket_id = 'lms-capas' and public.app_is_admin())
        with check (bucket_id = 'lms-capas' and public.app_is_admin());

drop policy if exists "lms_recursos_select" on storage.objects;
create policy "lms_recursos_select" on storage.objects
  for select using (bucket_id = 'lms-recursos' and public.app_can_access_lms_path(name));

drop policy if exists "lms_recursos_admin_all" on storage.objects;
create policy "lms_recursos_admin_all" on storage.objects
  for all using (bucket_id = 'lms-recursos' and public.app_is_admin())
        with check (bucket_id = 'lms-recursos' and public.app_is_admin());

-- ---------------------------------------------
-- 13) REALTIME (opcional)
-- ---------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'inscricoes'
  ) then
    execute 'alter publication supabase_realtime add table inscricoes';
  end if;
exception when others then null;
end$$;

