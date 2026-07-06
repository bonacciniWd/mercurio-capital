-- =============================================
-- FIX 2FA CHECK — usa AAL do JWT (Supabase Auth MFA nativo)
-- =============================================
--
-- Contexto:
-- A função public.app_has_verified_2fa() lia apenas a tabela public.sessoes_2fa,
-- que NUNCA é populada porque o app usa o MFA nativo do Supabase Auth
-- (auth.mfa_factors, verificação via supabase.auth.mfa.verify). Assim, admins
-- com Google Authenticator configurado continuavam bloqueados pelas RLS/triggers
-- que exigem app_requires_2fa() + 2FA verificado.
--
-- Correção: passar a considerar o claim "aal" do JWT. Quando o usuário faz o
-- desafio TOTP (auth.mfa.verify), o Supabase eleva a sessão para "aal2" e
-- reemite o access token com esse claim. Mantemos o fallback para sessoes_2fa
-- por compatibilidade caso alguma integração antiga ainda escreva ali.

create or replace function public.app_has_verified_2fa()
returns boolean
language sql
stable
as $$
  select coalesce(
    -- 1) Sessão elevada via MFA nativo do Supabase (TOTP) => JWT com aal=aal2
    nullif(current_setting('request.jwt.claim.aal', true), '') = 'aal2',
    (auth.jwt() ->> 'aal') = 'aal2',
    -- 2) Fallback legado: registro em public.sessoes_2fa marcado como verificado
    (
      select s.verificado
      from public.sessoes_2fa s
      where s.usuario_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

comment on function public.app_has_verified_2fa() is
  'Retorna true quando a sessão atual foi elevada para AAL2 via MFA nativo do Supabase (TOTP) ou, por compatibilidade, quando existe registro verificado em public.sessoes_2fa.';

