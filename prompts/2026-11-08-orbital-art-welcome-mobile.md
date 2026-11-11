# Plano — OrbitalArt animado na tela Welcome

## Objetivo

Atualizar somente a ilustração `OrbitalArt` da etapa Welcome do onboarding mobile para se aproximar da referência aprovada: composição orbital em fundo preto, órbitas elípticas inclinadas em vermelho e grafite, núcleo vermelho com anel interno e pontos orbitais animados. A animação será suave, contínua e executada com `react-native-reanimated` e `react-native-svg`, já presentes no projeto.

## Documentos e referências consultados

- `mobile/README.md` — stack Expo SDK 58, React Native e convenções do app.
- `prompts/2026-11-07-mobile-onboarding-figma-pf-pj-implementacao.md` — identidade visual, requisitos de responsividade e redução de movimento do onboarding.
- Referências visuais e código SVG/Reanimated enviados nesta conversa.

## Código e configuração inspecionados

- `mobile/app/onboarding.tsx` — implementação atual de `OrbitalArt`, estilos e montagem na etapa `welcome`.
- `mobile/package.json` — Reanimated `^4.7.1`, SVG `^15.16.0` e Worklets instalados.
- `mobile/babel.config.js` — plugin `react-native-worklets/plugin` já configurado.
- `mobile/metro.config.js` — configuração Expo/NativeWind existente.
- API instalada de Reanimated 4 — `useSharedValue`, `useAnimatedProps`, `withRepeat`, `withTiming`, `Easing` e `useReducedMotion` disponíveis.

## Decisões e suposições

1. A composição deve preservar a posição e a escala visual da referência Welcome existente; o exemplo fornecido orienta a técnica de animação, não a adoção de um sistema solar centralizado em largura total.
2. O SVG usará uma área de desenho proporcional, preservando as elipses inclinadas e o núcleo visual no lado superior direito da tela, dentro do espaço atual do onboarding.
3. Pontos orbitais se moverão ao redor de seus respectivos centros com tempos lineares distintos. As linhas e o núcleo permanecem estáveis, sem rotação integral da arte.
4. `useReducedMotion()` desativará o movimento quando o sistema solicitar movimento reduzido, mantendo a ilustração estática completa.
5. Não haverá novas dependências, mudanças de navegação, dados, autenticação, permissões ou conteúdo das demais etapas.
6. A ilustração continuará oculta para leitores de tela, como já ocorre atualmente.

## Arquivos esperados

- `mobile/app/onboarding.tsx` — trocar o desenho estático em Views por SVG com pontos animados e ajustar apenas os estilos/medidas da área orbital se necessário.
- Este plano em `prompts/2026-11-08-orbital-art-welcome-mobile.md`.

## Critérios de aceite

- A arte combina com a referência Welcome: órbitas elípticas vermelha e grafite inclinadas, núcleo vermelho com contorno interno e pontos claros/vermelhos em órbita.
- Os pontos animam continuamente sem saltos perceptíveis; cada órbita pode ter velocidade própria.
- A ilustração continua bem posicionada em larguras de iPhone distintas e não invade o título ou as ações.
- Com movimento reduzido ativo, todos os elementos ficam visíveis e estáticos.
- As demais etapas, texto, fluxo PF/PJ e ações de onboarding permanecem sem alteração.
- Nenhuma nova biblioteca ou configuração nativa é necessária.

## Considerações de segurança

Alteração exclusivamente visual e local. Não lê nem grava dados, não acessa serviços externos e não muda autenticação, permissões ou configuração de conta.

## Verificações após aprovação

- `cd mobile && npm run typecheck`
- `git diff --check`
- `cd mobile && npx expo export --platform ios` para validar o bundle nativo.
- Revisão visual no onboarding Welcome em um viewport iOS estreito e outro mais largo; confirmar posição, clipping, sobreposição com texto e movimento reduzido.

Não haverá deploy, build distribuído ou publicação como parte desta alteração.

## Execução

- Implementado em `mobile/app/onboarding.tsx`: SVG com três elipses inclinadas e planetas animados em velocidades distintas; movimento reduzido pausa os pontos mantendo a composição visível.
- `cd mobile && npm run typecheck` — passou.
- `cd mobile && npx expo export --platform ios` — passou; bundle Hermes iOS gerado.
- `git diff --check -- mobile/app/onboarding.tsx` — passou. A verificação global identificou uma linha em branco preexistente no fim de `mobile/global.css`, fora do escopo.
- Revisão visual em dispositivo iOS ainda precisa ser feita para confirmar o posicionamento renderizado em tela.
