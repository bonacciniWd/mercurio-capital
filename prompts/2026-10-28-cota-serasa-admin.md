# Plano — consultas Serasa por Admin sem débito do parceiro

Data: 28/10/2026. Estado: plano e modelo aprovados; migration e Edge Function publicadas no Supabase de produção; consulta real ainda não executada. Escopo: consultas Serasa PF/PJ iniciadas por usuário Admin autenticado.

## Objetivo

Remover o bloqueio `402 saldo_insuficiente` causado pelo débito da carteira do parceiro quando um Admin da Mercúrio inicia uma consulta Serasa. Registrar o custo como despesa operacional interna e limitar cada usuário Admin a 20 novas consultas Serasa por dia. Preservar o fluxo financeiro atual de consultas iniciadas por parceiros.

## Skills, documentos e código lidos

- Instruções AGENTS enviadas pelo usuário; `docs/README.md`, `docs/operacao/change-management.md`, `docs/blueprint/02-roles-permissions.md`, trechos de `docs/blueprint/04-database-schema.md`, `docs/operacao/2026-10-21-auditoria-serasa-merx.md` e `prompts/2026-10-21-plano-revisado-serasa-merx.md`. Não há skill específica aplicável à mudança de RPC/Edge nesta sessão. Não há `AGENTS.md` nem `README.md` na raiz; o índice do projeto está em `docs/README.md`.
- `supabase/migrations/20261027000002_proposta_consulta_aceite_cliente.sql` (`consulta_iniciar_serasa`), `supabase/migrations/20260518000020_consultas_fase6.sql` (`logs_consultas`, `consulta_estornar`), `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql` (idempotência/reconciliação), `supabase/migrations/20260513000006_plataforma.sql` (`configuracoes_sistema`), `supabase/functions/consulta-executar/index.ts`, `app/src/components/PropostaConsultas.tsx`.

## Diagnóstico e decisão proposta

Hoje `consulta_iniciar_serasa` resolve `propostas.partner_id` e chama `wallet_debit` mesmo para `app_is_admin()`. Assim, o `402` é consequência do saldo do parceiro. O Admin não deve consumir saldo de nenhum parceiro nem ter uma carteira fictícia. O `preco_centavos` da tabela de preços permanece no log como custo nominal, sem lançamento no `wallet_ledger` quando a execução é interna.

O blueprint antigo afirma que toda consulta paga debita a carteira do parceiro. A decisão do dono do produto nesta solicitação cria uma exceção explícita para Serasa PF/PJ iniciada por Admin; a documentação de permissões e operação será atualizada na implementação.

## Modelo de dados proposto para aprovação

| Entidade | Campos e relação | Regras |
|---|---|---|
| `logs_consultas` existente | Nova coluna `cobranca_modalidade text not null default 'carteira_parceiro'`, com valores restritos `carteira_parceiro` ou `operacao_interna`. Cada log continua ligado a uma proposta, parceiro, autor (`iniciado_por`) e autorização. | Linhas históricas permanecem como `carteira_parceiro`. Novo log Admin Serasa usa `operacao_interna`, `preco_centavos` positivo e `ledger_debito_id`/`ledger_estorno_id` nulos. Novo log parceiro segue débito/estorno atual. Indexar autor, modalidade, ambiente e horário para a cota. |
| `configuracoes_sistema` existente | Registro `serasa_admin_limite_diario` com `valor` JSON numérico `20`. | Lido somente pela RPC no servidor; valor ausente/inválido bloqueia novas consultas internas (falha fechada). Alteração administrativa futura não requer deploy. Não contém secrets. |
| `usuarios` existente | `id uuid` do Admin autenticado. | Cota individual, sem agregação entre contas e sem alterar o papel ou conceder acesso novo. |
| `wallet_ledger` existente | Sem novos campos. | Nenhum lançamento para `operacao_interna`; lançamentos de parceiro seguem idempotentes. |

**Contagem e concorrência:** contar logs Serasa PF/PJ em produção, iniciados pelo mesmo Admin no dia civil `America/Sao_Paulo`, em qualquer status (inclusive falha ou reconciliação), exceto reutilização da mesma chave idempotente. O bloqueio de 20 ocorre antes de novo insert e antes da chamada ao provedor. A RPC usa bloqueio transacional por usuário/data para serializar execuções concorrentes; a 21ª recebe erro específico de cota e HTTP 429. Tentativas rejeitadas antes de criar log não consomem a cota. A cota interna não substitui nem mede o limite contratual do Serasa. No UAT, este limite de produção não se aplica; o ambiente segue seus controles existentes.

**RLS e segurança:** manter a autorização da proposta, o aceite/evidência e a validação de CPF/CNPJ existentes. `app_is_admin()` é condição verificada na RPC; Admin limitado/jurídico só poderá consultar se já tiver acesso permitido pela aplicação e pelas regras de proposta. A cota é aplicada no banco, nunca apenas na interface. Não armazenar CPF/CNPJ adicional, payload bruto ou segredo em configuração de cliente. A nova coluna herda RLS de `logs_consultas`; escrita permanece sob RPC/serviço existente.

**Compatibilidade e rollback:** criar migration nova e forward-safe; não editar migrations publicadas. Se necessário interromper a operação, desativar a integração/relatório Serasa pela configuração existente. Um forward-fix pode restaurar temporariamente o ramo de débito para novas consultas, sem apagar logs internos nem criar débitos retroativos. Validar especialmente a falha do provedor: log interno passa a `falha` sem `wallet_credit`; somente log com débito efetivo pode ser estornado. Preservar trilha e reconciliação.

## Arquivos esperados

- Nova migration em `supabase/migrations/` com coluna, índice, configuração e versões seguras das RPCs de início e finalização de falha.
- `supabase/functions/consulta-executar/index.ts`: mapear cota para 429 e distinguir falha interna sem estorno financeiro.
- `app/src/components/PropostaConsultas.tsx`: texto de custo condicional ao papel, mensagem de cota e, se necessário, indicação de consumo/limite sem prometer saldo de carteira.
- Testes SQL direcionados em `supabase/smoke-tests/`, testes Edge existentes adequados ao contrato, `docs/blueprint/02-roles-permissions.md` e documentação operacional Serasa.
- Nenhuma mudança planejada em `mobile/`, Electron/updater ou UI alheia à consulta; validar apenas eventual consumidor compartilhado antes de concluir.

## Critérios de aceite

1. Admin com autorização válida consegue iniciar PF/PJ sem saldo do parceiro; não há débito nem estorno na carteira do parceiro; log identifica cobrança interna e custo nominal.
2. Admin A e Admin B possuem contagens independentes. PF e PJ somam na mesma cota de 20 por Admin por dia em produção. 20 consultas novas passam; a 21ª recebe 429, sem chamada Serasa, sem débito e com mensagem clara. Virada do dia segue `America/Sao_Paulo`.
3. Repetição da mesma chave não cria novo log nem consome nova unidade. Chamadas concorrentes não ultrapassam 20. Falha do provedor permanece auditada sem crédito indevido ao parceiro; timeout/reconciliação não permite retry que duplique consumo.
4. Parceiro continua sujeito a preço, saldo e estorno atuais. Equipe/cliente não ganha permissão. Histórico antigo mantém semântica e leitura.

## Verificação planejada

- SQL local/smoke: autorização, papéis, cota 19/20/21, Admins distintos, dia seguinte, PF+PJ, idempotência, concorrência, falha 4xx e reconciliação; confirmar `wallet_ledger` inalterado para Admin e funcionamento de débito/estorno parceiro. Usar dados sintéticos.
- `app/`: lint, typecheck e build; testes direcionados. Checar Edge com Deno/ambiente local disponível.
- Navegador autenticado: fluxo feliz Admin, erro de cota, estado sem autorização, parceiro com saldo e sem saldo; conferir mensagens e histórico. Sem chamar Serasa de produção só para teste visual.
- Revisar diff e executar verificação de release apropriada antes de qualquer publicação. Relatar limites se ambiente local não permitir testes de ponta a ponta.

## Publicação

Após implementação e verificação, preparar migration e deploy da Edge/frontend em sequência compatível, com validação após cada etapa. Não aplicar no Supabase ou Vercel neste plano. Aprovações remotas seguem o processo de gestão de mudanças do projeto.

## Evidência local de implementação — 28/10/2026

- Migration compilada em transação com as dependências ainda ausentes do banco local, seguida de `ROLLBACK`. Smoke estrutural fase 50 passou.
- Teste transacional com usuários, proposta e aceite sintéticos: 20 consultas para Admin A; 21ª rejeitada; Admin B independente; mesma chave reutiliza log; falha interna não cria estorno; Admin limitado não altera a cota; parceiro conserva débito e estorno. Todo o teste foi revertido com `ROLLBACK`.
- `npm run lint`: 0 erros, 33 avisos preexistentes; `npm run typecheck`: passou; `npm run build`: passou; `npm run test -- --run`: 45 arquivos e 175 testes passaram; 5 testes do normalizador/conector Serasa passaram; `npm run validate:release`: passou.
- Migration `20261028000002` aplicada no Supabase de produção após dry-run que apontou somente essa migration pendente. Edge `consulta-executar` publicada como versão 47 com JWT verification mantida. A versão remota anterior foi baixada para comparação; `serasa-reports.ts` não tinha diferenças e o bundle publicado inclui os ajustes locais de Serasa/validação já revisados.
- A aba Chrome observada estava em `http://localhost:5173/admin`, mas `app/.env.local` aponta para o projeto Supabase de produção. A chamada real à Serasa não foi executada; o valor atual do secret remoto `SERASA_API_URL` não foi lido nesta etapa. Vercel não foi publicado, pois a aba de desenvolvimento local já permite a validação quando houver uma proposta escolhida.
- A configuração de cota é inserida como 20 se a chave ainda não existia (`ON CONFLICT DO NOTHING`). A leitura direta do valor remoto ficou pendente porque a CLI disponível não oferece comando de consulta SQL e a conexão de pooler local não possui senha configurada.
