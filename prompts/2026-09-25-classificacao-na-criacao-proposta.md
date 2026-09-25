# Plano — Classificação e distribuição na criação da proposta

## Objetivo
Acionar a classificação operacional e a distribuição de uma proposta assim que ela for criada pelo Wizard, preservando revisão manual, auditoria e isolamento de acesso por responsável.

## Skills/documentos lidos
- `docs/README.md`
- `docs/operacao/runbooks.md`
- `docs/escopo-melhoria-operacao-llm.md`
- `supabase/migrations/20260722000009_wizard_proposta_evolucao_rpcs.sql`
- `supabase/migrations/20260925000002_lead_classificacao_distribuicao.sql`
- `supabase/migrations/20260925000003_proposta_classificacao_operacional.sql`
- `supabase/migrations/20260925000004_responsavel_acesso_propostas.sql`
- `app/src/pages/partner/Wizard.tsx`
- `app/src/pages/admin/PropostaDetalhe.tsx`

## Código inspecionado
- `partner_create_proposta(jsonb)` e `admin_create_proposta(uuid,jsonb)` persistem a proposta e retornam o identificador.
- A classificação/distribuição hoje é acionada manualmente no detalhe da proposta.
- `admin_classificar_distribuir_proposta` já calcula peso, escolhe analista configurado, grava `lead_distribuicoes`, `responsavel_id` e auditoria.
- O acesso de `team_member` já considera `responsavel_id`.

## Decisões e suposições
- A primeira automação será determinística e sem LLM: a classificação automática só poderá usar uma regra aprovada e explícita; se os critérios objetivos ainda não estiverem fechados, a proposta ficará `aguardando_classificacao` sem receber uma classe inventada.
- A chamada ocorrerá no servidor, dentro de uma RPC segura ou de uma Edge Function; o navegador não terá credenciais privilegiadas.
- A distribuição só ocorrerá para usuários ativos, configurados e participantes da distribuição.
- `desqualificado` não será atribuído automaticamente sem regra aprovada; baixa confiança/ausência de dados deverá ficar para revisão.
- Não haverá alteração de status do Kanban nesta etapa.

## Arquivos esperados
- Nova migration Supabase para encapsular criação + classificação inicial, ou trigger/RPC auxiliar seguro, conforme o contrato atual das RPCs.
- Ajuste mínimo no fluxo do Wizard somente se a solução escolhida exigir retorno de estado adicional.
- Smoke test SQL para criação, pendência de classificação, distribuição e auditoria.
- Atualização de documentação/runbook com rollback.

## Modelo e regras
- Entidade principal: `propostas`.
- Relação de distribuição: `lead_distribuicoes.proposta_id -> propostas.id`.
- Campos existentes de classificação: classe, peso, confiança, motivo, timestamps e responsável.
- A operação deve ser idempotente: uma proposta não pode gerar duas distribuições automáticas para a mesma classificação sem uma nova decisão explícita.

## Critérios de aceite
1. Toda proposta criada continua sendo persistida mesmo quando não há analista configurado.
2. O resultado da criação informa claramente se ficou aguardando classificação, aguardando analista ou distribuída.
3. Quando houver regra aprovada e analista elegível, `responsavel_id`, `lead_distribuicoes` e auditoria são gravados na mesma operação transacional.
4. Um `team_member` acessa somente propostas da própria equipe ou atribuídas a ele; admin continua com acesso global.
5. Falhas de distribuição não desfazem a criação da proposta e deixam motivo auditável.
6. Smoke tests cobrem os caminhos feliz, vazio e repetido.

## Segurança
- RLS/RPC server-side para autorização.
- Sem chaves de LLM, Bacen ou Serasa no frontend.
- Minimização de dados enviados a qualquer modelo futuro.
- Sem aprovação/rejeição jurídica automática.

## Testes
- `supabase db push --dry-run` antes de aplicar migration.
- Smoke SQL da nova fase.
- `npm run lint` (registrar warnings preexistentes), `npx tsc --noEmit` e `npm run build` em `app`.
- Teste manual: criar proposta como parceiro/admin, verificar estado de classificação, atribuição e acesso em sessão `team_member` real.

## Rollback
- Migration reversa que remova apenas a automação adicionada, mantendo os campos e dados já existentes.
- Desligamento por configuração/feature flag antes de qualquer remoção de dados.
