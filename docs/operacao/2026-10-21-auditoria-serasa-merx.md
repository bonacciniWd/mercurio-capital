# Serasa + MERX — inventário de implementação e pendências

Data: 21/10/2026. Escopo: auditoria documental e estática, solicitada pelo dono do produto.

**Conclusão:** existe uma base reaproveitável de consultas, classificação por regras e distribuição. O conector Serasa implementado é de verificação cadastral, enquanto as collections recebidas são de relatórios de crédito PF. O classificador atual não lê resultados Serasa/Bacen e não usa IA. O fluxo integral da MERX mostrado no informativo ainda não está implementado.

## 1. Limites da verificação

- Inspecionados documentação Markdown, dois informativos visuais, migrations, Edge Functions, interfaces, scripts de smoke e histórico Git.
- Referência Git: `5225be7`. Havia 201 entradas no `git status --porcelain` antes deste relatório; há trabalho local de outros escopos. Commit, working tree e produção não são equivalentes.
- Collections em `API/Serasa/` estão sem versionamento; critérios e matriz possuem modificações locais.
- Não foram consultados o banco remoto, valores de secrets, logs de produção nem permissões comerciais da conta Serasa. Não houve consulta paga, gravação operacional, deploy ou ativação de flag.
- “Implementado” abaixo significa encontrado no código local. Não significa homologado, publicado ou habilitado.
- O PDF de escopo e a planilha original de bonificação não foram reprocessados; foi usado o escopo Markdown, que registra a interpretação histórica desses materiais. Não se confirmou equivalência entre as versões.

## 2. Fontes reunidas e precedência

| Fonte | Utilidade / ressalva |
|---|---|
| [Gestão de mudanças](./change-management.md) e [índice](../README.md) | Governança, stack, aprovação de implementação e publicação separadas. |
| [Escopo operação/LLM](../escopo-melhoria-operacao-llm.md) | Plano amplo: documentação, consultas, classificação, mix, carga, bonificação, assistente gerencial e NVIDIA/Nemotron. Prazo histórico não é estimativa atual. |
| [Critérios v1](./criterios-classificador-leads-v1.md) | Classes, pesos, confiança, revisão humana e limites. |
| [Matriz de critérios](./matriz-criterios-classificacao-leads.md) | Fontes de dados e decisões operacionais pendentes; parte do estado de implementação está desatualizada. |
| [Informativo 01](./assets/ParametrosIA-01.jpeg) | Seis pilares, precedência de regras e parâmetros numéricos propostos. |
| [Informativo 02](./assets/ParametrosIA-02.jpeg) | Mesmo fluxo da imagem fornecida nesta solicitação: originação, MERX, distribuição, analistas e supervisão. |
| [Integrações pendentes](./integracoes-pendentes.md) | Referência histórica; identifica outro produto Serasa e deve ser reconciliada. |
| [Mapa de privacidade](./politica-privacidade-publica.md) | Já distingue captura pública, proposta, consulta e classificador SQL sem LLM. Estado remoto relatado ali é histórico. |
| [Simuladores públicos](./simulador-publico.md) e [CPC](./leads-publicos-cpc.md) | Captação e painel de leads; CPC não cria proposta automaticamente. |
| [Blueprint integrações](../blueprint/07-integrations-flows.md), [módulos](../blueprint/06-modules-features.md), [roadmap](../09-roadmap.md), [finalização](../12-finalizacao.md) | Intenção original; nomes de funções, produtos e status não devem ser tomados como implementação atual. |

Planos diretamente relacionados:

- [Serasa Verify ID](../../prompts/2026-09-25-integracao-serasa-verify-id.md).
- [Credenciais logon/senha](../../prompts/2026-10-02-serasa-logon-senha.md).
- [Classificação e distribuição](../../prompts/2026-09-25-classificacao-distribuicao-leads.md).
- [Classificação na criação](../../prompts/2026-09-25-classificacao-na-criacao-proposta.md).
- [Definição do classificador](../../prompts/2026-09-30-definicao-classificador-server-side.md).

## 3. Histórico técnico recuperado

| Data / commit | Entrega encontrada |
|---|---|
| 18/05 — `d5ba602` | Consultas pagas: logs, débito/estorno, Edge genérica e aba de consultas. |
| 25/09 — `11a5f7d` | Checklist documental e bloqueio de Serasa/Bacen sem configuração; não implementa autorização específica do titular no backend. |
| 25/09 — `b91037e` | Conector Verify ID PF/PJ. |
| 25/09 — `ea9495c` | Classes, pesos e distribuição sobre simulações; depois estendida para propostas. |
| 25/09 — `5bbcbfd`, `3e3d8fa` | Classificação na proposta e acesso adicional por responsável. |
| 25/09 — `b6b6d64` | Proposta nova marcada como aguardando classificação. |
| 02/10 — `eb4b586`, `2bdc6bb` | Classificador SQL configurável e ligação com a interface administrativa. |
| 02/10 — `5225be7` | Aliases `SERASA_LOGON` / `SERASA_SENHA`. |

Não foi localizada implementação de chamada a LLM/NVIDIA/Nemotron nos diretórios de código inspecionados. Menções comerciais na landing não são evidência de integração ativa.

## 4. O que existe e o que falta

| Parte do fluxo | Encontrado no código | Pendência para o fluxo MERX |
|---|---|---|
| Originação | Wizard, propostas, clientes, proponentes, imóveis e documentos; leads públicos em tabelas próprias. | Formalizar vínculo e passagem lead → proposta, preservando origem e evitando duplicação. Instagram aparece como processo operacional no plano; não foi localizado conector dedicado. |
| Checklist | Requisitos, validação documental, pendências; OCR Tesseract de imagens no navegador. | Extração confiável de extratos/IR/DRE, normalização e conferência da renda; processamento pesado em jobs no servidor. OCR existente não equivale a análise de renda. |
| Serasa | Login IAM, Verify ID PF/PJ, logs e resumo. | Relatório de crédito contratado, normalização de score/restrições, data/fonte/validade e alimentação da classificação. |
| Bacen/SCR | Adaptador genérico via provedor, autenticação configurável. | Contrato/layout real, homologação, indicadores de exposição e histórico; configuração efetiva não verificada. |
| Jurídico e imóvel | Campos e documentos da proposta. Branches de Jusbrasil/Escavador/RI/Nacional usam mocks. | Conectores reais, regras e revisão de ocorrências; fonte de população/liquidez e avaliação da garantia. |
| Classificação | RPC SQL determinística, classes, confiança fixa por ramo, configuração e botão no admin. | Seis pilares, regras validadas, distinção sugestão/decisão, evidências completas e MERX assistida por IA. |
| Distribuição | Responsável, níveis, capacidade, pesos e histórico. | Mix percentual, política de lotação/ausência/revisão, idempotência e isolamento de carteira. |
| Relatório MERX | Motivo/classe na proposta e logs de consulta. | Relatório integrado por pilar, fontes, pendências, estratégia, versão e validação humana. |
| Supervisão | Fluxo de propostas, responsável e estrutura de equipe/gestor. | Painel MERX por analista/supervisor, SLAs e alertas específicos, revisão sênior e indicadores de qualidade. |
| Bonificação | Limiar e pesos em configuração. | Apuração, regras monetárias, retenção, reversões e remuneração do monitoramento. Não confundir parâmetros armazenados com cálculo/pagamento entregue. |

### Captura pública não é consulta de crédito

`simulacao_leads_publicos` e `cpc_leads_publicos` abastecem `v_admin_leads_publicos` e `/admin/leads/simulacoes`. São diferentes de `simulacoes`, alvo da primeira RPC de distribuição. Não foi encontrado encadeamento automático desses leads públicos para a MERX.

A continuidade coerente com o histórico é: captar contato → qualificar e formar proposta → completar dados/documentos → executar consultas autorizadas → classificar/revisar → distribuir. Não disparar bureau pelo simples envio da calculadora ou formulário CPC.

## 5. Serasa: divergência de produto e pendências concretas

### Implementação local

[consulta-executar](../../supabase/functions/consulta-executar/index.ts): login `POST /security/iam/v1/client-identities/login`; consulta `POST /id-fraud/verify-id/v1/people` ou `/business`, com `scoreParameters: ["VERIFY"]`.

O retorno usa `verificationScore`, `verificationRisk` e `validationGroups`; o código coloca `verificationScore` no campo genérico `resumo.score`. **Não usar esse valor como score de crédito da MERX.** O produto oficial é de consistência/verificação cadastral: [documentação Serasa Verify ID](https://developer.serasaexperian.com.br/api/data-verification-for-pf--pj).

### Material de onboarding disponível

As três collections locais usam login IAM e `GET /credit-services/person-information-report/v1/creditreport`, com documento no header `X-Document-id`:

| Collection / `reportName` | Ambiente / observação |
|---|---|
| `CLIENTE_RELATÓRIO BÁSICO PF PME` / `RELATORIO_BASICO_PF_PME` | UAT; relatório PF. |
| `PERFIL_DE_CREDITO_BASICO_PF` | UAT; exemplo com `federalUnit=SP`. |
| `PERFIL_DE_CREDITO_BASICO_TOP_PF` | UAT; exemplo com `federalUnit=SP`. |

`optionalFeatures` está vazio nos exemplos inspecionados. Não há amostra de retorno suficiente para confirmar quais indicadores cada contratação libera. Não presumir score, todos os tipos de restrição, histórico, preço ou permissão PJ apenas pelo nome da collection. Não copiar a UF de exemplo como regra nacional.

Faltam confirmar: produto e features contratados; layout/respostas sanitizadas; credenciais e fixtures UAT; limites/custos; acesso produtivo; produto PJ, se fizer parte da primeira entrega. A Serasa orienta usar o layout do produto contratado e separa acesso de homologação de produção: [portal oficial de integração](https://www.serasaexperian.com.br/portal-integracao/).

### Bloqueios de implementação observados

1. **Health check divergente:** [integracao-testar](../../supabase/functions/integracao-testar/index.ts), linha 71, usa `/connect/token` e `client_credentials`, enquanto a consulta usa `/login` Basic. Também não reconhece os aliases logon/senha. O catálogo inicial exige `SERASA_CLIENT_ID`/`SERASA_CLIENT_SECRET`. Status “conectado” não comprova acesso ao relatório contratado.
2. **Campo possivelmente inexistente:** `resolverPayloadSerasa`, linha 359, seleciona `clientes.nome_fantasia`; não foi localizada a criação dessa coluna nas migrations. O erro da leitura é ignorado. Confirmar schema efetivo: isso pode impedir a resolução do cliente inclusive em PF.
3. **Documento não integralmente vinculado no servidor:** `payload.documento` do corpo tem precedência sobre CPF/CNPJ resolvidos da proposta, linhas 189 e 433–442. Remover essa possibilidade de substituição; selecionar titular e tipo no servidor e validar documento antes de cobrar/consultar.
4. **Resiliência incompleta:** login e chamada Serasa sem timeout explícito; sem contrato validado de resposta; erro do provedor é propagado. Não há idempotência de requisição de consulta. Retry indiscriminado pode duplicar consumo.
5. **Estorno não confirmado:** linha 474 ignora erro da RPC e retorna `estornado: true`. Falha de persistência após resposta do provedor também precisa de reconciliação distinta de falha de consulta.
6. **Mocks adjacentes:** Jusbrasil, Escavador, RI Digital e Nacional retornam resultados sintéticos no dispatcher. Não podem alimentar evidência MERX ou aparecer como diligência real. Serasa/Bacen têm flags de mock com default falso; valor remoto não verificado.
7. **Collections com campos de autenticação preenchidos:** há valores literais de username/password/token, não variáveis de ambiente Postman. Não foram expostos nem usados. Não se confirmou se são exemplos ou credenciais válidas; sanitizar antes de versionar/compartilhar. Se forem credenciais reais já expostas, tratar rotação em escopo próprio.

## 6. Autorização e dados: bloqueios antes de automatizar

Achados de código, sem exploração contra produção:

- [Migration de consultas](../../supabase/migrations/20260518000020_consultas_fase6.sql), linhas 158–250: `consulta_concluir` e `consulta_estornar` são `SECURITY DEFINER`, concedidas a `authenticated`, sem verificar autor/proposta no corpo. A primeira aceita resposta arbitrária para log em andamento; a segunda permite solicitar transição/estorno de log conhecido. É necessário validar ACLs efetivas e restringir finalização ao executor confiável. Não foi encontrada migration posterior redefinindo essas funções.
- `consulta_iniciar` verifica vínculo/perfil e saldo, mas não consulta autorização específica para bureau, finalidade ou a flag `integracoes_config.ativo`. O botão lista preços; não existe ali uma verificação suficiente de prontidão do provedor. O bloqueio atual de credenciais ocorre depois de iniciar o débito.
- A Edge devolve `response` e `log` completos. A UI de detalhes lê request/response de `logs_consultas`; suas RLS incluem parceiro, equipe, cliente vinculado e admin. Definir campos permitidos por perfil, retenção e expurgo, em vez de entregar o payload bruto por padrão.
- `v_consultas_proposta` foi criada sem `security_invoker` explícito. Verificar proprietário e comportamento efetivo de RLS no banco remoto; não presumir que o filtro da interface protege a view.
- O admin limitado continua satisfazendo `app_is_admin()`. [admin_list_propostas](../../supabase/migrations/20260722000006_kanban_responsavel_filters.sql) lista todas as propostas para admins, sem filtro obrigatório de responsável. As policies adicionadas para `team_member` por responsável são permissivas e se somam ao acesso por equipe. **“Somente minha carteira” ainda não está garantido para todos os perfis do diagrama.**
- Cargo, nível operacional e papel de acesso são conceitos distintos. Não transformar analista interno em membro de parceiro para resolver distribuição. A estrutura de gestor em `usuarios_internos` não cria, por si só, acesso supervisionado às carteiras.

## 7. Classificador atual versus MERX pretendida

Fonte: [classificador SQL v1](../../supabase/migrations/20261002000001_classificador_server_side_v1.sql), linhas 114–161.

Ele verifica existência de imóvel com valor, renda/faturamento informado, tipos documentais aprovados e pendências. O sinal jurídico é uma expressão regular na descrição da pendência. Não consulta Serasa/SCR, não tabula renda documental, não calcula materialidade/LTV/liquidez e não combina os proponentes para provar capacidade de pagamento.

Confianças atuais são constantes: AAA 1,00; AA 0,75; Estressado 0,50; insuficiente 0,25. Não são probabilidades calibradas de um modelo nem de aprovação de crédito. Com thresholds padrão, somente o ramo AAA pode distribuir automaticamente.

Diferenças adicionais a resolver:

- Checklist confere presença de tipo aprovado na proposta, sem provar completude por cada proponente/imóvel/período documental.
- A regra de imóvel aceita a existência de um imóvel adequado; não representa necessariamente o conjunto das garantias.
- Estressado com confiança 0,50 é persistido em `classificacao_lead`, embora o documento diga que abaixo de 0,60 não deve haver classe definitiva. Não há separação explícita entre classe sugerida e final.
- Ramo automático retorna evidências/versão, mas sua auditoria de distribuição não persiste o mesmo conjunto completo registrado no ramo de revisão.
- Reclassificar para revisão limpa `distribuido_em`, mas preserva o responsável anterior; é preciso definir o comportamento esperado.
- A classificação manual usa confiança 1 e motivo genérico. “Desqualificado” não exige catálogo fechado de motivos no RPC atual.
- A flag tem default falso na migration; não foi lido o valor remoto. O trigger de criação apenas marca pendência: não existe pipeline automático completo da MERX na criação.

### Parâmetros do informativo, ainda não promovidos a regras aprovadas

O informativo 01 propõe score AAA ≥600; AA 450–599 ou ≥600 com restrição de baixa materialidade; Estressado <450 ou alertas relevantes. Também sugere renda mensal de 6% do crédito para AAA, LTV preferencial ≤50%, LTV ≤40% em determinados casos de renda abaixo do padrão, restrição até o menor valor entre 0,5% do crédito e R$30 mil, até duas ocorrências, faixas de população e escalonamento por múltiplos desvios.

Esses números estão registrados como referência nas imagens, mas os documentos operacionais determinam validação antes da automação. Isso inclui conferir o significado de cada indicador, exceções, dados faltantes e versões. Processo criminal em andamento não implica automaticamente Estressado no próprio informativo; requer revisão humana/compliance.

## 8. Distribuição, acesso e supervisão

Mix desejado no informativo:

| Nível | AAA | AA | Estressado |
|---|---:|---:|---:|
| Júnior | 60% | 30% | 10% |
| Pleno | 25% | 55% | 20% |
| Sênior | 10% | 25% | 65% |

As linhas somam 100%: representam composição da carteira por nível, não probabilidades de encaminhamento por classe. As colunas não somam 100%; não transpor essa tabela diretamente para sorteio de destinos.

[Roteamento atual](../../supabase/migrations/20260925000004_responsavel_acesso_propostas.sql), linhas 97–141: preferência rígida de senioridade por classe, depois carga ponderada mensal/capacidade. Não calcula esse mix e não bloqueia capacidade excedida. Há lock para concorrência, mas chamadas repetidas adicionam novos eventos somados na carga mensal; falta definir idempotência e como reatribuições entram na apuração.

Já existem pesos 1/1,3/1,7 e capacidades-base 4/8/9. A documentação mantém a capacidade sênior 9 versus 12 pendente. O limiar de 100 é da bonificação agregada, não um bloqueio da fila; referência de conversão de 30% é planejamento, não requisito de pagamento. Valores de remuneração e regras de monitoramento não estão fechados.

## 9. Modelo existente que deve ser reaproveitado

- `clientes` / `proponentes` / `imoveis` vinculados a `propostas`: dados da operação e dos titulares/garantias.
- `proposta_documentos`, `documento_requisitos`, `proposta_pendencias`: documentos e diligências.
- `logs_consultas`, `precos_consulta`, `wallet_ledger`: consulta, precificação e movimentos de carteira.
- `config_leads_operacao`: pesos, capacidade-base, flag/thresholds/versão de classificador.
- `propostas`: classe, confiança, motivo, autor/data e responsável; `simulacoes` também recebeu campos na primeira fase.
- `lead_distribuicoes`: histórico com analista, peso, classe, período e referência a simulação/proposta.
- `usuarios`: nível operacional, participação e capacidade individual; `usuarios_internos`, cargos/departamentos/gestor para organização interna.
- Leads públicos têm tabelas próprias; falta definir vínculo rastreável para a operação quando convertidos.

Não foram criadas tabelas nesta auditoria. Antes de implementar MERX, o plano de dados precisa definir armazenamento de análise versionada, evidências normalizadas por pilar, revisões humanas, execuções/jobs, vínculo de autorização/finalidade e distribuição vigente versus histórico. Reutilizar as estruturas existentes onde couber; nomes, relações e RLS de extensões dependem do plano aprovado.

## 10. Sequência sugerida para fechar o escopo

| Ordem | Frente | Critério de encerramento |
|---|---|---|
| 1 | Inventário remoto somente leitura | Migrations aplicadas, versões Edge, flags, ACLs/RLS e configuração do catálogo confirmadas, sem expor secrets. |
| 2 | Contrato Serasa e segurança das consultas | Produto/features PF e eventual PJ confirmados; corrigidos vínculo do documento, schema, autorização/finalização, acesso ao retorno e estorno. |
| 3 | Homologação do relatório de crédito | Fixtures UAT e resposta normalizada com score de crédito separado da verificação cadastral; timeout, erros, custo e duplicidade validados. |
| 4 | Matriz MERX e contrato de dados | Regras por seis pilares, dados ausentes, thresholds, validade, revisão e motivo de desqualificação aprovados. |
| 5 | MERX assistida por IA | Extração/análise em jobs, dados mínimos, resultados estruturados com fontes, validação server-side, versão e revisão humana; falha não bloqueia criação da proposta. |
| 6 | Distribuição e supervisão | Mix interpretado corretamente, capacidade/ausências, reatribuição, acesso por carteira/supervisor e apuração sem duplicidade. |
| 7 | Operação e release | Relatório, SLAs e indicadores; validação com casos anonimizados; rollout gradual e desligamento por flag; aprovação própria de publicação. |

NVIDIA API aparece como opção no plano, não como integração concluída. Nemotron local/GPU/fine-tuning não são pré-requisitos aprovados para esta entrega. Decisões de modelo, processamento de dados e custo devem permanecer explícitas no plano técnico.

## 11. Verificações e aceite a preparar

Realizado nesta auditoria: leitura estática, comparação de versões históricas, inspeção visual dos dois informativos, parsing das collections sem divulgar autenticação, pesquisa em documentação oficial Serasa e rastreamento dos pontos de chamada.

Existem smokes SQL [fase 32](../../supabase/smoke-tests/fase-32-lead-classificacao.sql), [fase 33](../../supabase/smoke-tests/fase-33-proposta-classificacao-pendente.sql) e [fase 34](../../supabase/smoke-tests/fase-34-classificador-server-side.sql). Eles verificam principalmente objetos/configuração; não comprovam qualidade da classificação, isolamento entre analistas, comportamento de estorno ou autenticação Serasa. Não foram executados nesta auditoria.

Para a implementação, incluir:

1. PF/PJ autorizado, documento inválido/ausente, documento substituído pelo cliente, log de terceiro e usuário sem acesso.
2. Provedor desligado/sem credencial/sem permissão de produto, 401/403/429/5xx, timeout, resposta incompleta, sucesso seguido de falha de persistência e estorno falho.
3. Clique/requisição repetida e concorrência: um consumo/débito por execução lógica; reconciliação auditável.
4. Score cadastral jamais usado como score de crédito; indisponível jamais interpretado como “sem restrições”.
5. AAA/AA/Estressado com evidência, renda apenas declarada, múltiplos proponentes/imóveis, checklist incompleto, consulta vencida e sinal jurídico.
6. Baixa confiança, revisão/desqualificação humana, reclassificação, flag desligada e trilha completa em todos os ramos.
7. Mix por nível, ausência de analista, limite de carga, repetição/reversão/reatribuição, supervisão e isolamento por carteira.
8. Leads de calculadora/CPC sem consulta automática; passagem a proposta mantém origem e titular correto.
9. Smoke autenticado web/admin/parceiro; Electron e mobile quando expuserem a funcionalidade. Auditoria atual não valida paridade nesses clientes.

Não houve alteração funcional: lint/typecheck/build e smoke de navegador não foram executados como evidência desta auditoria. A próxima mudança de código precisa de plano e modelo aprovados, verificações da stack e autorização separada para publicação.

## 12. Complemento — credenciais locais informadas pelo usuário

Após o levantamento, o usuário informou ter adicionado credenciais de homologação e forneceu o [onboarding oficial de APIs de crédito](https://developer.serasaexperian.com.br/suporte/onboarding-apis--credito).

- Confirmada presença de `SERASA_LOGON`, `SERASA_SENHA`, `SERASA_CLIENT_ID` e `SERASA_CLIENT_SECRET` em `app/.env`, ignorado pelo Git. Valores não foram exibidos nem usados.
- Os dois pares possuem valores diferentes. O usuário confirmou posteriormente que `SERASA_CLIENT_ID`/`SERASA_CLIENT_SECRET` é o par de homologação a utilizar; corresponde à precedência atual do código.
- Não foi encontrada `SERASA_API_URL` nos arquivos `.env` locais verificados. Não foi consultada a configuração remota.
- `app/.env` não provisiona automaticamente secrets do runtime Supabase. A configuração deve ser consumida exclusivamente no backend; não criar variáveis `VITE_` para credenciais.
- A URL complementar respondeu HTTP 200 via leitura direta, mas entregou apenas o shell JavaScript do portal; o conteúdo de onboarding não foi extraído nesta tentativa. Não se considerou esse conteúdo validado.
- Não houve autenticação Serasa, consulta de documento, movimentação de carteira, alteração de env ou provisionamento remoto.
- O link adicional `https://developer.serasaexperian.com.br/api/relatorio-avancado-pf` é uma página do portal de documentação, não o valor de `SERASA_API_URL`. Nas três collections locais, a base de homologação é `https://uat-api.serasaexperian.com.br`. A consulta de crédito usa o caminho `/credit-services/person-information-report/v1/creditreport`. O acesso ao produto Avançado PF não foi comprovado pelas collections de produtos básicos recebidas nem por teste de credenciais.

## 13. Referência ao Relatório Avançado PF

O link específico enviado pelo usuário é pertinente para implementar o produto Relatório Avançado PF: deve esclarecer `reportName`, endpoint, campos do pedido e interpretação do retorno. Não é uma URL base para `SERASA_API_URL`. A página do developer portal não ficou legível no navegador de pesquisa (retornou apenas o shell JavaScript), então seus parâmetros específicos ainda não foram confirmados nesta auditoria.

O [Portal oficial de Integração Serasa](https://www.serasaexperian.com.br/portal-integracao/) confirma que os relatórios avançados têm layouts próprios; features precisam corresponder ao contrato; falta de autorização a uma feature pode retornar `USER-NOT-AUTHORIZED`; e a massa de teste é fornecida para o produto contratado. O portal também orienta obter o endpoint UAT no layout correspondente. Portanto, autenticação HTTP 201 confirma IAM, mas não prova que o login tem autorização para `RELATORIO_AVANCADO_PF`, nem se o produto contratado inclui Score. As collections locais de relatórios básicos não substituem esse manual.

Próximo passo técnico: obter o corpo textual da página/manuais de onboarding e confirmar com a Serasa o `reportName` e a massa PF fictícia atrelada a este login. Então testar somente o endpoint documentado no UAT, sem trocar o conector Verify ID até a integração do novo produto ser implementada e homologada.

## 14. Trecho OpenAPI compartilhado pelo usuário

O usuário compartilhou a descrição OpenAPI `CS-Person-Information-Report-BR`, v1.0.0. Ela confirma que a resposta pode conter dados negativos (Pefin, Refin, SPC), score, cadastro e alertas de documentos roubados. O produto é diretamente relevante para alimentar dimensões de crédito/risco da MERX. A presença de `Score`/`Scores` nos modelos não comprova quais modelos e features estão contratados para este login; a lista autorizada precisa ser confirmada pela chamada UAT e contrato.

O OpenAPI exibido aponta `GET /creditreport` e o servidor `https://sandbox-api.serasaexperian.com.br/mock/credit-services/person-information-report/v1`. Esse endereço é explicitamente `/mock`; não substituir `SERASA_API_URL` UAT por esse host. Para homologação real, as collections disponibilizadas anteriormente apontam para `https://uat-api.serasaexperian.com.br/credit-services/person-information-report/v1/creditreport`, com login IAM separado. A tela “No authentication selected” do explorer não elimina o fluxo de IAM indicado pela documentação e usado na collection.

O trecho compartilhado não mostrou os parâmetros da operação, headers, `reportName` nem schema dos campos de resposta. Continuam por confirmar no UAT: nome exato do relatório avançado, header `X-Document-Id`, parâmetros de report/features, massa fictícia e permissões/score. A descrição OpenAPI resolve a dúvida de pertinência do produto; ainda não é suficiente para enviar uma requisição correta sem inventar parâmetros.

## 15. Manual textual completo fornecido posteriormente

Fonte lida: arquivo `Texto colado.txt`, anexado pelo usuário, com o conteúdo da página Relatório Avançado PF. Esta seção atualiza as lacunas técnicas das seções 13–14; permissão comercial e massa fictícia continuam pendentes de confirmação.

Autenticação UAT: o usuário executou o script local e informou `HTTP 201` e `Token recebido: true`. A autenticação foi validada pelo resultado informado, sem divulgação do token. Não houve execução de consulta de relatório nesta análise.

### Contrato de requisição confirmado no material

- Método: `GET`.
- Endpoint UAT: `https://uat-api.serasaexperian.com.br/credit-services/person-information-report/v1/creditreport`.
- `reportName`: nome exato do produto.
- `optionalFeatures`: nomes das features opcionais separados por vírgula, quando contratadas e solicitadas. Não selecionar features automaticamente pela existência do schema.
- `reportParameters`: JSON codificado em base64, com o objeto `{"reportParameters":[{"name":"SCORE","value":"MODELO_AUTORIZADO"}]}` quando uma feature exigir entrada adicional. Construir o query string com URL/URLSearchParams para preservar base64 corretamente.
- `Authorization: Bearer <token>` e `X-Document-Id`: CPF de 11 dígitos.
- `X-Retailer-Document-Id`: CNPJ de 14 dígitos do cliente consultante para canal distribuidor. Não usar automaticamente o CNPJ do proponente ou parceiro sem confirmar quem é o consultante no contrato.
- `X-Cost-Center`: opcional, 12 caracteres segundo o manual.
- A URL ilustrativa do texto perdeu separadores/placeholders (`?reportName=optionalFeatures=`). Usar os parâmetros documentados e um construtor de URL, sem copiar essa string literalmente.

| `reportName` | Conteúdo de crédito descrito |
|---|---|
| `RELATORIO_AVANCADO_PF` | Cadastro, consultas, participação societária, documentos roubados e negativos. Score depende de feature opcional contratada. |
| `RELATORIO_AVANCADO_TOP_SCORE_PF` | Conteúdo anterior e Score Positivo. |
| `RELATORIO_AVANCADO_TOP_SCORE_PF_PME` | Conteúdo anterior, Score Positivo e renda estimada. |

O manual também documenta `COMBO_CONCESSAO` e `COMBO_CONCESSAO_SPC`; isso não comprova contratação nem autoriza trocar o produto pretendido. SPC tem restrição expressa para canal distribuidor.

### Inconsistência de modelo e pontos de normalização

- O aviso inicial orienta distribuidores a usar `HLRD`; a tabela e a seção de canais escrevem `HRLD`. Não corrigir silenciosamente: confirmar com onboarding o código aplicável ao login e ao relatório. A tabela de modelos do Avançado PF básico não lista HRLD, enquanto a de Top Score o lista; a combinação produto/modelo exige confirmação.
- Modelo depende do canal: Large, PME ou Distribuidor. O rótulo genérico na documentação não define automaticamente o canal da Mercúrio.
- Score de crédito (`SCORE`), score de fraude (`SCORE_FRAUDE_PF`) e verificação cadastral Verify ID são indicadores distintos. Preservar modelo, mensagem, status e fonte de cada indicador.
- O retorno de Score documenta `score`, `scoreModel`, `range`, `defaultRate`, `codeMessage` e `message`. Score ausente/sem cálculo não equivale a zero nem a cliente sem risco.
- Renda estimada do bureau não é renda comprovada por extratos/IR. Registrar tipo/fonte para a MERX não confundir evidências.
- Negativos trazem ocorrências e resumos com quantidade/saldo. Não somar novamente os resumos aos itens nem somar blocos sobrepostos como se fossem dívidas distintas sem validar a semântica.
- O texto tem grafias e descrições divergentes de campos (ex.: `spefinResponse`, `firstOcurrence`/`lastOcurrence`). Validar o normalizador com JSON real da massa UAT, sem depender de nomes intuitivos ou do texto tabular isolado.
- Indicadores demográficos/cadastrais presentes no relatório não se tornam critérios MERX automaticamente; o uso de cada campo continua subordinado à matriz operacional aprovada.

### Tratamento de respostas para o teste UAT

`401` indica falha de autorização; `403` pode indicar menor legalmente protegido; `404`, documento não encontrado; `412` abrange documento/parâmetro inválido, feature não autorizada, transações não cadastradas ou falta de vínculo de logon/CNPJ ao Client ID. Portanto, um `412` não prova por si só que o CPF é inválido. `429` exige controle de consumo; `500` pode incluir falha de processamento de dataset. Registrar apenas código/categoria e presença dos blocos durante o smoke, sem imprimir documento/token ou relatório completo.

Primeiro teste sugerido: uma chamada ao produto confirmado para este login, com CPF da massa fictícia fornecida pela Serasa, sem opcionais adicionais. Depois, validar Score/modelo e demais features confirmadas no contrato. O material técnico está suficiente para montar o pedido; falta a massa fictícia e a confirmação da combinação de produto/canal/modelo autorizada.

## 16. Teste UAT executado com a collection Avançado PF

O usuário confirmou liberação de Avançado PF e Avançado PJ para seu login e forneceu a collection oficial `RELATORIO AVANÇADO PF`, incluindo documento de homologação. Isso resolveu a ausência da massa PF para o primeiro teste. A autorização e o contrato técnico PJ ainda não foram testados; a confirmação de liberação PJ é informação do usuário.

Execução local pelo agente com `/tmp/serasa-uat-report.mjs`, lendo `SERASA_CLIENT_ID`, `SERASA_CLIENT_SECRET` e `SERASA_API_URL` de `app/.env`. A execução valida que o host seja exatamente UAT, não segue redirects e não imprime token, credenciais nem dados pessoais do relatório. Uma chamada IAM e uma chamada de relatório, sem retries ou opcionais:

- IAM: `HTTP 201`, token recebido.
- Relatório: `GET /credit-services/person-information-report/v1/creditreport?reportName=RELATORIO_AVANCADO_PF`, documento fictício `00000001244` do exemplo Serasa, `Authorization: Bearer`, `X-Document-Id`, `Content-Type: application/json`.
- Resposta: `HTTP 200`, JSON válido, raiz `reports`, um relatório com `reportName` correspondente.
- Campos do relatório: `reportName`, `registration`, `negativeData`, `negativeSummary`, `facts`, `partner`, `checkFilingsHistorical`.
- Blocos de `negativeData`: `pefin`, `refin`, `notary`, `check`, `collectionRecords`. Presença de bloco não comprova que haja ocorrências nem total positivo; valores não foram expostos.
- `score` e `scores` ausentes nessa resposta; o teste não valida Score opcional nem autoriza concluir que a credencial não tem acesso à feature.
- Nenhum header de distribuidor foi acrescentado, conforme a collection recebida; a chamada-base foi aceita. Isso não determina o canal/modelo de Score contratados.
- Processo terminou com código zero. Não foi gravado o relatório bruto em arquivo nem criado log/movimento de carteira da aplicação. Foi chamada diretamente a API UAT, sem RPCs Supabase.

Resultado: autenticidade da conexão IAM e acesso ao produto PF básico confirmados em homologação nesta execução. Próximos pontos: Score/feature/modelo, manual e collection PJ, e plano aprovado para substituir/complementar Verify ID no conector da aplicação com os controles da auditoria. Teste UAT não comprova configuração ou comportamento em produção.

## 17. Teste UAT Avançado PJ Analítico

O usuário forneceu posteriormente a collection `REPORT_AVANCADO_PJ_ANALITICO`. Ela resolve o endpoint e pedido de teste PJ, atualizando a pendência das seções anteriores.

- Login: mesmo IAM UAT, usando as credenciais locais CLIENT_ID/CLIENT_SECRET confirmadas pelo usuário. A collection PJ não explicita auth; a chamada de teste complementou Basic no IAM e Bearer no relatório conforme o fluxo já validado.
- Endpoint: `GET https://uat-api.serasaexperian.com.br/credit-services/business-information-report/v1/reports`.
- `reportName=RELATORIO_AVANCADO_PJ_ANALITICO`.
- `X-Document-id=00063960000109`, documento de exemplo UAT fornecido pelo usuário com a collection Serasa.
- `reportParameters`: enviado exatamente como a collection, em base64. O conteúdo decodificado é `{"reportParameters":[{"name":"segmentCode","value":"028"}]}`. O significado e a escolha de segmento para a operação real continuam sujeitos ao contrato; não aplicar `028` como padrão geral sem validação.
- Uma chamada de login e uma de relatório, sem retries, seguindo o exemplo sem opcionais adicionais, com host limitado a UAT, redirects desabilitados e timeouts. Script temporário `/tmp/serasa-uat-report-pj.mjs`; credenciais/token/relatório completo não foram impressos.

Resultado observado pelo agente:

- IAM: `HTTP 201`, token recebido.
- Consulta: `HTTP 200`, JSON válido, raiz `reports`, um relatório com produto correspondente.
- Campos do relatório: `reportName`, `identificationReport`, `negativeData`, `facts`, `negativeSummary`, `advancedCommercialPaymentHistory`, `checkFilingsHistorical`.
- Blocos negativos: `pefin`, `refin`, `collectionRecords`, `check`, `notary`. Presença não comprova ocorrência/valor positivo.
- Cadastro PJ presente em `identificationReport`; o resumo do script reutilizado de PF indicou `cadastro_presente: false` porque verifica apenas `registration`. Isso é uma limitação do resumo de teste PF, não ausência de cadastro na resposta PJ. O conector deverá normalizar os dois formatos explicitamente.
- Sem campos `score` ou `scores` no nível do relatório retornado. A chamada não comprova bloqueio nem liberação de Score opcional PJ.
- Processo concluído com código zero. Nenhuma gravação no banco, chamada à Edge da aplicação, débito na carteira ou publicação; retorno bruto não foi salvo em arquivo.

Estado consolidado: autenticação e acesso aos relatórios PF Avançado e PJ Avançado Analítico confirmados no UAT. A integração local da aplicação permanece em Verify ID; publicação, integração dos retornos na MERX, interpretação completa PJ e Score/features ainda exigem implementação/validação próprias.

## 18. Teste UAT PF Avançado Top Score

O usuário forneceu a collection específica `RELATORIO_AVANCADO_TOP_SCORE_PF`, com o mesmo documento fictício PF e endpoint `/credit-services/person-information-report/v1/creditreport`. `optionalFeatures` está desabilitado e não há `reportParameters`: a chamada usa o modelo padrão do produto. O teste usou as credenciais locais confirmadas, não os placeholders `client-id`/`cliente-secret` da collection.

Execução observada pelo agente com `/tmp/serasa-uat-report-pf-score.mjs`:

1. Login `HTTP 201`, token recebido. Primeira consulta com `reportName=RELATORIO_AVANCADO_TOP_SCORE_PF`: `HTTP 503`, JSON com categoria `PROCESSING`. Não foi interpretada como falta de permissão e não houve fallback de relatório/modelo.
2. Uma única repetição limitada da mesma chamada, após nova autenticação `HTTP 201`: relatório `HTTP 200`, JSON válido, um item `reports` com produto correspondente. Nenhuma outra tentativa foi executada.

No sucesso, campos do relatório: `reportName`, `registration`, `negativeData`, `score`, `negativeSummary`, `facts`, `partner`, `checkFilingsHistorical`. Negativos com `pefin`, `refin`, `notary`, `check`, `collectionRecords`.

Bloco `score` presente com campos `score`, `scoreModel`, `range`, `defaultRate`, `codeMessage`, `message`; pontuação numérica entre 0 e 1000 e `scoreModel=HSPN`. Valores cadastrais, documento, pontuação, mensagens e token não foram expostos. O resultado confirma acesso UAT ao Top Score PF com o modelo padrão HSPN; não comprova contrato/canal de produção nem valida semanticamente toda mensagem de score. O normalizador futuro deverá interpretar codeMessage/message para distinguir cálculo disponível de situações especiais.

O `503` seguido de `200` é evidência de falha transitória nesta execução, reforçando a necessidade de tratamento de indisponibilidade/retry limitado e reconciliação na implementação. Não tratar indisponibilidade como ausência de restrição ou Score zero, e não aplicar repetição automática indiscriminada em consultas de produção.

Estado atualizado: UAT validado para PF Avançado, PF Avançado Top Score (HSPN) e PJ Avançado Analítico. Consulta com Score PJ e outras features permanecem não testadas. A aplicação não foi modificada/deployada; os testes continuam diretos no UAT, sem gravação Supabase ou cobrança na carteira interna.

## 19. Entrega 1 implementada localmente — sem publicação

Implementada localmente a conexão server-side dos produtos UAT confirmados: PF `RELATORIO_AVANCADO_TOP_SCORE_PF` e PJ `RELATORIO_AVANCADO_PJ_ANALITICO`. A Edge só aceita URL exata UAT/produção, resolve CPF/CNPJ pela proposta, rejeita divergências antes do débito e não aceita payload de documento enviado pelo navegador. O health check autentica no IAM e deixa explícito que não testou os relatórios.

A migration aditiva `20261021000001_serasa_relatorios_autorizacoes.sql` propõe `consulta_autorizacoes` e `serasa_relatorios_config`, além de idempotência, ambiente/produto/versão no log e o estado `reconciliacao_pendente`. A chamada depende de autorização registrada com referência a documento aprovado, validado e anexado à mesma proposta. O ambiente de produção é semeado desligado e o RPC atual bloqueia sua ativação. Resposta Serasa é normalizada antes de persistir/devolver; o navegador não recebe nem lê `request`/`response` brutos. Débito e log são criados no RPC autenticado; finalização/estorno são restritos à Edge trusted service-role.

O estado local não confirma que migration, Edge Functions ou variáveis tenham sido aplicadas a Supabase remoto. Não houve consulta integrada pela aplicação, movimento de carteira, chamada de relatório nesta etapa, migração remota, atualização de secrets ou deploy. A produção continua bloqueada até credenciais/canal/segmento validados, reconciliação operacional aprovada e GO específico.

Verificações executadas: testes unitários do helper Serasa passaram 4/4; ESLint passou sem erros (38 avisos preexistentes); typecheck, build e `npm run validate:release` passaram; `git diff --check` passou. O build manteve o aviso existente de chunk maior que 500 kB. A suíte Vitest completa teve 4 falhas por timeout (126 testes passaram; 4 falharam em `adminLeadsSimulacoes`, `dateRangePicker`, `publicAmortizationSimulator` e `publicSimulator`); o helper tem teste isolado, mas não há teste de UI `PropostaConsultas`. O `db lint` no clone descartável reportou 13 problemas de schema/funções legadas; nenhum foi isolado como falha da nova RPC Serasa. Não houve smoke visual de navegador.

Complemento de validação local: para não resetar o banco compartilhado, foi criado um banco PostgreSQL descartável a partir apenas do schema do Supabase local e do histórico de migrations (sem linhas de negócio/PII). Todas as migrations pendentes, incluindo `20261021000001_serasa_relatorios_autorizacoes.sql`, foram aplicadas com sucesso nesse clone. O smoke [fase 46](../../supabase/smoke-tests/fase-46-serasa-integration.sql) passou: confirmou tabelas/RLS, configuração UAT, produção desabilitada, ACLs dos payloads, grants dos RPCs e estado de reconciliação. Isso valida a montagem do schema e os grants; não substitui fluxo autenticado com proposta/dados fictícios nem consulta via Edge Function. O banco descartável foi removido depois do teste; o banco Supabase local compartilhado permaneceu intacto e continua aplicado somente até `20260918000008`.

Antes de UAT integrado, ainda faltam um fluxo autenticado da proposta com dados fictícios e validação de RLS por perfil. Também precisa ser definida uma rotina segura e auditável para resolver logs `reconciliacao_pendente` (confirmar resultado ou estornar após consulta ao provedor); até ser implementada e testada, essa classe de falha exige intervenção operacional e impede declarar prontidão de produção. Nada desta etapa foi aplicado ao Supabase remoto, nem houve chamada de relatório pela aplicação, movimento de carteira, atualização de secrets ou deploy. A publicação Vercel segue aguardando coordenação com o backend.

## 20. Revalidação direta do produto UAT

Após autorização para prosseguir com o teste, foi feita chamada direta ao endpoint UAT de `RELATORIO_AVANCADO_TOP_SCORE_PF`, usando a massa sintética de exemplo da collection. O IAM respondeu HTTP 201 e o relatório HTTP 200. A resposta veio no envelope `reports[0]`; o helper atual a normalizou corretamente, identificando cadastro, score calculado e seção de dados negativos. Foram registrados apenas status e indicadores de presença, sem persistir ou exibir valores pessoais/financeiros.

Isso confirma conectividade do login e compatibilidade do helper com a resposta real do produto UAT. Não testa a Edge Function integrada ao Supabase: não houve proposta, autorização de consulta no banco, débito de carteira nem escrita em logs. O próximo passo permanece montar um Supabase descartável completo com migrations e Edge Function e validar esses controles com dados sintéticos; a rotina de reconciliação continua pendente.

## 21. Smoke integrado em Supabase descartável — resultado inconclusivo

O stack `mercurio-serasa-smoke-20261021` foi iniciado com portas próprias, recebeu as migrations até `20261021000001_serasa_relatorios_autorizacoes.sql` e passou o smoke estrutural fase 46. O harness executou as validações negativas para autorização ausente e titularidade incompatível. Uma consulta integrada autenticada à Edge Function chegou ao provedor, mas terminou em HTTP 202 `reconciliacao_pendente`; por segurança, não houve repetição. Assim, o cenário de resultado concluído, idempotência após sucesso e assertions fase 47 não foram aprovados.

A fixture sintética exigiu 2FA/AAL2 por causa das regras atuais de carteira. Uma chamada transacional direta à RPC, com claims locais de teste, passou e foi revertida. Depois da chamada inconclusiva, todos os registros sintéticos foram removidos do banco descartável; as contagens de usuários, logs e autorizações ficaram em zero. O projeto descartável foi parado e o diretório temporário removido. A instância local compartilhada continua aplicada somente até `20260918000008`. Nenhuma migration remota, secret, deploy, carteira real ou código de produto foi alterado.

Antes de uma nova chamada, confirmar com a Serasa pelo canal autorizado se a consulta UAT anterior foi processada. Se o estado não puder ser confirmado, tratar a reconciliação como pendência operacional; não repetir a mesma solicitação nem marcar o teste como aprovado. Artefatos do harness: [plano e resultado](../../prompts/2026-10-21-smoke-serasa-supabase-sintetico.md), [script](../../scripts/smoke-serasa-uat-disposable.mjs), [assertions fase 47](../../supabase/smoke-tests/fase-47-serasa-uat-integrado.sql).
