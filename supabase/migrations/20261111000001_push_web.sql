-- Push Web (Frente A — plano aprovado em prompts/2026-11-11-push-web-fcm.md §6).
-- Issues #10 (modelo/RLS/RPCs) e #12 (fan-out), entregues juntas conforme §9 do plano.
-- Decisão do dono (2026-11-11): tokens reutilizam push_devices (existente, dormente);
-- push_subscriptions não é criada. Desvios pontuais do plano, aprovados: canal 'push'
-- também faz fan-out; RPC de marcação segue o padrão email_outbox_marcar (push_outbox_marcar).

-- ---------------------------------------------------------------
-- 1) push_devices: ciclo de vida do token
-- ---------------------------------------------------------------
alter table public.push_devices
  add column ativo boolean not null default true,
  add column user_agent text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create trigger trg_push_devices_updated_at
  before update on public.push_devices
  for each row execute function public.set_updated_at();

create index push_devices_usuario_ativos_idx
  on public.push_devices (usuario_id) where ativo;

-- ---------------------------------------------------------------
-- 2) opt-out global por usuário (verificado no enqueue e no dispatch)
-- ---------------------------------------------------------------
alter table public.usuarios
  add column push_opt_out boolean not null default false;

-- ---------------------------------------------------------------
-- 3) push_outbox: fila de envio, 1 push por notificação (idempotência)
-- ---------------------------------------------------------------
create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  notificacao_id uuid not null unique references public.notificacoes(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  link text,
  status text not null default 'pendente'
    check (status in ('pendente','enviando','enviado','falha','incerto','cancelado')),
  tentativas integer not null default 0 check (tentativas >= 0),
  proxima_tentativa_at timestamptz not null default now(),
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_push_outbox_updated_at
  before update on public.push_outbox
  for each row execute function public.set_updated_at();

create index push_outbox_fila_idx
  on public.push_outbox (proxima_tentativa_at) where status = 'pendente';

alter table public.push_outbox enable row level security;

-- Grants de tabela no padrão estrito (migration whatsapp 20261106000002):
-- fila fora do alcance direto de authenticated/anon; admin observa via policy + grant select.
revoke all on public.push_outbox from public, anon, authenticated;
grant select on public.push_outbox to authenticated;
grant all on public.push_outbox to service_role;

-- Fila é service_role; admin apenas observa. Nenhuma policy para authenticated/anon além da de leitura admin.
create policy "admin_le_push_outbox" on public.push_outbox
  for select using (public.app_is_admin());

-- ---------------------------------------------------------------
-- 4) RPCs de dispositivo e preferência (authenticated)
-- ---------------------------------------------------------------
create or replace function public.push_subscription_upsert(
  p_token text,
  p_user_agent text default null
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;
  if p_token is null or length(trim(p_token)) = 0 or length(p_token) > 4096 then
    raise exception 'token invalido';
  end if;

  insert into public.push_devices (usuario_id, plataforma, token, user_agent, ativo, ultimo_uso)
  values (auth.uid(), 'web', trim(p_token), nullif(left(coalesce(p_user_agent, ''), 512), ''), true, now())
  on conflict (token) do update
     set usuario_id = excluded.usuario_id, -- reassocia ao trocar de conta no mesmo navegador
         user_agent = excluded.user_agent,
         ativo = true,
         ultimo_uso = now()
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.push_subscription_upsert(text, text) from public, anon, authenticated;
grant execute on function public.push_subscription_upsert(text, text) to authenticated;

create or replace function public.push_subscription_revogar(p_token text)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;

  update public.push_devices
     set ativo = false,
         ultimo_uso = now()
   where token = p_token
     and (usuario_id = auth.uid() or public.app_is_admin());
end;
$$;
revoke all on function public.push_subscription_revogar(text) from public, anon, authenticated;
grant execute on function public.push_subscription_revogar(text) to authenticated;

create or replace function public.push_preferencia_set(p_opt_out boolean)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;

  update public.usuarios set push_opt_out = p_opt_out where id = auth.uid();

  if p_opt_out then
    update public.push_devices set ativo = false where usuario_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.push_preferencia_set(boolean) from public, anon, authenticated;
grant execute on function public.push_preferencia_set(boolean) to authenticated;

-- ---------------------------------------------------------------
-- 5) RPCs do dispatcher (service_role apenas — padrão email_outbox)
-- ---------------------------------------------------------------
create or replace function public.push_outbox_pull(p_limit integer default 20)
returns setof public.push_outbox
language plpgsql security definer
set search_path = public as $$
begin
  -- higiene 1: estado terminal para pendências que esgotaram as 5 tentativas
  update public.push_outbox
     set status = 'falha',
         erro = coalesce(erro, 'tentativas_esgotadas')
   where status = 'pendente'
     and tentativas >= 5;

  -- higiene 2 (sweeper): 'enviando' órfãos (dispatcher morreu antes de marcar) voltam à fila
  update public.push_outbox
     set status = 'pendente',
         erro = 'reenfileirado_por_sweeper'
   where status = 'enviando'
     and updated_at < now() - interval '10 minutes';

  -- higiene 3: cancela pendências cujo usuário fez opt-out ou ficou sem dispositivo ativo
  update public.push_outbox o
     set status = 'cancelado',
         erro = 'opt_out_ou_sem_dispositivo'
   where o.status = 'pendente'
     and (exists (select 1 from public.usuarios u
                   where u.id = o.usuario_id and u.push_opt_out)
       or not exists (select 1 from public.push_devices d
                       where d.usuario_id = o.usuario_id and d.ativo));

  return query
  with sel as (
    select o.id
      from public.push_outbox o
     where o.status = 'pendente'
       and o.proxima_tentativa_at <= now()
       and o.tentativas < 5
     order by o.proxima_tentativa_at asc
     limit p_limit
     for update skip locked
  )
  update public.push_outbox o
     set status = 'enviando',
         tentativas = o.tentativas + 1
    from sel
   where o.id = sel.id
  returning o.*;
end;
$$;
revoke all on function public.push_outbox_pull(integer) from public, anon, authenticated;
grant execute on function public.push_outbox_pull(integer) to service_role;

create or replace function public.push_outbox_marcar(
  p_id uuid,
  p_status text,
  p_erro text default null
) returns void
language plpgsql security definer
set search_path = public as $$
begin
  if p_status not in ('enviado','falha','incerto','pendente','cancelado') then
    raise exception 'status invalido: %', p_status;
  end if;

  update public.push_outbox
     set status = p_status,
         erro = p_erro,
         -- requeue em 'pendente' usa backoff exponencial (tentativas já incrementada no pull)
         proxima_tentativa_at = case
           when p_status = 'pendente' then now() + (interval '1 minute' * power(2, tentativas))
           else proxima_tentativa_at
         end
   where id = p_id;
end;
$$;
revoke all on function public.push_outbox_marcar(uuid, text, text) from public, anon, authenticated;
grant execute on function public.push_outbox_marcar(uuid, text, text) to service_role;

-- Limpeza de token morto (FCM UNREGISTERED/INVALID_ARGUMENT) pelo dispatcher.
create or replace function public.push_device_desativar(p_token text)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  update public.push_devices
     set ativo = false,
         ultimo_uso = now()
   where token = p_token;
end;
$$;
revoke all on function public.push_device_desativar(text) from public, anon, authenticated;
grant execute on function public.push_device_desativar(text) to service_role;

-- ---------------------------------------------------------------
-- 6) Fan-out: notificação in_app/push enfileira push (issue #12)
-- ---------------------------------------------------------------
create or replace function public.enqueue_push_da_notificacao()
returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if new.canal in ('in_app','push')
     and exists (select 1 from public.push_devices d
                  where d.usuario_id = new.usuario_id and d.ativo)
     and not exists (select 1 from public.usuarios u
                      where u.id = new.usuario_id and u.push_opt_out) then
    insert into public.push_outbox (usuario_id, notificacao_id, titulo, mensagem, link)
    values (new.usuario_id, new.id, new.titulo, new.mensagem, new.link)
    on conflict (notificacao_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_push_da_notificacao() from public, anon, authenticated;

create trigger trg_notificacao_enqueue_push
  after insert on public.notificacoes
  for each row execute function public.enqueue_push_da_notificacao();
