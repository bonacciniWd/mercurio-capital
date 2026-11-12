# Plano — Funil comercial de prospecção de parceiros + admin_nivel 'comercial'

**Data:** 2026-11-12 · **Status:** ✅ aprovado pelo dono em 2026-11-12 (plano + modelo de dados) · **Versão vigente:** 0.3.0 (sem alteração neste plano) · **Pendente:** print de referência do dono → spec UX/UI (WS-C bloqueada)

**Confirmações do dono (suposições S1–S5):**
- S1: "Converter em proposta" cria a proposta de crédito via wizard admin; executa: comercial + full.
- S2: comercial NÃO vê financeiro geral, preços, configurações, feature flags, integrações, fluxos/campanhas/templates, auditoria, milestones, relatórios, kanban de propostas, WhatsApp; NÃO dispara Serasa.
- S3: carteiras = somente leitura (backend já exige full para escrever).
- S4: tela de prospecção acessível a full + limitado + comercial; jurídico fora.
- S5: card com responsável, data de follow-up e arquivamento/perda com motivo obrigatório.

---

## 1. Executive Summary

**Objetivo:** criar o funil comercial de prospecção de parceiros (Kanban pré-proposta, 8 colunas) e o novo nível de admin `comercial`, sem quebrar o modelo `admin_nivel` (full/limitado/juridico) já endurecido.

**Métrica de sucesso:** um admin com `admin_nivel='comercial'` opera o funil ponta a ponta (criar card → mover pelas 8 colunas → converter), acessa apenas as telas autorizadas, e toda movimentação fica auditada; nenhuma rota/RPC fora do escopo responde para esse nível.

**Decisões estruturais recomendadas (para aprovação):**
- **Entidade NOVA** `prospeccoes_parceiro` — não reaproveitar leads B2C nem `partners` (detalhes e prós/contras em §4, workstream DB).
- **`admin_comercial` = novo valor de `admin_nivel` ('comercial')**, mantendo `role='admin'`. Criar `role` novo foi descartado: quebraria o padrão consolidado (helpers `app_is_admin*`, RLS, guards, Edge `admin-invite-internal`) e o blueprint §1.
- **Achado crítico:** `sanitizeAdminNivel` (web, `app/src/auth/authClient.ts:180`) e o parser do mobile (`mobile/lib/auth.tsx:38-40`) fazem **fallback de nível desconhecido para `'full'`**. Adicionar 'comercial' exige atualizar os dois parsers **na mesma entrega** — caso contrário, um comercial veria UI de admin full (o backend continuaria bloqueando, mas é falha de guard/defesa em profundidade).
- **Seção de UI do funil: explicitamente PENDENTE** do print de referência do dono + especificação do agente UX/UI.

---

## 2. In Scope

- Novo `admin_nivel='comercial'` (claim, helpers, RPC de atribuição, parsers web/mobile, guards, navegação).
- Nova tela admin Kanban de prospecção de parceiros: `Oportunidades → Follow Up → Reunião Realizada → Reunião de continuação: a marcar → Reunião de continuação: Realizada → Fechamento e avanço documental → NCA/Mandato → Converter em proposta`.
- Modelo de dados novo (tabela + histórico + view admin + RPCs + auditoria + smoke test).
- Allowlist de rotas do nível comercial: dashboard, aprovações, parceiros (+equipes), rede, propostas, leads, carteiras, universidade + nova tela.
- Ajuste da Edge `admin-invite-internal` (hoje fixa `admin_nivel='limitado'`) para permitir convite de comercial.

## 3. Out of Scope

- Mobile: sem hub admin no tree (ver contradição em §4); funil é web-only na v1.
- Criação de `role` novo no JWT; mudança em `app_is_admin_operacional()` (full|limitado) — **não** estender para comercial (ver risco R2).
- Escrita em carteiras/financeiro/preços/feature flags/LGPD por comercial (permanece `app_is_admin_full()`).
- Kanban de propostas existente, classificador de leads, WhatsApp, fluxos/campanhas/templates, Serasa.
- Qualquer deploy, tag, release ou publicação (NO-GO até checklist de release + GO explícito).
- Especificação visual detalhada da tela (aguarda print do dono → agente UX/UI).

---

## 4. Delivery Plan por Workstream

### WS-A — Modelo de dados (para aprovação prévia do dono)

**Recomendação: entidade NOVA. Análise de alternativas:**

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| Reusar `simulacao_leads_publicos` / `lead_status_comercial` | Reusa RPC otimista e histórico | Domínio B2C (tomador de crédito) ≠ B2B (prospecção de parceiro); constraint `lead_status_exatamente_uma_origem` exigiria 3ª FK; consentimento LGPD do simulador não cobre prospecção ativa; polui `v_admin_leads_publicos` e dashboards existentes | ❌ |
| Novo status em `partners` (ex.: `prospeccao`) | Conversão "grátis" | `partners.usuario_id` é NOT NULL unique (exige conta auth); prospect não tem conta; afrouxar invariante é invasivo e arrisca RLS existente | ❌ |
| Reusar `partner_invites` | Já tem e-mail/status | Invite é pós-decisão (convite disparado), não pipeline de relacionamento com reuniões; status enum incompatível | ❌ |
| **Nova `prospeccoes_parceiro`** | Isolamento limpo, RLS/auditoria próprios, conversão via link `partner_id`; espelha padrão comprovado de `lead_status_comercial` (tabela + histórico + RPC com lock otimista) | Superfície nova a manter; risco de duplicidade com lead/partner existente (mitigar com warning de e-mail, não constraint dura) | ✅ |

**Colisão de nome:** já existem `admin_funil_parceiros()` / `v_admin_funil_parceiros` (20260520000010) — contadores agregados do funil PÓS-convite (convidados→ativaram→docs→aprovados→com proposta→comissão). Conceito diferente. Nomear a nova superfície como **"Prospecção"** (`prospeccoes_parceiro`, rota `/admin/prospeccao`) para evitar ambiguidade.

**Entidade proposta — `public.prospeccoes_parceiro`:**
- `id uuid pk default gen_random_uuid()`
- `nome_empresa text not null` (2–160), `contato_nome text not null` (3–160)
- `contato_email text` (regex de e-mail, lower), `contato_telefone text` (`^[0-9]{10,11}$`) — ao menos um dos dois obrigatório (CHECK)
- `origem text` (indicacao|evento|outbound|site|outro — catálogo CHECK), `notas text`
- `status text not null default 'oportunidade'` CHECK ∈ (`oportunidade`,`follow_up`,`reuniao_realizada`,`reuniao_continuacao_a_marcar`,`reuniao_continuacao_realizada`,`fechamento_documental`,`nca_mandato`,`converter_proposta`)
- `responsavel_id uuid references usuarios(id)` (admin dono do card; default `auth.uid()`)
- `proxima_acao_em timestamptz` (lembrete de follow-up, opcional)
- `partner_id uuid references partners(id)` — preenchido na conversão; **unique parcial** `where partner_id is not null` (1 partner ⇐ no máx. 1 prospecção)
- `proposta_id uuid references propostas(id)` — se a conversão gerar proposta
- `arquivado_em timestamptz`, `motivo_arquivamento text` (perda/desistência)
- Auditoria padrão: `created_at`, `updated_at` (trigger `set_updated_at`), `created_by`, `updated_by`, `deleted_at` (soft delete)

**Histórico — `public.prospeccoes_parceiro_historico`:** `id`, `prospeccao_id fk cascade`, `status_anterior`, `status_novo`, `alterado_em`, `alterado_por` (espelha `lead_status_comercial_historico`; transições livres entre colunas, todas registradas).

**Cardinalidade:** prospecção 1:N histórico; prospecção 0..1:1 partner; prospecção 0..1:1 proposta; responsável 1:N prospecções.

**RLS (diff mínimo):**
- `enable row level security`; SELECT policy `using (public.app_is_admin())` (todos os níveis leem — mesmo padrão dos leads públicos).
- **Nenhuma policy de INSERT/UPDATE/DELETE direta** — escrita só via RPCs `security definer` (padrão `admin_set_lead_status_comercial`).
- View `v_admin_prospeccoes_parceiro` com `security_invoker=on`, `grant select` a `authenticated`.

**RPCs (guard: novo helper `app_is_admin_escopo_comercial()` = `app_is_admin() AND admin_nivel IN ('full','limitado','comercial')` — exclui só juridico):**
- `admin_prospeccao_create(...)` → insere + audita.
- `admin_prospeccao_update(p_id, campos...)` → edita dados (não status).
- `admin_prospeccao_move(p_id, p_novo_status, p_status_esperado)` → lock advisory + checagem otimista + histórico (padrão comprovado).
- `admin_prospeccao_arquivar(p_id, p_motivo)` → arquivamento com motivo obrigatório.
- `admin_prospeccao_converter(p_id, p_modo, ...)` → **semântica pendente do dono** (ver suposição S1); implementação recomendada: cria/vincula `partners` (pending) via lógica interna equivalente a `admin_invite_partner_record` e, se confirmado, proposta via wizard admin — **sem alterar o guard `app_is_admin_operacional()` de `admin_create_proposta`** (a RPC de conversão, security definer, executa os inserts com seu próprio guard).
- Auditoria: `audit_log` em create/move/converter/arquivar (`acao`, `entidade='prospeccoes_parceiro'`, payloads antes/depois).
- Extensão de `admin_set_admin_nivel`: validar `'comercial'` na lista.
- Smoke test novo em `supabase/smoke-tests/` cobrindo: guards por nível, move otimista (conflito 40001), conversão, RLS (juridico não escreve; partner/team/client não leem).

### WS-B — Papel `comercial` (guards, RPCs, auth)

- `admin_nivel='comercial'` em: tipo `AdminNivel` web + `sanitizeAdminNivel` (app), tipo + parser mobile (`mobile/lib/auth.tsx`) — **mesmo PR que a migration** (achado crítico do fallback→full).
- `RequireAdminScope`/`adminScope.ts`: allowlist por nível hoje é binária (restritos compartilham menu); introduzir mapa por nível, pois comercial ≠ limitado (comercial **tem** carteiras e universidade, **não tem** kanban/relatórios/WhatsApp atribuído).
- Rotas comercial: `/admin`, `/admin/aprovacoes`, `/admin/parceiros(+/:id/equipes)`, `/admin/rede`, `/admin/propostas(+/:id)`, `/admin/leads/simulacoes`, `/admin/financeiro/carteiras` (leitura; writes já exigem full no backend — ocultar botões de ajuste/bloqueio na UI), `/admin/universidade`, `/admin/prospeccao`.
- Herança automática (guards atuais `app_is_admin()`): aprovar/rejeitar parceiro, leitura de carteiras, leads, propostas. **Não mexer.**
- Edge `admin-invite-internal`: aceitar `p_nivel` validado (`limitado|comercial`, default `limitado`), guard full inalterado.
- `AdminLayout`: item "Prospecção" (ícone/ordem pendentes UX/UI).

### WS-C — UI do funil (PENDENTE)

- Aguarda **print de referência do dono** → especificação do agente **UX/UI** (colunas, card, estados vazio/loading/erro, drag & drop, responsividade, acessibilidade).
- Reutilizar padrões de `PropostasKanban` (componente existente) e tokens Tailwind; nada de biblioteca nova de dnd sem autorização (AGENTS.md §5).

### WS-D — Mobile

- Apenas parser de `admin_nivel` (defesa). Sem tela nova. Flagar contradição: docs citam `mobile/lib/adminScope.ts` e `mobile/app/(admin)/*`, **ausentes no tree** — confirmar se hub admin mobile foi descontinuado.

### Áreas explicitamente NÃO afetadas
Electron/updater; Edge Functions de integração (exceto `admin-invite-internal`); classificador de leads; Serasa; Stripe/carteiras (escrita); tabelas de leads B2C; funil agregado `admin_funil_parceiros`; wizard de proposta (salvo decisão S1).

---

## 5. Prioritized Backlog (issues filhas)

**P0**
1. `DB: migration prospeccoes_parceiro + historico + RLS + view + smoke test` — entidade, constraints, policies read-only e grants.
2. `DB: helpers e admin_set_admin_nivel com nível 'comercial'` — novo helper de escopo comercial; validação estendida; auditoria.
3. `DB: RPCs admin_prospeccao_{create,update,move,arquivar}` — escrita só via RPC, move otimista + histórico + audit_log.
4. `Auth web+mobile: incluir 'comercial' nos parsers de admin_nivel` — corrige fallback→full (obrigatório no mesmo merge da migration).
5. `Web guards: adminScope por nível + rota /admin/prospeccao + item de menu` — allowlist comercial; juridico fora.

**P1**
6. `DB: RPC admin_prospeccao_converter` — após decisão S1 do dono.
7. `Web UI: tela Kanban de prospecção` — **bloqueada** pelo print do dono + spec UX/UI.
8. `Edge admin-invite-internal: aceitar nível` — convite de comercial sem gambiarra em 2 passos.
9. `Web: ocultar ações de escrita em Carteiras/Universidade para comercial` — UI coerente com backend.

**P2**
10. `Detalhe/drawer do card: notas, responsável, proxima_ação_em` — enriquecimento pós-MVP.
11. `Métricas do funil de prospecção no dashboard` — contadores por coluna (separado do `admin_funil_parceiros` legado).
12. `Docs: atualizar 02-roles-permissions, AGENTS.md (novo papel), runbooks` — sincronização obrigatória pré-merge.

---

## 6. Acceptance Criteria

- **AC1 (DB):** migration aplica em banco limpo e em banco com dados; smoke test verde; juridico recebe `forbidden` nas RPCs de prospecção; não-admin não lê a view.
- **AC2 (Nível):** `admin_set_admin_nivel(uid,'comercial')` grava claim e audita; valor inválido rejeita; web e mobile interpretam 'comercial' sem fallback.
- **AC3 (Rotas):** comercial acessa exatamente a allowlist definida; qualquer outra rota `/admin/*` redireciona para `/admin`; deep link direto também bloqueia.
- **AC4 (Funil):** criar card com dados mínimos; mover entre quaisquer colunas registra histórico com autor e timestamp; move com `p_status_esperado` divergente retorna conflito (40001) sem perder dados.
- **AC5 (Conversão):** ao converter, `partner_id` (e `proposta_id`, se aplicável) fica vinculado, invariante de unicidade respeitada, audit_log preenchido.
- **AC6 (Backend authority):** chamada direta de RPC fora do escopo do comercial (ex.: `admin_wallet_ajuste`) retorna `forbidden` mesmo com UI adulterada.
- **AC7 (Checks):** `cd app && npm run lint && npm run typecheck && npm run test && npm run build` verdes, com saída real registrada.

---

## 7. Risks and Mitigations

- **R1 — Fallback→full nos parsers (Crítico):** comercial visto como full na UI. *Mitigação:* issue P0-4 no mesmo merge; teste unitário do sanitizer.
- **R2 — Scope creep via `app_is_admin_operacional()`:** estender operacional p/ comercial abriria financeiro/classificador/fundos. *Mitigação:* helper novo dedicado; `operacional` intocado.
- **R3 — Semântica de "Converter em proposta" ambígua.** *Mitigação:* bloquear issue P1-6 até resposta do dono (S1); conversão como RPC dedicada, não reuso solto.
- **R4 — LGPD:** dados pessoais de prospects sem consentimento de simulador. *Mitigação:* origem/nota de fonte no cadastro, retenção/arquivamento com motivo, acesso restrito a admin; registrar em `security-checklist`.
- **R5 — Colisão conceitual com `admin_funil_parceiros` e com leads B2C.** *Mitigação:* nomenclatura "Prospecção" em todo o surface (rota, tabela, menu, docs).
- **R6 — Rollback:** migration aditiva e forward-safe; rollback = migration nova dropando objetos + remoção da rota/guard; dado histórico preservado até decisão de purge.

## 8. Validation Plan

- Smoke test SQL novo (guards, conflito otimista, RLS por papel, conversão).
- Matriz manual de navegação: 4 níveis × rotas críticas (evidência em screenshots).
- Teste de race: dois admins movendo o mesmo card (um recebe conflito).
- `lint/typecheck/test/build` (app) + `typecheck` (mobile) com saída real; `validate:release` apenas quando houver frente de release (não agora).
- Submeter diff ao **Revisor Mercurio Capital**; Critical/High bloqueiam merge.

## 9. Documentation Updates

- `docs/blueprint/02-roles-permissions.md`: §2.x novo para `comercial` + tabela de telas por nível atualizada.
- `AGENTS.md` §7: registrar novo valor de `admin_nivel` (decisão de papel novo).
- `docs/operacao/runbooks.md` / `security-checklist.md`: operação do funil e tratamento LGPD de prospects.
- `prompts/YYYY-MM-DD-funil-prospeccao-parceiros.md`: persistir este plano após aprovação.

## 10. Next Best Action

**Obter respostas do dono às suposições abaixo → então persistir o plano em `prompts/` e iniciar P0.** Nenhuma implementação antes da aprovação.

**Suposições a confirmar (5 perguntas diretas):**
1. **S1 — "Converter em proposta":** significa (a) disparar convite/cadastro do parceiro (status pending), (b) criar a proposta diretamente pelo admin (parceiro pendente é aceito hoje), ou (c) ambos em sequência? E quem executa: só full/comercial, ou limitado também?
2. **S2 — Negações do comercial:** confirmo que comercial NÃO vê financeiro geral, preços, configurações, feature flags, integrações, fluxos/campanhas/templates, auditoria, milestones, relatórios, kanban de propostas e WhatsApp? Pode disparar Serasa a partir do detalhe da proposta?
3. **S3 — Carteiras:** somente leitura (recomendado, backend já garante) ou também ajuste/bloqueio?
4. **S4 — Outros níveis na nova tela:** full e limitado também acessam o funil de prospecção (recomendado) e juridico fica de fora?
5. **S5 — Atributos do card:** confirmo responsável por card, data de follow-up e arquivamento/perda com motivo obrigatório? (o print de referência deve responder parte disso — favor enviar para o agente UX/UI)