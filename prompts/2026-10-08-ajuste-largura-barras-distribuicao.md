# Plano — melhorar escala e presença das barras de distribuição

## Objetivo

Dar mais presença às barras de atribuições por fundo. A mudança anterior alterou principalmente a cor; este ajuste amplia a faixa disponível e melhora o contraste/espessura, sem substituir o círculo colorido que identifica cada fundo.

## Skills/documentos lidos

- Instruções `AGENTS.md` fornecidas na conversa.
- `app/src/components/FundoDistribuicaoCard.tsx`.
- `app/src/pages/admin/Dashboard.tsx`, configuração do gráfico “Top parceiros · volume ganho”.
- `app/tailwind.config.js`, paleta Mercúrio.

## Código inspecionado

- A barra ocupa atualmente até 220px, tem 8px de altura e a largura proporcional é relativa ao maior número de atribuições.
- O gráfico de parceiros usa preenchimento `#D9534F` e termina arredondado.
- A tabela mantém o nome e o círculo de cor específica do fundo.

## Decisões e suposições

- A escala continuará relativa às atribuições exibidas no filtro atual.
- A trilha passará a ocupar toda a largura útil da primeira coluna, com limite visual maior (até 320px), em vez do limite atual de 220px.
- A barra terá 10px de altura e trilha neutra mais definida; o preenchimento continuará vermelho Mercúrio e arredondado.
- Quando houver atribuições positivas, a menor barra terá um pequeno mínimo visível para que valores baixos não desapareçam; o número exato continuará na coluna “Atribuições”.
- O círculo com `cor_hex` continuará como identificador da cor do fundo. Métricas e cálculo não mudam.

## Arquivos esperados

- `app/src/components/FundoDistribuicaoCard.tsx`

## Critérios de aceite

- A barra aproveita mais largura horizontal e é perceptível mesmo para fundos com poucas atribuições.
- Altura, trilha e preenchimento parecem intencionais e alinhados ao gráfico de parceiros.
- O círculo colorido permanece junto ao nome.
- A proporção ainda reflete o número de atribuições; a tabela e demais dados não mudam.

## Segurança

- Alteração somente visual; não altera RPC, dados ou permissões.

## Testes

- Typecheck, lint e testes unitários do app, se o runtime estiver disponível.
- `git diff --check`.
- Conferência visual no dashboard em larguras desktop e estreita.

## Aprovação

Plano aprovado pelo usuário antes da implementação.

## Resultado da implementação

- A faixa passou de até 220px para ocupar a largura disponível da coluna, com limite de 320px e mínimo de 180px.
- A altura foi aumentada para 10px e a trilha recebeu mais contraste.
- Mantida a proporção relativa; preenchimentos positivos muito baixos têm mínimo visual de 2%.
- O círculo colorido por fundo e a coluna numérica de atribuições foram mantidos.
- `git diff --check` passou. Typecheck, lint e testes não iniciaram porque `npm` não está disponível no PATH desta sessão.
