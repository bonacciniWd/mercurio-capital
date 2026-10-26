# Correção do filtro Trimestre no Dashboard Global

## Objetivo

Fazer o atalho **Trimestre** consultar os últimos três meses até a data atual. Em 08/10/2026, o intervalo esperado é 08/07/2026 a 08/10/2026. Assim, operações de setembro aparecem tanto em **30 dias** quanto em **Trimestre** quando pertencem aos dois intervalos.

## Skills e documentos lidos

- Instruções `AGENTS.md` fornecidas pelo dono do produto nesta conversa; nenhuma skill externa se aplica a esta correção.
- `docs/README.md`;
- `docs/operacao/change-management.md`;
- `docs/handoffs/19-handoff-fase2-financeiro-admin.md`;
- `prompts/2026-09-02-fase-2-dashboard-financeiro.md`;
- `prompts/2026-10-02-edicoes-dashboard-global.md`.

## Código inspecionado e diagnóstico

- `app/src/pages/admin/Dashboard.tsx`: **30 dias** inicia em hoje menos 29 dias; **Trimestre** inicia no primeiro dia do trimestre calendário. Em 08/10/2026, isso gera 09/09–08/10 e 01/10–08/10, respectivamente. `activePreset` repete a mesma definição de trimestre.
- `app/src/components/ui/date-range-picker.tsx`: apresenta o intervalo recebido pelo dashboard; não redefine as datas.
- `app/src/lib/financeiro.ts`: `localDateISO` serializa datas locais sem conversão UTC.
- `supabase/migrations/20260918000007_dashboard_commission_history.sql`: a RPC agrega dados conforme `p_inicio` e `p_fim`, com limites de dia no fuso de São Paulo. O intervalo trimestral curto, informado pelo cliente, explica os zeros observados; não há evidência de multiplicação por fundos nesta divergência.
- Nos prints de 08/10, 30 dias mostra 26 propostas e dois ganhos; o trimestre calendário mostra cinco propostas e zero ganhos. Isso é coerente com os intervalos exibidos e a regra atual da consulta.

## Decisões e suposições

- Decisão do dono do produto: **Trimestre = últimos três meses até hoje**, incluindo setembro no exemplo de 08/10/2026.
- Aplicar subtração de três meses à data civil local de hoje, preservando o dia quando ele existir; em fim de mês, ajustar para o último dia do mês de destino. O final continua sendo hoje.
- `Mês`, `30 dias`, `Ano` e `Todo histórico` mantêm suas regras atuais.
- O resumo global continua independente do período; métricas, gráficos e card de fundos seguem o intervalo selecionado.

## Arquivos esperados

- `app/src/pages/admin/Dashboard.tsx`: cálculo e reconhecimento do atalho trimestral usando a mesma regra.
- Teste focado do cálculo do período, se a extração para função pura for necessária para testar limites de mês/ano.
- Este plano, atualizado com o resultado das verificações.

## Modelo de dados

Sem mudanças em tabelas, campos, relacionamentos, RLS ou RPCs. O dashboard continuará enviando `p_inicio` e `p_fim` para as consultas administrativas existentes.

## Requisitos e critérios de aceite

1. Em 08/10/2026, selecionar **Trimestre** mostra 08/07/2026–08/10/2026.
2. O botão permanece selecionado após atualizar a página ou abrir o link com esse intervalo.
3. As métricas do trimestre incluem todos os registros de 30 dias que satisfazem os mesmos filtros de fundo/parceiro e a mesma regra de competência.
4. Alternar entre os atalhos atualiza datas, métricas, série, financeiro e distribuição por fundo sem apresentar valores antigos como se fossem do novo intervalo.
5. Limites de fim de mês e virada de ano geram datas válidas.

## Segurança, rollout e rollback

- Apenas datas enviadas às RPCs administrativas mudam; autenticação, permissões, dados e valores persistidos permanecem intactos.
- Nenhuma migration, Edge Function ou alteração de RLS. Mobile e Electron permanecem fora deste ajuste; publicação web ou release requer aprovação separada, conforme `docs/operacao/change-management.md`.
- Reverter o diff do cálculo do filtro caso a validação mostre comportamento inesperado.

## Testes manuais e automáticos

- Testar o cálculo do intervalo em 08/10/2026, 31/05/2026 e 02/01/2027, incluindo reconhecimento do preset.
- Executar teste automatizado focado, `npm run typecheck`, `npm run lint`, `npm run build` e `git diff --check` em `app/` quando aplicável.
- Testar no navegador autenticado: **Trimestre**, **30 dias**, filtros de fundo/parceiro, ausência de dados, erro e atualização da página. Registrar qualquer limitação do ambiente sem afirmar validação que não foi executada.

## Resultado da implementação em 2026-10-08

- O período trimestral móvel foi extraído para `app/src/lib/dashboardPeriod.ts`; botão e reconhecimento do preset usam a mesma função.
- `app/src/lib/dashboardPeriod.test.ts` cobre 08/10/2026, ajuste de fim de mês e virada de ano.
- Teste focado: 3 testes aprovados.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado, com 38 avisos preexistentes em outros arquivos e nenhum erro.
- `npm run build`: aprovado; Vite manteve o aviso preexistente de chunk principal acima de 500 kB.
- `git diff --check`: aprovado.
- Smoke visual no Chrome autenticado em `localhost:5173`: em 08/10 o filtro mostrou `08 jul 2026 — 08 out 2026`, ficou selecionado após clicar, e carregou 135 propostas, 33 em estados de ganho e R$ 76.795.229,00 em volume ganho. O filtro anterior de 30 dias mostrava 26 propostas, 2 ganhos e R$ 18.184.229,00. As métricas de setembro passaram a compor o trimestre conforme solicitado.
- Não foi feito deploy ou alteração de dados/migrations.
