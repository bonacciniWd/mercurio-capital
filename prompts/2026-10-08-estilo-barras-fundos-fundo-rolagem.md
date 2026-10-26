# Plano — estilo das barras por fundo e fundo durante a rolagem

## Objetivo

Manter as barras proporcionais de atribuições na tabela “Distribuição por fundos”, estilizando-as como as barras de “Top parceiros · volume ganho”: preenchimento vermelho Mercúrio, bordas arredondadas e trilha neutra. Preservar o círculo colorido de cada fundo como identificador. Corrigir o fundo preto que aparece durante a rolagem da tela.

## Skills/documentos lidos

- Instruções de `AGENTS.md` fornecidas na conversa.
- `app/src/components/FundoDistribuicaoCard.tsx`.
- `app/src/pages/admin/Dashboard.tsx`, incluindo o gráfico de parceiros.
- `app/src/index.css` e `app/src/layouts/AdminLayout.tsx`.

## Código inspecionado

- A distribuição atual representa atribuições com uma barra proporcional sob o nome do fundo; essa barra foi removida no ajuste anterior e deverá ser restaurada.
- O gráfico “Top parceiros · volume ganho” usa barras `#D9534F` com bordas arredondadas.
- `body` tem fundo global preto; os layouts administrativo, parceiro, cliente e público definem fundos claros próprios. O preto global pode aparecer no overscroll/rolagem.
- O AdminLayout contém área rolável própria e fundo `bg-silver-50`.

## Decisões e suposições

- As barras da distribuição continuam representando `operacoes_representadas`, escaladas em relação ao maior número entre os fundos exibidos.
- A barra preenchida usará o vermelho `#D9534F`, trilha cinza clara e cantos arredondados, alinhada ao gráfico de parceiros; o círculo continua usando `cor_hex`.
- O fundo global do `body` será alterado de preto para `#F8FAFC`/equivalente `bg-silver-50`, para que o overscroll exponha o fundo da aplicação em vez de preto.
- Não haverá mudanças nos cálculos, consultas, permissões ou dados.

## Arquivos esperados

- `app/src/components/FundoDistribuicaoCard.tsx`
- `app/src/index.css`

## Critérios de aceite

- Barras proporcionais estão visíveis sob os nomes dos fundos.
- Barras usam o padrão visual vermelho e arredondado do gráfico de parceiros, sem remover os círculos coloridos por fundo.
- Rolar/esticar a tela administrativa não mostra fundo preto fora do conteúdo.
- Métricas, layout da tabela e demais rotas continuam sem mudanças funcionais.

## Segurança

- Mudanças somente visuais, sem acesso ou gravação de dados.

## Testes

- Testes unitários relevantes, typecheck, lint e `git diff --check`.
- Conferência visual em navegador ao rolar o dashboard e comparação das barras com “Top parceiros · volume ganho”.

## Aprovação

Plano aprovado pelo usuário antes da implementação.

## Resultado da implementação

- Barras proporcionais restauradas; o preenchimento agora usa o vermelho Mercúrio `#D9534F`, com trilha cinza clara e cantos arredondados. Os círculos mantêm a cor individual de cada fundo.
- Fundo global do `body` alterado de preto para `bg-silver-50`, correspondente ao fundo usado na área administrativa.
- `git diff --check` passou.
- Testes, typecheck e lint não puderam ser executados porque Node.js e npm não estão disponíveis no PATH desta sessão.
- A tela `/admin` carregou no navegador local e mostrou as barras por fundo; não foi possível conferir o efeito de overscroll por captura visual nesta sessão.
