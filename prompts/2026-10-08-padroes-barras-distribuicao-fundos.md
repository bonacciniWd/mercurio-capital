# Plano — padronizar indicadores visuais da distribuição por fundos

## Objetivo

Remover as barras horizontais coloridas abaixo dos nomes dos fundos na tabela “Distribuição por fundos”, mantendo o círculo com a cor de cada fundo como identificador visual. Preservar as colunas, métricas, regras de atribuição e totais atuais. A alteração aproxima a apresentação do padrão visual de “Top parceiros · volume ganho”.

## Skills e documentos lidos

- Instruções de `AGENTS.md` fornecidas na conversa.
- Código atual de `app/src/components/FundoDistribuicaoCard.tsx`.
- Trecho de `app/src/pages/admin/Dashboard.tsx` que renderiza “Top parceiros · volume ganho”.

## Código inspecionado

- `FundoDistribuicaoCard`: renderização da legenda/nome do fundo e barra horizontal proporcional às atribuições.
- `Dashboard.tsx`: gráfico de barras verticais dos parceiros, usado como referência de consistência visual.

## Decisões e suposições

- “Mostrar apenas o círculo” significa retirar a barra horizontal sob o nome, mantendo o ponto colorido ao lado do nome do fundo.
- Não mudar cálculos, consultas, ordenação, colunas ou conteúdo informativo.
- A cor do ponto continua vindo de `cor_hex` do fundo.

## Arquivos esperados

- `app/src/components/FundoDistribuicaoCard.tsx`

## Requisitos e critérios de aceite

- Cada linha da tabela apresenta somente um círculo colorido como marcador do fundo.
- Nenhuma barra horizontal aparece sob o nome.
- A tabela e os valores permanecem inalterados.
- A marcação continua acessível, com o nome do fundo disponível como cabeçalho da linha.

## Considerações de segurança

- Alteração exclusivamente visual; sem mudanças em dados, autenticação, permissões ou chamadas ao servidor.

## Testes manuais e automáticos

- Executar testes unitários relevantes, typecheck e lint do app.
- Conferir `git diff --check`.
- Revisar o diff para confirmar que a mudança ficou restrita ao marcador visual.

## Aprovação

Plano aprovado pelo usuário antes da implementação.

## Resultado da implementação

- Removidas as barras horizontais sob os nomes dos fundos e o cálculo de escala associado.
- Mantido o círculo colorido por fundo, além da tabela e métricas existentes.
- `git diff --check` passou.
- Testes, typecheck e lint não puderam ser executados: `node`, `npm`, `pnpm` e `bun` não estão disponíveis no PATH desta sessão, embora `node_modules` esteja presente.
