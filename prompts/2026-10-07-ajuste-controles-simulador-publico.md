# Plano — padronização dos controles do simulador público

## Objetivo

Ajustar a apresentação do simulador público de amortização para que os campos tenham o mesmo porte e tratamento visual do layout da Mercúrio, com foco nos `selects` nativos que hoje aparecem pequenos e no seletor entre os dois simuladores. O toggle deve usar um controle horizontal em formato de pílula, semelhante a um on-off, mantendo os rótulos **Simulador de parcelas** e **Amortização** e o comportamento atual da rota.

## Documentos e código consultados

- `docs/README.md`;
- `docs/operacao/simulador-publico.md`;
- `docs/operacao/change-management.md`;
- `app/src/components/PublicSimulatorModeToggle.tsx`;
- `app/src/components/PublicAmortizationSimulator.tsx`;
- `app/src/components/PublicSimulator.tsx`;
- `app/src/pages/public/Simulador.tsx`;
- estilos compartilhados de `app/src/index.css`, incluindo `.input`, `.label` e `.btn-no-liquid`;
- testes públicos existentes do simulador.

## Decisões e suposições

- A referência fornecida é a fonte visual: controles com altura confortável, borda consistente, tipografia legível e foco visível.
- O toggle permanece acessível como `role="tablist"`/`role="tab"`, mas ganha aparência de pílula segmentada com indicador ativo e estados de teclado/foco.
- Os `selects` da etapa de valores devem usar a mesma altura mínima, largura, tipografia, borda e raio dos demais `.input`; não será substituído o comportamento nativo por uma biblioteca nova.
- Os campos numéricos e de data da etapa de valores também serão alinhados ao mesmo padrão, sem alterar cálculo, payload, validações ou modelo de dados.
- A alteração vale para a rota `/simulador` e para o simulador embutido na landing, pois ambos reutilizam os componentes públicos.

## Arquivos esperados

- `app/src/components/PublicSimulatorModeToggle.tsx` — novo estilo de toggle;
- `app/src/components/PublicAmortizationSimulator.tsx` — padronização dos controles da etapa de valores, se necessário;
- `app/src/components/PublicSimulator.tsx` — somente se o toggle ou estilos compartilhados exigirem alinhamento no modo Home Equity;
- testes existentes ou novo teste visual/comportamental mínimo para confirmar os estados ativo/inativo e a preservação da troca de modo;
- `docs/operacao/simulador-publico.md` — registrar o ajuste visual e a validação.

## Critérios de aceite

1. O toggle ocupa uma faixa horizontal confortável, com dois segmentos igualmente largos, raio de pílula e estado ativo claramente visível.
2. Os dois segmentos mantêm contraste suficiente, foco de teclado e indicação sem depender apenas de cor.
3. `select`, data, taxa e quantidade de parcelas têm altura e tipografia visualmente compatíveis com os demais campos da etapa.
4. A troca entre Home Equity e amortização continua na mesma rota, sem perder o estado indevidamente nem alterar o payload de captura.
5. O layout permanece utilizável em desktop e viewport estreita, sem overflow horizontal.
6. Nenhuma regra de cálculo, persistência, e-mail, autenticação ou integração externa é modificada.

## Segurança e rollback

É uma alteração somente de apresentação. Não haverá mudança de banco, Edge Function, segredos ou dados. O rollback consiste em restaurar as classes anteriores dos componentes.

## Testes

- teste comportamental existente do simulador público;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- validação manual em `/simulador` e na landing, nos estados ativo/inativo, foco por teclado, abertura dos `selects` e viewport móvel.

## Aprovação

A implementação começa somente após aprovação deste plano.

## Registro de implementação — 2026-10-07

Plano aprovado e implementado. O toggle agora usa uma pílula segmentada responsiva com foco visível, e os controles de valores, data, taxa, quantidade, moeda e escolhas dos dois modos receberam altura, espaçamento e tipografia padronizados. O cálculo, o payload, a captura de leads e a rota permaneceram inalterados.

Validações executadas: testes dos dois fluxos públicos (4 testes aprovados), `npm run typecheck`, `npm run lint` (0 erros e avisos preexistentes) e `npm run build`. A rota local respondeu com HTTP 200; a inspeção visual interativa não pôde ser aberta nesta sessão porque nenhum navegador CUA estava disponível.
