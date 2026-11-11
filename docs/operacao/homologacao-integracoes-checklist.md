# Checklist de homologação — ativação de integrações reais (Frente B)

**Data:** 2026-11-11 · **Escopo:** preparação e homologação, sem código novo · **Projeto Supabase:** `bhagksfvszeogtjvjtpx`

Legenda de responsabilidade: **[DONO]** = ação do dono do produto (credenciais, contratos, painéis externos) · **[TIME]** = time técnico.

## Regras globais (valem para todos os provedores)

- Segredos somente via `supabase secrets set ... --project-ref bhagksfvszeogtjvjtpx`, com entrada silenciosa (`read -s`), nunca em Git, chat, `.env` de app/mobile ou valores impressos em log. Conferência apenas por nome: `supabase secrets list`. [TIME executa, DONO fornece valor em canal seguro]
- Após `secrets set`, a edge passa a usar o provedor real **sem redeploy**. [TIME]
- Todo provedor segue a sequência: **secrets → desligar modo dev/mock → teste E2E controlado → reconciliação de webhook (quando houver) → smoke/verificação → critério de ativo.**
- Nenhuma ativação autoriza por si só tag, deploy de frontend, GitHub Release ou publicação — gate separado conforme `change-management.md`.
- Referência de estado: `docs/operacao/integracoes-pendentes.md` (prevalece sobre docs mais antigos).

---

## 1) Stripe — Carteira (top-up) — prioridade 1

> No iOS, recarga/assinatura ficam ocultas por regra de In-App Purchase da Apple — **o web é o canal de receita**. Guia base existente: `docs/operacao/stripe-setup.md`.

**O que o dono precisa obter [DONO]:**
- [ ] Conta Stripe verificada (KYB completo, conta bancária BR); PIX e cartão ativos em **Live**.
- [ ] `STRIPE_SECRET_KEY` live (`sk_live_...`).
- [ ] `STRIPE_WEBHOOK_SECRET` (`whsec_...`) do endpoint de produção.

**Ativação [TIME]:**
- [ ] `secrets set` de `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, `STRIPE_ALLOW_DEV_MODE=false`.
- [ ] Webhook live em `https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/stripe-webhook` com eventos `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` (validar assinatura HMAC; idempotência em `stripe_webhooks_inbox`).
- [ ] Teste E2E em produção com valor real pequeno (ex.: R$ 20 em conta interna) → reembolso via Dashboard.
- [ ] Reconciliação: `wallet_topups.status='succeeded'` + `wallet_ledger` tipo `recarga` + saldo incrementado + notificação `carteira_recarga_concluida` + `event.id` único na inbox.
- [ ] Monitorar logs da edge e `stripe_webhooks_inbox` nas primeiras 24h.

**Critério "ativo em produção":** recarga real E2E com crédito automático de saldo e webhook reconciliado; `STRIPE_ALLOW_DEV_MODE=false` confirmado; sem erros de assinatura em 24h.

## 2) Stripe — Universidade (assinatura LMS) — prioridade 2

**[DONO]:**
- [ ] Criar preços reais no Stripe e obter `STRIPE_PRICE_ID_LMS_MONTHLY` e `STRIPE_PRICE_ID_LMS_ANNUAL`.

**[TIME]:**
- [ ] `secrets set` dos dois Price IDs (reusa `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` do item 1).
- [ ] Webhook cobrindo `customer.subscription.*` e `invoice.payment_*` (branch `proposito='lms_subscription'` já existe).
- [ ] Teste E2E: assinatura mensal em `/c/universidade` → paywall abre após webhook; cancelamento em ambiente controlado.
- [ ] Verificar gating RLS (`app_has_lms_subscription()`) em curso premium.

**Critério "ativo":** assinatura real ativa o acesso premium via webhook, sem intervenção manual; cancelamento remove acesso no ciclo seguinte.

## 3) Clicksign — assinatura de contratos

**[DONO]:**
- [ ] Token de produção `CLICKSIGN_API_TOKEN` e segredo de webhook `CLICKSIGN_WEBHOOK_SECRET`.

**[TIME]:**
- [ ] `secrets set`: `CLICKSIGN_API_TOKEN`, `CLICKSIGN_API_URL=https://app.clicksign.com`, `CLICKSIGN_WEBHOOK_SECRET`, `CLICKSIGN_ALLOW_DEV_MODE=false`, `CLICKSIGN_REQUIRE_SIGNED_WEBHOOK=true`.
- [ ] Apontar webhook do Clicksign para `.../functions/v1/clicksign-webhook`; validar HMAC e idempotência (`clicksign_webhooks_inbox`).
- [ ] Teste E2E com proposta sintética: gerar contrato → enviar → assinar com signatário interno → transições `emissao_contrato → aguardando_assinatura → em_registro → contrato_registrado → recurso_liberado`.

**Critério "ativo":** envelope real assinado move a proposta até `recurso_liberado` sem passo manual; webhook assinado reconciliado.

## 4) Invertexto — validação CPF/CNPJ e autofill

**[DONO]:**
- [ ] Token da conta Invertexto.

**[TIME]:**
- [ ] `secrets set INVERTEXTO_TOKEN=...`.
- [ ] Teste: botão "Validar" no Wizard (`/p/propostas/nova`) com CPF/CNPJ reais de teste; `cnpj-consultar` autofill.
- [ ] Confirmar que a falha segura `424 invertexto_nao_configurado` desaparece e que a validação local de dígitos segue como fallback.

**Critério "ativo":** validação e autofill retornando dados reais no wizard web e mobile.

## 5) Serasa — `consulta-executar` (`serasa_pf` / `serasa_pj`)

**[DONO]:**
- [ ] `SERASA_CLIENT_ID`/`SERASA_CLIENT_SECRET` (ou aliases `SERASA_LOGON`/`SERASA_SENHA`) de **produção**.
- [ ] Resolver com o suporte Serasa: produto PF homologado **não retornou score** — confirmar produtos/campos habilitados (pendência registrada em `2026-10-29-whatsapp-merx-inbound-pendencias.md`).

**[TIME]:**
- [ ] `secrets set` (padrão de entrada silenciosa já documentado em `integracoes-pendentes.md`); `SERASA_API_URL` de produção somente após homologar em UAT; `SERASA_ALLOW_MOCK=false`.
- [ ] Substituir branch mock por chamada real (PJ ainda pendente de implementação/validação específica).
- [ ] Teste E2E: consulta PF debitando carteira + estorno automático em falha simulada; cota diária admin (`serasa-admin-cota-diaria.md`) respeitada.
- [ ] Smoke de referência: `fase-46-serasa-integration.sql`, `fase-47-serasa-uat-integrado.sql`, `fase-50-serasa-admin-cota.sql`.

**Critério "ativo":** consulta PF (e PJ, quando implementada) em produção com débito/estorno corretos e relatório exibido na proposta; pendência de score encerrada com o suporte.

## 6) Bacen SCR — via provedor homologado

**[DONO]:**
- [ ] Contrato com agregador homologado: `BACEN_SCR_API_URL`, modo de auth (`oauth2` ou `bearer`) e credenciais correspondentes; schema de resposta do endpoint.

**[TIME]:**
- [ ] `secrets set` conforme modo (`BACEN_SCR_CLIENT_ID/SECRET` ou `BACEN_SCR_API_TOKEN`); `BACEN_ALLOW_MOCK=false`.
- [ ] Teste E2E: `bacen_cpf`/`bacen_cnpj` com documento resolvido server-side; estorno em falha; sem credenciais → `bacen_nao_configurado` (comportamento seguro já implementado).

**Critério "ativo":** resposta SCR real reconciliada na proposta com débito correto e zero mock em produção.

## 7) Vimeo — Universidade (vídeos)

**[DONO]:**
- [ ] Conclusão do review de **Upload Access** no Vimeo (em andamento — gate externo).
- [ ] `VIMEO_ACCESS_TOKEN` com escopo de upload.

**[TIME]:**
- [ ] `secrets set`: `VIMEO_ACCESS_TOKEN` e `VIMEO_EMBED_DOMAINS` (domínios canônicos já listados em `integracoes-pendentes.md`).
- [ ] Health em `/admin/integracoes` (cria upload TUS de 1 MB e remove); upload real de aula no CMS admin; player com tracking em curso de teste.

**Critério "ativo":** upload admin → `aulas.vimeo_id` preenchido → reprodução com progresso registrado no portal do cliente.

## 8) Jusbrasil / Escavador / RI Digital (ARISP) / Nacional Consultas — `consulta-executar`

**[DONO] (por provedor):**
- [ ] Credenciais/contrato e documentação do endpoint (cliente já providenciando, conforme `integracoes-pendentes.md`).

**[TIME] (por provedor):**
- [ ] `secrets set` do provedor (nomes a confirmar quando o contrato chegar — registrar divergências no plano da mudança).
- [ ] Trocar branch mock por chamada HTTP real (schema/billing/UI já funcionam end-to-end).
- [ ] Teste E2E por tipo (`jusbrasil_cnpj`, `escavador_cnpj`, `ri_digital_matricula`, `nacional_consultas_*`): débito correto, HTTP 402 em saldo insuficiente, estorno em 502, log em `logs_consultas` e `v_consultas_proposta`.

**Critério "ativo" (por provedor):** consulta real E2E com débito/estorno corretos e resultado visível na aba Consultas da proposta.

---

## Já ativo (sem ação)

- **Resend** (e-mail transacional): ativo; apenas rotação/manutenção de segredo quando necessário.
- **WhatsApp inbound**: recebimento validado em produção (06/11/2026). Envio/templates/atendimento seguem rollout próprio com flags desligadas — ver `whatsapp-automacoes-atendimento.md` (não faz parte deste checklist).

## Fronteira de release

Este checklist não autoriza deploy de frontend, tag ou release. Qualquer publicação segue `docs/operacao/release-checklist.md` com GO explícito do dono.
