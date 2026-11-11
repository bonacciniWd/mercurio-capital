# Plano — remediação de dependências antes da release Serasa

Data: 29/10/2026. Estado: lockfile atualizado e validações locais aprovadas; promoção aguarda smoke autenticado no preview.

## Objetivo

Fechar o gate de dependências Critical/High que bloqueia a promoção do preview Serasa para produção, usando somente correções disponíveis dentro das faixas semver já declaradas. Depois validar a aplicação e retomar o rollout documentado em `prompts/2026-10-28-publicacao-serasa-proponente-rollback.md`.

## Documentação e código lidos

- `AGENTS.md` fornecido nesta conversa.
- `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md`.
- `app/package.json` e `app/package-lock.json`.
- Audit atual: 16 achados no grafo total (7 Moderate, 6 High, 3 Critical); produção (`--omit=dev`): 1 Critical e 2 Moderate.
- `dompurify@3.4.14` chega via `posthog-js`; correção proposta pelo audit sem major: `3.4.17`.
- Simulação `npm audit fix --dry-run` propõe atualizar lockfile para patches sem major (entre outros: `dompurify 3.4.17`, `vite 8.3.5`, `electron 44.10.0`, `undici 7.30.1`, `concurrently 10.0.6`). `react-router-dom` permanece Moderate; a correção indicada pelo npm exigiria major para v7 e fica fora deste escopo.
- A simulação não alterou `package-lock.json`; `package.json` já tem uma alteração local de metadado de autor, que deve permanecer fora do artefato.

## Decisões e suposições

- Alterar apenas `app/package-lock.json` via `npm audit fix` sem `--force`; não modificar especificações de dependências, não aceitar salto major e não rodar `npm audit fix --force`.
- Rejeitar/inspecionar o diff do lockfile caso a execução tente alterar `package.json`, introduzir pacote fora do grafo ou mudar versão major.
- A remediação precisa zerar todos os High/Critical no audit completo para satisfazer o checklist vigente. Os Moderate de React Router ficam documentados, sem salto major.
- Não fazer deploy da remediação isolada antes de revisar a release Serasa; ambas serão incorporadas em uma única promoção web depois de lint, typecheck, testes, build e preview atualizado.

## Arquivos esperados

- `app/package-lock.json`.
- Atualização de evidências em `prompts/2026-10-28-remediacao-dependencias-pre-release-serasa.md` e no plano da publicação.

## Critérios de aceite

1. Alteração limitada ao lockfile; `npm audit` completo mostra zero Critical/High e `npm audit --omit=dev` não mostra Critical/High.
2. `npm run lint`, `npm run typecheck`, suíte completa, build e `git diff --check` passam.
3. O bundle web continua sem secrets e contém as alterações Serasa aprovadas.
4. Preview atualizado a partir de snapshot limpo conclui build e smoke sem regressão.
5. Rollback continua possível para Vercel e Edge conforme plano de publicação; sem migration ou alteração de dados.

## Segurança e impacto

- Mudança é apenas nas versões resolvidas pelo lockfile; sem novo serviço ou segredo.
- Alcança build web e dependências instaladas do app; a dependência Electron será atualizada no lockfile para corrigir achados, mas nenhum instalador desktop será gerado ou publicado.
- Não altera schema, RLS, Edge Functions, roles, cota Serasa nem APIs externas.
- Não executar consulta Serasa, backfill, ativação do produto ou migration.

## Testes e validação

- Antes/depois: `npm audit --json` e `npm audit --omit=dev --json`, sem registrar conteúdo sensível.
- `npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers 2 --testTimeout 30000`, `npm run build`, `git diff --check`.
- Rodar teste focal Serasa e telas Admin/Partner.
- Preview Vercel e smoke visual/autenticado ainda precisam da conta Admin/Partner; nunca usar o preview para executar relatório real.

## Rollback

- Se a atualização do lockfile falhar: restaurar somente `app/package-lock.json` ao estado prévio desta remediação e não publicar.
- Se validação falhar: não atualizar preview nem promover; manter o preview anterior sem domínio.
- Se produção falhar depois da release: `vercel rollback dpl_FAGnmr6Td8hM1XktsLNn9n2Hy8M2`; Edge volta ao código anterior salvo, sem `--prune`, preservando migration e dados.

## Aprovação

Esta aprovação, quando concedida, autoriza somente a atualização local do lockfile e validação listadas. Publicação de produção continua coberta pelo GO separado já registrado no plano de release, condicionado a todos os gates verdes.

## Execução aprovada — 29/10/2026

- `npm audit fix` sem `--force`: lockfile atualizou 36 versões e removeu 2 pacotes. Não alterou especificações. `app/package.json` permaneceu com sua alteração local preexistente apenas no e-mail de autoria; essa diferença não foi incorporada ao snapshot Vercel.
- `npm audit --json`: 0 High, 0 Critical; restam 2 Moderate em `react-router`/`react-router-dom` e a ferramenta recomenda uma major para v7. `npm audit --omit=dev`: mesmo resultado de severidade; sem Critical/High.
- `npm run lint`: 0 erros, 33 warnings existentes; `npm run typecheck`: aprovado; `npm test -- --maxWorkers 2 --testTimeout 30000`: 45 arquivos e 175 testes aprovados; `npm run build`: aprovado com Vite 8.3.5; teste do normalizador: 6/6; `git diff --check`: aprovado.
- Preview Vercel atualizado usando snapshot isolado, lockfile novo e os cinco arquivos de UI Serasa aprovados: deployment `dpl_6QdWUSK4Tou8pABdoiKErY93jy7x`, READY, `https://mercurio-digital-gwhi2z22g-bonacciniwds-projects.vercel.app`. Build remoto informou somente 2 Moderate.
- Smoke HTTP pelo `vercel curl` retornou 200 e HTML da aplicação. Tentativa de captura em browser sem cookies foi redirecionada para autenticação de Deployment Protection do Vercel. A sessão Chrome remota disponível está em `http://localhost:5173/admin/login`, não autenticada no preview.
- Nenhum deploy de Edge Functions nem produção Vercel foi feito. Sem consulta Serasa, migration, ativação ou backfill. Promoção segue bloqueada até o smoke autenticado exigido pelo checklist; ver plano principal para sequência/rollback.
