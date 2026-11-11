# Relatório PF — referência visual e contrato de dados proposto

Data: 29/10/2026. Estado: implementação local aprovada e em validação. Migration e Edge Function ainda não foram publicadas; features comerciais seguem desativadas até confirmação de disponibilidade no contrato.

## Fontes verificadas

- PDF PF fornecido pelo dono do produto: quatro páginas; três páginas de relatório e uma de rodapé. Renderizado e examinado localmente com PDFKit. Dados pessoais e valores do exemplo não são fixtures do projeto.
- [Manual oficial do Relatório Avançado PF](https://developer.serasaexperian.com.br/data/relatorio-avancado-pf/index.md), obtido do catálogo público do portal.
- [OpenAPI oficial PF](https://developer.serasaexperian.com.br/data/relatorio-avancado-pf/swagger.yaml), obtida do mesmo catálogo.
- SHA-256 do manual consultado: `7564fa9157666b48ca15bce886b12375bba3184f1955acdee1b326feeb608901`.
- SHA-256 da OpenAPI consultada: `f806c2bc383c451ce886a1b0447ee24870081673c40da34680fec61413eb3845`.
- Normalizador, Edge, componente de consultas, ACLs e documentação de segurança existentes.

## Estrutura visual a reproduzir

1. Cabeçalho com titular da consulta, produto, fonte e data/hora; vínculo ao proponente selecionado.
2. Resumo executivo: situação cadastral, score, total/quantidade de apontamentos, participações societárias e consultas do mês.
3. Identificação cadastral, telefones, endereços e informações cadastrais complementares.
4. Score com escala, modelo e interpretação fornecida/documentada.
5. Negativos: cards por categoria, total e tabelas de ocorrências.
6. Participações societárias em tabela.
7. Documentos roubados, furtados ou extraviados.
8. Consultas ao crédito: gráfico mensal, totais e detalhamento por segmento/data.
9. Cheques sustados/históricos.
10. Renda+ 5.0: renda estimada, capacidade de pagamento, comprometimento e origens.

Usar fundo branco, títulos azuis, separadores e bordas cinza finos, cards contornados e tabelas compactas da referência. O relatório ocupa uma área ampla dentro do detalhe de consulta existente; o modal atual de `max-w-2xl` com texto pequeno não comporta esse padrão. No mobile, tabelas podem rolar horizontalmente e cards empilham. Controles usam `btn-no-liquid`. Fonte Serasa e plataforma Mercúrio são identificadas no contexto já existente.

## Mapeamento das seções

| Seção do PDF | Caminho no contrato PF | Situação atual / ajuste |
|---|---|---|
| Situação cadastral e atualização | `registration.statusRegistration`, `statusRegistrationCode`, `statusDate` | Incluídos na projeção privada e no relatório PF. |
| Identificação | `registration`: `consumerName`, `documentNumber`, `birthDate`, `motherName`, gênero, estado civil, profissão/ocupação, escolaridade/dependentes, documentos e vínculo empresarial documentados | Incluídos por allowlist no relatório privado. Cadastro da proposta e retorno do bureau permanecem identificados por fonte, sem sobrescrita automática. |
| Município/UF e endereços | `registration.address`, `registration.addresses[]`; `localization.address` quando presente | Extrair endereço, complemento, CEP, bairro, cidade/UF, data de atualização. Não atribuir prioridade que a API não informa. |
| Telefones | `registration.phone`, `registration.phones[]`; `localization.phone` | Extrair DDI/DDD/número/tipo/atualização conforme schema. Não inferir prioridade nem contato principal. |
| Score | `reports[].score`, `reports[].scores.scoreResponse[]` e equivalentes em `optionalFeatures` | Adaptador lê modelo/faixa/mensagem/taxa sem misturar score e fraude. Feature desativada até modelo e disponibilidade comercial serem configurados. |
| Totais negativos | `negativeFlag`, `negativeSummary`, summaries por fonte | Mantidos somente quando informados pelo provedor; resumo separado da projeção privada e sem inferir zero. |
| Dívidas comerciais Pefin | `negativeData.pefin.summary` / `pefinResponse[]` | Ocorrências projetadas por allowlist com data, valor, natureza, origem/credor, contrato, praça e flags documentadas. |
| Dívidas financeiras Refin | `negativeData.refin.summary` / `refinResponse[]` | Ocorrências projetadas por allowlist; dados detalhados permanecem na coluna privada e não no resumo da proposta. |
| Dívidas vencidas Convem | `negativeData.collectionRecords.summary` / `collectionRecordsResponse[]` | Usar somente se retornado com semântica confirmada; manter chave/origem do provedor e rótulo fiel. |
| Protestos | `negativeData.notary.summary` / `notaryResponse[]` | Data, valor, cartório, cidade/UF e referências permitidas. |
| Cheques sem fundo BACEN | `negativeData.check.summary` / `checkResponse[]` | Data, banco, agência, cidade/UF, número/identificação do cheque, alínea e quantidade; distinguir quantidade de cheques de quantidade de ocorrências. |
| Ações judiciais | `facts.judgementFilings.summary` / `judgementFilingsResponse[]` | Já há presença de bloco na consulta v2, mas conteúdo é omitido. Extrair natureza, datas, valor, processo/foro e local documentados. |
| Participação em falência | `facts.bankrupts.summary` / `bankruptsResponse[]` | Já há presença de bloco, sem conteúdo normalizado. Empresa/CNPJ, natureza, processo, participação e datas/local conforme retorno. |
| Participações societárias | `partner.summary` / `partnershipResponse[]` | Projeção privada inclui CNPJ, percentual, tipo, início, UF, situação/data e atualização, com aliases documentados. |
| Documentos roubados | `facts.stolenDocuments.summary` / `stolenDocumentsResponse[]` | Exibe campos permitidos (tipo, datas, motivo, UF/órgão); o número do documento reportado é omitido. Bloco recebido não prova ocorrência. |
| Gráfico e totais de consultas | `facts.inquirySummary.inquiryQuantity` e listas mensais | Resumo mensal e histórico renderizados quando presentes; estados ausentes não viram zero. |
| Detalhe de consultas | `facts.inquiry.inquiryResponse[]` | Data e segmento. `daysQuantity` significa dias desde a última consulta e NÃO quantidade de consultas no dia. Só exibir contagem diária se existir fonte documentada para esse valor. |
| Cheques sustados/históricos | `checkFilingsHistorical` e variantes documentadas em `negativeData`; `checkFilings` conforme estrutura | Projeção privada inclui ocorrências/motivos/datas/quantidades/valores. Número da conta e nome de titular da conta são omitidos. |
| Renda+ 5.0 | Feature `RENDA_MAIS`, modelo `HRM5` (transação `BP5K` para relatório avançado, conforme manual); `attributes`/`attributesResponse` e campos condicionais de `Features` | Hoje não solicitada/normalizada. Ler modelo, código, mensagem e valores apenas nos caminhos comprovados. `Features` documenta `income`, `paymentCapacity`, `incomeCommitment`, `incomeSource[]` com código/descrição, condicionais ao modelo. Fixture sanitizada/UAT deve confirmar a combinação efetiva que preenche os quatro blocos do PDF. |

`optionalFeatures` pode estar na raiz da resposta, fora de `reports[0]`; o normalizador trata o objeto de features documentado e registra quais blocos retornaram, sem copiar chaves desconhecidas. O resumo público e o relatório privado são projeções distintas.

## Regras de interpretação

- `defaultRate` é probabilidade de inadimplência, não chance de pagamento. Não copiar o percentual do PDF nem usar uma tabela fixa por faixa. Uma conversão para chance de pagamento só é válida com unidade, horizonte e regra documentados para o modelo; até lá, exibir o indicador com seu significado original.
- Score de crédito, score de fraude, indicadores de renda e análise futura MERX têm natureza e unidades distintas.
- O manual contém a divergência `HLRD` no aviso inicial e `HRLD` nas tabelas do canal distribuidor. Não ativar modelo por suposição nem trocar `reportName` automaticamente.
- Renda estimada não é renda comprovada; valores Serasa não sobrescrevem renda declarada da proposta.
- Indicadores ausentes, blocos explicitamente vazios, erros por bloco, dados não contratados e formato não reconhecido são estados diferentes. Não mostrar “Sem registros” por falta de campo.
- `negativeSummary.summaries` aparece como objeto no OpenAPI, enquanto o código atual espera array. Tratar os formatos comprovados por schema/fixture e preservar ausência de totais.
- Totais do provedor e detalhes exibidos têm cobertura própria. Informar truncamento quando houver; não inventar total a partir de lista parcial nem converter falta de detalhe em zero.
- `principal=false` pode representar avalista conforme schema; traduzir somente quando o booleano for explícito.
- Cadastros, telefones e endereços do bureau são histórico da consulta, não atualização silenciosa do cadastro operacional.
- A API/feature contratada determina a disponibilidade. A existência da seção no PDF de referência não comprova habilitação no contrato atual.

## Dados e acesso propostos

- Reutilizar `logs_consultas` e `proponente_id`; nenhuma tabela paralela de consulta PF.
- `logs_consultas.resumo`: indicadores mínimos para listagem/card, sem adicionar PII/contratos/endereço.
- `logs_consultas.response`: relatório PF normalizado privado com allowlist de campos definidos neste documento; não guardar o payload bruto do provedor.
- A coluna `response` não tem SELECT para `authenticated`, confirmado remotamente em 29/10. Preservar esse bloqueio e acrescentar RPC de detalhe que autoriza a proposta/proponente e retorna somente o relatório permitido.
- Admin e parceiro/equipe dentro dos acessos operacionais já permitidos. Não ampliar acesso de anônimo ou cliente à projeção privada.
- O novo modelo amplia deliberadamente a projeção mínima aprovada anteriormente, para atender as colunas cadastrais e de ocorrências do PDF; a implementação foi aprovada. A migration acrescenta configuração de features PF e RPCs restritas para escrita administrativa e leitura por proposta.
- As consultas históricas não contêm o detalhe descartado; continuam disponíveis como relatório parcial/legado, com essa condição explícita. Não reconstruir dados nem executar nova consulta automaticamente.

## Pendências comerciais

- Confirmar habilitação da feature SCORE e modelo exato compatível com o relatório/canal.
- Confirmar habilitação `RENDA_MAIS`/HRM5 e os retornos que cobrem renda, capacidade, comprometimento e origens da referência.
- Solicitar schema/fixture sanitizada ou UAT autorizado para os campos condicionais, sem consumir produção para testar parser/UI.
- Manter SPC fora da requisição conforme o material contratual apresentado pelo dono.

## Estado da implementação local

- Normalizador PF v3 grava somente campos allowlisted em `logs_consultas.response`; `logs_consultas.resumo` recebe a projeção compacta usada na listagem.
- A interface de detalhe usa a RPC `consulta_relatorio_obter`; a coluna privada não recebe SELECT direto para usuários autenticados. Clientes não podem chamar a RPC; parceiros/equipe precisam estar ativos, aprovados e autorizados pela relação com a proposta.
- A configuração de `SCORE` e `RENDA_MAIS` exige Admin full e modelo explicitamente escolhido. Sem habilitação/configuração, as features não são solicitadas.
- Histórico anterior ao normalizador v3 aparece como parcial; não há reconstrução nem nova consulta automática.
- A migration `20261029000001_serasa_pf_relatorio_detalhado.sql` e o deploy da Edge Function ainda precisam de uma publicação coordenada, não executada nesta implementação local.
