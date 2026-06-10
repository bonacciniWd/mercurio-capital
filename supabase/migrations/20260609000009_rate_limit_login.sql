-- Fase 16.2 — Rate limit de login REAL (lido de configuracoes_sistema)
-- Conta tentativas FALHAS de login por e-mail e por IP, dentro da janela
-- configurada em `rate_limit_login` ({"max":N,"janela_min":M}). A verificação
-- e o registro acontecem server-side na edge `auth-login` (não burlável).
--
-- Reaproveita a tabela `rate_limits` e a filosofia de `check_and_increment`,
-- mas separa "peek" (checar sem incrementar) de "register" (registrar falha),
-- pois no login só queremos contar tentativas que FALHARAM.

-- Verifica se a chave ainda está sob o limite (true = permitido), SEM incrementar.
create or replace function public.rate_limit_peek(
  p_chave  text,
  p_limite int,
  p_janela interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := now() - p_janela;
  v_count  int;
begin
  delete from rate_limits
   where chave = p_chave
     and janela_inicio < v_inicio;

  select coalesce(sum(contagem), 0)
    into v_count
    from rate_limits
   where chave = p_chave
     and janela_inicio >= v_inicio;

  return v_count < p_limite;
end;
$$;

-- Registra uma ocorrência (ex.: tentativa de login falha) para a chave.
create or replace function public.rate_limit_register(p_chave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into rate_limits (chave, contagem, janela_inicio)
  values (p_chave, 1, now());
end;
$$;

-- Limpa o contador da chave (ex.: login bem-sucedido).
create or replace function public.rate_limit_clear(p_chave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from rate_limits where chave = p_chave;
end;
$$;

revoke all on function public.rate_limit_peek(text, int, interval) from public, anon, authenticated;
revoke all on function public.rate_limit_register(text) from public, anon, authenticated;
revoke all on function public.rate_limit_clear(text) from public, anon, authenticated;
grant execute on function public.rate_limit_peek(text, int, interval) to service_role;
grant execute on function public.rate_limit_register(text) to service_role;
grant execute on function public.rate_limit_clear(text) to service_role;

-- Garante a chave de configuração (já existe no seed inicial; idempotente).
insert into public.configuracoes_sistema (chave, valor, descricao)
values ('rate_limit_login', '{"max":5,"janela_min":15}', 'Rate limit do login: máx. tentativas falhas por janela (minutos).')
on conflict (chave) do nothing;
