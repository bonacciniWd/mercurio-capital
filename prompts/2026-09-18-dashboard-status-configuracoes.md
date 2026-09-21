# Plano — Configurações administrativas e semântica de produção/status

## Objetivo

1. Reorganizar a navegação do Admin para que Fluxos, Campanhas, Templates, Feature flags, Integrações e Auditoria sejam acessados dentro da área/tela Configurações, preservando as rotas existentes durante a transição.
2. Tornar explícita a diferença entre produção do período, volume ganho e volume liberado no dashboard administrativo, usando a data correta para cada indicador e a máquina de status real de `propostas`.
3. Adicionar o status operacional `standby` ao Kanban como uma coluna/filtro avulso para retirar processos parados das métricas de acompanhamento sem alterar sua data de criação ou apagar seu histórico.

## Skills e documentos lidos

- `docs/README.md`, `docs/operacao/change-management.md`, `docs/operacao/release-checklist.md`, `docs/operacao/runbooks.md`.
- `docs/09-roadmap.md`, `docs/12-finalizacao.md`.
- `docs/blueprint/01-architecture.md`, `02-roles-permissions.md`, `03-routes-navigation.md`, `04-database-schema.md`, `06-modules-features.md`, `07-integrations-flows.md`, `08-security-compliance.md`.
- Handoffs 12–20, com precedência para os handoffs recentes de financeiro/dashboard.
- `app/package.json`, `mobile/package.json`, `mobile/README.md`, CI, Vitest, ESLint e TypeScript.

## Código e banco inspecionados

- `app/src/layouts/AdminLayout.tsx`, `app/src/pages/admin/Configuracoes.tsx`, `app/src/router.tsx`, `app/src/lib/adminScope.ts`.
- Páginas administrativas de Fluxos, Campanhas, Templates, Feature flags, Integrações e Auditoria.
- `app/src/pages/admin/Dashboard.tsx` e consumidores de `volume_ganho`/`volume_liberado`.
- `supabase/migrations/20260902000001_financeiro_admin_fase2.sql` e `20260902000002_dashboard_admin_analytics_v2.sql`.
- Smoke tests das Fases 29 e 30 e testes web existentes.
- Status de proposta, histórico, liberações e comissões nas migrations e componentes de contrato.

## Decisões e suposições

- A reorganização deve ser somente de navegação/estrutura; não deve duplicar páginas nem alterar permissões RLS/RPC.
- As URLs atuais `/admin/fluxos`, `/admin/campanhas`, `/admin/templates`, `/admin/feature-flags`, `/admin/integracoes` e `/admin/auditoria` serão preservadas ou redirecionadas para manter links existentes, enquanto a navegação visível passa a partir de Configurações.
- O dashboard continuará recebendo agregações por RPC server-side; nenhum cálculo financeiro será transferido para o navegador.
- `propostas.created_at` representa a produção do período: uma proposta criada no mês permanece contabilizada nesse mês, mesmo se cartório, exigência, recurso ou comissão ocorrerem depois.
- `liberacoes_recurso.data_liberacao` representa a data de crédito/liberação e será mantida separada da produção.
- A checagem confirmou que `recurso_liberado` já é status oficial do enum e coluna visível do Kanban, entre `registro_af` e `pagamento_comissao`; não será criado novo status.
- `standby` será um novo valor do enum `proposta_status`, exibido como coluna avulsa no Kanban. A migration será aditiva (`alter type ... add value if not exists`) e a RPC de transição continuará sendo a autoridade; o status poderá ser aplicado e retirado pelo escopo operacional autorizado, com motivo obrigatório registrado no histórico.
- `standby` não muda `created_at`, não transforma produção em outro mês e não entra em volume ganho/liberado. As métricas terão filtros explícitos para incluir/excluir standby, e o resumo global poderá apresentar “em standby” separadamente.
- A proposta de filtro é: “Natura”/esteira operacional cobre `protocolo_cartorio`, `exigencias_cartorio`, `custas_cartorio`, `registro_af` e `recurso_liberado`; “volume liberado” financeiro/comissional começa em `pagamento_comissao` e inclui `completo`. O valor efetivamente liberado continua disponível por `liberacoes_recurso.valor_liberado` e `data_liberacao`, sem ser confundido com produção.
- Status legados (`contrato_registrado`, `em_registro`, `recurso_liberado`) permanecem no enum e não serão reclassificados silenciosamente.

## Modelo de dados e regras de negócio

- Entidades existentes: `propostas`, `proposta_status_historico`, `liberacoes_recurso`, `comissoes`, `financeiro_lancamentos`.
- Não há entidade nova prevista. A mudança deverá ser uma migration aditiva que redefine a RPC analítica, documenta os grupos de status e amplia o smoke test.
- Produção: contagem e `sum(valor_solicitado)` de propostas por `created_at` no intervalo selecionado, independentemente do status posterior.
- Esteira/Natura: classificação por status atual e/ou histórico, com contagem separada para não misturar produção com caixa.
- Volume liberado: classificação aprovada pelo dono do produto, com teste de dois casos: duas propostas criadas no mês; uma finaliza/paga no mês seguinte e outra fica em cartório.

## Arquivos esperados

- `app/src/layouts/AdminLayout.tsx` e `app/src/pages/admin/Configuracoes.tsx`.
- `app/src/router.tsx` e, se necessário, `app/src/lib/adminScope.ts`.
- `app/src/pages/admin/Dashboard.tsx` e tipos/formatadores associados.
- Nova migration `supabase/migrations/YYYYMMDDHHMMSS_dashboard_status_semantics.sql`.
- A migration também deverá adicionar `standby`, ajustar a validação/RPC de transição e registrar o motivo no histórico.
- `supabase/smoke-tests/fase-31-dashboard-status.sql`.
- Testes unitários de classificação, se a lógica compartilhada exigir.
- Documentação operacional/handoff atualizada após a implementação.

## Critérios de aceite

- Configurações exibe links/tabs para os seis módulos administrativos solicitados; o layout não mantém esses módulos como itens irmãos visíveis.
- Acesso direto às rotas antigas continua seguro e funcional, ou redireciona para a nova localização sem quebrar bookmarks.
- Admin full/limitado/jurídico mantém exatamente o escopo autorizado; nenhuma permissão é ampliada.
- O dashboard mostra claramente produção criada, Natura/esteira e volume liberado, com descrições de data e status.
- O caso de duas propostas criadas no mês permanece integralmente na produção desse mês, independentemente de pagamento posterior ou exigência cartorária.
- O caso de R$30 milhões recebidos em período anterior, com apenas R$10 milhões pagos naquele período, separa R$10 milhões pagos de R$20 milhões ainda em processo.
- Smoke SQL transacional verifica status, datas, filtros de parceiro/equipe/fundo e ausência de dupla contagem.

## Segurança

- RLS e helpers de autorização continuam no banco; RPC permanece `security definer`, `set search_path = public`, com `grant` explícito.
- Nenhum token, segredo ou integração será movido para o cliente.
- Migrations publicadas não serão reescritas; rollback será feito por migration forward-fix.
- Não haverá deploy, tag, release ou alteração remota nesta etapa sem autorização separada.

## Testes

Automáticos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.

Banco: reset local, migration nova, `fase-31-dashboard-status.sql` com rollback; validar a RPC para os dois cenários temporais descritos.

Manuais: abrir Configurações como cada nível admin, navegar para os seis módulos, testar acesso direto/redirect, e conferir dashboard com período contendo criação e liberação em meses distintos. A validação visual autenticada no navegador será registrada como executada ou pendente.

## Rollout e rollback

- Aplicar localmente e validar smoke antes de qualquer aplicação remota.
- Caso aprovado e autorizado separadamente, aplicar migration remota, validar RPC e só depois atualizar o frontend.
- Em falha, manter a versão anterior da UI e aplicar forward-fix na RPC/migration; não usar `db reset` em produção.

## Correção aprovada — competência da comissão
O dono confirmou: volume liberado pertence ao mês em que entrou em pagamento_comissao.
Implementar em migration nova: primeira entrada registrada no histórico, horário de São Paulo,
valor_solicitado uma vez por proposta atualmente em pagamento_comissao/completo.
Não usar criação, updated_at, data de conclusão ou crédito como substitutos.
Exibir quantidade e valor sem data comprovada, fora dos totais de período.
Ranking usa agregações separadas para não multiplicar propostas por liberações.
Excluir Standby do volume solicitado e denominador de conversão; preservar contagem de criadas.
Testar criação anterior, entrada/reentrada, conclusão posterior, fronteira de mês,
ausência de histórico e filtros de parceiro. Rollback restaura RPC anterior por forward-fix.

Evidência remota somente leitura: 70 elegíveis, 21 com histórico de entrada e 49 sem entrada registrada. Não completar datas automaticamente.
Smoke Fase 32 aprovado localmente: criação anterior, conclusão, reentrada, ausência de data, fronteira São Paulo, parceiro, ranking e exclusão Standby.
Rollback executável preparado em supabase/rollbacks/20260918000007_dashboard_commission_history.sql; restaura comportamento anterior sem apagar dados.
