-- ---------------------------------------------------------------
-- Hardening: admin_create_proposta(uuid, jsonb) exige admin OPERACIONAL
-- (full + limitado), bloqueando o admin jurídico de criar propostas por
-- chamada direta ao RPC (fora da UI).
--
-- Contexto: até aqui o guard era `public.app_is_admin()`, que também é
-- verdadeiro para admin_nivel='juridico'. A UI web/mobile já esconde a
-- criação para jurídica, mas o RPC precisa recusar a chamada direta.
--
-- Estratégia: reescrita verbatim do corpo vigente (preserva a evolução
-- do Wizard e a injeção de `compoe_renda`), trocando apenas o guard.
-- Idempotente: se o guard já estiver operacional, o replace é no-op.
-- ---------------------------------------------------------------

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.admin_create_proposta(uuid,jsonb)'::regprocedure);

  if position('public.app_is_admin_operacional()' in v_def) = 0 then
    v_def := replace(
      v_def,
      'if not public.app_is_admin() then',
      'if not public.app_is_admin_operacional() then'
    );
    v_def := replace(
      v_def,
      'forbidden: apenas admin pode criar proposta para parceiro',
      'forbidden: apenas admin operacional (full/limitado) pode criar proposta para parceiro'
    );
    execute v_def;
  end if;
end $$;

-- Garante os grants (inalterados) após o CREATE OR REPLACE dinâmico.
revoke all on function public.admin_create_proposta(uuid, jsonb) from public;
grant execute on function public.admin_create_proposta(uuid, jsonb) to authenticated;
