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
- [x] Pós-go-live: convite de equipe com e-mail transacional automático (`email_outbox`) + template `convite_equipe_v1` + fallback manual nas telas web/mobile (`20260706000019_partner_invite_email_outbox.sql`).
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
- [x] **Bacen SCR — integração real (Onda 1)**: edge `consulta-executar` com cliente HTTP configurável (OAuth2/bearer), resolução server-side do documento (CPF/CNPJ), normalização de resposta e gate anti-mock (`BACEN_ALLOW_MOCK=false`). Requer `BACEN_SCR_API_URL` + credenciais do provedor homologado. Divergência documentada: SCR não tem API pública direta.
- [ ] ⚠️ Demais provedores em **modo mock** — substituir por chamadas reais (Serasa em progresso, Jusbrasil, RI Digital, Nacional) quando credenciais estiverem disponíveis. Schema, billing e UI já funcionam end-to-end.
- [ ] Webhook Jusbrasil (monitoramento contínuo) — escopo futuro.

**Saída**: proposta consulta bureaus debitando saldo do parceiro automaticamente. ✅ **Fase 6 fechada em 2026-05-18 (mocks).**

---

## Fase 7 — Contratos & Financeiro

- [x] Migrações `contratos`, `assinaturas_contrato`, `liberacoes_recurso`, `comissoes` (schema base já existia desde `20260513000004_operacoes.sql`; complementos em `20260518000030_contratos_fase7.sql`: colunas, RPCs, triggers, views, buckets).
- [x] Geração de PDF/HTML de contrato (template renderer server-side em `supabase/functions/contrato-gerar/template.ts` + edge `contrato-gerar`).
- [x] Integração **Clicksign** sandbox (edge `contrato-enviar-assinatura` + webhook `clicksign-webhook` com HMAC + idempotência via `clicksign_webhooks_inbox`). Modo dev sem token simula envelope.
- [x] Atualização automática de status (`emissao_contrato` → `aguardando_assinatura` → `em_registro` → `contrato_registrado` → `recurso_liberado`) via RPCs e webhook; trigger de transição ajustado para permitir parceiro gerar contrato e service_role processar webhook.
- [x] Cálculo e visualização de comissões — trigger `trg_calcular_comissao` em `liberacoes_recurso`; RPCs `comissao_aprovar` / `comissao_marcar_paga`.
- [x] Dashboard financeiro admin (`/admin/financeiro`) consumindo view `v_financeiro_admin` + `v_comissoes_admin`; página parceiro `/p/comissoes`.
- [x] Tab "Contrato" no detalhe de proposta (parceiro/admin/cliente) com fluxo completo: gerar → enviar → assinar → registrar → liberar → comissão.
- [x] Notificações in-app de contrato assinado e recurso liberado.
- [ ] ⚠️ Provedor **Clicksign em sandbox/dev** — substituir token quando ambiente de produção for habilitado.

**Saída**: ciclo completo até liberação de recurso e cálculo de comissão. ✅ **Fase 7 fechada em 2026-05-18 (Clicksign sandbox).**

---

## Fase 8 — Universidade Mercurio (M9)

- [x] Migrações `cursos`, `modulos`, `aulas`, `inscricoes`, `aula_progresso`, `certificados`, `assinaturas_universidade` (`20260518000040_universidade_fase8.sql`) — RLS, RPCs, trigger de progresso, views `v_lms_catalogo` / `v_lms_curso_estrutura`, buckets `lms-capas` (público) e `lms-recursos` (privado).
- [x] CMS admin de cursos (`/admin/universidade`) — CRUD curso/módulo/aula, upload de capa, RPC `admin_curso_publicar` valida módulos/aulas mínimas.
- [x] Upload de aulas em vídeo via painel admin/universidade com edge `vimeo-upload-init` (TUS direto no Vimeo) e preenchimento automático de `aulas.vimeo_id`.
- [x] Player de vídeo com Vimeo Player SDK via CDN — embed iframe + tracking `timeupdate` (debounce 5s) + `ended` → RPC `lms_marcar_aula`.
- [x] Emissão automática de certificado ao atingir 100% — trigger `fn_calcular_progresso_curso` chama `lms_gerar_certificado_interno`; PDF/HTML gerado on-demand pela edge `certificado-gerar`.
- [x] Integração Stripe Subscription via edge `lms-assinar` (mode=subscription) + modo dev. Webhook `stripe-webhook` estendido para `customer.subscription.*` + `invoice.payment_*` + branch `proposito = 'lms_subscription'` no checkout.
- [x] Gating por assinatura no portal cliente (`/c/universidade`) com paywall + ciclo mensal/anual; RLS de `aulas` respeita `app_has_lms_subscription()`, `curso.gratuito` e `aula.gratuita` (preview).
- [x] Smoke test transacional (`supabase/smoke-tests/fase-8-smoke.sql`): publica curso → inscreve → conclui aulas → valida certificado emitido.
- [ ] ⚠️ Stripe LMS em modo dev — substituir `STRIPE_PRICE_ID_LMS_MONTHLY` / `STRIPE_PRICE_ID_LMS_ANNUAL` quando ambiente real for habilitado.
- [ ] ⚠️ Vimeo em produção depende de `VIMEO_ACCESS_TOKEN` + `VIMEO_EMBED_DOMAINS` configurados no Supabase secrets.

**Saída**: LMS operacional com cursos gratuitos, premium por assinatura, progresso automático e certificados emitidos. ✅ **Fase 8 fechada em 2026-05-18 (Stripe dev / Vimeo).**

---

## Fase 9 — Gestão de Parceiros (Admin) & Onboarding por Convite

> Documentação completa em [docs/handoffs/14-handoff-fase9.md](./handoffs/14-handoff-fase9.md).

- [x] Migrations `20260518000042_admin_partner_management.sql`, `20260519000001_aprovacoes_view_enriched.sql`, `20260519000002_fix_usuarios_partner_id_refs.sql` aplicadas em `bhagksfvszeogtjvjtpx`.
- [x] View `v_admin_partners` (KPIs por parceiro: saldo, docs, equipes, propostas, volume) + view `v_admin_partner_invites` + view enriquecida `v_admin_partner_aprovacoes` (origem `convite`/`auto_cadastro` + contexto).
- [x] RPCs `admin_suspend_partner`, `admin_reactivate_partner`, `admin_invite_partner_record`, `admin_revoke_partner_invite`.
- [x] Tabela `partner_invites` para auditoria de convites (status `sent/accepted/revoked/expired`).
- [x] Edge `admin-invite-partner` com fallback resiliente: `inviteUserByEmail` → `magiclink` (usuário existente) → `createUser`+`generateLink` (rate-limit/SMTP), sempre retornando `action_link` ao admin.
- [x] Tela `/admin/parceiros` real (busca, filtros, KPIs, painel lateral, suspender/reativar, convidar, listar convites com revogação).
- [x] Tela `/admin/aprovacoes` com deep-link `?partner_id=`, contexto do convite e fluxo aprovação mesmo sem docs.
- [x] Onboarding do convidado: `/auth/partner-bootstrap` (consome magic-link, define senha, refresh JWT) + `/acesso-pendente` (etapa 2: upload de documentos para análise + reenvio em caso de rejeição).
- [x] Bugfix crítico: helper `app_partner_user_ids()` corrigindo 5 funções de notificação que liam `usuarios.partner_id`/`usuarios.deleted_at` (colunas inexistentes) — destravou `admin_suspend_partner` e gatilhos de wallet/contrato.
- [x] Seed `supabase/seeds/test-fluxo-completo.sql` (idempotente) para popular ambiente E2E.

**Saída**: ciclo completo de vida do parceiro pelo admin — convite → ativação → docs → aprovação → suspensão/reativação — com auditoria. ✅ **Fase 9 fechada em 2026-05-19.**

---

## Fase 10 — Equipes (Admin) & Métricas de Funil de Parceiros

> Detalhamento técnico em [docs/handoffs/15-handoff-fase10.md](./handoffs/15-handoff-fase10.md).
> Conflito resolvido (2026-07-08): o escopo original era **web-only**, mas o handoff mais recente registra extensão pós-fase com criação de proposta ativa no mobile (`admin`, `partner`, `team_member`). O restante do mobile segue majoritariamente em mock e permanece na Fase 11.

- [x] UI admin de **equipes do parceiro** (`/admin/parceiros/:partnerId/equipes`) consumindo `equipes` + `v_equipe_membros_detalhe` + `v_equipe_convites_pendentes` (tudo já criado na Fase 4).
- [x] RPCs admin para revogar convite pendente de membro e suspender membro ativo.
- [x] View `v_admin_funil_parceiros` (convidado → ativou → enviou docs → aprovado → 1ª proposta → 1ª comissão paga).
- [x] Card de funil no `/admin` (dashboard global) com taxa de conversão por etapa.
- [x] Tabela `email_bounces_inbox` + Edge `email-bounce-webhook` (verify_jwt=false, HMAC) marcando `partner_invites.status='expired'` automaticamente — pronta para SMTP customizado (SendGrid/Postmark) sem dependência.
- [x] Smoke test E2E `supabase/smoke-tests/fase-10-funil.sql`.
- [x] Extensão pós-handoff (2026-07-07): criação de proposta ativada no mobile em `mobile/app/propostas/nova.tsx` e `mobile/app/(admin)/propostas-nova.tsx`, mantendo a regra de parceiro `approved`.

**Saída**: admin enxerga e age sobre equipes dos parceiros, tem visão de funil real do programa, e o ciclo de convites se auto-limpa quando o e-mail rejeitar.

---

## Fase 11 — Mobile (replicar web no Expo)

- [ ] Instalar `@supabase/supabase-js` + `expo-secure-store` em `mobile/` (estado atual: criação de proposta ativa; demais fluxos ainda em mock).
- [ ] Cliente Supabase com `SecureStore` para tokens + `AuthContext` espelhando o web.
- [ ] Login real + deep-link `mercurio://magic/partner-bootstrap` (replicar `/auth/partner-bootstrap`).
- [ ] Tela `(parceiro)/pendente.tsx` com `PartnerDocsUploader` (expo-document-picker + storage `partner-docs`).
- [ ] Substituir mocks em `(admin)/aprovacoes.tsx`, `(admin)/parceiros.tsx` e `(parceiro)/dashboard.tsx` pelas views/RPCs já existentes.

**Saída**: parceiro convidado faz onboarding completo pelo mobile; admin opera fluxo principal pelo celular.

---

## Fase 12 — Fluxos Evolution & Campanhas (M10)

- [x] Editor visual de fluxos (React Flow / `@xyflow/react`) com nodes Trigger + Action e persistência de layout.
- [x] `fluxos_evolution`, `fluxo_execucoes` + RPCs `admin_fluxo_upsert/_delete/_executar`.
- [x] Catálogo de `templates_mensagem` + UI `/admin/templates`.
- [x] `campanhas` com agendamento + `admin_campanha_disparar/_cancelar` (públicos por roles/partners).
- [x] `email_outbox` + edge function `email-dispatcher` (SMTP via denomailer, RPCs `email_outbox_pull/_marcar`).
- [ ] Push web (FCM) e push mobile (Expo Notifications) _(deferido — depende do setup mobile da Fase 11)_.

**Saída**: comunicação automatizada (in-app + e-mail) e campanhas pelo admin com fila SMTP processada por worker.

---

## Fase 13 — Analytics, React Flow & Polimento

- [x] `/admin/rede` com React Flow (network map admin → parceiros → equipes via `admin_rede_graph`).
- [x] Views materializadas (`mv_admin_partners_metrics`, `mv_admin_funil_global`) + RPC `admin_refresh_mvs`.
- [x] Performance: code splitting nas rotas admin (`React.lazy` + `<Suspense>`).
- [x] Feature flags em produção: tabela já existia, RPCs `admin_feature_flag_upsert/_delete`, UI `/admin/feature-flags` e hook `useFeatureFlag`.
- [x] Tour onboarding (parceiro) — `PartnerOnboardingTour` no dashboard com localStorage.
- [x] Acessibilidade — skip-links em todos os layouts + `aria-label` em `<main>` + foco visível.

---

## Fase 14 — Hardening & LGPD

- [x] Pen test interno (OWASP) — checklist em `docs/operacao/security-checklist.md`.
- [x] Política LGPD: `lgpd_export_meus_dados` + `lgpd_anonimizar_conta` + view auditoria.
- [x] Mascaramento de PII em logs — helpers `mask_email/mask_cpf/mask_cnpj/mask_phone`.
- [x] Documentação operacional — `docs/operacao/runbooks.md`.
- [x] Plano de DR (PITR + drill semestral) — `docs/operacao/dr-plan.md`.

---

## Estado de release (2026-07-08)

- Desktop (Electron): governança de release macOS em hard-fail (assinatura + notarização de app e DMG) consolidada em operação.
- Mobile (Expo): release iOS `0.0.2` operacional via EAS (build concluída) com envio para TestFlight realizado via Apple Transporter.
- Windows: plano de assinatura de binários (EV/SmartScreen) permanece como pendência futura e não foi entregue neste ciclo.

---

## Backlog para fases futuras

- App mobile (PWA → React Native).
- IA assistente (resumo de docs, sugestão de status, detecção de risco).
- Marketplace de parceiros + ranking público.
- White-label para grupos parceiros.
- Open Banking / PIX integrado.
