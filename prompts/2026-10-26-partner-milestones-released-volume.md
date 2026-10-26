# Plano: progresso de milestones por propostas elegíveis

## Objetivo

Corrigir `/p/milestones` para calcular o avanço do parceiro pela soma do valor solicitado das propostas elegíveis, em vez de usar o KPI amplo atual. Preservar milestones e imagens administrados em `/admin/milestones`, com metas progressivas configuráveis pelo admin.

## Skills e documentos consultados

- Instruções de `AGENTS.md` fornecidas pelo usuário.
- `docs/operacao/change-management.md` — plano, segurança, modelo de dados e fluxo de alteração.
- `docs/blueprint/04-database-schema.md` — entidades de proposta e operações.
- `docs/blueprint/06-modules-features.md` — descrição histórica de M14 (contém informações desatualizadas sobre mock e imagens hardcoded).
- `supabase/migrations/20260513000003_originacao.sql` — esquema de `propostas`, enum e políticas RLS.
- `supabase/migrations/20260513000004_operacoes.sql` — `liberacoes_recurso` e suas políticas RLS.
- `supabase/migrations/20260705000001_partner_milestones_crud.sql` — configuração de milestones, RLS, Storage e metas iniciais.
- `supabase/migrations/20260715000002_operational_kanban_rpcs.sql` e `supabase/migrations/20260918000005_standby_metrics_views.sql` — KPIs atuais.

## Código e configuração inspecionados

- `app/src/pages/partner/Milestones.tsx` — consulta de KPI, metas, progresso geral/individual e imagens.
- `app/src/pages/admin/Milestones.tsx` — edição e upload de milestones.
- `app/src/lib/queryClient.ts` — cache e revalidação React Query.
- `supabase/migrations/20260518000030_contratos_fase7.sql` — RPC administrativa que grava liberações e avança status.
- `app/package.json` — comandos de lint, typecheck, build e testes existentes.
- `git status --short` — há muitas alterações locais não relacionadas; nenhuma será descartada ou reformatada.

## Decisões e suposições

- Fonte do progresso: `propostas.valor_solicitado` para as propostas do parceiro autenticado com status `registro_af`, `recurso_liberado`, `pagamento_comissao` ou `completo`.
- Todos os produtos participam do acumulado; não haverá filtro por `produto`.
- `registro_af` é elegível mesmo antes de existir uma linha em `liberacoes_recurso`; não se usa `valor_liberado` para este programa.
- A autorização deve vir da sessão autenticada e das políticas RLS existentes para propostas próprias. Não aceitar partner ID vindo do cliente como critério de autorização.
- Não adicionar tabelas ou colunas. Criar uma RPC somente leitura `partner_milestones_progress()` `SECURITY INVOKER`, que deriva o parceiro por `app_partner_id()` no servidor e retorna somente contagem e soma do valor solicitado nos status definidos. Conceder execução a `authenticated`; respeitar RLS da tabela `propostas`.
- A estrutura de milestones, upload configurável e imagens administradas já existe. O trabalho é substituir a origem do KPI na tela partner, acrescentar a RPC e alinhar a documentação M14.
- Metas não terão teto codificado de R$ 500 milhões: a tela continua derivando a escala da maior meta ativa cadastrada pelo admin.
- A contagem exibida será de propostas elegíveis distintas.
- A tela deve distinguir erro de consulta de lista sem milestones, sem apresentar falha de rede como estado vazio.
- Imagens devem continuar priorizando `image_storage_path` e respeitar `image_url` existente como fallback, sem incluir novas imagens hardcoded na tela.

## Modelo de dados e regras

Nenhuma tabela ou coluna nova. Uma função SQL read-only é adicionada como superfície de consulta agregada:

- `partner_milestones_progress()` retorna somente `propostas_elegiveis` e `volume_solicitado` para o parceiro autenticado; não recebe ID de parceiro como argumento.
- A função roda como invoker, deriva a identidade com `app_partner_id()` e consulta apenas propostas próprias sob as policies RLS.
- `propostas`: uma linha por proposta; soma `valor_solicitado` uma vez por proposta, sem junção com liberações que multiplique linhas.
- `partner_milestones`: configuração administrada, com meta em centavos, ordem, prêmio, imagem e estado ativo.

- `propostas`: uma proposta pertence a um `partner_id`, tem produto, status e `valor_solicitado`.
- `partner_milestones`: configuração administrada, com meta em centavos, ordem, prêmio, imagem e estado ativo.
- Regra de soma: somar `propostas.valor_solicitado` uma vez por proposta própria cujo status seja `registro_af`, `recurso_liberado`, `pagamento_comissao` ou `completo`, sem distinção de produto.
- Regra de progresso: comparar valor acumulado convertido de forma explícita para centavos com `target_centavos`; progresso individual limitado a 100%; escala geral baseada na maior meta ativa.
- RLS: consulta executada pelo cliente Supabase autenticado e limitada pelas policies existentes. Não há join com a tabela de liberações nem função `SECURITY DEFINER`.

## Arquivos esperados

- `app/src/pages/partner/Milestones.tsx` — consulta agregada, tipos/estados de consulta e conversão monetária.
- `supabase/migrations/<timestamp>_partner_milestones_progress.sql` — RPC agregada invoker-scoped; nenhuma migration será aplicada remotamente neste escopo.
- `docs/blueprint/06-modules-features.md` — corrigir M14 para refletir milestones configuráveis, Storage e origem do acumulado por propostas elegíveis.
- `prompts/2026-10-26-partner-milestones-released-volume.md` — este plano.

Nenhum deploy ou edição de outras superfícies está previsto.

## Requisitos e critérios de aceite

1. Volume no hero e nos cards é a soma do valor solicitado das propostas próprias nos status `registro_af`, `recurso_liberado`, `pagamento_comissao` e `completo`.
2. Uma proposta elegível contribui uma vez pelo seu valor solicitado, independentemente da quantidade de linhas em `liberacoes_recurso` ou do produto.
3. Propostas em outros status contribuem zero.
4. Parceiros não conseguem consultar nem agregar propostas de outros parceiros; nenhuma credencial privilegiada vai ao navegador.
5. Metas, ordem, prêmios e imagens continuam vindos da configuração do admin; nenhuma meta máxima é hardcoded.
6. Erros de leitura de milestones/progresso têm estado de erro explícito e diferente de “nenhum milestone cadastrado”.
7. Layout e animações existentes são preservados fora das mudanças necessárias aos estados e aos valores.
8. Documentação M14 deixa de afirmar que o cálculo está mockado ou que imagens só vêm de assets locais.

## Segurança e privacidade

- Reusar Supabase client autenticado e RLS; nenhuma chamada com service role no browser.
- Expor apenas agregados de valor/contagem necessários a `/p/milestones`; não selecionar CPF, dados de cliente, protocolo ou documentos.
- Conferir que a função e filtros operam dentro do escopo RLS atual de `app_partner_id()`.
- Nenhuma consulta remota de produção, aplicação remota de migration ou escrita de dados está incluída.

## Testes e verificações

- Verificação automatizada: lint, typecheck, build da aplicação web e testes existentes relacionados, sem alterar dados remotos.
- Verificação manual autenticada: propostas próprias e de outros parceiros em cada status elegível e não elegível; múltiplos produtos; milestones vazios; erro de consulta; metas acima de R$ 500 milhões; configuração de imagem do admin.
- Verificação de isolamento: confirmar em sessão partner que os registros agregados pertencem somente ao parceiro autenticado; usar evidência local/UAT disponível, sem acessar dados privados de produção sem autorização específica.
- Registrar no relatório o que não puder ser confirmado por falta de fixtures ou sessão autenticada.

## Rollout e rollback

- Alteração em frontend, migration local e documentação, sem aplicar migration remota ou fazer deploy neste escopo.
- Rollback: reverter o diff dos arquivos listados, preservando o restante do working tree local.
