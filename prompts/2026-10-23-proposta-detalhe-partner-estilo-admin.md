# Paridade visual do detalhe de proposta do partner

## Objetivo
Alinhar `/p/propostas/:id` ao sistema visual de `/admin/propostas/:id`, com o mesmo fundo, cabeçalho em cartão, faixa compacta de metadados, abas horizontais e painéis. Preservar os dados, ações e permissões específicos de partner.

## Skills e documentos lidos
- `skills/UX_skills.md` — padrões existentes, semântica, foco e responsividade.
- `docs/README.md` — stack e convenções.
- `docs/blueprint/02-roles-permissions.md` — limites de partner/team_member e dados administrativos.
- `docs/blueprint/03-routes-navigation.md` — rotas e navegação do detalhe.
- `prompts/2026-10-23-paridade-visual-propostas-partner.md` — escopo de paridade da listagem e restrições de RLS/fundos.

## Código inspecionado
- `app/src/pages/partner/PropostaDetalhe.tsx` — consultas RLS, oito abas, componentes de documentos/pendências/consultas/contrato e reemissão do magic link.
- `app/src/pages/admin/PropostaDetalhe.tsx` — composição visual de referência e dados de cabeçalho disponíveis.
- `app/src/pages/admin/proposta-detalhe.css` — estilos escopados da referência.
- `app/src/test/adminPropostaDetalhe.test.tsx` e `app/package.json` — convenções de teste e comandos.

## Decisões e suposições
- Reutilizar o CSS da tela admin como referência e acrescentar somente regras escopadas para diferenças de composição do partner, evitando duplicar a folha inteira.
- Manter as oito abas atuais do partner. Não incluir Financeiro, fundos atribuídos, edição de status, edição de responsável ou ações exclusivas de admin.
- Preservar consultas Supabase atuais; não alterar tabelas, filtros, endpoints, políticas ou modelo de dados. RLS continua sendo a fonte de autorização.
- A faixa de metadados usará apenas campos já carregados e permitidos ao partner, como status, produto, valor solicitado, prazo e data de criação.
- Preservar integralmente o fluxo de reemissão/cópia do magic link e mensagens de estado.

## Arquivos esperados
- `app/src/pages/partner/PropostaDetalhe.tsx`
- `app/src/pages/admin/proposta-detalhe.css` (regras específicas de composição partner, se necessárias)
- `app/src/test/partnerPropostaDetalhe.test.tsx` (teste focado de abas, informação permitida e ações preservadas)

## Critérios de aceite
- Desktop apresenta o mesmo padrão de cabeçalho, faixa de metadados, abas e superfícies da tela admin.
- Layout responde a larguras menores sem quebrar navegação, conteúdo ou ação de magic link.
- Oito abas e suas funcionalidades atuais continuam acessíveis.
- Nenhum controle ou dado administrativo é introduzido.
- Nenhuma consulta, policy RLS ou relação de acesso é ampliada.

## Considerações de segurança
- Dados continuam vindo de consultas Supabase sujeitas a RLS; o estilo não muda a autorização.
- Não adicionar consultas a fundos/financeiro nem campos de gestão interna.
- Não expor token do magic link além do URL que o fluxo atual já apresenta ao partner autorizado.

## Testes
- Automatizados: abas e painéis, estados de carregamento/erro/não encontrado, ação de reemitir e ausência de controles administrativos.
- Estáticos: `npm run lint`, `npm run typecheck`, `npm run build` em `app/`.
- Manual: revisão visual desktop e viewport mobile, navegação por teclado e checagem dos estados de magic link. Sem publicação nesta etapa.

## Execução
- O detalhe partner agora reutiliza o cabeçalho, a faixa de metadados, as abas e o padrão visual do detalhe admin.
- A aba Proponentes segue a composição em cartões da referência: dados cadastrais, endereço do principal e atalho para a aba Consultas. Não expõe edição, classificação nem responsável administrativo.
- O acesso às consultas permanece no componente e na view já existentes, sujeitos às políticas RLS. Nenhuma migration foi criada.
- Testes focados partner/admin: 5 passaram. Lint, typecheck e build passaram; o build manteve o aviso preexistente de chunk grande. Revisão visual manual em navegador não foi executada.
