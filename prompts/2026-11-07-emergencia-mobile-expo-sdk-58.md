# Correção emergencial: compatibilidade do app mobile com Expo Go SDK 58

## Objetivo

Atualizar o app `mobile/` de Expo SDK 54 para SDK 58 para voltar a executá-lo no Expo Go iOS que o usuário atualizou. A migração deve ser controlada, sequencial por SDK, limitada ao app mobile e sem publicar uma nova versão de produção ou alterar as tarefas pendentes de onboarding/admin.

## Documentação e fontes lidas

- `AGENTS.md` fornecido pelo usuário nesta conversa.
- `mobile/README.md`, `mobile/package.json`, `mobile/package-lock.json`, `mobile/app.json` e `mobile/eas.json`.
- Documentação oficial Expo: [Upgrade Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) — recomenda migrar incrementalmente, um SDK por vez.
- Documentação oficial Expo: [Expo Go version mismatch](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) — explica a correspondência entre `expo` no projeto e o Expo Go instalado e recomenda `expo-doctor`/`expo install --fix`.
- Documentação oficial Expo: [Development builds FAQ](https://docs.expo.dev/develop/development-builds/faq/) — contexto sobre builds nativos e versões SDK.
- Notas oficiais Expo: [Como atualizar para SDK 58](https://expo.dev/blog/how-to-upgrade-to-sdk-58) e [migração do Expo Router 57 → 58](https://docs.expo.dev/router/migrate/sdk-57-to-58/).

## Código e configuração inspecionados

- O app declara `expo: ~54.0.0`, `expo-router: ~6.0.0`, React Native `^0.81.5` e não tem `expo-dev-client`.
- `mobile/app.json` contém app version `0.0.2`, bundle/package `com.mercuriocapital.app`, scheme `mercurio` e plugins Expo Camera/Router/Build Properties.
- `mobile/eas.json` contém somente perfil `production`; a tarefa não precisa criar ou executar build EAS.
- Não existem diretórios nativos `mobile/ios` ou `mobile/android`; o projeto usa Continuous Native Generation.
- Busca por usos conhecidos do SDK58 não encontrou imports `@react-navigation/*`, deep imports de `react-native/Libraries/*` ou `InteractionManager` no código mobile. A busca de compatibilidade será repetida durante cada etapa da migração.
- O checkout está amplamente modificado por trabalho anterior. `mobile/app/_layout.tsx` tem uma alteração local existente em `StatusBar style="dark"`; essa e as demais alterações preexistentes devem ser preservadas.

## Decisões e suposições

- Caminho escolhido pelo usuário: migrar o projeto para SDK 58, para corresponder ao Expo Go disponível no iOS dele.
- Seguir a recomendação oficial de atualizar incrementalmente SDK 54 → 55 → 56 → 57 → 58, alinhando dependências e verificando cada etapa antes de avançar.
- Atualizar somente dependências/configuração e adaptações de compatibilidade necessárias em `mobile/`; não incluir onboarding, remoção de Admin, deep links ou alterações do backend.
- Preservar o app version `0.0.2`, identificadores nativos, permissões, scheme e configuração de negócio, salvo requisito técnico estrito documentado.
- Não publicar binário, OTA update, TestFlight, App Store, GitHub ou Vercel nesta correção.

## Arquivos esperados

- `mobile/package.json` e `mobile/package-lock.json` — versões Expo/React Native/Router e módulos alinhadas ao SDK alvo.
- Arquivos de código mobile que precisem de adaptação comprovada por breaking changes das notas oficiais.
- `mobile/README.md` — versão de SDK, comandos e compatibilidade de desenvolvimento atualizados.
- Eventuais arquivos de configuração Expo somente se exigidos pela migração, preservando os valores atuais.

## Requisitos e critérios de aceite

- `npx expo install --fix` deixa as dependências Expo compatíveis com SDK 58.
- `npx expo-doctor@latest` não aponta incompatibilidades relevantes.
- `npm run typecheck` passa em `mobile/`.
- O bundle/export para iOS conclui localmente sem erro.
- O projeto abre no Expo Go iOS informado pelo usuário, sem aviso de incompatibilidade SDK e sem erro fatal no fluxo inicial/login.
- Nenhuma alteração remove nem substitui mudanças preexistentes do checkout.
- Nenhum artefato de produção é publicado como parte desta tarefa.

## Segurança e preservação

- Não alterar credenciais ou variáveis de ambiente.
- Não trocar bundle ID, package name, `scheme`, URL Supabase ou permissões existentes.
- Não apagar diretórios ou configurações locais. Não executar reset, checkout, clean ou comandos que descartem alterações.
- Limitar staging/diff à lista allowlist aprovada quando houver publicação futura; não fazer commit nesta tarefa.

## Testes

- Antes e depois: verificar diff dos arquivos permitidos e `git diff --check`.
- Em cada salto SDK: executar `npx expo install --fix`, `npx expo-doctor@latest` e `npm run typecheck`; corrigir apenas incompatibilidades comprovadas.
- Final: `npx expo export --platform ios` e `npx expo start` com abertura no Expo Go SDK 58 em iPhone físico.
- Este projeto não declara scripts separados de lint ou build; reportar essa limitação sem afirmar checks não executados.
- Teste manual: inicialização, tela/login, autenticação já existente, navegação de cliente/parceiro, links mágicos e captura de documento/câmera, conforme disponibilidade de sessão/dispositivo.

## Atenção

- SDK 58 muda React Native para 0.88 e inclui mudanças de Expo Router; seguir os changelogs de cada SDK intermediário antes de codificar.
- A migração de versão não equivale a publicar uma atualização para usuários finais.
- Expo Go é um ambiente de desenvolvimento; o binário público existente permanece inalterado até autorização de build/submissão independente.

## Resultado da implementação local

- Atualizado `mobile/` para Expo SDK 58 (`expo` 58.0.23), Expo Router 58.0.30, React 19.3.0 e React Native 0.88.1; os módulos Expo foram alinhados com `expo install --fix`.
- Removida a propriedade `newArchEnabled`, que deixou de ser configurável no SDK 55+, e migrada a configuração antiga de splash para o plugin oficial `expo-splash-screen`, preservando `assets/splash.png`, modo `contain` e fundo `#0F0F0F`.
- Atualizado o target iOS de 16.0 para 16.4, mínimo de SDK 56+; bundle ID, package, scheme, permissões e versão `0.0.2` foram preservados.
- Adaptados os tipos/propriedades da barra de tabs do parceiro ao Router 58 e os tipos do WebView; declarada `@expo/vector-icons`, que já era importada no login, e removida a dependência dotLottie não utilizada.
- Atualizado `mobile/README.md` para SDK/Router 58 e target iOS 16.4.
- Verificações finais: `npm run typecheck` passou; `npx expo-doctor@latest` passou 20/20; `npx expo install --check` informou dependências atualizadas; `npx expo export --platform ios` concluiu com bundle iOS de 7.7 MB.
- `git diff --check` nos arquivos da migração passou. A verificação ampla também apontou whitespace já existente em `mobile/app/_layout.tsx`; esse arquivo foi preservado sem alterações desta migração.
- Não há script de lint separado no `mobile/package.json`. O Expo Doctor indicou Xcode local 26.2 incompatível para builds nativos SDK 57+; não foi executado build nativo/EAS. Isso não impede validar o bundle com Expo Go.
- Resta teste manual no iPhone: iniciar `npx expo start --go` dentro de `mobile/`, abrir via QR no Expo Go SDK 58 e verificar login/navegação. A sessão física não foi acessada pelo agente.
