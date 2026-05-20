# Pen Test Interno — Checklist OWASP

> Última revisão: 2026-05-20 · Responsável: Engenharia + Segurança
> Escopo: app web (Vite + Supabase), Edge Functions, Postgres (RLS).

Checklist baseado em OWASP Top 10 (2021). Cada item deve ser executado antes de release maior e a cada trimestre.

---

## A01 — Broken Access Control

- [x] **RLS habilitada em todas as tabelas com PII** (`pg_tables` cruzado com `pg_policies`). Conferir trimestralmente:
  ```sql
  select t.tablename
    from pg_tables t
    left join pg_class c on c.relname = t.tablename
   where t.schemaname = 'public'
     and not c.relrowsecurity;
  ```
- [x] Helpers `app_is_admin`, `app_user_role`, `app_partner_id`, `app_is_approved` em `security definer` com `set search_path = public`.
- [x] Todas as RPCs admin verificam `app_is_admin()` no primeiro statement.
- [x] Guards no front (`RequireRole`, `Require2FA`, `RequireApproved`) — defense-in-depth, RLS é a fonte de verdade.
- [ ] Auditar mensalmente RPCs novas com `grep -nE "create or replace function" supabase/migrations | wc -l`.

## A02 — Cryptographic Failures

- [x] HTTPS obrigatório (Supabase / Vercel TLS).
- [x] Senhas armazenadas via `auth.users` (bcrypt do Supabase Auth).
- [x] 2FA TOTP obrigatório para admin (`two_factor_at` claim).
- [ ] Storage buckets de documentos: `signed url` com TTL ≤ 5 min.
- [ ] Service role key apenas em Edge Functions; nunca commitar.

## A03 — Injection

- [x] Postgres: 100% PL/pgSQL com parâmetros nomeados — sem concat de SQL.
- [x] App: TanStack Query + Supabase client tipado.
- [ ] Edge Functions: revisar `body` JSON antes de passar pro DB.
- [ ] Sanitização de HTML em `templates_mensagem` (render server-side, sem `dangerouslySetInnerHTML` em emails).

## A04 — Insecure Design

- [x] Funil parceiro com transições explícitas (`partner_status` enum + `admin_*` RPCs).
- [x] Wallet/ledger append-only com triggers garantindo integridade.
- [x] Audit log imutável (políticas `for update using(false)`).

## A05 — Security Misconfiguration

- [x] `set search_path = public` em todas funções `security definer`.
- [x] `revoke all from public` + `grant execute to authenticated` explícito.
- [ ] Headers HTTP — verificar CSP, HSTS, X-Frame-Options no host (Vercel/Cloudflare).
- [ ] Variáveis sensíveis fora do repo (`app/.env` no `.gitignore`).

## A06 — Vulnerable & Outdated Components

- [ ] `npm audit --production` mensalmente. Atual: 5 moderate (revisar — não bloqueantes).
- [ ] Atualizar `@supabase/supabase-js` quando houver patch security.
- [ ] Manter Supabase CLI atualizado (último: 2.75 → 2.100 disponível).

## A07 — Identification & Auth Failures

- [x] Magic link via Supabase Auth.
- [x] 2FA TOTP enrollment (`/p/two-factor`, admin obrigatório).
- [x] Sessão refresh automatizado.
- [ ] Rate-limit em endpoints de login/recover (Edge Function ou Cloudflare).
- [ ] Política de senha mínima no Supabase Auth dashboard (≥ 10 chars + complexidade).

## A08 — Software & Data Integrity

- [x] Migrations versionadas em `supabase/migrations/`.
- [x] CI: smoke tests por fase em `supabase/smoke-tests/`.
- [ ] Pacote `package-lock.json` commitado (npm ci no deploy).
- [ ] Edge Functions deployed apenas via `supabase functions deploy` (não via dashboard direto).

## A09 — Security Logging & Monitoring

- [x] `audit_log` registra todas mutações sensíveis (aprovações, comissões, anonimizações).
- [x] `v_admin_lgpd_solicitacoes` rastreia export + anonimização.
- [ ] Alertas em audit_log para `acao in ('lgpd_anonimizar','partner_rejeitado','two_factor_disabled')`.
- [ ] PostHog (web) — não capturar PII (revisar autocaptura).

## A10 — Server-Side Request Forgery

- [x] Edge Functions só falam com Supabase + provedores conhecidos (SMTP, FCM).
- [ ] Validar URLs em campos de configuração (ex.: webhooks).

---

## Cronograma

| Frequência | Atividade |
|------------|-----------|
| Mensal     | `npm audit` + revisão de RPCs novas + alertas audit_log |
| Trimestral | Checklist completo + revisão de buckets/storage |
| Semestral  | Pen test externo (contratado) |
| A cada PR  | Code review com foco em RLS / `security definer` |
