# Handoff — Frente A: Push Web (FCM)

Data: 2026-11-11 · Plano aprovado: `prompts/2026-11-11-push-web-fcm.md` · Issues: #10, #11, #12, #13, #14, #15 (esta), #16 (pendente)

## Entrega local (merge em `main`, sem deploy)

- **Modelo (migration `20261111000001_push_web.sql`):** `push_devices` estendida (`ativo`, `user_agent`, auditoria) — reutilizada por decisão do dono (o plano rascunhava `push_subscriptions`; drift registrado aqui); `push_outbox` nova (fila idempotente, `notificacao_id` único, backoff exponencial, sweeper de `enviando` órfãos, `falha` terminal após 5 tentativas); `usuarios.push_opt_out`; trigger de fan-out a partir de `notificacoes` (canal `in_app`/`push`); RPCs de dispositivo/preferência (`authenticated`) e de dispatcher (`service_role`), revogas estritas `public, anon, authenticated`.
- **Edge `push-dispatcher`:** FCM HTTP v1 — OAuth2 de service account (JWT RS256 WebCrypto, cache ~1h) **antes** do pull; classificação de erro FCM (token morto → `push_device_desativar`; `incerto` sem reenvio automático, com precedência sobre `retry`); flag `push_web` fail-closed; `PUSH_WORKER_SECRET` por digest; `verify_jwt=false` documentado; nada de token/PII em logs.
- **Web:** `firebase@13.3.0` (pin exato, autorizado no plano); `firebase-messaging-sw.js` estático com config pública via query string; payload **data-only** (evita toast duplicado SDK+SW — achado High da revisão); `lib/pushWeb.ts` com degradê silencioso (Electron por `file://`/UA/`mode desktop`, navegador sem APIs, sem `VITE_FIREBASE_*`); init silencioso idempotente pós-login; revogação com timeout de 4s antes do signOut.
- **UX (spec do agente UX/UI, aprovada pelo dono):** banner contextual staff (2ª sessão, janela 12h; dismiss 14d, máx. 3; `never` após resposta nativa) nos layouts admin/parceiro; seção "Notificações push neste navegador" em Configurações (B1 ativo / B2 desligado / B3 nunca perguntado / B4 negado com instruções por navegador e sem CTA); toggle mestre (`push_opt_out`) com gravação imediata e coluna Push da matriz por evento desabilitada quando off; cartão único do cliente na `/c`; guard P-4 (desativar durável por navegador, `localStorage` por usuário).
- **Docs:** runbook §17 (ativação, diagnóstico, estados, rotação, métricas), security-checklist (A02/A05), `integracoes-pendentes.md`, `12-finalizacao.md` §2.2, `09-roadmap.md` Fase 12, `app/.env.example` (novo — documenta as 5 `VITE_FIREBASE_*` públicas).

## Banco

- Migration **NÃO aplicada no remoto** — deploy Supabase aguarda GO explícito do dono (fronteira de release mantida).
- `supabase db reset` local do zero: 60+ migrations aplicam sem erro, incluindo a nova.
- Smoke `fase-59-push-web.sql` (estrutural, read-only): **OK**. `fase-59-push-web-transacional.sql` (13 verificações, ROLLBACK, zero resíduo): **OK** — cobre upsert/revogação, fan-out `in_app`/`push`, bloqueio por opt-out, higiene no pull, backoff, sweeper, estado terminal, limpeza de token, ACLs.
- ACLs conferidas no catálogo: dispatcher = só `service_role`; dispositivo/preferência = `authenticated`; trigger sem grant.

## Validações

- Edge: `node --test supabase/functions/_shared/*.test.mjs` → **32/32** (11 novos, FCM 100% simulado com chave RSA gerada em runtime e JWT verificado de verdade); `deno check push-dispatcher/index.ts` limpo.
- Web: **20/20** testes da feature (7 infra + 13 UX); `npm run lint` 0 erros/33 warnings (= baseline exato medido com stash); `npm run typecheck` limpo; `npm run build` OK (SW + ícone no `dist/`).
- Revisor (3 rodadas): #10/#12 sem bloqueantes (3 Low corrigidos na hora); #11 — 1 High (OAuth antes do pull) + M/Lows corrigidos; #13 — 1 High (payload duplicado → data-only) + Lows corrigidos; #14 — 1 Medium (falso sucesso no cartão do cliente) + Lows corrigidos.

## Residuais conhecidos (não bloqueantes)

- **L-1 (#14):** com opt-out global ligado, o init silencioso re-registra o token no próximo login. Entrega permanece bloqueada no servidor (enqueue + dispatch revalidam) — drift de higiene, não de entrega. Se incomodar: follow-up para `initPushWeb` consultar `push_opt_out`.
- **Reset de senha** faz `signOut` sem revogar o token (cobertura parcial por natureza; payload sem PII mitiga).
- **Suite web completa:** 14 falhas pré-existentes em `adminLeadsSimulacoes.test.tsx` (confirmadas no baseline sem o diff) e flakiness de `publicAmortizationSimulator.test.tsx` sob carga (passa isolado) — merecem issue própria.
- **Issue #17 aberta:** RPCs legadas (`email_outbox_pull/_marcar`) com EXECUTE exposto a `anon` (padrão de revogação antigo insuficiente) — descoberta durante a #10, aguardando priorização.

## Pendências de ativação (não-código, gate do dono)

1. Criar projeto Firebase (console, ~15 min) e copiar config pública + chave VAPID.
2. `VITE_FIREBASE_*` no ambiente web (Vercel + `.env.local`).
3. Secrets `FCM_SERVICE_ACCOUNT_JSON` + `PUSH_WORKER_SECRET` (entrada silenciosa — roteiro no runbook §17).
4. Deploy: migration no remoto + `supabase functions deploy push-dispatcher --no-verify-jwt`.
5. Flag `push_web` (rollout gradual via `regras`) + cron a cada 5 min.
6. Evidências em staging com 2 navegadores (issue #16) antes de produção.

## Fora de escopo (frentes futuras)

- Push mobile (Expo Notifications) — app iOS está em submissão App Store; canal separado.
- PWA/install prompt, rich push, campanhas por push, analytics de opt-in/CTR.
