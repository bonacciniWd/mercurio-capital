# 09 — Roadmap de Entregas (Fases)

> Objetivo: sequenciar entregas de valor priorizando o caminho crítico **originação → contrato**. Sem estimativas de tempo — o foco é ordem de dependência.

## Fase 0 — Fundações

- [x] Setup Supabase (projetos: local, staging, prod).
- [x] Setup repositório front (Vite + TS + Tailwind + shadcn + React Router + TanStack Query).
- [x] CI: lint, typecheck, testes, build.
- [x] Supabase CLI + esqueleto de migrações.
- [ ] Edge Functions skeleton (deno). _(adiado para Fase 2 — magic-link customizado depende de payload de proposta)_
- [x] Sentry + PostHog conectados.
- [ ] Esquema visual (Storybook ou Ladle) com tokens. _(deferido)_

**Saída**: ambiente reproduzível, deploy contínuo para staging. ✅

---

## Fase 1 — Identidade & Onboarding (M1, M2)

- [x] Migrações: `usuarios`, `partners`, `partner_documentos`, `magic_links`, `sessoes_2fa`, `audit_log`.
- [x] RLS base + helpers `auth.is_admin()`, `auth.partner_id()`. _(implementados como `public.app_is_admin()` / `public.app_partner_id()`)_
- [x] Telas: `/registro`, `/login`, `/recuperar-senha`, `/2fa`, `/magic/:token`.
- [x] Modal de upload de documentos do parceiro. _(componente `PartnerDocsUploader` integrado ao wizard de registro + tela admin)_
- [x] Tela `/admin/parceiros/aprovacoes`. _(consome view `v_admin_partner_aprovacoes` + RPCs `admin_approve_partner` / `admin_reject_partner`)_
- [x] Edge `magic-link/issue` + `magic-link/consume`. _(deploy em `bhagksfvszeogtjvjtpx`: parceiro reemite via `partner_reissue_magic_link`; consume gera sessão Supabase via `auth.admin.generateLink('magiclink')` → frontend chama `verifyOtp`)_
- [ ] Edge `evolution-whatsapp` (envio simples). _(deferido — WhatsApp segue para futuro; e-mail nativo Supabase cobre por ora)_

**Saída**: parceiro consegue se registrar, anexar docs e ser aprovado pelo admin. ✅

---

## Fase 2 — Originação Mínima (M3 núcleo)

- [x] Migrações: `simulacoes`, `propostas`, `proponentes`, `imoveis`, `imovel_proprietarios`, `proposta_status_historico`, `proposta_pendencias`, `proposta_documentos`.
- [x] RLS de todas + triggers de transição de status.
- [x] Wizard `/p/propostas/nova` (7 etapas).
- [x] Lista `/p/propostas` com filtros e busca.
- [x] Detalhe `/p/propostas/:id` com tabs (Resumo, Proponentes, Imóveis, Documentos, Histórico).
- [x] Geração de protocolo + magic link cliente.
- [x] Portal cliente: `/c`, `/c/propostas/:id`, magic-link preview público `/c/proposta/:token`.
- [x] Calculadora Price/SAC (lib + 8 testes unitários).
- [x] Upload de documentos pelo cliente (bucket `proposta-docs` + RLS + componente reutilizável; entregue no início da Fase 3).

**Saída**: parceiro cria proposta, cliente recebe magic link, vê status, faz upload.

---

## Fase 3 — Esteira & Admin Operacional (M3 avançado, M8)

- [x] Kanban global (admin) com drag-and-drop (`@dnd-kit`) e Realtime (`postgres_changes` em `propostas`). Card abre detalhe; mover dispara `admin_set_proposta_status`.
- [x] Tela admin de propostas e detalhe (lista global + detalhe com troca de status e validação de docs).
- [x] Pendências e ciclo de resolução (criar pelo admin/parceiro, cliente responde, admin/parceiro resolve/rejeita; RPCs `pendencia_resolver` e `cliente_responder_pendencia`).
- [x] Consulta pública por protocolo (M7) com rate-limit DB; CAPTCHA plug-in (hCaptcha) pendente sitekey/edge function.
- [x] Upload via UI cliente/parceiro (bucket privado + RLS); pendente: upload via protocolo público (signed URLs).
- [x] OCR pipeline (M11 parcial) — Tesseract.js client-side em imagens pós-upload + RPC `set_documento_ocr`; PDFs não cobertos.
- [x] Notificações in-app (Realtime) + bandeja — triggers para status/pendência/doc validado, sino em todos os layouts.
- [x] Smoke test transacional (`supabase/smoke-tests/fase-3-smoke.sql`) cobrindo proposta→doc→pendência→status→consulta pública→rate-limit.

**Saída**: esteira funcional ponta a ponta até "Proposta ao Cliente". ✅ **Fase 3 fechada em 2026-05-18.**

---

## Fase 4 — Equipe, Dashboards & Relatórios (M4, M5)

- [x] Migrações `equipes`, `equipe_membros` (já em `20260513000002_identidade.sql`) + RPCs e views em `20260518000008_equipes_convites.sql`.
- [x] Convites por magic link — RPCs `partner_invite_membro` / `membro_accept_convite` + página `/convite/:token`.
- [x] Dashboard parceiro (recharts): KPIs, funil, gargalos, evolução 12 meses — views `v_partner_dashboard_kpis`, `v_partner_funil_status`, `v_partner_propostas_por_mes`, `v_partner_gargalos`.
- [x] Filtros (data, status, produto) na edge de exportação; UI parceiro com filtros já presentes.
- [x] Exportação CSV (edge `relatorios-exportar`, UTF-8 BOM, RLS via JWT do caller).
- [x] Dashboard admin global — views `v_admin_dashboard_kpis` e `v_admin_top_partners`.

**Saída**: parceiros gerenciam equipes e enxergam métricas; admin tem visão macro. ✅ **Fase 4 fechada em 2026-05-18.**

---

## Fase 5 — Carteira do Parceiro (M11) — pré-requisito para consultas pagas

- [x] Migrações `partner_wallets`, `wallet_ledger`, `precos_consulta`, `wallet_topups`, `stripe_payment_intents`, `stripe_webhooks_inbox` (`20260513000005_wallet.sql`).
- [x] Funções `wallet_debit` / `wallet_credit` (SECURITY DEFINER, FOR UPDATE) + RPCs `partner_wallet_summary`, `admin_wallet_ajuste`, `admin_wallet_set_bloqueio`, `admin_precos_upsert` (`20260518000010_wallet_fase5.sql`).
- [x] Trigger de criação automática da carteira ao inserir parceiro.
- [x] Edges `wallet-topup` (Stripe Checkout + modo dev), `stripe-webhook` (idempotente via `stripe_webhooks_inbox` + verificação de assinatura HMAC). Extrato via view `v_wallet_extrato`.
- [x] Telas parceiro: `/p/carteira` (saldo, recarga via Checkout, extrato 50 últimas, tabela de preços vigentes).
- [x] Telas admin: `/admin/financeiro/carteiras` (saldos, ajuste manual ±, bloquear/desbloquear), `/admin/financeiro/precos` (upsert versionado + histórico).
- [x] Notificações: triggers `fn_notifica_wallet_movimento` (recarga + saldo baixo R$ 50) e `fn_notifica_wallet_bloqueio`.
- [x] Seed de `precos_consulta` (já em `20260513000007_seeds.sql`).

**Saída**: parceiro recarrega via Stripe; saldo + extrato funcionando; preços versionados; pronto para alimentar a Fase 6. ✅ **Fase 5 fechada em 2026-05-18.**

---

## Fase 6 — Integrações Externas Pagas (M12)

- [x] Edge única `consulta-executar` cobrindo `bacen_cpf/cnpj`, `serasa_pf/pj`, `jusbrasil_cnpj`, `escavador_cnpj`, `ri_digital_matricula`, `nacional_consultas_bens/certidao`.
- [x] **Debita carteira via `wallet_debit` antes da chamada externa**; estorno automático via `consulta_estornar` em falha.
- [x] HTTP 402 padronizado quando `saldo_insuficiente` (403 `wallet_bloqueada`, 422 `preco_nao_configurado`, 502 falha provedor com estorno).
- [x] Telas de "Consultas" no detalhe da proposta (parceiro `editor`, admin `read-only`) com botão por tipo "Consultar (R$ X,XX)".
- [x] Logs em `logs_consultas` (`response` jsonb + `resumo` jsonb + `ledger_debito_id` + `ledger_estorno_id`) e view `v_consultas_proposta`.
- [ ] ⚠️ Provedores em **modo mock** — substituir por chamadas reais (Bacen, Serasa, Jusbrasil, RI Digital, Nacional) quando credenciais estiverem disponíveis. Schema, billing e UI já funcionam end-to-end.
- [ ] Webhook Jusbrasil (monitoramento contínuo) — escopo futuro.

**Saída**: proposta consulta bureaus debitando saldo do parceiro automaticamente. ✅ **Fase 6 fechada em 2026-05-18 (mocks).**

---

## Fase 7 — Contratos & Financeiro

- [ ] Migrações `contratos`, `assinaturas_contrato`, `liberacoes_recurso`, `comissoes`.
- [ ] Geração de PDF de contrato (template renderer).
- [ ] Integração **Clicksign** (webhook).
- [ ] Atualização automática de status (`em_registro`, `contrato_registrado`, `recurso_liberado`).
- [ ] Cálculo e visualização de comissões.
- [ ] Dashboard financeiro admin.

**Saída**: ciclo completo até liberação de recurso e cálculo de comissão.

---

## Fase 8 — Universidade Mercurio (M9)

- [ ] Migrações `cursos`, `modulos`, `capitulos`, `aulas`, `inscricoes`, `aula_progresso`, `certificados`, `assinaturas_universidade`.
- [ ] CMS admin de cursos (módulos, capítulos, aulas, critérios).
- [ ] Player de vídeo + tracking de progresso.
- [ ] Emissão automática de certificados (PDF).
- [ ] Integração com provedor de assinatura (Stripe/Asaas).
- [ ] Gating por assinatura.

**Saída**: LMS operacional com cursos gratuitos e premium.

---

## Fase 9 — Fluxos Evolution & Campanhas (M10)

- [ ] Editor visual de fluxos JSON.
- [ ] `fluxos_evolution`, `fluxo_execucoes`.
- [ ] Catálogo de templates aprovados.
- [ ] `campanhas` com agendamento.
- [ ] Push web (FCM).

**Saída**: comunicação automatizada e campanhas pelo admin.

---

## Fase 10 — Analytics, React Flow & Polimento

- [ ] `/admin/rede` com React Flow (network map).
- [ ] Views materializadas para dashboards pesados.
- [ ] Performance: code splitting, lazy routes, Suspense.
- [ ] Feature flags em produção.
- [ ] Tour onboarding (parceiro).
- [ ] Acessibilidade (WCAG AA).

---

## Fase 11 — Hardening & LGPD

- [ ] Pen test interno (OWASP).
- [ ] Política LGPD: exportação e anonimização.
- [ ] Mascaramento de PII em logs.
- [ ] Documentação operacional (runbooks).
- [ ] Plano de DR (PITR + restore drill).

---

## Backlog para fases futuras

- App mobile (PWA → React Native).
- IA assistente (resumo de docs, sugestão de status, detecção de risco).
- Marketplace de parceiros + ranking público.
- White-label para grupos parceiros.
- Open Banking / PIX integrado.
