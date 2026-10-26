# Plano: CTA de download na home

## Objetivo

Atualizar a seção CTA Download da `Landing.tsx` para seguir o componente e o CSS de referência fornecidos, mantendo a identidade escura e vermelha da Mercúrio. A CTA será um único acesso à rota existente `/download`; a seleção do sistema, consulta aos assets e download permanecem exclusivamente nessa rota.

## Skills e documentos lidos

- Nenhuma skill adicional é necessária para esta alteração de UI na stack existente.
- `docs/README.md`
- `docs/operacao/change-management.md`
- `docs/operacao/release-checklist.md`

## Código e configuração inspecionados

- `app/src/pages/Landing.tsx`: seção CTA atual, `DesktopAppMetalCard`, imports e link existente para `/download`.
- `app/src/pages/Download.tsx`: detecção de sistema, consulta à release e links reais por sistema/arquitetura.
- `app/src/router.tsx`: rota `/download`.
- `app/src/index.css`: estilos globais e estilos locais do carrossel da home.
- `app/package.json`: scripts disponíveis para lint, typecheck, testes e build.

## Decisões e suposições

- A CTA não terá seletor de Windows/macOS/Linux, estado de sistema ativo, versão ou tamanho de arquivo. Esses dados e ações pertencem à página `/download`, que já é a fonte real do fluxo.
- O botão principal será um `Link` para `/download`, com texto que indique acesso aos downloads.
- A área visual do app será ilustrativa e não fará consultas nem exibirá dados operacionais. Os elementos decorativos serão ocultos de leitores de tela.
- Os estilos serão prefixados e limitados à CTA para evitar efeitos globais sobre outras telas. Não serão importadas fontes globais nem adicionadas dependências.
- O ajuste será somente local; publicação/deploy não faz parte deste plano.

## Arquivos esperados

- `app/src/pages/Landing.tsx`
- `app/src/index.css`

## Requisitos e critérios de aceite

- A seção segue a referência visual fornecida: fundo escuro texturizado, destaque vermelho, conteúdo promocional e visual do aplicativo em destaque.
- Layout responsivo em desktop e mobile, sem overflow horizontal.
- Uma única CTA navega para `/download`; o fluxo existente dessa página permanece funcional e sem alterações.
- Não há seleção duplicada de sistema nem informações estáticas de versão/tamanho no CTA.
- Foco de teclado visível e animações reduzidas quando `prefers-reduced-motion` estiver ativo.
- Estilos novos não afetam elementos fora da seção.

## Segurança e dados

- Nenhum acesso a Supabase, token, API, release privada ou dado pessoal será adicionado à Landing.
- O link usa a navegação interna existente do React Router.

## Testes

- Automáticos: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, executados em `app/`.
- Manual no navegador: conferir a seção em desktop e mobile; validar foco por teclado e que a CTA abre `/download`; confirmar que a rota continua exibindo sistemas e downloads reais.

## Rollout e rollback

- Rollout: alteração local para revisão. Nenhum deploy ou release será feito neste escopo.
- Rollback: reverter somente o diff da CTA em `Landing.tsx` e seus estilos prefixados em `index.css`, preservando alterações preexistentes nos arquivos.
