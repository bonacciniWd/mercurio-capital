# Plano — ajuste responsivo do Hero da página inicial

## Objetivo

Adaptar o Hero atual da landing page para que a composição da referência enviada — texto e ações acompanhados pelos cartões visuais — continue legível e completa em telas móveis, sem cortar conteúdo nem criar rolagem horizontal. Preservar o estilo escuro já harmonizado com o restante da página.

## Skills e documentos lidos

- `docs/README.md`
- `docs/operacao/change-management.md`
- `docs/operacao/release-checklist.md`
- Instruções `AGENTS.md` fornecidas nesta conversa.
- Referência de componente e CSS fornecida na solicitação.

## Código e configuração inspecionados

- `app/src/pages/Landing.tsx`: Hero existente, navegação das ações, métricas, cartões animados e regra atual que oculta o visual abaixo de `lg`.
- `app/src/index.css`: estilos globais e estilos locais dos componentes da landing page.
- `app/package.json`: scripts de lint, typecheck, teste e build; stack React, Tailwind e Framer Motion já existente.
- Estado do worktree: há diversas alterações locais não relacionadas. O ajuste será limitado ao Hero e preservará esse estado.

## Decisões e suposições

- A referência enviada é a fonte visual para a adaptação responsiva; os dados e textos funcionais atuais da Mercúrio permanecem.
- Em telas menores, os cartões do Hero serão reorganizados e dimensionados para caber no fluxo da página, em vez de ficarem ocultos ou serem cortados. Desktop mantém a composição em duas colunas.
- Serão mantidos os destinos atuais das ações: `/login`, `/download`, `/protocolo` e `#simulador`.
- Reutilizar Tailwind, Framer Motion, ícones e suporte a movimento reduzido existentes; sem novas dependências, fontes externas, mudanças de dados ou alterações de backend.
- Escopo local apenas. Deploy/publicação exigem gate de release separado.

## Arquivos esperados

- `app/src/pages/Landing.tsx`
- `app/src/index.css` somente se forem necessários estilos responsivos locais adicionais; seletores devem ficar estritamente escopados ao Hero.

## Requisitos e critérios de aceite

- Em viewport móvel de 320–560 px, título, descrição, quatro ações, métricas e cartões visuais ficam visíveis e legíveis, sem corte horizontal ou sobreposição que prejudique leitura.
- Em tablet e desktop, a composição acompanha a referência: duas colunas quando houver espaço suficiente, com os cartões dentro da área visual.
- O Hero não cria overflow horizontal em 320 px, 390 px, 768 px ou 1440 px.
- Links e ações existentes continuam navegando aos mesmos destinos.
- Movimento respeita `prefers-reduced-motion` e o comportamento atual do restante da landing permanece intacto.
- Estilos novos não alteram títulos, botões ou SVGs em outras páginas.

## Modelo de dados

Não aplicável; mudança somente de apresentação no cliente.

## Segurança e impacto operacional

- Sem novos endpoints, credenciais, coleta de dados ou permissões.
- Web: afetada.
- Mobile nativo, Supabase, migrations/RLS, Edge Functions, Electron/updater, integrações e documentação operacional de runtime: não afetados.
- Deploy Vercel e release desktop/mobile não estão incluídos.

## Testes

- Automáticos: `npm run lint`, `npm run typecheck`, testes existentes (`npm test`) e `npm run build`, executados em `app/`.
- Navegador: conferir a landing em 320×740, 390×844, 768×1024 e 1440×900; verificar ausência de cortes/overflow, destinos das ações, navegação por teclado e modo de movimento reduzido.
- Registrar limitações caso não haja navegador automatizado ou sessão visual disponível.

## Rollout e rollback

- Implementação e validação local após aprovação deste plano.
- Rollback: reverter apenas o diff do Hero em `Landing.tsx` e, se criado, o bloco local correspondente em `index.css`.
- Qualquer publicação requer aprovação e checklist próprios, conforme `docs/operacao/change-management.md`.

## Resultado da implementação e validação — 2026-10-21

- Hero atualizado em `app/src/pages/Landing.tsx`: os cartões aparecem no fluxo móvel, os dois CTAs principais ocupam a largura disponível em telas estreitas, os links rápidos ficam separados e a tipografia/métricas se ajustam ao viewport. Os endereços funcionais existentes foram preservados.
- `npm run lint`: aprovado, 0 erros e 38 avisos já existentes no projeto.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado; Vite emitiu apenas o aviso já presente de chunk principal acima de 500 kB.
- Chrome headless: verificado a 320×1500, 390×844, 768×1024 e 1440×1100. O documento não apresentou rolagem horizontal; o screenshot completo de 320 px confirmou que título, ações, métricas e cartões cabem e permanecem legíveis.
- `npm test`: a execução parcial apontou falhas em `publicAmortizationSimulator.test.tsx` e `adminLeadsSimulacoes.test.tsx`, ambas fora do escopo desta alteração, e permaneceu ativa por mais de cinco minutos. Foi interrompida (código 130); a suíte completa não tem resultado conclusivo nesta execução.
- Nenhuma publicação foi realizada.
