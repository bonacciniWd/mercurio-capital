# Plano — Kanban: Standby visível e etapa Pré-aprovado

**Status:** implementação publicada na web. Migration `20261016000002` aplicada em produção e smoke estrutural remoto aprovado. Após incidente de URL Supabase inválida no primeiro deployment, a versão corrigida está ativa no deployment `dpl_6pthSE8R1e2CkaYNuXBxaRxwZBna`; detalhes no plano de hotfix `prompts/2026-10-16-hotfix-supabase-url-producao.md`.

## Objetivo

Corrigir o Kanban para que uma proposta movida a Standby permaneça visível no quadro, ordenar Standby como primeira coluna e incluir a etapa Pré-aprovado entre Análise Crédito e Análise Imóvel. A nova etapa será um status persistido, filtrável e exibido com o mesmo nome nas telas web relevantes.

## Instruções e documentação consultadas

- `AGENTS.md` fornecido pelo usuário: inspeção e plano antes de código, validações, segurança e autorização.
- `docs/README.md`, `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md` e `docs/operacao/runbooks.md`.
- `docs/blueprint/02-roles-permissions.md`, `03-routes-navigation.md`, `04-database-schema.md` e `06-modules-features.md`.
- `prompts/2026-09-18-dashboard-status-configuracoes.md` e `prompts/2026-10-08-deploy-web-vercel.md`.

## Código e banco inspecionados

- `app/src/components/PropostasKanban.tsx`: no modo Operacional, o filtro exclui `standby`; ao selecionar a visão Standby, renderiza uma grade sem drag-and-drop. O Kanban é compartilhado por `/admin/kanban` e `/p/kanban`.
- `app/src/lib/propostaStatus.ts` e `app/src/test/propostaStatus.test.ts`: Standby está no fim da ordem; não existe `pre_aprovado`.
- `app/src/pages/admin/Propostas.tsx`: filtros de status usam a lista do Kanban e o filtro Standby já existe.
- `supabase/migrations/20260513000001_enums.sql`, `20260715000001_add_operational_kanban_statuses.sql`, `20260715000002_operational_kanban_rpcs.sql` e `20260918000003_dashboard_standby_status.sql`: `proposta_status` é enum; Standby já foi adicionado por migration. A validação atual permite alterações internas por admin operacional e mantém parceiros limitados às transições já autorizadas.
- `isPropostaAprovada` existe na web e no mobile; status não reconhecido pode ser tratado como aprovado pela função atual, portanto `pre_aprovado` deve continuar explicitamente não aprovado para preservar o bloqueio de contrato.
- Telas de detalhe, listas, relatórios e consulta pública possuem mapas locais de status; os pontos que exibem ou categorizam a nova etapa serão atualizados para não apresentar o identificador interno.

## Decisões e modelo

- Status persistido: `pre_aprovado`, com rótulo `Pré-aprovado`.
- Ordem do quadro: `standby` primeiro; `pre_aprovado` imediatamente após `analise_credito` e antes de `analise_imovel`.
- A visão Operacional continuará excluindo rascunhos e canceladas, mas incluirá Standby para que mover uma proposta não a remova do quadro. A visão filtrada Standby continuará disponível e as opções de pipeline colocarão Standby primeiro.
- `pre_aprovado` será uma etapa ativa, não um status ganho/concluído. Permanece bloqueada a visualização de contrato para cliente/parceiro até uma aprovação posterior. Nenhuma permissão de transição será ampliada: a etapa segue o escopo administrativo atual para análise de crédito/imóvel.
- O enum exige migration aditiva. Ela acrescenta `pre_aprovado`, solicita reload do schema cache do PostgREST e não atualiza linhas históricas, valores ou métricas.
- Como o app iOS/TestFlight anterior interpreta um status desconhecido como aprovado, a migration inclui um guard server-side: clientes e parceiros não leem metadados de contrato, assinaturas, modelos de contrato nem arquivos do bucket `contratos` enquanto a proposta estiver em `pre_aprovado`. Administradores mantêm o acesso. Leituras do bucket `comprovantes` e demais permissões não mudam.
- O helper do bucket privado usa `SECURITY DEFINER`, `search_path` fixo, compara o status como texto, exige vínculo do solicitante com a proposta e concede execução somente a `authenticated`; o smoke valida a existência do guard e das policies.
- O Kanban continuará sendo compartilhado entre admin e parceiro. Parceiros veem a nova coluna, mas a RPC existente mantém os limites de escrita atuais.
- Atualizar o código mobile que interpreta o status para preservar o bloqueio de contrato e exibir rótulo consistente; não compilar, assinar ou publicar artefatos móveis/desktop nesta entrega.

## Arquivos esperados

- `app/src/components/PropostasKanban.tsx` e `app/src/lib/propostaStatus.ts`.
- Mapas de status em páginas web admin, parceiro, cliente e consulta pública que exibem ou agrupam a nova etapa.
- `app/src/test/propostaStatus.test.ts` e testes focados da lógica de inclusão por modo do Kanban.
- `mobile/lib/propostaStatus.ts` e mapas de status necessários para não classificar `pre_aprovado` como aprovado no app instalado; sem release mobile.
- Migration aditiva em `supabase/migrations/` com políticas de leitura de contrato para a etapa Pré-aprovado e smoke SQL somente leitura que confirma enum, ordem, helper e policies sem mutações de dados.
- Este plano e documentação de status/fluxo.

## Critérios de aceite

1. Arrastar uma proposta do modo Operacional para Standby atualiza o status e ela continua visível na primeira coluna.
2. A visão Standby e o filtro de `/admin/propostas` retornam as mesmas propostas Standby.
3. A coluna `Pré-aprovado` aparece entre Análise Crédito e Análise Imóvel; move a proposta via RPC existente, mantendo histórico e auditoria.
4. A nova etapa aparece com rótulo legível nos detalhes/listas cobertos pelo escopo, não como `pre_aprovado`.
5. `pre_aprovado` conta como etapa ativa e não habilita contrato para cliente/parceiro.
6. Parceiros e admins limitados não recebem permissões novas; nenhuma política RLS é ampliada.
7. Migration aditiva não modifica propostas existentes. Smoke/testes cobrem ordem, filtragem, status e bloqueio de aprovação.
8. Lint, typecheck, testes, build web e `git diff --check` passam. Smoke de navegador cobre drag para Standby, permanência no quadro, filtro e novo estágio.
9. Vercel só recebe uma candidata isolada com este escopo; os demais 170 caminhos locais não entram por acidente.

## Segurança e rollout

- Status é recebido e persistido através das RPCs existentes; o cliente não escreve diretamente na tabela `propostas`.
- A checagem de aprovação permanece restritiva na web e no código mobile. Admin continua sujeito à matriz/políticas atuais e a parceiros não é concedida escrita nos estados operacionais.
- Migration em produção e deploy Vercel ocorreram nesta ordem: a migration foi aprovada, aplicada e conferida pelo smoke antes da publicação web. Não publicar builds de outros canais sem go/no-go próprio.
- Não publicar builds de Windows, Linux, macOS ou mobile.
- Rollback do frontend: restaurar a versão anterior da Vercel. A migration enum é aditiva; não remover o valor em uso, usando forward-fix se necessário.

## Testes

- Testes unitários para ordem, inclusão Standby no modo Operacional, filtro Standby e classificação `pre_aprovado` como não aprovado.
- Executar lint, typecheck, suíte relevante, build web e `git diff --check`.
- Smoke SQL remoto somente leitura para enum/migration sem alteração de registros.
- Navegador admin autenticado: mover uma proposta de teste entre etapa ativa e Standby, confirmar permanência na primeira coluna e filtro; mover entre Análise Crédito → Pré-aprovado → Análise Imóvel.
- Validar que o filtro `/admin/propostas` continua encontrando Standby e Pré-aprovado; confirmar visualização de contrato bloqueada para cliente/parceiro quando status = Pré-aprovado.
- Não usar propostas reais para teste de escrita sem autorização específica; não enviar e-mail de teste.

## Resultado da implementação local (2026-10-16)

- Corrigida a filtragem do quadro Operacional para manter Standby visível após arrastar, e ordenada a coluna Standby como a primeira.
- Adicionada a etapa persistida Pré-aprovado após Análise Crédito e antes de Análise Imóvel; rótulos e classificação de aprovação foram atualizados na web e no código mobile.
- Migration `20261016000002_pre_aprovado_proposta_status.sql` aplicada depois de aprovada pelo usuário. O dry-run indicou somente essa migration pendente; `supabase migration list --linked` confirmou a versão aplicada.
- Smoke `fase-45-kanban-pre-aprovado.sql` executado no banco remoto com `npx supabase@latest db query --linked --file ...`; terminou sem exceção e sem consultar dados de propostas ou alterar registros.
- Verificações executadas: suíte Vitest completa (35 arquivos, 127 testes), typecheck web, lint web (0 erros; 38 avisos já existentes), build web e typecheck mobile passaram. `git diff --check` passou. O build informa aviso existente de bundle principal acima de 500 kB.
- `supabase db lint --linked --schema public,storage --fail-on error` alcançou o banco remoto, mas reportou erros preexistentes em funções não relacionadas (`admin_campanha_disparar`, `consulta_iniciar`, `admin_config_leads_classificador_atualizar`, `storage.list_objects_with_delimiter` e `storage.search`). O smoke específico da migration passou. Não houve teste visual autenticado em navegador conectado nem escrita de proposta real.
- O cliente iOS/TestFlight anterior a esta alteração interpreta status desconhecido como aprovado para a área de contrato. O bloqueio server-side cobre esse cliente antigo, além dos guards web/mobile locais.
- Candidata isolada preparada em `/tmp/mercurio-kanban-pre-aprovado-20261016`, baseada no commit `5225be7` registrado no último deploy Vercel. Contém somente 13 arquivos web de Kanban/status/teste, a migration e seu smoke SQL; manifesto SHA-256 em `KANBAN-CANDIDATE-MANIFEST.txt`.
- Na candidata: `npm ci --include=dev`, lint (zero erros, 38 avisos), typecheck, 21 arquivos/77 testes, build, `npm run validate:release` e `git diff --check` passaram. Build mantém aviso de chunk principal acima de 500 kB.
- O audit completo da árvore do lockfile-base reporta 26 vulnerabilidades (2 Critical, 9 High, 14 Moderate e 1 Low). O audit de runtime reporta 3 (2 Moderate, 1 Low), sem High/Critical. A publicação foi web-only, autorizada pelo usuário, e não incluiu artefatos Electron/mobile. A migração major de dependências continua pendente para os canais que a exigem.
- Candidata isolada em `/tmp/mercurio-kanban-pre-aprovado-20261016`, baseada no commit `5225be7` registrado no último deploy. Incluiu apenas 13 arquivos web, migration e smoke. O build de produção executado pela Vercel passou; o artefato referenciou o projeto Supabase correto, sem marcador de service-role ou URL placeholder.
- Vercel deployment `dpl_CS7pkAKFZiKi9DRFnX6GBHhwMXhP`, `READY`; promovido ao domínio `mercuriocapitalsa.com.br` e `www.mercuriocapitalsa.com.br`. Smoke HTTP confirmou 200 em `/`, `/admin/kanban`, `/p/kanban` e `/admin/propostas`; o bundle servido inclui `pre_aprovado`, `Pré-aprovado` e `Standby`. O domínio apex redireciona para `www` (308).
- Não foi possível testar a interação visual/autenticada no navegador nesta sessão. Arquivo local com variáveis de produção removido após a publicação; nenhum segredo foi exibido.
- Correção do primeiro deployment: `dpl_CS7pkAKFZiKi9DRFnX6GBHhwMXhP` causou inicialização com `Invalid supabaseUrl`; foi revertido para `dpl_EQYstrvmyYEnWdbppHFAGfqavvje`. Após validar o fallback Supabase, o novo deployment `dpl_6pthSE8R1e2CkaYNuXBxaRxwZBna` foi promovido e os aliases públicos confirmados. O hotfix não alterou o banco e nenhum segredo foi exibido.
