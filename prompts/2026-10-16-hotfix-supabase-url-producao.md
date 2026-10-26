# Plano — Hotfix de URL Supabase inválida em produção

**Status:** hotfix web publicado em 16/10/2026; deployment `dpl_6pthSE8R1e2CkaYNuXBxaRxwZBna` está ativo nos domínios públicos.

## Objetivo

Eliminar a tela preta causada por `Invalid supabaseUrl` e impedir que uma variável `VITE_SUPABASE_URL` preenchida com formato inválido derrube a inicialização inteira do app. Reaplicar, na mesma candidata isolada, as alterações de Kanban já aprovadas e cuja promoção foi revertida após o incidente.

## Diagnóstico e estado atual

- A falha ocorre na inicialização do cliente Supabase, antes da renderização React.
- A variável de produção `VITE_SUPABASE_URL` está presente, mas não é uma URL HTTP(S) válida. A cópia temporária de ambiente foi analisada por indicadores, sem exibir valores.
- O código atual aceita qualquer texto não vazio vindo da variável e passa o valor para `createClient`; por isso a URL inválida provoca a exceção global.
- A produção foi revertida para o deployment anterior ao incidente. `https://www.mercuriocapitalsa.com.br/` e `/admin/kanban` respondem HTTP 200. O Kanban Pré-aprovado permanece fora do site enquanto durar esse rollback.

## Documentação consultada

- Instruções `AGENTS.md` fornecidas pelo usuário.
- `docs/README.md`.
- `docs/operacao/change-management.md`.
- `docs/operacao/release-checklist.md`.
- `docs/operacao/security-checklist.md`.
- `app/vercel.json` e `app/vite.config.ts`.
- `prompts/2026-10-16-kanban-standby-pre-aprovado.md`.

## Código e configuração inspecionados

- `app/src/lib/supabaseConfig.ts`: resolução atual de URL e chave de fallback.
- `app/src/lib/supabase.ts`: criação do client Supabase na inicialização.
- `app/src/test/supabaseConfig.test.ts`: testes existentes de variáveis e fallbacks.
- `app/package.json`: scripts de lint, typecheck, testes e build.
- Configuração de variáveis do projeto Vercel; somente nomes/metadados foram consultados.
- Candidata isolada `/tmp/mercurio-kanban-pre-aprovado-20261016`, que contém apenas o escopo de Kanban previamente aprovado, a migration já aplicada e seu smoke.

## Decisões e suposições

- A URL canônica de produção continua sendo a já definida em `DEFAULT_PROD_SUPABASE_URL` no código.
- Atualizar somente a variável Production `VITE_SUPABASE_URL` para essa URL canônica. Não alterar `VITE_SUPABASE_ANON_KEY` nem outras variáveis.
- Validar que a URL configurada use protocolo HTTP(S) e possa ser interpretada pela API `URL`. Se inválida, usar o par de fallback correspondente ao ambiente e registrar apenas aviso sem imprimir valores de configuração.
- Reaplicar a candidata isolada aprovada para recuperar as mudanças de Standby/Pré-aprovado; não incluir os demais arquivos locais fora do escopo.
- A migration do Kanban já foi aplicada e aprovada; este hotfix não cria nem aplica migration.
- Não alterar canais Electron, mobile, política de privacidade ou outros módulos.

## Arquivos esperados

- `app/src/lib/supabaseConfig.ts`.
- `app/src/test/supabaseConfig.test.ts`.
- Este plano.
- Variável de ambiente Production `VITE_SUPABASE_URL` no projeto Vercel.
- Candidata isolada Kanban em `/tmp/mercurio-kanban-pre-aprovado-20261016` com os dois arquivos de código atualizados.

## Critérios de aceite

1. URL HTTP(S) válida e chave presente continuam sendo usadas sem fallback.
2. URL inválida (sem esquema, protocolo incorreto ou URL malformada) não causa exceção na inicialização; usa fallback apropriado ao ambiente.
3. Testes cobrem URL válida, ausente e inválida, preservando os fallbacks locais e de produção.
4. A variável Production `VITE_SUPABASE_URL` fica configurada com a URL canônica do projeto Supabase.
5. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `git diff --check` passam na candidata.
6. O bundle candidato contém somente URL Supabase HTTP(S) válida e não contém service-role key.
7. Após aprovação de publicação, Vercel promove a candidata ao domínio, e `/`, `/admin/kanban`, `/p/kanban` e `/admin/propostas` respondem HTTP 200; os assets referenciados também carregam.
8. As alterações aprovadas de Standby e Pré-aprovado voltam a constar na versão publicada.

## Segurança e limites

- Preservar a chave anon existente; nenhuma service-role key deve ser introduzida no cliente.
- Não imprimir, registrar ou incluir valores de variáveis de ambiente em logs, diffs ou documentação.
- O arquivo temporário obtido via `vercel env pull` deve permanecer com permissão restrita e ser apagado ao concluir.
- Nenhuma escrita de proposta, chamada de teste a lead ou alteração de dados é necessária.
- A publicação é somente web; nenhum artefato desktop/mobile será criado ou publicado.

## Testes manuais e automáticos

- Executar teste unitário de `supabaseConfig` e a suíte Vitest completa.
- Executar lint, typecheck, build web e `git diff --check` na candidata isolada.
- Confirmar em modo produção que a resolução da configuração devolve URL válida mesmo quando a variável simulada contém formato inválido.
- Após promoção autorizada, conferir headers HTTP e carregamento dos assets em rotas públicas e rotas SPA admin/parceiro. Não declarar validação visual autenticada sem navegador conectado.

## Rollout e rollback

- Atualizar a configuração Production e construir novamente a candidata isolada.
- Se build ou smoke falhar, não promover; manter produção no deployment restaurado.
- Se o smoke pós-promoção detectar erro, executar rollback Vercel ao deployment restaurado (`dpl_EQYstrvmyYEnWdbppHFAGfqavvje`) e investigar sem alterar o banco.
- A alteração Supabase é somente de configuração; não há migration nem mudança de dados.

## Resultado da execução (2026-10-16)

- A função `resolveSupabaseConfig` agora valida a URL com `new URL`, aceita somente HTTP(S) com host e rejeita credenciais embutidas. URL não vazia, mas inválida, usa o par de fallback correspondente ao ambiente; isso evita passar o valor inválido ao `createClient` e evita misturar a chave do ambiente com outro projeto.
- Foram adicionados testes para URL sem esquema, protocolo não HTTP(S) e URL malformada. Teste focado: 1 arquivo/6 testes aprovados.
- Vercel confirmou a sobrescrita de `VITE_SUPABASE_URL` no ambiente Production como variável sensível; `VITE_SUPABASE_ANON_KEY` não foi alterada. A leitura de retorno da CLI não permitiu verificar o valor em texto claro. A candidata publicada usa o fallback canônico validado, e a mesma proteção impede que uma variável inválida volte a derrubar a inicialização.
- Verificações da candidata isolada: lint com zero erros e 38 avisos preexistentes; typecheck aprovado; Vitest 21 arquivos/80 testes aprovados; `npm run build` e `vercel build --prod` aprovados; `git diff --check` aprovado.
- O bundle publicado contém a URL canônica, a lógica de `Pré-aprovado`, e não contém marcador `sb_secret_` nem JWT de service role. 38 assets JavaScript/CSS públicos foram carregados e seus SHA-256 corresponderam aos arquivos da candidata.
- Deployment Vercel `dpl_6pthSE8R1e2CkaYNuXBxaRxwZBna` está `READY` e foi promovido. `vercel alias list` confirma `www.mercuriocapitalsa.com.br` e `mercuriocapitalsa.com.br` associados a esse deployment.
- Smoke HTTP pós-deploy: `/`, `/admin/kanban`, `/p/kanban`, `/admin/propostas`, `/admin/leads/simulacoes` e `/p/login` responderam 200; o domínio apex redireciona para `www` com 308. Os 38 assets JS/CSS do bundle foram baixados e comparados por hash.
- Durante a primeira tentativa de build na subpasta, a CLI criou um projeto vazio Vercel chamado `app`; ele foi removido imediatamente antes de qualquer deployment. A listagem final de projetos não contém esse projeto.
- Não houve teste visual ou autenticado em navegador nesta sessão. A tela preta foi causada na inicialização, e o smoke executado cobre a produção HTTP, os assets exatos publicados e os testes unitários da resolução Supabase; o fluxo após autenticação permanece sem validação visual.
- Arquivos temporários de ambiente foram removidos após a verificação. Nenhuma migration, escrita de dados, release desktop ou publicação mobile foi feita.
