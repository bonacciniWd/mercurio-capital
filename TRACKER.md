# Tracker — Mercúrio Capital

Visão resumida do trabalho em aberto. **O sistema oficial é o GitHub Issues** —
este espelho existe para leitura rápida e deve ser atualizado junto com elas.

## Como funciona

- Cada frente de trabalho tem uma issue em
  [bonacciniWd/mercurio-capital/issues](https://github.com/bonacciniWd/mercurio-capital/issues).
- Commits referenciam issues (`refs #N` ou `closes #N` quando a issue é concluída).
- Mudanças funcionais seguem o `AGENTS.md`: plano em `prompts/` + aprovação do dono antes de implementar.
- Releases (tags, deploys, EAS build/submit, submissão Apple) exigem go/no-go explícito do dono.

**Legenda:** ⚪ pendente · 🟡 em andamento · 🔴 bloqueada · 🟢 concluída

## App Store (submissão iOS)

| Issue | Item | Status | Notas |
|---|---|---|---|
| #2 | Preencher placeholders de submissão | ⚪ | Só o dono: contato App Review + conta demo |
| #3 | Screenshots iPad 13" (2064×2752) | 🟢 | 3 telas em `screenshots/ios/ipad-13/`; commit `10dd7f6` fecha a issue |
| #4 | Decisões ⚖️ (nome, países, versão) | ⚪ | Dono decide; registrar em `screenshots/app-store-connect.md` |
| #5 | Submeter build para App Review | 🔴 | Bloqueada por #2, #3, #4. Go/no-go do dono |

Feito: screenshots iPhone 6.9" (1320×2868) de onboarding, login e recuperar-senha
em `screenshots/ios/6.9/`; textos e campos completos em `screenshots/app-store-connect.md`.

## Mobile

| Issue | Item | Status | Notas |
|---|---|---|---|
| #6 | Contraste quebrado em "Recuperar acesso" | 🟢 | Fix commitado em `fba022b` (mobile v0.0.2); build 13 ainda tem o bug → decisão de build 14 pendente |
| #9 | Validar área do parceiro (Configurações) no aparelho | ⚪ | Roles admin e membro |

## Web

| Issue | Item | Status | Notas |
|---|---|---|---|
| #8 | Nova frente no projeto `/app` | 🟢 | Frente A = Push Web (FCM); plano `prompts/2026-11-11-push-web-fcm.md` aprovado (modelo de dados + dep `firebase` incluídos) |
| #10 | push-web: modelo push_devices/push_outbox + RLS + smoke | 🟢 | `ee3d42f`; reutilizou `push_devices` (decisão do dono); smokes fase-59 verdes em Supabase local |
| #12 | push-web: trigger de fan-out a partir de notificacoes | 🟢 | Entregue junto da #10 (`ee3d42f`), conforme §9 do plano |
| #11 | push-web: edge push-dispatcher (FCM HTTP v1) | 🟢 | `29aadaf`; 31/31 testes, deno check limpo; deploy aguarda GO + secrets FCM |
| #13 | push-web: service worker + SDK Firebase no app web | 🟢 | `b684535`; payload data-only após revisão; 7/7 testes; falhas da suite são pré-existentes (#17 e adminLeads) |
| #14 | push-web: UX de permissão e preferências | 🟢 | `deab1ab`; spec UX/UI aprovada pelo dono; 20/20 testes; M-1 do Revisor corrigido |
| #15 | push-web: degradê Electron/Safari + docs operacionais | 🟢 | `fa28d48`+`c4c7297`; runbook §17, handoff 21, .env.example versionado |
| #16 | push-web: flag de rollout + evidências | 🟡 | `a0bf2de`: flag nasce off + rollout 4 etapas + checklist de staging; evidências bloqueadas no projeto Firebase (dono) + GO de deploy |

## Repositório

| Issue | Item | Status | Notas |
|---|---|---|---|
| #7 | Organizar ~235 arquivos não commitados | 🟢 | 10 commits temáticos (`9dd9c26`…`10dd7f6`) + rebase sobre release v0.3.0; working tree limpo; fecha #3 e #6 via mensagens |

---
Atualizado em 2026-11-12.

## Observações no Kanban (nova feature — mesma release do push web)

| Issue | Item | Status | Notas |
|---|---|---|---|
| #18 | obs-kanban: modelo + anexos + bucket + RLS | 🟢 | `25dc41a`; migration `20261111000003`; escopo = Kanban vigente (com aprovação e responsável) |
| #19 | obs-kanban: RPCs CRUD | 🟢 | `25dc41a`; janela 15 min server-side; motivo admin obrigatório; contagem ≤2000 |
| #20 | obs-kanban: notificação in_app + fan-out push | 🟢 | `25dc41a`; link por papel real; sem trecho do comentário |
| #21 | obs-kanban: hook + signed URL | 🟢 | `c7587c6`; 9 testes; refetch 45s real (M1 do Revisor) |
| #22 | obs-kanban: botão no card + modal timeline | 🟢 | `1f3f00b`; spec UX/UI aprovada; 9 testes; M1+L1-L5 do Revisor corrigidos |
| #27 | obs-kanban: dashboard fundos + timeline reconciliada | 🟢 | `c923f08`; delta aprovado; 12 testes; H1/M1/L1 do Revisor corrigidos |
| #23 | obs-kanban: upload de prints (2 fases) | 🟢 | `2922d29`; maioria entregue em #22/#27 (composer); delta: retry + L1-L3 do Revisor |
| #24 | obs-kanban: testes web + evidências | 🟢 | `7f3a427`; 23/23 novos; suite 285/299 (14 pré-existentes); validate:release OK; fase-60 verde |
| #25 | obs-kanban: docs + handoff 22 | 🟢 | handoff 22 + runbooks §18 + checklist A02 + roadmap/finalização |
| #26 | obs-kanban: limpeza de anexos órfãos | ⚪ | Dívida P2, não bloqueia v1 |

## Funil comercial de prospecção de parceiros + admin_comercial (nova frente)

Plano aprovado: `prompts/2026-11-12-funil-prospeccao-parceiros.md`. Entidade nova `prospeccoes_parceiro`; `admin_nivel='comercial'` (não é role nova). 🔴 Fix obrigatório no mesmo merge: fallback admin_nivel→full nos parsers (#31).

| Issue | Item | Status | Notas |
|---|---|---|---|
| #28 | prospeccao: modelo + histórico + RLS + view + smoke | ⚪ | P0 DB |
| #29 | prospeccao: helper escopo comercial + nível | ⚪ | P0 DB |
| #30 | prospeccao: RPCs create/update/move/arquivar | ⚪ | P0 DB |
| #31 | auth: parsers admin_nivel comercial (web+mobile) | ⚪ | P0 — 🔴 crítico (fallback→full) |
| #32 | prospeccao: guards por nível + rota + menu | ⚪ | P0 web |
| #33 | prospeccao: RPC converter (cria proposta via wizard) | ⚪ | P1 — S1 confirmada |
| #34 | prospeccao: UI Kanban de prospecção | 🔴 | Bloqueada pelo print do dono + UX/UI |
| #35 | auth: admin-invite-internal aceita comercial | ⚪ | P1 |
| #36 | prospeccao: ocultar escrita em Carteiras/Universidade | ⚪ | P1 |
| #37 | prospeccao: drawer + métricas + docs | ⚪ | P2 |
