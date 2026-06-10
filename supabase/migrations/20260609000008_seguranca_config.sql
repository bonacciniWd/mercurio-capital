-- Fase 16.1 — Políticas de segurança aplicáveis de fato
-- Torna configuráveis e REALMENTE aplicadas:
--   * senha_min_length  — validado em todos os fluxos de definição de senha
--   * sessao_idle_*_min — auto-logout por inatividade (web e mobile)
-- 2FA para admin já é exigido pelo backend (app_requires_2fa() nas RLS/triggers);
-- a UI apenas exibe esse status.

-- 1) Seed da chave de tamanho mínimo de senha (idempotente)
insert into public.configuracoes_sistema (chave, valor, descricao)
values
  ('senha_min_length', '8', 'Tamanho mínimo de senha exigido nos cadastros e redefinições.')
on conflict (chave) do nothing;

-- 2) RPC pública para ler o mínimo de senha mesmo em telas não autenticadas
--    (cadastro, redefinição via magic link). SECURITY DEFINER + grant a anon.
create or replace function public.senha_min_length()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(regexp_replace((valor #>> '{}'), '\D', '', 'g'), '')::int,
    8
  )
  from public.configuracoes_sistema
  where chave = 'senha_min_length';
$$;

grant execute on function public.senha_min_length() to anon, authenticated;
