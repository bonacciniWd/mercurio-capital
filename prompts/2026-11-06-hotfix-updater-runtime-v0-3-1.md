# Plano de hotfix desktop macOS v0.3.1 — dependências do updater

Status: aprovado; implementação e publicação manual autorizadas após validação dos gates.

## Objetivo

Corrigir a inicialização do app macOS após atualizar para v0.3.0. O erro exibido é `Cannot find module 'fs-extra'`, exigido por `electron-updater` dentro de `app.asar`. Preparar um hotfix patch v0.3.1 para macOS ARM e Intel, assinado e notarizado, sem executar GitHub Actions e sem rebuild Windows/Linux.

## Documentação e configuração consultadas

- `AGENTS.md` fornecido nesta conversa.
- `prompts/2026-11-06-release-web-desktop-v0-3-0.md`.
- `docs/operacao/desktop-release-macos-signing.md` e `docs/operacao/release-checklist.md`.
- `app/package.json`, `app/package-lock.json`, `app/electron-builder.json`, `app/desktop/electron/updater.cjs`.
- Metadados e arquivos do GitHub Releases v0.3.0 e v0.2.2.

## Evidência e diagnóstico

- O app v0.3.0 abre `electron-updater/out/main.js`, mas o `app.asar` publicado não contém `fs-extra` nem as demais dependências runtime declaradas por `electron-updater` (`builder-util-runtime`, `js-yaml`, `lazy-val`, `lodash.escaperegexp`, `lodash.isequal` e `tiny-typed-emitter`).
- O app.asar da v0.2.2 contém essas dependências, o que confirma regressão no empacotamento da candidata v0.3.0.
- O manifesto `app/package-lock.json` da v0.3.0 registra `fs-extra` como dependência de `electron-updater`, mas esse grafo não foi refletido no artefato publicado.
- Portanto, o defeito acontece no pacote Electron macOS, antes do renderer; não é problema da Vercel, do banco ou dos dados locais do app.
- Reprodução em worktree isolado com `npm ci --include=dev`: electron-builder 26.15.3 gerou ASAR contendo as oito dependências diretas do updater e suas dependências transitivas; o ASAR publicado v0.3.0 não as continha. O hotfix acrescenta uma validação pós-empacotamento que bloqueia a publicação quando faltar qualquer módulo runtime declarado na cadeia do updater.
- A causa exata da omissão no build anterior não ficou nos logs preservados; uma árvore de dependências de build diferente do lockfile é a hipótese mais provável, mas não comprovável com a evidência disponível.

## Escopo de implementação proposto

1. Reproduzir e corrigir o empacotamento em worktree/snapshot isolada, sem usar o checkout principal atualmente sujo.
2. Garantir que todas as dependências runtime necessárias do `electron-updater` sejam materializadas no ASAR. A correção será escolhida após validar a causa do filtro de dependências do electron-builder; evitar adicionar dependências diretas redundantes sem provar que são necessárias.
3. Incrementar a versão para `0.3.1` nos arquivos coerentes de versão e atualizar o plano/checklist de release.
4. Gerar somente builds macOS ARM e Intel, assinar, notarizar, aplicar staple e validar ZIPs, DMGs, `stable-mac.yml`, hashes e tamanhos.
5. Publicar os assets macOS como uma nova GitHub Release `v0.3.1`, mantendo Windows/Linux da v0.2.2 sem alterações. Atualizar o rótulo de versão no código da landing, sem deploy manual Vercel; atualizar o branch principal e eventuais deploys automáticos ficam fora do escopo.
6. Como a v0.2.2 consulta automaticamente a release estável mais nova, retirar temporariamente a v0.3.0 do canal `latest` (marcá-la como prerelease, sem apagar assets) antes de permitir que o app restaurado execute o updater. A release estável mais recente volta a v0.2.2 até a v0.3.1 passar seus gates.

## Arquivos esperados

- `app/package.json` e `app/package-lock.json`, somente se a correção de packaging exigir mudança no grafo de runtime.
- `app/electron-builder.json` e/ou configuração de packaging dedicada, se a causa confirmada estiver no filtro/empacotamento.
- Teste/validador de artefato para assegurar presença das dependências do updater no ASAR.
- `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md` e este plano.
- Artefatos macOS versionados em diretório local de saída ignorado; não versionar binários.

## Critérios de aceite

- Teste automatizado ou verificação determinística do ASAR confirma `fs-extra` e todas as dependências runtime do updater presentes no artefato ARM e Intel.
- App extraído de cada ZIP inicia o processo principal sem `uncaughtException` e a inicialização do updater não falha.
- `npm run validate:release`, lint, typecheck, testes e build desktop web passam; builds macOS ARM/Intel assinam e passam validações de notarização/staple/Gatekeeper.
- Feed `stable-mac.yml` anuncia `0.3.1` com hashes e tamanhos correspondentes aos ZIPs publicados; assets respondem publicamente.
- Até a v0.3.1 estar validada, `latest` não oferece v0.3.0; depois aponta para v0.3.1.
- Nenhum workflow GitHub é executado; Windows/Linux não são recompilados nem substituídos.

## Segurança e rollback

- Usar snapshot isolada baseada no commit publicado e allowlist estrita; preservar as demais mudanças locais.
- Não imprimir nem gravar credenciais de assinatura/notarização.
- Não tocar em dados de usuário, armazenamento local, Supabase, Vercel ou associações externas.
- Se a nova validação falhar, não publicar `v0.3.1`; manter release v0.3.0 e os arquivos v0.2.2 disponíveis. A recuperação manual para um Mac que não abre será reinstalar temporariamente o DMG v0.2.2 e, depois da correção, atualizar para v0.3.1.
- A v0.3.0 fica preservada como prerelease enquanto o artefato estiver defeituoso; pode voltar ao canal estável após correção comprovada, se o dono do produto decidir.

## Testes

- Reproduzir no artefato existente: confirmar dependências ausentes/presentes por listagem do ASAR.
- Validar o candidato macOS em arquitetura ARM e Intel, incluindo abertura do app e carregamento do updater.
- Executar verificações de release, assinatura, notarização, staple, Gatekeeper, feed e hashes antes de publicar.
- Smoke final de download e leitura do feed pelo domínio público; registrar como pendente a instalação real em um segundo dispositivo, caso indisponível.

## Aprovação

Aprovado pelo usuário para implementar, gerar e publicar manualmente a release macOS `v0.3.1` (ARM/Intel), sem GitHub Actions, sem builds Windows/Linux e sem deploy manual Vercel/Supabase. A v0.3.0 foi marcada como prerelease e a release estável mais recente confirmada como v0.2.2 durante o hotfix.
