# Handoff — Fase 2.1: dashboard administrativo profissional

## Entrega local

- Dashboard reorganizado em resumo global, desempenho do período, série temporal, financeiro, funil e ranking.
- Presets padronizados, seletor de intervalo por calendário e filtros por fundo/parceiro refletidos na URL.
- Filtro de rede retirado da consulta enquanto nenhuma proposta possuir atribuição de equipe.
- Componentes locais inspirados em shadcn para botão, popover e date range, sem alterar o design system inteiro.
- Paleta da entrega em preto/cinza e vermelho Mercúrio; nenhum texto ou tab novo usa azul.
- Valores compactos (`1 K`, `10 K`, `100 K`, `1 M`) em cards/eixos e BRL completo em tooltips.
- Gráficos Recharts alimentados por série real da RPC.
- Volume ganho e volume liberado apresentados como métricas diferentes.
- Funil de parceiros restaurado.
- Dashboard e aba Financeiro da proposta explicam onde e como configurar a comissão do parceiro.

## Banco

- Migration `20260902000002_dashboard_admin_analytics_v2.sql` aplicada em `2026-09-03` no projeto confirmado `bhagksfvszeogtjvjtpx`.
- A migration anterior não foi alterada.
- Smoke `fase-30-dashboard-analytics-v2.sql` aprovado.
- Nenhum backfill, lançamento ou liberação artificial foi criado no ambiente remoto.
- Validação remota: 156 propostas, 66 ganhas, R$ 402.696.050,55 solicitados, R$ 125.404.321,54 em volume ganho, 10 parceiros no ranking e zero liberações registradas.

## Validações

- Reset completo do Supabase local com todas as migrations.
- Smokes das fases 29 e 30 aprovados.
- RPC autenticada local retornou série, ranking e volumes separados.
- Typecheck e lint aprovados.
- 69 testes aprovados em 18 arquivos.
- Build de produção aprovado, com o aviso preexistente de chunk principal acima de 500 kB.
- Preview Vercel gerado e validado por HTTP/bundle; navegador integrado indisponível, portanto a validação visual autenticada permanece com o dono do produto.

## Operação

- O `db push` da migration v2 foi executado e um dry-run posterior confirmou o banco remoto atualizado.
- Preview: `https://mercurio-digital-md8tw1rlp-bonacciniwds-projects.vercel.app`.
- Nenhum deploy de produção, tag ou release desktop foi gerado.
- Versão preservada em `0.1.6`.

## Correção local de 2026-09-03 — calendário e reabertura

- O date range voltou a usar os estados oficiais `range_start`, `range_middle` e `range_end` do `react-day-picker`.
- Apenas as extremidades usam vermelho sólido; o miolo do intervalo usa fundo vermelho claro e texto cinza/preto.
- O estado provisório do calendário agora acompanha mudanças de período feitas por presets ou pela URL.
- A justificativa de reabertura deixou de usar `window.prompt` e passou para um modal React acessível e compatível com o renderer Electron.
- O modal valida mínimo de cinco caracteres, normaliza espaços, bloqueia duplicidade durante o envio e mantém erros da RPC visíveis.
- A RPC, a auditoria, o schema e as políticas do Electron não foram alterados.
- Validações: typecheck e lint aprovados; 75 testes aprovados em 21 arquivos; builds web e `desktop:web` aprovados.
- O bundle desktop contém o novo modal e caminhos relativos para carregamento por `file://`.
- Nenhum `app.asar`, instalador, versão, deploy ou release foi produzido; os artefatos `v0.1.6` existentes continuam anteriores a esta correção.
