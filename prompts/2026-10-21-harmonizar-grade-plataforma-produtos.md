# Plano — harmonizar a grade do carrossel da plataforma

## Objetivo

Usar no fundo quadriculado do carrossel `#plataforma` os mesmos espaçamentos de grade da seção `#produtos`: 47×47 px no desktop e 36×36 px em telas de até 600 px.

## Skills e documentos lidos

- `AGENTS.md` fornecido nesta conversa.
- `docs/README.md`.
- `docs/operacao/change-management.md`.
- Nenhuma skill específica é necessária para um ajuste pontual de CSS.

## Código inspecionado

- `app/src/index.css`, regra `#plataforma.platform-showcase` e media queries mobile.
- `app/src/index.css`, regra `#produtos.products-showcase` e media query de até 600 px, que definem os valores de referência.

## Decisões e suposições

- “Grade” refere-se somente ao espaçamento do padrão quadriculado.
- Preservar cores, opacidade, fundos, dimensões de cards, conteúdo e comportamento dos dois componentes.
- Fazer a alteração apenas no CSS da plataforma; não modificar a seção de produtos.

## Arquivos esperados

- `app/src/index.css`
- Este plano, atualizado com o resultado das verificações.

## Requisitos e critérios de aceite

- `#plataforma` usa `background-size: 47px 47px` acima de 600 px.
- Em viewport de até 600 px, `#plataforma` usa `background-size: 36px 36px`.
- O valor calculado coincide com `#produtos` nas mesmas larguras.
- Não há mudanças visuais além da frequência da grade nem rolagem horizontal em desktop/mobile.

## Modelo de dados e segurança

Não aplicável. É uma alteração visual local, sem dados, rede, autenticação, permissões ou credenciais.

## Impacto operacional

- Web: landing page afetada.
- Mobile nativo, Supabase, Edge Functions, banco e integrações: não afetados.
- O CSS compõe o bundle da versão web/desktop, sem alterar lógica de build ou empacotamento.
- Sem deploy ou release neste escopo.

## Testes

- Executar `npm run lint`, `npm run typecheck` e `npm run build` em `app/`.
- No Chrome em 390×844 e 1440×900, conferir o valor computado da grade em `#plataforma` e `#produtos` e observar as duas seções sem overflow horizontal.
- Executar `git diff --check`.

## Rollout e rollback

- Implementar localmente após aprovação deste plano.
- Rollback: restaurar os dois valores de `background-size` da regra `#plataforma` e sua media query mobile.
- Publicação Vercel e release desktop permanecem gates separados, conforme `docs/operacao/change-management.md`.

## Resultado da implementação e verificações

- A grade do carrossel da plataforma agora usa 47×47 px no desktop e 36×36 px até 600 px, igual à seção de produtos.
- Chrome conferido em 390×844 e 1440×900: os valores computados coincidem entre as duas seções e não há overflow horizontal.
- `npm run lint`: passou sem erros; permanecem 38 avisos existentes em outros arquivos.
- `npm run typecheck`: passou.
- `npm run build`: passou; Vite manteve o aviso de bundle principal acima de 500 kB após minificação.
- `git diff --check`: passou.
- Sem deploy ou release.
