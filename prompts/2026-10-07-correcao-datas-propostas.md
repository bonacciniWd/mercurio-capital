# Plano — correção de datas das propostas

## Objetivo

Corrigir a exibição e a edição da data da proposta para que uma data informada em formato brasileiro permaneça no mesmo dia e mês em todas as telas. O caso reproduzido é: ao editar `23/08/2026`, o formulário mostra o valor correto, mas o resumo converte para `22/08/2026`; em alguns pontos o navegador também apresenta a ordem americana.

O escopo é a data de criação/data operacional da proposta já existente. O fluxo de edição continuará usando o contrato atual, mas a conversão entre uma data sem horário (`input[type=date]`) e `timestamptz` será explícita.

## Skills e documentos lidos

- `docs/README.md` — convenções e fonte de navegação;
- `docs/operacao/change-management.md` — menor diff reversível, plano antes do código, testes e gates;
- `docs/blueprint/01-architecture.md` — stack React/Vite/TypeScript e separação de responsabilidades;
- `docs/blueprint/03-routes-navigation.md` — telas de detalhe admin/parceiro;
- `docs/blueprint/04-database-schema.md` — `propostas.created_at` é `timestamptz` e alimenta métricas;
- `docs/blueprint/08-security-compliance.md` — auditoria, RLS e proteção de dados;
- `docs/09-roadmap.md` e `docs/12-finalizacao.md` — dependência das métricas de proposta e gates de release.

## Código inspecionado

- `app/src/pages/admin/PropostaDetalhe.tsx` — resumo, formulário de edição e `toProdutoForm`;
- `app/src/pages/partner/PropostaDetalhe.tsx` — cabeçalho e data da proposta para parceiros;
- `app/src/lib/credito.ts` e demais utilitários de data existentes — nenhuma função comum para data civil foi encontrada;
- `supabase/migrations/20260513000003_originacao.sql` — definição de `propostas.created_at`;
- `supabase/migrations/20260803000002_lote_c_proposta_edicao_responsavel.sql` e `20260807000001_admin_proposta_imoveis_insert.sql` — RPC que hoje recebe `created_at` e faz cast direto para `timestamptz`;
- `app/src/pages/admin/Propostas.tsx` e demais telas — conferência dos pontos que formatam `created_at`.

## Diagnóstico confirmado

1. O formulário inicializa o `input[type=date]` com `p.created_at.slice(0, 10)`.
2. Ao salvar, o frontend envia apenas `YYYY-MM-DD`.
3. O RPC faz `::timestamptz`; o valor vira meia-noite no fuso da sessão do Postgres.
4. A tela converte esse instante novamente para o fuso local com `new Date(...).toLocaleDateString('pt-BR')`, podendo voltar para o dia anterior no Brasil.
5. A formatação sem locale/opções explícitas permite variações `MM/DD/YY` conforme navegador e sistema operacional.

## Decisão técnica

Manter `propostas.created_at` e a RPC existentes, porque essa coluna também é usada por filtros e métricas. O ajuste será feito na fronteira do frontend:

- criar um utilitário puro para converter `timestamptz` em data civil brasileira e para transformar `YYYY-MM-DD` em um timestamp estável ao meio-dia de `America/Sao_Paulo`;
- usar `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })` nas exibições da data da proposta;
- ao salvar o valor do `input[type=date]`, enviar um timestamp com horário explícito no meio do dia brasileiro, evitando a passagem por meia-noite e o deslocamento de dia;
- preservar compatibilidade com registros já editados pelo fluxo antigo: quando o timestamp estiver exatamente em meia-noite UTC, o utilitário tratará o trecho de data UTC como a data civil informada anteriormente;
- não alterar status/histórico, `updated_at`, datas de comissão, vencimentos ou eventos que são instantes reais.

O `input[type=date]` continuará sendo usado para manter acessibilidade e o seletor nativo. Os textos exibidos fora do controle serão sempre `dd/mm/aaaa`; o navegador poderá desenhar o controle nativo conforme o locale do sistema, mas seu valor e o resumo permanecerão brasileiros.

## Modelo de dados e impacto

Não haverá tabela, coluna, migration, RLS, RPC nova ou correção remota automática nesta etapa. A relação permanece:

`propostas.created_at (timestamptz)` → resumo/listas/métricas; o frontend serializa a data civil informada sem perder dia ou mês.

O risco residual é a interpretação de registros históricos criados exatamente à meia-noite UTC, pouco provável para `now()`; o tratamento de compatibilidade fica documentado e não reescreve dados existentes sem uma amostra aprovada.

## Arquivos esperados

- `app/src/lib/dateBr.ts` — helpers puros de data civil e timestamp de edição;
- `app/src/lib/dateBr.test.ts` — regressão para UTC, `America/Sao_Paulo`, dia/mês e timestamp legado;
- `app/src/pages/admin/PropostaDetalhe.tsx` — inicialização, salvamento e resumo;
- `app/src/pages/partner/PropostaDetalhe.tsx` — cabeçalho da proposta;
- `docs/operacao/datas-propostas.md` — contrato de representação e exemplos de teste;
- este plano permanece como registro da mudança.

Não se espera alteração em `mobile/`, Supabase remoto, Edge Functions, integrações, simulador público, Electron ou empacotamento desktop.

## Requisitos e critérios de aceite

1. Informar `23/08/2026`, salvar e recarregar mantém `23/08/2026` no resumo e no campo de edição.
2. Informar datas com meses de um ou dois dígitos não troca mês/dia: `22/01` continua janeiro, não `01/22` ou julho.
3. O resumo, cabeçalho admin e cabeçalho parceiro exibem `dd/mm/aaaa`.
4. Métricas e filtros continuam recebendo o mesmo instante da coluna `created_at`, sem mudança de contrato SQL.
5. Registros legados que foram salvos como meia-noite UTC não aparecem um dia antes.
6. A edição continua restrita ao admin operacional e mantém a auditoria da RPC.
7. Nenhuma data de histórico, comissão ou contrato sofre alteração colateral.

## Segurança

- nenhuma permissão nova e nenhum bypass de RLS;
- nenhuma escrita direta em `propostas` pelo cliente;
- a RPC atual continua sendo a única porta de escrita e o registro de auditoria permanece ativo;
- o utilitário não registra PII nem envia dados para serviços externos.

## Testes

### Automáticos

- `npm run test -- --run`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`.

### Manuais

- abrir uma proposta com data atual e conferir resumo e edição;
- editar `23/08/2026`, salvar, recarregar e conferir as duas telas;
- repetir com `22/01/2026` e `02/12/2026`;
- conferir a data no detalhe admin e no detalhe parceiro;
- abrir histórico e telas financeiras para confirmar que os timestamps continuam com data/hora locais corretos;
- validar em navegador configurado em português e em ambiente UTC, sem alterar a data civil.

## Rollout e rollback

O rollout será somente local até os testes e a validação visual. Não há deploy, migration ou release desktop incluídos.

Rollback: remover os helpers e retornar os três pontos de leitura/escrita ao comportamento anterior. Como não haverá mudança remota, não existe rollback de banco.

## Aprovação necessária

A correção proposta mantém a coluna e a RPC atuais e trata a data como data civil brasileira no frontend. A implementação só começa após aprovação deste plano; qualquer decisão de criar uma coluna `data_proposta date` ou reparar registros históricos em massa será um plano separado.
