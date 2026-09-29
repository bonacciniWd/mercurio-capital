# Plano — Alinhamento de período entre relatórios e funil

## Objetivo
Fazer com que cards, evolução, distribuição por produto, ranking e funil do `/admin/relatorios` usem o mesmo intervalo de datas e a mesma fonte analítica do dashboard.

## Código inspecionado
- `app/src/pages/admin/Relatorios.tsx` consulta views históricas sem aplicar o período aos cards, ranking e funil.
- `app/src/pages/admin/Dashboard.tsx` usa `admin_dashboard_analytics` com intervalo explícito.
- `supabase/migrations/20260918000007_dashboard_commission_history.sql` define a fonte atual do dashboard e a regra de volume liberado por primeira entrada em Pagamento de Comissão.

## Decisões
- Reutilizar `admin_dashboard_analytics` no relatório, sem criar uma segunda regra financeira.
- Usar a data de criação para produção, funil e produto; volume liberado seguirá a data de entrada em Pagamento de Comissão.
- Manter standby fora das métricas operacionais, preservando o card global quando aplicável.
- Não alterar exportação Excel/PDF nesta etapa, pois os botões ainda estão desabilitados.

## Critérios de aceite
1. Alterar mês, YTD, trimestre ou intervalo customizado atualiza todos os blocos.
2. O funil e a tabela não exibem dados de outro período.
3. Estados vazios aparecem quando o intervalo não possui propostas.
4. Volume liberado segue a regra histórica do dashboard.
5. Typecheck, lint e build passam sem novos erros.

## Segurança e testes
- A autorização continua no RPC admin server-side.
- Nenhum dado privado será filtrado somente no navegador para substituir RLS.
- Testar intervalo vazio, intervalo com propostas, trimestre e histórico.
