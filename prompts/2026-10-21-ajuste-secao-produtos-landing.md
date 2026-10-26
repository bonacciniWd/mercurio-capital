# Plano — atualização da seção de produtos da landing page

## Objetivo

Atualizar a seção `#produtos` da `Landing.tsx` com a composição do componente `ProductShowcase` enviado: cabeçalho editorial, destaque “Mercúrio One” com imagem e três cartões de produto. Harmonizar a seção com o visual escuro, quadriculado e vermelho do Hero da página inicial e assegurar comportamento responsivo.

## Skills e documentos lidos

- `docs/README.md`
- `docs/operacao/change-management.md`
- Instruções `AGENTS.md` fornecidas nesta conversa.
- Código e CSS de referência enviados nesta solicitação e no ajuste aprovado do Hero.

## Código e configuração inspecionados

- `app/src/pages/Landing.tsx`: seção atual `#produtos`, import de `callToBanner`, helper `ProductCard`, links do simulador e hooks já usados pela landing.
- `app/src/index.css`: estilos globais e CSS escopado das seções da landing. Não há estilos `.products` / `.campaign` associados ao novo componente.
- `app/package.json` e `app/package-lock.json`: GSAP já está instalado; `@gsap/react` não está instalado.
- `docs/operacao/change-management.md`: aprovação do plano antes do código e gate separado para deploy/release.

## Decisões e suposições

- A marcação, composição, conteúdo e interações descritos no componente enviado são a referência para a atualização.
- Usar a foto `ExecutivePhoto` fornecida na referência somente na área visual da campanha, substituindo a imagem atual da seção. Não acrescentar outras imagens.
- Harmonizar a seção com o tema do Hero (fundo escuro, grade sutil e acento vermelho), sem alterar o restante da página.
- Preservar as rotas/âncoras da landing; as chamadas “Explorar plataforma” e “Simular agora” apontam para `#simulador`.
- Reutilizar GSAP e ScrollTrigger já disponíveis; implementar integração com os hooks React existentes, sem adicionar `@gsap/react` nem outra dependência.
- Usar os textos e características apresentados no componente compartilhado. Nenhuma regra de cálculo ou elegibilidade será implementada.
- Escopo local apenas; deploy Vercel e release desktop/mobile são gates separados.

## Arquivos esperados

- `app/src/pages/Landing.tsx`
- `app/src/index.css`

## Requisitos e critérios de aceite

- A imagem atual de banner deixa de aparecer na seção de produtos; a imagem fornecida aparece apenas na campanha.
- A seção apresenta cabeçalho, campanha e três cartões de produto conforme a referência de marcação compartilhada.
- A seção fica visualmente integrada ao Hero escuro/vermelho, com estilos estritamente escopados para não afetar outras rotas.
- Em 320–600 px, cabeçalho, campanha e produtos empilham sem corte nem rolagem horizontal; em larguras maiores, campanha e cartões usam a composição responsiva prevista.
- Links de exploração/simulação levam ao simulador existente.
- Interações GSAP respeitam `prefers-reduced-motion`, são limpas no unmount e não deixam ScrollTriggers ativos após navegação.
- Os três cartões seguem acessíveis por teclado; foco revela o CTA que aparece no hover.

## Modelo de dados

Não aplicável; a alteração é somente de apresentação no cliente.

## Segurança e impacto operacional

- Sem novos endpoints, dados coletados, permissões, migrations ou credenciais.
- A imagem remota fornecida é carregada pelo navegador a partir de Unsplash.
- Web: afetada.
- Mobile nativo, Supabase, RLS, Edge Functions, Electron/updater e integrações: não afetados.
- Deploy e release não incluídos.

## Testes

- Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` em `app/`.
- Conferir a seção no Chrome em 320×844, 390×844, 768×1024 e 1440×900; testar links do simulador, foco/hover e modo de movimento reduzido.
- Registrar qualquer limitação se a suíte geral voltar a travar ou falhar fora deste escopo.

## Rollout e rollback

- Implementar e validar localmente após aprovação deste plano.
- Rollback: reverter apenas a seção de produtos em `Landing.tsx` e o bloco CSS local correspondente em `index.css`.
- Qualquer publicação exige autorização e checklist próprios, conforme `docs/operacao/change-management.md`.

## Resultado da implementação e validação

- Implementada a campanha “Mercúrio One”, com a imagem fornecida, o cabeçalho editorial e três cartões de produto; os links apontam para `#simulador`.
- CSS isolado em `#produtos`; animações GSAP/ScrollTrigger limpam os recursos no unmount e respeitam movimento reduzido.
- Chrome local verificado em 320×844, 390×844, 768×1024 e 1440×900. Não houve rolagem horizontal; imagem carregou, links encontraram o simulador, foco de teclado revelou o CTA e o modo de movimento reduzido manteve o conteúdo visível.
- `npm run lint`: passou, com 38 avisos existentes em outros arquivos; `npx eslint src/pages/Landing.tsx`: passou sem avisos.
- `npm run typecheck`: passou.
- `npm run build`: passou; Vite avisou que o bundle principal ultrapassa 500 kB após minificação.
- `npm test -- --maxWorkers=2`: 32 arquivos aprovados e 3 reprovados por timeout: `adminLeadsSimulacoes.test.tsx`, `dateRangePicker.test.tsx` e `publicAmortizationSimulator.test.tsx`. Total: 127 aprovados e 3 reprovados entre 130 testes. Essas telas não pertencem à seção de produtos.
- `git diff --check`: passou.
- Sem deploy ou release.
