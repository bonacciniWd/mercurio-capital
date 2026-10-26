# Plano — logo SVG animado no mockup do CTA de download

## Objetivo

Exibir a marca animada `app/src/assets/logos/logo.svg` no mockup ilustrativo do dashboard da seção CTA Download da Home, substituindo o “M” atual.

## Skills e documentos lidos

- `docs/README.md`
- `docs/operacao/change-management.md`
- `docs/operacao/release-checklist.md`
- `prompts/2026-10-20-cta-download-home.md`
- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- Nenhuma skill adicional é necessária para esta alteração pontual de UI.

## Código e configuração inspecionados

- `app/src/pages/Landing.tsx`: imports da marca e markup do mockup em `.landing-download__sidebar`.
- `app/src/index.css`: regras de `.landing-download__brand-mark`, `.landing-download__logo` (se existente), sidebar e breakpoint mobile.
- `app/src/assets/logos/logo.svg`: SVG local com gradientes vermelhos e animação CSS interna.
- `app/package.json`: scripts de lint, typecheck, testes e build.

## Decisões e suposições

- Manter o arquivo SVG existente e seu comportamento animado; não recriar a marca, converter para PNG nem adicionar dependências.
- Corrigir o elemento atual para HTML válido (`img`) usando o import existente `logoRed`; ajustar apenas dimensões/alinhamento necessários no mockup desktop e mobile.
- O elemento permanece decorativo dentro do preview `aria-hidden`; não introduzir semântica duplicada para leitores de tela.
- O escopo fica restrito ao CTA de download da Home. A página `/download`, outros logos e o backend não serão alterados.
- Alteração local; publicação não está incluída.

## Impacto

- Web (`app/`): markup e CSS do mockup do CTA.
- Mobile: não afetado fora do breakpoint responsivo já pertencente ao CTA.
- Supabase, migrations, Edge Functions e dados: não afetados.
- Electron/updater: não afetado.
- Segurança/operação: sem novos acessos a dados, APIs ou credenciais.
- Documentação/deploy: somente este plano; nenhum deploy.

## Arquivos esperados

- `app/src/pages/Landing.tsx`
- `app/src/index.css`

## Requisitos e critérios de aceite

- O “M” deixa de ser exibido e o `logo.svg` aparece no mesmo espaço da navegação lateral simulada do dashboard.
- A marca mantém proporção, fica visualmente legível no desktop e no mobile e não distorce o restante do mockup.
- O SVG é carregado pelo import local já existente e sua animação continua ativa em navegadores compatíveis.
- Nenhuma outra seção, logo, rota ou fluxo é alterado.

## Segurança

- O asset é local e estático. Não adicionar URL externa, JavaScript, dados ou chamadas de rede.
- O SVG será renderizado como imagem, sem inserir markup SVG arbitrário no DOM.

## Testes

- Automáticos: lint, typecheck, testes focados disponíveis para Landing e build em `app/`.
- Manual no navegador: confirmar o logo e sua escala na CTA em desktop e mobile; verificar que o restante da Home continua renderizando.

## Rollout e rollback

- Implementado localmente após aprovação; sem publicação neste escopo.
- Reverter apenas o markup e as regras CSS adicionadas/alteradas para a marca dentro do mockup do CTA.

## Resultado da implementação

- `Landing.tsx`: o `logo.svg` local agora é renderizado em um `<img>` decorativo dentro do emblema da sidebar simulada, substituindo a tag inválida `<image>`.
- `index.css`: o recorte invisível elimina as margens vazias do viewBox; o SVG é posicionado com centro explícito dentro da área da marca e dimensionado para desktop/mobile sem alterar o tamanho da sidebar. Fundo, borda e cantos do tile foram removidos para exibir somente o símbolo.
- Verificações: `npm run lint` passou com 0 erros e 38 avisos já existentes; `npm run typecheck` passou; `npm run build` passou (4216 módulos transformados; aviso existente de chunk acima de 500 kB); verificação do bundle confirmou o wrapper, a animação SVG e as regras responsivas; `git diff --check` passou.
- Inspeção visual via Chrome não foi possível nesta sessão, pois o macOS bloqueou a automação do navegador. Nenhum deploy foi executado.

- Ajuste visual complementar aprovado: removido o tratamento de tile do símbolo; lint (0 erros, 38 avisos preexistentes), typecheck e build passaram novamente.
- Após relato de desalinhamento, substituído o alinhamento implícito por posicionamento absoluto `50%/50%` com `translate(-50%, -50%)`. Chrome headless confirmou centro do SVG (64×64) dentro do recorte (30×30), e inspeção visual mostrou o símbolo no local da marca na sidebar do dashboard.
