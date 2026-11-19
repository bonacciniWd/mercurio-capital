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

## Situação atual — 2026-11-19

Validação do dono: todas as entregas validadas, exceto **#16**, que permanece
em andamento. A nova frente desktop/web #39 está em publicação; #16 permanece em andamento.
Submissão à App Review concluída; isso não significa aprovação da Apple.

## Desktop e frontend

| Issue | Item | Status | Notas |
|---|---|---|---|
| #39 | Release 0.3.2: BRL, updater e quatro alvos desktop | 🟡 | GO de publicação em 19/11; 16 assets validados; publicação e conferência pública em andamento |

## App Store (submissão iOS)

| Issue | Item | Status | Notas |
|---|---|---|---|
| #2 | Preencher placeholders de submissão | 🟢 | Validado pelo dono; issue fechada em 18/11 |
| #3 | Screenshots iPad 13" (2064×2752) | 🟢 | 3 telas em `screenshots/ios/ipad-13/`; commit `10dd7f6` fecha a issue |
| #4 | Decisões ⚖️ (nome, países, versão) | 🟢 | Definidas pelo dono; issue fechada em 18/11 |
| #5 | Submeter build para App Review | 🟢 | App enviado para revisão, confirmado pelo dono; issue fechada em 18/11 |

Feito: screenshots iPhone 6.9" (1320×2868) de onboarding, login e recuperar-senha
em `screenshots/ios/6.9/`; textos e campos completos em `screenshots/app-store-connect.md`.

## Mobile

| Issue | Item | Status | Notas |
|---|---|---|---|
| #6 | Contraste quebrado em "Recuperar acesso" | 🟢 | Correção validada pelo dono; issue fechada |
| #9 | Validar área do parceiro (Configurações) no aparelho | 🟢 | Validado no mobile pelo dono; issue fechada em 16/11 |

## Web

| Issue | Item | Status | Notas |
|---|---|---|---|
| #8 | Nova frente no projeto `/app` | 🟢 | Frente A = Push Web (FCM); plano `prompts/2026-11-11-push-web-fcm.md` aprovado (modelo de dados + dep `firebase` incluídos) |
| #10 | push-web: modelo push_devices/push_outbox + RLS + smoke | 🟢 | `ee3d42f`; reutilizou `push_devices` (decisão do dono); smokes fase-59 verdes em Supabase local |
| #12 | push-web: trigger de fan-out a partir de notificacoes | 🟢 | Entregue junto da #10 (`ee3d42f`), conforme §9 do plano |
| #11 | push-web: edge push-dispatcher (FCM HTTP v1) | 🟢 | Implementação entregue; configuração e publicação executadas; acompanhamento do rollout em #16 |
| #13 | push-web: service worker + SDK Firebase no app web | 🟢 | `b684535`; payload data-only após revisão; 7/7 testes; falhas da suite são pré-existentes (#17 e adminLeads) |
| #14 | push-web: UX de permissão e preferências | 🟢 | `deab1ab`; spec UX/UI aprovada pelo dono; 20/20 testes; M-1 do Revisor corrigido |
| #15 | push-web: degradê Electron/Safari + docs operacionais | 🟢 | `fa28d48`+`c4c7297`; runbook §17, handoff 21, .env.example versionado |
| #16 | push-web: flag de rollout + evidências | 🟡 | Única issue aberta. Mantida pendente por orientação do dono em 19/11; evidências em `docs/operacao/push-web-rollout-evidencias.md`. Validação local e produção, sem projeto Supabase de staging |

## Repositório

| Issue | Item | Status | Notas |
|---|---|---|---|
| #7 | Organizar ~235 arquivos não commitados | 🟢 | 10 commits temáticos (`9dd9c26`…`10dd7f6`) + rebase sobre release v0.3.0; working tree limpo; fecha #3 e #6 via mensagens |

---
Atualizado em 2026-11-19; status conferidos diretamente no GitHub.

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
| #26 | obs-kanban: limpeza de anexos órfãos | 🟢 | Entregue e validado; issue fechada em 17/11 |

## Funil comercial de prospecção de parceiros + admin_comercial (nova frente)

Plano aprovado: `prompts/2026-11-12-funil-prospeccao-parceiros.md`. Entidade nova `prospeccoes_parceiro`; `admin_nivel='comercial'` (não é role nova). Fallback admin_nivel→full corrigido nos parsers (#31 concluída).

| Issue | Item | Status | Notas |
|---|---|---|---|
| #28 | prospeccao: modelo + histórico + RLS + view + smoke | 🟢 | `4120fa1` |
| #29 | prospeccao: helper escopo comercial + nível | 🟢 | `4120fa1` |
| #30 | prospeccao: RPCs create/update/move/arquivar | 🟢 | `4120fa1`; move otimista 40001 |
| #31 | auth: parsers admin_nivel comercial (web+mobile) | 🟢 | `4120fa1`; fallback corrigido + teste |
| #32 | prospeccao: guards por nível + rota + menu | 🟢 | `4120fa1`; +H1 Serasa endurecida, +H2 limitado na prospecção, +M1 case-bypass |
| #33 | prospeccao: RPC converter (cria proposta via wizard) | 🟢 | `e8141ca`; elevação local do claim; guard comercial+full |
| #34 | prospeccao: UI Kanban de prospecção | 🟢 | `fbcf3a3`; tela completa; 16 testes; Revisor sem bloqueantes |
| #35 | auth: admin-invite-internal aceita comercial | 🟢 | Entregue e validado; issue fechada em 16/11 |
| #36 | prospeccao: ocultar escrita em Carteiras/Universidade | 🟢 | Proteções de UI, banco/Storage e Edge entregues e validadas; issue fechada em 16/11 |
| #37 | prospeccao: drawer + métricas + docs | 🟢 | Entregue e validado; issue fechada em 16/11 |
| #38 | prospeccao: DB anexos | 🟢 | `e8141ca`; bucket+tabela+4 RPCs |

## Segurança

| Issue | Item | Status | Notas |
|---|---|---|---|
| #17 | Revogar EXECUTE público nas RPCs de email outbox | 🟢 | Privilégios de produção conferidos: anon/authenticated sem execução, service_role autorizado; issue fechada em 16/11 |

## Prospecção de clientes B2C — publicação e validação

Plano: `prompts/2026-11-18-prospeccao-kanban-ui-notas-prints.md`.

- 🟢 Kanban com arraste, cards B2C de 384px e abas Dados/Notas/Anexos/Histórico.
- 🟢 Prints privados, até 3 arquivos de 2 MB, com autorização e RLS.
- 🟢 Migration `20261118000002_prospeccoes_clientes_anexos.sql` aplicada em produção; smoke fase 66 aprovado.
- 🟢 Frontend publicado na Vercel; commits `98fd6e8` e `f7f9d0b` enviados ao GitHub, sem acionar Actions.
- 🟢 Validação final confirmada pelo dono em 19/11.
