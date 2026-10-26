# Plano — UI da Rede e edição direta do organograma interno

## Objetivo

Melhorar a interface de `/admin/rede`, tornando o mapa legível e permitindo movimentar os cards. No organograma interno, selecionar uma pessoa e atribuir cargo, departamento e gestor diretamente na mesma tela, com gravação pelas RPCs existentes.

Escopo confirmado pelo usuário: **arrastar cards e alterar gestor interno**. Transferir equipes entre parceiros não faz parte desta mudança.

## Documentos e skills consultados

- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- `docs/README.md`.
- `docs/operacao/change-management.md`, `security-checklist.md` e `release-checklist.md`.
- `docs/blueprint/02-roles-permissions.md`, `04-database-schema.md` e `06-modules-features.md`, seções de equipe interna e Rede.
- `prompts/2026-10-13-cadastro-equipe-organograma-interno.md`: modelo e decisões previamente aprovados.
- Documentação local de `@xyflow/react` em `app/node_modules/@xyflow/react/dist/esm/types/component-props.d.ts`: eventos de movimentação, seleção e conexão.
- Nenhuma skill adicional é necessária. A implementação utiliza a stack e os componentes existentes.

## Código e configuração inspecionados

- `app/src/pages/admin/Rede.tsx`.
- `app/src/components/rede/RedeFlow.tsx`, também consumido por `/p/equipe`.
- `app/src/components/admin/EquipeInterna.tsx`: cadastro organizacional e organograma atual.
- `app/src/lib/internalOrg.ts`, `internalOrg.test.ts` e `adminScope.ts`.
- `app/src/auth/types.ts` e `app/package.json`.
- `app/src/index.css`: skin global liquid e exclusão por `btn-no-liquid`.
- `supabase/migrations/20261013000001_equipe_interna_organograma.sql` e `20261013000002_equipe_interna_rpc_privileges.sql`.
- `supabase/migrations/20260520000030_fase13_analytics.sql`: leitura da rede de originação.
- Navegador local autenticado: inspeção visual das abas Rede de originação e Organograma interno. Nenhuma gravação realizada.

## Diagnóstico

- O canvas de originação recebe `nodes` controlados, mas não trata `onNodesChange`: declarar `nodesDraggable` não basta para manter as posições alteradas.
- A disposição de todos os parceiros numa linha muito extensa reduz a escala do enquadramento e a legibilidade dos cards.
- O organograma usa containers HTML recursivos com largura fixa; não possui canvas interativo nem edição pela seleção do colaborador.
- Cargo, departamento e gestor já podem ser editados pelas RPCs do cadastro interno. A mudança traz esse fluxo à Rede, sem criar outro modelo organizacional.
- `/admin/rede` é acessível a administradores full, limitado e jurídico. Somente full pode alterar perfis e catálogos.

## UI e comportamento propostos

### Estrutura da página

- Manter a navegação compartilhada do Admin e as duas abas existentes.
- Seguir o padrão visual já aprovado em Aprovações/Propostas: fundo cinza claro, superfícies brancas, bordas discretas, tipografia compacta, vermelho para seleção e ações principais.
- Cabeçalho com título e descrição; toolbar com busca, filtros e ações agrupadas; canvas ocupando a área útil da tela, com altura responsiva.
- Todos os controles específicos da página usam o opt-out `btn-no-liquid`, evitando que o tema global altere cores, display ou espaçamento.

### Rede de originação

- Preservar os status e limites atuais da consulta e a separação entre parceiros/equipes.
- Melhorar cards, conexões, estado selecionado e a distribuição dos ramos para reduzir sobreposição e extensão horizontal excessiva.
- Permitir arrastar cards e navegar pelo canvas, com zoom, enquadrar e reorganizar a disposição.
- Buscar/localizar parceiro ou equipe e focar o resultado sem remover conexões necessárias à compreensão do ramo.
- Substituir rótulos técnicos de interface, como `Refresh MVs`, por ação compreensível. Preservar o contrato existente de atualização e apresentar erro/loading.
- Não alterar vínculos de parceiros/equipes. A apresentação específica do Admin não deve mudar a aparência de `/p/equipe`, que compartilha o componente.

### Organograma interno

- Usar React Flow, já instalado, com cards de nome, foto/iniciais, cargo e departamento e linhas representando o gestor direto.
- Disposição hierárquica com espaçamento suficiente para vários níveis e pessoas sem gestor. Ausência de foto/cargo/departamento não impede a renderização.
- Arrastar um card muda sua posição visual; não troca o gestor automaticamente.
- Clicar no card abre painel lateral de detalhes. Para admin full, o painel permite atribuir cargo, departamento e gestor, além de editar a data de início já existente.
- O gestor pode ser alterado no painel ou por conexão explícita entre cards; a conexão prepara a alteração para revisão e confirmação antes de gravar.
- Seleção de gestor exclui a própria pessoa e seus descendentes. O backend continua validando ciclos, usuário ativo e papel administrativo.
- Criar cargo ou departamento a partir do painel, mediante envio explícito do formulário, usando o catálogo existente; a opção recém-criada fica disponível para atribuição.
- Exibir gestor atual e distinguir alterações pendentes de dados salvos; guardar os ajustes somente ao confirmar. Erro mantém o formulário para correção.
- Administradores limitado/jurídico consultam o organograma e movimentam a visualização, mas não recebem controles de escrita nem consultas de cadastro/catálogo exclusivas de admin full.
- Em telas estreitas, o painel fica abaixo do canvas ou em drawer responsivo, mantendo campos e ações utilizáveis.

## Decisões e suposições para aprovação

- A direção visual é a da área administrativa recém-aprovada; não foi fornecido um novo componente de referência para esta rota.
- Posições arrastadas ficam no estado da visualização enquanto a página está aberta. Recarregar ou escolher Reorganizar aplica o layout automático. Persistir coordenadas no servidor não entra neste escopo.
- Alterar gestor é uma ação organizacional persistente e exige confirmação explícita; movimentar o card no canvas é apenas visual.
- Cargo organizacional não altera `role` ou `admin_nivel`.
- Não haverá biblioteca, migration ou Edge Function nova; reaproveitar as capacidades já existentes. Se a verificação identificar uma dependência ausente no ambiente, registrar o bloqueio antes de qualquer implantação.
- Cadastro de usuários, convites e upload/troca de foto continuam no cadastro interno existente. No organograma, a foto é exibida e preservada na gravação dos demais campos.

## Modelo de dados e regras

Modelo existente, sem nova tabela/coluna:

- `usuarios`: identidade central; `auth.users` mantém a identidade de login.
- `usuarios_internos`: relação 1:1 por `usuario_id`; `cargo_id`, `departamento_id`, `gestor_usuario_id`, `foto_path` e `data_inicio` opcionais. Cada pessoa tem no máximo um gestor; um gestor pode ter vários subordinados.
- `cargos_internos` e `departamentos_internos`: catálogos reutilizáveis com nome e indicador `ativo`; valores ativos disponíveis para novas atribuições.
- `admin_internal_team_graph`: leitura mínima para admins; `admin_internal_team_list` e `admin_internal_team_catalogs`: dados de edição somente para full.
- `admin_internal_team_update`: gravação autorizada e auditada de cargo/departamento/gestor; preservar `foto_path` e demais atributos que não foram alterados. Não enviar nulos acidentais para campos existentes.
- `admin_internal_team_catalog_upsert`: criação explícita de cargos/departamentos por admin full.
- Triggers existentes rejeitam auto-gestão, ciclos e gestor que não seja admin ativo.
- `avatares-internos` permanece privado, com URLs assinadas de 300 segundos.

## Arquivos esperados

- `app/src/pages/admin/Rede.tsx` e novo CSS escopado à rota.
- `app/src/components/rede/RedeFlow.tsx`: interação controlada e opções específicas para o Admin, preservando os consumidores existentes.
- Novo componente de organograma/editor em `app/src/components/rede/`.
- `app/src/components/admin/EquipeInterna.tsx` somente se necessário para extrair/reutilizar tipos ou o organograma atual; preservar o cadastro em Configurações.
- `app/src/lib/internalOrg.ts` e teste: layout, descendentes e validação da proposta de vínculo.
- Novos testes de componente em `app/src/test/` para seleção, permissões, payload, erros e atualização após salvar.
- Ajustes pontuais na documentação de módulos/permissões para registrar edição na Rede por admin full.
- Preservar os diffs locais preexistentes e evitar alterações não relacionadas.

## Impacto

- Web: UI de `/admin/rede`, canvas e editor organizacional.
- Mobile nativo: não afetado; responsividade da página web incluída.
- Banco/migrations/RLS: nenhuma alteração; mesmas entidades, RPCs e permissões.
- Edge Functions/integrações: não afetadas.
- Electron: recebe a mesma UI em futura publicação web/desktop; sem empacotamento nesta tarefa.
- Segurança/operação: preservar autorização server-side, auditoria existente, Storage privado e escopo de leitura por perfil.
- Deploy/release: não incluídos.

## Critérios de aceite e testes

- As duas abas carregam com os dados reais atuais, preservando loading, erro e estado vazio.
- Cards podem ser arrastados sem retornar imediatamente à posição anterior. Enquadrar/reorganizar funciona e nenhum arraste realiza RPC de escrita.
- Busca e filtros não produzem um organograma visualmente incoerente; os caminhos de gestão necessários permanecem compreensíveis.
- Admin full seleciona pessoa e salva cargo/departamento/gestor na própria rota; dados continuam corretos após nova leitura.
- Troca de gestor não limpa foto/data de início/cargo/departamento sem solicitação explícita.
- Auto-gestão e ciclos são bloqueados antes do envio e erros server-side são tratados sem afirmar sucesso.
- Usuários de leitura não executam listagens exclusivas de full nem mutações por controles da tela.
- Controles não herdam skin liquid; validar cores, legibilidade, foco e rolagem.
- Automáticos: layout com vários ramos/profundidades e sem sobreposição; prevenção de ciclos; seleção, gravação/payload e falhas com Supabase mockado; cobertura de admin full e leitura.
- Verificações: lint, typecheck, testes pertinentes e build em `app/`.
- Navegador: desktop e tela estreita; arraste, zoom, busca, seleção, campos vazios e formulário inválido. Registrar capturas antes/depois.
- Não salvar cargos, departamentos ou gestores de funcionários reais apenas para testes. Persistência automatizada usa mocks; smoke de escrita no banco, se necessário, requer fixture sintético e autorização específica.

## Rollout e rollback

- Implementar localmente após aprovação deste plano, sem publicar ou modificar dados organizacionais reais na validação.
- Rollback restrito aos novos diffs desta tarefa; preservar alterações anteriores. Não remover registros, contas ou vínculos para desfazer UI.
- Publicação Vercel/Supabase e testes remotos de escrita permanecem sujeitos a autorização específica.

## Implementação e validação — 22/10/2026

- Plano aprovado pelo usuário. UI local implementada com canvas e editor do organograma; catálogos e perfis usam as RPCs existentes e respeitam admin full versus leitura.
- O organograma antigo em `EquipeInterna.tsx` foi substituído por reexport do componente compartilhado novo. O cadastro de Configurações foi preservado.
- Incluídos helpers `redeLayout.ts` e `networkNodes.ts`: disposição administrativa e atualização dos nós sem descartar medidas do React Flow. Cards de dimensão fixa declaram suas dimensões e conectores para manter as linhas após atualização/seleção.
- Testes pertinentes: **5 arquivos / 22 testes aprovados**, incluindo hierarquia/ciclos, preservação de foto/campos, permissões, erros, criação de catálogo e atualização do canvas.
- `npm run lint`: zero erros, 38 avisos preexistentes. Os arquivos ajustados após essa rodada também passaram no lint pontual.
- `npm run typecheck`: aprovado. Build web local aprovada; permanece o aviso de chunk acima de 500 kB já existente no projeto.
- Navegador autenticado: inspeção inicial das duas abas com dados publicados, sem escrita. Na retomada, a sessão havia expirado; a validação final do navegador usou uma instância temporária do Vite com os componentes reais e módulos de auth/Supabase substituídos por fixtures sintéticos.
- Chrome via CDP, 1440 × 1000 e 480 × 960: arraste efetivo nas duas abas; edição, confirmação e salvamento sintético; sete conexões e todos os cards visíveis após salvar; seleção centralizada no mobile; nenhuma rolagem horizontal; todos os controles da rota fora do skin liquid.
- Conexão real entre handles no navegador: o vínculo proposto preencheu o gestor no painel, exigiu confirmação e não executou gravação automática.
- Nenhum cargo, departamento, gestor ou conta real foi criado/alterado nos testes. Nenhum deploy ou migration foi executado.
- Capturas sintéticas locais: `/tmp/mercurio-rede-desktop-sintetico.png`, `/tmp/mercurio-organograma-desktop-sintetico.png` e `/tmp/mercurio-organograma-mobile-sintetico.png`. Relatório local: `/tmp/mercurio-network-smoke-report.json`.
