# Landing — seção de crédito para construção

Data: 21/10/2026. Status: aprovado, implementado e validado localmente.

## Objetivo

Adicionar uma seção editorial na home, imediatamente depois de Plataforma e antes de CTA Download, apresentando o CPC e direcionando para `/credito-para-construcao`.

## Documentos, skills e código inspecionados

- Instruções AGENTS.md fornecidas na conversa e `docs/operacao/change-management.md`.
- Componente/CSS de referência fornecidos nesta solicitação.
- `app/src/pages/Landing.tsx`: ordem Produtos → Plataforma → Download.
- `app/src/pages/CreditoParaConstrucao.tsx`: conteúdo e público atuais do CPC.
- `app/src/router.tsx`: destino público já existente.
- Catálogo de assets locais, stack React/Tailwind atual e CSS da Landing já inspecionados nesta sessão.
- Sem skill específica necessária; usar componentes e ferramentas existentes.

## Decisões e premissas

- Aproveitar somente o hero editorial do exemplo: fundo claro, duas colunas, título serifado com destaque vermelho, texto, CTA, imagem vertical com faixa lateral e card sobreposto.
- Criar uma `section` com `h2` (a página já tem `h1`), sem novo `main`, header ou footer.
- Reproduzir proporções, cores e tipografia DM Sans/Instrument Serif de forma isolada nesta seção. Não aplicar resets globais, `:root`, `@theme`, `@import tailwindcss` ou classes genéricas do exemplo.
- Usar a imagem de arquitetura fornecida no componente; validar carregamento real. Se falhar, registrar e utilizar uma imagem de arquitetura já usada na página CPC, sem adicionar dependências.
- Usar React Router `Link` para o destino exato `/credito-para-construcao`, com CTA “Conhecer crédito para construção”.
- Não criar as seções Metrics/Solutions/Approach/Principle/Contact do CSS: não fazem parte do JSX solicitado para a chamada da home.
- Não transportar as métricas financeiras, prazo de resposta, operação de US$ 18,4M, localidades ou afirmação de concessão direta do exemplo estrangeiro.

## Texto proposto

- Chamada: “Crédito para construção”.
- Título: “Capital para construir. Estrutura para ir além.”, com segunda frase em itálico vermelho.
- Descrição: “Crédito estruturado para construtores e investidores que desenvolvem casas de alto padrão, com análise do projeto e possibilidade de liberação por etapas.”
- CTA: “Conhecer crédito para construção” → `/credito-para-construcao`.
- Linha inferior: “Construtores e investidores · Casas de alto padrão · Análise do projeto”.
- Card sobreposto: “Crédito estruturado / Do projeto à obra / Condições definidas por operação”.
- Faixa lateral: “Mercúrio Capital · Crédito para construção”.

## Arquivos esperados

- `app/src/pages/Landing.tsx`: importar e posicionar a nova seção.
- `app/src/components/LandingConstructionSection.tsx`: componente da seção.
- `app/src/components/landing-construction-section.css`: apenas estilos usados, com prefixo exclusivo.

## Modelo de dados, segurança e impactos

- Conteúdo estático; nenhuma tabela, campo, RPC, migration ou alteração de persistência.
- Frontend público afetado; backend, Serasa, formulários/leads e área admin não afetados.
- Mobile Expo não afetado. Electron pode renderizar a home compartilhada; empacotamento e updater não mudam.
- Sem credenciais, dados pessoais, captura ou disparos externos; imagem e fontes são recursos públicos.
- Preservar todas as alterações locais anteriores. Publicação exige autorização separada.

## Critérios de aceite

1. Ordem da home: Plataforma → Crédito para construção → CTA Download.
2. Aparência segue o bloco editorial da referência, com texto em português e conteúdo consistente com o CPC existente.
3. CTA navega à rota existente, sem formulário novo ou destino fictício.
4. Imagem carrega, tem texto alternativo e mantém proporção/corte adequados.
5. Desktop em duas colunas; mobile empilhado, sem corte do título, do botão ou overflow horizontal.
6. Foco visível, contraste, semântica e redução de movimento preservados.
7. CSS da seção não altera Hero, Produtos, Plataforma, CTA Download ou telas internas.

## Verificações

- Lint, typecheck e build em `app/`.
- Navegador: conferir ordem, imagem, navegação e layout desktop/mobile; verificar carregamento dos assets e ausência de overflow.
- Testes automatizados somente se necessários para comportamento além do link e apresentação estática; não criar testes que apenas espelhem o JSX.

## Rollout/rollback

Implementação e revisão local após aprovação. Sem deploy nesta etapa. Rollback limitado à importação/inserção da seção e seus arquivos novos.

## Evidências da implementação

- Criados componente e CSS exclusivos; seção inserida depois de Plataforma e antes de Download.
- Imagem fornecida respondeu HTTP 200; Chrome confirmou imagem carregada (1400 px) e Instrument Serif disponível.
- Chrome confirmou a ordem das seções e navegação pelo CTA para `/credito-para-construcao`, com título e h1 esperados. Nenhum formulário foi enviado.
- Medições do conteúdo/estilos em iframes de 320, 390, 768 e 1440 px: sem overflow horizontal e botão contido; uma coluna até 900 px, duas no desktop. Essas medições não substituem smoke em dispositivo físico.
- Lint sem erros, com 38 avisos preexistentes.
- Sem testes novos que apenas espelhem JSX estático; navegação e carregamento verificados no navegador. Sem deploy.

- Typecheck e build concluídos com sucesso. Build mantém aviso de chunks grandes do projeto.

## Imagem própria fornecida pelo produto

Substituição autorizada pela imagem local `app/src/assets/construcao.jpg` (896 × 1200), inspecionada visualmente. Importação pelo Vite, dimensões e texto alternativo atualizados para a residência em construção. Layout e enquadramento central preservados. Sem dependência da imagem Unsplash nesta seção.

Validação da imagem local: HTTP 200 no Vite; Chrome confirmou carregamento 896 × 1200 e object-fit cover. Lint sem erros (38 avisos existentes) e typecheck aprovados.
