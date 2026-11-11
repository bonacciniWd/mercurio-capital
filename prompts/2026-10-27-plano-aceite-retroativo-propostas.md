# Plano — registrar aceite retrospectivo informado pelo controlador

Data: 27/10/2026. Estado: aprovada, implementada localmente e migration aplicada ao Supabase vinculado após autorização específica; aguardando revisão do dry-run de dados. O backfill e consultas não foram executados.

## Objetivo

Permitir que a carteira de propostas já existente continue usando consultas cobertas com base na afirmação do controlador de que os clientes dessas propostas já aceitaram o uso, embora o aceite não tenha sido persistido. O registro será explicitamente retrospectivo e atestado pelo controlador, sem se passar por um clique do cliente no portal, sem inventar data original e sem alterar o fluxo de aceite digital dos próximos clientes.

## Contexto e código consultado

- Instruções `AGENTS.md` fornecidas na conversa; `docs/operacao/2026-10-27-aceite-consultas-cliente.md`.
- Migration local ainda não aplicada `supabase/migrations/20261027000002_proposta_consulta_aceite_cliente.sql`.
- `propostas`/`clientes` em `supabase/migrations/20260513000003_originacao.sql`: `propostas.cliente_id` pode ser nulo; a proposta tem status.
- Enum `proposta_status` em `supabase/migrations/20260513000001_enums.sql`: inclui `simulacao` e `cancelado` além dos status operacionais.
- `audit_log` append-only em `supabase/migrations/20260513000006_plataforma.sql`.
- Fluxo de registro digital e validação de consultas implementado localmente em `magic-link-consume`, `ClienteProposta.tsx`, `PropostaConsultas.tsx` e migration de aceite digital.

## Interpretação e regras

- O dono do produto afirma que os clientes das propostas atuais já aceitaram anteriormente, mas a aplicação não guardou esses eventos. Este plano trata a origem como **atestado retrospectivo do controlador**, não como clique, consentimento novo ou timestamp original comprovado.
- O momento armazenado será `registrado_em`/`atestado_em` (momento do backfill), com `aceito_em` original nulo quando a data não for conhecida. O auditor verá quem atestou, quando, para qual proposta/cliente, versão e escopos.
- Um registro por proposta vinculada a cliente, cobrindo somente as categorias versionadas já descritas no aceite atual e as integrações reais correspondentes. Serviços mock continuam bloqueados e novos provedores não entram automaticamente.
- A proposta elegível é uma proposta não cancelada e diferente de `simulacao`, com cliente principal associado. Propostas canceladas, simulações e linhas sem cliente não recebem aceite retroativo. Se o produto quiser outro conjunto, ajustar antes da implementação.
- A execução do backfill será um script separado e transacional, nunca efeito colateral automático de uma migration que possa ser aplicada em produção. Primeiro deverá oferecer contagem/dry-run; a execução remota continua sendo uma etapa separada.
- A consulta continua sujeita a role, RLS, proposta, escopo, configuração real do provedor, preço, saldo e demais validações. O atestado não executa consulta nem debita carteira.

## Modelo

A tabela `proposta_consulta_aceites` deve permitir duas origens mutuamente exclusivas: `portal_digital` (cliente e magic link, aceito_em conhecido) e `atestado_controlador` (atestado por usuário admin, data do atestado conhecida, data original do cliente nula se não informada). Guardar `registrado_em`, `registrado_por`, `origem`, `atestado_em`, `aceito_em` opcional, e `magic_link_id` opcional; manter proposal/client, versão, texto/snapshot, escopos e revogação. Restringir escrita ao fluxo seguro de portal e a uma RPC administrativa auditada. Não armazenar CPF/CNPJ, IP completo ou resposta Serasa.

Um script de backfill deve produzir previamente a contagem e lista mínima de identificadores de proposta/protocolo elegíveis, inserir apenas os ausentes, e gravar a mesma origem/ator/momento em `audit_log`. Deve ser idempotente e ter rollback de transação antes do commit. Não substituir aceite digital nem documentos aprovados legados.

## Arquivos esperados

- Alterar `supabase/migrations/20261027000002_proposta_consulta_aceite_cliente.sql` (ainda local e não aplicada) para modelar origens e auditoria do atestado.
- Adicionar script SQL manual de dry-run/backfill em `supabase/manual/` ou `supabase/scripts/`, separado da migration.
- Atualizar `app/src/components/PropostaConsultas.tsx` para distinguir visualmente aceite digital e atestado retrospectivo; manter o uso operacional.
- Atualizar `supabase/smoke-tests/fase-48-aceite-consulta-cliente.sql` e `docs/operacao/2026-10-27-aceite-consultas-cliente.md`.
- Atualizar o texto do plano original se o modelo digital compartilhado mudar.

## Critérios de aceite

- Aceites digitais futuros continuam vinculados a cliente e magic link, sem duplicação.
- O atestado retroativo nunca recebe `magic_link_id`, não inventa `aceito_em`, e aponta para o admin que o registrou e para o timestamp real do atestado.
- Backfill somente cria entradas faltantes para propostas elegíveis, não muda status, não altera contratos, documentos, cliente, partner nem logs de consulta.
- Backfill em dry-run não escreve. Execução é transacional, idempotente, produz totais antes/depois e audit log.
- Serasa/Bacen usam o recibo no escopo autorizado, mas serviços mock continuam bloqueados antes de débito; nenhuma consulta ou cobrança ocorre durante o backfill.
- RLS mantém acesso apenas para cliente da proposta, partner/equipe autorizados e admin; cliente de outra proposta não consegue ler.

## Segurança, testes e gates

- Antes de gravar, exibir quantidade elegível, excluídos por status/ausência de cliente e registros já existentes; revisar o conjunto.
- Nenhuma operação de produção ou consulta paga neste plano. Migration remota, deploy de Edge/Vercel e execução do script em produção exigem GO específico após relatório dry-run.
- Testar dry-run, idempotência, proposta cancelada/simulação sem backfill, linha sem cliente, conflito com aceite existente, ator admin/role incorreta, RLS, preservação de documentos e bloqueio de mocks.
- Rodar lint, typecheck, build, testes, SQL smoke e diff-check. Testar navegador após migration local aplicada em ambiente alinhado, sem reset destrutivo.

## Aprovação necessária

Aprovar o modelo de atestado retrospectivo, o conjunto de status elegíveis e os arquivos/escopo acima antes de codificar. A aprovação não autoriza aplicar migration remota, deploy ou executar o backfill em produção.
