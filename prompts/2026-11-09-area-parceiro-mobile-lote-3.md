# Plano — área Parceiro mobile: Lote 3

Data: 09/11/2026. Estado: plano para aprovação. O Lote 1 (Perfil/base) e o Lote 2 (Simulações, Comissões, Equipe, Relatórios e Universidade) foram implementados localmente e validados tecnicamente. Este lote cobre Carteira, Promoções, Propostas e Início.

## Objetivo

Concluir as quatro abas operacionais principais do Parceiro com dados reais, permissões existentes, estados de carregamento/erro/vazio e a identidade visual escura já validada. Preservar as fontes e regras de negócio do banco; não criar dados demonstrativos para preencher a tela.

## Skills e documentos consultados

- `AGENTS.md` fornecido nesta conversa.
- `docs/README.md`, `docs/09-roadmap.md`, `docs/12-finalizacao.md` e `docs/operacao/2026-11-09-levantamento-area-parceiro-mobile.md`.
- `prompts/2026-11-09-area-parceiro-mobile-funcional-visual.md` e `prompts/2026-11-09-area-parceiro-mobile-lote-2.md`.
- Blueprints de permissões, rotas e módulos; handoffs dos domínios de carteira, milestones e propostas.
- Código mobile atual de `carteira.tsx`, `promocoes.tsx`, `propostas.tsx`, `dashboard.tsx`, `_layout.tsx`, helpers de autenticação/escopo e componentes visuais do Parceiro.
- Referências web equivalentes e migrations/RPCs existentes de carteira, promoções, propostas, métricas e etapas.

## Modelo de dados e regras

Sem novas tabelas ou migrations neste lote.

- **Carteira:** `partner_wallet_summary` é a fonte do saldo e dos agregados; `v_wallet_extrato` é a fonte do extrato; `precos_consulta` é a fonte de preços vigentes; `wallet-topup` cria o checkout e o webhook confirma o status de `wallet_topups`. Valores permanecem em centavos.
- **Promoções:** `partner_milestones` define metas, prêmios e imagens; `partner_milestones_progress` define o progresso do parceiro. A maior meta é escolhida pela ordenação/dados retornados, sem lista hardcoded como fonte de operação.
- **Propostas:** `propostas` e relações permitidas por RLS são a fonte de lista e detalhe. Busca, produto, status e paginação são filtros de leitura; o início/alteração de etapa continua sob as ações e autorizações já existentes.
- **Início:** consolida métricas já expostas por `v_partner_dashboard_kpis` e as listas permitidas por RLS. Não duplicar cálculo financeiro nem apresentar saldo de carteira como volume de propostas.
- **Membro de equipe:** pode consultar somente o que as policies já liberam; recarga, gestão e ações financeiras continuam exclusivas do parceiro responsável.

## Decisões de implementação

1. Reutilizar `PartnerScreen`, `PartnerCard`, ações, tokens escuros e barra customizada do Lote 1/2.
2. Carteira exibirá saldo, bloqueio, créditos/débitos, extrato e preços; estados de recarga pendente, cancelada, falha e confirmação serão distintos. Não simular crédito quando Stripe/webhook não confirmarem.
3. Promoções exibirá o progresso retornado pelo banco, meta atual, próximas metas e estado vazio/erro. Imagens privadas continuarão sendo carregadas por URL assinada ou fonte pública já configurada.
4. Propostas terá busca por protocolo/nome, filtros por status/produto, paginação incremental e navegação para o detalhe existente. O status será exibido com o dicionário canônico do domínio; não usar rótulos inventados.
5. Início mostrará um resumo curto de propostas, volume, conversão e pendências, com atualização manual e links para as telas detalhadas. Cada indicador terá sua fonte identificável no código.
6. Nenhuma nova dependência, migration, RPC, Edge Function, cobrança, convite, alteração remota, build de produção, deploy ou publicação neste lote.

## Arquivos esperados

- `mobile/app/(parceiro)/carteira.tsx`
- `mobile/app/(parceiro)/promocoes.tsx`
- `mobile/app/(parceiro)/propostas.tsx`
- `mobile/app/(parceiro)/dashboard.tsx`
- Helpers/components de Parceiro somente se houver reutilização clara; sem alterar fontes web.
- Atualização deste plano com o resultado e validações.

## Critérios de aceite

- Carteira mostra saldo/extrato/preços do parceiro correto; recarga só aparece habilitada para o papel autorizado; status do checkout não é tratado como crédito confirmado.
- Promoções não mostra valores/prêmios hardcoded como se fossem dados atuais; progresso, metas, imagens, carregamento, erro e ausência de metas são distinguíveis.
- Propostas permite buscar, filtrar, carregar mais, abrir detalhe e tratar lista vazia/erro sem perder a sessão; a paginação não duplica nem perde registros.
- Início carrega sem duplicar chamadas inconsistentes, mostra zero real como zero e permite atualizar/re tentar; links abrem as abas/detalhes corretos.
- Parceiro e membro de equipe veem somente ações permitidas; cache/query keys são separados por usuário quando necessário.
- Visual mantém fundo escuro, contraste, alvos de toque de pelo menos 44 pt, safe area, leitura em fonte ampliada e estados de loading/erro/vazio.

## Segurança e validação

- Nenhum token privado ou service role no cliente; todas as consultas usam a sessão atual e RLS.
- Não executar recarga real, confirmar pagamento, alterar etapa, publicar milestone ou modificar registros durante os testes.
- Rodar `npm run typecheck`, testes existentes e testes focados de filtros/paginação/escopo, `git diff --check` e export dos bundles iOS/Android.
- Homologar no iPhone com conta de parceiro e membro: Carteira sem recarga real, Promoções com progresso, Propostas com filtros/paginação/detalhe e Início com atualização/erro/vazio.

## Rollout e rollback

Implementação local isolada nos quatro arquivos e helpers estritamente necessários. Reverter pelo diff deste lote, sem apagar dados, alterar migrations ou tocar nos lotes anteriores. Build nativo, deploy e publicação continuam gates separados.

## Resultado da implementação local

- Propostas agora usa filtros server-side por produto/etapa, paginação de 25 registros, busca no lote carregado, estados de erro/vazio e navegação para o detalhe.
- Promoções passou a usar `partner_milestones_progress()` e o catálogo ativo `partner_milestones`; os valores de progresso, metas, prêmios e descrições não vêm mais de uma lista fixa como fonte operacional.
- Início passou a usar o shell visual do Parceiro, atualização conjunta das consultas e feedback separado para falha dos indicadores.
- Carteira recebeu a base visual escura do Parceiro, mantendo saldo, extrato, preços, bloqueio e o checkout existente; não houve recarga real durante a validação.
- `npm run typecheck` passou, 11 testes passaram e o `git diff --check` dos arquivos do lote passou. A exportação Expo iOS/Android usada como baseline do lote anterior continua disponível; ainda falta homologação visual/funcional deste lote no aparelho.
