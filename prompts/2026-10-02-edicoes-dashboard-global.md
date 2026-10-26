# Plano — Edições do Dashboard Global

## Objetivo

Atender a demanda do Trello em duas frentes, preservando o Dashboard Global
como tela única de indicadores:

1. remover o funil de parceiros do Dashboard Global e exibi-lo na tela de
   Parceiros;
2. incluir no Dashboard Global uma visualização compacta da distribuição de
   operações por fundo, sem criar uma tela nova ou repetir a tela de filtros.

## Referências lidas

- `docs/operacao/assets/trello/Edit_Dashboard1.png`;
- `docs/operacao/assets/trello/Edit_Dashboard2.png`;
- `docs/operacao/change-management.md`;
- `docs/operacao/runbooks.md`;
- `docs/09-roadmap.md`;
- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/pages/admin/Parceiros.tsx`;
- `app/src/components/FunilParceirosCard.tsx`;
- `supabase/migrations/20260918000007_dashboard_commission_history.sql`;
- `supabase/migrations/20260722000001_fundos.sql`.

## Diagnóstico

- `FunilParceirosCard` já implementa o funil da imagem 1 e hoje está dentro
  do Dashboard Global.
- A tela de Parceiros já possui KPIs, lista e detalhe, mas ainda não exibe o
  funil.
- O Dashboard já possui o filtro `Fundo`, mas não apresenta comparação visual
  entre fundos.
- `proposta_fundos` permite mais de um fundo por proposta. A regra de contagem
  para esse caso precisa ser confirmada antes da agregação.

## Decisões propostas

- Reutilizar `FunilParceirosCard`, sem duplicar consulta ou componente.
- Renderizar o funil no topo da tela de Parceiros, antes dos KPIs e da lista.
- Remover somente a renderização do funil no Dashboard; não remover a RPC nem
  a view existentes.
- Adicionar uma RPC administrativa específica para o resumo por fundo,
  respeitando o mesmo intervalo, parceiro, equipe e fundo selecionados, sem
  alterar o contrato de `admin_dashboard_analytics`.
- Exibir essa coleção como um card comparativo dentro do Dashboard Global,
  com quantidade de operações e volume, usando as cores já cadastradas nos
  fundos.
- Quando um fundo estiver selecionado, o card seguirá o filtro e exibirá o
  contexto daquele fundo; com “Todos os fundos”, permitirá comparação.
- Não criar nova rota, nova tabela ou novo módulo de navegação.

## Regra aprovada para atribuição por fundo

- A distribuição deve representar todos os fundos atribuídos à proposta. Uma
  operação pode aparecer em mais de um fundo nas métricas de cobertura e
  atribuição.
- Qualquer valor de operação deve ser contado uma única vez por proposta.
- Para indicadores monetários, a proposta fica atribuída ao primeiro fundo que
  atingir `status_fundo = 'aprovado'`. Aprovações posteriores de outros fundos
  não duplicam o empréstimo nem seu volume.
- A data e o fundo da primeira aprovação precisam ser preservados de forma
  imutável. O modelo atual só guarda `updated_at`, portanto a implementação
  deverá registrar esse evento explicitamente antes de agregar os volumes.
- Propostas sem nenhum fundo aprovado não entram no volume aprovado/liberado
  por fundo; podem aparecer em contagem de atribuições e em um agrupamento
  operacional de “sem fundo vencedor”, se esse estado for exibido.
- O card deve separar visualmente cobertura por fundos de valores financeiros,
  deixando claro que a soma dos fundos representados pode superar o total de
  empréstimos únicos.

## Arquivos esperados

- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/pages/admin/Parceiros.tsx`;
- `app/src/components/FundoDistribuicaoCard.tsx` (se a extração melhorar a
  legibilidade);
- migration forward-safe para preservar o primeiro fundo aprovado e sua data;
- migration forward-safe com a RPC administrativa do agregado por fundo;
- smoke test SQL do agregado por fundo;
- atualização de documentação operacional da demanda.

## Critérios de aceite

- O Dashboard Global não mostra mais o funil de parceiros.
- A tela de Parceiros mostra o mesmo funil, sem duplicação de consultas.
- O Dashboard Global mostra a distribuição por fundos no mesmo período e com
  os filtros de parceiro/fundo aplicados de forma explícita.
- A distribuição mostra todos os fundos representados, sem multiplicar o valor
  da mesma proposta.
- Os indicadores monetários atribuem a proposta somente ao primeiro fundo que
  aprovou, mesmo que outros fundos aprovem depois.
- Cards e distribuição deixam clara a diferença entre atribuições de fundos e
  empréstimos únicos.
- Totais globais existentes, volume ganho, volume liberado e filtros atuais
  permanecem inalterados.
- Admins continuam protegidos pela RPC `security definer` e nenhum dado novo é
  exposto a parceiro ou cliente.

## Segurança e rollback

- Reutilizar a autorização administrativa já aplicada em
  `admin_dashboard_analytics` e `v_admin_funil_parceiros`.
- Não incluir dados pessoais no agregado por fundo.
- Preservar o primeiro evento de aprovação mesmo quando o status de um fundo
  for alterado depois.
- A migration deve substituir a função de forma compatível e manter o retorno
  anterior; em caso de falha, o frontend poderá ocultar o card novo sem perder
  os cards existentes.
- Rollback funcional: reverter o commit do frontend e reaplicar a versão
  anterior da função analítica, sem apagar dados.

## Verificações

- `git diff --check`;
- `npx tsc --noEmit`;
- `npm run lint`;
- `npm run build`;
- smoke SQL do agregado por fundo;
- validação visual autenticada em Dashboard e Parceiros;
- teste com “Todos os fundos”, um fundo específico, período vazio e proposta
  associada a múltiplos fundos.

## Estado da execução em 2026-10-03

- Implementação local do frontend concluída.
- Migration `20261003000001_dashboard_fundos_primeira_aprovacao` aplicada no
  projeto Supabase remoto em 2026-10-03; a primeira tentativa foi corrigida
  porque o histórico continha autores que não existem em `public.usuarios`.
- Smoke test SQL criado; a execução direta do SQL remoto ficou limitada nesta
  máquina porque o CLI exige Docker para o `db dump` e não há cliente SQL
  remoto configurado.
- Registros legados sem evento de aprovação usam `updated_at` como fallback;
  novas aprovações ficam registradas de forma imutável por `aprovado_em`.
- Validação visual autenticada ficou pendente porque não havia navegador
  disponível nesta sessão.
- `supabase migration list --linked` confirma a versão local e remota
  `20261003000001`.
