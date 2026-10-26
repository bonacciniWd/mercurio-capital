# Plano — corrigir a impressão do cronograma de amortização

## Objetivo

Corrigir a impressão/PDF da tela de resultados do simulador público de amortização. O PDF deve aparecer somente depois que o usuário salvar pelo menos um plano válido de amortização extra. Quando houver plano, incluir também o gráfico de comparação das parcelas no documento. O início do documento deve aparecer inteiro e os cronogramas completos devem continuar paginando sem cortes ou sobreposição.

## Skills e documentos lidos

- Skill `pdf` em `/Users/macbook/.codex/plugins/cache/openai-primary-runtime/pdf/26.1011.11113/skills/pdf/SKILL.md`.
- `AGENTS.md` fornecido pelo dono do produto nesta conversa.
- `docs/README.md`.
- `docs/operacao/simulador-publico.md`.
- `docs/operacao/change-management.md`.
- `docs/operacao/release-checklist.md`.
- `prompts/2026-10-13-exportacao-simulacoes-pdf-xlsm.md`.

## Código e interface inspecionados

- `app/src/components/PublicAmortizationResult.tsx`: botão de impressão, documento com resumo, dois cronogramas e CSS `@media print`.
- `app/src/test/publicAmortizationSimulator.test.tsx`: regressões do fluxo público e planos extras.
- `app/src/components/SimulacaoCreditoPdf.tsx`: referência de impressão local usada no simulador de crédito.
- `app/src/index.css`: estilos globais; há alterações locais alheias a esta tarefa e elas devem ser preservadas.
- Chrome aberto em `http://localhost:5173/`: a página contém o botão de PDF e um documento de impressão oculto com dois cronogramas e 480 linhas nesta simulação. O CSS atual posiciona o documento de impressão com `position:absolute; inset:0`; isso é suspeito para um conteúdo que precisa fragmentar-se por várias páginas. Ainda falta confirmar o defeito visual no PDF renderizado.
- O gráfico visível “Comparativo das parcelas” já usa três séries (sem amortização, com amortização e amortização extra), alimentadas por `chartData`. Ele está fora do documento de impressão. `savePlan()` valida e inclui o plano em `plans`; `plans.length > 0` indica que há ao menos um plano extra salvo. Hoje o botão “Salvar como PDF” aparece mesmo sem plano.

## Decisões e suposições

- O escopo é somente a experiência de impressão/PDF do simulador público de amortização, o gráfico comparativo no PDF e a condição de exibição do botão.
- A falha provável está no isolamento/paginação do documento de impressão: conteúdo extenso é retirado do fluxo normal por `position:absolute`. A correção deve manter o documento isolado da tela e permitir paginação em fluxo normal; uma opção é renderizá-lo no `document.body` via portal React e ocultar a aplicação durante a impressão.
- O botão e o documento PDF ficam disponíveis somente quando existe ao menos um plano extra válido salvo. Abrir o editor ou preencher um rascunho ainda não conta como plano selecionado; cancelar o editor não libera o PDF. Ao remover o último plano, o botão e o documento voltam a ficar indisponíveis.
- Com plano salvo, o PDF inclui um gráfico estático de comparação coerente com o gráfico da tela, usando as séries já calculadas para os cenários base e com amortização. O gráfico não deve depender do dimensionamento interativo de `ResponsiveContainer` no modo de impressão; pode ser montado como SVG estático a partir de `chartData` sem nova dependência. Sem plano extra, não mostrar o gráfico de comparação no PDF.
- Preservar valores, fórmulas, planos extras, ordem e conteúdo dos dois cenários, cabeçalhos repetidos, logo e nome do arquivo.
- Não alterar a calculadora de parcelas, a exportação de crédito, a captura de leads, banco, Supabase, e-mails ou Vercel.
- Nenhum dado da simulação será enviado ao servidor. A validação manual usará o estado local já aberto ou dados sintéticos, sem finalizar captura de lead.

## Arquivos esperados

- `app/src/components/PublicAmortizationResult.tsx`: botão condicionado a plano válido, gráfico estático de impressão, isolamento do documento e regras de impressão/paginação.
- `app/src/test/publicAmortizationSimulator.test.tsx` ou teste dedicado do componente: verificar que não há ação/documento imprimível antes de salvar plano; que salvar e remover plano habilitam/desabilitam o PDF; e que com plano o documento contém gráfico, resumos, duas tabelas, cabeçalhos e linhas completas.
- `docs/operacao/simulador-publico.md`: registrar o comportamento e os testes depois da validação.

## Critérios de aceite

- Sem plano extra salvo, o botão/documento de PDF não ficam disponíveis. Após salvar um plano válido, o botão aparece; depois de remover o último plano, desaparece novamente.
- Com plano, a impressão inicia com logo, título, dados principais e comparativo dos cenários completos, incluindo o gráfico de comparação das parcelas, sem bloco deslocado, cortado ou sobreposto.
- Ambos os cronogramas aparecem integralmente, com cabeçalho repetido nas páginas subsequentes e linhas sem quebra interna.
- A impressão ocupa o fluxo A4 sem páginas em branco antes do conteúdo e sem controles da aplicação.
- O botão continua abrindo o diálogo nativo e conserva o nome de arquivo atual.
- Nenhuma fórmula, total, plano, captura ou persistência sofre alteração.

## Segurança e escopo

- A impressão continua local no navegador e não grava o PDF no servidor/Storage nem enfileira e-mail.
- Não incluir dados reais em fixtures, logs ou documentação.
- Nenhuma dependência nova, migration, Edge Function, release ou deploy nesta tarefa.

## Testes

- Automático: teste focado do componente para verificar o estado sem plano, habilitação após salvar, desabilitação após remover o último plano, gráfico no documento com plano, resumos, duas tabelas, cabeçalhos e itens de cronograma; suíte relacionada, typecheck, lint, build e `git diff --check`.
- Manual no Chrome em `localhost:5173`: confirmar que o botão não aparece antes de salvar plano; salvar um plano sintético, abrir **Salvar como PDF**, revisar gráfico, início e páginas seguintes, conferir ambos os cronogramas completos, nome do arquivo, paginação e ausência de controles; cancelar o diálogo sem salvar dados reais. Remover o último plano e confirmar que o botão some.
- Se a revisão visual exigir salvar uma amostra, usar dados sintéticos e um diretório temporário; inspecionar as páginas renderizadas antes de considerar concluída.

## Rollout e rollback

- Entrega local para revisão. Publicação em Vercel não está incluída.
- Rollback limitado ao diff de `PublicAmortizationResult.tsx`, teste e documentação desta tarefa.

## Execução e validação — 2026-10-20

- Implementados o portal de impressão em fluxo normal, largura A4 com tabela de colunas fixas, gráfico SVG no PDF e botão condicionado a plano extra válido salvo.
- Testes: 35 arquivos e 130 testes passaram com `npm test -- --maxWorkers=2 --testTimeout=15000`; typecheck, build e lint passaram. O lint reporta 38 avisos existentes, sem erros.
- Smoke no Chrome headless em `localhost:5173/simulador`, sem enviar lead: o PDF de 240 parcelas produziu sete páginas. Todas foram renderizadas e revisadas; logo/resumo/gráfico no início, cabeçalhos repetidos, margens consistentes e rodapé no final.
- Não houve alteração de backend, deploy ou publicação.
