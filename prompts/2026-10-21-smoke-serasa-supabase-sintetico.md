# Plano — smoke integrado Serasa em Supabase descartável

Data: 21/10/2026
Status: executado parcialmente em ambiente descartável; consulta integrada terminou em reconciliação pendente, sem repetir a chamada.

## Objetivo

Preparar e executar um smoke integrado do relatório Serasa PF Top Score através da Edge Function `consulta-executar`, usando exclusivamente o CPF sintético de homologação documentado na collection (`00000001244`) e registros de teste em um projeto Supabase local separado. Validar autorização documental, titularidade do documento, saldo/débito, idempotência, normalização e proteção do payload bruto.

## Documentação consultada

- `docs/operacao/change-management.md` — plano/aprovação, menor diff e gate separado de publicação.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md` — decisões Serasa/MERX, produtos UAT confirmados e limites atuais.
- `docs/blueprint/04-database-schema.md` — entidades de identidade, proposta e carteira.
- `docs/blueprint/08-security-compliance.md` — RLS, Edge Functions e segredos server-side.
- Migration `20261021000001_serasa_relatorios_autorizacoes.sql` e smoke `fase-46-serasa-integration.sql`.
- Migrations-base de identidade, originação, wallet e consultas; código de `consulta-executar` e `_shared/serasa-reports.ts`.

## Código e ambiente inspecionados

- `supabase/functions/consulta-executar/index.ts`: exige JWT, proposta, chave de idempotência e autorização; deriva CPF/CNPJ da proposta; registra débito/log via RPC e conclui/estorna via service role.
- `supabase/functions/_shared/serasa-reports.ts`: host allowlist, IAM, endpoint PF/PJ, normalização.
- `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql`: tabelas, RLS, RPCs, ACLs e bloqueio de produção.
- `supabase/smoke-tests/fase-46-serasa-integration.sql`: validação estrutural já executada em clone PostgreSQL descartável.
- Supabase local compartilhado está apenas até migration `20260918000008`; runtime Edge local não estava ativo. Não o resetar nem aplicar migrations nele.
- A consulta UAT direta PF Top Score respondeu IAM 201 e relatório 200; o normalizador reconheceu envelope `reports[0]`, cadastro, score e dados negativos.

## Decisões e premissas

- Não criar novas tabelas ou alterar o modelo aprovado.
- Executar apenas em uma segunda instância Supabase local descartável, com project-id e portas próprios. Não apontar para o Supabase remoto ou para o banco local compartilhado.
- Provisionar no ambiente descartável um usuário interno mínimo e parceiro sintético, carteira com saldo de teste, cliente PF de homologação, proposta, documento de autorização sintético aprovado/validado e registro de autorização.
- Usar produto `RELATORIO_AVANCADO_TOP_SCORE_PF`, ambiente `uat` e credenciais de homologação em variáveis server-side do processo Edge; não colocar secrets em fixtures, logs, argumentos persistidos ou frontend.
- Dados sintéticos só existem no projeto descartável e serão eliminados ao encerrar o ambiente. Nenhum valor de relatório, documento de titular ou token será impresso no smoke.
- O teste de idempotência repetirá exatamente a mesma chave e verificará um único débito/log. Uma chave reutilizada com escopo diferente deve ser rejeitada.
- A fase aprovada cobre caminho feliz, controles negativos e repetição idempotente. Não simular falha do provedor por meio de alteração do código, nem testar produção/PJ/score adicional nesta etapa.
- Se um smoke revelar defeito no produto, parar, registrar a evidência e preparar um plano de correção específico antes de editar a implementação.

## Modelo de dados de teste

Somente linhas temporárias em tabelas existentes, em banco descartável:

- `auth.users` + `usuarios`: conta sintética com papel/permissão operacional de teste.
- `partners` + trigger de `partner_wallets`: parceiro sintético, carteira de teste com saldo suficiente.
- `clientes`: titular PF associado somente à proposta sintética.
- `propostas`: proposta Home Equity mínima pertencente ao parceiro de teste.
- `proposta_documentos`: documento fictício com `status='aprovado'`, `validado=true` e `storage_path` sintético não público.
- `consulta_autorizacoes`: autorização de análise vinculada à proposta, tipo e documento fictícios.
- `logs_consultas` + `wallet_ledger`: criados somente pelo fluxo testado, para verificar resultado e débito único.

Todas as chaves estrangeiras, RLS e RPCs devem continuar ativas; não usar bypass de privilégios para o passo que pretende validar autorização/idempotência.

## Arquivos esperados após aprovação

- `prompts/2026-10-21-smoke-serasa-supabase-sintetico.md` — este plano aprovado.
- `supabase/smoke-tests/fase-47-serasa-uat-integrado.sql` — assertions de fixture, autorização, saldo/ledger, logs, RLS e limpeza/verificação final; sem secrets.
- `scripts/smoke-serasa-uat-disposable.mjs` — inicialização/checagem do ambiente isolado e invocação autenticada da Edge Function, sem imprimir tokens ou PII.
- Ajuste ao índice da documentação operacional para apontar o smoke, se os artefatos forem aprovados e concluídos.

## Critérios de aceite

1. O smoke falha fechado se o endpoint/ambiente não for exatamente UAT, se o projeto Supabase não for o descartável esperado ou se as credenciais estiverem ausentes.
2. Sem autorização/documento aprovado ou com titular divergente, a consulta é negada antes do débito.
3. Uma consulta PF autorizada retorna HTTP 200 e resumo normalizado com `source`, `product`, `score.calculation`, indicador de cadastro e sumário de dados negativos; não retorna documento nem resposta bruta.
4. A carteira registra exatamente um débito e o log fica `concluida`; a repetição da mesma chave não gera nova consulta ou débito.
5. `authenticated` não pode ler colunas `request`/`response`; `anon` não pode executar RPCs de consulta/autorização.
6. Ao final, o projeto descartável pode ser parado/removido sem alterar serviços ou dados existentes.
7. Resultado e limitações são registrados na auditoria Serasa/MERX; nenhum deploy/migration remoto ou alteração de secret remoto ocorre.

## Segurança e limites

- Nunca imprimir CPF, relatório bruto, token, service-role key ou client secret.
- Não usar dados reais de clientes, propostas ou documentos da empresa.
- Não executar em produção; não ativar configuração de produção.
- Não debitar carteira real nem enviar qualquer mensagem.
- O smoke integrado não prova qualidade decisória da MERX, autorização comercial de produção, comportamento operacional completo de reconciliação, nem substitui revisão de release.
- Publicação Vercel/Supabase continua bloqueada até a validação coordenada e um GO específico.

## Testes e passos de execução

1. Confirmar ambiente local atual e assegurar portas/projeto distintos; preservar a instância compartilhada.
2. Subir stack Supabase descartável, aplicar as migrations do repositório e confirmar que `fase-46-serasa-integration.sql` passa nela.
3. Provisionar fixtures com IDs determinísticos e prefixo `smoke-serasa-uat-`; manter a chave de teste fora do repositório.
4. Servir `consulta-executar` contra apenas a stack descartável, configurando as credenciais UAT no runtime Edge.
5. Rodar cenários autorizado, sem autorização, titular/documento incompatível, primeira consulta, repetição idempotente, reuso de chave com escopo diferente e leitura de colunas restritas.
6. Verificar carteira/logs antes e depois; garantir exatamente um débito e limpar a instância descartável.
7. Executar `git diff --check`, testes do helper e as verificações necessárias aos artefatos adicionados.

## Rollback

Descartar a segunda instância Supabase e os arquivos temporários gerados fora do repositório. Como as fixtures vivem exclusivamente na instância descartável, não requerem compensação em carteira ou limpeza no banco compartilhado. Não aplicar qualquer migration remota.

## Resultado da execução — 21/10/2026

- Stack descartável `mercurio-serasa-smoke-20261021`, com portas próprias, recebeu as migrations até `20261021000001_serasa_relatorios_autorizacoes.sql`; o smoke estrutural fase 46 passou.
- O harness criou usuário/parceiro/carteira, propostas e documentos sintéticos. A fixture incluiu 2FA sintético e JWT AAL2 assinado somente com o segredo local descartável, para respeitar a regra existente de carteira.
- As validações negativas de autorização ausente e titularidade incompatível passaram; o fluxo chegou à RPC de início. Um diagnóstico transacional da RPC passou e foi revertido.
- A chamada integrada à Edge Function terminou em HTTP 202 `reconciliacao_pendente`. Como o provedor pode ter recebido/processado a consulta, a chamada não foi repetida; o caminho feliz, idempotência após sucesso e assertions fase 47 permanecem inconclusivos.
- A limpeza foi executada no banco descartável; as contagens verificadas de usuários sintéticos, logs e autorizações ficaram em zero. A carteira/log associados também foram removidos junto com a fixture.
- A configuração do Supabase local compartilhado, qualquer banco remoto, secrets, Vercel e código de produto não foram alterados por este teste.
- Próximo passo operacional: conferir no canal autorizado da Serasa se a solicitação UAT foi processada antes de qualquer nova tentativa. Se a resposta for confirmada como não processada, repetir com nova fixture/chave; se persistir, planejar investigação específica do caminho Edge e reconciliação.
