# Handoff — Observações por proposta no Kanban (histórico + prints)

Data: 2026-11-12 · Plano aprovado: `prompts/2026-11-11-kanban-observacoes-proposta.md` (+ delta `prompts/2026-11-12-observacoes-dashboard-fundos-delta.md`) · Issues: #18, #19, #20, #21, #22, #23, #24, #25 (esta), #26 (P2 pendente), #27 (delta dashboard/timeline)

## Entrega local (merge em `main`, sem deploy)

- **Modelo (migration `20261111000003_proposta_observacoes.sql`):** `proposta_observacoes` (carimbo de etapa **server-side** de `propostas.status` no insert; janela de edição de 15 min no relógio do servidor; soft delete com `deleted_by`/`deleted_motivo` — admin remove alheio com motivo obrigatório); `proposta_observacao_anexos` + bucket privado `proposta-obs` (2 MB, JPG/PNG/WEBP/HEIC no bucket e na RPC); upload em 2 fases (preparar → upload → vincular); 6 RPCs com revokes estritos; helper de escopo **espelhando o Kanban vigente** (admin | partner aprovado dono | equipe | team_member responsável — `app_is_approved()` no helper, achado High da revisão).
- **Notificações:** comentário novo insere `notificacoes` in_app para parceiro dono aprovado + responsável interno (link por papel real) + admins operacionais; nunca autor/cliente; mensagem sem trecho do comentário; **push automático** via trigger da Frente A.
- **Web:** botão no footer do card do Kanban (badge só >0; `stopPropagation` preserva drag; omitido no DragOverlay) + chip "Observações" nas linhas da **Distribuição por fundos** (dashboard admin, variante `chip`); modal de timeline compartilhado (composer no topo colapsável, timestamp absoluto + relativo no title, corpo em card branco com chip de etapa, ações sublinhadas Editar/Excluir, avatar com tinta por papel); janela com countdown; remoção admin via `ReasonDialog` (que ganhou 3 props opcionais + focus trap + retorno de foco); ReasonDialog e modal com z-70/z-60 aninhados corretos.
- **Anexos:** validação local espelhando o server; chips enviando/anexado/erro com **Tentar de novo** (só erros transitórios) e Remover; thumbnails com signed URL 300s; HEIC com fallback "abrir em nova aba".

## Banco

- Migration **NÃO aplicada no remoto** — deploy Supabase aguarda GO explícito do dono (fronteira de release mantida; entra na mesma versão do push web).
- `supabase db reset` local do zero: 61 migrations aplicam sem erro, incluindo a nova.
- Smoke `fase-60-proposta-observacoes.sql`: estrutural + transacional (34 verificações, ROLLBACK, zero resíduo) — escopo cruzado negado (parceiro de outra proposta, team_member de outra equipe, parceiro suspenso, cliente da própria proposta), janela de edição, trilha admin, MIME/tamanho/extensão, vínculo de anexo alheio/expirado, policies de storage, notificações (destinatários, sem trecho, link por papel), fan-out de push.

## Validações

- Web: **23/23** testes novos (lib anexos 9, hook 8, modal/botão 13→15, integração dashboard 2) + regressão reasonDialog 3/3; suite completa 285/299 — as 14 falhas são de `adminLeadsSimulacoes.test.tsx`, **pré-existentes** (confirmado no baseline com stash); lint 0 erros/33 warnings = baseline exato; typecheck limpo; build OK; `validate:release` OK (v0.3.0).
- Revisor (3 rodadas nesta frente): #18-#20 — 1 High (gate de aprovação) + 6 Médios/Lows corrigidos; #21 — 1 Medium (refetchInterval real) + Lows; #22 — 1 Medium (focus trap aninhado) + 5 Lows; #27 — **rejeitado** com 1 High (erro de exclusão invisível com composer colapsado) + Medium (teste de integração) — corrigidos e re-aprovados; #23 — 3 Lows corrigidos.

## Residuais conhecidos (não bloqueantes)

- **#26 (P2):** limpeza de anexos `preparado` órfãos (>24h) — job ou runbook; não bloqueia v1.
- Chip "enviando" sem botão cancelar durante upload lento (descarta fechando o modal) — follow-up se incomodar.
- Contexto `observacoesKanbanContext` usado fora do Kanban (dashboard) — rename para `ObservacoesContext` é dívida de nomenclatura registrada (toca 3 arquivos).
- Suite web: as 14 falhas pré-existentes de `adminLeadsSimulacoes.test.tsx` seguem abertas (sugerir issue própria).
- Notificação por e-mail de comentário novo não foi pedida (só in-app + push) — se quiser, vira extensão no dispatcher de e-mail.

## Pendências de ativação (mesma release do push web)

- Deploy Supabase da migration + smoke fase-60 no remoto (após GO).
- Nenhuma variável de ambiente nova; nenhum segredo novo.
- Rollback operacional: revert do web deixa RPCs inertes e dados íntegros (sem flag dedicada — decisão do dono).

## Fora de escopo (frentes futuras)

- Entradas automáticas de mudança de etapa na timeline (referência visual do dono mostra; v1 ficou só comentários — decisão registrada).
- Mobile (`mobile/`) — v1 é web-only (S3 confirmada).
- Menções (@), reações, threads, edição isolada de anexo.
