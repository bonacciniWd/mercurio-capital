# Plano - publicação web e release desktop macOS v0.3.0

Status: aprovado; validações locais e artefatos macOS concluídos; publicação manual em andamento.

## Objetivo

Publicar a interface web aprovada na Vercel e preparar a versão estável `v0.3.0`, alinhando landing, pacote e `/download`. Gerar e publicar manualmente somente os artefatos macOS arm64 e x64, assinados e notarizados, para que instalações `v0.2.2` encontrem `stable-mac.yml` mais novo e iniciem a atualização automática. Não iniciar GitHub Actions nem gerar builds Windows/Linux.

## Skills e documentos consultados

- `AGENTS.md` fornecido nesta conversa.
- `.github/agents/dev-senior-fullstack-mercurio-capital.agent.md` e `pm-mercurio-capital.agent.md`.
- `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md`, `docs/operacao/runbooks.md`.
- `docs/operacao/desktop-release-macos-signing.md`.
- `prompts/2026-09-03-release-manual-v0-2-0.md` e `prompts/2026-11-06-proposta-detalhe-documentos-referencia-visual.md`.
- Configuração de `/download`, Electron Builder, updater, Vercel e workflows GitHub.

## Código, releases e estado remoto inspecionados

- `app/package.json`, `app/package-lock.json`, `app/src/pages/Landing.tsx`, `app/src/pages/Download.tsx`, `app/src/lib/desktopReleaseAssets.ts`.
- `app/electron-builder.json`, `app/desktop/electron/main.cjs`, `app/desktop/electron/updater.cjs`.
- `app/vercel.json`, vínculo local Vercel `mercurio-digital` e wrapper `scripts/deploy-vercel-production.sh`.
- `.github/workflows/ci.yml`, `.github/workflows/desktop-release.yml` e estado via GitHub CLI.
- Release remota `v0.2.2` e assets: macOS arm64/x64, Windows x64 e Linux x64.
- `main` e `origin/main` estão no mesmo commit `46e0be5`; o checkout contém alterações locais de múltiplas frentes. A release deve usar snapshot isolada e allowlist, sem enviar arquivos alheios.
- A release GitHub mais recente é `v0.2.2`; `/download` consulta somente `/releases/latest` e usa os assets da release mais recente.
- GitHub Actions está habilitado no repositório e os workflows `CI` e `Desktop Release` estão ativos, apesar do registro anterior de que estavam desativados. A execução CI de 06/11 terminou em falha sem steps/logs disponíveis.
- A identidade `Developer ID Application` do Team `29U8L34KC9` está instalada; o perfil Keychain `mercurio-notary` respondeu com histórico Apple de submissões aceitas. O perfil antigo `mc-preflight` retorna credenciais inválidas e não será usado.
- Auditoria atual do npm: 14 Moderate, zero High/Critical no grafo completo; `npm audit --omit=dev` também zero High/Critical.

## Decisões propostas e suposições

1. Candidata `v0.3.0`: desde `v0.2.2`, o `main` recebeu novas capacidades compatíveis e relevantes; o incremento minor segue o SemVer descrito em `change-management.md`.
2. Publicar web em produção após liberar a GitHub Release, para que `/download` anuncie uma versão já publicada.
3. Gerar localmente macOS arm64 e x64 (DMG e ZIP), assinar/notarizar e validar. Não gerar Windows ou Linux nesta release.
4. Como `/download` mostra apenas assets da última release, copiar para `v0.3.0` os instaladores Windows/Linux já publicados em `v0.2.2` e seus metadados/blockmaps. Esses binários permanecerão explicitamente em `0.2.2`; não receberão atualização automática nesta release. Isso mantém os links de instalação sem rebuild. Esta opção implica upload adicional aproximado de 460 MB.
5. Desativar os workflows remotos `CI` e `Desktop Release` antes de qualquer push/tag e mantê-los desativados ao final, respeitando o limite de Actions solicitado. A publicação será feita por CLI e não iniciará run.
6. Criar commit de release com allowlist de arquivos de interface aprovada, versão e documentação; não incluir as demais mudanças locais de Serasa, WhatsApp, banco, testes manuais, credenciais ou arquivos temporários.
7. Criar tag/release pública estável `v0.3.0` apenas depois de validação de build, assinatura, notarização, feed e inventário.

## Arquivos previstos

- `app/package.json` e `app/package-lock.json`: versão `0.3.0`.
- `app/src/pages/Landing.tsx`: versão exibida `v0.3.0`.
- `app/src/components/PropostaDocsUploader.tsx`, `app/src/pages/admin/proposta-detalhe.css`, `app/src/test/PropostaDocsUploader.test.tsx`: UI aprovada da aba Documentos.
- `docs/operacao/change-management.md` e `docs/operacao/release-checklist.md`: versão e evidências correntes.
- Este plano e notas da release.
- Assets macOS gerados no diretório ignorado `app/desktop/artifacts/`; assets anteriores de Windows/Linux copiados sem rebuild.

## Requisitos e critérios de aceite

- `validate:release`, lint, typecheck, suíte de testes e build web aprovados.
- Build desktop apenas macOS arm64/x64; bundles e DMGs passam em assinatura, notarização, staple, `spctl` e validação de integridade.
- `stable-mac.yml` declara `0.3.0`, contém os dois ZIPs corretos, tamanhos e hashes correspondentes; ambos ZIPs e DMGs da release são acessíveis publicamente.
- Os metadados e binários Windows/Linux preservados seguem declarando `0.2.2`; nenhum artefato dessas plataformas é recompilado.
- GitHub Actions permanece sem runs novos; workflows estão desativados antes do push/tag.
- `/download` em produção recebe release latest `v0.3.0` e lista os downloads macOS novos e os links Windows/Linux existentes.
- A Vercel produção fica `Ready`, a landing mostra `v0.3.0`, e rotas/arquivos públicos principais respondem corretamente.
- O updater do app estável continua no canal `stable`, com download automático e instalação no encerramento; o feed publicado anuncia uma versão superior a `0.2.2`.
- Preservar o deployment anterior e release `v0.2.2` como rollback. Não apagar artefatos existentes.

## Segurança e impacto

- Vercel, GitHub CLI e assinatura local só recebem arquivos da snapshot allowlist.
- Nenhuma chave privada ou credencial Apple/GitHub/Vercel é impressa, escrita no repo ou incluída em artefatos fora do fluxo seguro da ferramenta.
- Não há alteração de Supabase, schema/RLS, Edge Function ou dados.
- Mudança externa: desativação dos dois workflows GitHub; release e assets públicos; novo deployment Vercel.

## Plano de validação e operação

1. Após aprovação, montar snapshot isolada do `main` com os arquivos allowlist; atualizar a versão e registrar notas/checklist.
2. Rodar validações web completas e validar que nenhuma alteração fora da allowlist foi incluída.
3. Desativar `CI` e `Desktop Release` pelo GitHub CLI e reler o estado antes de qualquer evento Git.
4. Gerar o build web desktop e empacotar apenas `desktop:pack:mac` com `CSC_NAME` e perfil Keychain `mercurio-notary`.
5. Assinar/notarizar DMGs arm64/x64, staple e validar app bundles, DMGs e metadados; gerar checksums.
6. Baixar os assets Windows/Linux de `v0.2.2` e verificar hashes antes de adicioná-los à nova release sem alterações.
7. Commit/tag controlados com `[skip actions]`; conferir Actions desativadas; publicar release GitHub e comparar inventário/hash.
8. Implantar Vercel pelo wrapper e validar produção, `/download`, links, footer e rotas.
9. Confirmar feed público `stable-mac.yml` e resposta HTTP dos ZIPs. Uma instalação real `v0.2.2` não será atualizada nesta sessão sem um Mac de teste isolado; detecção/download via feed público será evidência técnica, e o smoke de instalação será descrito como pendente se não puder ser executado com segurança.

## Rollback

- Antes de publicar: descartar snapshot/artefatos locais e remover a tag local candidata, sem tocar em versões existentes.
- Após publicar web: promover o deployment Vercel imediatamente anterior.
- Após publicar release: marcar `v0.3.0` como draft ou despublicar se houver erro; nunca sobrescrever `v0.2.2`. Para corrigir updater, publicar nova versão patch/minor seguindo novo gate.
- Os workflows permanecerão desativados por decisão operacional para evitar consumo de Actions.

## Aprovação recebida e evidências

- O proprietário aprovou o plano completo, incluindo release `v0.3.0` web + macOS arm64/x64, cópia dos assets Windows/Linux v0.2.2, workflows GitHub desativados e deploy Vercel.
- Snapshot isolado baseado em `main` `46e0be5e43af3dfdcc01e2dc031e653825146085`; somente arquivos allowlist estão staged para versão/release.
- `validate:release`, lint (33 warnings, 0 errors), typecheck, testes (55 arquivos/241 testes) e build web passaram.
- Build desktop web e empacotamento macOS x64/arm64 concluídos; assinatura Apple Developer ID e notarização dos ZIPs e DMGs aceitas. DMGs stapled; apps e DMGs passaram `codesign`, `stapler validate` e Gatekeeper.
- `stable-mac.yml` confere SHA-512 e tamanho dos artefatos, inclusive DMGs pós-staple. Assets Windows/Linux e feeds preservados byte a byte pelos SHA-256 da release v0.2.2.
- Workflows `CI` (276754843) e `Desktop Release` (309052925) foram desativados manualmente e relidos como `disabled_manually`; permissões globais de Actions seguem habilitadas, mas nenhum workflow será disparado por esta publicação.
- Pendentes: commit/push/tag/release manual, conferir feed/links públicos, deploy Vercel e smoke pós-deploy.
