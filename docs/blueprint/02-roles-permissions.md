# 02 — Papéis (RBAC) & Permissões

## 1. Hierarquia de papéis

```
admin
 └── partner (parceiro)
      └── team_member (assistente)
client (lead autenticado)
public (visitante)
```

- `admin`: operação interna Mercurio.
- `partner`: dono da conta de parceria. Pode ter um ou mais `team_member` na sua **equipe**.
- `team_member`: pertence a **uma única** equipe; herda visibilidade das propostas da equipe, mas com permissões reduzidas.
- `client`: cliente final autenticado, vê apenas suas próprias propostas.
- `public`: sem login, somente landing, login, registro e consulta por protocolo (rate-limited).

## 2. Tabela mestra de permissões

| # | Recurso / Ação | admin | partner | team_member | client | public |
|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | Acessar landing pública | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Login / Registro | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Consultar proposta por protocolo (público) | ✅ | ✅ | ✅ | ✅ | 🔒 (rate-limit) |
| 4 | Aprovar cadastro de parceiro | ✅ | ❌ | ❌ | ❌ | ❌ |
| 5 | Criar simulação | ✅ | ✅ | ✅ | ❌ | ❌ |
| 6 | Criar proposta (lead) via wizard | ✅ | ✅ | ✅ | ❌ | ❌ |
| 7 | Editar proposta (própria/equipe) | ✅ | ✅ | ✏️ campos limitados | ❌ | ❌ |
| 8 | Mudar status da proposta | ✅ | ⚠️ até "Proposta ao cliente" | ❌ | ❌ | ❌ |
| 9 | Mudar status (analise crédito/imóvel/jurídica/comitê/contrato) | ✅ | ❌ | ❌ | ❌ | ❌ |
| 10 | Atribuir responsável (team_member) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 11 | Solicitar documentos ao cliente | ✅ | ✅ | ✅ | ❌ | ❌ |
| 12 | Upload de documentos do cliente | ✅ | ✅ | ✅ | ✅ | ❌ |
| 13 | Aprovar/rejeitar documentos | ✅ | ⚠️ apenas pré-análise | ❌ | ❌ | ❌ |
| 14 | Ver dashboard pessoal | ✅ | ✅ | ✅ (escopo equipe) | ✅ (próprio) | ❌ |
| 15 | Ver dashboard global | ✅ | ❌ | ❌ | ❌ | ❌ |
| 16 | Gerenciar equipe (adicionar/remover) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 17 | Convidar membro via magic link | ✅ | ✅ | ❌ | ❌ | ❌ |
| 18 | Acessar Universidade (cursos gratuitos) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 19 | Acessar Universidade (cursos pagos) | ✅ | ✅ se assinante | ✅ se assinante | ✅ se assinante | ❌ |
| 20 | Criar/editar cursos | ✅ | ❌ | ❌ | ❌ | ❌ |
| 21 | Emitir certificados (regra) | ✅ | ❌ | ❌ | ❌ | ❌ |
| 22 | Disparar consultas Bacen/Serasa | ✅ | ✅ (com cota) | ❌ | ❌ | ❌ |
| 23 | Disparar consultas jurídicas | ✅ | ⚠️ via solicitação | ❌ | ❌ | ❌ |
| 24 | Configurar integrações / chaves de API | ✅ | ❌ | ❌ | ❌ | ❌ |
| 25 | Editar fluxos Evolution (JSON) | ✅ | ❌ | ❌ | ❌ | ❌ |
| 26 | Disparar push/WhatsApp manual | ✅ | ⚠️ templates aprovados | ❌ | ❌ | ❌ |
| 27 | Exportar relatórios (xlsx) | ✅ | ✅ (escopo próprio) | ⚠️ limitado | ❌ | ❌ |
| 28 | Visualizar rede (React Flow) | ✅ | ⚠️ apenas sua rede | ❌ | ❌ | ❌ |
| 29 | Gerenciar campanhas | ✅ | ❌ | ❌ | ❌ | ❌ |
| 30 | Audit log | ✅ | ❌ | ❌ | ❌ | ❌ |
| 31 | Ver saldo da carteira | ✅ | ✅ (própria) | ⚠️ apenas leitura | ❌ | ❌ |
| 32 | Recarregar carteira (Stripe) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 33 | Executar consulta paga (debita carteira) | ✅ | ✅ se saldo ≥ preço | ❌ | ❌ | ❌ |
| 34 | Ajuste manual de saldo (crédito/débito) | ✅ | ❌ | ❌ | ❌ | ❌ |
| 35 | Bloquear/desbloquear carteira | ✅ | ❌ | ❌ | ❌ | ❌ |
| 36 | Editar tabela `precos_consulta` | ✅ | ❌ | ❌ | ❌ | ❌ |
| 37 | Definir limite diário da própria carteira | ✅ | ⚠️ se habilitado por admin | ❌ | ❌ | ❌ |

Legenda: ✅ pleno · ⚠️ parcial/condicional · ✏️ campos restritos · 🔒 público com restrição · ❌ negado.

Nota de implementação (branch atual): a criação de proposta via UI está ativa no web em `/p/propostas/nova` (partner e team_member) e `/admin/propostas/nova` (admin), e no mobile pelos fluxos `mobile/app/propostas/nova.tsx` (wizard compartilhado) e `mobile/app/(admin)/propostas-nova.tsx` (entrada admin). Em ambos os canais, criação admin exige parceiro aprovado.

## 3. Regras de negócio críticas

1. **Aprovação manual do parceiro**: novo `partner` entra com `status='pending'` e só ganha permissões plenas após `admin` aprovar (`status='approved'`). Documentação obrigatória antes da aprovação (ver §06).
2. **Cliente cria conta apenas via magic link**: o cliente nunca se auto-registra; o parceiro cadastra a proposta, gerando o lead, e o sistema envia magic link via WhatsApp/e-mail.
3. **Equipe**: `team_member` só enxerga propostas onde `proposta.equipe_id = membro.equipe_id` **e** opcionalmente apenas `proposta.responsavel_id = membro.id` se a equipe configurar isolamento estrito.
4. **Consulta pública por protocolo**: rate limit por IP (ex: 10/min), CAPTCHA obrigatório, expõe apenas dados não sensíveis (status, etapa, data) — nunca CPF, valor, documentos.
5. **Documentos sensíveis**: armazenados em buckets **privados**; acesso somente via `signedUrl` gerada por Edge Function que valida JWT e ownership.
6. **2FA obrigatório** para `admin` e `partner` (TOTP).
7. **Status sensíveis** (Análise Jurídica, Comitê, Contrato Registrado, Recurso Liberado) só podem ser alterados por `admin`.

## 4. Implementação no Postgres (RLS)

Esquema de claims no JWT (Supabase Auth `app_metadata`):

```json
{
  "role": "partner",                       // admin | partner | team_member | client
  "user_id": "uuid",
  "partner_id": "uuid|null",               // referência ao registro em partners
  "equipe_id": "uuid|null",                // para team_members
  "approved": true,
  "subscription_active": false
}
```

Funções helper (SQL):

```sql
create or replace function auth.role() returns text
  language sql stable as $$ select coalesce(auth.jwt()->>'role','public') $$;

create or replace function auth.is_admin() returns boolean
  language sql stable as $$ select auth.role() = 'admin' $$;

create or replace function auth.partner_id() returns uuid
  language sql stable as $$ select nullif(auth.jwt()->>'partner_id','')::uuid $$;

create or replace function auth.equipe_id() returns uuid
  language sql stable as $$ select nullif(auth.jwt()->>'equipe_id','')::uuid $$;
```

Exemplo de policy (`propostas`):

```sql
alter table propostas enable row level security;

create policy "admin_full" on propostas
  for all using (auth.is_admin()) with check (auth.is_admin());

create policy "partner_own" on propostas
  for select using (partner_id = auth.partner_id());

create policy "partner_team" on propostas
  for select using (equipe_id = auth.equipe_id() and auth.role() = 'team_member');

create policy "client_own" on propostas
  for select using (cliente_user_id = auth.uid() and auth.role() = 'client');
```

## 5. Matriz de permissões por status (transições)

```
[Simulação] → Pré-análise → Análise de Crédito → Análise de Imóvel
            → Análise Jurídica → Comitê → Proposta ao Cliente
            → Resolução de Pendências → Emissão de Contrato
            → Aguardando Assinatura → Em Registro → Contrato Registrado
            → Recurso Liberado
                                                    ↘ Cancelado (a qualquer momento)
```

| De → Para | Quem pode |
|---|---|
| Simulação → Pré-análise | partner, team_member, admin |
| Pré-análise → Análise de Crédito | admin |
| Análise de Crédito → Análise de Imóvel | admin |
| Análise de Imóvel → Análise Jurídica | admin |
| Análise Jurídica → Comitê | admin |
| Comitê → Proposta ao Cliente | admin |
| Proposta ao Cliente → Resolução de Pendências | admin, partner |
| Resolução de Pendências → Emissão de Contrato | admin |
| Emissão de Contrato → Aguardando Assinatura | admin |
| Aguardando Assinatura → Em Registro | admin (webhook assinatura) |
| Em Registro → Contrato Registrado | admin |
| Contrato Registrado → Recurso Liberado | admin |
| Qualquer → Cancelado | admin, partner (com motivo) |
