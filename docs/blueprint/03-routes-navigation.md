# 03 — Rotas & Navegação por Perfil

> Convenção: rotas iniciadas com `/` são frontend (React Router). Endpoints de Edge Function ficam em `/functions/v1/...` (Supabase). Rotas autenticadas são protegidas por **route guards** que validam JWT + claim `role` + claim `approved`.

## 1. Layouts

- `PublicLayout` — header simples + footer (landing, login, registro, consulta protocolo).
- `AuthLayout` — fluxo de magic-link/2FA (sem nav).
- `MainLayout` — sidebar + topbar; usado por partner, team_member e client (variando itens).
- `AdminLayout` — sidebar interna Mercurio (somente admin).

## 2. Mapa global de rotas

### 2.1 Públicas (`PublicLayout`)

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `LandingPage` | Página institucional. |
| `/login` | `LoginPage` | E-mail+senha, link "esqueci senha", botão magic-link. |
| `/registro` | `RegisterPage` | Cadastro de parceiro (status pending). |
| `/registro/sucesso` | `RegisterSuccess` | Aviso de aprovação pendente. |
| `/recuperar-senha` | `ForgotPassword` | Solicita reset. |
| `/recuperar-senha/confirmar` | `ResetPassword` | Token via e-mail. |
| `/protocolo` | `ProtocoloLookup` | Form de consulta por protocolo + CAPTCHA. |
| `/protocolo/:numero` | `ProtocoloPublic` | Status público + slot de upload, se solicitado. |
| `/magic/:token` | `MagicLinkConsumer` | Consome magic link (cliente, parceiro, membro). |
| `/2fa` | `TwoFactorChallenge` | Challenge TOTP. |

### 2.2 Cliente (`MainLayout` — role `client`)

| Rota | Componente | Descrição |
|---|---|---|
| `/c` | `ClientHome` | Dashboard pessoal: propostas, próximos passos. |
| `/c/propostas` | `ClientPropostasList` | Lista das propostas do cliente. |
| `/c/propostas/:id` | `ClientPropostaDetail` | Linha do tempo, status, documentos. |
| `/c/propostas/:id/documentos` | `ClientDocuments` | Upload e listagem. |
| `/c/perfil` | `ClientProfile` | Dados cadastrais, telefone, e-mail, senha. |
| `/c/notificacoes` | `ClientNotifications` | Histórico de notificações. |
| `/c/universidade` | `ClientUniversidade` | Cursos disponíveis (gratuitos/assinatura). |

### 2.3 Parceiro & Assistente (`MainLayout` — `partner` / `team_member`)

| Rota | Componente | Permissões |
|---|---|---|
| `/p` | `PartnerHome` | partner, team_member |
| `/p/dashboard` | `PartnerDashboard` | partner, team_member (escopo equipe) |
| `/p/simulacoes` | `SimulacoesList` | partner, team_member |
| `/p/simulacoes/nova` | `SimulacaoForm` | partner, team_member |
| `/p/propostas` | `PropostasList` | partner, team_member |
| `/p/propostas/nova` | `PropostaWizard` | partner, team_member |
| `/p/propostas/:id` | `PropostaDetail` | partner, team_member |
| `/p/propostas/:id/proponentes` | `ProponentesTab` | partner, team_member |
| `/p/propostas/:id/imoveis` | `ImoveisTab` | partner, team_member |
| `/p/propostas/:id/documentos` | `DocumentosTab` | partner, team_member |
| `/p/propostas/:id/historico` | `HistoricoTab` | partner, team_member |
| `/p/propostas/:id/kanban` | `PropostaKanban` | partner, team_member |
| `/p/equipe` | `EquipePage` | partner |
| `/p/equipe/convidar` | `ConvidarMembro` | partner |
| `/p/equipe/:memberId` | `MembroDetail` | partner |
| `/p/relatorios` | `RelatoriosPartner` | partner |
| `/p/universidade` | `UniversidadeHome` | partner, team_member |
| `/p/universidade/curso/:slug` | `CursoPlayer` | partner, team_member |
| `/p/universidade/certificados` | `MeusCertificados` | partner, team_member |
| `/p/perfil` | `PartnerProfile` | partner, team_member |
| `/p/notificacoes` | `Notifications` | partner, team_member |
| `/p/configuracoes` | `PartnerSettings` | partner |
| `/p/carteira` | `CarteiraHome` | partner (leitura: team_member) |
| `/p/carteira/recarga` | `CarteiraRecarga` (Stripe Elements) | partner |
| `/p/carteira/extrato` | `CarteiraExtrato` | partner, team_member |
| `/p/milestones` | `PartnerMilestones` | partner |

### 2.4 Admin (`AdminLayout` — role `admin`)

| Rota | Componente |
|---|---|
| `/admin` | `AdminHome` |
| `/admin/dashboard` | `AdminDashboard` (KPIs globais) |
| `/admin/dashboard/funil` | `FunilGlobal` |
| `/admin/dashboard/gargalos` | `GargalosView` |
| `/admin/parceiros` | `ParceirosList` |
| `/admin/parceiros/aprovacoes` | `ParceirosAprovacoes` |
| `/admin/parceiros/:id` | `ParceiroDetail` |
| `/admin/clientes` | `ClientesList` |
| `/admin/clientes/:id` | `ClienteDetail` |
| `/admin/propostas` | `PropostasAdminList` |
| `/admin/propostas/nova` | `PropostaWizard` (modo admin, parceiro alvo obrigatório) |
| `/admin/propostas/:id` | `PropostaAdminDetail` |
| `/admin/propostas/kanban` | `PropostasKanbanGlobal` |
| `/admin/rede` | `ReactFlowRede` (network map) |
| `/admin/documentos` | `DocumentosCentral` |
| `/admin/documentos/pendentes` | `DocumentosPendentes` |
| `/admin/financeiro` | `FinanceiroDashboard` |
| `/admin/financeiro/contratos` | `ContratosList` |
| `/admin/financeiro/carteiras` | `CarteirasAdminList` |
| `/admin/financeiro/carteiras/:partnerId` | `CarteiraAdminDetail` (extrato + ajuste manual) |
| `/admin/financeiro/precos` | `PrecosConsultaAdmin` |
| `/admin/financeiro/recargas` | `RecargasStripeList` |
| `/admin/relatorios` | `RelatoriosAdmin` |
| `/admin/relatorios/exportar` | `ExportarRelatorios` |
| `/admin/universidade` | `UniversidadeAdmin` |
| `/admin/universidade/cursos` | `CursosAdmin` |
| `/admin/universidade/cursos/novo` | `CursoForm` |
| `/admin/universidade/cursos/:id` | `CursoEditor` (módulos, capítulos, vídeos, certificado) |
| `/admin/universidade/assinaturas` | `AssinaturasAdmin` |
| `/admin/fluxos` | `FluxosList` (Evolution flows) |
| `/admin/fluxos/novo` | `FluxoEditor` (JSON visual) |
| `/admin/fluxos/:id` | `FluxoEditor` |
| `/admin/campanhas` | `CampanhasList` |
| `/admin/campanhas/nova` | `CampanhaForm` |
| `/admin/integracoes` | `IntegracoesConfig` (Bacen, Serasa, Jusbrasil, RI Digital, Evolution) |
| `/admin/configuracoes` | `AdminSettings` |
| `/admin/configuracoes/permissoes` | `PermissoesPapeis` |
| `/admin/configuracoes/feature-flags` | `FeatureFlagsAdmin` |
| `/admin/auditoria` | `AuditLogViewer` |
| `/admin/usuarios` | `UsuariosAdmin` |

### 2.5 Mobile (Expo Router) — estado atual

| Arquivo de rota | Fluxo | Permissões |
|---|---|---|
| `mobile/app/propostas/nova.tsx` | Criação de proposta (wizard compartilhado) | partner, team_member, admin |
| `mobile/app/(admin)/propostas-nova.tsx` | Entrada admin para criação de proposta | admin |

Nota de implementação (branch atual): criação de proposta está ativa no web para `partner`/`team_member` em `/p/propostas/nova` e para `admin` em `/admin/propostas/nova`, com paridade funcional no mobile pelos arquivos acima.

## 3. Sidebar dinâmica (estrutura)

### Cliente
```
Início · Minhas Propostas · Documentos · Universidade · Notificações · Perfil
```

### Parceiro
```
Início · Dashboard · Simulações · Propostas · Equipe · Carteira ·
Universidade · Relatórios · Notificações · Configurações
```

### Assistente (team_member)
```
Início · Propostas · Simulações · Carteira (leitura) · Universidade · Notificações
```

### Admin
```
Dashboard · Parceiros · Clientes · Propostas · Rede · Documentos ·
Financeiro · Universidade · Fluxos · Campanhas · Integrações ·
Relatórios · Auditoria · Configurações
```

## 4. Endpoints de Edge Functions (Supabase)

| Endpoint | Método | Descrição | Auth |
|---|---|---|---|
| `/functions/v1/magic-link/issue` | POST | Gera magic link (cliente/parceiro/membro) | server-only (admin/partner) |
| `/functions/v1/magic-link/consume` | POST | Valida token e cria sessão | público |
| `/functions/v1/whatsapp/send` | POST | Envia mensagem via Evolution | server-only |
| `/functions/v1/whatsapp/webhook` | POST | Recebe eventos Evolution | webhook secret |
| `/functions/v1/bacen/cpf` | POST | Consulta CPF | partner+ |
| `/functions/v1/serasa/consultar` | POST | Crédito | partner+ |
| `/functions/v1/juridico/consultar` | POST | Jusbrasil/Escavador | admin |
| `/functions/v1/ri-digital/matricula` | POST | RI Digital | admin |
| `/functions/v1/cep/lookup` | GET | ViaCEP wrapper | autenticado |
| `/functions/v1/ocr/processar` | POST | OCR Tesseract pipeline | autenticado |
| `/functions/v1/protocolo/consulta` | POST | Consulta pública (rate-limit + CAPTCHA) | público |
| `/functions/v1/protocolo/upload-url` | POST | Gera signedUrl para upload via protocolo | público (com token de proposta) |
| `/functions/v1/notifications/push` | POST | Dispara push (web/app) | server-only |
| `/functions/v1/relatorios/exportar` | POST | Gera xlsx assinado | autenticado |
| `/functions/v1/contratos/gerar` | POST | Gera PDF do contrato | admin |
| `/functions/v1/contratos/assinatura/webhook` | POST | Webhook D4Sign/Clicksign | webhook secret |
| `/functions/v1/wallet/topup` | POST | Cria PaymentIntent Stripe para recarga | partner |
| `/functions/v1/wallet/balance` | GET | Saldo + última atualização | partner / team_member (read) / admin |
| `/functions/v1/wallet/extrato` | GET | Movimentações paginadas | mesmas regras |
| `/functions/v1/wallet/ajuste` | POST | Ajuste manual (crédito/débito) | admin |
| `/functions/v1/stripe/webhook` | POST | Webhook Stripe (recargas + assinaturas) | webhook secret |
| `/functions/v1/precos-consulta/list` | GET | Lista preços vigentes | autenticado |
| `/functions/v1/fluxos/executar` | POST | Executa fluxo JSON Evolution | admin (gatilho interno) |

## 5. Guards de rota (frontend)

```ts
// pseudo
<Route element={<RequireAuth />}>            // exige sessão
  <Route element={<RequireRole role="admin" />}> ... </Route>
  <Route element={<RequireRole role={["partner","team_member"]} />}> ... </Route>
  <Route element={<RequireRole role="client" />}> ... </Route>
  <Route element={<RequireApproved />}> ... </Route>   // partner com status approved
  <Route element={<Require2FA />}> ... </Route>        // admin/partner
  <Route element={<RequireSubscription />}> ... </Route> // cursos pagos
</Route>
```

## 6. Deep linking & Magic links

- Magic link **cliente**: `https://app.mercurio.com/magic/:token` → consome → redireciona para `/c/propostas/:id`.
- Magic link **membro de equipe**: token → cria conta mínima → redireciona para `/p`.
- Magic link **parceiro pós-aprovação**: token → ativa conta → `/p`.
- Notificação de status: `/c/propostas/:id?focus=timeline`.
