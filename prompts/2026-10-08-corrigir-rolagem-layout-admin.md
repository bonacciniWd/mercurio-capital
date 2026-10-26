# Plano — corrigir rolagem e altura do layout administrativo

## Objetivo

Impedir que a rolagem da área administrativa mova o documento inteiro, corte o conteúdo no meio da viewport ou revele uma faixa vazia, como mostra a captura enviada.

## Documentos/código inspecionados

- Instruções `AGENTS.md` fornecidas na conversa.
- `app/src/layouts/AdminLayout.tsx`.
- `app/src/index.css` (`html`, `body` e `#root`).
- `app/src/layouts/PartnerLayout.tsx` como comparação de layout com navegação e área de conteúdo.
- Captura do dashboard enviada pelo usuário.

## Diagnóstico

- Admin usa `h-screen overflow-hidden` no contêiner, mas os itens flex da hierarquia não declaram `min-h-0`; os filhos podem impor altura mínima baseada no conteúdo em alguns cenários, causando overflow/deslocamento fora da área esperada.
- O conteúdo deve rolar dentro do painel central, mantendo cabeçalho e menu lateral estáveis.

## Implementação proposta

- Usar altura dinâmica da viewport (`h-dvh`) no shell e na barra lateral para refletir a área visível atual do navegador.
- Adicionar `min-h-0 min-w-0` aos itens flex centrais e ao painel rolável para que o conteúdo possa encolher e rolar dentro do espaço disponível.
- Conter overscroll no painel de conteúdo, evitando propagação para o documento.
- Preservar a rolagem independente da navegação lateral, o cabeçalho fixo, os estilos e as permissões atuais.

## Arquivos esperados

- `app/src/layouts/AdminLayout.tsx`

## Critérios de aceite

- Shell ocupa a altura visível da janela, inclusive após mudança de viewport.
- Somente o conteúdo central rola; menu e cabeçalho permanecem no lugar.
- Ao rolar até o início/fim do conteúdo, o layout não se desloca para uma área vazia abaixo.
- Navegação lateral continua rolável quando necessário.

## Segurança

- Alteração de layout; sem mudanças em dados, autenticação, permissões ou serviços.

## Testes

- Typecheck, lint, testes do app e `git diff --check`.
- Conferência visual no navegador desktop em rolagem até o fim e retorno ao topo.

## Aprovação

Plano aprovado pelo usuário antes da implementação.

## Resultado da implementação

- Shell administrativo e menu lateral usam a altura dinâmica `100dvh`.
- Contêineres flex centrais e painel de conteúdo têm limites mínimos explícitos; overscroll fica contido no painel principal.
- Typecheck passou.
- Lint passou com 38 avisos preexistentes e nenhum erro.
- Testes passaram: 30 arquivos, 111 testes.
- Build de produção passou; Vite emitiu o aviso preexistente de chunk maior que 500 kB.
- `git diff --check` passou.
- O navegador local foi usado para testar a rolagem sobre a lateral e sobre o conteúdo central.

## Reprodução no navegador e correção adicional

- A rolagem com o ponteiro sobre a lateral reproduziu o defeito: o menu tinha `scrollHeight` igual ao `clientHeight`, então a roda propagava para o documento, cujo `scrollHeight` era 2005px para uma viewport de 1008px. O shell inteiro deslocava aproximadamente 997px.
- O layout agora bloqueia rolagem no `html` e `body` enquanto `AdminLayout` está montado, restaurando os estilos anteriores ao sair; a lateral contém overflow e overscroll e pode rolar internamente se necessário.
- Após repetir o gesto sobre a lateral, `window.scrollY` permaneceu em 0 e a página continuou no topo. Rolando sobre o conteúdo central, seu `scrollTop` chegou a 1344 enquanto `window.scrollY` permaneceu 0.
- Validações após a correção: typecheck passou; lint passou com 38 avisos preexistentes e nenhum erro; 30 arquivos de teste/111 testes passaram; build passou com aviso preexistente de chunk >500 kB; `git diff --check` passou.
