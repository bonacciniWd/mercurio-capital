# Plano: harmonizar grade do Hero e CTA da home

## Objetivo
Alinhar os quadriculados do Hero “Originação de crédito imobiliário” e da seção CTA Download ao padrão visual já usado pelas seções Plataforma e Produtos: 47 px no desktop e 36 px no mobile.

## Skills e documentos lidos
- `docs/README.md`
- `docs/operacao/change-management.md`
- Nenhuma skill adicional é necessária para este ajuste visual na stack existente.

## Código inspecionado
- `app/src/pages/Landing.tsx`: Hero `#home-hero` e componente `AtmosphereBackground`, que aplica grade inline de 64 px.
- `app/src/index.css`: grade CTA `.landing-download__grid` (64 px), Plataforma (47/36 px) e Produtos (47/36 px).

## Decisões e suposições
- Hero e CTA devem repetir exatamente as dimensões da grade das seções Plataforma e Produtos.
- A cor, opacidade, máscara, iluminação, conteúdo, layout, animações e interações permanecem iguais.
- No Hero, o tamanho da grade será aplicado responsivamente no componente existente: 47 px por padrão e 36 px até 600 px.
- No CTA, o tamanho será 47 px por padrão e 36 px até 600 px.

## Arquivos esperados
- `app/src/pages/Landing.tsx`
- `app/src/index.css`
- `prompts/2026-10-21-harmonizar-grade-hero-cta.md`

## Requisitos e critérios de aceite
- As grades do Hero, CTA, Plataforma e Produtos usam 47×47 px em desktop.
- As mesmas seções usam 36×36 px em viewport mobile de até 600 px.
- Nenhum outro estilo ou comportamento visual muda.
- Nenhuma alteração em rotas, dados, backend, dependências ou release.

## Modelo de dados
Não aplicável; não há persistência ou novos registros.

## Segurança e impactos
- Mudança visual somente no frontend, sem dados de usuário, rede, permissões ou credenciais.
- Mobile, banco/migrations, Edge Functions, Electron, segurança/compliance e publicação: não afetados.

## Testes
- Executar lint, typecheck e build do app.
- Inspecionar no navegador a grade computada em desktop e mobile para Hero e CTA e comparar com Plataforma/Produtos.
- Conferir ausência de overflow horizontal e revisar o diff para confirmar o escopo restrito.

## Rollout e rollback
- Implementação local, sem deploy ou release.
- Rollback removendo as duas regras responsivas adicionadas e restaurando os valores anteriores de 64 px.
