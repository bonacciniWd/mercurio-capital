# Serasa PF — parâmetros Base64, feature SCORE e resultados históricos

Data: 29/10/2026. Estado: diagnóstico concluído; proposta de implementação local aguardando aprovação. Nenhuma chamada Serasa ou alteração remota realizada nesta investigação.

Após a referência PDF fornecida pelo dono, o escopo de relatório PF foi consolidado no plano `2026-10-29-serasa-pf-padrao-relatorio-referencia.md` e no mapeamento `docs/operacao/serasa-pf-relatorio-referencia.md`. Esses documentos são a versão corrente para aprovação; as constatações técnicas deste diagnóstico continuam como histórico.

## Objetivo

Primeiro ampliar a normalização dos blocos já retornados pelo relatório PF para a avaliação documentada da operação. Em uma segunda frente, preparar suporte configurável a features e parâmetros PF, preservando produto, autorizações, vínculos por proponente, RLS, idempotência e cota. Manter SCORE desligado até confirmar habilitação contratual e modelo junto à Serasa.

## Documentos e skills

- AGENTS.md fornecido na conversa; gestão de mudanças, esquema e segurança do projeto já lidos nesta sessão.
- Documento completo anexado pelo dono em `attachments/5bb457ad-b476-4b5d-89e5-3ed3714ed80c/Texto colado.txt` (349 linhas).
- `prompts/2026-10-28-serasa-resultados-por-proponente.md` e plano de publicação correspondente.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md` (histórico; não usado como prova de estado remoto atual).
- Collection PF Top Score local, somente campos de requisição não sensíveis.
- Tentativa de abrir documentação pública oficial PF pelo navegador de pesquisa sem sucesso; a análise do contrato desta etapa usa o documento completo fornecido.
- Nenhuma skill disponível exige aplicação específica para esta investigação de código/contrato.

## Código e banco inspecionados

- `supabase/functions/_shared/serasa-reports.ts`: request builder, JSON da resposta, Base64 dos parâmetros e normalizador v2.
- `supabase/functions/consulta-executar/index.ts`: whitelist dos produtos, leitura da configuração e seleção do proponente.
- `app/src/components/PropostaConsultas.tsx`: exibição dos agregados normalizados v2.
- `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql` e RPCs de configuração.
- Configuração remota consultada somente em leitura: produção usa `RELATORIO_AVANCADO_PF`; não existe configuração PF de features/parâmetros. `parametros_pj` está nulo em produção.
- As quatro consultas concluídas existentes (28/10 e 29/10 às 09:16 de Brasília) não têm `normalizerVersion` nem os agregados `facts`, `negativeSummary`, `partner` e `checkFilingsHistorical`. São resumos anteriores à publicação do normalizador v2; os dados brutos não estão armazenados.
- Atualização da evidência: o dono apresentou nova consulta de 29/10 às 13:59:12 de Brasília. Verificação remota confirmou `normalizerVersion=2`, sem score, com `facts.availableBlocks` contendo `inquiry`, `inquirySummary`, `stolenDocuments`, `judgementFilings` e `bankrupts`. A observação anterior descrevia o snapshot de quatro logs; não descreve esta nova consulta.
- `extractFacts` extrai somente o resumo de consultas e guarda os nomes dos demais blocos. Portanto, documentos roubados, ações judiciais e falências não têm conteúdo normalizado/display, mesmo com a presença das seções confirmada. O detalhe bruto não foi persistido; não sabemos se os blocos contêm ocorrências, lista vazia ou outro estado.
- `negativeSummary.hasNegative` está nulo na nova consulta; a ausência do indicador não permite concluir ausência global de apontamentos.
- Matriz e critérios operacionais do projeto conferidos: avaliação depende também de garantia, renda, documentos, consultas e pendências; o Serasa não substitui dados documentais nem decisão humana.

## Diagnóstico e decisões

1. O Base64 da documentação é o query parameter de entrada `reportParameters`, contendo o JSON completo `{ "reportParameters": [...] }`. Não é transformação da resposta nem forma de obter campos ausentes de um resumo salvo.
2. A resposta do relatório é JSON. Preservar o parsing JSON e a normalização por allowlist no servidor.
3. `requestSerasaReport` já codifica parâmetros para Base64, mas a Edge passa parâmetros apenas para PJ. O builder não tem suporte a `optionalFeatures`.
4. O documento descreve SCORE como opcional em `RELATORIO_AVANCADO_PF`; não inferir que está contratado apenas pelo acesso ao relatório base.
5. Há inconsistência no material: início indica `HLRD`; tabelas/notas indicam `HRLD` para distribuidor. Além disso, a tabela de modelos da feature SCORE do relatório base não lista HRLD, enquanto Top Score/combos o listam. Não escolher um código nem trocar para Top Score silenciosamente.
6. Sem SPC: o material informa que esse recurso não está disponível no contrato do distribuidor.
7. Preservar os quatro logs antigos e sinalizar resumo legado quando necessário; não inventar agregados nem reinterpretar ausência como zero. Apenas uma resposta original legítima, se fornecida posteriormente, poderia permitir reprocessamento controlado.
8. Nenhuma consulta de produção nesta fase. Resultados novos serão validados primeiro por fixtures sintéticas/documentadas e mocks HTTP.

## Frente prioritária — dados já retornados

- Evoluir o resumo versionado para extrair agregados permitidos de `facts.stolenDocuments`, `facts.judgementFilings`, `facts.bankrupts` e, quando útil e documentado, de `facts.inquiry`.
- Definir caminhos e semântica a partir do schema oficial/fixture sanitizada; não inventar estrutura por nomes dos blocos. Presença de bloco não significa ocorrência; ausência de campo não significa zero.
- Exibir contagens, montantes/datas quando documentados e necessários, com estados explícitos para vazio confirmado, ausente, formato não reconhecido e falha de normalização. Não expor documentos de terceiros, contratos, contas bancárias nem payload bruto.
- Revisar `negativeSummary` para suportar os formatos documentados e explicar quando o indicador global não veio. Os zeros de cinco categorias não constituem um parecer cadastral completo.
- Preservar registro por proponente e mesma visualização/autorização Admin/Partner já aprovada; usar componentes/estilos existentes. Nenhum novo critério de aprovação ou reprovação automática.
- Esta frente não requer novas tabelas nem colunas: reutiliza `logs_consultas.resumo` e incrementa `normalizerVersion` quando o contrato normalizado mudar. A extensão de configuração abaixo pertence à segunda frente.
- Logs anteriores, inclusive o novo resumo v2, permanecem intactos: os detalhes omitidos não podem ser reconstruídos a partir de `availableBlocks`. Não executar consulta de produção para obter fixture.

## Modelo de configuração proposto

Reutilizar `serasa_relatorios_config`; sem nova tabela de resultados.

- `features_pf text[] NOT NULL DEFAULT '{}'`: lista explícita/validada de features contratadas; inicialmente vazia. Primeiro suporte limitado a SCORE, sem SPC.
- `parametros_pf jsonb NULL`: objeto no formato documentado com a lista `reportParameters`; somente parâmetros permitidos para as features habilitadas. Sem CPF, CNPJ, nome ou credenciais.
- Atualização pela RPC administrativa existente ou RPC específica com guard admin full, auditoria e validação no servidor. O frontend não escreve diretamente.
- Habilitar SCORE exige feature, modelo e combinação produto/modelo confirmados; a migration não preenche nem ativa esse recurso automaticamente.
- `parametros_pj`, produtos atuais, preços, cotas, logs e autorizações mantêm sua semântica existente.

## Arquivos esperados após aprovação

- Migration aditiva de configuração/RPC; não editar migrations publicadas.
- `supabase/functions/_shared/serasa-reports.ts` e testes: `optionalFeatures` e Base64 UTF-8 compatível com URLSearchParams.
- `supabase/functions/consulta-executar/index.ts`: aplicar configuração PF validada antes de iniciar chamada/cota.
- `app/src/pages/admin/Integracoes.tsx`: configuração usando os componentes existentes, sem segredo/PII no cliente.
- `app/src/components/PropostaConsultas.tsx`, somente se necessário indicar resumo legado e estados não retornados; sem inferir dados.
- Para a frente prioritária, o normalizador/testes e a renderização compartilhada mostrarão os agregados documentados dos blocos já recebidos; preservar os limites de dados acordados.
- Runbook Serasa atualizado.

## Critérios de aceite e segurança

- JSON dos parâmetros codificado exatamente uma vez; query escapada por URLSearchParams; resposta continua JSON.
- Feature/modelo ausentes ou não permitidos bloqueiam a ativação antes de consulta ou débito. Não habilitar SPC nem mudar o produto contratado.
- RLS, role, titular da consulta, aceite, idempotência e cota permanecem obrigatórios.
- Frontend recebe apenas dados permitidos; nenhuma resposta bruta, CPF/CNPJ ou segredo é usado em fixtures/logs/browser.
- Nenhuma atualização dos logs legados para simular dados que não foram preservados.

## Verificações previstas

- Testes com fetch simulado: PF sem features, PF SCORE/config válida, Base64 decodifica para o JSON original, modelo inválido, features não contratadas e fluxo PJ existente.
- Normalizador: score ausente/zero/retornado, seções opcionais e campos proibidos; sem requisição externa.
- Blocos atuais: ocorrências presentes, lista explicitamente vazia, bloco ausente, campos/tipos inesperados, total não informado e dados identificáveis excluídos. Cobrir ações, falências e documentos roubados conforme schema; não derivar alerta por mera presença de seção.
- Lint, typecheck, build e testes pertinentes; smoke SQL transacional da configuração/RPC quando houver ambiente local compatível.
- Verificação visual das configurações e resumos pelos componentes existentes; nenhum teste executa consulta paga.

## Rollout, rollback e impacto

- Esta proposta cobre somente implementação e validação locais. Migration remota, configuração ativa, Edge/Vercel e consulta real são operações posteriores.
- Rollout posterior: migration aditiva com features vazias, Edge compatível e UI; só então ativação comercial explicitamente autorizada.
- Rollback operacional: desabilitar features PF, restaurar versões anteriores se necessário; preservar migration aditiva, logs e auditoria.
- Impacto: web Admin/configuração e Edge Serasa; banco aditivo. Mobile, Electron, updater, demais integrações e análise MERX não afetados.

## Aprovação

Plano revisado após a nova consulta v2 apresentada pelo dono. Pendente para implementação local, priorizando normalização dos dados já retornados. Ativação de SCORE condicionada à confirmação da Serasa sobre habilitação e modelo exato; não incluída nesta aprovação.
