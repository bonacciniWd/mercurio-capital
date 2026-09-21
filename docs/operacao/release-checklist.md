# Checklist de release — Mercurio Capital

<!-- RELEASE_CURRENT_VERSION: 0.2.2 -->

## Regra de bloqueio

Versao atualmente mapeada: `v0.2.2`.

Este checklist nao autoriza publicacao. E proibido criar tag, GitHub Release, promover deploy ou publicar build mobile antes de:

1. mapear integralmente a mudanca;
2. preencher os itens aplicaveis abaixo com evidencias;
3. registrar um go/no-go;
4. receber autorizacao explicita do dono do produto para a release especifica.

## Identificacao

- [x] Versao candidata: `v0.2.2`.
- [x] Escopo candidato registrado nos handoffs 18, 19 e 20 e no plano da release.
- [x] Canais afetados: web e desktop; Supabase apenas conferido; mobile fora do escopo.
- [x] Plano aprovado em `prompts/2026-09-03-release-manual-v0-2-0.md`.
- [x] GitHub Actions proibido para esta release; gates equivalentes executados localmente.
- [x] Riscos, rollout e rollback documentados.
- [x] `RELEASE_TAG=v0.2.0 npm run validate:release` aprovado.

## Web — Vercel

- [x] `npm ci --include=dev` executado em `app/`.
- [x] `npm run lint` aprovado com zero erros e 38 avisos.
- [x] `npm run typecheck` aprovado.
- [x] `npm test` aprovado: 21 arquivos e 75 testes.
- [x] `npm run build` aprovado.
- [ ] Preview validado: fluxo feliz, vazio, erro e entrada invalida.
- [x] Guards por perfil cobertos pelos testes de escopo administrativo e documentos.
- [x] Configuracao Vercel revisada; nenhuma chave privada foi adicionada ao cliente.
- [x] Deploy de producao explicitamente autorizado para a `v0.2.0`.
- [ ] Smoke pos-deploy registrado.

## Supabase

- [x] Migrations da Fase 2 ja aplicadas e sincronizadas local/remoto ate `20260902000002`; nenhuma migration nova nesta release.
- [x] Modelo de dados das Fases 1 e 2 aprovado anteriormente.
- [x] RLS/RPCs cobertas pelos handoffs e smoke tests das Fases 1 e 2.
- [x] Smoke SQL transacional registrado nos handoffs das Fases 1 e 2.
- [ ] Edge Functions validam JWT/role, assinatura e idempotencia quando aplicavel.
- [ ] Secrets existem no ambiente sem aparecer em logs ou arquivos.
- [ ] Ordem de deploy e forward-fix/rollback registrada.
- [x] Nenhum deploy Supabase necessario nesta etapa; estado remoto conferido via CLI.

## Desktop — Electron/GitHub

- [x] Alteracoes Electron/updater possuem testes especificos.
- [x] Versao coerente em package, lockfile, documentacao, footer e tag candidata.
- [x] macOS x64 e arm64: assinatura, notarizacao, staple e `spctl` aprovados em apps e DMGs.
- [x] Windows x64: instalador NSIS gerado e validado; ausencia de code signing aceita para esta release.
- [x] Linux x64: AppImage ELF/SquashFS e `.deb` amd64 `0.2.0` gerados e validados.
- [x] `stable.yml`, `stable-mac.yml` e `stable-linux.yml` referenciam assets existentes com SHA-512 e tamanhos conferidos.
- [x] Checksums SHA-256 gerados e conferidos para os 15 assets candidatos.
- [ ] Auto-updater validado a partir da versao anterior suportada.
- [ ] Pagina `/download` aponta para os assets corretos.
- [x] Criacao da tag e GitHub Release explicitamente autorizada para `v0.2.0`.

## Mobile — Expo/EAS

- [ ] Escopo mobile foi separado do desktop.
- [ ] Typecheck e configuracao Expo aprovados.
- [ ] Fluxos afetados testados em dispositivo/plataforma alvo.
- [ ] Build EAS `FINISHED`.
- [ ] Build number/versionamento conferidos.
- [ ] Publicacao/TestFlight/loja explicitamente autorizada.

## Go/No-Go

- [ ] Todos os itens aplicaveis possuem evidencias sanitizadas.
- [ ] Nenhum achado Critical/High permanece aberto.
- [ ] Pendencias conhecidas foram aceitas pelo dono do produto. A ausencia de Authenticode foi aceita; os achados de dependencias abaixo aguardam decisao.
- [x] Plano de rollback ou forward-fix esta pronto.
- [x] Dono do produto declarou **GO** para esta versao e estes canais antes da descoberta do bloqueio de dependencias.

Se qualquer gate aplicavel permanecer aberto, o resultado e **NO-GO**.

## Evidencias locais da candidata v0.2.0 — 2026-09-03

- `npm run build:desktop:web`: aprovado, 4.504 modulos transformados.
- macOS x64 e arm64: apps reconhecidos como `Notarized Developer ID`, versao embarcada `0.2.0` e arquiteturas corretas.
- DMGs x64 e arm64: assinados depois da geracao, reenviados para notarizacao, aceitos, grampeados e aceitos pelo Gatekeeper.
- Blockmaps dos DMGs regenerados depois do staple; metadata macOS atualizado com os hashes e tamanhos finais.
- Windows: executavel interno PE32+ x86-64, instalador NSIS valido e versao embarcada `0.2.0`; sem Authenticode.
- Linux: AppImage ELF x86-64 com payload SquashFS valido; DEB formato 2.0, arquitetura `amd64` e versao `0.2.0`.
- ASAR dos tres sistemas contem `electron-updater`, `js-yaml` e `posthog-js`.
- Staging isolado: 15 assets candidatos e `sha256sums.txt`; SHA-256, SHA-512, tamanhos, referencias e cinco blockmaps conferidos.
- Supabase: migrations locais e remotas sincronizadas ate `20260902000002`, sem nova aplicacao.

### Bloqueio de seguranca descoberto antes da publicacao

- `npm audit --omit=dev`: 14 Moderate e 2 High transitivas (`js-yaml` e `protobufjs`), com correcao disponivel.
- O audit completo classifica o Electron 32 embarcado como High. Embora esteja declarado em `devDependencies`, ele compoe o runtime distribuido.
- `electron-builder` 25 e `app-builder-lib` possuem achado High relacionado ao AppImage; a correcao indicada exige `electron-builder` 26.15.3, salto major.
- As 2 Critical do grafo completo pertencem a ferramentas de desenvolvimento/build (`tar` transitivo e `vitest`), mas o checklist vigente nao permite ignora-las sem avaliacao e aceite explicito.
- Nenhuma tag, GitHub Release, push ou implantacao Vercel foi realizada depois da descoberta. A candidata permanece somente local.

## Pos-release

- [ ] Downloads/instalacao e smoke dos canais publicados foram validados.
- [ ] Sentry, PostHog e logs operacionais foram monitorados.
- [ ] Incidentes e mitigacoes foram registrados.
- [ ] Roadmap, finalizacao, runbooks e notas da release foram atualizados.
