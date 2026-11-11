# Correção de avisos do Expo Router

## Objetivo

Remover o uso depreciado de `unstable_settings.initialRouteName` no layout de parceiro e alinhar `anchor` com `backBehavior`.

## Arquivo inspecionado

- `mobile/app/(parceiro)/_layout.tsx`

## Alteração

Trocar `initialRouteName: 'dashboard'` por `anchor: 'dashboard'` e `backBehavior="history"` por `backBehavior="initialRoute"`, conforme o aviso emitido pelo Expo Router.

## Aceite

O Metro não deve mais emitir esses dois avisos ao abrir a navegação do parceiro. Nenhuma rota, dado ou regra de negócio será alterada.

## Validação

Rodar typecheck e iniciar o Metro em modo não interativo para confirmar a configuração.

## Resultado

Aplicado `anchor: 'dashboard'` e `backBehavior="initialRoute"` no layout do parceiro. O typecheck passou e o Metro iniciou normalmente em uma porta alternativa, sem emitir os avisos de `initialRouteName` ou incompatibilidade de `backBehavior` durante a inicialização.
