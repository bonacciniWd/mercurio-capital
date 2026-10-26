# Universidade do Partner — referência visual

## Objetivo
Adaptar o catálogo e a experiência de aula da Universidade em `/p/universidade` às referências de componente/CSS fornecidas, preservando os dados e as ações reais do LMS já existentes. As pendências de credenciais Serasa e de configuração do WhatsApp Business ficam fora deste ajuste.

## Documentos e skills consultados
- `AGENTS.md` fornecido pelo usuário nesta conversa.
- `skills/UX_skills.md` (escopo de revisão: acesso por teclado, layout, conteúdo, tipografia, estados e movimento reduzido).
- `docs/README.md`, `docs/design/10-blueprint-visual.md`, `docs/design/05-visual-map.md`.
- `docs/blueprint/03-routes-navigation.md`, `docs/blueprint/02-roles-permissions.md`, `docs/blueprint/08-security-compliance.md`.
- `prompts/2026-10-23-onboarding-parceiro.md` (decisões de onboarding e fronteiras de acesso, como contexto relacionado).
- Referências anexadas: componente React e CSS da Universidade.

## Código e configurações inspecionados
- `app/src/pages/partner/UniversidadeLista.tsx`: catálogo Supabase, filtros de status/categoria, inscrição via `lms_inscrever`, certificados e geração/download.
- `app/src/pages/partner/UniversidadePlayer.tsx`: estrutura do curso, progresso Vimeo, RPC `lms_marcar_aula`, recursos assinados, notas locais e navegação de aulas.
- `app/src/layouts/PartnerLayout.tsx` e `app/src/router.tsx`: chrome da área Partner e rotas protegidas para `partner`/`team_member`.
- `app/src/pages/admin/Universidade.tsx`: referência de modelo de curso já disponível no sistema; sem previsão de alterar a administração.
- `app/package.json`: React, Tailwind 3, React Query, lucide-react e comandos `lint`, `typecheck`, `build`, `test`.
- Migração `supabase/migrations/20260518000040_universidade_fase8.sql` e documentação de segurança do LMS/RLS.

## Decisões e suposições
- O escopo são as duas superfícies Partner representadas no componente de referência: catálogo e player de aula. A rota e o layout global de Partner permanecem intactos.
- A referência é visual e estrutural; seus cursos, progresso, certificado e texto de métricas são mockados e não serão copiados como dados. Cards, contagens, progresso e certificados virão exclusivamente das queries/RPCs atuais.
- Reaproveitar Tailwind e lucide-react; não instalar dependências. A CSS fornecida contém seletores globais (`main`, `.brand`, `.hero`, `footer`, entre outros), portanto será traduzida para classes locais/escopadas para não afetar o restante do app.
- Preservar filtros existentes, inscrições, acesso condicionado a cursos, player Vimeo, persistência de progresso, recursos com URL assinada, notas locais e download de certificados.
- A busca por curso e o destaque “continuar de onde parou” podem ser derivados do catálogo já carregado, sem novo campo ou gravação. O resumo de progresso será calculado apenas com os dados disponíveis na view.
- Nenhuma tabela, policy/RLS, permissão, endpoint, integração ou regra de negócio nova. Parceiros e membros de equipe continuam limitados aos cursos e dados que as regras atuais lhes permitem ler.
- Não reabrir onboarding MERX/Serasa nem a integração WhatsApp nesta entrega.

## Arquivos esperados
- `app/src/pages/partner/UniversidadeLista.tsx` — composição visual do catálogo usando dados reais, filtros existentes e novos controles de apresentação derivados dos dados.
- `app/src/pages/partner/UniversidadePlayer.tsx` — composição visual do player e trilha do curso mantendo progresso, recursos e navegação atuais.
- `app/src/pages/partner/universidade.css` (ou classes Tailwind locais, conforme encaixe final) — estilos isolados da Universidade Partner, sem regras globais.
- Este plano; atualizar documentação operacional somente se a implementação alterar algum comportamento documentado.

## Requisitos e critérios de aceite
- Desktop segue a hierarquia visual fornecida: hero de aprendizagem e progresso real, catálogo com busca/filtros, cards/cursos e certificados; player com conteúdo, abas e currículo lateral.
- Em mobile, catálogo e player refluem sem rolagem horizontal indevida; player, navegação e ações continuam acessíveis.
- Cursos, inscrições, percentuais, certificados e recursos refletem somente respostas reais do Supabase; erros/loading/empty mantêm estados legíveis.
- Inscrever-se, continuar/revisar, abrir aula, salvar posição/conclusão e baixar certificado continuam funcionando.
- Visibilidade por papel e RLS não são ampliadas; conteúdo pago continua respeitando as regras atuais.
- Controles nativos, labels e foco visível; abas e filtros operáveis por teclado; respeitar `prefers-reduced-motion`.

## Segurança
- Não ampliar selects/RPCs para dados de outros usuários; progresso e certificados continuam associados à identidade autenticada e protegidos por RLS.
- Não expor signed URLs permanentes: conservar TTL e bucket atuais.
- Não criar textos de amostra que sugiram progresso, certificados ou acesso que o usuário não tem.
- Manter a separação entre role `partner` e `team_member` conforme route guards e RLS.

## Testes
- Após aprovação: `npm run lint`, `npm run typecheck`, `npm run build` e os testes focados existentes do LMS, se houver.
- Navegador: verificar catálogo com dados, carregamento, catálogo vazio/erro, filtros e busca, inscrição e retorno atualizado, certificado sem/com PDF.
- Player: vídeo/ausência de Vimeo, PDF assinado, notas, progresso e conclusão, próxima/prévia aula, módulos recolhidos e curso sem aulas.
- Capturas e inspeção visual nos viewports 1440×900, 1280×720, 390×844 e 320px; teclado, foco, zoom 200% e movimento reduzido.
- Deploy e alterações no Supabase não fazem parte do escopo.

## Execução após aprovação
- Implementado catálogo e player Partner em `UniversidadeLista.tsx` e `UniversidadePlayer.tsx`, com estilos isolados em `universidade.css`.
- Preservadas as queries/RPCs existentes, controle de acesso, inscrição, progresso Vimeo, URLs assinadas de recursos e certificados; não houve alteração no schema, policies/RLS ou backend.
- `npm run lint`: concluído com sucesso; 33 avisos preexistentes em outros arquivos, sem avisos nos arquivos alterados.
- `npm run typecheck`: concluído com sucesso.
- `npm run build`: concluído com sucesso; Vite reportou avisos existentes de chunks maiores que 500 kB.
- `npm test`: 44 de 45 arquivos e 173 de 175 testes passaram. Dois testes de `src/test/protocoloCaptchaUI.test.tsx` falharam por divergência de texto/estado da tela de captcha, fora do escopo Universidade.
- `git diff --check`: concluído sem erros.
- Navegação visual autenticada não foi executada; não havia sessão autenticada disponível nesta validação. Deploy e mudanças remotas não realizados.
