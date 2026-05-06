# 06 — Módulos & Funcionalidades

Cada módulo descreve **objetivo, telas, regras, dependências, integrações e critérios de aceite (DoD)**. Use como base para criar épicos/issues.

---

## M1 — Autenticação & Onboarding

**Objetivo**: cobrir login, registro de parceiro, ativação de cliente/membro via magic link, recuperação de senha e 2FA.

### Telas
- `/login`, `/registro`, `/registro/sucesso`, `/recuperar-senha`, `/recuperar-senha/confirmar`, `/magic/:token`, `/2fa`.
- Modal de upload de documentos pós-registro do parceiro (autenticado).

### Regras
- Parceiro: criação imediata de conta com `partners.status='pending'`. Pode autenticar e fazer upload, mas **não** acessa rotas operacionais (`/p/*`) até aprovação.
- Cliente: nunca se auto-registra. Magic link cria a conta na primeira utilização e redireciona para `/c`.
- Membro de equipe: convite via magic link disparado pelo parceiro.
- 2FA TOTP obrigatório para `admin` e `partner` aprovado.
- Senha: regex de 10+ chars, 1 maiúscula, 1 número, 1 símbolo.
- Rate-limit 5 tentativas/15 min por IP no login.

### Dependências
- Tabelas: `usuarios`, `partners`, `partner_documentos`, `magic_links`, `sessoes_2fa`.
- Edge: `magic-link/issue`, `magic-link/consume`.

### DoD
- [ ] Fluxo completo testado E2E.
- [ ] Tokens armazenados como hash.
- [ ] Expiração ≤ 30 min, single-use.
- [ ] Auditoria registrada em `audit_log`.

---

## M2 — Cadastro & Aprovação de Parceiro

**Objetivo**: cadastro completo do parceiro, upload de documentação, aprovação manual pelo admin.

### Telas
- `/registro` (etapa mínima: nome, e-mail, telefone, senha).
- Modal "Completar cadastro": CPF, endereço (CEP autopreenchido), dados bancários, documentos (contrato social, RG, comp. residência, certidão estado civil).
- `/admin/parceiros/aprovacoes` com filtros, modal de revisão documento a documento, ações aprovar/rejeitar com motivo.

### Regras
- Documentos vão para bucket privado `partner-docs` via `signedUrl` de upload.
- Trigger envia notificação WhatsApp ao parceiro em mudança de status.
- Admin pode pedir reenvio de documentos individualmente (`partner_documentos.validado=false` + motivo).

### DoD
- [ ] Bucket privado, com policy permitindo só dono+admin.
- [ ] Aprovação dispara fluxo Evolution.
- [ ] Histórico em `audit_log`.

---

## M3 — Simulação & Proposta

**Objetivo**: criar simulação, converter em proposta, gerenciar proponentes, imóveis, documentos, pendências.

### Telas / Tabs
- `/p/simulacoes`, `/p/simulacoes/nova`.
- `/p/propostas`, `/p/propostas/nova` (Wizard 7 passos — ver §05 mapa visual).
- `/p/propostas/:id` com tabs: **Resumo · Proponentes · Imóveis · Documentos · Histórico · Kanban**.
- Modal "Calculadora Price" com tabela completa de parcelas.

### Regras
- Simulação não dispara magic link. Proposta criada **gera protocolo único** e magic link para o cliente.
- Proponente principal: 1 obrigatório. Se `estado_civil='casado'` → 2º proponente obrigatório (cônjuge).
- Imóvel: ≥ 1 obrigatório; toggle "usar endereço do proponente principal"; busca CEP via ViaCEP/Edge.
- Validação BRL, CPF/CNPJ, telefone com DDI.
- Cálculo Price (mensal): $PMT = PV \cdot \dfrac{i(1+i)^n}{(1+i)^n - 1}$.
- Range prazo: **12–240** meses (na simulação principal) e **36–240** na aba "Propostas → Simular" (condicional).
- Carência: 0–3 meses.
- Taxa default: `1,39% + IPCA` (configurável em `configuracoes_sistema`).

### Documentos
- Categorias: PF, PJ, Imóvel.
- OCR opcional (Tesseract.js) com texto persistido em `proposta_documentos.ocr_texto`.
- Solicitação de documento ao cliente cria `proposta_pendencia` e dispara WhatsApp.

### DoD
- [ ] Criação de proposta gera protocolo único e magic link.
- [ ] Cálculo Price unitariamente testado.
- [ ] Triggers de status + auditoria.
- [ ] Kanban arrasta cartão respeitando matriz de transições.

---

## M4 — Dashboard & Relatórios (Parceiro)

### Telas
- `/p/dashboard`: KPIs (taxa de conversão, ticket médio, contratos assinados), funil (simulações → propostas → pré → crédito → comitê → contratos), gargalos por etapa, evolução temporal.
- Filtros: produto, equipe, responsável, data, status.
- `/p/relatorios`: exportação xlsx.

### Regras
- Escopo: apenas propostas onde `partner_id = current_partner` (ou equipe).
- Cache de 5 min para queries pesadas (TanStack Query + revalidate).

---

## M5 — Equipe (Parceiro)

### Telas
- `/p/equipe`, `/p/equipe/convidar`, `/p/equipe/:memberId`.

### Regras
- Convite via e-mail + WhatsApp (Evolution).
- Papéis na equipe: `admin_equipe`, `membro`.
- Permissões finas em `equipe_membros.permissoes` (jsonb).

---

## M6 — Portal do Cliente

### Telas
- `/c`, `/c/propostas`, `/c/propostas/:id`, `/c/propostas/:id/documentos`, `/c/perfil`, `/c/notificacoes`, `/c/universidade`.

### Regras
- Cliente vê **somente** propostas onde figura como `cliente_id` ou `proponentes.cliente_id`.
- Timeline visual baseada em `proposta_status_historico`.
- Upload de documentos solicitados (pendências).

---

## M7 — Consulta Pública por Protocolo

### Telas
- `/protocolo`, `/protocolo/:numero`.

### Regras
- CAPTCHA Cloudflare/Turnstile.
- Rate-limit 10 req/min por IP via Edge.
- Retorna apenas: status atual, etapa do funil, data da última atualização, pendências em aberto (descrição), botão de upload se houver pendência aceitando origem pública.
- Upload via `signedUrl` curta gerada pela edge `protocolo/upload-url`.
- Nenhum dado pessoal exposto.

---

## M8 — Admin: Gestão Macro

### Telas
- `/admin/dashboard`, `/admin/dashboard/funil`, `/admin/dashboard/gargalos`.
- `/admin/parceiros`, `/admin/parceiros/aprovacoes`, `/admin/parceiros/:id`.
- `/admin/clientes`, `/admin/clientes/:id`.
- `/admin/propostas`, `/admin/propostas/:id`, `/admin/propostas/kanban`.
- `/admin/rede` (React Flow): grafo Admin → Parceiros → Equipes → Membros → Leads → Propostas, com cores por status.
- `/admin/documentos`, `/admin/documentos/pendentes`.
- `/admin/financeiro`, `/admin/financeiro/contratos`.
- `/admin/relatorios`, `/admin/relatorios/exportar`.

### Regras
- Filtros: tipo de operação, valor de imóvel, valor pedido, originador, status, pendências.
- Disparo manual de notificações (WhatsApp/push) com templates aprovados.
- Edição de documentação central (substituir/anexar).

---

## M9 — Universidade Mercurio

### Telas (admin)
- `/admin/universidade/cursos`, `/admin/universidade/cursos/novo`, `/admin/universidade/cursos/:id`.
- Editor com módulos, capítulos, aulas (vídeo/texto/quiz), critérios de certificado.

### Telas (consumo)
- `/p/universidade`, `/p/universidade/curso/:slug`, `/p/universidade/certificados`.
- `/c/universidade` (cliente assinante).

### Regras
- Cursos `gratuito=true` visíveis a usuários autenticados básicos.
- Cursos `requer_assinatura=true` visíveis somente com `assinaturas_universidade.status='ativa'`.
- Player marca `aula_progresso.posicao_seg` a cada 15s.
- Emissão automática de certificado quando `progresso_pct >= criterios_certificado.progresso_min`.

---

## M10 — Fluxos Evolution & Notificações

### Telas
- `/admin/fluxos`, `/admin/fluxos/novo`, `/admin/fluxos/:id` (editor JSON visual).
- `/admin/campanhas`, `/admin/campanhas/nova`.

### Regras
- Fluxo modelado como JSON (gatilhos + passos + condicionais + templates).
- Persistido em `fluxos_evolution.definicao_json`, versionado.
- Execuções rastreadas em `fluxo_execucoes`.
- Templates referenciam variáveis: `{{cliente.nome}}`, `{{proposta.protocolo}}`, `{{status}}`.

### Push Notifications
- Web Push (FCM) + WhatsApp (Evolution) + e-mail.
- `push_devices` armazena tokens; revogação automática em 410.

---

## M11 — Carteira do Parceiro (Wallet & Billing)

**Objetivo**: dar ao parceiro um saldo pré-pago dentro do sistema, recarregável via Stripe, do qual são debitadas as consultas pagas a bureaus externos.

### Telas
- **Parceiro**: `/p/carteira`, `/p/carteira/recarga`, `/p/carteira/extrato`.
- **Admin**: `/admin/financeiro/carteiras`, `/admin/financeiro/carteiras/:partnerId`, `/admin/financeiro/precos`, `/admin/financeiro/recargas`.

### Regras
- Carteira criada automaticamente em `after insert on partners` (saldo zero, BRL).
- Recarga: parceiro escolhe valor (ex.: R$ 50, 100, 250, 500, custom mín R$ 20). Frontend chama `wallet/topup` que cria `PaymentIntent` no Stripe. Pagamento confirmado pelo webhook → função `wallet_credit` insere `recarga` no ledger.
- Débito: toda Edge de consulta paga executa `wallet_debit` em transação `SERIALIZABLE`. Se `saldo < preco`, retorna **HTTP 402** e a UI orienta para `/p/carteira/recarga`.
- Estorno automático: se a chamada externa falhar (timeout/5xx/HTTP de negação), Edge insere entrada `estorno` com mesmo `correlation_id`.
- Preços vivem em `precos_consulta`, versionados (`vigente_de`, `vigente_ate`). Apenas admin altera.
- Limite diário opcional por parceiro (`partner_wallets.limite_diario_centavos`); se excedido, bloqueia até a virada do dia (BRT).
- Bloqueio administrativo: `bloqueada=true` impede qualquer débito/recarga; motivo obrigatório.
- Extrato exportável em CSV/XLSX (edge `relatorios/exportar`).
- Assistente (`team_member`): leitura do extrato; **nunca** dispara consulta paga sem aprovação do parceiro (toggle por equipe).

### Notificações
- Saldo abaixo de limite configurável (default: R$ 20) → push + WhatsApp para parceiro.
- Recarga concluída → push + e-mail.
- Bloqueio/desbloqueio → push + WhatsApp.

### Dependências
- Tabelas: `partner_wallets`, `wallet_ledger`, `precos_consulta`, `wallet_topups`, `stripe_payment_intents`, `stripe_webhooks_inbox`.
- Edge: `wallet/topup`, `wallet/balance`, `wallet/extrato`, `wallet/ajuste`, `stripe/webhook`, `precos-consulta/list`.
- Integração: **Stripe** (PaymentIntents, Webhooks).

### DoD
- [ ] Recarga ponta a ponta com webhook idempotente (`stripe_webhooks_inbox`).
- [ ] Função `wallet_debit` testada para concorrência (sem saldo negativo).
- [ ] Estorno automático em falha externa.
- [ ] RLS: parceiro vê apenas sua carteira; admin vê todas.
- [ ] `wallet_ledger` imutável (revoke update/delete).
- [ ] Auditoria de ajustes manuais.
- [ ] HTTP 402 documentado com payload `{erro:'saldo_insuficiente', preco, saldo}`.

---

## M12 — Integrações Externas

| Integração | Caso de uso | Edge function | Tabela log |
|---|---|---|---|
| Evolution API (WhatsApp) | Magic links, status, pendências, campanhas | `evolution-whatsapp` | `whatsapp_mensagens` |
| Bacen | Consulta CPF/CNPJ no cadastro do cliente | `bacen-consulta` | `consultas_bacen` |
| SPC/Serasa | Score crédito | `serasa-consulta` | `consultas_serasa` |
| Jusbrasil / Escavador | Processos judiciais | `juridico-consulta` | `consultas_juridicas` |
| RI Digital | Matrícula imóvel | `ri-digital-matricula` | `ri_digital_matriculas` |
| Nacional Consultas | Bens, certidões | `nacional-consultas` | `logs_consultas` |
| ViaCEP | Endereço por CEP | `cep/lookup` | — |
| **Clicksign** | Assinatura eletrônica | `contratos/assinatura/webhook` | `assinaturas_contrato` |
| **Stripe** | Recargas de carteira + assinatura LMS | `wallet/topup`, `stripe/webhook` | `wallet_topups`, `assinaturas_universidade` |
| **Vimeo** | Hospedagem de vídeos da Universidade | `vimeo/upload-url`, `vimeo/embed-token` | — |
| **FCM** | Push web/app | `notifications/push` | `push_devices` |

### Regras
- Todas as chaves de API ficam **somente** em variáveis de ambiente das Edge Functions.
- Logs persistidos em `logs_consultas` com `request/response` mascarados (sem PII completa quando possível).
- **Toda consulta paga consulta `precos_consulta` e debita a carteira do parceiro via `wallet_debit` antes de chamar a API externa** (ver M11).
- Cota diária opcional por parceiro em `partner_wallets.limite_diario_centavos`.

---

## M13 — Auditoria, Configurações & Feature Flags

### Telas
- `/admin/auditoria`: filtro por entidade, usuário, intervalo, ação.
- `/admin/configuracoes`: parâmetros gerais (taxa default, prazo, indexador).
- `/admin/configuracoes/permissoes`: edição de matriz por papel.
- `/admin/configuracoes/feature-flags`: ativação por role/percentual.
- `/admin/integracoes`: chaves e status de cada integração (sem expor segredos).

### Regras
- Toda alteração em `configuracoes_sistema` registra em `audit_log`.
- Feature flags consumidas no client via hook `useFlag('chave')`.

---

## M14 — Programa de Milestones (Parceiro)

**Objetivo**: engajar parceiros com um programa de prêmios progressivos vinculado ao volume de crédito CGI liberado (em centavos). Exibe o progresso individual e os prêmios já conquistados ou em andamento.

### Tela
- `/p/milestones` → `PartnerMilestones` (componente em `src/pages/partner/Milestones.tsx`).

### Estrutura visual

1. **Header** — título da página e subtexto descritivo.
2. **Hero card** — card escuro (`#07101e → #0d1c32`) com:
   - Total liberado em CGI (em BRL).
   - Contador de contratos fechados e data de atualização.
   - **Barra de progresso geral** com efeito de expansão animática ao montar (`0 → N%`, `transition: width 1.4s cubic-bezier(0.22,1,0.36,1)`) em vermelho pulsante (`#ef4444`, `animation: bar-pulse 1.8s ease-in-out infinite`).
   - Ticks verticais marcando as posições reais das metas (ex: R$ 5M = 5%, R$ 50M = 50% do range de 100M).
   - Labels de escala (`R$ 0`, `R$ 5M`, `R$ 50M`, `R$ 100M`) com `position: absolute` alinhadas às posições reais.
3. **Cards de prêmios** — grid 3 colunas (`md:grid-cols-3`), um por milestone:
   - **Borda elétrica** via canvas `useElectricCanvas` (fBm noise sobre perímetro de rect arredondado). Canvas posicionado fora do `overflow-hidden` com `top/left: -OFFSET`, dimensões sincronizadas por `ResizeObserver`.
   - Estado **Conquistado**: `displacement=42`, `speed=2.2`, `lineWidth=2`, glow radial no topo + `drop-shadow` colorido na imagem.
   - Estado **Bloqueado**: `displacement=22`, `speed=0.8`, `lineWidth=1`, imagem em `grayscale(1) opacity(0.3)`.
   - **Imagem do prêmio**: SVG 300×250 em `src/assets/milestones/` (`rolex.svg`, `bmw.svg`, `corvette.svg`), carregados via `new URL(..., import.meta.url).href`.
   - **Barra de progresso individual** com cor e glow na cor do milestone.
4. **Rodapé** — nota sobre validação e link para regulamento.

### Milestones configurados (mock)

| Meta CGI (centavos) | Label | Prêmio | Cor |
|---|---|---|---|
| 500.000.000 | R$ 5 Milhões | Rolex Submariner | `#D4AF37` (ouro) |
| 5.000.000.000 | R$ 50 Milhões | BMW 330e M Sport | `#60a5fa` (azul) |
| 10.000.000.000 | R$ 100 Milhões | Corvette C8 | `#f87171` (vermelho) |

> `CURRENT_CGI` é atualmente um valor mock (`1_250_000_000 = R$ 12.500.000`). Em produção deverá vir de query em `propostas` somando `valor_credito` dos contratos liberados do parceiro autenticado.

### Hook reutilizável
- `useElectricCanvas(opts)` — em `src/hooks/useElectricCanvas.ts`. Aceita: `color`, `speed`, `displacement`, `borderRadius`, `offset`, `lineWidth`. Retorna `canvasRef`.

### Assets
- `src/assets/milestones/rolex.svg` — Rolex Submariner ilustrado (fundo escuro, ouro).
- `src/assets/milestones/bmw.svg` — BMW 330e ilustrado (azul escuro, rodas com raios).
- `src/assets/milestones/corvette.svg` — Corvette C8 ilustrado (vermelho escuro, perfil fastback).

### Acesso via sidebar
- `PartnerLayout` exibe `ElectricBannerCard` (carrossel 5s com crossfade) linkando para `/p/milestones`. Banners em `src/assets/promotions/`.

### Regras de negócio
- Progresso geral calculado como `(CURRENT_CGI / 10_000_000_000) * 100`, limitado a 100%.
- Progresso individual: `(CURRENT_CGI / m.target) * 100`, limitado a 100%.
- `unlocked = CURRENT_CGI >= m.target`.
- Prêmios entregues após validação manual pela equipe Mercurio Capital.

### DoD
- [ ] `CURRENT_CGI` substituir por query real no Supabase (`sum(valor_credito) where status='liberado' and partner_id=auth.uid()`).
- [ ] Milestones migrar para tabela `milestone_config` (editável pelo admin).
- [ ] Registro de entrega em tabela `milestone_entregas` (parceiro, milestone, data, admin responsável).
- [ ] Notificação WhatsApp ao conquistar novo milestone.
