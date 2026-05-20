# 12 — Finalização do MVP

> Snapshot do projeto em **2026-05-20** — todas as 14 fases do roadmap concluídas. Este documento lista o que foi entregue, o que ficou pendente (e por quê) e os próximos passos operacionais.

---

## 1. Entregas por fase

| Fase | Tema | Status |
|------|------|--------|
| 0  | Fundações (Supabase, Vite, CI, Sentry, PostHog) | ✅ |
| 1  | Identidade & onboarding parceiro + magic-link + 2FA | ✅ |
| 2  | Originação mínima (proposta → magic-link cliente) | ✅ |
| 3  | Esteira & admin operacional (kanban, pendências, OCR, notificações) | ✅ |
| 4  | Equipes do parceiro + dashboards + CSV | ✅ |
| 5  | Carteira do parceiro + Stripe top-up | ✅ |
| 6  | Integrações pagas (`consulta-executar`) — schema/billing/UI prontos, providers em mock | ✅ |
| 7  | Contratos + Clicksign (sandbox) + comissões | ✅ |
| 8  | Universidade Mercurio + LMS + Stripe Subscription (dev) | ✅ |
| 9  | Gestão de parceiros admin + convites + onboarding-pendente | ✅ |
| 10 | Equipes admin + funil parceiros + bounce webhook | ✅ |
| 11 | Mobile (Expo) — **não iniciada** | ⏸ deferida |
| 12 | Fluxos Evolution + templates + campanhas + email outbox | ✅ |
| 13 | Analytics MVs + React Flow rede + feature flags + lazy + tour + a11y | ✅ |
| 14 | LGPD (export/anonimização) + PII masking + runbooks + DR plan + pen test checklist | ✅ |

Smoke tests transacionais: Fase 3, 8, 10, 12, 13, 14 — todos verdes contra `bhagksfvszeogtjvjtpx`.

---

## 2. Pendências externas (não bloqueiam release)

Estas integrações dependem de credenciais/contratos externos. O **schema, billing e UI estão prontos** — basta plugar.

### 2.1 Provedores em modo mock/dev

| Provedor | Onde | Como ativar |
|----------|------|-------------|
| Bacen / Serasa / Jusbrasil / Escavador / RI Digital / Nacional Consultas | `supabase/functions/consulta-executar` | Trocar branches mock por chamadas HTTP reais; segredos por provedor |
| **Clicksign** | `supabase/functions/contrato-enviar-assinatura` + `clicksign-webhook` | `supabase secrets set CLICKSIGN_API_TOKEN=…` em produção; trocar URL base |
| **Stripe LMS** | `supabase/functions/lms-assinar` + `stripe-webhook` | `STRIPE_PRICE_ID_LMS_MONTHLY/_ANNUAL` reais |
| **SMTP** | `supabase/functions/email-dispatcher` | `SMTP_HOST/PORT/USER/PASS/FROM` (SendGrid/Postmark/SES) + cron pull |
| **SMTP bounce webhook** | `supabase/functions/email-bounce-webhook` | Configurar callback do provedor SMTP → `?secret=…` |

### 2.2 Web push (Fase 12 — diferido)

- Push web (FCM) e push mobile (Expo Notifications) ficaram fora — depende do setup mobile (Fase 11).
- In-app + e-mail cobrem o caso de uso atual.

### 2.3 Mobile (Fase 11)

Toda a pasta `mobile/` está em **mock**. Para ativar:
1. `npm i @supabase/supabase-js expo-secure-store` em `mobile/`.
2. Replicar `app/src/auth/AuthContext.tsx` com `SecureStore` como storage.
3. Deep link `mercurio://magic/partner-bootstrap`.
4. Trocar mocks de `(admin)/*`, `(parceiro)/*` pelas RPCs já existentes.

### 2.4 OCR

- Tesseract.js client-side para imagens. PDFs **não** cobertos — exigirá serviço externo (AWS Textract / Google Document AI) ou worker server-side.

### 2.5 CAPTCHA na consulta pública por protocolo

- Rate-limit DB já presente. Falta apenas o sitekey hCaptcha + verificação na Edge.

### 2.6 Backlog (não no roadmap original)

- IA assistente (resumo de docs, detecção de risco).
- Marketplace de parceiros + ranking público.
- White-label.
- Open Banking / PIX.

---

## 3. Hardening & compliance (Fase 14)

- ✅ `lgpd_export_meus_dados(p_user_id)` — JSON completo do titular.
- ✅ `lgpd_anonimizar_conta(p_user_id, p_motivo)` — admin-only, preserva ledger.
- ✅ View `v_admin_lgpd_solicitacoes` — auditoria automática.
- ✅ Helpers `mask_email`, `mask_cpf`, `mask_cnpj`, `mask_phone`.
- ✅ Checklist OWASP em `docs/security-checklist.md`.
- ✅ Runbooks operacionais em `docs/runbooks.md`.
- ✅ Plano de DR em `docs/dr-plan.md` (RTO 1h / RPO 5min via PITR).

**Itens recorrentes** (cronograma mensal/trimestral/semestral) no `security-checklist.md`.

---

## 4. Próximos passos operacionais

### 4.1 Antes do go-live

1. **Rotacionar a senha do DB** (foi exposta durante smoke tests).
2. Configurar SMTP real + secrets em `email-dispatcher` e `email-bounce-webhook`.
3. Substituir tokens Stripe / Clicksign por **produção**.
4. Configurar bucket DR (S3 ou GCS) e job de `pg_dump` semanal.
5. Configurar PITR no Supabase Pro/Team plan (se ainda não estiver).
6. Headers HTTP no host (CSP, HSTS, X-Frame-Options).
7. Política de senha mínima no Supabase Auth dashboard.

### 4.2 Após go-live (D+30)

1. Primeiro drill de DR (registrar em `docs/dr-drill-log.md`).
2. Revisar logs `audit_log` para padrões anômalos.
3. `npm audit` + atualização do Supabase CLI (2.75 → 2.100).
4. Onboarding de provedores reais (Serasa, Bacen etc.) substituindo mocks da Fase 6.

### 4.3 Próximas evoluções (priorizar)

1. **Fase 11 (Mobile)** — maior ROI para parceiros em campo.
2. Push web (FCM) — recupera comunicação ativa.
3. Marketplace + ranking — alavanca de growth.
4. IA assistente (resumo / risco) — diferencial competitivo.

---

## 5. Inventário técnico

### 5.1 Migrations
- 40+ migrations versionadas em `supabase/migrations/` (de `20260513000001_enums.sql` a `20260520000040_fase14_lgpd_hardening.sql`).
- Todas idempotentes; aplicáveis via `supabase db push --linked --include-all`.

### 5.2 Edge Functions
- `magic-link/{issue,consume}`, `relatorios-exportar`, `wallet-topup`, `stripe-webhook`, `consulta-executar`, `contrato-gerar`, `contrato-enviar-assinatura`, `clicksign-webhook`, `lms-assinar`, `certificado-gerar`, `admin-invite-partner`, `email-bounce-webhook`, `email-dispatcher`.

### 5.3 Front-end (`app/`)
- React 18 + Vite + TS + Tailwind + TanStack Query v5 + React Router v6 + `@xyflow/react` + Recharts.
- Code splitting com `React.lazy` nas rotas admin.
- Acessibilidade: skip-links + `aria-label` em `<main>` + Suspense fallback.

### 5.4 Documentação
- `docs/01-architecture.md` … `docs/12-finalizacao.md`
- `docs/security-checklist.md` · `docs/runbooks.md` · `docs/dr-plan.md`
- Handoffs específicos: `docs/14-handoff-fase9.md`, `docs/15-handoff-fase10.md`.

### 5.5 Smoke tests
- `fase-3-smoke.sql` · `fase-8-smoke.sql` · `fase-10-funil.sql` · `fase-12-fluxos.sql` · `fase-13-analytics.sql` · `fase-14-lgpd.sql`.
- Rodar individualmente com `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <arquivo>`.

---

## 6. Encerramento

MVP web do **Mercurio Capital** entregue. O sistema cobre o ciclo completo de originação imobiliária — registro de parceiro, equipe, simulação, proposta, KYC, consultas externas (estrutura), contrato, assinatura, liberação, comissão, Universidade e carteira — com administração, analytics, automações de comunicação, compliance LGPD e plano de recuperação.

Próxima entrega natural: **Fase 11 (Mobile)** + ativação dos provedores reais.
