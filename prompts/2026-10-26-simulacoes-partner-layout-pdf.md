# Ajuste visual do simulador comercial e da prévia em PDF

## Objetivo

Reproduzir em `/p/simulacoes` o layout desktop do TSX, CSS e screenshot fornecidos: cabeçalho, formulário à esquerda, resultado à direita, aviso financeiro e ações. Ajustar o documento impresso para seguir a hierarquia da calculadora pública, preservando o cronograma completo e a geração local de PDF.

## Skills e documentos lidos

- `AGENTS.md` enviado nesta conversa; `docs/README.md`; `skills/UX_skills.md`; skill `pdf`.
- `docs/blueprint/02-roles-permissions.md`, `03-routes-navigation.md`, `06-modules-features.md`; `docs/operacao/simulador-publico.md`.
- Plano aprovado `prompts/2026-10-13-exportacao-simulacoes-pdf-xlsm.md`.

## Código e referência inspecionados

- `app/src/pages/partner/Simulacoes.tsx`, `app/src/components/SimuladorCredito.tsx`, `MoneyInput.tsx`, `SimulacaoCreditoPdf.tsx`, `PublicSimulator.tsx`, `PublicAmortizationResult.tsx`.
- `app/src/lib/simulacaoCreditoPdf.ts`, `app/src/index.css`, `app/src/pages/partner/Wizard.tsx`, `app/src/test/simulacaoCreditoPdf.test.tsx` e scripts de `app/package.json`.
- Anexos TSX/CSS do usuário e screenshot atual da referência visual.

## Decisões e suposições

- A referência define o visual; seus números fixos são apenas exemplos. A tela continuará usando o estado e o motor de cálculo existentes.
- O PDF seguirá a organização e o comportamento de impressão de `/simulador` (cabeçalho Mercúrio, resumo, avisos e cronograma paginado); não copiará dados pessoais nem as regras de amortização extra, que pertencem à outra calculadora.
- Manter todos os produtos, PF/PJ, taxa configurada, correção, PRICE/SAC, prazo, carência, `wa.me`, draft/conversão, impressão e mensagens de carregamento/erro.
- A taxa seguirá somente leitura como hoje; os limites de prazo e carência existentes prevalecem sobre os valores demonstrativos do anexo.
- IOF, TAC, registro, seguros e variação futura do IPCA continuarão fora do cálculo e descritos como pendentes. Não criar parâmetros financeiros nem alterar banco, RLS, APIs ou a rota pública.
- Usar TSX e CSS escopado à página; todos os botões novos/alterados usarão `btn-no-liquid`. O componente de impressão compartilhado com o wizard receberá o mesmo tratamento visual sem mudar suas entradas ou cálculo.

## Arquivos esperados

- `app/src/pages/partner/Simulacoes.tsx` e novo CSS escopado na mesma pasta.
- `app/src/components/SimulacaoCreditoPdf.tsx` e, se necessário, CSS de impressão escopado.
- Testes existentes apenas se alguma asserção de apresentação precisar ser atualizada; sem novos testes que apenas espelhem o markup.

## Requisitos e critérios de aceite

- Desktop fiel à referência: duas colunas, formulário agrupado, resultado destacado, alerta e ações alinhadas; mobile empilha os painéis sem corte nem perda de controles.
- Todos os controles mantêm cálculo e estado em tempo real; PF/PJ e produtos reais continuam disponíveis. Estados de premissas carregando/erro permanecem legíveis.
- PDF contém os mesmos valores da tela e o cronograma completo, com logo, aviso de encargos pendentes, A4, cabeçalho de tabela repetido, linhas sem quebra e sem controles da interface.
- Compartilhamento continua manual e conversão continua no wizard autorizado. Nenhuma gravação ou envio é disparado pela prévia.
- Foco de teclado visível e botões sem estilo liquid na tela.

## Segurança

- Não expor chaves, tokens, dados privados adicionais ou premissas financeiras de rascunho.
- Preservar permissões e escopo de partner; não alterar endpoints nem payloads de captura pública.
- Valores no PDF vêm do estado autorizado e do motor atual; nenhum encargo pendente aparece como zero ou calculado.

## Verificações previstas

- `npm run lint`, `npm run typecheck`, `npm run build` em `app/`; executar os testes de simulador/PDF pertinentes.
- Navegador desktop e mobile: alterar todas as entradas, verificar PRICE/SAC, estados de premissa, foco e responsividade; acionar impressão e renderizar PDF de prazo longo para revisar todas as páginas, tabela e rodapé.
- Confirmar que WhatsApp abre composição revisável e que converter navega ao wizard sem persistência não autorizada; não enviar mensagem nem gravar proposta de teste.

## Aprovação

Aprovado pelo usuário em 26/10/2026. Implementação local, sem deploy.
