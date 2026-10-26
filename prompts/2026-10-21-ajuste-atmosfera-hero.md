# Plano: suavizar a atmosfera do Hero da home

## Objetivo
Ajustar apenas o fundo visual do Hero “Originação de crédito imobiliário” para reduzir a aparência de shade escuro/vidro e deixar a atmosfera mais difusa, alinhada ao tom vermelho da Mercúrio.

## Skills e documentos lidos
- `docs/README.md`
- `docs/operacao/change-management.md`
- Nenhuma skill adicional é necessária para este ajuste de CSS na stack existente.

## Código inspecionado
- `app/src/pages/Landing.tsx`: `AtmosphereBackground`, incluindo os brilhos vermelhos e o quadriculado do Hero.
- `app/src/index.css`: luzes vermelhas do CTA `.landing-download__light` como referência da paleta.

## Decisões e suposições
- “Fundo e atmosfera” refere-se aos brilhos vermelhos difusos e à grade decorativa do Hero.
- Remover os halos borrados nos cantos do Hero e substituí-los por um degradê atmosférico contínuo em carvão e vermelho, sem aspecto de vidro.
- Manter a grade branca discreta em 47 px no desktop e 36 px no mobile.
- Preservar o fundo preto, o conteúdo, os cards flutuantes, os efeitos do footer e os demais blocos da landing.
- Manter a grade harmonizada em 47 px no desktop e 36 px no mobile.

## Arquivos esperados
- `app/src/pages/Landing.tsx`
- `app/src/index.css` (somente se necessário para o contraste responsivo da grade)
- `prompts/2026-10-21-ajuste-atmosfera-hero.md`

## Requisitos e critérios de aceite
- O Hero deixa de parecer coberto por uma camada escura/acizentada de vidro e os halos isolados dos cantos desaparecem.
- O fundo mostra um degradê contínuo carvão/vermelho, com brilho perceptível e coerente com o CTA.
- O quadriculado permanece discreto e segue 47 px desktop / 36 px mobile.
- Cards, layout, animações, links e footer permanecem inalterados.

## Modelo de dados
Não aplicável; nenhuma persistência ou registro será criado.

## Segurança e impactos
- Ajuste visual local no frontend, sem dados pessoais, APIs, permissões ou dependências novas.
- Banco, migrations, Edge Functions, mobile, Electron, segurança/compliance e publicação: não afetados.

## Testes
- Executar lint, typecheck e build do app.
- Inspecionar o Hero em desktop e mobile, avaliando o contraste da grade, o tom do brilho e overflow.
- Revisar o diff para confirmar que o footer e os cards não foram alterados.

## Rollout e rollback
- Implementação local, sem deploy ou release.
- Reverter a classe `.home-hero-atmosphere` e a regra correspondente, restaurando os halos anteriores em `Landing.tsx`.
