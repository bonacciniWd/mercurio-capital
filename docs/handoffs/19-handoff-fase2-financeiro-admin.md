# Handoff — Fase 2: dashboard e gestão financeira administrativa

## Escopo implementado localmente

- Dashboard administrativo com período e filtros por fundo, parceiro e rede.
- Métricas operacionais por criação da proposta e volume por liberação efetiva no período.
- Livro financeiro manual para entradas e saídas previstas ou realizadas.
- Recorrências mensais para custos fixos e variáveis, com materialização idempotente.
- Fechamento da competência anterior, prazo no dia 02 e reabertura justificada/auditada.
- Bloqueio de repasse depois do prazo enquanto o mês anterior estiver aberto, salvo exceção justificada e auditada.
- Condição comercial versionada por proposta: receita bruta Mercúrio e comissão do parceiro com base selecionável e percentual customizado.
- Estrutura de dias não úteis para cálculo do quinto dia útil em Balneário Camboriú/SC.

## Banco e segurança

- Migration: `supabase/migrations/20260902000001_financeiro_admin_fase2.sql`.
- Smoke transacional: `supabase/smoke-tests/fase-29-financeiro-admin.sql`.
- Escritas críticas de fechamento, condição comercial, aprovação e pagamento passam por RPCs `security definer` com validação de papel.
- Períodos fechados são protegidos por trigger; reabertura e exceção de repasse geram auditoria.
- A migration foi aplicada remotamente em `2026-09-02` no projeto confirmado `bhagksfvszeogtjvjtpx` após dry-run mostrar somente este arquivo pendente.
- Não houve deploy da aplicação, tag ou release.

## Validações executadas

- reset completo do Supabase local com todas as migrations;
- smoke da Fase 29 aprovado com rollback;
- login local real e chamadas autenticadas das RPCs de dashboard e financeiro;
- `npm run typecheck`;
- `npm run lint -- --quiet`;
- `npm test` — 18 arquivos e 63 testes aprovados;
- `npm run build` — aprovado, mantendo apenas o aviso existente de chunk principal acima de 500 kB;
- `git diff --check`.

## Pendências para homologação

- Revisão visual no navegador com usuário administrativo: o navegador integrado não estava disponível nesta sessão.
- Popular `financeiro_dias_nao_uteis` a partir de fonte oficial antes do uso operacional do quinto dia útil.
- Definir fornecedor e consentimento para Open Finance; nenhuma integração bancária foi implementada nesta fase.
- Migration remota aplicada e confirmada no histórico; um novo dry-run retornou `Remote database is up to date`.
- Publicar web/desktop somente em autorização posterior; a versão permanece `0.1.6`.
