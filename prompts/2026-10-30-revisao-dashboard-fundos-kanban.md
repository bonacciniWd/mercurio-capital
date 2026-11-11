# Plano — revisão do Dashboard Admin, fundos vencedores e Kanban

**Status:** plano aprovado; implementação local e verificações de código concluídas. A migration ainda não foi validada em banco local/teste nem aplicada ao remoto; nenhuma publicação foi executada.

**Referência visual complementar recebida em 2026-10-30:** adaptar a distribuição por fundos ao TSX/CSS fornecido: superfície cinza quente, moldura clara, lista de fundos em abas à esquerda, painel de detalhe bege-claro à direita, métricas em quatro colunas, card de proposta e alerta inferior. Usar exclusivamente dados reais das consultas e navegação existente; os exemplos hardcoded no protótipo não devem entrar no app. Manter a responsividade da referência, a classe `btn-no-liquid` e os mesmos limites de acesso/admin definidos neste plano.

**Correção complementar pedida em 2026-10-30:** a lista e o detalhe precisam permanecer lado a lado em larguras desktop com a sidebar interna; ao selecionar um fundo, listar todas as propostas vinculadas em ordem decrescente de criação, sem dropdown que oculte as demais. A RPC de detalhe ainda não foi aplicada no Supabase remoto. A tela consulta `proposta_fundos`, `propostas` e `clientes` diretamente sob RLS de Admin e pagina até 50 linhas por chamada. A lista inclui Standby para corresponder a todas as atribuições; os agregados continuam excluindo Standby das operações e volumes elegíveis.
**Referência visual:** screenshot fornecido pelo dono do produto nesta conversa, com lista de fundos à esquerda e detalhe do fundo/proposta à direita.
**Snapshot principal:** banco remoto em 30/10/2026, às 15:26:40 de São Paulo. As consultas posteriores de conciliação encontraram os mesmos totais.

## 1. Objetivo e limite

Revisar e conciliar a distribuição por fundos, a escolha do primeiro fundo aprovado, volume solicitado, ganho, liberado e conversão. Conferir as etapas dos três produtos, seu mapeamento no Kanban e o efeito de cada etapa nas métricas. Aplicar posteriormente a referência visual ao card do Dashboard, mantendo suas ações e permissões.

Nesta etapa foi autorizado o levantamento e a preparação do plano. Não houve alteração funcional, escrita no banco, correção histórica, migration ou deploy. Não interpretar aprovação deste plano como autorização de preencher datas históricas ou publicar em produção.

## 2. Skills, documentos e código inspecionados

- `AGENTS.md` fornecido pelo dono do projeto nesta conversa.
- `skills/UX_skills.md`: revisão em modo full; manter o sistema Tailwind/React, referências reais, acessibilidade e distinção entre evidência estática e validação visual.
- `docs/README.md`, `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md` e seção 18 de `docs/operacao/runbooks.md`.
- `docs/blueprint/06-modules-features.md` e `docs/handoffs/16-handoff-fase-fundos-docs.md`.
- Planos `2026-09-18-dashboard-status-configuracoes`, `2026-10-02-edicoes-dashboard-global`, `2026-10-08-dashboard-padrao-mensal-distribuicao-fundos` e `2026-10-16-kanban-standby-pre-aprovado`.
- Web: `pages/admin/Dashboard.tsx`, `pages/admin/Relatorios.tsx`, `components/FundoDistribuicaoCard.tsx`, `components/PropostaFundos.tsx`, `components/PropostasKanban.tsx`, `pages/admin/PropostaDetalhe.tsx`, `lib/fundosDashboard.ts`, `lib/propostaStatus.ts`, `lib/fundoStatus.ts`, `lib/queryClient.ts` e consumidores das views no Dashboard/Relatórios do parceiro.
- Banco: migrations de fundos, primeira aprovação, analytics, histórico de comissão, views de KPIs e validação de transição. Smoke existente `supabase/smoke-tests/fase-35-dashboard-fundos.sql` inspecionado; ele verifica objetos, não conciliação de valores.
- Mobile: mapeamento de status e agrupamento no Kanban inspecionados para identificar impacto; implementação/publicação mobile não faz parte desta entrega.

## 3. Regras existentes confirmadas

| Conceito | Regra vigente | Base temporal |
| --- | --- | --- |
| Atribuição | Vínculo de uma proposta a um fundo; uma proposta pode ter vários | Criação da proposta no recorte do Dashboard |
| Fundo vencedor | Primeiro vínculo com `aprovado_em` preenchido, ordenado por data e `fundo_id` | Primeira aprovação preservada, mesmo após mudança do status do vínculo |
| Volume solicitado | Soma de `valor_solicitado`, excluindo Standby; canceladas continuam compondo a produção registrada | `propostas.created_at`, em São Paulo |
| Volume solicitado por fundo | A mesma base monetária, atribuída exclusivamente ao vencedor | Criação da proposta |
| Volume ganho | `valor_solicitado` em `registro_af`, `recurso_liberado`, `pagamento_comissao` e `completo` | Criação da proposta + status atual |
| Conversão | Quantidade ganha / quantidade criada, excluindo Standby do denominador | Mesma coorte de criação; canceladas integram o denominador |
| Volume liberado exibido | `valor_solicitado` das propostas atualmente em Pagamento de Comissão/Concluído, pela primeira entrada real no histórico em `pagamento_comissao` | Data de entrada em comissão, não criação |
| Liberação operacional | Soma de `liberacoes_recurso.valor_liberado` | `liberacoes_recurso.data_liberacao` |

Não transformar aprovação de um fundo em ganho financeiro automático. Não trocar o primeiro vencedor por um fundo aprovado mais recentemente. Não confundir o indicador comissional de liberado com o dinheiro registrado em `liberacoes_recurso`. A conversão atual não é uma taxa entre duas colunas vizinhas do Kanban.

O SQL atual também não exclui `simulacao` de produção/conversão. Não há propostas nesse status no snapshot; uma revisão dessa regra para rascunhos exigirá decisão expressa, sem mudança silenciosa neste ajuste.

## 4. Levantamento real e conciliação

### Outubro de 2026 — mesmo mês da referência

| Indicador | Resultado |
| --- | ---: |
| Propostas criadas | 44 |
| Standby | 1 |
| Base sem Standby | 43 |
| Canceladas, dentro da base de produção | 14 |
| Propostas com vencedor | 3 |
| Solicitado atribuído aos vencedores | R$ 13.250.000,00 |
| Sem vencedor, excluindo Standby | 40 / R$ 108.006.922,12 |
| Solicitado total da coorte | R$ 121.256.922,12 |
| Ganhas da coorte / conversão | 0 / 0% |
| Liberado por entrada em comissão durante outubro | 4 propostas / R$ 8.655.000,00 |

As quatro entradas em comissão de outubro são de propostas criadas anteriormente. Por isso o liberado do mês pode ser positivo quando a coorte criada no mês ainda tem ganho zero.

| Fundo | Atribuições no mês | Operações vencedoras | Solicitado único | Ganho |
| --- | ---: | ---: | ---: | ---: |
| BARI | 6 | 1 | R$ 6.000.000,00 | R$ 0,00 |
| Galleria | 26 | 1 | R$ 5.500.000,00 | R$ 0,00 |
| GV CASH | 13 | 1 | R$ 1.750.000,00 | R$ 0,00 |
| GUARDIAN / HERICK SFH / IFINQ / Inter / TRINUS | 3 / 1 / 2 / 8 / 1 | 0 | R$ 0,00 | R$ 0,00 |

Os números principais da referência são reproduzidos pela regra atual. Entretanto, o vencedor GV CASH de R$ 1,75 milhão está em proposta cancelada. Isso permanece no solicitado da produção, não em ganho. Entre as 40 operações sem vencedor, há **13 canceladas, somando R$ 20.253.000,00**. As outras 27 somam R$ 87.753.922,12. O texto atual de que todas estão aguardando primeira aprovação é inadequado para o grupo cancelado.

Conciliação monetária atual: **R$ 13.250.000,00 + R$ 108.006.922,12 = R$ 121.256.922,12**. A soma das atribuições não deve ser usada como quantidade de propostas únicas.

### Todo o histórico

- 219 propostas, 328 vínculos com fundos, 6 Standby e 80 canceladas.
- 130 propostas com primeiro vencedor, incluindo 2 Standby. A contagem por fundo inclui essas duas; a contagem global exclui Standby. Assim, hoje a reconciliação de quantidade dá **130 + 85 = 215**, diante de **213** propostas sem Standby. Correção prevista: 128 vencedoras elegíveis + 85 sem vencedor = 213.
- 82 propostas ganhas, todas com vencedor; volume ganho R$ 355.417.737,54. Conversão histórica na regra vigente: 82 / 213 = **38,5%**.
- 81 propostas em Pagamento de Comissão/Concluído: 29 com primeira entrada em comissão conhecida; **52 sem essa data**, somando **R$ 290.465.919,46**. Esse aviso é histórico dentro do filtro de vínculo/parceiro, não apenas da coorte de criação do mês.
- Não há linhas em `liberacoes_recurso`. Isso significa ausência do registro operacional nessa tabela; não significa ausência de liberações reais.
- Oito vencedores têm hoje outro status no vínculo: 6 aguardando, 1 atenção e 1 rejeitado. A manutenção do vencedor histórico segue a regra aprovada; a interface precisa distinguir esse evento do status atual.
- Não foram encontradas aprovações sem data, empates na primeira data de aprovação ou divergências entre as datas preservadas e os eventos de auditoria disponíveis. Não foi identificado ganho sem vencedor no snapshot.

### Filtro por fundo

O filtro superior seleciona propostas **vinculadas** ao fundo. A distribuição financeira seleciona o **vencedor**. São conjuntos distintos, atualmente sem decomposição suficiente na tela. Exemplo: BARI em outubro tem R$ 16.298.922,12 no conjunto vinculado e R$ 6.000.000,00 de atribuição financeira vencedora.

Quando selecionado um fundo, conciliar a base vinculada em três parcelas sem duplicação: vencedor nesse fundo + vencedor em outro fundo + ainda sem vencedor, sempre com o mesmo tratamento de Standby e canceladas. Não reinterpretar o filtro silenciosamente como filtro exclusivo de vencedor.

## 5. Etapas e serviços — resultado da revisão

Hoje há **um pipeline comum**, no frontend e no validador do banco, para Home Equity, Crédito Construção e Financiamento Imobiliário. Não foi encontrada configuração de sequência por produto. Admin operacional pode mover entre etapas; a restrição de partner/team member continua sendo server-side e por vínculo.

Sequência web: Pré-análise → Análise Jurídica → Análise Crédito → Pré-aprovado → Análise Imóvel → Comitê → Proposta ao Cliente → Diligência Jurídica → Emissão de Contrato → Aguardando Assinatura → Protocolo Cartório → Exigências Cartório → Custas Cartório → Registro de AF → Recurso Liberado → Pagamento de Comissão → Concluído. Standby é coluna avulsa inicial; Rascunho e Cancelado possuem visões próprias.

| Produto | Propostas | Ganhas | Standby | Canceladas | Com vencedor, incluindo Standby |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home Equity | 153 | 53 | 5 | 53 | 83 |
| Crédito Construção | 12 | 3 | 1 | 7 | 5 |
| Financiamento Imobiliário | 54 | 26 | 0 | 20 | 42 |

Aliases existentes: `contrato_registrado` → `registro_af`, `em_registro` → `protocolo_cartorio`, `resolucao_pendencias` → `diligencia_juridica`. Atualmente não há linhas nesses três status legados. Algumas views antigas classificam ganho por `contrato_registrado`, mas não por `registro_af`; a RPC atual faz o contrário. Essa inconsistência precisa de alinhamento sem reclassificar propostas persistidas ou criar novas etapas.

Na implementação, documentar a matriz produto × etapa × significado financeiro usando o pipeline vigente. Variações específicas de etapas por serviço só serão criadas se o dono do produto definir essas diferenças; o levantamento não as presume.

## 6. Revisão UX — Scope and Coverage

Modo full. Escopo: card de fundos e sua relação com os KPIs, Kanban e detalhe administrativo. Stack React 18/TypeScript/Tailwind, TanStack Query, Supabase. A screenshot é referência de layout, não evidência de interação executada no navegador.

| Domínio | Evidência | Cobertura |
| --- | --- | --- |
| Acessibilidade | Estrutura semântica do card atual; referência fornecida | Verificado no código; teclado, foco e contraste medido no browser ainda não verificados |
| Layout | Componente atual em tabela versus referência de duas áreas | Diferença estrutural confirmada; responsividade real ainda não verificada |
| Writing | Texto do aviso, nomes de KPIs, regras SQL e dados reais | Divergências abaixo |
| Typography | Classes Tailwind e tokens existentes | Sem conclusão sobre legibilidade/contraste renderizados antes do teste de browser |
| UI polish | Componentes e convenção `btn-no-liquid` | Aplicar referência usando tokens existentes; não avaliar animações sem runtime |

### Findings

| # | Severidade / domínio | Localização | Antes / evidência | Depois proposto / motivo |
| --- | --- | --- | --- | --- |
| 1 | HIGH / Consistência de dados | `supabase/migrations/20261003000001_dashboard_fundos_primeira_aprovacao.sql:254` e `:279` | Contagem por vencedor inclui Standby; global exclui. Diferença histórica de 2 propostas. | Mesma base elegível em contagens, volumes e conciliação; manter atribuições operacionais separadas. |
| 2 | HIGH / Qualidade de dados | `supabase/migrations/20260918000007_dashboard_commission_history.sql:20` e `:50` | 52 propostas comissionáveis sem evento/data; R$ 290,47 milhões não podem ser alocados a um mês com segurança. | Expor pendência por proposta e reutilizar correção histórica auditada somente quando houver data/evidência confirmada. Não usar criação/atualização como substituto. |
| 3 | MEDIUM / Writing | `app/src/components/FundoDistribuicaoCard.tsx:141` | Trata o grupo sem vencedor como aguardando aprovação; inclui 13 canceladas em outubro. Solicitado vencedor inclui outra cancelada. | Exibir composição ativa/cancelada do solicitado e do grupo sem vencedor, preservando os totais de produção aprovados. |
| 4 | MEDIUM / Writing e escopo de métricas | `supabase/migrations/20260918000007_dashboard_commission_history.sql:13` e `supabase/migrations/20261003000001_dashboard_fundos_primeira_aprovacao.sql:247` | Filtro por vínculo e valor por vencedor têm populações diferentes. | Decompor vínculo/vencedor em outro fundo/sem vencedor e explicitar data-base; não somar volumes representados repetidos. |
| 5 | MEDIUM / Identificação de estado | `app/src/components/PropostaFundos.tsx:40` e `app/src/components/PropostasKanban.tsx:142` | Leituras não trazem `aprovado_em`; não exibem o vencedor histórico. Oito vencedores hoje têm status diferente de aprovado. | Mostrar vencedor e data separadamente do status atual; não marcar todas as aprovações como vencedoras. |
| 6 | MEDIUM / Atualização da interface | `app/src/components/PropostaFundos.tsx:67`, `app/src/components/PropostasKanban.tsx:190`, `app/src/pages/admin/PropostaDetalhe.tsx:506` e `app/src/lib/queryClient.ts:6` | Mutações não invalidam todos os KPIs/distribuição e superfícies relacionadas; foco da janela não refaz consultas por padrão. | Invalidar as chaves relacionadas após sucesso e cobrir retorno entre Kanban/detalhe/Dashboard. |
| 7 | MEDIUM / Classificação de etapa | `supabase/migrations/20260918000005_standby_metrics_views.sql:5` e `supabase/migrations/20260918000007_dashboard_commission_history.sql:44` | Views antigas reconhecem ganho no alias legado; analytics usa status canônico. | Mesmo mapeamento financeiro dos aliases existentes, sem migração silenciosa das linhas. |
| 8 | MEDIUM / Layout e exploração | `app/src/components/FundoDistribuicaoCard.tsx:82` | Tabela não oferece a seleção e o detalhamento da referência; RPC retorna só agregados. | Aplicar as duas áreas da referência com detalhes reais e leitura limitada/paginada. Um fundo com várias propostas não pode aparecer como se tivesse só uma. |

### Considered but Rejected

- Somar o valor inteiro em cada fundo atribuído: rejeitado, duplica o mesmo crédito.
- Promover automaticamente outro fundo quando o vencedor histórico mudar de status: rejeitado, contraria a primeira aprovação preservada.
- Resolver datas ausentes com `created_at`, `updated_at` ou aprovação do fundo: rejeitado, não comprova entrada em comissão.
- Tratar as três operações da referência como modelo de dado fixo ou usar nome/documento demonstrativo: rejeitado, devem vir da proposta real.

Não há arquivo Figma editável nesta tarefa; nenhum frame foi anotado. O relatório usa somente a referência fornecida e os arquivos citados.

## 7. Plano de implementação por etapas

### A. Consistência antes da apresentação

1. Corrigir a contagem por vencedor para a mesma elegibilidade de Standby usada no total.
2. Conciliar o agregado principal com solicitado/ganho por vencedor + sem vencedor. Em filtro por vínculo, incluir também o grupo cujo vencedor é outro fundo.
3. Adicionar ao retorno agregados ativos/cancelados/Standby claramente nomeados. Manter a definição de produção e o denominador de conversão aprovados.
4. Conferir liberado por fundo usando a entrada em comissão dentro do período, inclusive propostas criadas antes dele. Essa base não pode ser restringida pela CTE de criação do mês. Os fundos presentes no conjunto de liberação devem ser contemplados na conciliação, mesmo sem nova proposta criada no mês.
5. Alinhar aliases existentes nas classificações financeiras utilizadas pelos consumidores revisados; preservar nomes/contratos/RLS. Como altera views compartilhadas, validar consumidores partner/mobile sem redesenhar essas telas.

### B. Fundo vencedor visível e atualização

1. Ler `aprovado_em`/`aprovado_por` quando autorizado e reutilizar uma projeção canônica do vencedor do servidor. Não calcular o vencedor a partir de uma página incompleta de vínculos no cliente.
2. Kanban e detalhe: distinguir vencedor histórico, aprovação secundária e status atual; preservar todas as ações existentes.
3. Propagar invalidação de consultas após atualização de fundo, etapa, valor ou correção histórica. Não mostrar sucesso enquanto uma mutação tiver falhado.
4. Revisar limites: Kanban hoje solicita 500 propostas e a leitura de vínculos não pagina. O snapshot tem 219/328 e não está truncado; a implementação deve impedir que crescimento cause comparação silenciosa entre um quadro parcial e agregados completos.

### C. UI do Dashboard conforme referência

1. Manter a seção na tela atual. Cabeçalho com título, explicação e totais; lista de fundos com cores cadastradas à esquerda; fundo/operacão selecionados à direita.
2. Manter as quatro métricas da referência (atribuições, operações únicas elegíveis, solicitado e ganho). Os KPIs globais de liberado/conversão seguem suas bases explícitas, com detalhamento de conciliação acessível.
3. Apresentar protocolo, cliente/documento autorizado, prazo, taxa e valor reais da operação selecionada. Quando faltar dado, mostrar indisponível; não preencher dados de exemplo.
4. O badge deve nomear o estado da proposta selecionada ou o status do vínculo, com o escopo indicado; um fundo não tem um único status global “Em análise”. Participação usa o volume único vencedor do recorte como denominador, com zero tratado.
5. Identificar “operação selecionada” e permitir explorar o conjunto quando houver várias. O link abre o detalhe existente `/admin/propostas/:id`; não criar outro modal de proposta.
6. Tratar lista vazia, fundo sem vencedor, vencedor em proposta cancelada/Standby, campo ausente, erro e carregamento. Quebrar em coluna no mobile, manter foco visível e seleção por teclado, números tabulares, cores do sistema e `btn-no-liquid`.

### D. Qualidade histórica — etapa independente

1. Gerar relação restrita por protocolo das 52 pendências; relatório operacional não deve conter CPF/CNPJ, e-mail ou dados Serasa.
2. Reutilizar `admin_corrigir_entrada_pagamento_comissao(uuid,date,text)`, já existente, após confirmação da data e motivo em cada caso. Revisar seu uso sem inventar outra rotina de backfill.
3. Sem aprovação específica de correção dos registros, as pendências ficam visíveis e fora dos valores mensais. Esta etapa não bloqueia corrigir o cálculo e a UI.

## 8. Modelo de dados e contratos propostos para aprovação

Nenhuma nova tabela ou coluna persistida de vencedor. O vínculo continua sendo `propostas 1:N proposta_fundos N:1 fundos`; `propostas` tem `1:N proposta_status_historico` e `1:N liberacoes_recurso`. `aprovado_em` do vínculo permanece a evidência da primeira aprovação; o vencedor é derivado uma vez no servidor para todas as superfícies.

- Estender de forma aditiva o JSON de `admin_dashboard_fundos_analytics`, preservando os parâmetros e campos existentes. Novos grupos: conciliação, composição por situação e corte de liberação por entrada em comissão. Montantes continuam numeric em reais; contagens inteiras, datas em ISO, ausência como null; converter para centavos apenas no formatador existente.
- Propor uma RPC administrativa somente leitura para a lista/detalhe do fundo selecionado, com período, fundo, parceiro/equipe, limite até 50 e paginação estável. O contrato deve retornar apenas dados necessários ao card: protocolo/id, produto/status, valor solicitado, prazo, taxa, identificação autorizada do cliente, vencedor/data e status do vínculo. Documento pessoal fica fora do agregado geral e não vai para logs/fixtures.
- A consulta de detalhe e os agregados precisam compartilhar a definição de recorte, vencedor e elegibilidade. A assinatura final e os campos exatos devem ser descritos na migration antes de sua aprovação; não criar overloads ambíguos no PostgREST.
- Leitura exige o mesmo escopo administrativo existente; escrita continua nas RPCs operacionais atuais. Partner/client não recebem acesso à distribuição de fundos.
- A RPC de remoção já recusa apagar uma atribuição aprovada. A revisão encontrou policies de escrita direta para admin operacional e trigger apenas em insert/update; avaliar proteção equivalente contra remoção direta durante a revisão da migration, preservando manutenção autorizada e cascatas. Não foi executado teste de exclusão em produção.

## 9. Arquivos e superfícies esperados

- `app/src/pages/admin/Dashboard.tsx`, `app/src/components/FundoDistribuicaoCard.tsx`, `app/src/components/PropostaFundos.tsx`, `app/src/components/PropostasKanban.tsx`, `app/src/pages/admin/PropostaDetalhe.tsx`.
- Helpers de apresentação/invalidação em `app/src/lib/`, caso reduzam duplicação; reutilizar os existentes. Não adicionar biblioteca.
- Migration nova forward-safe para RPCs/projeção e classificação; nunca reescrever migrations aplicadas.
- Smoke SQL de conciliação e testes direcionados aos contratos numéricos e de seleção. Atualizar runbook de fundos e este plano.
- Impacto indireto em views de partner/mobile deve ser validado. Não há redesenho ou publicação desses canais. Serasa, WhatsApp, MERX, IA, financeiro contábil e comissões calculadas permanecem fora do escopo funcional.

## 10. Critérios de aceite e testes

1. Uma proposta em vários fundos soma o valor uma vez; a segunda aprovação não muda o vencedor, e alterar o status atual do vínculo não apaga a primeira data.
2. Contagens e volumes fecham nas mesmas bases: vencedoras elegíveis + sem vencedor = base sem Standby; valor por vencedores + sem vencedor = solicitado global. Por filtro de vínculo, contemplar também vencedor em outro fundo.
3. Standby não infla operações únicas elegíveis; cancelamento fica explícito sem alterar o solicitado histórico nem o denominador aprovado.
4. A liberação de uma proposta criada antes do mês aparece no mês da entrada em comissão; data ausente não recebe valor inventado. Múltiplas liberações operacionais não duplicam proposta/primeira entrada comissional.
5. Registro AF canônico e seu alias recebem o mesmo tratamento financeiro nas superfícies revisadas. Cada um dos três produtos possui casos cobrindo ganho, comissão, pré-aprovação, cancelamento e Standby.
6. Aprovar fundo no Kanban e nos detalhes atualiza a identificação de vencedor e os agregados ao voltar ao Dashboard. Falha mantém estado anterior e mostra erro.
7. A visualização reproduz a referência com dados reais, mantém a proposta selecionada/quantidade total explícitas e abre o detalhe existente.
8. Testes com duas aprovações, empate sintético, reversão de status, sem vencedor, somente canceladas, somente Standby, período vazio, virada de mês/fuso, filtros cruzados e mais registros que uma página. Fixtures sintéticas; não usar clientes reais em testes.
9. Após implementar: `npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers=1`, `npm run build` e revisão do diff. Smoke SQL com mutações somente em banco local/teste e transação revertida; produção recebe apenas verificações de leitura até autorização própria.
10. Navegador Admin: teclado/foco, erro/vazio/loading, troca de fundo, paginação, retorno de Kanban/detalhe e comparação numérica. Validar desktop conforme referência, zoom 200% e mobile; medir contraste renderizado. Essa validação ainda não foi executada nesta revisão.

## 11. Verification — evidência já executada

- `npx supabase migration list --linked`: versões relacionadas de analytics, fundos, primeira aprovação e histórico constam no remoto.
- `npx supabase db query --linked '<SQL>'`, sempre dentro de `BEGIN READ ONLY ... ROLLBACK`: inspeção de colunas, funções, triggers, policies e enums; agregações por produto/status/fundo e consistência das datas aprovadas.
- As definições remotas de analytics, atribuição/remoção, preservação de primeira aprovação, mudança de etapa e listagem coincidem com suas versões locais mais recentes. As views antigas foram confirmadas no catálogo remoto como sem `registro_af`.
- O SELECT analítico das duas RPCs foi reproduzido diretamente, com datas de outubro, a partir do corpo remoto e sem alterar claims/identidade: os resultados estão registrados nas tabelas acima.
- Evidências temporárias agregadas/esquema em `/tmp/mercurio-dashboard-*-20261030.json` e `/tmp/admin_dashboard_*-outubro-20261030.json`; nenhum nome, documento ou contato de cliente foi extraído para este plano.
- Nenhum teste de escrita, alteração funcional, lint/build ou teste visual autenticado foi feito nesta etapa documental. Os checks da correção MERX anterior não contam como validação deste novo escopo.

## 12. Implementação local aprovada

- Migration local `20261031000001_dashboard_fundos_conciliacao.sql`: alinha contagem elegível de vencedores, adiciona composição cancelada e vencedor em outro fundo, cria RPC administrativa de detalhes paginados (máximo 50) e projeção canônica do vencedor (máximo 500 IDs), e alinha `registro_af` com seu alias legado nas views/analytics.
- `FundoDistribuicaoCard.tsx`: troca a tabela compacta pelo layout de fundos à esquerda e operação detalhada à direita, usando agregados e registros reais, seleção, paginação, estados de erro/vazio/carregamento e indicação explícita de canceladas/sem vencedor.
- O refinamento visual segue a referência complementar de 30/10: lista de fundos em tabs com cores, painel de operação em fundo quente, status destacado, métricas em grid e detalhe em card. Conteúdo permanece real e vem das RPCs; não copiar fixture visual.
- A correção de 30/10 remove a dependência da RPC de detalhe ainda pendente remota, usa as tabelas protegidas por RLS e lista todas as operações do fundo em páginas de até 50, incluindo Standby com status explícito.
- `PropostasKanban.tsx` e `PropostaFundos.tsx`: exibem o primeiro fundo vencedor sem confundi-lo com status atual ou aprovação secundária.
- `adminDashboardCache.ts`, Kanban e `PropostaDetalhe.tsx`: invalidam KPIs/distribuição/financeiro após mudanças relevantes.
- `fundosDashboard.ts` e teste: adicionam verificação de reconciliação por operações e centavos.
- `docs/operacao/runbooks.md`: atualiza regras e procedimento para base de Standby, cancelamentos, estágios, datas de liberação e limites de leitura.

Migration, frontend, views e funções permanecem locais. Não houve execução de backfill, correção das 52 datas ausentes, escrita de dados de clientes, alteração de credenciais, publicação ou deploy.

## 13. Rollout, rollback e próximo passo

Executar A/B antes de C, mantendo D independente. Testar migrations e contratos em local/teste, fazer dry-run das pendências remotas e apresentar o delta de valores esperado antes de qualquer aplicação. Uma alteração de definição de negócio além das regras já aprovadas volta para decisão do dono do produto.

Migration remota e Vercel exigem autorização específica depois da validação. Preparar artefato isolado, guardar a deployment anterior no momento da publicação e não incluir outros diffs locais. Rollback do frontend promove a deployment anterior; rollback de funções restaura definições capturadas previamente, preservando datas/eventos de aprovação. Nenhuma operação de rollback deve apagar históricos ou reatribuir vencedores.

**Verificações desta implementação local (2026-10-30):**

- `npm run lint`: passou sem erros; 33 avisos existentes em outros arquivos.
- `npm run typecheck`: passou.
- `npm test -- --maxWorkers=1`: 49 arquivos e 201 testes passaram. Após o refinamento visual final, `npm test -- --maxWorkers=1 src/lib/fundosDashboard.test.ts`: 1 arquivo e 3 testes passaram.
- `npm run build`: passou; permanece o aviso preexistente de chunks maiores que 500 kB.
- `git diff --check` nos arquivos desta tarefa: passou.
- Teste visual autenticado no navegador: não executado, pois não havia uma aba disponível em `localhost:5173`.
- Smoke SQL: script criado, mas não executado porque a migration ainda não foi aplicada em banco local/teste.

**Refinamento solicitado após a revisão visual:**

- Corrigido o breakpoint: em desktop a lista de fundos fica ao lado do painel de operações; em telas menores, a seleção vira uma faixa horizontal.
- O painel agora lista todas as atribuições do fundo filtradas pelo período/parceiro do Dashboard, com proposta, cliente/documento, produto, valor, prazo, taxa, situação da proposta, situação do vínculo e primeiro fundo aprovado. Inclui Standby; paginação de 50 por página.
- A falha “Não foi possível carregar as operações deste fundo” vinha da RPC de detalhe ausente no banco vinculado (migration `20261031000001` pendente). A leitura agora usa `proposta_fundos`, `propostas` e `clientes` pelas políticas RLS de Admin já existentes; nenhuma migration remota foi aplicada.
- `npm run typecheck`, `npm test -- --maxWorkers=1 src/lib/fundosDashboard.test.ts`, `npm run lint` e `npm run build` executados após este refinamento. Resultado: passaram; lint manteve 33 avisos preexistentes e build manteve o aviso de chunk acima de 500 kB.
- Ainda falta validação visual na sessão autenticada do Admin; não houve deploy.

## 14. Correção complementar — escopo de Standby, filtros e volume por seleção (30/10)

**Status:** implementação local concluída após confirmação de que “Pendente” significa vínculo `aguardando`; sem deploy ou migração remota.

### Diagnóstico e evidência

- Consulta de somente leitura pelo Supabase CLI, restrita a agregados de outubro de 2026 e executada em transação `READ ONLY`: o resumo do cabeçalho usa a soma global dos fundos vencedores e deve permanecer invariável ao clicar em um fundo. No recorte consultado, os valores vencedores diferem por fundo (BARI R$ 6 mi, Galleria R$ 5,5 mi, GV Cash R$ 1,75 mi); o total global é R$ 13,25 mi. Logo, o número repetido no cabeçalho é global por desenho, mas precisa de rótulo inequívoco. Não foi possível reproduzir exatamente R$ 3 mi sem saber o intervalo/filtros que estavam na tela.
- A lista atual inclui Standby e o texto explicativo confirma essa inclusão. Remover Standby da lista, controles e mensagens visíveis, mantendo-o fora das métricas financeiras conforme regra existente.
- `proposta_fundos.status_fundo` usa `aguardando`, `aprovado`, `rejeitado`, `atencao`; `propostas.status` usa o pipeline e status `cancelado`, `completo`, `standby`. Os dois domínios não devem ser confundidos.
- Os volumes atuais por fundo são atribuídos ao primeiro vencedor; as operações vinculadas sem vitória ainda aparecem na lista. Adicionar um valor de operações vinculadas ao fundo selecionado e ao filtro da lista, com nome que deixe claro que vínculos em fundos diferentes podem repetir a mesma proposta. Manter o volume global único e o volume ganho do vencedor separados.

### Escopo proposto

1. Na barra de operações, adicionar filtros nativos: `Todas`, `Abertas`, `Pendentes`, `Canceladas`; nenhum inclui Standby. Concluído.
2. `Canceladas` filtra `propostas.status = cancelado`. `Abertas` segue o conjunto final usado atualmente pelo KPI de propostas (`contrato_registrado`, `completo`, `cancelado`, `standby` ficam fora). `Pendentes` significa vínculo do fundo `status_fundo = aguardando`, não status do pipeline. Concluído conforme confirmação do usuário.
3. Aplicar filtro antes da paginação (50 linhas por página), recalcular contagem e o volume vinculado ao fundo selecionado para exatamente toda a população filtrada, sem limitar a soma à página visível. A soma usa leituras pequenas (`proposta_id`, valor e status), com RLS de Admin; não carrega documento/nome no cálculo. Nenhuma escrita nem nova tabela. Concluído.
4. Rotular o valor superior como `Volume total do recorte` e as métricas do painel como escopo do fundo selecionado. O valor de operações vinculadas ao fundo reflete a seleção; volume de ganho continua exclusivo do primeiro fundo vencedor. Concluído.
5. Manter lista, pesquisa de fundo, filtros e paginação operáveis por teclado, foco visível e `btn-no-liquid`; Standby não será exibido nem contado como operação listada.

### Arquivos, aceite e verificações

- Alterar `app/src/components/FundoDistribuicaoCard.tsx`; adicionar testes direcionados para a classificação dos quatro filtros, exclusão de Standby, soma que atravessa mais de 50 registros e distinção entre total global e total do fundo. Não alterar migrations, RPC remota ou permissões.
- Aceite: trocar o fundo atualiza o volume vinculado; trocar o filtro atualiza linhas, contagem, páginas e volume; nenhum Standby aparece; canceladas aparecem somente em `Canceladas`/`Todas`; a aprovação/vencedor permanece calculada uma vez; o cabeçalho permanece global e nomeado como tal.
- Após aprovação: lint, typecheck, testes focados e build; conferir manualmente navegação/filtros, vazio/loading/erro e desktop/mobile em sessão Admin autenticada. Não executar deploy.
- Verificação remota somente leitura via CLI: `to_regprocedure('public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer)')` retornou `NULL`; `20261031000001` está local e sem versão remota. Isso explica o erro anterior.

**Implementação local (30/10):** `FundoDistribuicaoCard.tsx` agora filtra as operações no banco antes da paginação, oculta `standby`, soma todas as linhas filtradas do fundo em consultas RLS de Admin por lotes, e mostra filtros `Todas`, `Abertas`, `Pendentes` e `Canceladas`. `Pendentes` usa `status_fundo = aguardando` e exclui status finais da proposta; `Canceladas` filtra o status da proposta. O cabeçalho foi renomeado para deixar explícito que é o total global do recorte. A lógica de filtros e soma está coberta por `fundProposalFilter.test.ts`.

**Verificações desta implementação:** `npm run typecheck`, `npm test -- --maxWorkers=1 src/lib/fundProposalFilter.test.ts src/lib/fundosDashboard.test.ts`, `npm run lint`, `npm run build` e `git diff --check` passaram. Os testes focados passaram (2 arquivos, 8 testes); lint reportou 33 avisos já existentes e nenhum erro; build concluiu com o aviso já existente de chunk acima de 500 kB. Não foi feita validação visual autenticada no navegador. Nenhuma migration, escrita em banco ou publicação foi executada.

**Próximo passo:** abrir `/admin` em sessão autenticada e confirmar visualmente os quatro filtros, a troca do volume por fundo, estado vazio/loading/erro e paginação. Vercel permanece uma etapa separada e exige autorização específica. Não é necessário esperar as 52 datas históricas para estas correções locais.

**UX Verdict: Block (validação visual pendente)** — os filtros e totais locais estão implementados e cobertos por testes focados, mas a interface ainda precisa ser conferida em sessão Admin autenticada em viewport desktop e mobile. O diagnóstico de R$ 3 milhões não foi reproduzido sem o intervalo e os filtros exatos da sessão original. Este veredito não autoriza mudanças ou rollback da produção atual.

## 15. Diagnóstico da RPC de vencedor no Kanban (03/11)

- Consulta somente leitura confirmou que `admin_proposta_fundos_vencedores(uuid[])` e `admin_dashboard_fundo_propostas(...)` não existem na produção; `20261031000001` está nos arquivos locais, sem versão registrada no histórico remoto.
- O frontend de `app/.env` e `app/.env.local` aponta para o projeto Supabase de produção. Portanto o Kanban em localhost atinge a RPC ausente em produção. O bundle público atual não contém essa chamada, então a tela atualmente publicada não a invoca.
- O Supabase local está atrás: histórico local termina em `20261026000001`, enquanto produção está em `20261030000003`. `migration up` local aplicaria várias migrations pendentes; foi evitado.
- A primeira validação transacional da migration com o smoke da Fase 53 falhou: os privilégios padrão do Postgres local concedem `EXECUTE` a `anon`; `REVOKE ... FROM public` sozinho não remove o grant explícito a `anon`.
- Uma segunda validação do candidato, com revogação explícita de `anon` e a coluna `aprovado_em` disponibilizada apenas dentro da transação para compensar a defasagem local, passou pelo smoke `FASE 53 SMOKE: OK` e foi finalizada com `ROLLBACK`. Nenhuma alteração persistiu no banco.
- A migration foi corrigida para revogar explicitamente `EXECUTE` de `anon` nas quatro RPCs, além de revogar `PUBLIC` e conceder a `authenticated`. O smoke agora verifica presença e permissões das quatro funções.
- Revalidação local: executamos a migration e o smoke oficial dentro de uma transação no banco Docker, adicionando `proposta_fundos.aprovado_em` apenas para acomodar o schema local defasado; resultado `FASE 53 SMOKE: OK`, seguido de `ROLLBACK`. Consulta pós-rollback confirmou que a RPC continua ausente e a coluna temporária não foi persistida.
- Antes da autorização remota, nenhuma migration havia sido aplicada ao Supabase remoto nem ao banco local de forma persistente. A aplicação remota e sua verificação estão registradas na seção 16.

## 16. Aplicação remota aprovada (03/11)

- Após autorização explícita, `npx supabase db push --remote` aplicou somente `20261031000001_dashboard_fundos_conciliacao.sql` ao projeto `bhagksfvszeogtjvjtpx` (produção). O CLI confirmou `Apply 1 migration` e `Finished supabase db push`.
- Verificação remota read-only confirmou as quatro RPCs (`admin_dashboard_fundos_analytics`, `admin_dashboard_fundo_propostas`, `admin_proposta_fundos_vencedores`, `admin_dashboard_analytics`) presentes; `authenticated` pode executá-las e `anon` não pode. A coluna `proposta_fundos.aprovado_em` permanece presente.
- Reconciliação read-only atual: 213 propostas elegíveis (não-standby), 128 com vencedor e 85 sem vencedor; R$ 754.685.206,15 solicitados = R$ 463.384.054,70 com vencedor + R$ 291.301.151,45 sem vencedor. É uma fotografia da base no instante da consulta, não uma fixture.
- A CLI não permite executar o smoke oficial sob `--read-only` porque ele usa `DO`; não foi forçado remotamente. Seus checks de existência/grants e reconciliação foram executados como SELECTs read-only. O smoke oficial já havia passado no banco local dentro de transação revertida.
- Antes do push, as definições antigas das funções e views substituídas foram capturadas em `/tmp/mercurio-dashboard-fundos-before.json`. Foi preparado `supabase/manual/rollback_20261031000001_dashboard_fundos_conciliacao.sql`, que restaura essas definições e mantém a revogação de `anon`. O rollback não foi executado.
- Migration local segue sem aplicação no banco Docker defasado. A validação funcional do Kanban local em sessão Admin ainda precisa ser feita, pois localhost usa o Supabase de produção.

## 17. Publicação Vercel (03/11)

- Com autorização do usuário, a publicação foi montada em worktree isolada a partir do HEAD `cfdfc02eedcddd2e3787c55597d0e73447470150`, incluindo somente os arquivos do dashboard/fundos e o ajuste de invalidação de cache do detalhe da proposta. Alterações locais de Serasa, MERX, WhatsApp e outras telas não foram incluídas.
- A snapshot passou lint (33 avisos preexistentes, zero erros), typecheck, testes focados (8/8) e build. O audit de dependências de produção não encontrou vulnerabilidades High/Critical; o npm install do grafo completo reportou 2 Critical, 7 High e 32 Moderate, principalmente fora das dependências de runtime. A snapshot atualizou apenas a entrada `dompurify` do lockfile para 3.4.17, versão já presente no lockfile local do usuário; `package.json` não foi alterado.
- Deploy Vercel de produção: `dpl_GkwXADRZuoZUW1sJhUfEv3KB5KCv` (`mercurio-digital-h22xymr35-bonacciniwds-projects.vercel.app`), estado `Ready`.
- A inspeção revelou que os domínios públicos ainda apontavam para a implantação anterior. Após confirmação, os aliases `www.mercuriocapitalsa.com.br` e `mercuriocapitalsa.com.br` foram associados à implantação nova; o domínio raiz redireciona para `www`.
- Verificação HTTP pós-publicação: `www` retorna 200 e serve `index-BX0kT8rA.js`; o bundle contém `admin_proposta_fundos_vencedores`, “Fundo vencedor” e “Volume total do recorte”. O domínio raiz retorna 308 para `www`. A URL específica da implantação está protegida por SSO; os requests de smoke para ela foram feitos com `vercel curl`.
- Rollback de roteamento: reassociar ambos os domínios ao deployment anterior observado antes da mudança, `mercurio-digital-hgf4691zq-bonacciniwds-projects.vercel.app`, usando `vercel alias set <deployment> <domínio>`. Nenhum rollback foi executado.
- Não foi feito commit, push ao GitHub nem alteração no workspace sujo; a publicação usou a snapshot isolada. O npm audit do grafo completo continua pendente de triagem separada, sem ampliar o escopo deste release.
