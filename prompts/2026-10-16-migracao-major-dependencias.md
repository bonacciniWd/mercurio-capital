# Plano — migração major de dependências para desbloquear Preview CPC

**Status:** plano preparado em 16/10/2026; aguarda aprovação para implementação. Nenhuma versão ou código foi alterado por este plano.

## Objetivo

Resolver os achados de segurança que bloqueiam o Preview isolado da Política de Privacidade e da rota Crédito para Construção (CPC), mantendo React 18, o roteamento atual, a aparência da Mercúrio e o escopo aprovado. A execução deve ocorrer numa candidata isolada; as 145 alterações locais em `main` não entram nessa publicação.

## Skills e documentos consultados

- `AGENTS.md` fornecido pelo usuário: plano antes do código, segurança server-side, stack atual, critérios de testes e aprovação prévia.
- `docs/README.md`: estrutura e stack do projeto.
- `docs/operacao/change-management.md`: isolamento, gates e mudança major.
- `docs/operacao/release-checklist.md`: critérios de auditoria e publicação.
- `docs/operacao/security-checklist.md`: verificação de dependências e bloqueios Critical/High.
- `prompts/2026-10-16-prontidao-producao-politica-cpc.md`: candidata CPC e bloqueios já registrados.
- `docs/operacao/politica-privacidade-publica.md` e `docs/operacao/leads-publicos-cpc.md`: conteúdo e configuração de captura.
- Documentação oficial consultada: [guia de migração Tailwind CSS v3→v4](https://tailwindcss.com/docs/upgrade-guide), [instalação oficial Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite), [documentação e changelog do React Router](https://reactrouter.com/start/start/changelog) e [migração electron-builder v26→v27](https://www.electron.build/docs/migration/v26-to-v27/).
- Nenhuma skill externa específica se aplica.

## Código, configuração e evidência inspecionados

- `app/package.json`, `app/package-lock.json`, `app/tailwind.config.js`, `app/postcss.config.js`, `app/vite.config.ts`, `app/src/index.css` e `app/electron-builder.json`.
- `app/src/router.tsx`, `app/src/main.tsx`, guards de autenticação/admin e imports do `react-router-dom`.
- Código da candidata isolada `/tmp/mercurio-policy-cpc-20261016`, baseada no commit `3e3d8fa`, contendo apenas política, CPC, roteamento/teste correspondentes e lockfile com correções transitivas compatíveis.
- `npm audit` executado no checkout local em 16/10: 26 achados (2 Critical, 9 High, 14 Moderate e 1 Low). Na candidata, `npm audit fix` sem `--force` e instalação limpa reduziram o total para 17 (0 Critical, 5 High, 12 Moderate); os cinco High restantes apontam para a cadeia do Tailwind CSS 3 e correção major para Tailwind 4. O audit de runtime da candidata mantém dois Moderate do React Router 6.
- A configuração Tailwind mantém cores/fonte/sombra próprias no JS, dark mode por mídia e CSS global com `@apply`, `@layer`, estilos globais de botões e diretivas `@tailwind`. A migração precisa preservar esses tokens e a cascata visual.
- O app usa o Data Router (`createBrowserRouter` e `createHashRouter`), guards aninhados, `RouterProvider`, rotas lazy, links e hooks de navegação. Não foi encontrada conversão para framework mode como requisito deste escopo.
- O `electron-builder` atual está declarado em `^26.15.3`. O audit da candidata lista achados Moderate nessa árvore e sugere uma versão 26.5.0, inferior à declarada. A sugestão não será aplicada sem investigar o advisory e o efeito em empacotamento.
- Não há `AGENTS.md` nem `README.md` na raiz do checkout; `docs/README.md` é o índice local do projeto.

## Decisões e limites

1. Trabalhar somente em cópia/worktree isolada da candidata CPC, nunca sobrepor ou limpar a pasta `main` com 145 caminhos alterados.
2. Aplicar primeiro apenas as correções transitivas compatíveis já demonstradas por `npm audit fix` sem `--force`, revisando o lockfile.
3. Migrar Tailwind CSS 3 para 4 usando o plugin oficial para Vite e os ajustes necessários em `vite.config.ts`, CSS e configuração de tema. O codemod oficial poderá ser usado somente após aprovação e seu diff será revisado manualmente.
4. Atualizar o React Router para uma versão corrigida da linha 7, validada pelo audit no início da implementação. Preservar React 18 e o Data Router atual; não adotar React Router 8, React 19, Framework Mode ou novas APIs de servidor nesta mudança.
5. Manter a árvore `electron-builder` fora do escopo de implementação do Preview web. Os Moderate restantes serão documentados por advisory e cadeia. Não fazer downgrade automático para 26.5.0 nem atualizar para electron-builder 27; uma mudança do empacotador exige plano próprio, build e validação dos três sistemas operacionais.
6. Confirmar, antes de efetivar Tailwind 4, que os navegadores oficialmente suportados pela Mercúrio atendem ao mínimo declarado pelo Tailwind 4 (Safari 16.4, Chrome 111 e Firefox 128). Se houver exigência de suporte anterior, parar e apresentar alternativa antes do código.
7. Não incluir alterações de outras telas, PDFs, configurações financeiras, leads internos ou dashboard. Não alterar banco, migrations, Edge Functions, configuração remota ou dados.
8. O Preview CPC já autorizado continua limitado às rotas de Política/CPC. Não publicar produção, não habilitar `cpc_captura_publica_ativa`, não enviar formulário, e-mail ou mensagem, e não criar/releasear artefatos Electron.

## Arquivos esperados

- `app/package.json` e `app/package-lock.json` — dependências corrigidas e reproduzíveis.
- `app/vite.config.ts` e `app/postcss.config.js` — integração Tailwind 4 com Vite, removendo configuração obsoleta que não for mais necessária.
- `app/tailwind.config.js` e `app/src/index.css` — tokens, dark mode, importação e CSS compatíveis, preservando as regras globais existentes.
- Componentes sob `app/src/` — somente os ajustes de classes/utilitários que o processo de migração demonstrar necessários.
- `app/src/router.tsx`, `app/src/main.tsx` e imports de roteamento — somente ajustes comprovadamente necessários para React Router 7.
- Testes de regressão estritamente necessários e este plano com resultados reais.

## Critérios de aceite

1. `npm ci --include=dev` instala a candidata de forma limpa e reproduzível.
2. `npm audit` da candidata termina sem Critical ou High; todos os Moderate/Low restantes são listados por pacote, cadeia, exposição no Preview web e justificativa. Não se aceita vulnerabilidade sem identificação.
3. A auditoria de runtime não tem High/Critical. Achados Moderate do roteador só permanecem se o audit atualizado os classificar assim e seu risco estiver registrado.
4. Rotas públicas CPC e Política continuam acessíveis por URL direta e navegação SPA; `/p/login`, `/admin/login` e rotas protegidas não perdem seus guards nem alteram destino/permissões.
5. `createHashRouter` continua funcional no modo desktop e `createBrowserRouter` no site. Não se muda contrato ou regra de autorização.
6. Os componentes mantêm a aparência aprovada: cores, fontes, botões, campos, foco, breakpoints, dark mode e impressão. A compilação CSS não pode omitir classes montadas dinamicamente.
7. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run validate:release` passam; avisos preexistentes são distinguidos de regressões.
8. Smoke em Chrome/viewport desktop e mobile percorre `/`, `/simulador`, `/credito-para-construcao` e `/politica-de-privacidade`; valida cabeçalho/rodapé, navegação, estilos, estados de formulário, foco e ausência de overflow. Testes não submetem formulários.
9. O Preview não altera a publicação de produção, banco, função CPC nem flag de captura. A validação confirma a resposta desativada sem enviar dados ao endpoint.

## Segurança e privacidade

- Fazer instalação e atualização em worktree isolada, preservando o checkout original e evitando incluir as 145 alterações locais no artefato CPC.
- Não usar `npm audit fix --force`; não aceitar avisos com base somente na ausência de exploração conhecida.
- Não expor `.env`, tokens, chaves públicas/privadas além das necessárias ao build, nem valores secretos em logs ou bundle.
- Não testar POST CPC, inserir lead, enviar e-mail ou alterar configuração Supabase.
- Não atualizar Electron/electron-builder por conveniência de auditoria web; manter a distribuição desktop fora do artefato e submeter vulnerabilidades do empacotador a avaliação separada.

## Testes manuais e automáticos

- Antes/depois: registrar versões resolvidas, `npm audit --json`, árvore dos advisories e diff do lockfile.
- Automáticos: instalação limpa, suíte completa Vitest, lint, typecheck, build web e `validate:release`.
- Regressão de rotas: URL direta, refresh, redirects de login, guards por papel, query strings e modo hash desktop.
- Visual: comparar screenshots antes/depois em Chrome desktop e mobile, incluindo páginas públicas e um fluxo autenticado administrativo se o acesso de teste estiver disponível.
- Vercel Preview CPC: depois dos gates locais, criar o Preview dentro da autorização anterior; sem produção. Smoke visual sem submissão do formulário.
- Não executar build/signing/notarização de Windows, Linux ou macOS neste plano.

## Rollout e rollback

- Implementar em candidata isolada; manter a branch `main` intacta.
- Se lint/test/build, audit High/Critical ou fidelidade visual falharem, não enviar Preview. Reverter somente a candidata.
- Se Preview autorizado apresentar regressão, descartar o Preview e manter o domínio de produção no deployment atual. Nenhuma migration ou rollback de dados é necessário.
- Produção, ativação CPC, release Electron e publicação de instaladores exigem planos e GO específicos posteriores.

## Aprovação registrada

O usuário autorizou preparar este plano de migração major. A implementação das dependências aguarda aprovação explícita deste documento.
