# Plano — alinhar barras de fundos ao gráfico de parceiros

## Objetivo

Reduzir a diferença visual mostrada no print entre as barras de atribuições por fundo e as barras do gráfico “Top parceiros · volume ganho”.

## Documentos e código inspecionados

- Instruções `AGENTS.md` fornecidas na conversa.
- `app/src/components/FundoDistribuicaoCard.tsx`.
- `app/src/pages/admin/Dashboard.tsx`, configuração Recharts do gráfico de parceiros.
- Print enviado pelo usuário nesta solicitação.

## Diagnóstico

- A barra de fundo é atualmente um indicador de 10px de altura, com trilha cinza e preenchimento vermelho.
- As barras de parceiros são sólidas, mais espessas (aproximadamente 28px no print) e não têm trilha.
- Os círculos junto aos fundos já mantêm suas cores específicas.

## Implementação proposta

- Manter a escala proporcional por quantidade de atribuições.
- Usar barra sólida vermelha `#D9534F`, sem trilha cinza, com aproximadamente 28px de altura e arredondamento apenas na extremidade direita, acompanhando `radius={[0, 4, 4, 0]}` do Recharts.
- Manter a largura disponível atual e o mínimo visual dos valores positivos pequenos.
- Manter o círculo colorido por fundo e todos os dados da tabela.

## Arquivos esperados

- `app/src/components/FundoDistribuicaoCard.tsx`

## Critérios de aceite

- As barras ficam visualmente próximas à espessura e ao preenchimento das barras de parceiros.
- Não há trilha cinza ao fundo.
- O comprimento continua proporcional às atribuições do período.
- O círculo de cada fundo e as métricas/tabela são preservados.

## Segurança

- Mudança somente de apresentação, sem alterações em dados, RPC ou permissões.

## Testes

- `git diff --check`.
- Typecheck, lint e testes do app, se Node/npm estiverem disponíveis.
- Conferência visual da distribuição e do gráfico no dashboard.

## Aprovação

Plano aprovado pelo usuário antes da implementação.

## Resultado da implementação

- Barras alteradas para preenchimento sólido vermelho Mercúrio, sem trilha, com 28px de altura e arredondamento somente à direita.
- Proporção por atribuições, círculo colorido por fundo, largura e dados da tabela foram mantidos.
- Testes unitários focados passaram (1 arquivo/1 teste); typecheck passou; lint passou com 38 avisos preexistentes; `git diff --check` passou.
