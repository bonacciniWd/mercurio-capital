# Plano — remover aviso de `ImageBackground` no app mobile

## Objetivo

Eliminar o aviso de runtime que aparece na frente do app ao iniciar, preservando o visual das imagens de fundo nas telas de Cliente e Promoções do Parceiro.

## Skills e documentação lidas

- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- `mobile/README.md` (stack Expo SDK 58, React Native, NativeWind e fluxo de validação nativo).
- Aviso real do Metro ao carregar o app: `ImageBackground is deprecated and will be removed in a future release`.
- Código de `mobile/app/(cliente)/index.tsx`, `mobile/app/(parceiro)/promocoes.tsx`, `mobile/node_modules/react-native-css-interop/src/runtime/components.ts` e `mobile/node_modules/react-native-css-interop/dist/runtime/components.js`.
- Fonte do React Native `0.88.1`, que registra o aviso ao acessar o getter exportado `ImageBackground` em desenvolvimento.
- Código-fonte e issue upstream do Nativewind que confirmam que `react-native-css-interop` importa e adapta `ImageBackground` no módulo global de componentes; a issue informa que esse adaptador é apenas compatibilidade e não renderiza o componente por si só.

## Código inspecionado

- O onboarding inicial já especifica fundo escuro e cores de texto explícitas.
- Não há aviso textual de elegibilidade no código mobile.
- O Metro do build instalado registrou repetidamente o aviso de depreciação de `ImageBackground`.
- As duas telas do app usavam `ImageBackground`; esses usos foram substituídos por `View` com `Image` absoluta.
- `react-native-css-interop@0.2.3` aponta o runtime ao arquivo compilado `dist/runtime/components.js`; a primeira tentativa de patch no arquivo-fonte não mudou o código executado e o aviso persistiu na reabertura do iPhone.

## Decisões e suposições

- A hipótese é que o overlay visto na abertura é o aviso de runtime do React Native. A relação é sustentada pelo log do Metro, embora a tela do usuário não tenha sido capturada visualmente.
- Substituir cada `ImageBackground` da aplicação por `View` com `Image` absoluta preenchendo o container, conforme orientação do aviso, mantendo dimensões, máscaras, bordas, conteúdo e interação.
- Acrescentar patch-package focalizado em `react-native-css-interop` para remover somente o registro CSS de `ImageBackground` do runtime compilado e manter a mesma remoção no fonte correspondente; o app não usa esse componente. Isso evita acessar o getter deprecado do React Native sem suprimir warnings globais nem migrar a stack Nativewind.
- Manter patch versionado e aplicado por `postinstall`; não alterar tema global, autenticação ou configuração de desenvolvimento.

## Arquivos esperados

- `mobile/app/(cliente)/index.tsx`
- `mobile/app/(parceiro)/promocoes.tsx`
- `mobile/patches/react-native-css-interop+0.2.3.patch` (dist de runtime e fonte correspondente)

## Critérios de aceite

- A instalação reaplica o patch via `postinstall`.
- A bundle iOS de desenvolvimento não registra o aviso de depreciação de `ImageBackground` ao carregar a entrada do app.
- A imagem do cartão do cliente e os fundos dos cards de marcos continuam atrás dos conteúdos, sem alterar leitura ou toque.
- Typecheck e lint passam; Metro limpa cache e recarrega o bundle no build instalado, sem rebuild nativo pois a correção do Nativewind é JavaScript.

## Segurança e impacto

- Mudança somente de apresentação no cliente; sem alterações de dados, permissões, autenticação, migrations, secrets ou publicação.
- O patch deixa de adaptar `ImageBackground` para `className` por meio do Nativewind. O inventário confirmou que o app não utiliza esse componente; se vier a usá-lo no futuro, deverá usar `View` + `Image` absoluta ou reintroduzir um adaptador compatível com a versão do React Native.

## Testes

- `npm run typecheck` em `mobile`.
- Lint nos dois arquivos, caso exista comando de lint aplicável no app.
- Rodar `npm run postinstall` e confirmar o patch aplicado.
- Gerar bundle iOS em modo dev com cache limpo e confirmar que o Metro não registra o aviso.
- Recarregar o app no iPhone e confirmar que o aviso não reaparece e que as imagens continuam renderizando corretamente.
- `git diff --check`.
