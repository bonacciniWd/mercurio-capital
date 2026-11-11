create table if not exists public.merx_leads_publicos (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  nome_completo text not null check (char_length(btrim(nome_completo)) between 3 and 160),
  email text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  telefone text not null check (telefone ~ '^[0-9]{10,13}$'),
  interesse text not null default 'atendimento' check (interesse in ('atendimento','home_equity','construcao')),
  pagina_origem text not null check (pagina_origem in ('/','/download','/simulador','/credito-para-construcao')),
  consentimento_em timestamptz not null default now(),
  consentimento_versao text not null default 'merx_publica_v1' check (consentimento_versao = 'merx_publica_v1'),
  origem text not null default 'Site da Mercúrio · MERX' check (origem = 'Site da Mercúrio · MERX'),
  created_at timestamptz not null default now()
);
alter table public.merx_leads_publicos enable row level security;
create policy merx_leads_publicos_admin_read on public.merx_leads_publicos for select to authenticated using (public.app_is_admin());
revoke all on public.merx_leads_publicos from public, anon, authenticated;
grant select on public.merx_leads_publicos to authenticated;
grant insert, select on public.merx_leads_publicos to service_role;

create or replace function public.admin_merx_publica_obter()
returns jsonb language sql security definer set search_path = public
as $$ select coalesce((select valor from public.configuracoes_sistema where chave = 'merx_publica'), '{"habilitado":false,"captacao_habilitada":false,"saudacao":"Como posso ajudar?","mensagem_sem_resposta":"Ainda não encontrei essa informação no FAQ público."}'::jsonb); $$;
create or replace function public.admin_merx_publica_salvar(p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_config jsonb;
begin
  if not public.app_is_admin_full() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_config) <> 'object' then raise exception 'config_invalid' using errcode = '22023'; end if;
  v_config := jsonb_build_object(
    'habilitado', coalesce((p_config->>'habilitado')::boolean, false),
    'captacao_habilitada', coalesce((p_config->>'captacao_habilitada')::boolean, false),
    'saudacao', left(coalesce(p_config->>'saudacao', 'Como posso ajudar?'), 180),
    'mensagem_sem_resposta', left(coalesce(p_config->>'mensagem_sem_resposta', 'Ainda não encontrei essa informação no FAQ público.'), 500)
  );
  insert into public.configuracoes_sistema(chave, valor, updated_by, updated_at) values ('merx_publica', v_config, auth.uid(), now())
  on conflict (chave) do update set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return v_config;
end; $$;
revoke all on function public.admin_merx_publica_obter() from public, anon, authenticated;
revoke all on function public.admin_merx_publica_salvar(jsonb) from public, anon, authenticated;
grant execute on function public.admin_merx_publica_obter() to authenticated;
grant execute on function public.admin_merx_publica_salvar(jsonb) to authenticated;

create or replace function public.public_merx_config_obter()
returns jsonb language sql security definer set search_path = public
as $$ select jsonb_build_object('habilitado', coalesce((valor->>'habilitado')::boolean, false), 'captacao_habilitada', coalesce((valor->>'captacao_habilitada')::boolean, false), 'saudacao', coalesce(valor->>'saudacao', 'Como posso ajudar?'), 'mensagem_sem_resposta', coalesce(valor->>'mensagem_sem_resposta', 'Ainda não encontrei essa informação no FAQ público.')) from public.configuracoes_sistema where chave = 'merx_publica' and coalesce((valor->>'habilitado')::boolean, false); $$;
revoke all on function public.public_merx_config_obter() from public, anon, authenticated;
grant execute on function public.public_merx_config_obter() to anon, authenticated;
