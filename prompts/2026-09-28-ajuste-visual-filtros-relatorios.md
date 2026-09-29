# Plano — Ajuste visual dos filtros de Relatórios

## Objetivo
Corrigir contraste, hierarquia e seleção de período no cabeçalho de `/admin/relatorios`, seguindo o padrão visual já usado no Dashboard.

## Código consultado
- `app/src/pages/admin/Relatorios.tsx`
- `app/src/components/ui/date-range-picker.tsx`
- `app/src/index.css`
- `app/src/components/ui/button.tsx`

## Decisões
- Reutilizar `DateRangePicker` compartilhado em vez de manter dois campos nativos de data.
- Manter os presets Últimos 12 meses, YTD e Trimestre.
- Quando um período customizado for selecionado, os presets ficam desabilitados até limpar o período.
- Forçar o seletor de preset a usar o esquema claro do admin e contraste navy/vermelho.
- Exportações continuam desabilitadas porque a implementação ainda não existe.

## Critérios de aceite
- O seletor de período não aparece com menu escuro de baixo contraste.
- O período customizado mostra calendário acessível e datas legíveis.
- O estado ativo usa vermelho Mercurio; estados neutros usam navy/silver.
- Layout permanece responsivo em desktop e larguras menores.
- Typecheck, lint e build passam.
