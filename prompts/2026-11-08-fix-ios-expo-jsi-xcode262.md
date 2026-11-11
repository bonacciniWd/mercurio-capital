# Plano — destravar instalação nativa iOS no Xcode 26.2

## Objetivo

Permitir compilar e instalar no iPhone pareado o app Expo SDK 58, preservando a verificação de concorrência do Swift e mantendo o ícone atual da Mercúrio no bundle.

## Documentação e evidências lidas

- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- `mobile/README.md`, `mobile/app.json`, `mobile/eas.json`, `mobile/package.json` e lockfile.
- Log real de `npx expo run:ios --device "iPhone de macbook"`: Xcode 26.2 / Swift 6.2.3 para em `expo-modules-jsi@58.0.22`, `JavaScriptObject.swift:946`, com `sending 'slot' risks causing data races`.
- Issue upstream do Expo [#52754](https://github.com/expo/expo/issues/52754), que reproduz o erro em SDK 58/Xcode 26.2 e registra o ajuste proposto: passar o endereço do slot como `UInt` para a closure isolada e reconstruir o ponteiro dentro dela.

## Código/configuração inspecionados

- `mobile/app/onboarding.tsx` já mostra a arte orbital em Views nativas.
- `mobile/app.json` aponta `icon` para `./assets/icon.png`; arquivo existente, 512×512, conferido visualmente. Android aponta `./assets/adaptive-icon.png`.
- `mobile/eas.json` só tem perfil de distribuição da App Store; para este teste, `expo run:ios` local usa o iPhone pareado e o certificado Apple Development já reconhecido pelo Xcode.
- `expo-modules-jsi@58.0.22` compila o framework com modo Swift 6. A falha ocorre dentro do build phase do próprio pacote, antes de compilar o app.
- O projeto ainda não usa `patch-package` nem mantém patches persistentes de dependência.

## Decisão e suposições

- Aplicar um patch pequeno e reproduzível via `patch-package`, sem desativar as verificações de concorrência: capturar o endereço como inteiro fora da closure e reconstruir o ponteiro dentro dela, conforme o workaround documentado na issue upstream.
- Não alterar a lógica de sessão, biometria, telas, credenciais ou código de produção do app.
- Depois do patch, limpar somente os artefatos gerados de `expo-modules-jsi` se necessário e repetir a compilação/instalação local no iPhone conectado.
- Manter `assets/icon.png` como ícone iOS; a configuração já está correta. Conferir o `Assets.car`/app compilado quando o build terminar.

## Arquivos esperados

- `mobile/package.json` e `mobile/package-lock.json` para adicionar `patch-package` e o script `postinstall`.
- `mobile/patches/expo-modules-jsi+58.0.22.patch` com apenas o ajuste descrito.
- Possível artefato nativo gerado em `mobile/ios/`, ignorado pelo Git conforme `.gitignore`.

## Critérios de aceite

- `npm ci`/`npm install` reaplica o patch de forma reproduzível.
- Xcode termina build Debug arm64 com os módulos Expo de biometria e SecureStore.
- Instalação local abre no iPhone pareado, com ícone Mercúrio e onboarding carregado pelo Metro.
- Não reduzir níveis de verificação Swift nem alterar dados da conta.

## Segurança e impacto

- O patch altera código nativo de dependência exclusivamente para corrigir a incompatibilidade observada com Swift 6.2.3; o ajuste mantém execução síncrona e muda apenas como o endereço do slot atravessa a closure isolada.
- O patch é versionado e reversível removendo-se o arquivo e a dependência `patch-package`/script associado.
- Nenhum deploy, submissão à App Store ou migration remota será feito.

## Verificações após aprovação

- `npm run typecheck` em `mobile`.
- Reexecutar `npx expo run:ios --device "iPhone de macbook"`.
- Conferir no dispositivo a abertura, ícone e fluxo do onboarding; testar Face ID no build nativo.
- `git diff --check` e confirmar que o patch não modificou outros arquivos ou ativos.
