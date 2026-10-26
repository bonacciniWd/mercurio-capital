# Plano: harmonizar fundos de Plataforma e CTA Download

## Objetivo

Unificar o padrão quadriculado e a base escura dos blocos Plataforma e CTA Download da home, e devolver à Plataforma um brilho vermelho sutil derivado do CTA.

## Skills e documentos lidos

- Nenhuma skill adicional é necessária para este ajuste visual na stack existente.
- `docs/README.md`
- `docs/operacao/change-management.md`

## Código inspecionado

- `app/src/index.css`: estilos de `#plataforma.platform-showcase`, ambientes da Plataforma e `.landing-download`.
- `app/src/pages/Landing.tsx`: estrutura e classes dos dois blocos já existentes.

## Decisões e suposições

- A malha dos dois blocos usará linhas com a mesma cor/opacidade e espaçamento de 64px.
- Ambos manterão a base escura atual `#090a0c`.
- A Plataforma receberá luz ambiente vermelha de baixa intensidade usando a paleta já usada no CTA (`#b91c1c` / `#7e171d`), sem competir com conteúdo ou contraste.
- O restante do layout, conteúdo, animações, links e fluxo de download não será alterado.

## Arquivos esperados

- `app/src/index.css`

## Requisitos e critérios de aceite

- Quadriculado contínuo e uniforme entre os dois fundos, com escala de 64px e o mesmo contraste.
- Fundo escuro consistente.
- Brilho vermelho visível, porém mais fraco na Plataforma que no CTA.
- Sem alterações em responsividade, comportamento do carrossel, animações dos pontos ou CTA `/download`.

## Segurança

- Ajuste somente de CSS; sem dados, APIs, persistência ou dependências novas.

## Testes

- `npm run lint` e `npm run build` em `app/`.
- Inspeção visual no Chrome dos dois blocos em desktop e mobile.
- Confirmar que os seletores adicionados continuam limitados aos fundos da home.

## Rollout e rollback

- Alteração local para revisão, sem deploy.
- Reverter apenas as regras de fundo da Plataforma em `app/src/index.css` para desfazer.
