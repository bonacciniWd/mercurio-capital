# Plano — Observações por proposta no Kanban (histórico + prints de comprovação)

**Data:** 2026-11-11 · **Status:** ✅ aprovado pelo dono em 2026-11-11 (plano + modelo de dados); S1–S4 confirmadas (S2 ajustada para 3 anexos) · **Versão vigente:** 0.3.0 (sem alteração de versão neste plano; entra na mesma versão do push web — ver §17)

## 1. Resumo executivo

Adicionar ao card do Kanban (`PropostasKanban.tsx`, componente único com scope `admin`/`partner`) um botão com badge de contagem que abre um modal de timeline de observações internas da proposta: comentários com carimbo imutável da etapa/status no momento da escrita, anexos de comprovação (prints) em bucket privado com signed URL ≤ 5 min, janela de edição de 15 min validada server-side, soft delete com trilha para admin, e notificação in-app aos envolvidos internos — com push "de graça" via fan-out já entregue na Frente A (`trg_notificacao_enqueue_push`, migration `20261111000001_push_web.sql`). Cliente **nunca** vê: sem policy, sem RPC, sem rota, sem notificação para papel `client`. Backend 100% novo e aditivo (1 migration + 1 smoke fase-60); frontend é diff mínimo no componente do Kanban + 3 arquivos novos. Nenhuma Edge Function nova.

## 2. Objetivo e métrica de sucesso

**Objetivo:** permitir que admin e parceiro/assistente dono da proposta registrem contexto operacional (ex.: print de erro que bloqueia a proposta) diretamente no card do Kanban, com histórico contínuo marcado por etapa, eliminando dependência de WhatsApp/caderno para rastreabilidade interna.

**Métrica de sucesso:** em staging, admin anexa um print e comenta no card na etapa X; o card é movido para a etapa Y; o parceiro dono abre o modal e vê o comentário marcado com a etapa X e o horário original; o parceiro recebe notificação in-app (e push, se opt-in) em ≤ 1 min; usuário cliente autenticado e protocolo público não enxergam nenhum traço do recurso (validado por smoke negativo).

## 3. Documentos lidos

- `AGENTS.md` (fluxo §3, convenções §5, invariantes §6, modelo §8, armadilhas §10, checks §11, release boundary §12)
- `docs/operacao/change-management.md` (mapeamento de impacto, gates, precedência)
- `docs/operacao/security-checklist.md` — **A02**: buckets de documentos com signed URL TTL ≤ 5 min (padrão adotado aqui)
- `docs/handoffs/21-handoff-push-web.md` e `prompts/2026-11-11-push-web-fcm.md` (modelo de push recém-entregue; formato deste plano)
- `docs/blueprint/02-roles-permissions.md`, `04-database-schema.md` (papéis e convenções de schema)
- Nenhuma menção a "observações no Kanban" em `docs/09-roadmap.md` / `docs/12-finalizacao.md` — feature nova, sem contradição registrada nessas fontes.

## 4. Código inspecionado

- `app/src/components/PropostasKanban.tsx` — componente único `{ scope: 'admin' | 'partner' }`; RPCs `admin_list_propostas` / `partner_list_kanban_propostas`; card renderizado em `KanbanCardView` (linha ~582) com footer (`border-t … PRODUTO_LABEL`) como local do botão; padrão `onPointerDown={e => e.stopPropagation()}` já usado no `Link` do card (necessário no botão por causa do drag); queries em lote por `proposalIds` (padrão `admin_kanban_etapa_inicio`) a reutilizar para o badge; invalidações via `qc.invalidateQueries`; refetch 45 s + canal Realtime na tabela `propostas`.
- `supabase/migrations/20261111000001_push_web.sql` — trigger `trg_notificacao_enqueue_push`: **todo** insert em `notificacoes` com `canal in ('in_app','push')` enfileira push automaticamente (respeitando opt-out e dispositivo ativo). Padrão estrito de grants: `revoke all … from public, anon, authenticated` + `grant select … to authenticated` + `grant all … to service_role`; RPCs `security definer set search_path = public` com revoke/grant execute explícito por papel.
- `supabase/migrations/20261108000003_cliente_acervo_documental.sql` — padrão de storage privado: `storage.buckets` com `public=false`, `file_size_limit`, `allowed_mime_types`; upload em duas fases (linha `estado='preparado'` validada na policy de insert, janela de 24 h); leitura via helper `security definer` (`cliente_acervo_pode_ler`); policies **restrictive** de delete/update preservando objetos referenciados.
- `supabase/migrations/20260715000002_operational_kanban_rpcs.sql` — escopo parceiro: `v_role in ('partner','team_member')`, `p.partner_id = public.app_partner_id()` ou `p.equipe_id = public.app_equipe_id()`, `app_is_approved()` para partner; `raise exception … errcode '42501'`.
- `supabase/migrations/20261103000001_kanban_stage_age_alerts.sql` — recorte "admins operacionais": `role='admin'` e `raw_app_meta_data->>'admin_nivel' in ('full','limitado')`, `u.ativo`; insert em `notificacoes` com `link` e `metadata jsonb`.
- `supabase/migrations/20260513000006_plataforma.sql` — tabela `notificacoes` (`usuario_id, canal, titulo, mensagem, link, metadata`) e RLS existente (dono lê; admin lê tudo).
- `supabase/migrations/20260513000001_enums.sql` — `proposta_status` (15 valores; `etapa_snapshot` usará esse enum).
- `supabase/migrations/20260518000006_notificacoes_ocr.sql` — padrão de trigger de notificação por evento de proposta.
- `app/src/lib/propostaDocumento.ts` — helper de signed URL com TTL `60 * 5` (A02) e validação de path (sem `/` inicial, sem `..`) — espelhar para anexos.
- `app/src/components/ui/reason-dialog.tsx` — padrão de diálogo com motivo (reuso para remoção admin).
- `app/src/hooks/useFeatureFlag.ts` — mecanismo de flag existente (avaliado em §14).
- Smoke tests: sequência até `fase-59`; próximo livre: **fase-60**. Handoffs: até `21-handoff-push-web.md`; próximo livre: **22**.

## 5. Decisões, contradições e suposições

**Decisões fechadas pelo dono (2026-11-11) — não reabrir:**
1. Visibilidade **interna apenas**: admin + parceiro/assistente dono da proposta; cliente NUNCA vê.
2. Timeline com **carimbo de etapa/status** no momento da escrita (`etapa_snapshot`); ao mover o card, o histórico permanece completo, cada entrada marcada com etapa e momento. **Sem** entradas automáticas de mudança de status nesta versão.
3. Anexos: JPG/PNG/WEBP/HEIC, até **2 MB cada**.
4. Edição: autor edita/apaga nos **primeiros 15 min** (validado server-side); admin remove qualquer comentário a qualquer momento (**soft delete com trilha**).
5. Comentário novo gera notificação **in-app** aos envolvidos; push sai de graça pelo fan-out da Frente A.

**Decisões de arquitetura propostas (a aprovar com o plano):**
6. Upload de anexo em **duas fases** (preparar → upload no storage → vincular no criar), espelhando o acervo documental (`estado='preparado'`, janela 24 h).
7. Escopo de acesso espelha `partner_list_kanban_propostas`: admin (`app_is_admin()`) OU partner aprovado dono (`partner_id = app_partner_id()`) OU team_member da equipe (`equipe_id = app_equipe_id()`). Helper único `proposta_obs_pode_ver(p_proposta_id)` usado por RLS, RPCs e policy de storage.
8. Destinatários da notificação (§7.7): parceiro dono + `responsavel_id` interno (quando houver) + admins operacionais (`admin_nivel in ('full','limitado')`), **sempre exceto o autor** e **nunca o cliente**. Assistentes da equipe não são notificados em massa (ruído).
9. **Sem feature flag dedicada** (avaliação em §14): feature interna, sem dependência externa, rollback barato via revert do web.
10. Contagem do badge via RPC em lote (`proposta_observacao_contagem(p_proposta_ids uuid[])`), mesmo padrão do `admin_kanban_etapa_inicio`; sem canal Realtime novo na v1 (refetch 45 s + invalidação pós-mutação já existentes no Kanban).

**Contradições:** nenhuma encontrada entre as fontes lidas.

**Suposições a confirmar pelo dono (4):**
- **S1.** "EP" interpretado como **HEIC/WEBP** — ✅ confirmado pelo dono.
- ~~**S2.** Limite de 5 anexos por comentário~~ → **confirmado pelo dono em 3 anexos por comentário** (server-side).
- **S3.** **Mobile fora da v1** — ✅ confirmado pelo dono.
- **S4.** Destinatários exatos da notificação conforme item 8 — ✅ confirmado pelo dono.

## 6. Escopo e impacto por domínio

**In scope:** migration + RLS + RPCs + bucket; badge + botão no card (ambos os scopes); modal de timeline (listar/comentar/editar/remover/anexar/visualizar anexo); notificação in-app com fan-out de push; smoke fase-60; testes web; documentação.

**Out of scope:** entradas automáticas de mudança de status na timeline (decisão 2); menções (@), reações, threads; edição/remoção de anexo isolado (anexo nasce e morre com o comentário); mobile; qualquer superfície do cliente (`/c`, protocolo público, e-mails ao cliente); limpeza automática de anexos órfãos (registrado como dívida P2); analytics de uso.

| Domínio | Impacto |
|---|---|
| Web (`app/`) | **Afetado** — botão/badge no card, modal timeline, hook, lib de signed URL, testes. |
| Mobile (`mobile/`) | **Não afetado** (S3) — evolução futura. |
| DB/migrations/RLS | **Afetado** — migration aditiva `20261111000003_proposta_observacoes.sql` (2 tabelas + bucket + helpers + 6 RPCs + RLS de tabela e storage + índices). |
| Edge Functions | **Não afetado** — fan-out de push é trigger já entregue; nenhuma edge nova. |
| Electron/updater | **Não afetado** — desktop consome o web; sem mudança de empacotamento. |
| Segurança/compliance | **Afetado** — novo bucket privado (A02), RLS nova, validação MIME/size server-side, payload de notificação sem trecho do comentário. |
| Documentação | **Afetada** — security-checklist (evidência A02 do novo bucket), runbooks, roadmap/finalização, handoff 22. |
| Deploy/release | **Não autorizado** — gate separado com go/no-go do dono (§17). |

## 7. Modelo de dados (aprovação conjunta com este plano)

Migration aditiva e forward-safe `supabase/migrations/20261111000003_proposta_observacoes.sql` (snake_case pt-BR, `uuid`/`gen_random_uuid()`, `timestamptz default now()`, `set_updated_at()`).

### 7.1 `proposta_observacoes`
| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `proposta_id` | uuid not null | FK `propostas(id)` on delete cascade |
| `autor_id` | uuid not null | FK `usuarios(id)` |
| `autor_papel` | text not null | check `in ('admin','partner','team_member')` — snapshot de `app_user_role()` no insert |
| `corpo` | text not null | check `length(btrim(corpo)) between 1 and 4000` |
| `etapa_snapshot` | `public.proposta_status` not null | carimbo **server-side** de `propostas.status` no insert (nunca do cliente) |
| `editado_em` | timestamptz null | marcado na edição |
| `deleted_at` / `deleted_by` / `deleted_motivo` | timestamptz / uuid FK usuarios / text | soft delete + trilha (decisão 4) |
| `created_at` / `updated_at` | timestamptz not null default `now()` | trigger `set_updated_at` |

Índice: `(proposta_id, created_at desc) where deleted_at is null` (timeline + badge); `(autor_id)`.

### 7.2 `proposta_observacao_anexos`
| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | |
| `observacao_id` | uuid **null** | FK `proposta_observacoes(id)` on delete cascade; null = preparado não vinculado |
| `proposta_id` | uuid not null | FK `propostas(id)` — permite checar acesso na policy de storage mesmo antes do vínculo |
| `bucket` / `storage_path` | text not null | unique `(bucket, storage_path)`; path gerado server-side: `<proposta_id>/<uuid>-<nome sanitizado>` |
| `nome` | text not null | ≤ 200 chars |
| `mime_type` | text not null | check `in ('image/jpeg','image/png','image/webp','image/heic')` |
| `tamanho_bytes` | integer not null | check `> 0 and <= 2097152` (2 MB) |
| `enviado_por` | uuid not null | FK `usuarios(id)` — só o autor vincula |
| `estado` | text not null default `'preparado'` | check `in ('preparado','recebido')` |
| `created_at` | timestamptz not null default `now()` | preparado expira em 24 h |

### 7.3 Storage (padrão acervo + A02)
- `insert into storage.buckets … values ('proposta-obs','proposta-obs', false, 2097152, array['image/jpeg','image/png','image/webp','image/heic'])` — **privado**, limite de 2 MB e allowlist de MIME também no bucket (defesa em profundidade).
- Policy insert (authenticated): objeto só entra se existir linha `preparado` com `bucket_id`/`name` correspondentes, `enviado_por = auth.uid()` e `created_at > now() - interval '24 hours'`.
- Policy select (authenticated): `bucket_id='proposta-obs' and public.proposta_obs_pode_ler(bucket_id, name)`.
- Policies **restrictive** delete/update: bloqueiam remoção/alteração de qualquer objeto referenciado em `proposta_observacao_anexos` (preservação idêntica ao acervo; soft delete do comentário preserva o arquivo para a trilha).
- Leitura pelo cliente web: `createSignedUrl(path, 300)` (TTL ≤ 5 min, A02), via helper `propostaObservacaoAnexo.ts` espelhando `propostaDocumento.ts`.

### 7.4 Helpers (security definer, `set search_path = public`)
- `proposta_obs_pode_ver(p_proposta_id uuid) returns boolean` — item 7 de §5.
- `proposta_obs_pode_ler(p_bucket text, p_path text) returns boolean` — resolve anexo → `proposta_id` → `proposta_obs_pode_ver`; observação soft-deleted só é legível por admin (trilha).

### 7.5 RLS das tabelas (padrão estrito whatsapp/push)
- Ambas: `enable row level security`; `revoke all … from public, anon, authenticated`; `grant select … to authenticated`; `grant all … to service_role`. **Escrita somente via RPCs.**
- Policy select `proposta_observacoes`: `proposta_obs_pode_ver(proposta_id) and (deleted_at is null or public.app_is_admin())` — trilha visível só a admin.
- Policy select anexos: `proposta_obs_pode_ver(proposta_id)` e observação vinculada visível pela regra anterior. Nenhuma policy para papel `client` — default deny.

### 7.6 RPCs (security definer, `search_path = public`; `revoke all` de public/anon/authenticated + `grant execute … to authenticated`)
1. `proposta_obs_anexo_preparar(p_proposta_id uuid, p_nome text, p_mime_type text, p_tamanho_bytes integer) returns table(anexo_id uuid, bucket text, storage_path text)` — valida acesso, MIME/extensão coerentes, tamanho ≤ 2 MB; cria linha `preparado`.
2. `proposta_observacao_criar(p_proposta_id uuid, p_corpo text, p_anexo_ids uuid[] default '{}') returns uuid` — valida acesso + corpo; insere com `etapa_snapshot = status atual da proposta` e `autor_papel = app_user_role()`; vincula anexos (máx. 3 — S2 confirmada) somente se `preparado`, `enviado_por = auth.uid()`, < 24 h e **objeto existente em `storage.objects`**; dispara notificações (§7.7) na mesma transação.
3. `proposta_observacoes_listar(p_proposta_id uuid) returns table(id, autor_id, autor_nome, autor_papel, corpo, etapa_snapshot, editado_em, created_at, anexos jsonb)` — `deleted_at is null`, ordem `created_at desc`; anexos agregados (id, nome, mime_type, tamanho_bytes, storage_path).
4. `proposta_observacao_editar(p_id uuid, p_corpo text)` — somente `autor_id = auth.uid()`, `deleted_at is null` e `created_at > now() - interval '15 minutes'` (**janela server-side**; erro `janela_edicao_expirada`); seta `editado_em`.
5. `proposta_observacao_remover(p_id uuid, p_motivo text default null)` — autor dentro da janela de 15 min **ou** `app_is_admin()` a qualquer momento; soft delete com `deleted_by`/`deleted_motivo`.
6. `proposta_observacao_contagem(p_proposta_ids uuid[]) returns table(proposta_id uuid, total bigint)` — badge; exclui soft-deleted; filtra por `proposta_obs_pode_ver`.

### 7.7 Notificações (dentro de `proposta_observacao_criar`)
Insert em `notificacoes` (`canal 'in_app'`) para: parceiro dono (`partners.usuario_id`), `propostas.responsavel_id` quando não nulo, e admins operacionais (`role='admin'`, `admin_nivel in ('full','limitado')`, `ativo`) — **exceto `auth.uid()`; nunca cliente**. Título: `Nova observação na proposta <protocolo>`; mensagem **sem trecho do comentário**: `<primeiro_nome> registrou uma observação na etapa <etapa_label>.` (push aparece em lock screen — §11); `link` por papel (`/admin/propostas/<id>` ou `/p/propostas/<id>`); `metadata`: `tipo='proposta_observacao_nova'`, `proposta_id`, `observacao_id`, `etapa_snapshot`. O trigger `trg_notificacao_enqueue_push` (Frente A) enfileira o push automaticamente — **zero código adicional**.

### 7.8 Smoke `supabase/smoke-tests/fase-60-proposta-observacoes.sql`
Transação com `ROLLBACK`: RLS cruzada negada (parceiro de outra proposta; team_member de outra equipe; **cliente da própria proposta**); criar/listar/editar dentro da janela; edição fora da janela negada (created_at forçado); remoção por autor na janela e por admin fora dela com trilha (`deleted_by`/`deleted_motivo`); MIME inválido e > 2 MB negados no preparar; vínculo de anexo alheio/expirado negado; insert direto em storage sem `preparado` negado; select de storage por usuário fora do escopo negado; notificação criada para parceiro+admins e **não** para cliente nem autor; `push_outbox` populada via trigger quando há dispositivo ativo; contagem em lote exclui soft-deleted.

### 7.9 Rollback do modelo
Sem reescrita de migration: reversão estrutural exigiria nova migration aditiva com aprovação própria. Na prática, rollback é operacional (§14): revert do web deixa RPCs inertes e dados íntegros.

## 8. Arquivos esperados

**Novos:**
- `supabase/migrations/20261111000003_proposta_observacoes.sql`
- `supabase/smoke-tests/fase-60-proposta-observacoes.sql`
- `app/src/hooks/usePropostaObservacoes.ts` (listar/criar/editar/remover + contagem em lote)
- `app/src/components/PropostaObservacoesModal.tsx` (timeline + composer + anexos)
- `app/src/components/PropostaObservacoesButton.tsx` (botão + badge, com `stopPropagation` no pointer down)
- `app/src/lib/propostaObservacaoAnexo.ts` (signed URL TTL 300 s + validação de path — espelha `propostaDocumento.ts`)
- `app/src/test/propostaObservacoes.test.tsx` (+ teste do hook/lib)
- `docs/handoffs/22-handoff-observacoes-kanban.md` (ao concluir)

**Alterados (diff mínimo):**
- `app/src/components/PropostasKanban.tsx` — botão no card, query de contagem por `proposalIds`, estado do modal, invalidações.
- `docs/operacao/security-checklist.md` (evidência A02 para `proposta-obs`), `docs/operacao/runbooks.md` (seção curta de operação/retenção), `docs/09-roadmap.md`, `docs/12-finalizacao.md` (registro da entrega).

## 9. Requisitos e critérios de aceite

1. **Visibilidade:** admin e parceiro/assistente dono veem botão, badge e timeline; cliente autenticado e protocolo público não veem nada (UI + RLS + smoke negativo).
2. **Carimbo de etapa:** cada comentário exibe etapa (label pt-BR do enum) e timestamp do momento da escrita; mover o card não altera nem oculta entradas anteriores.
3. **Anexos:** JPG/PNG/WEBP/HEIC ≤ 2 MB (S1), máx. 3 por comentário (S2); upload em duas fases; visualização só via signed URL ≤ 5 min; HEIC sem preview inline renderiza fallback (ícone + "abrir em nova aba" — spec UX/UI).
4. **Janela de edição:** autor edita/apaga até 15 min (relógio do servidor); após a janela, ações de edição somem da UI e a RPC nega com `janela_edicao_expirada`; admin remove qualquer comentário a qualquer momento com motivo registrado; removidos saem da timeline e do badge, mas permanecem com trilha legível por admin.
5. **Notificação:** comentário novo notifica exatamente o recorte de §7.7 (S4), sem notificar o autor; com push entregue quando o usuário tem opt-in (Frente A ativa); mensagem sem trecho do comentário.
6. **Badge:** contagem por card reflete comentários ativos; atualiza após mutações e no ciclo de 45 s do Kanban.
7. **Drag & drop:** botão não interfere no arraste do card (`stopPropagation`).
8. **Zero regressão:** `npm run lint && npm run typecheck && npm run test && npm run build` verdes em `app/`; smoke fase-60 verde; `npm run validate:release` verde.

## 10. Plano de entrega por workstream e backlog priorizado (issues filhas — rascunho para GitHub, após GO do plano)

**WS-DB (P0):**
1. `obs-kanban: modelo proposta_observacoes + anexos + bucket + RLS` — migration `20261111000003` com helpers, policies de tabela e storage, índices.
2. `obs-kanban: RPCs CRUD (janela 15 min, soft delete admin, contagem em lote)` — 6 RPCs com revokes/grants no padrão estrito.
3. `obs-kanban: notificação in_app aos envolvidos (fan-out push automático)` — insert em `notificacoes` dentro da RPC de criação + smoke fase-60 cobrindo tudo.

**WS-Web (P1):**
4. `obs-kanban: hook usePropostaObservacoes + lib de signed URL (TTL 300s)` — camada de dados e anexo.
5. `obs-kanban: botão no card com badge + modal timeline` — **somente após spec do agente UX/UI**; scopes admin/partner no componente único.
6. `obs-kanban: upload de prints (preparar→upload→vincular) com estados de erro` — UI do composer + retry.

**WS-Qualidade/Docs (P1/P2):**
7. `obs-kanban: testes web + smoke fase-60 + evidências` — unit do hook/lib/modal + saída real dos checks.
8. `obs-kanban: docs operacionais + handoff 22` — security-checklist A02, runbooks, roadmap/finalização.
9. (P2, dívida registrada) `obs-kanban: limpeza de anexos preparados órfãos (>24h)` — job/manual; não bloqueia v1.

## 11. Segurança

- RLS e RPCs são a autoridade; guards de cliente são UX. Nenhuma policy beneficia papel `client`; cliente sem vínculo de proposta não alcança tabela, RPC (helper nega, `errcode 42501`) nem objeto de storage.
- MIME e tamanho validados **server-side** (RPC + check constraints) e reforçados no bucket; extensão deve ser coerente com o MIME; allowlist **não** é afrouxada para browsers que reportam HEIC incorretamente (mitigação em §15).
- Signed URL com TTL **300 s** (A02); path validado (sem `/` inicial, sem `..`); bucket privado; objetos preservados por policies restrictive.
- Payload de notificação/push **sem trecho do comentário, sem valores, sem dados do cliente** — apenas protocolo, primeiro nome do autor e etapa (lock screen segura).
- Grants no padrão estrito (revoke de public/anon/authenticated; select a authenticated; service_role full); RPCs com revoke/grant execute explícitos.
- LGPD: dados vinculados a `proposta_id`/`usuarios(id)`; anonimização/export existentes cobrem `usuarios`; observações seguem o ciclo de vida da proposta (cascade).

## 12. UX (agente UX/UI acionado ANTES da implementação visual)

Especificação pendente do agente UX/UI, com estes requisitos de entrada: botão discreto no footer do card (ícone de comentário + badge de contagem, oculto quando zero), `aria-label` com contagem; modal com header (protocolo + cliente), timeline vertical (autor, papel, chip de etapa, timestamp relativo + absoluto, indicador "editado", thumbnails de anexo), composer (textarea com contador 4000, botão anexar com validação imediata de tipo/tamanho, estados de envio/erro), estados vazio/loading/erro, ações editar/apagar visíveis só dentro da janela (com indicação do tempo restante), remoção admin reutilizando `ui/reason-dialog`. Sem mudança de cores/tipografia/espaçamento fora do design system existente.

## 13. Testes (plano de validação)

**Automáticos (evidência real obrigatória):**
- `cd app && npm run lint && npm run typecheck && npm run test && npm run build`
- `cd app && npm run validate:release`
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-60-proposta-observacoes.sql`
- Unit web: hook (mutações, invalidações, contagem), lib de signed URL (path inválido, TTL 300), modal (janela de edição na UI, estados), botão (badge, stopPropagation).

**Manuais (staging; produção só após GO):**
1. Admin comenta com print PNG no card → parceiro dono recebe in-app (+ push com opt-in) → abre modal pelo link e vê entrada com etapa carimbada.
2. Mover o card de etapa → entrada anterior mantém etapa original; nova entrada carimba a nova etapa.
3. Assistente da equipe comenta; parceiro de **outra** operação não vê nada.
4. Cliente autenticado (`/c`) e protocolo público: nenhum traço do recurso.
5. Edição dentro de 15 min OK; aos 16 min a UI some a ação e a RPC nega.
6. Admin remove comentário alheio com motivo → some da timeline/badge; trilha visível a admin.
7. Upload HEIC real de iPhone; upload > 2 MB e PDF negados com mensagem clara.
8. Abrir anexo: URL assinada funciona; após 5 min expira; regenerar funciona.

## 14. Rollout

1. **Feature flag: não recomendada** — feature interna, sem dependência externa, risco baixo e revert barato (diferente do push web, que dependia de FCM e rollout progressivo). Se o dono preferir cautela, reuso de `feature_flags` com chave `kanban_observacoes` é viável sem custo de arquitetura — **decisão a confirmar com o plano**.
2. Migration aplicada em staging → smoke fase-60 → merge do web → validação manual (admin + parceiro) em staging.
3. Produção: entra na **mesma versão do push web**; SemVer `minor` na próxima versão; migration em janela controlada com dry-run.

## 15. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Browser reporta HEIC com MIME inconsistente | Validação extensão+MIME server-side; allowlist não afrouxada; mensagem orientando converter para JPG; teste manual com arquivo real (§13.7); preview inline com fallback. |
| Vazamento ao cliente | Default deny; sem policy/RPC/rota para `client`; smoke negativo explícito (cliente da própria proposta); payload de push sem conteúdo. |
| Comentário sensível na lock screen | Mensagem de notificação genérica (sem trecho) — §7.7. |
| Anexos órfãos (`preparado` não vinculado) acumulam | Objetos ficam inacessíveis após 24 h (policy expira); limpeza registrada como dívida P2 (issue 9). |
| Badge com 500 propostas | Contagem em lote única por board (padrão `admin_kanban_etapa_inicio`) + índice parcial; sem N+1. |
| Botão quebra drag do card | `onPointerDown` com `stopPropagation` (padrão já usado no `Link` do card) + teste. |
| Contagem desatualizada após comentar em outra aba | Refetch de 45 s + `refetchOnWindowFocus` já existentes; Realtime dedicado fica fora da v1 (item 10 de §5). |
| Conflito com trabalho em andamento na working tree (armadilha §10 do AGENTS.md) | Commit apenas dos arquivos desta frente; diff mínimo no `PropostasKanban.tsx`. |

## 16. Atualizações de documentação

- `docs/operacao/security-checklist.md` — evidência A02 para bucket `proposta-obs` (privado, TTL 300 s).
- `docs/operacao/runbooks.md` — seção curta: visibilidade interna, retenção de anexos, dívida de órfãos.
- `docs/09-roadmap.md` / `docs/12-finalizacao.md` — registro da entrega.
- `docs/handoffs/22-handoff-observacoes-kanban.md` — ao concluir.
- `TRACKER.md` — se em uso pela frente atual.

## 17. Fronteira de release e próxima melhor ação

Este plano aprovado **não autoriza** tag, deploy Vercel/Supabase, GitHub Release ou publicação. A feature **entra na mesma versão do push web**, e o release permanece **NO-GO até GO explícito do dono**, após `docs/operacao/release-checklist.md`.

