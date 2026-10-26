# Dashboard: período mensal e distribuição por fundos

## Objetivo

1. Abrir o Dashboard Global por padrão no mesmo período do atalho **Mês**.
2. Melhorar a leitura das barras e da tabela de distribuição por fundos, esclarecendo quais atribuições ainda não têm fundo vencedor e preservando a regra de valores únicos por operação.

## Skills e documentos lidos

- Instruções `AGENTS.md` fornecidas pelo dono do produto nesta conversa; nenhuma skill externa se aplica ao mapeamento.
- `docs/README.md`;
- `docs/operacao/change-management.md`;
- `docs/operacao/runbooks.md`, seção 18;
- `prompts/2026-10-02-edicoes-dashboard-global.md`;
- `prompts/2026-10-08-correcao-filtro-trimestre-dashboard.md`.

## Código e banco inspecionados

- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/components/FundoDistribuicaoCard.tsx`;
- `app/src/lib/dashboardPeriod.ts`;
- `supabase/migrations/20261003000001_dashboard_fundos_primeira_aprovacao.sql`, em especial a RPC `admin_dashboard_fundos_analytics`;
- `supabase/smoke-tests/fase-35-dashboard-fundos.sql`.

## Diagnóstico

- `initialRange()` inicia no primeiro dia do ano e termina hoje. O atalho existente **Mês** usa o primeiro e o último dia do mês calendário corrente.
- `operacoes_representadas` conta propostas vinculadas a cada fundo, mesmo sem aprovação.
- `operacoes_unicas`, `volume_solicitado` e `volume_ganho` em cada linha só são atribuídos ao primeiro fundo aprovado. Uma linha com atribuições, zero operações únicas e volumes zerados indica que nenhuma proposta daquela linha tem esse fundo como primeiro vencedor; não é falha de soma.
- A RPC já retorna `operacoes_sem_fundo_vencedor` e `volume_solicitado_sem_fundo_vencedor`. O componente mostra somente a quantidade no aviso e omite o valor total correspondente.
- A barra atual usa `volume_solicitado` como largura. Quando o fundo não tem propostas com vencedor, todas as barras ficam vazias, mesmo havendo atribuições.
- A regra aprovada em `prompts/2026-10-02-edicoes-dashboard-global.md` e `docs/operacao/runbooks.md` exige atribuição monetária única ao primeiro fundo aprovado. Somar valores potenciais repetidos em cada fundo violaria essa regra.

## Decisões propostas e suposições

- Sem parâmetros de data na URL, iniciar no período do atalho **Mês** atual: do dia 1 ao último dia do mês calendário. O botão **Mês** mantém a regra existente.
- Usar barras para mostrar participação em **atribuições** (contagem de vínculos por fundo), deixando essa medida visual independente dos volumes financeiros.
- Manter os volumes por fundo vinculados ao primeiro fundo aprovado e exibir um rodapé de total calculado a partir das linhas financeiras únicas.
- No aviso operacional, apresentar a quantidade e o volume solicitado total das operações sem fundo vencedor, usando campos já presentes na resposta da RPC.
- Não mostrar a soma de atribuições como total de operações únicas, pois uma operação pode estar vinculada a mais de um fundo.
- Não apresentar uma soma de “volume potencial por atribuição” em cada fundo, porque o mesmo empréstimo poderia ser repetido e contrariaria a regra de volume único.

## Modelo de dados e segurança

- Sem novas tabelas ou campos. A RPC administrativa já retorna os dados necessários para o aviso.
- Sem mudança de autorização, RLS ou dados persistidos.
- A RPC continua acessível somente a usuários autenticados autorizados como admin; nenhuma consulta privada nova será feita pelo navegador.

## Arquivos esperados

- `app/src/pages/admin/Dashboard.tsx`: alterar o período inicial sem parâmetros para o mês calendário atual; preservar as demais regras e a correção local recente do atalho Trimestre.
- `app/src/components/FundoDistribuicaoCard.tsx`: ajustar apresentação da barra e tabela, mostrar valores sem fundo vencedor e resumo financeiro único.
- `app/src/test` ou `app/src/lib`: teste focado para a regra do intervalo inicial mensal, conforme organização escolhida na implementação.
- Este plano atualizado com os resultados das verificações.

## Critérios de aceite

1. Abrir `/admin` sem `inicio`/`fim` seleciona **Mês** e usa as mesmas datas do atalho **Mês**.
2. A barra continua informativa quando existem atribuições e volume aprovado é zero; fica claro que ela representa contagem de vínculos.
3. A tabela distingue atribuições representadas de operações únicas e mantém números/valores alinhados e legíveis.
4. O aviso apresenta quantidade e volume solicitado das operações sem fundo vencedor.
5. O total monetário do card soma cada proposta no máximo uma vez, conforme o primeiro fundo aprovado; atribuições duplicadas não aumentam o total.
6. O filtro de mês manual, 30 dias, trimestre, ano, histórico e parâmetros de URL continuam funcionando.
7. Visualização responsiva mantém tabela utilizável em telas menores, sem esconder valores essenciais.

## Impacto por superfície e rollout

- Web: `app/` — somente o Dashboard Global.
- Banco/RLS/Edge Functions: não afetados.
- Mobile e Electron: não afetados.
- Deploy Vercel e release desktop: fora deste plano; requerem autorização separada.
- Rollback: reverter somente as mudanças nos arquivos do Dashboard e do componente de fundos, preservando alterações preexistentes e o ajuste recente do filtro Trimestre.

## Verificações

- Testes focados do período mensal e das somas do card, quando aplicáveis.
- `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check` em `app/`.
- Smoke visual autenticado: URL sem parâmetros, mês atual, valores no aviso, fundo com atribuições pendentes, fundo vencedor, filtro por fundo e layout responsivo.
- Confirmar que nenhuma migration ou escrita no banco ocorreu.

## Resultado da implementação em 2026-10-08

- Sem parâmetros na URL, o Dashboard usa o mês calendário corrente, igual ao botão **Mês**. O intervalo trimestral móvel existente foi preservado.
- As barras da tabela agora comparam a quantidade de atribuições por fundo, e não o volume aprovado.
- O rodapé totaliza operações únicas e volumes já atribuídos ao fundo vencedor; o campo de atribuições no total mostra traço porque os vínculos podem se repetir.
- O aviso operacional exibe a quantidade e o valor solicitado das operações sem fundo vencedor.
- Testes focados: 5 testes passaram em 2 arquivos, incluindo mês padrão, limites trimestrais e soma somente dos valores atribuídos ao vencedor.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado com 38 avisos preexistentes e nenhum erro.
- `npm run build`: aprovado; permanece o aviso preexistente de chunk principal acima de 500 kB.
- `git diff --check`: aprovado.
- Smoke visual autenticado no Chrome, sem parâmetros: **Mês** selecionado com `01 out 2026 — 31 out 2026`; a seção exibiu 5 operações e R$ 6.388.000,00 sem fundo vencedor, barras de atribuições e o rodapé financeiro.
- Nenhuma migration, escrita no banco, deploy ou release foi realizada.
