# Plano — Push Web com FCM (Frente A · Issue #8)

**Data:** 2026-11-11 · **Status:** aguardando aprovação do dono (plano + modelo de dados) · **Versão vigente:** 0.3.0 (sem alteração de versão neste plano)

## 1. Objetivo e métrica de sucesso

Ativar notificações push no app web (`app/`) via **Firebase Cloud Messaging (FCM)**, complementando os canais atuais (in-app via Realtime + e-mail via Resend), para os eventos de negócio já existentes (mudança de status, pendência, documento validado, contrato, carteira).

**Métrica de sucesso:** um evento sintético de negócio (pendência criada) gera push entregue em navegador suportado em staging e produção, com opt-out respeitado server-side e flag remota como kill switch. Métrica operacional secundária: % de usuários ativos com token registrado após 30 dias.

## 2. Documentos lidos

- `AGENTS.md` (fluxo, invariantes, precedência)
- `docs/operacao/change-management.md` (mapeamento de impacto, gates)
- `docs/09-roadmap.md` (Fase 12 — push deferido) e `docs/12-finalizacao.md` (§2.2 push web; §4.3 evolução priorizada nº 2)
- `docs/operacao/integracoes-pendentes.md` (WhatsApp/Resend contexto de canais)
- `docs/blueprint/02-roles-permissions.md`, `04-database-schema.md`, `06-modules-features.md`
- `docs/handoffs/16-handoff-fase-fundos-docs.md`, `19-handoff-fase2-financeiro-admin.md`, `20-handoff-fase2-1-dashboard-ui.md` (Electron carrega web via `file://`)
- `docs/operacao/security-checklist.md`, `runbooks.md`

## 3. Código inspecionado

- Pipeline de notificações: triggers em `supabase/migrations/20260518000006_notificacoes_ocr.sql` (insert em `notificacoes` com `canal='in_app'`, `titulo`, `mensagem`, `link`, `metadata`); wallet/contrato em `20260518000010`/`20260518000030`; alertas de etapa em `20261103000001_kanban_stage_age_alerts.sql`.
- Padrão outbox+dispatcher existente: `email_outbox` + `supabase/functions/email-dispatcher` (RPCs pull/marcar, cron 5 min); `whatsapp_mensagens` + `whatsapp-dispatcher`.
- Feature flags: tabela `feature_flags` + RPCs `admin_feature_flag_upsert/_delete` + hook `app/src/hooks/useFeatureFlag.ts` (regras por `roles`, `partner_ids`, `percent`).
- Auth web: `app/src/auth/AuthContext.tsx` (ponto de hook pós-login e logout).
- Páginas com Configurações: `app/src/pages/admin/Configuracoes.tsx`, `app/src/pages/partner/Configuracoes.tsx` (cliente não possui página de configurações — ver §8, UX).
- Edges existentes e `verify_jwt` em `supabase/config.toml`; `integracao-testar` (health em `/admin/integracoes`).
- Smoke tests: sequência até `fase-58`; próximo número livre: **fase-59**.
- Ausência confirmada: nenhum service worker, SDK Firebase ou código de push em `app/`.

## 4. Decisões, contradições e suposições

**Decisões fechadas pelo dono (2026-11-11):**
1. **FCM (Firebase)** — não Web Push puro/VAPID independente.
2. **Electron fora** do push nesta fase (renderer via `file://` não suporta service worker) — degradê documentado, sem regressão.
3. Frente B (homologação) tratada em documento separado: `docs/operacao/homologacao-integracoes-checklist.md`.

**Decisões de arquitetura propostas (a aprovar com o plano):**
4. Fan-out por **outbox + dispatcher**, espelhando o padrão `email_outbox`/`email-dispatcher` já aprovado no repositório — nada de envio síncrono em trigger.
5. Um registro de outbox **por usuário/evento**; o dispatcher expande para os tokens ativos do usuário.
6. Autenticação FCM HTTP v1 com service account: assinatura JWT RS256 via Web Crypto nativo do Deno (`crypto.subtle`), **sem nova dependência Deno**.
7. Kill switch duplo: flag `push_web` em `feature_flags` (cliente + dispatcher verificam) — desliga sem deploy.

**⚠️ Autorização necessária (AGENTS.md §5 — nova biblioteca):**
8. Adicionar dependência npm **`firebase`** (Firebase JS SDK modular) em `app/` para registro de token e service worker. Nenhuma outra dependência nova.

**Contradições reportadas (não resolvidas por suposição):**
9. `12-finalizacao.md §2.2` registra push web como dependente do "setup mobile (Fase 11)" — dependência obsoleta; push web é independente do app mobile. Registrar atualização documental nesta entrega.
10. Marcadores de versão dizem `0.3.0`, mas existe `prompts/2026-11-06-hotfix-updater-runtime-v0-3-1.md` sem rastro de `0.3.1` em `change-management.md`/`package.json` — fora do escopo deste plano; esclarecer antes do próximo release.

**Suposições declaradas:**
11. Projeto Firebase será criado pelo dono; config web Firebase (apiKey, projectId, senderId, appId, VAPID key) é **pública por definição** e pode trafegar em `VITE_*`/bundle; a service account é privada e fica só em secrets da edge.
12. Suporte alvo: Chrome/Edge/Firefox desktop e Android; Safari 16.4+ (macOS) e iOS 16.4+ somente quando o site estiver instalado como PWA — fora deste escopo instalar PWA; Safari/iOS entram como "melhor esforço documentado".

## 5. Impacto por domínio (mapeamento obrigatório)

| Domínio | Impacto |
|---|---|
| Web (`app/`) | **Afetado** — service worker, SDK Firebase, prompt de permissão, preferências, guard Electron. |
| Mobile (`mobile/`) | **Não afetado** — canal de push mobile (Expo Notifications) é separado e futuro. |
| DB/migrations/RLS | **Afetado** — migration aditiva `20261111000001_push_web.sql` (2 tabelas novas + 1 coluna aditiva em `usuarios` + trigger + RPCs + RLS). |
| Edge Functions | **Afetado** — nova edge `push-dispatcher` (`verify_jwt=false`, autenticada por segredo de worker); registro em `supabase/config.toml`. |
| Electron/updater | **Não afetado funcionalmente** — guard de modo desktop impede qualquer inicialização de push; sem mudança de empacotamento. |
| Segurança/compliance | **Afetado** — service account em secrets; RLS nova; opt-out; retenção mínima; sem PII em payload de push (ver §10). |
| Documentação | **Afetada** — runbooks, integracoes-pendentes, security-checklist, roadmap/finalização, novo handoff. |
| Deploy/release | **Não autorizado** — gate separado com go/no-go do dono. |

## 6. Modelo de dados (aprovação conjunta com este plano)

Migration aditiva e forward-safe `supabase/migrations/20261111000001_push_web.sql` (convenções: snake_case pt-BR, `uuid`/`gen_random_uuid()`, `timestamptz default now()`, auditoria `created_at/updated_at/created_by/updated_by`).

### 6.1 `push_subscriptions` (tokens por dispositivo)
| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `usuario_id` | uuid not null | FK `usuarios(id)` on delete cascade |
| `fcm_token` | text not null **unique** | token de registro FCM |
| `plataforma` | text not null default `'web'` | check `in ('web')` (preparado p/ futuro) |
| `user_agent` | text null | diagnóstico |
| `ativo` | boolean not null default `true` | revogação lógica |
| `ultimo_uso_at` | timestamptz null | atualizado no envio/registro |
| auditoria | 4 colunas padrão | |

### 6.2 `push_outbox` (fila de envio; 1 linha por usuário/evento)
| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid pk | |
| `usuario_id` | uuid not null | FK `usuarios(id)` |
| `notificacao_id` | uuid not null **unique** | FK `notificacoes(id)` — garante idempotência (1 push por notificação) |
| `titulo`, `mensagem`, `link` | text | copiados da notificação (link interno, ex.: `/p/propostas/<id>`) |
| `status` | text not null default `'pendente'` | check `('pendente','enviando','enviado','falha','incerto','cancelado')` |
| `tentativas` | int not null default 0 | backoff exponencial, máx. 5 |
| `proxima_tentativa_at` | timestamptz not null default `now()` | |
| `erro` | text null | mensagem mínima, sem payload/PII |
| auditoria | padrão | |

### 6.3 `usuarios.push_opt_out boolean not null default false`
Preferência global do usuário; verificada no enqueue **e** no dispatch.

### 6.4 Trigger e RPCs
- `trg_notificacao_enqueue_push` — `AFTER INSERT ON notificacoes`: se `canal='in_app'`, usuário sem `push_opt_out` e com ≥1 `push_subscriptions.ativo` → insere em `push_outbox` (`on conflict (notificacao_id) do nothing`).
- `push_subscription_upsert(p_fcm_token text, p_user_agent text)` — authenticated; upsert por `fcm_token` (reassocia `usuario_id` em troca de conta no mesmo navegador), `ativo=true`, `ultimo_uso_at=now()`; rejeita token vazio/>4096 chars.
- `push_subscription_revogar(p_fcm_token text)` — authenticated; `ativo=false` apenas se o token pertence ao caller (ou admin).
- `push_preferencia_set(p_opt_out boolean)` — authenticated; atualiza `usuarios.push_opt_out` do caller; ao ligar opt-out, desativa tokens.
- `push_outbox_pull(p_limit int)` / `push_marcar(p_id uuid, p_status text, p_erro text)` — **service_role only** (dispatcher), espelhando `email_outbox_pull/_marcar`; pull faz `for update skip locked`, revalida opt-out e token ativo.
- Limpeza: token que FCM reportar `UNREGISTERED`/`INVALID_ARGUMENT` → `ativo=false` (via `push_marcar` com convenção de erro documentada).

### 6.5 RLS
- `push_subscriptions`: `select/insert/update/delete` somente `usuario_id = auth.uid()`; `select` adicional para `app_is_admin()` (observabilidade). Nenhum acesso anon.
- `push_outbox`: **sem policy para authenticated/anon** (service_role only); `select` admin-only para observabilidade.
- Smoke: `supabase/smoke-tests/fase-59-push-web.sql` (transação com `ROLLBACK`): RLS cruzada negada, upsert/revogação, enqueue idempotente, opt-out bloqueia enqueue, pull/marcar restritos a service_role.

### 6.6 Estratégia de rollback do modelo
Forward-safe: reversão = nova migration aditiva (drop do trigger + tabelas) — somente se aprovada; na prática, rollback operacional é a flag `push_web` (§12/13). Tokens são dados descartáveis (re-registro automático), sem risco de perda.

## 7. Arquivos esperados

**Novos:**
- `supabase/migrations/20261111000001_push_web.sql`
- `supabase/smoke-tests/fase-59-push-web.sql`
- `supabase/functions/push-dispatcher/index.ts` (+ registro em `supabase/config.toml`, `verify_jwt=false` + segredo de worker)
- `supabase/functions/_shared/push-dispatcher.test.mjs` (handler com FCM simulado)
- `app/public/firebase-messaging-sw.js` (estático; config pública via query string do registro)
- `app/src/lib/pushWeb.ts` (suporte, registro, renovação, revogação)
- `app/src/components/PushOptIn.tsx` (prompt contextual)
- `app/src/test/pushWeb.test.ts` (+ teste do componente de preferência)
- `docs/handoffs/21-handoff-push-web.md` (ao concluir)

**Alterados (diff mínimo):**
- `app/package.json` / `package-lock.json` — dependência `firebase` (§4.8)
- `app/src/auth/AuthContext.tsx` — init pós-login / revogação no logout
- `app/src/pages/admin/Configuracoes.tsx`, `app/src/pages/partner/Configuracoes.tsx` — toggle de push; entrada equivalente para cliente (§8)
- `app/src/main.tsx` ou bootstrap — guard `mode !== 'desktop'` e `('serviceWorker' in navigator)`
- `docs/operacao/{runbooks.md,integracoes-pendentes.md,security-checklist.md}`, `docs/12-finalizacao.md`, `docs/09-roadmap.md`

## 8. Requisitos e critérios de aceite

1. **Opt-in contextual:** usuário autenticado (admin/parceiro/assistente) em navegador suportado vê prompt contextual **após primeiro evento de valor** (não no primeiro load); ao aceitar, token registrado via RPC; ao negar, nenhum erro e reativação disponível em Configurações. Cliente recebe a mesma opção em controle simples na Home (`/c`) — especificação visual via agente UX/UI antes da implementação.
2. **Entrega:** evento de negócio existente (pendência criada, `proposta_status_changed`, doc validado, contrato assinado, recarga de carteira) gera push **além** de in-app/e-mail, com deep link interno para a tela correspondente.
3. **Preferências:** opt-out por usuário persiste em `usuarios.push_opt_out` e é verificado **no servidor** no enqueue e no dispatch.
4. **Idempotência:** `push_outbox.notificacao_id` único; mesmo evento nunca gera push duplicado; retentativa com backoff (máx. 5); resultado de rede incerto vira `incerto` **sem reenvio automático** (mesma regra do WhatsApp dispatcher).
5. **Higiene de tokens:** `UNREGISTERED`/token inválido → `ativo=false`; revogação no logout.
6. **Degradê:** Electron (`mode=desktop`), navegador sem service worker e Safari não suportado degradam silenciosamente; nenhuma UI de push aparece.
7. **Flag:** `push_web` em `feature_flags` (via `admin_feature_flag_upsert`) controla cliente (prompt) e dispatcher (envio); desligar a flag interrompe envio sem deploy.
8. **Observabilidade mínima:** contagem por `status` na outbox; sem log de token integral, payload ou PII (máscara de token nos logs).

## 9. Decomposição em issues filhas (rascunho para GitHub, após GO do plano)

1. `push-web: modelo push_subscriptions/push_outbox + RLS + smoke` — migration `20261111000001` + `fase-59-push-web.sql` (transação com rollback).
2. `push-web: edge push-dispatcher (FCM HTTP v1)` — service account em secrets, pull/marcar, backoff, limpeza de tokens, verificação da flag; `deno check` + testes com FCM simulado.
3. `push-web: trigger de fan-out a partir de notificacoes` — enqueue idempotente respeitando opt-out (entrega junto da issue 1 ou separada, conforme revisão do modelo).
4. `push-web: service worker + SDK Firebase no app web` — `firebase-messaging-sw.js`, `lib/pushWeb.ts`, init pós-login, revogação no logout, guard desktop (dependência `firebase` — §4.8).
5. `push-web: UX de permissão e preferências` — prompt contextual + toggles (admin/parceiro Configurações; controle do cliente na Home) com estados negado/não suportado (especificação UX/UI prévia).
6. `push-web: degradê Electron/Safari + documentação operacional` — runbook, security-checklist, integracoes-pendentes, ajuste do §2.2 do 12-finalizacao.
7. `push-web: flag de rollout + evidências de validação` — flag `push_web`, plano de ativação progressiva, evidências em staging/produção (2 navegadores).

## 10. Segurança

- Service account Firebase **somente** em Supabase Edge Secrets (`FCM_SERVICE_ACCOUNT_JSON` ou campos separados) e em `PUSH_WORKER_SECRET` (autenticação do cron no dispatcher); nunca em `VITE_*`, bundle, Git ou chat. Cadastro com entrada silenciosa (`read -s`), conforme padrão Serasa documentado.
- Payload de push **sem dados sensíveis**: título/mensagem genéricos já usados no in-app + link interno que exige autenticação. Nenhum CPF, valor ou nome de cliente no payload.
- RLS como autoridade (§6.5); guards de cliente são apenas UX.
- Dispatcher `verify_jwt=false` + `PUSH_WORKER_SECRET` (mesmo padrão `WHATSAPP_WORKER_SECRET`).
- Privacidade: token FCM é dado pseudônimo de dispositivo; retenção enquanto ativo; LGPD — export/anonimização existentes cobrem `usuarios`; avaliar inclusão de `push_subscriptions` no `lgpd_export_meus_dados` (decisão na implementação; anonimização apaga por cascade via `usuario_id`).

## 11. Testes

**Automáticos (evidência real obrigatória):**
- `cd app && npm run lint && npm run typecheck && npm run test && npm run build`
- `deno check supabase/functions/push-dispatcher/index.ts` + testes do handler (FCM simulado, assinatura inválida de worker, idempotência, backoff, token morto).
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-59-push-web.sql` (local/staging).
- Unit web: guard de suporte/modo desktop, fluxo de registro/revogação (mock do SDK), componente de preferência.

**Manuais (staging, depois produção com GO):**
1. Chrome: opt-in → criar pendência sintética → push recebido → clique abre deep link autenticado.
2. Firefox (ou Safari 16.4+): mesmo fluxo.
3. Opt-out em Configurações → novo evento → ausência de push (in-app/e-mail continuam).
4. Logout → token revogado → novo evento → sem push no dispositivo.
5. Electron desktop: app abre normalmente, nenhuma UI/erro de push.
6. Flag `push_web` off → evento → nada enviado; flag on → retoma.

## 12. Rollout

1. Dono cria projeto Firebase e extrai config web + service account (ação do dono, ~15 min; instruções no runbook).
2. Secrets cadastrados; migration aplicada em janela controlada (dry-run antes); edge publicada com flag `push_web` **inativa**.
3. Frontend publicado (gate separado de release); smoke fase-59 em staging.
4. Ativação progressiva via flag: `roles: ['admin']` → time interno (1–2 dias) → `percent` gradual → 100%.
5. Cron do dispatcher (a cada 1 min) habilitado por último; monitorar outbox por 24h.

## 13. Rollback

1. **Operacional (imediato):** desativar flag `push_web` — cliente para de pedir permissão e dispatcher para de enviar; fila permanece íntegra.
2. **Compatibilidade:** service worker é aditivo; remover do build não invalida tokens já registrados (ficam inativos).
3. **Dados:** sem reescrita de migration; se necessário, migration aditiva de drop com aprovação própria. Não apagar outbox/auditoria durante incidente.

## 14. Fora de escopo

Push mobile (Expo Notifications), PWA/install prompt, campanhas/marketing por push, Electron push nativo, rich push (imagem/ações), analytics de CTR, WhatsApp (frente separada).

## 15. Fronteira de release

Este plano aprovado **não autoriza** tag, deploy Vercel/Supabase, GitHub Release ou publicação. Cada gate exige go/no-go explícito do dono após `docs/operacao/release-checklist.md`. Enquanto não houver GO: **NO-GO**.
