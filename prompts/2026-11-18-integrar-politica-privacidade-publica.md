# Plano — integrar a página pública de Política de Privacidade

## Objetivo

Concluir a ligação da Política de Privacidade ao rodapé público da landing page, aproveitando o conteúdo e a rota canônica já existentes. Evitar duplicar ou substituir o texto institucional previamente aprovado.

## Documentos e contexto lidos

- `AGENTS.md` fornecido pelo usuário e `AGENTS.md` do repositório.
- `docs/README.md` — índice e fontes de documentação.
- `docs/operacao/politica-privacidade-publica.md` — conteúdo vigente, identificação institucional e validações existentes.
- `prompts/2026-10-16-ajuste-status-politica-aprovada.md` — registro do texto informado como aprovado juridicamente e do canal de privacidade.
- `prompts/2026-10-16-politica-privacidade-bases-legais.md` — escopo e limites de afirmações sobre tratamento de dados.

## Código inspecionado

- `app/src/pages/public/PoliticaPrivacidade.tsx` — página pública completa existente.
- `app/src/router.tsx` — rota pública `/politica-de-privacidade` já registrada.
- `app/src/pages/Landing.tsx` — rodapé contém link para `/privacy`, ainda sem rota correspondente; alteração local já presente no working tree.
- `app/src/pages/Politica-de-privacidade.tsx` — componente cru recém-criado, ainda não usado pelo roteador.
- Testes existentes em `app/src/test/creditoParaConstrucao.test.tsx`, que já renderizam a página pública.

## Decisões e suposições

- A página existente `PoliticaPrivacidade` e seu texto são a fonte de verdade; a documentação registra que o conteúdo foi informado como aprovado pelo advogado.
- A URL canônica permanece `/politica-de-privacidade`, já documentada para App Store Connect e usada por formulários públicos.
- A edição atual do rodapé em `Landing.tsx` e o componente cru são alterações não rastreadas/locais do usuário; preservar ambas e limitar o diff a sua integração.
- Não reescrever conteúdo jurídico, não acrescentar afirmações sobre fornecedores, retenção ou bases legais e não alterar links de consentimento fora do rodapé.
- Não publicar, fazer deploy ou alterar configurações externas.

## Arquivos esperados

- `app/src/pages/Landing.tsx` — apontar o link do rodapé para a rota canônica.
- `app/src/pages/Politica-de-privacidade.tsx` — substituir o placeholder cru por um adaptador fino para a página pública existente, sem duplicar conteúdo.
- `app/src/router.tsx` — somente se a integração do componente exigir ajuste; preservar a rota canônica.
- `app/src/test/creditoParaConstrucao.test.tsx` ou teste direcionado existente — validar título e navegação/rota conforme a cobertura já estabelecida.
- Este plano, atualizado com resultados depois da aprovação.

## Requisitos e critérios de aceite

1. O link “Política de privacidade” do rodapé abre a política existente.
2. A URL pública canônica `/politica-de-privacidade` continua funcionando diretamente.
3. O componente cru não contém texto placeholder nem cria uma segunda versão do conteúdo.
4. O conteúdo, o e-mail de privacidade e os dados institucionais permanecem exatamente os já documentados.
5. As alterações preexistentes de outras frentes no working tree não são revertidas nem incluídas no escopo.

## Segurança e privacidade

- Sem mudanças de backend, persistência, formulários, consentimentos ou coleta de dados.
- Não adicionar dados pessoais ou novos compromissos jurídicos.
- Não executar envio de e-mail, publicação ou deploy.

## Testes e validação

- Teste direcionado da página/rota pública.
- `npm run lint`, `npm run typecheck` e `npm run test` em `app/`.
- `npm run build` em `app/`, pois o trabalho integra uma rota/link público.
- Smoke em navegador desktop e mobile: abrir a rota canônica diretamente e seguir o link pelo rodapé; confirmar ausência de 404 e conteúdo placeholder.
- Relatar claramente caso o smoke de navegador não esteja disponível neste ambiente.

## Rollout e reversão

- Alteração local, pequena e reversível; sem migration e sem release.
- Reversão: restaurar o href anterior e o placeholder apenas se necessário, preservando todo o restante do working tree.

## Aprovação

Aprovado pelo usuário em 2026-11-18. Implementação local autorizada; publicação e deploy não autorizados.

## Implementação e validação

- `app/src/pages/Politica-de-privacidade.tsx` agora delega para a política pública já existente, sem duplicar texto.
- `app/src/router.tsx` mantém `/politica-de-privacidade` e a renderiza pelo componente solicitado.
- O link no rodapé de `app/src/pages/Landing.tsx` aponta para a rota canônica.
- Teste direcionado cobre o adaptador e confirma o título/data do conteúdo existente.
- `npm run lint` — passou sem erros; 34 avisos preexistentes em outros arquivos.
- `npm run typecheck` — passou.
- `npm run test` — 65 arquivos e 325 testes passaram.
- `npm run build` — passou; mantém o aviso existente de chunks acima de 500 kB.
- Smoke HTTP da build de preview: `/` e `/politica-de-privacidade` responderam `200 text/html` com `#root`.
- Não foi feito deploy nem publicado conteúdo.
- Não foi executado smoke interativo/click em navegador neste ambiente; a renderização do componente foi verificada pelo teste, e o fallback da rota foi verificado via HTTP.
- Revisão read-only do Revisor Mercurio Capital: **aprovado com ressalva baixa**. O revisor confirmou a correspondência entre rota pública, link do rodapé e adaptador; recomendou teste integrado navegando pelo roteador/link e smoke visual em navegador. Não apontou risco crítico ou alto.
- O usuário autorizou em 2026-11-18 o commit e o deploy de produção desta integração. A publicação será direta pela Vercel em checkout isolado, sem push ao GitHub Actions e sem incluir outras alterações locais.

## Commit e deploy autorizados — 2026-11-18

- Commit de código implantado: `57d5b53` (`feat(web): link privacy policy from landing footer`). Apenas os quatro arquivos de código/teste deste escopo foram empacotados junto com este plano inicial; as demais alterações locais permaneceram fora.
- Vercel `mercurio-digital`: deployment `dpl_2ZFoqJNWL8FbL2zizH2znJAgGg76`, estado **Ready**, alias de produção `https://mercuriocapitalsa.com.br` e `https://www.mercuriocapitalsa.com.br`.
- Smoke pós-deploy: `https://mercuriocapitalsa.com.br/politica-de-privacidade` respondeu HTTP 200 e serviu o shell da aplicação. A rota também foi testada localmente por HTTP e a renderização React pelos testes automatizados.
- Deploy foi executado via Vercel CLI a partir de worktree limpo; nenhum push foi feito ao GitHub e nenhum GitHub Action foi acionado.
- O build remoto terminou com sucesso. `npm install` reportou 18 vulnerabilidades (14 moderate, 4 high) no grafo de dependências já existente; nenhuma alteração de dependências foi feita nesta entrega.
- O ajuste local de endereço de contato em `app/src/pages/public/PoliticaPrivacidade.tsx` (`.com.br`) não foi incluído; permanece fora deste commit/deploy, pois diverge do canal `.com` registrado na documentação e no conteúdo aprovado.
