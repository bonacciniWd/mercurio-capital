# Plano — paridade visual e de navegação do mapa `/p/equipe`

## Objetivo
Alinhar o mapa da equipe do Partner ao canvas do mapa de originação do Admin: mesmos cards, acabamento visual e controles de navegação da janela do mapa, preservando o escopo de dados e a experiência de gerenciamento já existentes.

## Documentos e skills lidos
- Instruções `AGENTS.md` fornecidas pelo usuário.
- `docs/README.md`, `docs/blueprint/02-roles-permissions.md` e seção M5 de `docs/blueprint/06-modules-features.md`.
- `skills/UX_skills.md`: foco visível, teclado, hit targets, responsividade e revisão de estados.
- `prompts/2026-10-21-admin-rede-organograma-interativo.md` para as decisões aprovadas do canvas Admin.
- Migração `supabase/migrations/20260716000002_partner_rede_graph_admin_pending.sql` para o contrato e o isolamento de `partner_rede_graph()`.

## Código e configuração inspecionados
- `app/src/pages/partner/Equipe.tsx` e `app/src/pages/admin/Rede.tsx`.
- `app/src/components/rede/RedeFlow.tsx`, `NetworkCanvas.tsx`, `NetworkSearch.tsx`, `app/src/lib/redeLayout.ts` e `networkNodes.ts`.
- `app/src/pages/admin/rede.css`, router e scripts de `app/package.json`.
- Migração e documentação RBAC/RLS da página de equipe.

## Diagnóstico
- Admin já usa `NetworkCanvas`: cards e conexões estilizados, arraste local, pan, zoom, minimapa, enquadrar e reorganizar; clicar seleciona card e mostra painel de detalhes.
- `/p/equipe` usa o canvas React Flow legado, com controles padrão grandes e sem os comandos ou inspector do Admin.
- O grafo Partner vem de `partner_rede_graph()` sem `partner_id` do cliente e contém somente o próprio parceiro e suas equipes. A função rejeita roles diferentes de `partner` e parceiros não aprovados.

## Decisões e suposições
- A solicitação cobre apenas apresentação e navegação do canvas em `/p/equipe`; lista, convites, criação/remoção de membros e seus fluxos atuais ficam preservados.
- Reutilizar `NetworkCanvas` e os estilos do Admin, extraindo/escopando apenas o necessário para que o compartilhamento não altere a tela Admin.
- Incluir a mesma interação de viewport: zoom in/out, pan pelo fundo, minimapa, enquadrar e reorganizar; arrastar cards continuará sendo apenas visual e local à sessão, sem alterar vínculos ou gravar posições no banco.
- Selecionar card poderá exibir inspector somente de leitura com os dados que já vêm no grafo (parceiro/status/propostas ou equipe/membros). Nenhuma consulta adicional será necessária.
- Respeitar o gate atual: mapa exclusivamente para partner titular aprovado, sem ampliar acesso a `team_member` ou outras roles; RPC e policies não serão alteradas.
- Suposição para aprovação: “funções de janela” refere-se aos controles e gestos do viewport/canvas do Admin.

## Modelo de dados existente
Sem novos registros ou campos. A view utiliza `RedeGraph` (`nodes`, `edges`); cada node contém `id`, `tipo`, `label` e contagens/status opcionais. A RPC existente determina o vínculo partner→equipe e retorna somente a rede do parceiro autenticado. Não haverá gravação de posição, conexão ou relacionamento pelo mapa.

## Arquivos esperados
- `app/src/pages/partner/Equipe.tsx` — adotar o canvas compartilhado e apresentar detalhes somente de leitura.
- `app/src/components/rede/RedeFlow.tsx` e/ou `NetworkCanvas.tsx` — oferecer variante partner sem alterar o modo Admin.
- CSS compartilhado/escopado ao mapa em `app/src/pages/admin/rede.css` e/ou novo CSS da rede — compartilhar aparência e controles sem efeitos colaterais no restante do app.
- Este plano, atualizado com os resultados após implementação.

## Critérios de aceite
- Cards, conexões, minimapa, controles e painel de detalhe do mapa Partner seguem o padrão do Admin.
- Zoom, pan, minimapa, enquadrar, reorganizar e arraste funcionam sem controles gigantes ou comportamento de edição de vínculo.
- A lista e as ações de equipe continuam funcionando como antes.
- Loading, erro, vazio e viewport estreito continuam legíveis e utilizáveis; foco visível e nomes acessíveis nos controles.
- O mapa continua acessível somente para o partner aprovado autenticado e mostra somente seu grafo scoped.
- Nenhuma alteração de banco, RPC, RLS, policy, role ou deploy.

## Segurança
Manter `partner_rede_graph()` como única fonte do mapa. Não aceitar IDs de parceiro no cliente, não buscar dados administrativos, não acrescentar relações/consultas, e não ligar arraste ou conexão do canvas a mutações persistentes.

## Verificações
- Após aprovação: lint, typecheck, build e testes existentes relevantes de equipe/rede.
- Verificar por navegador estados de lista/mapa, partner aprovado, role não autorizado conforme o gate, loading/erro/vazio, seleção, navegação do viewport, teclado e responsividade desktop/mobile.
- Sem gravações remotas ou deploy.

## Execução após aprovação
- `/p/equipe` agora usa o canvas reutilizado pelo Admin, com cards, conexões, zoom, pan, minimapa, enquadrar e reorganizar; seleção abre inspector somente de leitura.
- A lista, convites e operações existentes de equipe foram mantidos. O canvas não persiste posições nem altera vínculos.
- `partner_rede_graph()` e o gate para role `partner` foram preservados; nenhuma tabela, RPC, policy, migration ou permissão foi modificada.
- `npm run lint`: sucesso; 33 avisos preexistentes em arquivos do projeto, sem erros.
- `npm run typecheck`: sucesso.
- `npm run build`: sucesso; permanecem avisos de chunks maiores que 500 kB.
- `npm test -- --run src/test/adminRede.test.tsx`: 1 arquivo e 6 testes aprovados.
- `git diff --check`: sucesso.
- Não havia navegador com sessão autenticada disponível para inspeção visual de `/p/equipe`; validação visual manual permanece pendente. Deploy não realizado.
