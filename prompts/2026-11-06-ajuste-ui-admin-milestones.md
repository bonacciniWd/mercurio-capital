# Plano — Ajuste visual da configuração Admin de Milestones

Status: aprovado pelo proprietário em 2026-11-06 e implementado localmente como UI-only. Contratos, dados, permissões e mutations foram preservados. Nenhuma migration, publicação ou deploy foi feita.

## Objetivo

Deixar `/admin/milestones` mais clara e ergonômica para configurar metas, prêmios, imagens e estado ativo, preservando a responsabilidade do Admin como configuração do programa. A visualização de progresso, barra acumulada e cards de prêmios continua exclusiva de `/p/milestones`.

## Documentação e código consultados

- `.github/agents/ux-ui-mercurio-capital.agent.md` e regra de aprovação antes de alterar UI.
- `docs/operacao/change-management.md`.
- `docs/blueprint/03-routes-navigation.md`: rota `/admin/milestones` e guards Admin existentes.
- `docs/blueprint/06-modules-features.md`: M14 e fonte de verdade administrativa `partner_milestones`.
- `docs/blueprint/08-security-compliance.md`: RBAC, Admin full e segurança do Storage.
- `prompts/2026-10-26-partner-milestones-released-volume.md`: plano que preserva milestones configuráveis no Admin e altera apenas a origem do progresso partner.
- `app/src/pages/admin/Milestones.tsx`: listagem e modal atuais; campos, upload e mutations.
- `app/src/pages/partner/Milestones.tsx`: tela separada de progresso do partner, fora deste escopo.

## Diagnóstico

- A tela Admin tem uma tabela com ordem, imagem, rótulo/prêmio, meta, cor, estado e ações. Em telas estreitas, a tabela de sete colunas não se adapta como cartões e pode exigir rolagem horizontal.
- O formulário de edição é um modal de uma única grade; os campos não estão agrupados por tarefa e o rodapé pode sair do viewport em telas baixas.
- A consulta tem estado de carregamento e vazio, mas o erro de leitura não é representado explicitamente; uma falha pode parecer uma lista vazia.
- Upload e URL externa da imagem são duas opções existentes e precisam ficar visivelmente relacionadas, sem mudar os contratos atuais.
- A UI utiliza primitives e tokens já existentes do Admin; esta proposta os preserva.

## Solução visual proposta

### Listagem Admin

- Cabeçalho compacto com título, explicação da finalidade e ação primária “Novo milestone”.
- Desktop: tabela responsiva com imagem/prêmio agrupados; ordem, meta, cor e status em colunas de leitura rápida; ações por ícones com `aria-label`/tooltip e feedback de estado pendente.
- Mobile/tela estreita: transformar cada linha em item empilhado, preservando todos os mesmos dados e ações sem scroll horizontal obrigatório.
- Estado vazio com ação “Criar primeiro milestone”; carregamento e erro de leitura com retry ficam distintos.

### Modal de criação/edição

- Modal com `max-height` relativo ao viewport, scroll somente no conteúdo e cabeçalho/rodapé estáveis; Escape, clique externo conforme padrão do projeto e restauração de foco.
- Agrupar campos visualmente, sem alterar nomes ou payload: “Meta” (ordem, valor em reais, rótulo), “Prêmio” (nome, descrição), “Apresentação” (cor, ativo, imagem).
- Preview de imagem com limites estáveis e estado vazio/loading/erro. Upload e URL externa continuam disponíveis, deixando evidente que a URL manual substitui a imagem do Storage conforme comportamento atual.
- Ações Cancelar/Salvar fixas e estados de salvamento; erro de validação próximo do campo ou em feedback do modal.

## Escopo funcional preservado

- Manter os mesmos campos e valores: `order_index`, `label`, `prize`, `descricao`, `target_centavos`, `color`, `image_url`, `image_storage_path`, `ativo`.
- Manter CRUD, confirmação de exclusão, upload no bucket `milestone-images`, preview, query keys, invalidação e RPC/storage existentes.
- Não adicionar preview do progresso do partner nem mudar fórmula, regras de elegibilidade, milestones iniciais, prêmio ou permissões.
- Não alterar `/p/milestones`, Mobile, `supabase/migrations/`, Edge Functions, rotas ou banco.
- Nenhuma biblioteca/dependência nova.

## Acessibilidade e responsividade

- Labels associados aos campos; foco visível e ordem de tabulação coerente.
- Ícones de ação com nomes acessíveis e tooltip para ações não óbvias.
- Modal navegável por teclado, foco mantido/restaurado e conteúdo rolável em viewport baixa.
- Desktop amplo, tablet, largura mobile 320–390 px, zoom 200% e preferência de movimento reduzido.
- Contraste suficiente em status, cor e feedback; estado não depende só de cor.

## Arquivos esperados

- `app/src/pages/admin/Milestones.tsx`: composição visual da listagem e modal mantendo lógica atual.
- `app/src/test/adminMilestones.test.tsx`: estados, acessibilidade básica, responsividade estrutural, CRUD existente e ausência de mudanças no contrato.
- Este plano: registrar execução e verificações após aprovação.

## Critérios de aceite

1. Admin continua configurando milestones e não recebe cards/barra de progresso do partner nesta rota.
2. Todos os campos, CRUD, imagem e estado ativo funcionam com o mesmo payload/Storage.
3. Em 320 px não há perda de ações nem necessidade de rolagem horizontal da página.
4. Em viewport baixa, todos os campos e botões do modal ficam alcançáveis por rolagem; cabeçalho/ações permanecem localizáveis.
5. Loading, vazio, erro de leitura, validação, salvamento e falha de imagem são estados distintos.
6. Testes focados, typecheck, lint e build passam; capturas desktop/mobile confirmam ausência de clipping ou sobreposição.
7. O diff não altera partner, mobile, banco, RLS, migrations ou lógica de milestones.

## Testes, rollout e rollback

- Testes automatizados React Testing Library/Vitest para listagem, estados, modal, upload e ações existentes.
- Validar `npm run typecheck`, lint focal e `npm run build` no pacote `app`.
- Revisar em desktop e mobile com dados sintéticos; não fazer escrita remota durante validação.
- Rollback limitado ao componente visual Admin; sem migração ou mudança de dados.
- Deploy/release exige autorização separada conforme `docs/operacao/change-management.md`.

## Aprovação solicitada

Aprovar o ajuste visual de `/admin/milestones` descrito acima, mantendo Admin apenas como configurador e sem mudança funcional, dados, permissões ou progresso exibido ao partner.

## Implementação e validação

- Cabeçalho compacto com contagem de milestones e ação primária responsiva.
- Tabela desktop mais fácil de ler, agrupando imagem/prêmio; em telas estreitas, itens empilhados sem scroll horizontal obrigatório.
- Estados de carregamento, vazio com ação de criação e erro de leitura com retry separados.
- Modal organizado em Meta, Prêmio e Apresentação, com conteúdo rolável, cabeçalho/rodapé estáveis, foco/Escape e feedback de erro.
- Upload/URL de imagem, campos, payload, CRUD, permissões e invalidação de queries mantidos.
- Teste focado `adminMilestones.test.tsx`: 4 testes passaram; `npm run typecheck`, lint focal e `npm run build` passaram.
- Build mantém o aviso já existente de bundle acima de 500 kB. Sem migration, alteração da tela partner, Mobile, publicação ou deploy.
