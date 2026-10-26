# Paridade visual das propostas do partner com admin

## Objetivo

Alinhar a tela `/p/propostas` à composição visual existente em `/admin/propostas`: cabeçalho, ações, quatro métricas, filtros, tabela e paginação com 50 itens por página. A experiência partner continua limitada às propostas que o backend/RLS já permite ao usuário ver.

## Skills e documentos lidos

- `skills/UX_skills.md` — manter padrões da aplicação, semântica nativa, foco visível, acessibilidade de controles e estados responsivos.
- `docs/README.md` — escopo, stack e convenções do projeto.
- `docs/blueprint/02-roles-permissions.md` — partner e team_member consultam apenas escopo próprio/equipe e não acessam fundos atribuídos.
- `docs/blueprint/03-routes-navigation.md` — `/p/propostas` e rotas de detalhe/criação já existentes.
- `docs/blueprint/04-database-schema.md` — relação proposta → cliente e campos da proposta.

## Código inspecionado

- `app/src/pages/admin/Propostas.tsx` e `app/src/pages/admin/propostas.css` (referência visual e regras de paginação).
- `app/src/pages/partner/Propostas.tsx` (consulta atual, filtros, ações, estados e navegação).
- `app/src/pages/partner/PropostaDetalhe.tsx` (campos disponíveis e formato monetário usado).
- `app/src/lib/credito.ts`, `app/src/lib/propostaStatus.ts` e `app/src/lib/documentoBr.ts`.
- Migrações `20260513000003_originacao.sql` e `20260722000001_fundos.sql` / `20260722000007_admin_juridico_hardening.sql` para confirmar RLS de propostas e restrição de fundos.
- `app/package.json` (comandos de validação).

## Decisões e suposições

- A consulta permanece em `propostas` com RLS, sem RPC administrativo, sem `partner_id` fornecido pelo cliente e sem relaxar policy.
- Não consultar `proposta_fundos` ou `fundos`: as policies atuais reservam essa leitura a admins. Para preservar a densidade da referência sem expor dados restritos, a tabela partner mantém apenas os campos pertinentes ao parceiro: protocolo, cliente, produto, valor, LTV, status e dias desde a criação.
- Os dados de LTV virão de `valor_imoveis_total`, já disponível em `propostas`; quando não houver valor de imóvel, exibir “—”.
- As métricas serão calculadas sobre os registros retornados pela consulta partner, não sobre carteiras globais. A consulta mantém o limite atual de até 200 linhas; a paginação da interface mostra no máximo 50 por página.
- Manter links existentes para `/p/propostas/nova`, `/p/kanban` e `/p/propostas/:id`, mantendo ações e autorização específicas do partner.
- Reutilizar o CSS escopado já usado pela página administrativa, para manter a mesma referência sem duplicar regras nem conflitar com estilos globais de botões.
- Nenhuma migration, mudança de modelo ou mudança de autorização faz parte deste escopo.

## Arquivos esperados

- `app/src/pages/partner/Propostas.tsx`
- `app/src/test/partnerPropostas.test.tsx` (novo, cobertura dos limites de escopo, filtros e paginação)
- Este plano em `prompts/`.

## Critérios de aceite

- A tela partner reproduz o sistema visual de `/admin/propostas` em desktop e usa os mesmos estados responsivos para telas menores.
- Cabeçalho, quatro métricas, busca/status/produto, cabeçalho da lista, tabela, loading/erro/vazio e paginação estão presentes e alinhados visualmente.
- A paginação exibe no máximo 50 linhas, atualiza o intervalo exibido e volta à página 1 quando filtros/busca mudam.
- Protocolo e ação de abrir navegam ao detalhe partner; a ação de criar proposta navega ao wizard partner; Kanban navega ao Kanban partner.
- Nenhuma consulta administrativa ou informação de outra parceria é introduzida; políticas RLS permanecem intactas.
- Mantidos os formatos atuais de moeda, CPF, rótulo de status e produto, e os valores ausentes são apresentados com segurança como “—”.

## Considerações de segurança

- A autorização continua sendo aplicada no Supabase via JWT/RLS. O componente não filtra por identidade fornecida pelo browser nem amplia a leitura com RPC `SECURITY DEFINER`.
- Não incluir coluna ou tooltip de fundos, pois a tabela `proposta_fundos` tem leitura apenas administrativa.
- A filtragem e paginação no cliente operam somente sobre linhas já visíveis ao usuário.

## Testes

- Automatizados: renderização, links de navegação partner, busca/status/produto, métricas com os dados retornados e paginação de 50 itens.
- Estáticos: `npm run lint`, `npm run typecheck`, `npm run build` em `app/`.
- Manual: validar desktop e viewport estreito, teclado/foco, estados de carregamento/erro/vazio e que nenhum dado fora do conjunto RLS apareça. Sem deploy nesta etapa.
