# Fase 9 — Gestão de Parceiros (Admin) e Onboarding por Convite

> **Status:** entregue · **Sprint:** 2026‑05‑18 → 2026‑05‑19
> **Migrations:** `20260518000042`, `20260519000001`, `20260519000002`
> **Edge Functions:** `admin-invite-partner` (deploy ✅ no projeto `bhagksfvszeogtjvjtpx`)

Esta fase fecha o ciclo de **vida do parceiro** dentro do módulo Admin, do convite à
suspensão, e elimina o gargalo que existia entre o cadastro (auto-registro ou
convidado) e a aprovação. Continua a partir dos handoffs **Fase 7 (Contratos)** e
**Fase 8 (Universidade)**, sem impactar nenhum dos seus objetos.

---

## 1. Objetivos da fase

1. Substituir o mock de `/admin/parceiros` por dados reais com gestão completa.
2. Permitir ao admin **convidar** novos parceiros por e-mail (com fallback resiliente a rate-limit / SMTP).
3. Fechar o ciclo de **aprovação** mostrando contexto do convite e documentos enviados.
4. Garantir que o parceiro convidado consiga ativar acesso, definir senha e **enviar documentação** sem precisar refazer o auto-cadastro.
5. Corrigir bugs latentes nos triggers de notificação que quebravam o `admin_suspend_partner`.

---

## 2. Backend — Migrations

### 2.1 `20260518000042_admin_partner_management.sql`

| Objeto | Tipo | Descrição |
|---|---|---|
| `v_admin_partners` | view (security_invoker) | Lista completa de parceiros com agregados: saldo da carteira, bloqueio, contagem de docs, equipes, membros, propostas (total + ativas), `volume_solicitado` e `volume_aprovado` (soma de `valor_solicitado` em status pós-emissão). |
| `admin_suspend_partner(p_partner_id, p_motivo)` | RPC `security definer` | Guard `app_is_admin()`. Bloqueia `partner_wallets`, marca `usuarios.ativo=false`, seta `partners.status='suspended'` + motivo. |
| `admin_reactivate_partner(p_partner_id)` | RPC `security definer` | Re-sincroniza `auth.users.raw_app_meta_data.role='partner'`, reativa usuário, desbloqueia carteira, status volta a `approved`. |
| `partner_invites` | tabela | Auditoria de convites: email, nome, telefone, observações, status (`sent/accepted/revoked/expired`), `created_by`, `accepted_at`, `revoked_at`, `metadata`. RLS admin-only. |
| `admin_invite_partner_record(...)` | RPC `security definer` | Cria/garante `partners(status='pending')` + registra convite. Chamada pela Edge Function com JWT do admin (preserva `auth.uid()` em `created_by`). |
| `admin_revoke_partner_invite(p_invite_id)` | RPC | Revoga convite ainda em `status='sent'`. |
| `v_admin_partner_invites` | view | Listagem com `criado_por_nome` e `partner_status`. |

### 2.2 `20260519000001_aprovacoes_view_enriched.sql`

`DROP + CREATE` da view `v_admin_partner_aprovacoes` adicionando o **contexto do convite** (precisou recriar pois PG não permite mudar ordem/nome de colunas em `OR REPLACE`):

- `origem` (`'convite' | 'auto_cadastro'`) — derivada da existência ou não em `partner_invites`.
- `invite_observacoes`, `invite_criado_por_nome`, `invite_created_at`, `invite_status`.
- `endereco_cidade`, `endereco_estado`, `ultimo_login_at`.

Permite ao admin **avaliar e aprovar** parceiros convidados que ainda não enviaram documentos, com pleno contexto.

### 2.3 `20260519000002_fix_usuarios_partner_id_refs.sql`

**Bug corrigido:** cinco funções de notificação criadas nas fases 5 e 7 consultavam `usuarios.partner_id` e `usuarios.deleted_at` — **colunas que nunca existiram**. A tabela `usuarios` se relaciona a `partners` por `partners.usuario_id` (dono) e por `equipe_membros.usuario_id` (equipe).

O erro ficava silencioso até alguém acionar um dos gatilhos. `admin_suspend_partner` faz `UPDATE` em `partner_wallets`, o que dispara `fn_notifica_wallet_bloqueio()` → `42703: column u.partner_id does not exist`.

**Correção:**

- Criado helper `app_partner_user_ids(p_partner_id uuid) returns setof uuid` (`security definer`, `stable`): retorna IDs do dono **e** membros de equipe com `aceito_em not null`. Centraliza o join correto.
- 5 funções reescritas para usar o helper + `usuarios.ativo` (existente) em vez de `usuarios.deleted_at`:
  - `fn_notifica_wallet_movimento` (recarga + saldo baixo)
  - `fn_notifica_wallet_bloqueio` ← a que estava barrando o suspend
  - `fn_notifica_contrato_assinado`
  - `fn_notifica_recurso_liberado`

As assinaturas não mudaram → nenhum trigger existente precisou ser redefinido.

---

## 3. Edge Function — `admin-invite-partner`

**Caminho:** `supabase/functions/admin-invite-partner/index.ts`  · **Verify JWT:** `true`

### Fluxo (`POST`):

1. Valida JWT do admin (`app_metadata.role === 'admin'`).
2. **Service-role:** `auth.admin.inviteUserByEmail(email, { data, redirectTo: '/auth/partner-bootstrap' })`.
3. **Caminhos de fallback:**

   | Erro do GoTrue | Ação |
   |---|---|
   | "already registered / exists" | `listUsers` localiza o existente, gera `magiclink` com `redirectTo=/auth/partner-bootstrap`. `fallback_reason='usuario_ja_existe'`. |
   | "rate limit / smtp / email" (rate-limit ≈3‑4/h do Supabase, ou SMTP indisponível) | `createUser({ email_confirm: true, app_metadata.role='partner' })` **sem envio de e-mail**, depois `generateLink('magiclink')` para o admin compartilhar. `fallback_reason='rate_limit_smtp'`. |

4. `updateUserById(usuarioId, { app_metadata: { role: 'partner' } })` — claim consumido pelo RLS.
5. RPC `admin_invite_partner_record` (com JWT do admin) cria `partners(pending)` + `partner_invites`.

**Resposta:**

```json
{
  "partner_id": "uuid",
  "usuario_id": "uuid",
  "invite_id": "uuid",
  "action_link": "https://...verify?token=...&redirect_to=.../partner-bootstrap",
  "email_sent": true,
  "fallback_reason": null | "usuario_ja_existe" | "rate_limit_smtp"
}
```

Em produção, configurar **SMTP customizado** no Dashboard (Authentication → SMTP) para evitar o rate-limit nativo.

---

## 4. Front-end Web

### 4.1 `/admin/parceiros` — `app/src/pages/admin/Parceiros.tsx`

- Listagem real via `v_admin_partners` (filtro de status + busca por nome/email/CPF/cidade).
- KPIs: ativos, pendentes, suspensos, volume solicitado total.
- Painel lateral com detalhe do parceiro: contato, endereço, saldo + estado da carteira, propostas (total / ativas), volumes, equipes, comissão, datas, motivo de rejeição.
- **Suspender** (modal inline com motivo ≥ 3 chars).
- **Reativar** (para `suspended` ou `rejected`).
- **Convidar parceiro** — modal com nome/email/DDI/telefone/observações → chama a Edge → exibe `action_link` copiável + mensagem contextual conforme `fallback_reason`.
- **Ver convites** — abre painel com `v_admin_partner_invites` (revogar inline).
- Cross-link: parceiro com status `pending` exibe botão **"Em análise — abrir em Aprovações →"** usando `<Link to=/admin/aprovacoes?partner_id=...>` (sem reload).

### 4.2 `/admin/aprovacoes` — `app/src/pages/admin/Aprovacoes.tsx`

- Aceita **deep-link** `?partner_id=<uuid>` → força filtro `all`, pré-seleciona o parceiro e limpa o param da URL com `useSearchParams`.
- Painel lateral remodelado:
  - Header com nome + StatusBadge.
  - Contato (telefone com DDI, cidade/UF, último login).
  - Linha de origem: ícone `UserPlus` ("Convidado por …") **ou** `UserCheck` ("Auto-cadastro"), sempre com data.
  - Caixa cinza com **observações do convite** quando houver.
  - Lista de documentos com mensagem dedicada para convite ainda não respondido.
- Botões **Aprovar / Recusar** (já existentes) agora funcionam mesmo para parceiros convidados sem documentos enviados, fechando o fluxo.

### 4.3 `/auth/partner-bootstrap` — `app/src/pages/public/PartnerBootstrap.tsx` (registrado em `router.tsx`)

- Página **pública** (fora de `RequireAuth/RequireApproved`) que recebe o magic-link.
- Aguarda o `supabase-js` materializar a sessão a partir do hash (`detectSessionInUrl: true`), até 30 tentativas × 250 ms.
- `supabase.auth.refreshSession()` + `useAuth().refresh()` para puxar `app_metadata.role='partner'` recém-atribuída.
- Form para **definir senha** (`supabase.auth.updateUser({ password })`) — pode pular se quiser.
- Rota final por `rpc('me')`: `partner+approved` → `/p`, `partner+pending` → `/acesso-pendente`, admin → `/admin`.

### 4.4 `/acesso-pendente` — `app/src/pages/public/AcessoPendente.tsx`

Deixou de ser placeholder. Agora é a **etapa 2 do onboarding do parceiro convidado**:

- Carrega `rpc('me')`; se aprovado, redireciona para `/p`.
- Cabeçalho com email + botão **Sair** (`logout` do `AuthContext`).
- Para `partner_status='pending'` → renderiza `PartnerDocsUploader` com 3 slots (`contrato_social` obrigatório, `cpf` obrigatório, `comprovante_residencia` opcional). Mesma UI do auto-cadastro (`/registro`).
- Botão **"Enviar para análise"** habilita quando os obrigatórios estão OK; ao clicar mostra confirmação verde.
- Para `partner_status='rejected'` → mensagem dedicada **+ uploader liberado** para reenvio (admin pode então reativar com `admin_reactivate_partner`).
- Edge cases: sem role partner, sem `partner_id` resolvido ainda, erros de RPC.

---

## 5. Seeds — `supabase/seeds/test-fluxo-completo.sql`

Script idempotente executável no SQL Editor (service_role) para criar dados de teste end-to-end:

- 3 usuários auth (`admin.teste@`, `parceiro.teste@`, `cliente.teste@`) com senha `Test@1234`, `email_confirmed_at = now()`, `app_metadata` correto.
- Parceiro aprovado + wallet com R$ 500,00 (insert direto + ledger para auditoria).
- Cliente vinculado.
- Proposta #1 em `pre_analise` para testar aprovação admin.
- Proposta #2 em `emissao_contrato` para testar Clicksign / liberação / comissão (Fase 7).
- Pendência aberta + curso LMS publicado + assinatura ativa (Fase 8).
- Notificações in-app iniciais.
- Bloco de CLEANUP comentado no rodapé.

---

## 6. Fluxo end-to-end agora suportado

```
Admin                                     Parceiro convidado
─────                                     ─────────────────
1. /admin/parceiros → "Convidar"
   ↓
2. Edge admin-invite-partner
   - createUser/inviteUserByEmail
   - generateLink('magiclink')
   - admin_invite_partner_record
   ↓
3. Recebe action_link + fallback_reason
   ↓ (compartilha link manualmente
      se rate-limit do Supabase)
                                          4. Clica no link → /auth/partner-bootstrap
                                             ↓ supabase-js consome o hash
                                          5. Define senha (ou pula)
                                             ↓ rpc('me') → partner_status='pending'
                                          6. /acesso-pendente
                                             - PartnerDocsUploader
                                             - "Enviar para análise"
7. /admin/aprovacoes (deep-link
   via ?partner_id= do card de Parceiros)
   - Vê origem "Convidado por X"
   - Vê observações + docs enviados
   - Aprova
   ↓
8. admin_approve_partner
   - auth.users.raw_app_meta_data.role='partner'
   - usuarios.role='partner'
   - partners.status='approved'
   ↓
9. Notificação in_app criada
                                         10. Próximo refresh JWT → acessa /p
```

---

## 7. Critérios de aceitação atendidos

- [x] Listagem real de parceiros para o admin com filtros + KPIs + agregados financeiros.
- [x] Convite por e-mail funcionando, com fallback que **nunca devolve 500** ao admin mesmo em rate-limit.
- [x] Parceiro convidado consegue ativar acesso, definir senha e enviar documentos sem refazer o auto-cadastro.
- [x] Tela de Aprovações exibe contexto suficiente para decidir mesmo antes do envio de documentos.
- [x] Suspensão e reativação funcionando, com auditoria em `partners.aprovado_por/aprovado_em`.
- [x] Notificações in-app de wallet/contrato/liberação não derrubam mais transações (`42703` corrigido).
- [x] `npx tsc --noEmit` 0 erros. Edge function deployada. Migrations aplicadas no `bhagksfvszeogtjvjtpx`.

---

## 8. Operação / Runbook

| Comando | Quando usar |
|---|---|
| `npx supabase db push --include-all --linked` | Aplicar migrations pendentes na Cloud. |
| `npx supabase functions deploy admin-invite-partner` | Atualizar a Edge Function. |
| `Dashboard → Authentication → SMTP Settings` | Configurar SMTP custom (recomendado em prod) para eliminar rate-limit do Supabase. |
| `select * from v_admin_partner_invites order by created_at desc;` | Auditoria rápida de convites. |
| `select public.admin_revoke_partner_invite('<invite_id>');` | Revogar convite manualmente via SQL. |
| `supabase/seeds/test-fluxo-completo.sql` | Resetar/popular ambiente de teste (idempotente). |

---

## 9. Próximos passos sugeridos (Fase 10)

1. **Onboarding do parceiro mobile** — replicar `/auth/partner-bootstrap` e `/acesso-pendente` no Expo (`mobile/app/(parceiro)/`), wirando Supabase no app.
2. **Telas mobile reais** — substituir mocks de `mobile/app/(admin)/aprovacoes.tsx` e `parceiros.tsx` por dados das mesmas views/RPCs.
3. **Equipes do parceiro** — UI admin para visualizar/aprovar membros de equipe (já existem tabelas `equipes` + `equipe_membros`).
4. **Webhook de e-mail bounced** — capturar bounces do SMTP custom para marcar `partner_invites.status='expired'`.
5. **Métricas de funil** — view `v_admin_funil_parceiros` (convidado → ativou → enviou docs → aprovado → 1ª proposta) para o dashboard.

