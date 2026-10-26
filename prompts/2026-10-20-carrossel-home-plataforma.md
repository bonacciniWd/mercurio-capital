# Plano — carrossel da seção Plataforma na Landing

## Objetivo

Atualizar visualmente a seção `#plataforma` da página inicial para seguir o carrossel de referência enviado: fundo escuro em grade com luzes ambientais, título e apoio em duas colunas, cards horizontais com slide ativo destacado, navegação por progresso e controles anterior/próximo. Manter o conteúdo atual da Mercúrio e o restante da Landing.

## Skills e documentos lidos

- Nenhuma skill especializada se aplica a esta mudança de UI em React.
- `docs/README.md` — convenções e stack do projeto.
- `docs/operacao/change-management.md` — plano, escopo e gate de publicação.
- `docs/operacao/release-checklist.md` — publicação é um gate separado.
- `docs/design/05-visual-map.md` — contexto da landing pública e rotas.
- Instruções `AGENTS.md` fornecidas nesta conversa.

## Código inspecionado

- `app/src/pages/Landing.tsx`: seção `#plataforma`, cards atuais, animações GSAP e estrutura da Landing.
- `app/src/index.css`: estilos globais atuais.
- `app/src/hooks/useFeatureFlag.ts`: feature flags existentes.
- `app/package.json`: scripts disponíveis para lint, typecheck, testes e build.

## Decisões e suposições

- “Flag de plataforma” será interpretada como a seção da Landing identificada pelo `id="plataforma"`. A inspeção não encontrou uma feature flag de banco aplicada a essa seção; este ajuste não criará nem modificará flags.
- O pedido é para aplicar o CSS e comportamento visual do exemplo. Os seis títulos, descrições e ícones atuais serão preservados; não serão importados textos do exemplo que descrevem integrações ou capacidades diferentes.
- O carrossel terá autoplay de 5 segundos, pausa ao passar o mouse ou focar controles, navegação por teclado, toque/swipe e suporte a `prefers-reduced-motion`, conforme o exemplo.
- Os estilos serão escopados à seção/componente. Não serão alterados `:root`, `body`, headings ou botões globais, e nenhuma dependência será adicionada.
- O conteúdo será responsivo: cards laterais parcialmente visíveis em telas largas e um card principal no mobile, com controles acessíveis.
- Nenhuma mudança em banco, Supabase, rotas, backend, Electron ou publicação está no escopo.

## Arquivos esperados

- `app/src/pages/Landing.tsx` — substituir a grade de cards da seção por carrossel, mantendo o conteúdo existente.
- `app/src/index.css` — adicionar apenas classes CSS prefixadas/específicas da seção Plataforma, sem regras globais.

## Requisitos e critérios de aceite

- A seção mantém o título e a mensagem já publicados e apresenta os seis recursos atuais como slides.
- Em desktop, o slide ativo é nítido e maior, com slides adjacentes visíveis parcialmente; o cabeçalho e o rodapé de progresso/controles seguem a referência.
- Fundo da seção em tons de carvão e preto, compatível com o restante da Landing, com brilho vermelho discreto; a altura da seção acompanha o conteúdo e não reserva uma tela vazia abaixo do carrossel.
- O carrossel permanece centralizado horizontalmente em desktop e mobile.
- Em mobile, um slide é legível sem overflow horizontal da página; os controles de progresso e navegação continuam utilizáveis por toque.
- Autoplay avança a cada cinco segundos e pausa quando o carrossel está sob interação/foco; botões, progresso, setas do teclado e gesto horizontal permitem selecionar slides.
- `aria-label`, `aria-current`, descrição de carrossel e estado dos slides preservam acessibilidade. Movimento reduzido desativa transições/animação automática.
- O restante da Landing, o simulador embutido, a navegação e a renderização atual da seção permanecem funcionais.

## Considerações de segurança

- Mudança exclusivamente visual/client-side, sem acesso ou gravação de dados, credenciais, endpoints ou permissões.
- Não incluir tokens, dados pessoais ou novos scripts externos.
- Usar imagens já aprovadas/fornecidas para os slides e texto alternativo adequado; verificar disponibilidade e evitar quebrar layout quando imagem falhar.

## Testes

- Automáticos: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` em `app/`.
- Manuais no navegador: Landing em desktop e mobile; avanço automático, pausa por hover/foco, setas anterior/próximo, clique no progresso, setas do teclado, swipe e preferência de movimento reduzido.
- Regressão visual: confirmar que a seção do simulador, hero, produtos e footer não recebem os estilos da seção Plataforma.

## Rollout e rollback

- Sem deploy nesta etapa. Publicação só será considerada em uma solicitação/gate separado.
- Rollback local: reverter os dois arquivos da implementação, preservando quaisquer alterações preexistentes do usuário nesses arquivos.
