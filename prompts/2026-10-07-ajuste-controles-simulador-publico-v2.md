# Plano incremental — controles e campos da amortização

## Objetivo

Corrigir o refinamento visual apontado na revisão do simulador público:

- os dois segmentos do toggle devem usar o vermelho Mercúrio quando ativos;
- os `selects` devem ter um único indicador de abertura, sem a seta nativa duplicada;
- os controles precisam ter dimensões explícitas e legíveis, compatíveis com a referência;
- a etapa inicial deve exibir claramente valor, data de início, taxa, sistema de amortização, periodicidade e quantidade de parcelas.

## Código/documentação revisados

- `app/src/components/PublicSimulatorModeToggle.tsx`;
- `app/src/components/PublicAmortizationSimulator.tsx`;
- `app/src/components/PublicSimulator.tsx`;
- `app/src/components/MoneyInput.tsx`;
- `docs/operacao/simulador-publico.md`;
- `prompts/2026-10-07-ajuste-controles-simulador-publico.md`.

## Decisões

- manter o toggle como pílula segmentada acessível, com `aria-selected` e foco de teclado;
- usar `bg-red-600` para os dois estados ativos;
- aplicar `appearance-none` aos `selects` e manter apenas o ícone `ChevronDown` controlado pelo componente;
- usar altura, padding e tamanho de fonte explícitos nos controles da etapa de valores;
- não alterar cálculo, payload, persistência, rota ou regras de negócio.

## Critérios de aceite

1. Home Equity e Amortização ficam vermelhos quando ativos.
2. Os dois `selects` exibem somente uma seta e têm o mesmo porte visual dos demais campos.
3. A etapa inicial mostra os seis campos da calculadora de amortização, organizados em três colunas no desktop e uma coluna no mobile.
4. O fluxo, os testes de acessibilidade existentes e a captura permanecem funcionando.
5. Typecheck, lint e build continuam aprovados.

## Segurança e rollback

Alteração somente visual, sem migration, Edge Function, segredo ou escrita de dados. O rollback é a restauração das classes anteriores.

## Testes

- testes públicos existentes;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- inspeção manual da etapa inicial em desktop/mobile e dos estados ativo/inativo do toggle.

## Aprovação

A implementação começa após aprovação deste plano incremental.

## Registro de implementação — 2026-10-07

Plano aprovado e implementado. Os dois estados ativos do toggle agora usam vermelho Mercúrio. Os seis campos da etapa inicial da amortização permanecem explícitos no grid de três colunas, com controles de 56px, e os `selects` usam `appearance-none` para evitar a seta nativa duplicada. Campos de contato, CEP e renda também seguem o mesmo porte visual.
