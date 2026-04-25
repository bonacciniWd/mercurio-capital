# 09 — Roadmap de Entregas (Fases)

> Objetivo: sequenciar entregas de valor priorizando o caminho crítico **originação → contrato**. Sem estimativas de tempo — o foco é ordem de dependência.

## Fase 0 — Fundações

- [ ] Setup Supabase (projetos: local, staging, prod).
- [ ] Setup repositório front (Vite + TS + Tailwind + shadcn + React Router + TanStack Query).
- [ ] CI: lint, typecheck, testes, build.
- [ ] Supabase CLI + esqueleto de migrações.
- [ ] Edge Functions skeleton (deno).
- [ ] Sentry + PostHog conectados.
- [ ] Esquema visual (Storybook ou Ladle) com tokens.

**Saída**: ambiente reproduzível, deploy contínuo para staging.

---

## Fase 1 — Identidade & Onboarding (M1, M2)

- [ ] Migrações: `usuarios`, `partners`, `partner_documentos`, `magic_links`, `sessoes_2fa`, `audit_log`.
- [ ] RLS base + helpers `auth.is_admin()`, `auth.partner_id()`.
- [ ] Telas: `/registro`, `/login`, `/recuperar-senha`, `/2fa`, `/magic/:token`.
- [ ] Modal de upload de documentos do parceiro.
- [ ] Tela `/admin/parceiros/aprovacoes`.
- [ ] Edge `magic-link/issue` + `magic-link/consume`.
- [ ] Edge `evolution-whatsapp` (envio simples).

**Saída**: parceiro consegue se registrar, anexar docs e ser aprovado pelo admin.

---

## Fase 2 — Originação Mínima (M3 núcleo)

- [ ] Migrações: `simulacoes`, `propostas`, `proponentes`, `imoveis`, `imovel_proprietarios`, `proposta_status_historico`, `proposta_pendencias`, `proposta_documentos`.
- [ ] RLS de todas + triggers de transição de status.
- [ ] Wizard `/p/propostas/nova` (7 etapas).
- [ ] Lista `/p/propostas` com filtros e busca.
- [ ] Detalhe `/p/propostas/:id` com tabs (Resumo, Proponentes, Imóveis, Documentos, Histórico).
- [ ] Geração de protocolo + magic link cliente.
- [ ] Portal cliente: `/c`, `/c/propostas`, `/c/propostas/:id`, upload de documentos.
- [ ] Calculadora Price (componente reutilizável + testes unitários).

**Saída**: parceiro cria proposta, cliente recebe magic link, vê status e envia documentos.

---

## Fase 3 — Esteira & Admin Operacional (M3 avançado, M8)

- [ ] Kanban global e por proposta (dnd-kit + Realtime).
- [ ] Tela admin de propostas e detalhe.
- [ ] Pendências e ciclo de resolução.
- [ ] Consulta pública por protocolo (M7) com CAPTCHA + rate-limit.
- [ ] Upload via protocolo (signed URLs).
- [ ] OCR pipeline (M11 parcial).
- [ ] Notificações in-app (Realtime) + bandeja.

**Saída**: esteira funcional ponta a ponta até "Proposta ao Cliente".

---

## Fase 4 — Equipe, Dashboards & Relatórios (M4, M5)

- [ ] Migrações `equipes`, `equipe_membros`.
- [ ] Convites por magic link.
- [ ] Dashboard parceiro (Tremor): KPIs, funil, gargalos.
- [ ] Filtros por responsável, equipe, produto, data.
- [ ] Exportação xlsx (edge `relatorios/exportar`).
- [ ] Dashboard admin global.

**Saída**: parceiros gerenciam equipes e enxergam métricas; admin tem visão macro.

---

## Fase 5 — Carteira do Parceiro (M11) — pré-requisito para consultas pagas

- [ ] Migrações `partner_wallets`, `wallet_ledger`, `precos_consulta`, `wallet_topups`, `stripe_payment_intents`, `stripe_webhooks_inbox`.
- [ ] Funções `wallet_debit` / `wallet_credit` (SECURITY DEFINER, transação SERIALIZABLE).
- [ ] Trigger de criação automática da carteira ao inserir parceiro.
- [ ] Edge `wallet/topup`, `wallet/balance`, `wallet/extrato`, `stripe/webhook`, `wallet/ajuste`.
- [ ] Telas parceiro: `/p/carteira`, `/p/carteira/recarga` (Stripe Elements), `/p/carteira/extrato`.
- [ ] Telas admin: `/admin/financeiro/carteiras`, `/admin/financeiro/precos`, `/admin/financeiro/recargas`.
- [ ] Notificações: saldo baixo, recarga concluída, bloqueio.
- [ ] Seed de `precos_consulta` para todos os `tipo_consulta`.

**Saída**: parceiro recarrega via Stripe; saldo + extrato funcionando; preços versionados; pronto para alimentar a Fase 6.

---

## Fase 6 — Integrações Externas Pagas (M12)

- [ ] Edge `bacen-consulta`, `serasa-consulta`, `juridico-consulta`, `ri-digital-matricula`, `nacional-consultas`.
- [ ] **Cada Edge debita carteira via `wallet_debit` antes da chamada externa**; estorno automático em falha.
- [ ] HTTP 402 padronizado quando saldo insuficiente.
- [ ] Telas de "Consultas" no detalhe da proposta com botão "Consultar (R$ X,XX)".
- [ ] Logs em `logs_consultas` + tabelas específicas com `ledger_id`.
- [ ] Webhook Jusbrasil (monitoramento).

**Saída**: proposta consulta bureaus debitando saldo do parceiro automaticamente.

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
