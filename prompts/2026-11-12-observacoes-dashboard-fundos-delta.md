# Plano delta — Observações na Distribuição por fundos (dashboard admin) + reconciliação visual da timeline

**Data:** 2026-11-12 · **Status:** ✅ aprovado pelo dono em 2026-11-12 · **Estende:** `prompts/2026-11-11-kanban-observacoes-proposta.md` (aprovado)

## Objetivo

1. Levar a mesma função de observações (botão + modal, #18–#22) para os cards de proposta da seção "Distribuição por fundos" do dashboard admin (`FundoDistribuicaoCard.tsx`), a pedido do dono.
2. Reconciliar a apresentação da timeline do modal com a referência visual enviada pelo dono (estilo Trello: composer no topo, timestamp absoluto, corpo em card branco, ações sublinhadas Editar/Excluir).

## Base

- Especificação delta do agente UX/UI, aprovada pelo dono em 2026-11-12 (3 pontos decisórios confirmados: chip com rótulo na chips row; composer no topo colapsável; chip de etapa dentro do card branco).
- Nenhuma mudança de modelo/RLS/RPC — reutiliza 100% do backend e da camada de dados entregues.

## Decisões registradas

- Avatar com tinta por papel usando tokens existentes (admin=navy, partner=gold, team_member=silver) — a cor laranja da referência NÃO se aplica (design system).
- Timestamp absoluto visível ("22 de out. de 2026, 12:46"); relativo vai para o `title`.
- Composer no topo (corrige desalinhamento real: RPC ordena DESC e o item novo nascia fora da vista), input de 1 linha que expande ao foco.
- "Apagar" → "Excluir"; confirmação inline correspondente.
- SEM entradas automáticas de atividade (decisão 2 do plano original, reconfirmada — a referência mostra, mas fica fora da v1).
- Terminologia do produto preservada: "Observações internas" (não "Comentários e atividade").

## Arquivos esperados

- `app/src/components/PropostaObservacoesButton.tsx` — prop opcional `variant: 'kanban' | 'chip'` (contrato atual intacto).
- `app/src/components/FundoDistribuicaoCard.tsx` — provider local + contagem por página + botão chip + montagem do modal com snapshot.
- `app/src/components/PropostaObservacoesModal.tsx` — composer no topo colapsável; item da timeline reconciliado (avatar por papel, timestamp absoluto, corpo em card, ações sublinhadas, chip de etapa no card).
- Testes: extensão de `propostaObservacoesKanban.test.tsx` + novo `fundoDistribuicaoObservacoes.test.tsx`.

## Critérios de aceite, testes e fronteira de release

Os da especificação delta (§7) e do plano original. Checks obrigatórios de `app/`: lint, typecheck, test, build. Release continua **NO-GO** até GO explícito do dono (mesma versão do push web + observações).
