# Plano de governanca para alteracoes futuras

## Objetivo

Estruturar um fluxo repetivel, auditavel e seguro para as proximas alteracoes do Mercurio Capital, partindo da release desktop atual `v0.1.6` e preservando os canais existentes:

- web em producao via Vercel;
- backend, banco, RLS e Edge Functions no Supabase;
- desktop Electron com release GitHub para macOS, Windows e Linux;
- mobile Expo/EAS em evolucao.

Plano aprovado pelo dono do produto em 2026-09-02, com a restricao explicita de que nenhuma nova release seja gerada antes do mapeamento completo. Nenhuma alteracao funcional, deploy, tag ou release faz parte desta etapa.

## Skills e documentos lidos

Nao foi necessaria uma skill externa: a tarefa e de governanca interna do repositorio e as fontes locais sao autoritativas.

Fontes principais consultadas:

- instrucoes `AGENTS.md` fornecidas para o repositorio;
- `.github/agents/pm-mercurio-capital.agent.md`;
- `.github/agents/ux-ui-mercurio-capital.agent.md`;
- `.github/agents/dev-senior-fullstack-mercurio-capital.agent.md`;
- `.github/agents/revisor-mercurio-capital.agent.md`;
- `docs/README.md`;
- `docs/09-roadmap.md`;
- `docs/12-finalizacao.md`;
- `docs/blueprint/01-architecture.md`;
- `docs/blueprint/02-roles-permissions.md`;
- `docs/blueprint/08-security-compliance.md`;
- `docs/operacao/runbooks.md`;
- `docs/operacao/desktop-release-macos-signing.md`;
- `mobile/README.md`;
- handoffs recentes em `docs/handoffs/`.

## Codigo e configuracoes inspecionados

- `app/package.json` (`version: 0.1.6` e scripts web/desktop);
- `app/package-lock.json` (alteracao local pre-existente, a preservar);
- `app/electron-builder.json`;
- `app/desktop/electron/main.cjs`;
- `app/desktop/electron/preload.cjs`;
- `app/desktop/electron/updater.cjs`;
- `app/vercel.json`;
- `.github/workflows/ci.yml`;
- `.github/workflows/desktop-release.yml`;
- estrutura de `app/src`, `mobile/`, `supabase/migrations`, `supabase/functions` e `supabase/smoke-tests`;
- rotas e limites de acesso em `app/src/router.tsx`, `app/src/lib/adminScope.ts` e `app/src/lib/securityConfig.ts`;
- tags e historico Git recentes, confirmando `v0.1.6` como ultima tag SemVer local.

## Diagnostico atual

1. Os quatro agentes locais possuem papeis uteis, mas ainda nao existe um protocolo unico que determine entrada, saida e gate entre PM, UX/UI, DEV e Revisor.
2. A CI da aplicacao web ja executa lint, typecheck, testes e build em `main` e pull requests.
3. A release desktop ja e orientada por tag `v*.*.*`, sincroniza a versao do pacote e exige builds de macOS, Windows e Linux antes de publicar a release.
4. O macOS possui gate forte de assinatura e notarizacao; a assinatura Windows continua documentada como pendencia.
5. A documentacao consolidada ainda destaca releases anteriores (`0.1.0`, desktop `0.0.4` e mobile `0.0.2`) e precisa de um mecanismo explicito de atualizacao a cada release.
6. O `app/package-lock.json` esta modificado antes deste trabalho e nao deve ser sobrescrito nem incluido incidentalmente.

## Decisoes e suposicoes assumidas

- `main` continua sendo a branch protegida e fonte de producao.
- Mudancas futuras entram por branch e pull request, nunca diretamente por tag.
- A classificacao SemVer sera definida pelo impacto: patch para correcoes compativeis, minor para funcionalidade compativel e major para quebra de contrato.
- A tag de release so sera criada depois do merge e da CI verde.
- Alteracoes de banco serao apenas por novas migrations forward-safe; migrations ja publicadas nao serao reescritas.
- Nenhuma mudanca em produto, arquitetura, modelo de dados ou UI sera decidida pelos agentes sem definicao ou aprovacao do dono do produto.
- Deploys, secrets, migrations remotas, tags e publicacoes sao acoes de estado externo e exigem autorizacao explicita no ciclo correspondente.

## Fluxo proposto por alteracao

### Gate 0 — Intake do dono do produto

Entrada minima:

- objetivo e problema a resolver;
- perfis afetados;
- comportamento esperado;
- prioridade;
- referencia visual, quando houver;
- restricoes e criterio de sucesso.

Saida: pedido suficientemente definido ou uma unica pergunta objetiva sobre a ambiguidade realmente bloqueante.

### Gate 1 — PM Mercurio Capital

Usar o agente PM para transformar o pedido aprovado em escopo executavel:

- in scope e out of scope;
- impacto em web, mobile, banco, Edge Functions, seguranca, operacao e documentacao;
- backlog priorizado;
- criterios de aceite;
- estrategia de rollout e rollback.

Saida: plano da alteracao em `prompts/YYYY-MM-DD-<slug>.md`, submetido ao dono do produto para aprovacao.

### Gate 2 — UX/UI, somente quando aplicavel

Usar o agente UX/UI quando houver tela, fluxo ou interacao. A referencia visual fornecida e a fonte da verdade; o agente nao redefine produto.

Saida esperada:

- telas/componentes afetados;
- estados loading, vazio, erro, sucesso e disabled;
- comportamento desktop e adaptacao responsiva;
- acessibilidade;
- criterios visuais objetivos.

Mudancas sem impacto visual pulam este gate.

### Gate 3 — Modelo de dados, quando aplicavel

Antes de implementar qualquer persistencia, documentar e obter aprovacao para:

- documentos/tabelas/registros principais;
- campos obrigatorios e opcionais;
- relacionamentos e cardinalidade;
- invariantes e regras de negocio;
- RLS, RPCs, auditoria, retencao e migracao de dados;
- rollback ou estrategia forward-fix.

### Gate 4 — DEV Senior Fullstack

Somente apos aprovacao do plano e, quando aplicavel, do modelo de dados:

- inspecionar o fluxo ponta a ponta;
- implementar o menor diff reversivel;
- preservar guards, RBAC, RLS e contratos existentes;
- manter segredos, IA, MCP e mutacoes sensiveis exclusivamente no servidor;
- adicionar ou atualizar testes;
- atualizar documentacao e runbooks afetados.

Processos pesados de ingestao, sincronizacao, transcricao ou embeddings devem ser scripts/jobs offline.

### Gate 5 — Verificacao tecnica

Obrigatorio para alteracoes em `app/`:

```bash
cd app
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Adicionar conforme o escopo:

- testes manuais no navegador: fluxo feliz, vazio, erro e entrada invalida;
- verificacao responsiva e de acessibilidade para UI;
- smoke SQL transacional para migrations/RLS/RPCs;
- teste local das Edge Functions sem expor secrets;
- verificacao do Studio, schemas e importacao quando envolver Supabase;
- build desktop por plataforma quando Electron, updater ou empacotamento forem afetados;
- typecheck/config/build EAS quando mobile for afetado.

Nenhum teste pode ser reportado como aprovado sem evidencia de execucao.

### Gate 6 — Revisor Mercurio Capital

O Revisor atua sem editar e avalia o diff final por severidade:

- regressao funcional por perfil;
- paridade de guards, RLS e autorizacao server-side;
- seguranca de migrations, RPCs, webhooks e Edge Functions;
- integridade de dados, idempotencia e observabilidade;
- cobertura de testes;
- readiness de rollback e release;
- drift entre codigo e documentacao.

Saida: `Approved`, `Approved with reservations` ou `Rejected`. Achados Critical/High bloqueiam merge e release.

### Gate 7 — Merge, deploy e release

Ordem proposta:

1. pull request aprovado e CI verde;
2. merge em `main`;
3. validar deploy web da Vercel e smoke de producao sem mutacao destrutiva;
4. aplicar migrations/Edge Functions apenas quando fizerem parte do escopo aprovado, com evidencias e rollback/forward-fix preparado;
5. atualizar `app/package.json` e lockfile de forma controlada para a proxima versao;
6. atualizar roadmap, finalizacao, runbook e notas da release;
7. criar e publicar tag `vX.Y.Z` somente com autorizacao explicita;
8. acompanhar o workflow desktop ate macOS, Windows, Linux e `publish-release` ficarem verdes;
9. validar assets, checksums, metadados do updater e pagina `/download`;
10. executar checklist pos-release e registrar incidentes/rollback se necessario.

Mobile permanece em ciclo separado via Expo/EAS e nao deve ser inferido como publicado junto com a tag desktop.

## Arquivos esperados para implementar esta governanca

Se este plano for aprovado, a proxima etapa deve avaliar e propor um diff pequeno nos seguintes pontos:

- `docs/operacao/change-management.md` — fluxo oficial e responsabilidades;
- `docs/operacao/release-checklist.md` — checklist unico de web, Supabase, desktop e mobile;
- `docs/README.md` — links para os novos documentos;
- `.github/pull_request_template.md` — escopo, seguranca, testes, docs, rollout e rollback;
- `.github/agents/*.agent.md` — alinhamento dos quatro agentes aos gates e ao requisito de aprovacao antes de editar;
- `docs/09-roadmap.md` e `docs/12-finalizacao.md` — correcao do snapshot de release para `v0.1.6`, sem apagar historico;
- opcional, mediante aprovacao especifica: workflow de validacao de consistencia de versao/tag/documentacao.

Nenhum desses arquivos, alem deste plano, foi alterado nesta etapa.

## Requisitos e criterios de aceite

- Existe uma fonte unica e clara para o ciclo pedido -> plano -> aprovacao -> implementacao -> revisao -> release.
- Cada agente tem responsabilidade, entradas, saidas e limites sem sobreposicao decisoria.
- O fluxo exige aprovacao humana antes de codigo, modelo de dados e publicacao.
- Toda alteracao identifica impacto em web, mobile, Supabase, Electron, seguranca e documentacao, mesmo quando o resultado for "nao afetado".
- PRs registram testes realmente executados, riscos, rollout e rollback.
- Release desktop so ocorre por tag SemVer e continua bloqueada se qualquer plataforma obrigatoria falhar.
- O estado documental passa a refletir `v0.1.6` e ganha rotina para permanecer sincronizado.
- Nenhum segredo, PII ou token e incluido em prompts, logs, PRs ou arquivos versionados.

## Consideracoes de seguranca

- RLS e autorizacao server-side sao a autoridade; guards de UI nao substituem controle no banco/Edge.
- Service role e tokens de provedores nunca chegam ao cliente.
- Mudancas de estado remoto exigem aprovacao explicita e evidencias sanitizadas.
- Migrations devem ser forward-safe, compativeis com dados existentes e acompanhadas de smoke tests transacionais.
- Webhooks devem validar assinatura, tratar retries e garantir idempotencia.
- Releases devem manter checksums e gates de assinatura/notarizacao; a pendencia de code signing Windows deve permanecer visivel ate ser resolvida.
- O arquivo local `app/package-lock.json` ja modificado deve ser preservado e revisado separadamente antes de qualquer commit.

## Testes manuais e automaticos deste plano

Nesta etapa de planejamento:

- confirmado `app/package.json` em `0.1.6`;
- confirmada a tag local `v0.1.6`;
- inspecionados CI, workflow de release desktop, configuracao electron-builder, updater e Vercel;
- nenhuma suite de testes foi executada, pois nao houve alteracao de codigo;
- nenhum deploy, migration remota, tag, release ou commit foi realizado.

Na implementacao da governanca, validar:

- Markdown e links internos dos novos documentos;
- template de PR renderizado corretamente;
- coerencia dos agentes com o workflow oficial;
- `npm run lint`, `npm run typecheck`, `npm test -- --run` e `npm run build` se qualquer arquivo executavel/configuracao for alterado;
- teste do validador de versao, caso o workflow opcional seja aprovado.

## Aprovacao

Aprovado pelo dono do produto em 2026-09-02. O validador automatico entra neste ciclo. Releases permanecem bloqueadas ate mapeamento completo e um go/no-go especifico aprovado.
