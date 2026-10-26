# Plano — rota pública Crédito para Construção

**Status:** implementado localmente e validado; publicação não autorizada nesta etapa.

## Objetivo

Integrar a página CPC entregue pelo designer à aplicação web Mercurio Capital, na rota pública `/credito-para-construcao`, preservando o design e adaptando o código à stack, ao roteamento e aos estilos já existentes.

Fonte visual e de conteúdo: pasta local `/Users/macbook/Desktop/Mercurio_LP`, compartilhada pelo usuário; referência original: [Mercúrio LP no Figma](https://www.figma.com/make/zC4rwOEso0jI04hkZMR32K/Merc%25C3%25BArio-LP?code-node-id=0-6&p=f&t=SAFI64zCdI50QatR-0&fullscreen=1).

## Skills e documentos lidos

- Skill `sites:sites`, com as orientações para páginas de apresentação e preview local. O trabalho será feito no app Vite existente; não será criado um Site separado.
- `docs/README.md`.
- `docs/blueprint/01-architecture.md`.
- `docs/blueprint/03-routes-navigation.md`.
- `docs/blueprint/08-security-compliance.md`.
- `docs/design/10-blueprint-visual.md`.
- `docs/operacao/change-management.md`.
- `app/vercel.json` e `app/vite.config.ts`.
- `Mercurio_LP/AGENTS.md`, `Mercurio_LP/handoff.md` e `Mercurio_LP/plan.md` como documentação do pacote do designer.

## Código e configuração inspecionados

Aplicação Mercurio:

- `app/src/pages/Landing.tsx`, `app/src/router.tsx` e `app/src/layouts/PublicLayout.tsx`.
- `app/src/index.css` e `app/tailwind.config.js`.
- `app/package.json`, `app/vercel.json` e `app/vite.config.ts`.
- A árvore de `app/src/assets/`, componentes públicos e testes existentes.

Pacote do designer:

- `Mercurio_LP/src/App.tsx` — página completa com oito seções, FAQ acessível e CTA de protótipo.
- `Mercurio_LP/src/index.css` — tokens e estilos responsivos específicos da página.
- `Mercurio_LP/index.html` — metadados da landing no projeto isolado.
- `Mercurio_LP/public/images/mercurio-logo.png` e `public/favicon.svg`.
- `Mercurio_LP/package.json` — React 19, Tailwind 4 e Vite 8; versão diferente da aplicação Mercurio.

A página usa uma foto externa do Unsplash. O handoff do designer a identifica como ilustrativa e pede confirmar uso/substituição por foto aprovada. O handoff também lista revisão comercial/jurídica dos textos como pendente e informa que o CTA final ainda não tem canal oficial configurado.

O diretório de trabalho já contém alterações locais, inclusive em `Landing.tsx` e `router.tsx`. Elas serão preservadas.

## Decisões e suposições

- Usar o conteúdo, a ordem das seções e a interação de FAQ do `App.tsx` como a implementação de referência, sem copiar a aplicação independente inteira.
- Criar uma página React no app existente e registrar sua rota sob a camada pública atual.
- Extrair apenas os estilos necessários, escopando-os ao componente CPC para impedir conflitos com `index.css`, Tailwind e os estilos globais de botões.
- Não copiar `main.tsx`, `index.html`, `vite.config.ts`, `package.json`, `pnpm-lock.yaml`, `.figma/`, arquivos de ambiente ou configuração do projeto Figma Make.
- Reutilizar o logo oficial já disponível no app se visualmente corresponder ao fornecido; só copiar o PNG do pacote do designer se não houver equivalente adequado.
- Não adicionar bibliotecas. Não importar para o app o Tailwind 4 ou as dependências React 19 do pacote do designer.
- Manter o CTA de protótipo sem coleta/envio de dados enquanto o canal oficial não estiver definido. Não associá-lo ao simulador de Home Equity.
- A fotografia Unsplash e os textos comerciais não serão promovidos silenciosamente como ativos/conteúdo já aprovados para produção; validar esses itens antes de publicação.
- Não alterar a landing `/`, as rotas `/simulador`, `/p/*`, `/c/*` ou `/admin/*`.

## Arquivos esperados

- `app/src/pages/CreditoParaConstrucao.tsx` — estrutura e interações da página CPC.
- `app/src/pages/credito-para-construcao.css` — somente estilos específicos, se a conversão fiel não couber nos padrões existentes sem vazamento global.
- `app/src/router.tsx` — entrada da rota pública.
- `app/src/test/creditoParaConstrucao.test.tsx` (ou pasta de testes equivalente) — renderização, FAQ e CTA de protótipo.
- `docs/blueprint/03-routes-navigation.md` — inclusão da nova rota.
- Eventual ativo logo local apenas se o logo atual do app não corresponder.

## Requisitos e critérios de aceite

- `/credito-para-construcao` abre diretamente e continua funcionando após atualizar a página no domínio Vercel (rewrite SPA existente).
- Estrutura, textos, cores, tipografia, imagens, seções, espaçamento e comportamento interativo seguem o material do designer; layout responsivo preserva conteúdo e foco em telas pequenas.
- FAQ continua acessível por teclado e comunica o estado expandido; foco visível e `prefers-reduced-motion` são respeitados.
- CTA informa que o canal CPC está pendente sem coletar nem transmitir dados.
- Nenhum estilo da página altera globalmente a landing existente ou o restante da aplicação.
- `/`, `/simulador` e uma rota pública existente continuam operacionais.

## Considerações de segurança

- Conteúdo estático no navegador; sem autenticação, segredo, chamada privilegiada, persistência ou captura de dados.
- Não copiar arquivos `.env`, configuração Figma Make, metadados de deploy independente ou dependências do projeto fonte.
- Manter link externo com atributos seguros e tornar a origem/licença da imagem auditável; substituir a imagem se o uso não for aprovado.
- Nenhuma migration, RLS ou Edge Function prevista.

## Impacto fora do app web

- Mobile: não afetado.
- Supabase, banco, RLS e Edge Functions: não afetados.
- Electron/artefatos desktop: o bundle web compartilhado incluirá a rota após build, mas nenhum artefato será gerado ou distribuído nesta demanda.
- Vercel: o rewrite atual deve atender a rota sem alteração de infra; deploy não faz parte deste plano e exige aprovação separada.

## Verificações

### Automáticas

- Teste dedicado da rota e da interação da FAQ/CTA.
- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.

### Manuais no navegador

- Abrir a rota por URL direta e atualizar a página.
- Comparar visualmente com o pacote do designer em desktop (1440×900) e celular (390×844); conferir reflow, ausência de overflow horizontal e imagens.
- Percorrer cabeçalho, âncoras, FAQ e CTA usando mouse e teclado.
- Conferir que a FAQ anuncia seu estado, foco é visível e movimento reduzido é respeitado.
- Confirmar que `/`, `/simulador` e uma rota pública existente continuam acessíveis.

## Rollout e rollback

- Implementação local, sem operação remota/publicação.
- Rollback: remover a página/estilos/testes/documentação novos e a entrada do router.

## Aprovação

Plano aprovado pelo usuário em 2026-10-16. A implementação foi concluída localmente; publicação e aprovação final de textos/ativos comerciais permanecem gates separados.

## Implementação e validação

- Criada a página CPC e seu CSS isolado; registrada sob `PublicLayout` e documentada na tabela de rotas.
- Adicionado teste para renderização, FAQ e aviso do CTA.
- O pacote original `/Users/macbook/Desktop/Mercurio_LP` permaneceu intacto.
- Teste dedicado: passou (2 testes).
- `npm run lint`: passou sem erros; há 38 avisos preexistentes em outros arquivos.
- `npm run typecheck`: passou.
- `npm run build`: passou; Vite ainda alerta para o bundle principal grande (~1,96 MB).
- Navegador: rota abriu diretamente e foi inspecionada em desktop e viewport móvel de 390×844; a largura do documento permaneceu em 390 px, sem overflow horizontal, e a imagem principal carregou. O preview de desenvolvimento exibe o botão do TanStack Query Devtools no canto inferior direito; é uma ferramenta de desenvolvimento.

## Atenção antes da publicação

- Confirmar aprovação comercial/jurídica dos textos e da foto ilustrativa do Unsplash, ou substituir a foto por ativo aprovado.
- Definir o canal oficial do CTA final; até lá, ele informa que o canal está pendente e não envia dados.
- O build foi verificado localmente, mas não houve deploy para Vercel nem geração de artefatos Electron nesta demanda.
