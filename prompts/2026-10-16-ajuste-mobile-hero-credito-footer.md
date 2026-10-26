# Plano — ajuste mobile do hero CPC e texto do footer

**Status:** implementado e validado localmente; não publicado.

## Objetivo

Na página pública `/credito-para-construcao`, posicionar um pouco mais abaixo o botão de avaliação do projeto no hero mobile, reduzindo o espaço visual sem preenchimento, e remover do footer somente a expressão “Protótipo institucional”.

## Skills e documentos lidos

- `AGENTS.md` fornecido pelo usuário nesta conversa.
- `docs/operacao/change-management.md`.
- `docs/design/10-blueprint-visual.md`.
- Busca de contexto em `MEMORY.md` para convenções desta workspace e validação visual no navegador.

## Código inspecionado

- `app/src/pages/CreditoParaConstrucao.tsx` — CTA do hero e conteúdo atual do footer.
- `app/src/pages/credito-para-construcao.css` — regra mobile de `.cpc-hero-actions`, atualmente com margem superior de 28 px.
- `app/src/test/creditoParaConstrucao.test.tsx` — testes existentes da página.
- `app/package.json` — scripts de teste, lint, typecheck e build.

## Decisões e suposições

- Aplicar o deslocamento apenas dentro do breakpoint mobile (`max-width: 767px`), elevando a margem superior das ações de 28 px para 52 px (+24 px). O ajuste preserva os espaçamentos desktop e a ordem do conteúdo.
- Remover apenas o texto “Protótipo institucional · ” do `<small>` do footer; manter “Imagem ilustrativa” e “Integração com o site oficial pendente”, que comunicam condições ainda relevantes.
- Não alterar copy, CTA, foto, formulário, backend, outras rotas ou o restante do layout.

## Arquivos esperados

- `app/src/pages/credito-para-construcao.css` — espaçamento adicional do CTA no breakpoint mobile.
- `app/src/pages/CreditoParaConstrucao.tsx` — remoção da expressão no footer.
- `prompts/2026-10-16-ajuste-mobile-hero-credito-footer.md` — este plano e o registro final da validação.

## Critérios de aceite

- Em viewport mobile de 390×844, o CTA do hero aparece 24 px mais abaixo que antes, sem criar overflow horizontal nem comprometer o conteúdo do hero.
- O layout desktop permanece igual.
- “Protótipo institucional” não aparece mais no footer; os demais avisos permanecem.
- `/credito-para-construcao` continua renderizando e os testes da página passam.

## Segurança e impacto

- Mudança exclusivamente visual e de texto estático. Sem persistência, novos dados pessoais, permissões, integrações, migrations ou chamadas de rede.
- Web alterada; mobile nativo, banco/RLS, Edge Functions, Electron e artefatos desktop não alterados.
- Nenhum deploy ou release está incluído; publicação exige autorização separada.

## Verificações previstas

- Teste dedicado da página.
- `npm run lint`, `npm run typecheck` e `npm run build` em `app/`.
- Smoke manual em navegador na rota direta, conferindo desktop e mobile (390×844), posição do CTA, footer e ausência de overflow horizontal.

## Rollback

Reverter somente a margem do breakpoint mobile e restaurar o texto removido do footer.

## Aprovação

Plano aprovado pelo usuário em 2026-10-16.

## Implementação e validação

- Em mobile, a margem superior das ações do hero passou de 28 px para 52 px; em Chrome a 390×844, o botão de avaliação desceu 24 px, sem overflow horizontal (largura do documento: 390 px).
- Desktop permaneceu igual: o espaçamento computado continuou em 36 px.
- Footer não exibe mais “Protótipo institucional” e mantém “Imagem ilustrativa” e “Integração com o site oficial pendente”.
- O teste dedicado passou (2 testes); `npm run lint` passou com 38 avisos já existentes em outros arquivos; `npm run typecheck` e `npm run build` passaram. O build mantém o aviso existente de bundle principal acima de 500 kB.
- A inspeção visual em ambiente de desenvolvimento mostrou o botão flutuante do TanStack Query Devtools; ele pertence às ferramentas de desenvolvimento, não ao conteúdo CPC.
- Nenhum deploy ou release foi executado.
