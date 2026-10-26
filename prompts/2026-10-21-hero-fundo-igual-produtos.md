# Plano: igualar o fundo do Hero ao de Produtos

## Objetivo
Fazer o fundo do Hero de originação de crédito imobiliário usar exatamente o mesmo tratamento visual da seção Produtos, que aparece logo abaixo dele.

## Skills e documentos lidos
- `docs/README.md`
- `docs/operacao/change-management.md`
- Nenhuma skill adicional é necessária para este ajuste visual na stack existente.

## Código inspecionado
- `app/src/pages/Landing.tsx`: Hero `#home-hero`, chamada `AtmosphereBackground` e a seção Produtos imediatamente abaixo.
- `app/src/index.css`: fundos de `#produtos.products-showcase`, incluindo grade, base preta e pseudo-elemento com brilho radial vermelho.

## Decisões e suposições
- “Sessão de baixo” significa a seção Produtos, imediatamente após o Hero.
- Reproduzir no Hero as mesmas camadas de fundo de Produtos: linhas brancas em 3.5% sobre `#050505`, brilho radial vermelho à direita e gradiente lateral escuro.
- Usar 47 px no desktop e 36 px em telas até 600 px, como Produtos.
- Remover do Hero a camada decorativa própria anterior, para que não haja sobreposição ao fundo compartilhado.
- Preservar conteúdo, cards, espaçamento, animações, footer e os demais componentes.

## Arquivos esperados
- `app/src/pages/Landing.tsx`
- `app/src/index.css`
- `prompts/2026-10-21-hero-fundo-igual-produtos.md`

## Requisitos e critérios de aceite
- Hero e Produtos usam declarações idênticas para fundo, pseudo-elemento, camadas e opacidade da grade em desktop e mobile.
- Fundo é preto `#050505`, quadriculado de 47 px desktop / 36 px mobile, com o mesmo brilho vermelho e gradiente lateral da seção Produtos.
- A atmosfera do footer continua inalterada.
- Cards e conteúdo do Hero permanecem intactos.

## Modelo de dados
Não aplicável; sem persistência ou registros.

## Segurança e impactos
- Alteração visual local no frontend, sem dados, APIs, permissões ou dependências novas.
- Banco, migrations, Edge Functions, mobile, Electron, segurança/compliance e publicação: não afetados.

## Testes
- Executar lint, typecheck e build do app.
- Verificar no servidor local que o Hero e Produtos renderizam os mesmos valores de grade e as mesmas camadas de fundo.
- Revisar o diff e conferir ausência de mudanças no footer ou nos cards.

## Rollout e rollback
- Alteração local, sem deploy ou release.
- Reverter as regras/classes específicas do Hero e restaurar o fundo anterior.
