# Plano — Relatórios administrativos: leads, propostas e financeiro

## Objetivo

Ampliar `/admin/relatorios` para consolidar métricas de leads, propostas por etapa e entradas financeiras; acrescentar o preset “Mês atual”; e habilitar exportação consistente em PDF e Excel para o mesmo recorte exibido na tela.

O documento registra o modelo aprovado e a implementação local. Nenhum banco de dados, migration ou serviço remoto foi alterado.

## Documentação e skills consultadas

- Instruções `AGENTS.md` fornecidas na conversa.
- `docs/README.md` e o índice da documentação local.
- `docs/blueprint/02-roles-permissions.md`: acesso de admins full, limitado e jurídico.
- `docs/blueprint/04-database-schema.md`: entidades de leads, propostas e financeiro.
- `docs/blueprint/06-modules-features.md`: escopo de `/admin/relatorios`, `/admin/financeiro`, Kanban e status.
- `docs/operacao/criterios-classificador-leads-v1.md`: estados e limites do classificador.
- `prompts/2026-09-28-alinhamento-relatorios-funil.md`: regra existente de período, volume ganho e exclusão de Standby.
- `prompts/2026-09-28-ajuste-visual-filtros-relatorios.md`: seletor de período e exportações atualmente indisponíveis.

Não apliquei skill de UX: o pedido atual é modelar dados e comportamento, sem referência visual nova nem implementação de interface.

## Código e fontes de dados inspecionados

- `app/src/pages/admin/Relatorios.tsx`: presets atuais, intervalo customizado, consultas, KPIs, gráficos, tabela e botões Excel/PDF desabilitados.
- `app/src/lib/propostaStatus.ts`: lista canônica de etapas do Kanban e normalização dos status legados.
- `app/src/components/ui/date-range-picker.tsx`: seleção customizada de datas.
- `app/src/pages/admin/LeadsSimulacoes.tsx`: leitura administrativa da view unificada de leads.
- `app/src/pages/admin/Financeiro.tsx`: filtros e semântica de competência/caixa do módulo financeiro.
- `supabase/migrations/20261030000002_merx_lead_cidade_admin.sql`: view `v_admin_leads_publicos`, unindo leads de simulador, CPC e MERX, com `status_comercial`.
- `supabase/migrations/20261023000001_lead_status_comercial.sql`: status comerciais `novo`, `em_contato`, `qualificado` e histórico de transições.
- `supabase/migrations/20260513000002_identidade.sql`: tabelas `usuarios`, `partners` e `clientes`, incluindo `clientes.usuario_id` opcional.
- `supabase/migrations/20260513000003_originacao.sql`: relação `propostas.cliente_id` e `simulacoes.convertida_em_proposta_id`.
- `app/src/router.tsx` e `docs/blueprint/03-routes-navigation.md`: rota de leads públicos e diferença entre o código atual e a documentação de `/admin/clientes`.
- `supabase/migrations/20260902000001_financeiro_admin_fase2.sql`: `financeiro_lancamentos` e RPC `admin_financeiro_resumo`.
- `supabase/migrations/20260918000007_dashboard_commission_history.sql`: regra vigente do dashboard para volume ganho/liberado e datas.
- `app/package.json`: não declara `xlsx`, `exceljs`, `jspdf` ou `pdf-lib`; não adicionar dependência sem aprovação.

## Modelo e regras propostas

### Período

- Manter Últimos 12 meses, YTD, Trimestre e intervalo customizado.
- Adicionar **Mês atual**, do primeiro dia do mês até hoje, usando datas civis em `America/Sao_Paulo`.
- Todos os blocos e arquivos exportados devem usar exatamente o mesmo intervalo inclusivo. Consultas por timestamp devem usar limite superior exclusivo no início do dia seguinte, evitando perda de registros no último dia.
- Exportar o período selecionado e suas datas explícitas no cabeçalho/identificação do relatório.

### Leads

- Fonte: `v_admin_leads_publicos`, que consolida simulador, crédito para construção e captação pública da MERX.
- **Leads recebidos/cadastrados no período**: uma captura por linha da view cuja `created_at` esteja no intervalo. Na definição confirmada pelo usuário, esse número é o total de possíveis clientes que chegaram pelo simulador, outras rotas públicas ou chat e aparecem em `/admin/leads/simulacoes`; “recebidos” e “cadastrados” descrevem a mesma entrada, não métricas distintas.
- **Leads atendidos**: leads recebidos no período cujo estado comercial atual seja `em_contato` ou `qualificado`; exibir também o critério no relatório.
- **Leads atendidos**: subconjunto do total acima que atualmente está em `em_contato` ou `qualificado`.
- Preservar uma linha/captura por lead na view unificada; não inferir conversões de proposta pelo e-mail.
- Não exportar nome, e-mail ou telefone neste relatório agregado.
- A view não carrega vínculo por ID para `clientes`, conta ativada ou `propostas`. Clientes com conta ativada já têm proposta conforme a regra informada, mas isso não estabelece qual captura originou a proposta; o relatório manterá essas contagens separadas e não chamará a relação de conversão por lead.

### Clientes e contas

- `clientes` é o cadastro da pessoa/empresa usado por uma proposta. `usuario_id` é opcional; a linha pode existir antes de a conta ser ativada.
- Conta de cliente ativada é identificável pelo vínculo `clientes.usuario_id` → `usuarios.id` com `usuarios.role='client'`.
- Conforme regra de produto confirmada pelo usuário, conta de cliente ativada só existe depois de haver proposta registrada para o e-mail do cliente; portanto, propostas criadas e contas ativadas são métricas separáveis, com a conta ativada representando o subconjunto associado a login de cliente.
- `propostas.cliente_id` relaciona cliente à operação; `simulacoes.convertida_em_proposta_id` relaciona algumas simulações internas a uma proposta. Esses vínculos não são chaves de conversão dos leads públicos na view.
- A tela implementada em `/admin/leads/simulacoes` lista leads capturados do site. A documentação descreve `/admin/clientes` e `/admin/clientes/:id`, mas essas rotas não estão presentes no `app/src/router.tsx` atual.

### Propostas

- Fonte primária: `admin_dashboard_analytics` para KPIs existentes e regras consolidadas; `propostas`/`proposta_status_historico` apenas para abrir a distribuição completa das etapas quando necessário.
- Recorte do período: propostas criadas em `created_at` no intervalo civil selecionado.
- Incluir distribuição por todas as etapas canônicas de `PROPOSTA_KANBAN_STATUS`, mais Rascunho/Simulação e Cancelada em grupos explícitos. Normalizar aliases legados (`resolucao_pendencias`, `em_registro`, `contrato_registrado`) para suas etapas equivalentes sem somar duas vezes.
- Mostrar a **etapa atual** dessas propostas no momento da emissão do relatório. O relatório não contará transições como novas propostas; o histórico serve para auditoria/derivação quando a regra exigir.
- Manter Standby visível como etapa operacional separada, mas fora das taxas e volumes operacionais nos mesmos termos já usados pelo dashboard.
- Volume ganho/liberado continua seguindo a regra temporal já definida pelo dashboard; não inferir ganho apenas de status exibido sem respeitar o histórico.

### Financeiro

- Fonte: `admin_financeiro_resumo`, `financeiro_lancamentos`, sem misturar projeção e caixa realizado.
- Bloco implementado: totais monetários de entradas/saídas realizadas e previstas, custos agregados e contagem dos lançamentos previstos/vencidos, sem cruzar previsão com caixa.
- Não incluir descrição, contraparte ou outros detalhes de lançamento na exportação agregada por padrão.
- O dashboard administrativo atual já mostra esses mesmos totais agregados para usuários que acessam a rota base; esta tela reutilizará somente o RPC agregado `admin_financeiro_resumo` com o mesmo controle `app_is_admin()`, sem acessar linhas financeiras nem ampliar o acesso além do dashboard existente.

### PDF e Excel

- Os dois botões existentes devem executar a exportação do mesmo modelo já filtrado e mostrar carregamento/erro/sucesso acessíveis.
- PDF: relatório legível para impressão, com período, horário de geração, indicadores, propostas por etapa, leads e resumo financeiro autorizado.
- Excel: arquivo tabular Excel-compatível com abas separadas para Resumo, Leads agregados, Propostas por etapa e Financeiro agregado; sem PII dos leads.
- Não adicionar dependência; usar exportação nativa e serialização segura com valores explicitamente tipados como texto ou número.
- Conteúdo do Excel e PDF deve corresponder aos filtros e aos números visíveis na página.

## Decisões e suposições para aprovação

1. Preset de mês atual termina em hoje no fuso de São Paulo.
2. “Atendido” significa status comercial atual `em_contato` ou `qualificado`, somente entre os leads criados no intervalo.
3. Etapas representam o estado atual das propostas criadas no período; o relatório não apresenta um histórico de todas as movimentações como contagem adicional.
4. Métricas financeiras separam realizados de previstos e reutilizam o acesso backend agregado existente do Dashboard.
5. Exportações são agregadas e não incluem PII de leads nem detalhes de contraparte financeira.
6. Leads cadastrados no recorte são as capturas mostradas em `/admin/leads/simulacoes`; leads atendidos são o subconjunto `em_contato`/`qualificado`. Clientes ativados já têm proposta, conforme regra informada. A ligação entre captura pública e proposta/conta não possui ID compartilhado na view e precisa ser verificada antes de produzir uma taxa de conversão por lead.

## Arquivos esperados na implementação, após aprovação

- `app/src/pages/admin/Relatorios.tsx` — controles, blocos e exportação.
- `app/src/lib/` — modelagem pura/formatadores de métricas e builders de exportação, se necessário.
- Possível nova migration/RPC segura para autorização e agregação de métricas — somente se as fontes atuais não atenderem às regras de período e papel.
- Testes focados de agregação, período, normalização de status, autorização e consistência de exportações.
- Atualização de `docs/blueprint/06-modules-features.md` e/ou documentação operacional dos relatórios.

## Segurança e papéis

- Preservar RLS e usar RPCs server-side para agregações que envolvam financeiro ou dados administrativos. A autorização `app_is_admin()` do RPC é a mesma já usada pelo Dashboard que exibe estes totais agregados.
- Não enviar PII de leads ao Excel/PDF agregado.
- Limitar datas e volume da consulta; não buscar conjuntos sem limite no client.
- Escapar conteúdo de células e texto exportado para evitar fórmulas executáveis no Excel e HTML/injeção no PDF.
- Não registrar dados de leads ou financeiros em logs de diagnóstico.

## Critérios de aceite

1. “Mês atual” seleciona primeiro dia do mês até hoje em `America/Sao_Paulo`.
2. Presets e intervalo customizado atualizam todos os indicadores, gráficos e exports.
3. Leads recebidos, atendidos e cadastrados usam definições auditáveis e não duplicam fontes.
4. Propostas criadas no período aparecem distribuídas por todas as etapas aplicáveis, com aliases legados normalizados e status terminais explícitos.
5. Standby, canceladas, rascunhos, ganhos e valores são conciliáveis com as regras do dashboard/Kanban documentadas.
6. Entradas previstas e realizadas não se misturam; o relatório reaproveita o RPC agregado e a autorização backend já usados pelo Dashboard.
7. PDF e Excel exportam o mesmo recorte e totais da tela, têm estado de erro/loading e não contêm PII indevida.
8. Typecheck, lint e build passam; testes automatizados cobrem as regras agregadas e de período.

## Verificações previstas

- Automatizadas: typecheck, lint, build e testes unitários/integrados das agregações, status, intervalos, filtros por papel e exportações.
- Manuais no navegador: mês atual, trimestre/YTD/histórico/customizado; período vazio; datas de borda; cada papel admin permitido; geração/abertura de PDF e Excel; reconciliação visual entre tela e arquivos.
- Validar totais contra `admin_dashboard_analytics` e `admin_financeiro_resumo` com o mesmo intervalo e visão, sem executar consultas externas nem aplicar migrations sem aprovação específica.

## Implementação concluída (2026-11-05)

- `app/src/pages/admin/Relatorios.tsx`: preset Mês atual, datas civis de São Paulo, contagem de capturas/atendimentos, tabela de etapas atuais, resumo financeiro por competência e exportações.
- `app/src/lib/adminRelatorios.ts`: funções puras para intervalos, normalização/contagem de etapas, serialização Excel SpreadsheetML e HTML de impressão com escaping.
- `app/src/lib/adminRelatorios.test.ts`: cobertura de virada de data, etapas legadas, células tipadas e escaping.
- `docs/blueprint/06-modules-features.md`: regras e fontes do relatório registradas.
- Nenhuma migration, consulta paga ou alteração de banco foi feita. O front-end de relatórios foi publicado separadamente em 05/11/2026 usando snapshot limpo e escopo allowlisted, deployment `dpl_AwUbwzhvBuMF5MgkiPbg22ksojHf`; ver evidências e limites de validação no plano `2026-11-05-estilizar-pdf-relatorios-admin.md`. Nenhum commit ou push para GitHub foi feito.
- A seção financeira usa o RPC existente de competência; por regra dessa função, um período customizado parcial inclui as competências mensais completas abrangidas. A interface e exportação informam esse limite.
- Exportação PDF abre uma janela de impressão para o usuário escolher “Salvar como PDF”; Excel é entregue como arquivo SpreadsheetML `.xls` com abas e strings tipadas, sem biblioteca externa.
- Teste manual autenticado no navegador e conferência dos totais do banco permanecem pendentes; não foram afirmados como executados.
