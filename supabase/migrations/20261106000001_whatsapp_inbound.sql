-- WhatsApp Cloud API inbound messages with admin-only visibility and 60-day retention.

create table if not exists public.whatsapp_mensagens_recebidas (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique check (char_length(provider_message_id) between 1 and 128),
  phone_number_id text not null check (char_length(phone_number_id) between 1 and 64),
  sender_phone text not null check (sender_phone ~ '^\+[0-9]{8,15}$'),
  sender_profile_name text check (sender_profile_name is null or char_length(sender_profile_name) <= 160),
  message_type text not null check (message_type ~ '^[a-z_]{1,32}$'),
  text_body text check (text_body is null or char_length(text_body) <= 4000),
  body_truncated boolean not null default false,
  received_at timestamptz not null,
  association_status text not null default 'unmatched'
    check (association_status in ('unmatched', 'ambiguous', 'linked')),
  usuario_id uuid references public.usuarios(id) on delete set null,
  proposta_id uuid references public.propostas(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days'),
  constraint whatsapp_mensagens_recebidas_text_only
    check (message_type = 'text' or text_body is null),
  constraint whatsapp_mensagens_recebidas_link_consistent
    check (association_status <> 'linked' or (usuario_id is not null and proposta_id is not null))
);

create index if not exists idx_whatsapp_mensagens_recebidas_created
  on public.whatsapp_mensagens_recebidas (received_at desc);
create index if not exists idx_whatsapp_mensagens_recebidas_phone
  on public.whatsapp_mensagens_recebidas (sender_phone, received_at desc);
create index if not exists idx_whatsapp_mensagens_recebidas_expiry
  on public.whatsapp_mensagens_recebidas (expires_at);

alter table public.whatsapp_mensagens_recebidas enable row level security;
revoke all on public.whatsapp_mensagens_recebidas from public, anon, authenticated;
grant select on public.whatsapp_mensagens_recebidas to authenticated;
grant select, insert on public.whatsapp_mensagens_recebidas to service_role;

drop policy if exists whatsapp_mensagens_recebidas_admin_read
  on public.whatsapp_mensagens_recebidas;
create policy whatsapp_mensagens_recebidas_admin_read
  on public.whatsapp_mensagens_recebidas
  for select to authenticated
  using (public.app_is_admin());

create or replace function public.whatsapp_mensagens_recebidas_expurgar_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.whatsapp_mensagens_recebidas
   where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.whatsapp_mensagens_recebidas_expurgar_vencidas()
  from public, anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'whatsapp-inbound-expurgo-diario'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$$;

-- The app's established cron convention schedules jobs in UTC.
select cron.schedule(
  'whatsapp-inbound-expurgo-diario',
  '15 3 * * *',
  'select public.whatsapp_mensagens_recebidas_expurgar_vencidas();'
);
