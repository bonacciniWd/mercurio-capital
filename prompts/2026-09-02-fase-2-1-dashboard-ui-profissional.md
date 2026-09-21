# Fase 2.1 — Dashboard administrativo profissional

## Status

Implementacao concluida e validada localmente. A migration analitica v2 foi aplicada no projeto remoto confirmado, e um preview Vercel foi publicado para homologacao. Deploy de producao e release desktop continuam pendentes de aceite visual/autorizacao operacional.

## Objetivo

Corrigir a regressao visual e de leitura de dados do `/admin`, adotando componentes consistentes no estilo shadcn, sem alterar a identidade cromatica Mercurio, e tornar explicito o fluxo de configuracao da comissao do parceiro dentro de cada proposta.

## Documentos e codigo inspecionados

- instrucoes `AGENTS.md` fornecidas ao repositorio;
- `prompts/2026-09-02-fase-2-dashboard-financeiro.md`;
- `docs/handoffs/19-handoff-fase2-financeiro-admin.md`;
- `app/src/index.css`;
- `app/src/components/Button.tsx`;
- `app/src/components/KPICard.tsx`;
- `app/src/components/FunilParceirosCard.tsx`;
- `app/src/components/PropostaCondicaoComercial.tsx`;
- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/pages/admin/Financeiro.tsx`;
- `app/src/pages/admin/PropostaDetalhe.tsx`;
- `supabase/migrations/20260902000001_financeiro_admin_fase2.sql`;
- dados agregados remotos, consultados sem exibir PII.

## Diagnostico confirmado

- O seletor global de `button` aplica o estilo liquid preto a controles que deveriam ser neutros.
- A RPC filtra datas e parceiro/fundo corretamente, mas o intervalo ativo nao fica claro na interface.
- `liberacoes_recurso` esta vazio; portanto, volume liberado real e top parceiros por liberacao sao zero.
- Existem 156 propostas, 66 em estados ganhos e valores solicitados reais que podem sustentar uma metrica separada de volume ganho/originado.
- O filtro de rede atual nao possui fonte: existem equipes, mas nenhuma proposta tem `equipe_id`.
- O dashboard perdeu o funil global existente.
- Recharts esta instalado; nao existe date picker de calendario instalado.
- A comissao e configurada em `/admin/propostas/:id`, aba `Financeiro`, acao `Nova versao`, mas essa descoberta nao e comunicada ao admin.

## Decisoes e suposicoes propostas

- Nao chamar `valor_solicitado` de valor liberado.
- Exibir separadamente:
  - `Volume ganho`: soma do valor solicitado das propostas em estados comerciais ganhos;
  - `Volume liberado`: soma exclusiva de `liberacoes_recurso`.
- Restaurar o funil global e manter KPIs de periodo separados do resumo global.
- Ocultar/desabilitar o filtro Rede enquanto nao houver atribuicao canonica de equipe por proposta, com texto explicativo; nao retornar zeros enganosos.
- Implementar componentes locais inspirados em shadcn, usando os tokens atuais; nao executar o gerador shadcn nem alterar o design system inteiro.
- Adicionar `react-day-picker`, `date-fns` e `@radix-ui/react-popover` somente para o date-range picker acessivel.
- Usar abreviacao `1 K`, `10 K`, `100 K`, `1 M` em eixos/cards compactos; tooltip sempre mostra BRL completo.
- Uma migration nova substituira a RPC ja publicada. A migration aplicada nao sera editada.

## Arquivos esperados

- novos primitives em `app/src/components/ui/` para button, popover e date-range picker;
- helper de numeros compactos em `app/src/lib/financeiro.ts` e testes;
- revisao de `app/src/pages/admin/Dashboard.tsx`;
- ajustes de orientacao em `app/src/pages/admin/Financeiro.tsx`;
- revisao de `app/src/components/PropostaCondicaoComercial.tsx`;
- ajuste de navegacao em `app/src/pages/admin/PropostaDetalhe.tsx`, se necessario;
- nova migration corretiva para series, resumo global e volumes separados;
- smoke test complementar.

## Requisitos e criterios de aceite

- Nenhum botao preto/liquid no dashboard e em seus filtros.
- Botoes com estados default, hover, focus, disabled e active consistentes.
- Date picker por intervalo, presets e datas refletidas na URL.
- Intervalo invalido nao consulta o banco e mostra mensagem clara.
- Grafico temporal real com propostas/volume por periodo e ranking populado pelo volume ganho quando nao ha liberacoes.
- Valores compactos corretos em cards/eixos e completos no tooltip.
- Resumo global continua exibindo 156/87/66/6/37 enquanto o periodo muda apenas metricas temporais.
- Volume liberado zero aparece como fonte ainda nao registrada, nao como ausencia geral de operacao.
- Funil de parceiros restaurado.
- Filtros por parceiro e fundo reconciliam com a RPC.
- O admin encontra instrucoes e link direto: `Proposta > Financeiro > Nova versao`.
- A tela da proposta separa visualmente receita bruta Mercurio e comissao do parceiro.
- Layout responsivo e cores atuais preservadas.

## Seguranca e dados

- Nenhum valor financeiro sera inventado ou retroativamente gravado.
- `valor_solicitado`, receita Mercurio, comissao e liberacao permanecem grandezas distintas.
- A UI nao recebera tokens privados e continuara usando RPC autenticada.
- O filtro de rede nao sera simulado sem relacao de dados confiavel.
- Migration remota, deploy e release exigem validacao local e autorizacao operacional posterior.

## Testes

- testes unitarios da formatacao compacta e intervalo de datas;
- smoke SQL cobrindo resumo global, serie temporal, fundo e parceiro;
- `npm run typecheck`;
- `npm run lint -- --quiet`;
- `npm test`;
- `npm run build`;
- teste autenticado local das RPCs;
- validacao visual desktop e mobile no navegador, quando disponivel;
- comparacao dos totais da UI com os agregados conhecidos do banco.
