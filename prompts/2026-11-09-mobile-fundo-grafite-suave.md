# Ajuste de fundo grafite suave no mobile

## Objetivo

Substituir o preto quase absoluto usado nos shells principais do mobile por um fundo grafite com gradiente muito sutil, mantendo contraste, leitura e a identidade vermelha da Mercúrio.

## Inspeção

- Ocorrências de `#09090B` em shells de parceiro, cliente, login, recuperação, detalhe de proposta e componentes globais.
- `mobile/global.css` não possui atualmente tokens de fundo compartilhados.

## Decisão

Adicionar tokens visuais em `mobile/global.css` e aplicar o tratamento apenas às superfícies principais, com base grafite `#111216` e variação discreta para `#17191F`. Áreas de câmera, vídeo e overlays permanecem pretas para preservar conteúdo e legibilidade.

## Arquivos esperados

- `mobile/global.css`.
- Componentes e telas que usam `#09090B` como fundo principal.

## Critérios de aceite

- O fundo parece grafite, sem efeito forte ou chamativo.
- Textos brancos, vermelho Mercúrio e cartões mantêm contraste.
- Não alterar fluxos, dados, navegação ou comportamento.
- Typecheck e export Expo continuam passando.

## Segurança e validação

Somente CSS/classes e estilos visuais; nenhuma migration, chamada externa ou publicação.

## Resultado

Aplicado fundo grafite `#111216` nos shells principais de parceiro, cliente, login, recuperação, dashboard e detalhe da proposta. Áreas de câmera e vídeo não foram alteradas. Typecheck e export Expo iOS/Android concluídos com sucesso.
