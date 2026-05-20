# Handoff — Fase 7 (Contratos & Financeiro)

> Documento de transferência para o desenvolvedor que assume a Fase 7 a partir do estado atual (commit `d5ba602`, branch `main`, **2026-05-18**).

---

## 1. Onde estamos

✅ **Fases 1 → 6 entregues e em produção** (mock providers em consultas; Stripe em modo dev até configurar secrets).

| Fase | Resumo |
|------|--------|
| 1 | Auth + RLS + Roles (admin/partner/team_member/client) + 2FA |
| 2 | CRUD parceiros, equipes, clientes, simulações |
| 3 | Originação completa (propostas, proponentes, imóveis, documentos, pendências, magic link) |
| 4 | Admin Ops (aprovações, auditoria, KPIs, exportações CSV/PDF) |
| 5 | **Carteira Stripe** + preços versionados + ajustes admin |
| 6 | **Consultas externas pagas** com débito/estorno automático |

Tudo descrito em [docs/09-roadmap.md](../09-roadmap.md). **Sua tarefa começa exatamente na seção "Fase 7 — Contratos & Financeiro".**

---

## 2. Setup local (5 min)

```bash
# 1. Clonar e instalar
git clone git@github.com:bonacciniWd/mercurio-capital.git
cd mercurio-capital/app && npm install

# 2. Variáveis (já existe um .env.local na pasta app/ no repo do dono — pedir)
# Mínimo:
#   VITE_SUPABASE_URL=https://bhagksfvszeogtjvjtpx.supabase.co
#   VITE_SUPABASE_ANON_KEY=...

# 3. CLI Supabase (auth + link)
brew install supabase/tap/supabase    # ou: npm i -g supabase
supabase login
cd ..  # raiz do repo
supabase link --project-ref bhagksfvszeogtjvjtpx

# 4. Rodar
cd app && npm run dev                  # localhost:5173

# 5. Validação rápida
cd app && npx tsc --noEmit             # deve passar sem erros
```

**Project ref Supabase:** `bhagksfvszeogtjvjtpx`
**Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx

---

## 3. Convenções **OBRIGATÓRIAS** (não invente padrões novos)

### 3.1 Stack
- **Front:** React 18 + Vite + TypeScript + TanStack Query v5 + React Router v6 + Tailwind + lucide-react.
- **Back:** Supabase Postgres + RLS + Edge Functions (Deno).
- **Pacote oficial Deno em edges:** `https://esm.sh/@supabase/supabase-js@2.45.4` (não mudar versão).

### 3.2 Migrations
- Naming: `YYYYMMDDHHMMSS_descricao_fase.sql` (use prefixo `20260518` + sequência incremental — próxima livre: `20260518000030_`).
- Aplicação remota: `supabase db push`.
- **Sempre RLS habilitada** com policies por role (partner/team/client/admin). Veja exemplos em `20260513000004_operacoes.sql`.
- Funções de escrita: `security definer` + `set search_path = public` + `grant execute … to authenticated`.

### 3.3 Edge Functions
- Pasta: `supabase/functions/<nome-kebab>/index.ts`.
- Helper de CORS/JSON: `import { corsHeaders, jsonResponse } from '../_shared/cors.ts'`.
- Header `Authorization` propagado para o `createClient` para respeitar RLS no contexto do usuário.
- Configuração `verify_jwt` em `supabase/config.toml`. **Webhooks externos = `verify_jwt = false`** (validar assinatura HMAC manualmente).
- Deploy: `supabase functions deploy <nome> --project-ref bhagksfvszeogtjvjtpx`.
- Exemplos de referência:
  - [supabase/functions/wallet-topup/index.ts](../supabase/functions/wallet-topup/index.ts) — pagamento + rate-limit + modo dev.
  - [supabase/functions/stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts) — HMAC + idempotência via inbox table.
  - [supabase/functions/consulta-executar/index.ts](../supabase/functions/consulta-executar/index.ts) — débito/estorno + tratamento de erros HTTP.

### 3.4 UI / Front
- Telas em `app/src/pages/<role>/` (`admin`, `partner`, `client`, `public`). Roteamento centralizado em [app/src/router.tsx](../app/src/router.tsx).
- Componentes reusáveis em `app/src/components/`.
- Padrão de detalhe de proposta usa **tabs** — adicione tabs novas em `TABS` const + bloco `{tab === '…' && …}`. Veja [PartnerPropostaDetalhe.tsx](../app/src/pages/partner/PropostaDetalhe.tsx) e [AdminPropostaDetalhe.tsx](../app/src/pages/admin/PropostaDetalhe.tsx).
- **Sempre TanStack Query** para reads (`useQuery`) e mutations (`useMutation` + `invalidateQueries`). Não use `useEffect` para fetch.
- **Sempre supabase JS para RPC/views**, exceto quando precisa rodar lógica privilegiada — então Edge Function.
- Classes Tailwind: `card`, `btn-gold`, `btn-outline`, `input`, `badge`, paleta `navy/gold/silver/success/danger`. Não introduza Tailwind config novo.
- Formato monetário: `brl(centavos: number)` de [`@/lib/utils`](../app/src/lib/utils.ts) — entrada em centavos.
- Modais inline padrão: `<div className="fixed inset-0 z-50 …" onClick={onClose}><div onClick={stopPropagation}>…`. Veja `AdminCarteiras.tsx` e `Precos.tsx`.

### 3.5 Git
- Branch única `main`, sem PRs internos (pequeno time). Sempre rodar typecheck antes de commitar.
- Mensagens: `feat(fase-N): …`, `fix(…): …`, `docs: …`.

---

## 4. O que JÁ EXISTE para Fase 7 (não recriar!)

Tabelas já estão criadas em [supabase/migrations/20260513000004_operacoes.sql](../supabase/migrations/20260513000004_operacoes.sql):

| Tabela | Pronta? | O que falta |
|--------|---------|-------------|
| `contratos` | ✅ schema + RLS | RPCs, geração de PDF, upload storage |
| `assinaturas_contrato` | ✅ schema + RLS | RPCs vinculadas ao webhook |
| `liberacoes_recurso` | ✅ schema + RLS | RPCs, upload comprovante |
| `comissoes` | ✅ schema + RLS | RPC cálculo + trigger ao liberar recurso |

Enum `proposta_status` (em `20260513000001_enums.sql`) já tem: `emissao_contrato`, `aguardando_assinatura`, `em_registro`, `contrato_registrado`, `recurso_liberado`.

Existe trigger `validate_proposta_status_transition()` que **bloqueia transições inválidas** ([20260513000008_access_hardening.sql](../supabase/migrations/20260513000008_access_hardening.sql) linha 184). **Leia essa função antes** — se precisar adicionar transição nova, edite lá.

RPC admin já existente: `admin_set_proposta_status(p_proposta, p_status, p_motivo)` ([20260518000002_admin_ops_rpcs.sql](../supabase/migrations/20260518000002_admin_ops_rpcs.sql)).

---

## 5. Tarefas Fase 7 (em ordem sugerida)

### Tarefa 1 — Migration `20260518000030_contratos_fase7.sql`

Criar:

1. **RPC `contrato_gerar(p_proposta_id, p_pdf_path, p_signatarios jsonb)`** — `security definer`:
   - Valida `proposta.status = 'emissao_contrato'` e role partner/admin.
   - INSERT em `contratos` (pdf_storage_path, gerado_por=auth.uid(), gerado_em=now()).
   - INSERT em massa em `assinaturas_contrato` a partir do jsonb (array de `{nome, email, cpf, papel}`).
   - Move proposta para `aguardando_assinatura` via `update propostas set status=...` (o trigger de histórico vai gravar).
   - Retorna `contratos` row.

2. **RPC `contrato_marcar_assinado(p_contrato_id, p_envelope_id)`** — chamada **só** pelo webhook (service role):
   - UPDATE `contratos.assinado_em = now()`, `provider_envelope_id = $2`.
   - UPDATE todas `assinaturas_contrato.status = 'assinado'`, `assinado_em = now()` para o contrato.
   - Move proposta para `em_registro`.

3. **RPC `contrato_registrar(p_contrato_id)`** — admin:
   - UPDATE `contratos.registrado_em = now()`.
   - Move proposta para `contrato_registrado`.

4. **RPC `liberacao_registrar(p_proposta_id, p_valor, p_data, p_comprovante_path)`** — admin:
   - INSERT em `liberacoes_recurso`.
   - Move proposta para `recurso_liberado`.
   - Dispara cálculo de comissão (próximo item).

5. **Trigger `trg_calcular_comissao` AFTER INSERT em `liberacoes_recurso`**:
   - Lê `partners.percentual_comissao` (existe? confira em `partners` — se não, criar campo `percentual_comissao numeric(5,2) default 1.5`).
   - INSERT em `comissoes` com `status='prevista'`, `valor = liberacao.valor * percentual / 100`.

6. **RPC `comissao_aprovar(p_comissao_id)`** e **`comissao_marcar_paga(p_comissao_id, p_data)`** — admin.

7. **View `v_financeiro_admin`** (dashboard): aggrega liberações por mês, comissões previstas/pagas, ticket médio, partners no top.

8. **Bucket Storage:** criar bucket `contratos` (private) e `comprovantes` (private) via `select storage.create_bucket(...)` ou Dashboard. Policies de leitura: admin tudo, partner só onde `proposta.partner_id = app_partner_id()`.

⚠️ **Verifique antes de rodar** se há trigger automático em `propostas` para gravar `proposta_status_historico` — sim, existe `trg_proposta_status_historico` (procure em migrations). Não duplique.

### Tarefa 2 — Geração de PDF do contrato

Opções (ordem de preferência):

- **A.** Edge Function `contrato-gerar` chamando `https://api.pdfshift.io` (ou `https://pdf-api.io`) com HTML renderizado server-side de um template fixo. Variáveis: dados da proposta + proponentes + imóveis.
- **B.** Renderizar HTML no front, usar `html2pdf.js` no cliente e fazer upload via `supabase.storage.from('contratos').upload(...)`. Mais simples, menos profissional.

**Recomendado A.** Salvar PDF em `contratos/<proposta_id>/v<n>.pdf` e gravar o path em `contratos.pdf_storage_path`.

Template HTML — manter em `supabase/functions/contrato-gerar/template.ts` exportando função `renderHtml(dados) → string`. Inspire-se no padrão de figma-make-prompts ou peça ao dono o modelo aprovado pelo jurídico.

### Tarefa 3 — Integração Clicksign

1. Criar conta sandbox: https://app.clicksign.com (modo sandbox grátis).
2. Variáveis a configurar em **Supabase → Edge Functions → Secrets**:
   - `CLICKSIGN_API_TOKEN`
   - `CLICKSIGN_WEBHOOK_SECRET`
   - `CLICKSIGN_API_URL` (sandbox: `https://sandbox.clicksign.com`)
3. **Edge `contrato-enviar-assinatura`** (verify_jwt=true):
   - Recebe `{ contrato_id }`.
   - Faz upload do PDF para Clicksign (`POST /api/v1/documents`).
   - Cria signatários (`POST /api/v1/signers`).
   - Vincula (`POST /api/v1/lists`).
   - Salva `contratos.provider_envelope_id` + `provedor_assinatura = 'clicksign'`.
4. **Edge `clicksign-webhook`** (verify_jwt=**false**, validar HMAC):
   - Eventos `auto_close`, `document_signed`, `cancel`.
   - Quando todos assinaram → `select contrato_marcar_assinado(...)`.
   - **Padrão de idempotência:** criar tabela `clicksign_webhooks_inbox(event_id text primary key, payload jsonb, processed_at timestamptz)` antes de processar. Veja exatamente o mesmo padrão em [stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts).

📖 Docs Clicksign: https://developers.clicksign.com/docs

### Tarefa 4 — UI

#### Tab "Contrato" no detalhe da proposta (parceiro + admin + cliente)
Criar [`app/src/components/PropostaContrato.tsx`](../app/src/components/PropostaContrato.tsx) (padrão idêntico ao [PropostaConsultas.tsx](../app/src/components/PropostaConsultas.tsx)):
- Se proposta < emissao_contrato → vazio "Aguardando aprovação".
- Se status = emissao_contrato e role partner → botão "Gerar contrato" (chama Edge `contrato-gerar`).
- Se contrato gerado → botão "Enviar para assinatura" + lista de signatários com status.
- Se em_registro → painel admin com botão "Marcar como registrado".
- Se contrato_registrado → admin vê "Registrar liberação de recurso" (modal: valor, data, upload comprovante).
- Se recurso_liberado → mostra comissão prevista do parceiro.

Adicionar tab `'Contrato'` em `TABS` nos 3 detalhes (partner/admin/client).

#### Página `/admin/financeiro` (dashboard)
- Criar [`app/src/pages/admin/Financeiro.tsx`](../app/src/pages/admin/Financeiro.tsx) consumindo a view `v_financeiro_admin`.
- Cards de KPI (volume liberado mês, comissões pagas/previstas, ticket médio).
- Tabela de comissões pendentes com ações "Aprovar" / "Marcar paga".
- Adicionar rota em [router.tsx](../app/src/router.tsx) no grupo admin: `{ path: 'financeiro', element: <AdminFinanceiro /> }` (já existe sub-grupo financeiro com `/carteiras` e `/precos`).
- Adicionar link no menu lateral [AdminLayout.tsx](../app/src/layouts/AdminLayout.tsx).

#### Página parceiro `/p/comissoes`
- [`app/src/pages/partner/Comissoes.tsx`](../app/src/pages/partner/Comissoes.tsx).
- Lista de comissões do partner_id logado (RLS já filtra).
- KPI top: total previsto, total pago, próximo recebimento.

### Tarefa 5 — Roadmap, typecheck, deploy, commit

```bash
cd app && npx tsc --noEmit                      # 0 erros
supabase functions deploy contrato-enviar-assinatura --project-ref bhagksfvszeogtjvjtpx
supabase functions deploy clicksign-webhook    --project-ref bhagksfvszeogtjvjtpx
supabase functions deploy contrato-gerar       --project-ref bhagksfvszeogtjvjtpx  # se for Edge

# Atualizar docs/09-roadmap.md Fase 7 → marcar todos [x]
git add -A
git commit -m "feat(fase-7): contratos + clicksign + liberação + comissões + financeiro admin"
git push
```

---

## 6. Checklist de aceitação Fase 7

- [ ] Migration 030 aplicada (verificar com `supabase db push` no remote).
- [ ] PDF do contrato gerado e salvo no Storage com path em `contratos.pdf_storage_path`.
- [ ] Fluxo Clicksign **sandbox** end-to-end: parceiro gera → cliente recebe email sandbox → assina → webhook atualiza status.
- [ ] Liberação de recurso aciona `INSERT comissoes` com status `prevista`.
- [ ] Admin aprova comissão → status `aprovada`; admin marca paga → `paga` + `paga_em`.
- [ ] `/admin/financeiro` renderiza com dados reais (criar ao menos 1 caso de teste).
- [ ] `/p/comissoes` mostra apenas comissões do partner logado (testar com 2 parceiros).
- [ ] Notificação enviada ao parceiro quando contrato assinado e quando recurso liberado (use mesma tabela `notificacoes` já existente — veja exemplos de trigger em [20260518000010_wallet_fase5.sql](../supabase/migrations/20260518000010_wallet_fase5.sql)).
- [ ] `npx tsc --noEmit` sem erros.
- [ ] Roadmap atualizado e commit pushed.

---

## 7. Armadilhas conhecidas (leitura obrigatória)

1. **Tabela `partners` NÃO tem `nome`/`razao_social`.** Sempre `JOIN usuarios u on u.id = partners.usuario_id` e usar `u.nome_completo`, `u.email`. Aprendido a duras penas na Fase 5.

2. **Trigger de validação de status** (`validate_proposta_status_transition`) rejeita pulos arbitrários. Antes de fazer `update propostas set status='recurso_liberado'`, confirme que a transição (status atual → novo) está permitida na função — se não, edite a função e adicione.

3. **RLS pode esconder linhas** ao testar local com role partner — o helper `app_partner_id()` lê de `auth.jwt() → app_metadata → partner_id`. Confira que o usuário de teste tem `app_metadata.partner_id` setado (existe migration `20260513000009_auth_bridge.sql` que cuida disso ao aprovar parceiro).

4. **Edge Functions Deno** não suportam npm puro. Sempre `https://esm.sh/...` ou import maps. Para libs Clicksign, use `fetch` direto contra a REST API.

5. **Storage paths**: `bucket/proposta_id/arquivo.ext`. Não usar paths absolutos com `/` inicial.

6. **Idempotência em webhooks**: padrão obrigatório com tabela `*_webhooks_inbox` + PK no `event_id`. Veja `stripe_webhooks_inbox` para template.

7. **Centavos vs reais**: `wallet_*` usa **bigint centavos**. `contratos`/`comissoes`/`liberacoes_recurso` usa **numeric(14,2) reais**. Cuidado ao formatar — `brl()` espera centavos, então `brl(Number(comissao.valor) * 100)`.

8. **Ambiente Stripe está em modo dev** (sem `STRIPE_SECRET_KEY`). Não precisa ativar real para Fase 7 funcionar. Documentação em [docs/operacao/stripe-setup.md](../operacao/stripe-setup.md).

---

## 8. Contatos e referências

- **Repositório:** https://github.com/bonacciniWd/mercurio-capital
- **Documentação técnica:** pasta [docs/](.)
  - [01-architecture.md](../blueprint/01-architecture.md)
  - [02-roles-permissions.md](../blueprint/02-roles-permissions.md)
  - [03-routes-navigation.md](../blueprint/03-routes-navigation.md)
  - [04-database-schema.md](../blueprint/04-database-schema.md)
  - [06-modules-features.md](../blueprint/06-modules-features.md)
  - [08-security-compliance.md](../blueprint/08-security-compliance.md)
- **Supabase Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx
- **Provedor assinatura sugerido:** Clicksign sandbox — https://developers.clicksign.com

---

## 9. Dica final

**Antes de codar qualquer linha**, rode:

```bash
git log --oneline -20
```

E leia os commits das fases 4, 5 e 6 — você vai entender o ritmo, granularidade e padrões de mensagem usados. Replique.

**Boa sorte! Se algo do schema não bate com este doc, o código no repo é a fonte da verdade — este documento foi escrito em 2026-05-18 e pode ter atrasado um commit.**
