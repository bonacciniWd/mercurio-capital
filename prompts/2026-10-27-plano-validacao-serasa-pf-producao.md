# Plano — validação controlada do Serasa PF em produção

Data: 27/10/2026. Estado: UI e backend publicados; ativação manual do PF e consulta real ainda pendentes.

## Objetivo

Executar uma única consulta do Relatório Avançado PF para a proposta `MERC-2026-000184`, usando o fluxo autenticado existente e o CPF armazenado no cadastro da proposta. Validar o retorno REFIN conforme a documentação PF, sem expor CPF, payload bruto ou credenciais.

## Documentação lida

- `AGENTS.md` fornecido na conversa.
- `prompts/2026-10-26-plano-retomada-serasa-producao.md`.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md`.
- Documentação oficial: [Relatório Avançado PF](https://developer.serasaexperian.com.br/api/relatorio-avancado-pf), em especial “Tabela de Naturezas das Anotações REFIN”.
- Migration, função Edge e adaptador de normalização listados abaixo.

## Código e estado remoto inspecionados

- `supabase/functions/consulta-executar/index.ts` e `supabase/functions/_shared/serasa-reports.ts`.
- `app/src/components/PropostaConsultas.tsx`.
- `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql`.
- `supabase/migrations/20261026000002_serasa_relatorio_avancado_pf.sql`.
- `supabase/functions/_shared/serasa-reports.test.mjs`.
- Secrets Supabase listados sem ler seus valores: API URL, flag de produção, CNPJ consultante e credenciais estão presentes. Fingerprints correspondem ao host de produção e ao valor verdadeiro aceito pela função.
- A migration `20261026000002` e a migration aditiva `20261027000001` foram aplicadas no Supabase remoto.
- A função `consulta-executar` foi publicada na versão remota 46 e usa `RELATORIO_AVANCADO_PF`.
- A UI administrativa para ativar/desativar PF foi publicada em `app/src/pages/admin/Integracoes.tsx`, pois não existia uma tela que chamasse a RPC. A promoção foi manual pela CLI, sem acionar integração/autorização; o usuário fará a ativação na própria conta admin. Não houve sessão autenticada disponível para verificar autorização/preço/saldo da proposta.
- Nenhuma consulta de relatório em produção foi feita e nenhum débito ocorreu.
- O normalizador preserva apenas contagem e saldo de REFIN; não registra as ocorrências e naturezas individuais documentadas.

## Decisões e suposições

- O código `028` foi indicado pelo usuário para PJ; esta consulta é PF e não envia `segmentCode`.
- Não criar tabelas novas. O resultado sanitizado continua em `logs_consultas.resumo` sob o controle de RLS existente.
- CPF é lido exclusivamente no servidor a partir da proposta; não será copiado para terminal, logs, fixtures, plano ou resposta.
- Capturar para REFIN somente campos necessários à análise: código/descrição da natureza, data da ocorrência e agregados de quantidade/saldo. Não persistir resposta bruta, identificadores de contrato ou credores nesta alteração.
- A consulta só será tentada se a autorização da proposta estiver registrada, válida, não revogada, vinculada a documento aprovado e ao titular PF, e se o fluxo autenticado aceitar a operação. O fluxo existente pode debitar a carteira do parceiro pelo preço configurado.
- A ativação de produção será restrita ao relatório PF. A configuração PJ continuará sem parâmetros de segmento e, portanto, sem liberação de consultas PJ.

## Escopo proposto

1. Aplicar a migration local pendente `20261026000002` para selecionar `RELATORIO_AVANCADO_PF` nas configurações existentes.
2. Criar migration aditiva e reversível por configuração para remover o bloqueio permanente da RPC de ativação, mantendo produção inativa por padrão e exigindo administrador autenticado.
3. Ajustar normalizador, testes existentes e apresentação da aba Consultas para exibir dados REFIN sanitizados com `legalNatureId` e `legalNature`, sem expor o payload Serasa bruto. Concluído localmente.
4. Executar lint, typecheck, build e testes focados; revisar o diff e garantir que alterações locais preexistentes não sejam incluídas. Verificações automatizadas concluídas; não foi possível fazer revisão visual no browser.
5. Publicar o frontend administrativo na Vercel. Concluído no deployment `dpl_7zkaRdBWCcUBgvLRGaTQ9RCus3EB`; o usuário fará a ativação manual em sessão admin. Consulta autenticada permanece pendente.
6. Registrar resultado técnico, status e agregados sem CPF, credenciais, IDs de contrato ou valores de identificação pessoal. Pendente da consulta.

## Arquivos esperados

- Nova migration aditiva em `supabase/migrations/` para a RPC de configuração.
- `supabase/functions/_shared/serasa-reports.ts` e seu teste focado.
- `app/src/components/PropostaConsultas.tsx`.
- `app/src/pages/admin/Integracoes.tsx`.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md`.
- Migration já existente `20261026000002_serasa_relatorio_avancado_pf.sql` será aplicada; não será recriada.

## Critérios de aceite

- A função remota seleciona `RELATORIO_AVANCADO_PF` e envia o CPF somente em `X-Document-Id` ao endpoint PF de produção.
- A chamada só ocorre após autorização de consulta validada pela RPC existente, para a proposta indicada.
- Produção permanece desativada por padrão; somente PF é habilitado nesta validação, PJ continua bloqueado.
- A resposta persistida é normalizada, inclui os campos REFIN permitidos e não contém payload bruto.
- Resultado ausente, zero e falha de provedor permanecem estados distintos.
- O relatório informa status concluído/estornado/reconciliação pendente e preço debitado, sem divulgar CPF.

## Segurança e reversão

- Segredos permanecem somente no Supabase; não imprimir ou baixar valores.
- Preservar autenticação, autorização documental, vínculo proposta/titular, idempotência, wallet, RLS e trilha de auditoria existentes.
- Se a Serasa rejeitar produto/segmento ou houver falha, interromper novas chamadas; desativar o relatório PF pela configuração admin e registrar a evidência técnica sem PII. Corrigir configuração/código e repetir apenas após revisão.
- Não executar consulta fora do fluxo autenticado, nem contornar saldo ou autorização.

## Verificações

- Automatizadas antes da publicação: lint, typecheck, build, teste focado do normalizador e `git diff --check`.
- Resultado: lint sem erros (33 avisos existentes), typecheck e build concluídos; teste do normalizador 5/5; `git diff --check` passou. Build ainda emite aviso de chunk grande.
- Remotas: migrations `20261026000002` e `20261027000001` confirmadas; Edge `consulta-executar` versão 46 ativa.
- Smoke pós-publicação: domínio principal `https://www.mercuriocapitalsa.com.br/` retornou HTTP 200 e serve os assets do deployment novo; chunk lazy `Integracoes-D3MIuwPt.js` contém o controle PF e a chamada ao RPC. Não houve teste de navegador autenticado.
- Manuais pendentes: usuário ativa PF na UI admin; verificar a autorização da proposta indicada; executar a proposta uma vez; conferir status, preço, apresentação sanitizada de REFIN e RLS.

## Aprovação

Implementação, migrations, Edge Function e publicação Vercel da tela admin foram autorizadas e concluídas. A ativação PF será feita manualmente pelo usuário. A consulta de produção continua pendente e só deve ocorrer após confirmação de que a autorização existente atende aos controles do fluxo.

## Publicação frontend em 27/10/2026

- Snapshot isolado a partir do `HEAD` mais apenas `Integracoes.tsx` e `PropostaConsultas.tsx` modificados; mudanças locais alheias ficaram fora do upload.
- Deployment `dpl_7zkaRdBWCcUBgvLRGaTQ9RCus3EB`, READY, promovido ao domínio. Rollback anterior: `dpl_Cue9XaogUoxSBboLpQogdbFGxLAE`.
- Smoke HTTP do domínio principal: 200. Os bundles servidos incluem o novo controle admin PF e a exibição REFIN permitida. Acessos autenticados não foram testados.
- A flag PF não foi ativada pela publicação. Nenhuma consulta Serasa nem débito foi realizado; o usuário fará a ativação manual.
