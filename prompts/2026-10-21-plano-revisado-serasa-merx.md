# Plano revisado — Serasa, classificação e MERX

Data: 21/10/2026. Estado: plano consolidado para aprovação da implementação e do modelo de dados da entrega 1.

## Objetivo e acordo de execução

Conectar os relatórios Serasa já validados no UAT ao fluxo autenticado de propostas e evoluir a classificação operacional para a MERX descrita nos informativos. O usuário informou que fornecerá as credenciais produtivas ao final. Trabalhar com homologação até o gate final; não depender de credenciais produtivas para desenvolver.

Este plano atualiza a parte Serasa/MERX do escopo anterior; não reabre as entregas de dashboard, simuladores, landing ou organograma. O prazo histórico de 8–10 dias não é assumido como estimativa desta revisão.

## Documentos e código inspecionados

- Instruções AGENTS fornecidas pelo usuário; `docs/README.md`; `docs/operacao/change-management.md`.
- `docs/escopo-melhoria-operacao-llm.md`; critérios v1, matriz e imagens ParametrosIA-01/02.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md`, incluindo os testes UAT das seções 16–18.
- Planos anteriores de Verify ID, aliases de credenciais e classificação/distribuição.
- Manual textual e collections PF/PJ/Top Score fornecidos pelo usuário.
- `supabase/functions/consulta-executar/index.ts`, `integracao-testar/index.ts`, RPCs de consulta/carteira, migrations de classificação/distribuição e políticas de responsável/admin.
- `app/src/components/PropostaConsultas.tsx`, `app/src/pages/admin/PropostaDetalhe.tsx`, `Configuracoes.tsx`, `adminScope.ts` e uploader documental.
- `app/package.json`: scripts lint, typecheck, build, test e validate:release.
- Skills: nenhuma skill da sessão é necessária para este planejamento de integração React/Supabase existente. Não haverá nova biblioteca/framework por este plano.

## Base comprovada e limites

| Produto UAT | Resultado | Observação |
|---|---|---|
| `RELATORIO_AVANCADO_PF` | 200 | Cadastro/negativos, sem bloco Score na chamada-base. |
| `RELATORIO_AVANCADO_TOP_SCORE_PF` | 200 | Bloco Score presente, modelo padrão HSPN. Primeira tentativa 503 PROCESSING; uma repetição funcionou. |
| `RELATORIO_AVANCADO_PJ_ANALITICO` | 200 | Cadastro em identificationReport, negativos e histórico comercial; segmentCode 028 do exemplo UAT. |

Login IAM confirmado com HTTP 201. Testes foram diretos no UAT; não validaram produção, integração na aplicação, cobrança interna, qualidade da classificação ou completude dos dados comerciais. Score PJ não foi validado. HSPN aceito no teste não determina o canal contratado de produção. HRLD/HLRD permanece inconsistência do manual; não selecionar outro modelo sem confirmação. O segmento 028 do exemplo PJ não vira padrão produtivo sem validação.

## Fluxo aprovado de referência

Captação pública/parceiros → qualificação e proposta → dados/documentos → consultas pertinentes e autorizadas → classificação e revisão → atribuição → acompanhamento operacional.

Calculadoras/CPC não disparam bureau por mero cadastro de contato. Classificação é de complexidade/encaminhamento; não decide aprovação ou recusa de crédito. Métricas e distribuição são calculadas pelo sistema, com auditoria; a IA trabalha sobre evidências e regras aprovadas.

## Entrega 1 — integração dos relatórios Serasa e controles de consulta

### Escopo funcional

1. Conector server-side IAM e relatórios PF Top Score/PJ Analítico; manter separados os conceitos de verificação cadastral, crédito e fraude.
2. Configuração do produto/canal/parâmetros controlada pelo servidor e por ambiente; o cliente envia proposta/tipo/chave de idempotência, sem escolher CPF/CNPJ ou endpoint.
3. Resolver titular PF/PJ a partir dos dados da proposta, validar tipo/formato e falhar antes de consulta/débito se a leitura do cadastro não funcionar. Conferir schema, inclusive a referência a nome_fantasia.
4. Resumo normalizado por produto, com fonte, ambiente, modelo e estado do cálculo. Não converter falta de Score em zero, ausência de bloco em “nada consta”, ou renda estimada em renda comprovada.
5. Alinhar o health check ao mesmo login IAM/aliases usados pelo conector. Teste de autenticação não será apresentado como homologação de todos os produtos.
6. Corrigir autorização de iniciar/concluir/estornar, impedir finais arbitrários do cliente, vincular documento e finalidade, restringir acesso a payloads e revisar RLS/view de consulta.
7. Mapear chamadas de wallet_credit/wallet_debit e restringir execução direta indevida sem quebrar as RPCs legítimas de carteira. Não deixar bypass pelos helpers após corrigir a Edge.
8. Idempotência, timeout, reconciliação de resultado e estorno confirmado. Falha de persistência após consulta bem-sucedida tem tratamento distinto de falha no provedor. Repetição não autoriza novo consumo indiscriminado.
9. A UI existente passa a mostrar produto, ambiente, resumo e estados de falha claros. Resultado bruto fica restrito conforme finalidade/perfil; não é devolvido por padrão na resposta da Edge.
10. Logs históricos Verify ID continuam identificados como verificação cadastral. Não reinterpretar resumo.score antigo como crédito; não reescrever histórico sem regra determinística aprovada.

### Modelo de dados proposto para aprovação — entrega 1

Reutilizar `propostas`, `clientes`, `precos_consulta`, `wallet_ledger`, `logs_consultas`, `integracoes_config` e suas relações. Não criar cadastro paralelo de cliente.

| Registro | Evolução proposta e invariantes |
|---|---|
| `logs_consultas` | Acrescentar chave de idempotência UUID, ambiente UAT/produção, produto/versão de normalização, referência à autorização e estado explícito de execução/reconciliação. Preservar log, débito, resposta e estorno originais. |
| Idempotência em `logs_consultas` | Mesma chave para mesmo ator/proposta/tipo retorna execução existente; chave reutilizada com escopo diferente é rejeitada. Criação da execução e reserva/débito são atômicas. Concorrência não cria consumo financeiro duplicado. |
| `consulta_autorizacoes` (nova, proposta) | UUID; proposta_id; tipo/produto; titular referenciado pelo cliente da proposta; finalidade; fundamento/registro de autorização conforme regra jurídica da operação; responsável que registra; evidência de referência quando exigida; datas de criação, revogação e validade quando aplicável. Sem credenciais ou cópia desnecessária de CPF/CNPJ. Uma proposta pode ter várias autorizações e cada execução referencia a autorização aplicável. |
| Autorização | Registro não é mero checkbox inventado nem prova criada automaticamente pelo modelo. Conteúdo/método aceitos devem refletir a regra já validada da operação. Ausente/revogada/incompatível, a consulta fica bloqueada. |
| Configuração Serasa (registro persistido server-side) | Um registro por ambiente com flag de consultas, reportName PF/PJ, parâmetros permitidos e versão. Credenciais ficam em secrets, não em configuração legível ao navegador. Produto fora da lista permitida é rejeitado. |
| Resumo JSON versionado | Identificação mínima; Score de crédito com modelo, código/mensagem de cálculo e disponibilidade; blocos negativos e totais por fonte; datas; histórico/participações quando disponíveis. Tipo de renda explícito. Estrutura PF/PJ preservada no normalizador; não somar ocorrência e respectivo resumo duas vezes. |
| Resposta bruta | Acesso somente por necessidade operacional explícita. Prazo de retenção/descarte precisa ser aprovado antes de uso produtivo; não armazenar indefinidamente como padrão implícito. |

As migrations deverão definir os tipos/estados finais e contratos RPC de forma compatível com os registros existentes; novas referências começam opcionais para o histórico e são obrigatórias no fluxo novo. Dados antigos não recebem autorização ou ambiente inventados. Relação execução → autorização deve garantir correspondência com a mesma proposta/titular/produto no servidor.

RLS: escrita de autorização/configuração somente pelos perfis operacionais permitidos; titular e execução acessíveis apenas no escopo autorizado. Finalização de provedor por executor confiável com conferência de estado. Validar acesso de admin limitado, jurídico, parceiro, membro e cliente; não depender do filtro de tela.

### Arquivos esperados

- Refatoração de `supabase/functions/consulta-executar/index.ts` e `integracao-testar/index.ts`.
- Módulos server-side em `supabase/functions/_shared/` para IAM, contratos PF/PJ e normalização (nomes finais na implementação).
- Nova migration forward-safe de consultas/autorização/configuração e RPCs; não editar migrations já publicadas.
- `app/src/components/PropostaConsultas.tsx` e pontos de configuração/detalhe necessários para autorização e resumo.
- Testes de conector/normalização/contratos e smokes SQL de autorização/idempotência; fixtures somente fictícias ou sanitizadas.
- Documentação operacional e runbook de homologação. Não versionar env, tokens ou collections contendo autenticação preenchida.

### Critérios de aceite e testes

- Contratos das três collections documentados; PF padrão de crédito usa Top Score, preservando a distinção do produto PF básico. PJ segue Analítico; outras features/modelos continuam sujeitos à contratação.
- Origem do documento exclusivamente no servidor; tentativa de substituição, falta de acesso, autorização inválida e tipo incompatível são rejeitados antes de consumir/cobrar.
- Credenciais ausentes ou integração desligada não geram mock, consulta ou débito. Mocks de outros provedores não aparecem como evidência real para classificação.
- Concluir/estornar com usuário indevido ou log de terceiro é bloqueado; view e resumo respeitam RLS/escopo. Fluxo legítimo de carteira continua funcional.
- Mesma chave/requisição concorrente não duplica execução/débito; estorno é confirmado, rastreável e aplicado uma vez. Timeout com resultado incerto não dispara consumo novo sem reconciliação.
- Sucesso UAT PF com Score e PJ Analítico; validar mapeamento, mensagens e casos sem cálculo. Sem prometer Score PJ inexistente.
- Cobrir 401/403/404/412/429/500/503, timeout, resposta inválida, sucesso do provedor seguido de falha de persistência e falha de estorno.
- `npm run lint`, `npm run typecheck`, `npm run build`, testes direcionados e `npm run validate:release` em `app/`; checagem Deno/SQL com ferramentas disponíveis e limites registrados.
- Smoke autenticado em proposta de teste local/UAT, estados vazios/inválidos e perfis relevantes. Gravação de fixtures remotas requer autorização própria. Não usar proposta real para simular homologação.

## Entrega 2 — classificador operacional baseado em evidências

Reaproveitar configuração, classes, pesos e revisão existentes. Consumir resumos válidos e atuais do Serasa e depois Bacen/jurídico quando realmente homologados. Corrigir classe sugerida versus definitiva, evidências/versão em todos os ramos, renda declarada/comprovada e análise por proponentes/garantias. Não classificar AAA com verificações externas obrigatórias ausentes apenas porque os demais campos estão preenchidos.

Antes de implementar: aprovar a matriz dos seis pilares, disponibilidade/validade das fontes, limites numéricos, severidade de pendências e catálogo de desqualificação humana. Modelo de análise versionada e revisão será detalhado e aprovado nessa entrega. A flag inicia desligada até validação com casos anonimizados.

## Entrega 3 — MERX assistida por IA

Implementar análise documental e relatório estruturado por pilar com fonte/evidência, pendências, recomendações e revisão. Extração pesada em jobs no servidor; saídas validadas por schema. Determinar dados mínimos, modelo/provedor, custo, retenção e tratamento de falhas antes de enviar documentos/dados à IA.

NVIDIA API é opção já documentada; Nemotron local/GPU/fine-tuning não são pré-requisitos assumidos. Proposta continua sendo criada se processamento falhar e permanece pendente para revisão. Preparar avaliação com casos anonimizados, métricas de erro por classe e exemplos sensíveis; não assumir confiança do modelo como probabilidade de aprovação. Modelo de dados de execuções/evidências/revisões passa por aprovação específica.

## Entrega 4 — distribuição e supervisão

Aplicar composição-alvo por nível (júnior 60/30/10; pleno 25/55/20; sênior 10/25/65), sem transpor percentuais das linhas para sorteio por coluna. Formalizar capacidade/ausências/excesso, exclusão de reatribuições duplicadas da carga, revisão sênior, acesso somente à carteira e acesso de supervisão. A função de gestor do organograma não concede acesso por si só.

Criar indicadores e alertas operacionais necessários. Bonificação monetária aguarda fórmula/valores/reversões aprovados; limiar agregado de 100 e pesos 1/1,3/1,7 não equivalem a remuneração pronta. Capacidade sênior 9 versus 12 continua decisão pendente.

## Impacto por superfície

| Superfície | Impacto |
|---|---|
| Web admin/parceiro | Consulta, autorização, resumo e erros; classificação/supervisão nas entregas posteriores. |
| Banco/RLS/RPCs | Contratos, histórico, autorização, idempotência, carteira e acesso por perfil. |
| Edge Functions | IAM, relatórios, normalização e resiliência; IA somente em entrega própria. |
| Mobile | Auditar consumo de consulta/classificação; adaptar apenas se expuser os contratos alterados, sem presumir paridade. |
| Electron/updater | UI compartilhada pode ser afetada; empacotamento/updater não mudam por este plano. Publicação de artefatos desktop é gate próprio. |
| Público/landing/calculadoras | Sem disparo de bureau ou coleta nova por este escopo. |
| Compliance/operação | Finalidade/autorização, minimização, retenção, evidências e tratamento de incidente. |
| Documentação/release | Sincronizar contratos e remover afirmações antigas de mocks/produtos quando de fato substituídos; rollout separado. |

## Rollout, credenciais produtivas e rollback

1. Aprovar plano/modelo da entrega 1; implementar e testar localmente em checkout isolado, preservando os demais escopos locais.
2. Preparar migration, backend, frontend e configuração UAT compatíveis; autorização separada para migrations/deploy em ambiente remoto.
3. Homologar o fluxo integrado, incluindo carteira e acesso, antes de habilitar produção. Atualizar flags/documentação com evidência real.
4. Ao final, o usuário fornece credenciais de produção pelo canal seguro; configurar apenas no runtime backend aprovado. Confirmar produtos, canal/modelo, segmento PJ e custos de produção. Não fazer cópia automática do env local para Vercel/frontend.
5. Produção exige GO final e teste controlado autorizado com titular/finalidade válidos; resultados UAT não substituem essa validação.
6. Rollback operacional: desabilitar novas consultas/automação por flag e manter leitura de histórico; reverter artefatos compatíveis se necessário. Não apagar logs, autorizações ou movimentos financeiros nem retornar silenciosamente ao Verify ID como se fosse relatório de crédito.

## Aprovações e decisões remanescentes

- Esta revisão permite aprovar o escopo/modelo da entrega 1 de forma concreta; não confunde liberação de testes UAT com aprovação das novas tabelas ou migrações.
- Configuração final de canal/modelo de Score, segmento PJ, registro jurídico exigido para consulta e retenção são gates para uso produtivo. Consultas sem contexto válido ficam bloqueadas.
- Entregas 2–4 precisam de planos de dados e decisões operacionais próprias antes de implementação; a integração Serasa pode avançar independentemente dessas decisões.
- Nenhuma funcionalidade da aplicação foi alterada pela criação deste documento.
