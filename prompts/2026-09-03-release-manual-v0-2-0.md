# Plano de release manual v0.2.0

## Objetivo

Consolidar as alteracoes aprovadas das Fases 1 e 2 em uma release estavel `v0.2.0`, gerando e validando localmente os artefatos para macOS, Windows e Linux, publicando-os pelo terminal no GitHub Releases, implantando o frontend pelo Vercel CLI e confirmando que clientes macOS instalados na `v0.1.6` recebem a atualizacao automatica.

Nenhum build, upload ou deploy desta release sera executado pelo GitHub Actions.

## Skills e documentos lidos

- `AGENTS.md` fornecido no contexto da tarefa.
- Agentes locais em `.github/agents/`, com as orientacoes de PM, revisao, UX/UI e engenharia do projeto.
- `README.md` e documentacao operacional em `docs/`.
- `docs/operacao/change-management.md`.
- `docs/operacao/release-checklist.md`.
- `docs/operacao/runbooks.md`.
- Configuracao do Electron Builder e implementacao do auto-updater.
- Configuracao Vercel e paginas publicas de Landing/Download.
- Documentacao oficial do GitHub sobre skip, desativacao e reativacao de workflows.

## Codigo e configuracoes inspecionados

- Estado Git, branch, HEAD, `origin/main` e tag `v0.1.6`.
- Alteracoes rastreadas e nao rastreadas das Fases 1 e 2.
- `app/package.json` e `app/package-lock.json`.
- `app/electron-builder.json`.
- `app/desktop/electron/main.cjs` e configuracao do canal `stable` do updater.
- `app/scripts/validate-release-consistency.mjs`.
- `app/src/pages/Landing.tsx` e `app/src/pages/Download.tsx`.
- `.github/workflows/ci.yml` e `.github/workflows/desktop-release.yml`.
- `app/vercel.json` e vinculo local do projeto Vercel.
- Release remota `v0.1.6` e seus artefatos/metadados.
- Ferramentas e credenciais locais por presenca, sem imprimir segredos: GitHub CLI, Vercel CLI, Wine, identidade Developer ID e perfil `notarytool`.

## Diagnostico atual

- A versao do pacote e da documentacao ainda e `0.1.6`.
- O footer da landing esta atrasado em `v0.1.5`.
- A release `v0.1.6` e a release publica mais recente no GitHub.
- O `main` local esta um commit a frente de `origin/main` e possui alteracoes ainda nao consolidadas das Fases 1 e 2.
- Os tres alvos estao configurados: macOS `arm64` e `x64`; Windows `x64`; Linux `x64` em AppImage e DEB.
- A assinatura Developer ID e a autenticacao de notarizacao macOS estao disponiveis localmente.
- Nao ha certificado de assinatura Windows configurado; o instalador Windows sera validado funcional e estruturalmente, mas permanecera sem assinatura Authenticode nesta release.

## Decisoes e suposicoes assumidas

1. A versao candidata e `v0.2.0`, pois a entrega adiciona funcionalidades compativeis relevantes e se enquadra em incremento minor pelo SemVer documentado no projeto.
2. O canal do auto-updater permanece `stable`.
3. macOS tera DMG e ZIP para `arm64` e `x64`; os ZIPs e `stable-mac.yml` alimentarao o auto-update.
4. Windows tera instalador NSIS `x64` e `stable.yml`; Linux tera AppImage, DEB e `stable-linux.yml`.
5. A ausencia de Authenticode no Windows e uma reserva conhecida e precisa ser aceita no GO desta release.
6. Os workflows remotos `ci.yml` e `desktop-release.yml` serao desativados temporariamente via GitHub CLI, com estado inicial registrado, e restaurados ao final. O commit tambem usara `[skip actions]` como segunda trava.
7. A publicacao sera inicialmente criada como draft. Ela somente sera tornada publica depois da verificacao integral dos artefatos e metadados.
8. O deploy web sera feito por `vercel deploy --prod` a partir do terminal apos a publicacao do GitHub Release, evitando que o footer anuncie uma versao ainda indisponivel.
9. Nenhuma migration nova sera criada para o empacotamento. As migrations existentes serao apenas verificadas quanto ao estado remoto e consistencia.

## Modelo de dados

Esta etapa nao altera tabelas, relacionamentos, RLS ou funcoes do banco. O escopo e exclusivamente versionamento, empacotamento, publicacao e validacao da aplicacao ja aprovada.

## Arquivos esperados

Alteracoes planejadas antes do empacotamento:

- `app/package.json`: `0.1.6` para `0.2.0`.
- `app/package-lock.json`: raiz e pacote principal para `0.2.0`.
- `app/src/pages/Landing.tsx`: footer para `v0.2.0`.
- `app/scripts/validate-release-consistency.mjs`: validar tambem a versao exibida na landing.
- `docs/operacao/change-management.md`: marcador e referencia da versao.
- `docs/operacao/release-checklist.md`: marcador, versao e evidencias da release.
- `docs/operacao/runbooks.md`: estado de versionamento.
- `supabase/config.toml`: remover somente a diferenca irrelevante de fim de arquivo, se ainda presente.
- Demais arquivos atualmente modificados das Fases 1 e 2: consolidados no commit da release somente apos revisao final do diff.

Artefatos esperados:

- macOS ARM64: DMG, ZIP e blockmaps.
- macOS x64: DMG, ZIP e blockmaps.
- Windows x64: Setup EXE e blockmap.
- Linux x64: AppImage e DEB.
- Metadados: `stable-mac.yml`, `stable.yml`, `stable-linux.yml`.
- Integridade: `sha256sums.txt` com todos os arquivos publicados.

## Requisitos e criterios de aceite

### Codigo e versao

- `package.json`, `package-lock.json`, documentos operacionais, tag, release e footer exibem `0.2.0` de forma coerente.
- O validador de release falha se o footer divergir da versao do pacote.
- O diff final nao contem segredos, artefatos gerados, arquivos temporarios ou mudancas alheias ao escopo aprovado.
- O commit da release usa `[skip actions]`.

### Verificacoes automaticas locais

- `npm ci` concluido.
- `npm run validate:release` concluido com `RELEASE_TAG=v0.2.0`.
- `npm run lint` concluido.
- `npm run typecheck` concluido.
- `npm test` concluido.
- `npm run build` concluido.
- `npm run build:desktop:web` concluido.
- Estado das migrations Supabase conferido no `project-ref` vinculado, sem aplicar mudancas novas.

### macOS

- Apps e DMGs `arm64` e `x64` existem e possuem a arquitetura correta.
- `codesign --verify --deep --strict` passa nos dois bundles.
- `spctl --assess` aceita apps e DMGs.
- A notarizacao Apple e aceita, grampeada e validada com `stapler`.
- `stable-mac.yml` declara `0.2.0`, referencia os dois ZIPs existentes e possui `sha512` e tamanhos coerentes.
- Os arquivos publicos referenciados pelo metadata respondem com sucesso.

### Windows

- O Setup e um executavel PE32+ `x86-64` valido.
- O instalador pode ser aberto/inspecionado via Wine e contem a versao `0.2.0`.
- `stable.yml` declara `0.2.0` e confere com o EXE/blockmap publicados.
- A ausencia de Authenticode fica registrada nas notas da release.

### Linux

- O AppImage e executavel Linux `x86-64` valido.
- O DEB informa arquitetura `amd64`, versao `0.2.0` e metadados corretos.
- `stable-linux.yml` declara `0.2.0` e confere com os artefatos publicados.

### GitHub e ausencia de Actions

- Estado inicial dos workflows registrado.
- `ci.yml` e `desktop-release.yml` desativados pelo terminal antes de qualquer push.
- Commit e tag `v0.2.0` enviados pelo terminal.
- Nenhum novo run do GitHub Actions iniciado para a janela da release.
- Draft criado, arquivos enviados e inventario remoto comparado com o inventario local.
- Release publicada pelo terminal somente apos todos os gates.
- Workflows restaurados exatamente ao estado anterior e estado final verificado.

### Vercel, Landing e Download

- Deploy de producao realizado pelo Vercel CLI.
- Dominio principal aponta para deployment `Ready`.
- Footer publico exibe `v0.2.0`.
- Pagina `/download` identifica `v0.2.0` como latest e oferece os tres sistemas.
- Rotas principais carregam e assets estaticos respondem sem erro.

### Auto-update macOS

- `stable-mac.yml` publico anuncia `0.2.0`, superior a `0.1.6`.
- O metadata contem ambos os ZIPs e seleciona corretamente `arm64`/`x64`.
- O feed e os ZIPs sao acessiveis publicamente e os hashes correspondem.
- Sempre que tecnicamente possivel no ambiente local, uma instalacao `0.1.6` sera iniciada para confirmar deteccao/download da `0.2.0`; se a automacao visual nao for possivel, a verificacao sera registrada como teste manual pendente, sem alegar sucesso.

## Consideracoes de seguranca

- Nenhum segredo Apple, GitHub, Vercel ou Supabase sera impresso, versionado ou incorporado ao frontend.
- Assinatura e notarizacao ocorrerao somente na maquina local autenticada.
- Os artefatos serao produzidos em diretorio ignorado/temporario e selecionados explicitamente por versao; nenhum artefato antigo sera apagado.
- Checksums serao gerados antes do upload e reconferidos apos a publicacao.
- A release permanecera draft diante de qualquer divergencia.
- Depois de uma release publica, correcoes desktop serao feitas por versao posterior; nao sera usado downgrade silencioso.
- Em falha no frontend, o deployment anterior da Vercel podera ser promovido novamente.

## Sequencia operacional

1. Obter GO explicito para `v0.2.0`, para a reserva de Windows sem Authenticode e para a janela de desativacao temporaria dos workflows.
2. Revisar o diff completo e ajustar apenas versao, footer, validador e documentacao de release.
3. Executar todos os testes e builds web locais.
4. Empacotar os tres sistemas localmente.
5. Assinar, notarizar e validar macOS; validar estrutura/arquitetura de Windows e Linux.
6. Normalizar nomes, validar metadados e gerar checksums.
7. Criar commit local da release com `[skip actions]` e tag anotada `v0.2.0`.
8. Registrar e desativar temporariamente os dois workflows via `gh`.
9. Fazer push do commit/tag, criar release draft e enviar artefatos via `gh`.
10. Comparar inventario local/remoto, tornar a release publica e validar o feed de update.
11. Implantar o frontend com Vercel CLI e validar footer, download e rotas.
12. Restaurar workflows, verificar seus estados e confirmar que nenhum run foi usado.
13. Atualizar o checklist com as evidencias e entregar o relatorio final.

## Criterios de bloqueio

A release nao sera publicada se ocorrer qualquer um dos seguintes casos:

- divergencia de versao entre pacote, tag, metadata, footer ou documentos;
- falha em lint, typecheck, testes ou build;
- assinatura/notarizacao macOS incompleta;
- falta de qualquer artefato/metadado esperado;
- hash/tamanho divergente;
- inicio inesperado de GitHub Actions;
- release remota ou deploy Vercel sem validacao de acesso;
- segredo ou arquivo local sensivel presente no diff/staging.

