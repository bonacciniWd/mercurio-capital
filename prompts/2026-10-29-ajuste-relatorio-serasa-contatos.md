# Plano — ajuste do relatório Serasa PF e persistência idempotente

Data: 29/10/2026. Estado: aprovado; ajuste de apresentação implementado parcialmente; estrutura da última resposta PF verificada via CLI em leitura, sem expor valores pessoais.

## Objetivo

Exibir melhor os dados cadastrais retornados pelo Serasa PF, incluindo tabelas de endereços, telefones e e-mails, e preservar os resultados de consulta em `logs_consultas` sem duplicar nem sobrescrever relatórios já armazenados.

## Skills/documentos lidos

- `skills/UX_skills.md`: revisão de acessibilidade, layout, texto, tipografia e polimento; estilo e tokens existentes; estados e teclado.
- `docs/README.md`, `docs/operacao/serasa-pf-relatorio-referencia.md`, `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md`.
- `prompts/2026-10-29-serasa-pf-padrao-relatorio-referencia.md` e `prompts/2026-10-28-serasa-resultados-por-proponente.md`.
- Migração `20261029000001_serasa_pf_relatorio_detalhado.sql`, normalizador `supabase/functions/_shared/serasa-reports.ts`, tela `app/src/components/SerasaPFReport.tsx` e integração `app/src/components/PropostaConsultas.tsx`.
- Instruções `AGENTS.md` fornecidas na conversa.

## Código inspecionado

- O normalizador PF v3 permite campos de `registration.address`, `addresses`, `phone`, `phones` e `emails`, mas ainda precisa ser comparado com o formato exato do relatório recém-retornado.
- `logs_consultas.response` guarda a projeção privada normalizada; a listagem `v_consultas_proposta` contém apenas resumo. A RPC `consulta_relatorio_obter` autoriza a leitura completa conforme vínculo da proposta e proponente.
- O componente do relatório já possui tabelas para endereços e telefones e lista e-mails em texto; verificar adequação visual e caminhos/campos para dados reais.

## Modelo de dados e regras

- Reutilizar `logs_consultas` e `proponente_id`; não criar tabela nem registro de consulta paralelo.
- Persistir somente o relatório normalizado allowlisted em `logs_consultas.response`; manter `resumo` compacto e sem contatos/endereço.
- Não colocar relatório detalhado nem PII em `v_consultas_proposta`. A view continua para metadados/resumo; os detalhes continuam via `consulta_relatorio_obter`.
- Uma resposta detalhada já presente não é duplicada nem sobrescrita por backfill/reprocessamento. Registros históricos incompletos permanecem intactos; sem nova consulta ao Serasa para preenchê-los.
- Endereços, telefones e e-mails retornados pelo bureau são exibidos como dados históricos do relatório, separados dos dados declarados na proposta; não atualizam cadastro operacional.
- Incluir apenas campos de contato/endereço documentados e necessários; nunca guardar payload bruto, números de documento, credenciais ou identificadores sensíveis não aprovados.

## Decisões e suposições

- A tela alvo é o detalhe do relatório PF já aberto pelo histórico em Admin/Partner, sem criar nova rota.
- “Ignorar se já estiver” significa manter o relatório atual quando já existe resposta normalizada válida e evitar inserir outro log.
- Os dados recém-retornados podem conter aliases/caminhos diferentes dos exemplos documentados. A implementação final dos mapeamentos depende de uma fixture anonimizada/sanitizada da resposta que trouxe os campos adicionais; não inferir caminho a partir de nomes de seções.
- Não executar consulta paga, backfill de produção, migration remota, deploy ou alteração de configuração nesta etapa.

## Arquivos esperados

- `supabase/functions/_shared/serasa-reports.ts` e testes do normalizador, somente se a fixture/schema confirmar novos campos documentados.
- `app/src/components/SerasaPFReport.tsx` e `SerasaPFReport.css` para apresentar endereços, telefones e e-mails com estados ausentes/parciais.
- Migration aditiva apenas se uma mudança de persistência for indispensável; preferência por preservar o schema atual e reforçar a regra na função de finalização existente.
- Documentação operacional do relatório, se campos/estados mudarem.

## Critérios de aceite

- Endereços, telefones e e-mails exibidos em tabelas responsivas, com cabeçalhos claros e separação entre retorno Serasa e cadastro declarado.
- Ausente, não retornado e lista vazia não são confundidos; dados não exibidos continuam acessíveis sem truncamento indevido.
- Reprocessar uma consulta já detalhada não duplica nem substitui dados existentes.
- `v_consultas_proposta` não passa a expor PII ou `response`; a RPC e os limites de Admin/Partner/Equipe permanecem inalterados.
- Navegação por teclado, foco visível, layout estreito e tabelas roláveis revisados.

## Segurança

- Preservar RLS, `security_invoker`/ACLs e a RPC protegida existente.
- Não ler nem exportar dados reais de produção para desenvolver a tela. Usar fixture sanitizada.
- Não registrar contatos, endereço, documentos ou resposta bruta em logs de aplicação.

## Verificações previstas

- Testes do normalizador com fixture sanitizada: aliases conhecidos, listas vazias, ausentes e campos inesperados.
- Lint, typecheck e build do frontend; verificações Edge/SQL aplicáveis.
- Testes manuais em preview com fixture sanitizada: desktop, viewport estreito, foco/teclado, vazio, parcial e relatório preenchido.
- Nenhum teste deve acionar o provedor Serasa ou realizar escrita em produção.

## Aprovação necessária

Plano original aprovado pelo dono do produto. O dono autorizou uma nova consulta paga temporária, escolhendo como alvo a consulta PF mais recente, e aprovou em 29/10/2026 a publicação temporária da Edge Function para diagnóstico estrutural sanitizado. Como o payload bruto é descartado pelo fluxo atual e não há fixture sanitizada, a captura será executada sem banco/CLI e sem logs.

## Execução parcial

- `SerasaPFReport.tsx` agora mostra e-mails em tabela dedicada e elimina linhas duplicadas quando o mesmo contato aparece no campo singular e na lista; `SerasaPFReport.css` adiciona espaçamento ao subtítulo da tabela.
- Teste focado criado em `app/src/test/SerasaPFReport.test.tsx` cobrindo endereços, telefones, e-mails e deduplicação com fixture sintética.
- Nenhuma mudança de banco/Edge: `consulta_concluir` aceita somente logs `em_andamento`; a resposta normalizada já fica em `logs_consultas.response`, e a RPC protegida atende o detalhe. A view continua compacta e sem PII.
- Typecheck aprovado; build aprovado (aviso existente de chunks acima de 500 kB); ESLint dos arquivos alterados aprovado; teste focado aprovado (1/1).
- Suíte completa: 164/175 passaram; 11 falharam em oito arquivos: dez timeouts sob concorrência e uma expectativa de botão ausente em `adminRede.test.tsx`. Nenhuma falha veio do novo teste do relatório.
- Consulta de estrutura read-only via Supabase CLI ao último `serasa_pf` concluído em produção confirmou `registration.addresses` (7 itens) e `registration.phones` (5 itens); `registration.emails` não existe nesse relatório normalizado. A saída incluiu somente paths, tipos e contagens, nunca valores.
- A view `v_consultas_proposta` permanece intencionalmente resumida. O detalhe está em `logs_consultas.response`, entregue pela RPC `consulta_relatorio_obter`. Nenhuma consulta, escrita, migration ou alteração remota foi feita.
- Sem o payload bruto do provedor, não é possível distinguir se os e-mails não vieram nessa resposta ou se o normalizador deixou de mapear outro caminho; não ampliar allowlist por suposição. Para esse ponto, usar retorno sanitizado da próxima consulta autorizada ou schema/fixture oficial.

## Extensão proposta — diagnóstico de estrutura de uma resposta PF

- Adicionar um opt-in temporário, restrito a consulta Serasa PF iniciada em sessão autenticada com autorização já exigida pelo fluxo e pela cota diária. Nenhum caminho alternativo via service role/CLI.
- Após normalização e persistência usuais, retornar ao chamador somente um mapa de estrutura: caminhos estáticos, tipos JSON e comprimentos de arrays. O diagnóstico não deve incluir valores escalares, nomes/documentos/e-mails/telefones/endereço, nem chaves dinâmicas; limitar profundidade, quantidade de nós e tamanho total.
- Não persistir esse mapa nem o payload bruto em banco, logs de Edge, Sentry ou telemetria. A resposta não deve ser registrada no console pelo frontend. Guardar localmente apenas o diagnóstico estrutural sanitizado como fixture e desligar/remover o opt-in em seguida.
- O resultado completo continua sendo normalizado pela allowlist existente e guardado privadamente em `logs_consultas.response`; a view e RPCs não mudam. A captura não altera autorização, custo, cota, idempotência ou fluxo de cobrança.
- Depois de confirmar o esquema, revisar os paths de contato contra o manual/OpenAPI; adicionar allowlist e teste apenas para campos documentados. Consultar produção uma única vez, usando o fluxo autenticado do app, e validar o resultado no relatório do proponente.
- Arquivos esperados: Edge `supabase/functions/consulta-executar/index.ts`, utilitário/teste de projeção estrutural, fixture sintética sanitizada e este plano. Sem migration.
- Critérios: teste prova que valores e chaves dinâmicas não aparecem; captura desativada por padrão; sem persistência/log de diagnóstico; uma consulta autorizada segue a cota existente; remover/deixar desligada a captura após obtenção da estrutura.
- Aprovado implementar/publicar o opt-in de diagnóstico Edge. Executar uma única consulta PF autenticada pela interface; desligar o segredo de captura e remover o código temporário após receber o diagnóstico. Não promover mudanças web a produção.

### Execução da captura temporária — 29/10/2026

- Publicado somente `consulta-executar` no projeto Supabase `bhagksfvszeogtjvjtpx`; versão remota 50, `verify_jwt=true`. Nenhuma migration ou publicação Vercel nesta etapa.
- Diagnóstico segue desligado por padrão no código e foi habilitado temporariamente pelo secret `SERASA_SCHEMA_CAPTURE_ENABLED=true`. Só é retornado em consulta PF autenticada quando `app_is_admin_full()` confirma Admin full; a Edge envia paths/tipos/tamanhos apenas na resposta HTTP, sem persistir nem registrar.
- CLI read-only confirmou alvo `MERC-2026-000227`, aceite PF ativo, e cota usada hoje pelo Admin `3/20` antes da nova consulta. Alvo equivale à consulta PF mais recente no início desta etapa.
- Testes do sanitizador: 2/2 passaram; ESLint direcionado: zero erros; Node parse check passou. `deno` não está instalado, portanto não houve `deno check`. App lint: zero erros (33 avisos existentes); typecheck e build passaram; Vitest completo 46 arquivos / 176 testes passou.
- Rollback preparado em `/tmp/mercurio-serasa-capture-rollback-20261029`: fonte remota original v49 baixada via CLI e helper Serasa atual preservado; SHA-256 de `index.ts` original: `ba40e2eead9a86ee3e1fb80c04c3a2695ac8930c37ebb69c12e1ff4ca74275a1`. Para encerrar, primeiro definir `SERASA_SCHEMA_CAPTURE_ENABLED=false`; em seguida republicar a fonte de rollback com `npx supabase functions deploy consulta-executar --project-ref bhagksfvszeogtjvjtpx --use-api --workdir /tmp/mercurio-serasa-capture-rollback-20261029`.
- A consulta foi executada uma vez pelo fluxo autorizado: novo log `9f309ab5-0c1d-40a2-921a-cf9361edf979`, status concluído, mesmo protocolo/proponente. Ela conta como uma requisição da cota (o total do Admin passa de 3 para 4/20, se nenhuma outra consulta ocorreu em paralelo). O relatório normalizado foi persistido pelo fluxo normal.
- `docs/Sanitized.json` foi lido sem emitir valores: contém sete linhas de metadados/resumo de consultas, sem `diagnostico_estrutura` nem coluna `response`; portanto não é o corpo retornado pela Edge Function.
- Imediatamente após confirmar a consulta, `SERASA_SCHEMA_CAPTURE_ENABLED` foi definido como `false`, a versão original foi republicada, e o secret temporário foi removido. Edge ativa agora na versão 54 com `verify_jwt=true`; fonte local restaurada e SHA-256 confere com o snapshot remoto v49. Smoke sem JWT respondeu 401. Nenhuma migration ou alteração Vercel foi feita.
- Se DevTools ainda mantiver a resposta da requisição, extrair somente `diagnostico_estrutura` de Network → `consulta-executar`. Não repetir a consulta paga se essa resposta não estiver disponível; uma nova tentativa exige autorização específica.

### Evidência posterior recebida — 29/10/2026

- O dono enviou cabeçalhos da resposta concluída e início do diagnóstico (131 nós, `truncated: true`); os paths restantes não vieram na mensagem.
- CLI em leitura na nova consulta confirmou `normalizerVersion=3`, `registration` como objeto, 7 endereços, 5 telefones e 0 e-mails. A função `consulta_relatorio_obter` existe e permite EXECUTE a `authenticated`.
- A pré-visualização mostra erro de carregamento embora cabeçalhos estejam presentes. Ainda falta o status/código da chamada `consulta_relatorio_obter` no Network para atribuir a falha; não repetir consulta nem alterar UI/Edge antes desse dado e dos paths de contatos do diagnóstico.
