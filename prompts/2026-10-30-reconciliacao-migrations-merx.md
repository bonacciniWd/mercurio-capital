# Plano: reconciliar migrations MERX e Serasa

## Objetivo

Remover a ambiguidade do timestamp duplicado `20261029000001` sem alterar o SQL Serasa cujo conteúdo está refletido no projeto Supabase vinculado, e preparar uma sequência verificável para alinhar local e remoto. A falha atual em `/admin/configuracoes` ocorre porque `admin_merx_publica_obter()` não existe no banco consultado.

## Skills e documentos lidos

- Instruções `AGENTS.md` fornecidas pelo usuário.
- `docs/operacao/runbooks.md`, seção de publicação de migrations.
- `docs/operacao/change-management.md`, gates de publicação e rollback.
- Migrations MERX de 29 e 30/10/2026, migrations Serasa relacionadas e migration do backfill de aceite.
- Histórico CLI local e do projeto Supabase vinculado; consultas somente leitura ao catálogo de funções e tabelas.

## Código e configuração inspecionados

- `app/src/components/admin/MerxPublicaTab.tsx` — chama `admin_merx_publica_obter`.
- `supabase/migrations/20261029000001_merx_publica.sql`.
- `supabase/migrations/20261029000001_serasa_pf_relatorio_detalhado.sql`.
- `supabase/migrations/20261029000002_merx_public_config_visibility.sql`.
- `supabase/migrations/20261030000001_merx_public_faq.sql`.
- `supabase/migrations/20261030000002_merx_lead_cidade_admin.sql`.
- `supabase/migrations/20261030000003_merx_intent_catalog.sql`.
- `supabase/config.toml` (já possui alteração local não relacionada a migrations; preservar).

## Decisões e suposições

- A migration Serasa `20261029000001_serasa_pf_relatorio_detalhado.sql` não será editada nem renomeada: as funções Serasa específicas dela existem no projeto vinculado.
- A migration MERX `20261029000001_merx_publica.sql` está sem evidência de aplicação: a tabela `merx_leads_publicos` e as RPCs MERX base não existem no projeto vinculado.
- Proposta de resolução local da colisão: renomear somente a migration base MERX para `20261030000000_merx_publica.sql`, preservando integralmente o SQL. O timestamp proposto é único e fica antes das migrations FAQ, cidade e catálogo de intenção.
- `20261029000002_merx_public_config_visibility.sql` não depende da tabela MERX base; mesmo assim, a ordem real será confirmada pelo dry-run/histórico antes de qualquer publicação.
- A listagem do histórico CLI distingue timestamps, não conteúdo SQL. O schema observado é evidência complementar, não prova de como a migration Serasa chegou ao banco.
- Não executar migrations no banco local ou remoto, não reparar histórico remoto, não executar backfill, não publicar Edge Function/Vercel e não alterar dados.
- O banco local tem 35 migrations pendentes e não será atualizado em lote neste escopo; a sequência local exige um plano separado após revisão dos pré-requisitos e efeitos das migrations antigas.

## Modelo de dados e dependências

- `configuracoes_sistema(chave='merx_publica')`: configuração JSON da MERX, incluindo habilitação, captação e FAQ.
- `merx_leads_publicos`: leads captados pelo chat público; contém contato, consentimento, interesse e origem. Acesso público direto revogado; inserção mediada por `service_role`; leitura administrativa via view/RPC com autorização.
- `lead_status_comercial` e histórico: vínculo opcional do lead MERX a status comercial; depende da migration de status comercial já aplicada no projeto vinculado.
- As RPCs administrativas verificam `app_is_admin_full()` ou `app_is_admin_operacional()`; nenhuma política nova deve liberar leitura ou escrita anônima aos dados dos leads.

## Arquivos esperados

Na etapa de implementação local, após aprovação explícita deste plano:

- Renomear `supabase/migrations/20261029000001_merx_publica.sql` para `supabase/migrations/20261030000000_merx_publica.sql`, sem mudar o conteúdo.
- Atualizar este plano com o resultado das listagens pós-rename e a sequência remota proposta.

Não se prevê alteração no frontend, Edge Functions, configuração de produção ou registros remotos nesta etapa.

## Requisitos e critérios de aceite

1. Cada arquivo em `supabase/migrations` tem timestamp único.
2. O conteúdo SQL da migration base MERX permanece idêntico após o rename.
3. O histórico CLI vinculado associa `20261029000001` unicamente ao arquivo Serasa; o catálogo confirma que objetos Serasa permanecem presentes.
4. A migration MERX base aparece como pendente com timestamp único, e as migrations MERX dependentes aparecem em ordem previsível.
5. `git status` preserva todas as mudanças preexistentes; nenhum outro arquivo é alterado inadvertidamente.
6. Nenhuma migration é aplicada e nenhuma linha do histórico remoto é reparada nesta etapa.

## Considerações de segurança

- As migrations incluem dados pessoais de leads, controles de acesso, funções `SECURITY DEFINER`, concessões/revogações e uma função de rate limit. A revisão precisa manter o acesso público restrito e confirmar o `search_path`/grants.
- A migration de backfill Serasa permanece fora de execução.
- `db push --include-all` é uma ação remota e requer aprovação própria depois de reconciliar o histórico e revisar o dry-run.
- Nenhum segredo ou payload de cliente será lido ou registrado.

## Verificações

- Antes: `npx supabase migration list --local` e `--linked`; catálogo somente leitura das funções e tabelas relevantes.
- Após eventual rename aprovado: verificar unicidade dos timestamps, comparar hash SHA-256 do SQL antes/depois, repetir as listagens e revisar `git status`.
- Nenhum teste automático ou aplicação de migration faz parte desta etapa documental/local.

## Rollback

- Antes da publicação, rollback local é renomear o arquivo para o caminho original; não há mudança de banco.
- Depois de uma futura publicação, não reescrever migrations aplicadas nem usar `db reset`; qualquer correção será uma migration forward-fix e seguirá o runbook com gate próprio.

## Execução local aprovada — 30/10/2026

- Migration MERX base renomeada para `20261030000000_merx_publica.sql`; o conteúdo não foi editado.
- SHA-256 antes e depois idêntico: `53810924a04778ec099ef8c184d533aa33d6a0f4c9c664dec8ab89f34cd9df6e`.
- Verificação dos 138 arquivos: nenhum timestamp duplicado.
- `supabase migration list --linked` agora associa `20261029000001` ao único arquivo remanescente nesse timestamp, `20261029000001_serasa_pf_relatorio_detalhado.sql`; o schema vinculado já continha as funções Serasa dessa migration.
- No projeto vinculado, seguem pendentes `20261029000002`, `20261030000000`, `20261030000001`, `20261030000002` e `20261030000003`.
- O banco local também mantém pendências anteriores a essas migrations; nenhuma migration foi aplicada em nenhum ambiente.
- O erro da aba Admin permanece até que a função seja instalada no banco local. O próximo passo exige preparar o dry-run/ordem das pendências locais e remotas; publicação remota e eventual reparo de histórico continuam fora do escopo desta execução.

## Ordenação e dry-run aprovados — 30/10/2026

Comandos executados, todos em modo `--dry-run` e sem atualizar Vault:

```bash
npx supabase db push --local --include-all --dry-run --skip-vault
npx supabase db push --linked --include-all --dry-run --skip-vault
```

### Projeto Supabase vinculado

O CLI planeja estas cinco migrations, nesta ordem:

1. `20261029000002_merx_public_config_visibility.sql`
2. `20261030000000_merx_publica.sql`
3. `20261030000001_merx_public_faq.sql`
4. `20261030000002_merx_lead_cidade_admin.sql`
5. `20261030000003_merx_intent_catalog.sql`

O pré-requisito remoto foi conferido em consultas read-only: existem `configuracoes_sistema`, `lead_status_comercial`, `lead_status_comercial_historico`, `v_admin_simulacao_leads_publicos`, `cpc_leads_publicos`, `rate_limits` com chave única `(chave, janela_inicio)`, e helpers `app_is_admin`, `app_is_admin_full`, `app_is_admin_operacional`. A tabela `merx_leads_publicos` e RPCs MERX ainda não existem, como esperado antes da migration base. As migrations de status comercial e captura anteriores estão presentes no projeto vinculado.

A ordem é consistente com as dependências observadas: a primeira cria/atualiza o getter público usando `configuracoes_sistema`; a segunda cria a tabela e RPCs base; FAQ atualiza as funções; cidade integra MERX à view/status administrativo e instala o consumo atômico do rate limit; catálogo amplia o constraint de interesse após a tabela existir.

### Banco local

O CLI planeja 35 migrations, de `20260925000001` até `20261030000003`, incluindo a trilha completa de MERX e Serasa. O dry-run apenas lista a sequência que aplicaria; não valida a execução SQL nem sincroniza o schema local. Entre elas há mudanças antigas de dados, permissões e funções. A migration `20261028000001_backfill_aceite_protocolos_revisados.sql` cria/substitui RPCs e helper para backfill, mas não chama a RPC de execução durante a aplicação da migration. Ainda assim, o banco local não deve receber as 35 em lote sem validar os pré-requisitos de cada etapa.

### Resultado e limites

- Ambos os comandos retornaram `Finished supabase db push` com `dryRun: true`.
- Nenhuma migration foi aplicada, nenhum dado foi alterado e nenhum histórico foi reparado.
- O dry-run do CLI enumera arquivos pendentes; não executa parser/DDL em transação de teste e não garante ausência de falha de runtime.
- O dry-run remoto confirma somente o projeto atualmente vinculado pelo CLI. Não houve deploy Vercel nem deploy de Edge Function.
- Próximo gate: se houver pedido para aplicar no remoto, repetir o dry-run imediatamente antes, confirmar alvo/ref e obter autorização explícita para o push e smoke tests. Para o banco local, preparar uma revisão separada do catch-up de 35 migrations.
- Os smoke tests `fase-51-merx-lead-capture.sql` e `fase-52-merx-interest-catalog.sql` dizem explicitamente “local/test”; não devem ser executados no projeto vinculado sem adaptação e autorização. Eles fazem INSERT de fixtures (com `ROLLBACK`) para verificar RLS, permissões, status e rate limit.
- Não há neste momento smoke test MERX aprovado para produção. Após um eventual push, as verificações remotas devem começar por consultas read-only ao catálogo (objetos, definições e grants); o teste funcional autenticado deve ocorrer em ambiente local/teste ou por fluxo autorizado no browser.

## Aplicação remota autorizada e validação — 30/10/2026

- GO remoto recebido em conversa. Imediatamente antes da aplicação, o projeto vinculado foi confirmado como `bhagksfvszeogtjvjtpx`; o dry-run voltou a listar exatamente as cinco migrations acima.
- Executado `npx supabase db push --linked --include-all --skip-vault --yes`. CLI reportou `Finished supabase db push` após aplicar as cinco migrations na ordem planejada. Vault foi explicitamente excluído.
- `supabase migration list --linked` confirmou como aplicados `20261029000001` (Serasa detalhado), `20261029000002`, `20261030000000`, `20261030000001`, `20261030000002` e `20261030000003`.
- Validação read-only confirmou a existência de `merx_leads_publicos`, `v_admin_leads_publicos` e das RPCs `admin_merx_publica_obter()`, `admin_merx_publica_salvar(jsonb)`, `public_merx_config_obter()` e `admin_set_lead_status_comercial(text,text,text)`.
- Segurança confirmada no catálogo: RLS ligado em `merx_leads_publicos`; `anon` não possui SELECT direto; `authenticated` possui SELECT limitado pela policy `app_is_admin()`; `service_role` tem INSERT; funções de administração não executáveis por `anon`; getter público executável por `anon` e `authenticated`; rate limit executável apenas por `service_role`.
- Não foram executados smoke tests (os existentes são explicitamente local/teste) nem fluxo funcional no navegador. O banco local permanece com 35 migrations pendentes; logo o erro em `localhost` ainda depende de atualizar o banco local em uma etapa separada.
