# Plano — resultados Serasa vinculados a cada proponente

Data: 28/10/2026. Estado: plano aprovado; documentação oficial do Relatório Avançado PF conferida.

## Objetivo

Corrigir o fluxo para que uma consulta Serasa PF/PJ seja feita sobre um proponente explicitamente escolhido, persistida com vínculo a esse proponente e apresentada na tela **Proponentes** e no histórico **Consultas** da mesma proposta. Normalizar as seções de resultado que o Relatório Avançado PF efetivamente retorna sem expor payload bruto, credenciais ou dados pessoais desnecessários.

Não executar novas consultas Serasa de produção durante implementação ou validação automatizada. Os registros compartilhados pelo usuário mostram três consultas PF concluídas em produção em 28/10; elas já consomem 3 unidades da cota diária de Admin.

## Skills, documentos e referências lidos

- `AGENTS.md` fornecido pelo usuário nesta conversa e `docs/operacao/change-management.md`.
- `docs/README.md`, `docs/operacao/2026-10-21-auditoria-serasa-merx.md`, `docs/operacao/serasa-admin-cota-diaria.md`, `prompts/2026-10-27-plano-aceite-consultas-cliente.md`, `prompts/2026-10-27-plano-validacao-serasa-pf-producao.md` e `prompts/2026-10-28-cota-serasa-admin.md`.
- Documentação oficial: [Relatório Avançado PF](https://developer.serasaexperian.com.br/api/relatorio-avancado-pf#documentos-de-apoio), incluindo o OpenAPI publicado pelo Developer Portal em `/data/relatorio-avancado-pf/swagger.yaml`. Foram conferidos os schemas `NegativeSummary`, `NegativeSummaryData`, `Facts`, `Partnerships/PartnershipResponse`, `CheckFilingsHistorical/CheckFilingsHistoricalResponse`, `Score` e `Scores/ScoreResponse`.
- Collections locais em `API/Serasa/Collections/`: confirmam endpoints e nomes de produto, mas não contêm fixture de resposta compatível com o retorno de produção observado.
- Não há `AGENTS.md` do projeto na raiz nem skill especializada de Supabase/Serasa disponível neste workspace.

## Código e configuração inspecionados

- `supabase/functions/_shared/serasa-reports.ts`: normaliza `reports[0]`, procura score em caminhos limitados e lê agregados de `negativeData`; descarta outras seções do relatório.
- `supabase/functions/_shared/serasa-reports.test.mjs`: fixtures atuais cobrem formato hipotético com `score` e `negativeData`, sem cobrir as seções observadas em produção.
- `supabase/functions/consulta-executar/index.ts`: atualmente resolve CPF/CNPJ de `clientes` pela proposta; persiste o resumo sanitizado em `logs_consultas.response` e `logs_consultas.resumo`, não o relatório bruto.
- `supabase/migrations/20260513000003_originacao.sql`: `proponentes` tem `id`, `proposta_id`, `pessoa_tipo`, `cpf_cnpj`, nome e relação com cliente; vários proponentes por proposta.
- `supabase/migrations/20260518000020_consultas_fase6.sql`: `logs_consultas` associado à proposta; leitura por RLS/view; response protegido contra leitura direta pelo navegador.
- `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql`: `consulta_autorizacoes` hoje é proposta/tipo e a view `v_consultas_proposta` expõe o resumo. Finalização é service-role only.
- `supabase/migrations/20261027000002_proposta_consulta_aceite_cliente.sql`: aceite do cliente principal versionado no escopo da proposta; texto diz que não é aceite individual dos demais proponentes.
- `supabase/migrations/20261028000002_serasa_admin_cota_diaria.sql`: cota de 20 consultas novas por Admin/dia em produção, com modalidade interna sem carteira.
- `app/src/components/PropostaConsultas.tsx`: consulta/histórico estão agrupados por proposta e tipo; drawer mostra apenas o resumo sanitizado.
- `app/src/pages/admin/PropostaDetalhe.tsx` e `app/src/pages/partner/PropostaDetalhe.tsx`: cards de proponentes e painel de consultas atual ainda não exibem resultado por proponente.

## Evidência recebida e diagnóstico

- Foram compartilhados três registros Serasa PF em status `concluida`, produto `RELATORIO_AVANCADO_PF`, ambiente de produção. O preço de tabela aparece como R$ 7,50 por log, mas os IDs de ledger são nulos e a modalidade é interna; isso não representa débito do parceiro.
- Os três resumos têm `score: null`, `identityAvailable: true`, categorias atuais de `negativeData` normalizadas como zero, e `availableSections` inclui `negativeSummary`, `facts`, `partner` e `checkFilingsHistorical`.
- O HTTP 200 e os logs consultados demonstram que o histórico foi persistido. Os resultados não ficam vinculados a um proponente específico; o Edge usa o documento do cliente principal. O normalizador omite as seções listadas em `availableSections` e não temos o payload original para verificar o significado dos zeros ou o caminho exato do score.
- O retorno Serasa original não é persistido nem transmitido ao navegador por desenho de segurança. Não será possível reconstruí-lo a partir dos três resumos atuais. A documentação OpenAPI oficial, porém, descreve os campos disponíveis para as seções recebidas e permite uma normalização por allowlist sem nova consulta.

## Decisões e regras de negócio

1. `proponentes` é a fonte da verdade para o titular da consulta. A interface envia somente `proponente_id`; CPF/CNPJ não é aceito no body da Edge Function.
2. Cada consulta Serasa nova precisa identificar um proponente da mesma proposta. O servidor valida vínculo `proponente.proposta_id = body.proposta_id`, tipo PF/PJ, tamanho e dígitos verificadores do documento. Não há fallback silencioso para cliente principal, primeiro proponente ou outro documento.
3. O aceite existente continua sendo uma instrução do cliente principal com escopo da proposta, conforme decisão registrada em 27/10. Uma consulta por proponente fica auditada com `proponente_id`, mas não cria nem simula aceite individual. Nenhuma mudança de texto/base legal está incluída.
4. Registros históricos permanecem válidos com `proponente_id = null`; não inferir titular retroativamente nem atribuir as três consultas atuais a alguém sem evidência.
5. Resultado é somente resumo permitido e normalizado. Não salvar ou retornar payload bruto, nome/CPF/CNPJ do titular, endereço, credor, número de contrato/conta/cheque, identificadores de sessão, ou dados que não sejam necessários à tela.
6. Zero só será mostrado quando o provedor retornar explicitamente uma contagem/saldo zero em estrutura reconhecida. Ausente, não contratado, não retornado, não reconhecido e falha são estados distintos; score ausente nunca vira 0.
7. Os campos de `facts`, `partner`, `negativeSummary` e `checkFilingsHistorical` serão mapeados somente conforme schemas e semânticas documentados oficialmente. A ausência de fixture não será tratada como prova de presença em toda resposta; campos opcionais ausentes permanecem não retornados. Não expor dados sensíveis documentados, como número de conta/cheque, nome de titular, CPF/CNPJ de terceiros ou detalhes bancários.
8. Consultas PF e PJ usam o documento e `pessoa_tipo` do proponente escolhido. Não inferir disponibilidade de score/features PJ a partir de PF ou do nome do produto.
9. Resultado Serasa permanece separado da futura análise/score MERX; a tela identifica produto, fonte, data e modelo somente se retornados.

## Modelo de dados proposto

Sem nova tabela de resultados. Reutilizar `proponentes`, `consulta_autorizacoes` e `logs_consultas`.

| Entidade | Extensão proposta | Relação e invariantes |
|---|---|---|
| `proponentes` | Sem novo dado documental. Registro já contém `id`, `proposta_id`, `pessoa_tipo` e `cpf_cnpj`. | Uma proposta contém N proponentes; o proponente escolhido deve pertencer à proposta e seu tipo deve corresponder a `serasa_pf`/`serasa_pj`. Documento só é lido no servidor. |
| `consulta_autorizacoes` | Adicionar `proponente_id uuid null references proponentes(id)`. | Nova autorização operacional grava o titular alvo. RPC confere que o proponente pertence à mesma proposta/tipo. `proposta_consulta_aceites` continua pertencendo ao cliente principal e cobrindo a proposta conforme o escopo/versão registrada. Registros legados com `NULL` permanecem intactos. |
| `logs_consultas` | Adicionar `proponente_id uuid null references proponentes(id)` e índice `(proposta_id, proponente_id, iniciado_em desc)` parcial para Serasa. Expor `proponente_id` na `v_consultas_proposta` e na concessão explícita de colunas. | Uma consulta tem uma proposta e, para novas consultas Serasa, exatamente um proponente-alvo. Logs legados permanecem sem titular associado. A idempotência também compara `proponente_id`, impedindo reutilizar chave para outro titular. |
| `logs_consultas.resumo` | Evoluir forma normalizada/versionada; sem coluna nova para payload bruto. | JSON de allowlist com fonte/produto/versão/data, score opcional, agregados e ocorrências explicitamente permitidos. Não copiar identificadores/documentos de pessoa. |

`proponente_id` em `consulta_autorizacoes` e `logs_consultas` é nullable exclusivamente para compatibilidade histórica e consultas não Serasa existentes. O novo caminho Serasa recusa null. Migration aditiva; migrations já publicadas não serão editadas. Ajustar grants da view/colunas e manter `security_invoker`, ACLs e RLS existentes sem ampliar papéis, propostas ou carteiras acessíveis.

## Fluxo esperado

1. Usuário autorizado abre a proposta e escolhe **Consultar Serasa PF/PJ** dentro do cartão do proponente. Tipo é derivado de `pessoa_tipo` e serviço habilitado.
2. Cliente registra autorização operacional ligada ao proponente usando o aceite de proposta válido ou evidência documental legada. RPC valida role, proposta, aceite/escopo, proponente e tipo.
3. Cliente chama `consulta-executar` com `proposta_id`, `proponente_id`, `tipo`, IDs de autorização e chave idempotente. Sem documento no body.
4. Edge relê e valida o proponente sob service role, obtém `cpf_cnpj`, verifica checksum e chama a API. A RPC de início valida a mesma relação e aplica o preço/cota atual antes da chamada. Admin mantém cota individual de 20/dia e não debita carteira; parceiro mantém regras financeiras existentes.
5. Resposta é normalizada para allowlist; `consulta_concluir` persiste resposta/resumo sanitizados. Em falha ou resultado incerto, manter status/estorno/reconciliação atual e vincular o log ao proponente.
6. Aba **Proponentes** mostra por pessoa: estado sem consulta, em andamento, concluída, falha ou reconciliação; resumo cadastral autorizado mais recente e ação para abrir detalhe. Histórico completo continua na aba **Consultas**, agora com nome/tipo do proponente associado quando houver.
7. Admin e partner usam o mesmo contrato compartilhado. Partner/team só veem consultas das propostas já permitidas pelas policies existentes. Não expor score no lado cliente sem escopo de acesso existente aprovado.

## Arquivos esperados

- `prompts/2026-10-28-serasa-resultados-por-proponente.md` (este plano).
- Migration aditiva em `supabase/migrations/`: colunas, integridade, índice, RPCs compatíveis, view/grants e constraints necessárias.
- `supabase/functions/_shared/serasa-reports.ts` e `serasa-reports.test.mjs`: normalização defensiva versão 2, depois da fixture contratual sanitizada.
- `supabase/functions/consulta-executar/index.ts`: receber e validar ID, resolver documento exclusivamente pelo proponente, persistir resumo seguro e mapear erros sem revelar PII.
- `app/src/components/PropostaConsultas.tsx`: selecionar/receber proponente, autorização alvo, idempotência, histórico e detalhe normalizado.
- `app/src/pages/admin/PropostaDetalhe.tsx` e `app/src/pages/partner/PropostaDetalhe.tsx`: resultado/estado associado a cada card; navegação para detalhe/histórico.
- `docs/operacao/serasa-admin-cota-diaria.md`, `docs/operacao/2026-10-21-auditoria-serasa-merx.md` e, se o contrato justificar, `docs/blueprint/04-database-schema.md`/`08-security-compliance.md`.

Sem alterações previstas em Vercel, secrets, frontend público, mobile, Electron, score MERX, cadastro de aceite, preço/cota, outras integrações ou collections do banco.

## Critérios de aceite

1. Consulta PF/PJ usa exatamente o proponente selecionado e documento é resolvido apenas server-side. ID de outra proposta, proponente ausente, tipo divergente, documento inválido, acesso negado ou autorização incompatível bloqueiam antes de chamar Serasa e não criam cobrança/log de sucesso.
2. Log e autorização novos guardam `proposta_id`, `proponente_id`, tipo, autor, fonte, produto/versão, status e timestamps. Chave idempotente de um proponente não pode ser reutilizada para outro.
3. Consulta concluída aparece no histórico da proposta e no cartão do proponente correto, tanto Admin quanto partner com acesso existente. Outros proponentes mostram estado próprio; nada é copiado/mesclado entre pessoas.
4. Resumo diferencia score numérico inclusive zero, score ausente/não incluído, categorias disponíveis com zero explícito, categorias não retornadas/não reconhecidas, falha e reconciliação. Exibir campos adicionais apenas quando o contrato e a fixture confirmarem schema e semântica.
5. Persistência/clientes retornam apenas campos sanitizados; payload bruto, CPF/CNPJ, endereço, credor e identificadores privados não são expostos na view/API. Mantêm-se RLS, segurança invoker, grants e separação de roles/carteiras.
6. Aceite do cliente principal continua com a semântica e escopo versionados; consulta individual fica rastreável por proponente sem declarar aceite individual. Documentos legados continuam funcionais.
7. Cota de 20/dia/Admin, custo interno sem ledger e débito/estorno de parceiro permanecem inalterados; os três logs históricos não são reescritos nem retroativamente vinculados.

## Considerações de segurança e rollout

- Nenhum CPF/CNPJ, resposta bruta, token ou secret em logs de aplicação, fixture committed, analytics, URL ou browser. Erros devolvidos não contêm documento nem mensagem bruta do bureau.
- Alterações de banco e Edge são um pacote compatível; aplicar migration antes da Edge. Frontend pode continuar usando o contrato anterior durante rollout apenas se a Edge aceitar comportamento legado restrito ao proponente principal; caso contrário, publicar frontend e Edge na ordem definida no go/no-go e bloquear caminho antigo com mensagem segura.
- Migração remota, publicação da Edge, deploy Vercel e nova consulta em produção são gates separados. A migration remota `20261028000003_serasa_resultados_por_proponente.sql` foi autorizada explicitamente e aplicada em 28/10/2026; Edge, Vercel e consultas reais permanecem pendentes.
- Preservar os resumos históricos. Em rollback, desabilitar novas consultas por proponente via configuração/forward-fix; não apagar resultados, autorizações ou logs. Colunas aditivas ficam até revisão posterior, sem migração destrutiva.
- Nunca usar um segundo relatório de produção como teste de interface ou parser. Para testar o formato, obter fixture sanitizada via Serasa/ambiente UAT autorizado ou contrato; se faltar, implementar somente os campos comprovados e deixar as demais seções em “não normalizadas”.

## Testes planejados para a implementação aprovada

- SQL transacional com fixtures sintéticas: usuário/role, acesso a proposta, aceite, proponente da mesma proposta e de outra, PF/PJ, autorização legacy/nova, idempotência por titular, constraints, RLS/view/grants, cota Admin, parceiro/debito e rollback do teste.
- Testes do normalizador para retorno real anonimizado, `facts`, `negativeSummary`, `checkFilingsHistorical`, score calculado/ausente/zero, campos proibidos, listas vazias, tipos inesperados e resposta parcial. Campos sem fixture/schema confirmados permanecem explicitamente indisponíveis.
- Testes de Edge com `fetch` simulado: seleção de documento pelo proponente, nunca confiar no body para documento, rejeitar mismatch e garantir que as validações precedem chamada ao fornecedor.
- Frontend: fluxo feliz por proponente, múltiplos proponentes sem mistura, sem consulta, em processamento, falha, reconciliação, resumo parcial e acesso partner/admin; checar teclado/ARIA e responsividade dos cards.
- Verificações exigidas pelo projeto antes de publicar: lint, typecheck, build, testes focados, smoke SQL/RLS e `git diff --check`. Nenhum teste executa Serasa de produção ou usa dados pessoais reais.

## Impacto por superfície

| Superfície | Impacto |
|---|---|
| Web (`app/`) | Admin/partner: ação, resultado por proponente e histórico associado. |
| Mobile | Não afetado; confirmar não há consumidor móvel da Edge/view antes da implementação. |
| Banco/migrations/RLS | Extensão aditiva de logs/autorização e contrato RPC/view; revisar acesso por role. |
| Edge Functions | `consulta-executar` passa a selecionar proponente com validação server-side. |
| Electron/updater | Não afetado. |
| Segurança/compliance/operação | Minimização do resumo, rastreabilidade de titular, aceite proposta-scoped preservado; nenhum novo uso fora do escopo Serasa aprovado. |
| Documentação/deploy | Atualizar runbook; deploys ficam fora desta aprovação. |

## Evidência adicional e limites do normalizador

A documentação OpenAPI oficial confirma as estruturas das seções que apareceram no histórico. `negativeSummary` contém `hasNegative`, mensagem e lista resumida por tipo/data/contagem/saldo; `facts` agrega consultas, resumo de consultas, documentos roubados, anotações e dados correlatos; `partner` descreve participações societárias; `checkFilingsHistorical` pode conter dados bancários e identificadores detalhados de cheques; `Score` e `Scores.scoreResponse` têm estruturas distintas (objeto versus array). A implementação deve aceitar apenas caminhos documentados e campos necessários, tratando objeto/array conforme schema e sem copiar os campos identificáveis/sensíveis dos detalhes de cheque e parceria.

Uma fixture sanitizada ainda seria necessária para confirmar a forma exata enviada pelo ambiente da conta e validar o adaptador ponta a ponta, mas já não bloqueia o desenvolvimento defensivo orientado pelo OpenAPI. Não executar nova consulta em produção para obter fixture; validar com testes sintéticos derivados do schema e, se disponível posteriormente, UAT autorizado.

## Aprovação

Plano aprovado pelo dono do produto. A aprovação autoriza somente a implementação local dentro do escopo; não autoriza aplicar migration remota, publicar Edge/Vercel, ativar configurações ou executar consulta Serasa de produção.

## Implementação local e validação — 28/10/2026

Implementação realizada nos arquivos previstos: migration aditiva `20261028000003_serasa_resultados_por_proponente.sql`, Edge `consulta-executar`, normalizador compartilhado e testes, componente `PropostaConsultas`, telas de detalhe Admin/Partner e mocks dos testes de tela. A UI permite selecionar explicitamente o proponente compatível PF/PJ, associa autorização/log ao `proponente_id`, resolve documento no servidor e mostra o histórico e resumo no cartão correto. Nenhum log histórico recebeu titular retroativo.

Validações executadas:

- `node --test supabase/functions/_shared/serasa-reports.test.mjs`: 6 testes passaram.
- `npm run lint` em `app/`: terminou sem erros; 33 avisos preexistentes.
- `npm run typecheck` em `app/`: passou.
- `npm run build` em `app/`: passou; Vite emitiu aviso de bundles acima de 500 KB.
- `npm test` em `app/`: 45 arquivos e 175 testes passaram.
- `git diff --check`: passou.

Limites de validação: `supabase db lint --local --schema public --fail-on error` reportou erros existentes em `consulta_iniciar` (referência ambígua `preco_centavos`) e `admin_campanha_disparar` (`usuarios.partner_id` ausente). O banco local não contém `public.consulta_autorizacoes`, então não foi possível validar a migration nesse schema; a tentativa transacional falhou nessa dependência e foi revertida. Não foi executado `db reset`. Sem validação SQL/RLS local, navegador autenticado ou integração end-to-end. A migration remota foi aplicada pelo CLI; não houve deploy da Edge/Vercel nem consulta Serasa de produção.

## Aplicação da migration remota — 28/10/2026

Após orientação explícita para aplicar as migrations pendentes, `supabase db push --linked --dry-run` mostrou somente `20261028000003_serasa_resultados_por_proponente.sql`. A primeira aplicação encontrou erros de sintaxe em expressões `CASE` de condições PL/pgSQL; não registrou a migration como aplicada. As expressões foram parentizadas e os índices/constraints aditivos foram tornados seguros para repetição. O dry-run seguinte ainda mostrou somente essa migration, que então foi aplicada com `supabase db push --linked --yes`. A verificação posterior com `supabase migration list --linked` mostrou `20261028000003` em ambas as colunas Local e Remote. Nenhuma Edge Function, frontend ou Vercel foi publicada; nenhuma consulta Serasa foi executada.

O workspace contém outras alterações locais não relacionadas; elas não fazem parte deste escopo e foram preservadas.
