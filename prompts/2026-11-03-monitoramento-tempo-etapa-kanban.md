# Plano — monitoramento do tempo por etapa no Kanban

## Objetivo

Sinalizar propostas que permaneçam **mais de 10 dias completos na mesma etapa**, sem alterar status, transições ou regras atuais do Kanban. Exibir a idade da etapa nos cards e destacar os atrasos; enviar **um lembrete diário por proposta e por administrador elegível** à central de notificações.

## Documentação e código consultados

- `docs/README.md` e `docs/blueprint/02-roles-permissions.md` — estrutura do projeto e escopo de admin.
- `docs/blueprint/04-database-schema.md` — `proposta_status_historico` e `notificacoes`.
- `docs/blueprint/06-modules-features.md` — visibilidade do Kanban e papéis reduzidos.
- `docs/blueprint/07-integrations-flows.md` e `docs/operacao/runbooks.md` — notificações in-app, Realtime e padrão existente de `pg_cron`.
- `docs/operacao/criterios-classificador-leads-v1.md` — limite explícito: classificadores não alteram o status do Kanban.
- Código consultado: `app/src/components/PropostasKanban.tsx`, `app/src/components/NotificationBell.tsx`, `app/src/lib/propostaStatus.ts`, `app/src/lib/adminScope.ts` e migrations que definem histórico de status, notificações, roles de admin e cron.

## Modelo e regras

- Fonte da entrada na etapa: último `proposta_status_historico.created_at` cujo `status_novo` corresponda ao status atual. Quando não houver histórico correspondente (por exemplo, status inicial), usar `propostas.created_at` como fallback. `propostas.updated_at` não serve como relógio da etapa, pois pode mudar por edições que não alteram status.
- Idade exibida: dias completos desde a entrada na etapa, calculados a partir de `timestamptz`.
- Elegibilidade: propostas no fluxo do Kanban operacional; excluir rascunhos/simulações, `standby`, canceladas e concluídas (`completo`). Incluir etapas intermediárias e finais ainda operacionais, inclusive aliases legados reconhecidos pelo Kanban.
- Limite: alerta quando o tempo exceder 10 × 24 horas; a contagem visual mostra dias completos.
- Destinatários e destaque visual: somente `role='admin'` com `admin_nivel` `full` ou `limitado`. Não incluir `juridico`, parceiros, membros de equipe ou clientes, ainda que possam acessar o Kanban.
- Notificação: uma por proposta, destinatário, etapa e dia civil de São Paulo. Se o status mudar, começa um novo ciclo de etapa. Reexecuções do job no mesmo dia não duplicam avisos.
- Link abre o detalhe da proposta no Admin. A mensagem identifica protocolo, etapa e tempo parado, evitando incluir dados pessoais desnecessários.
- O card mantém o atual indicador “Na esteira” (idade total da proposta) e acrescenta “Nesta etapa”, destacando o segundo quando ultrapassar o limite. O destaque pode pulsar suavemente, com alternativa estática para `prefers-reduced-motion`.

## Decisões e suposições

- “Mais de 10 dias” significa mais de 240 horas, não simplesmente entrar no 11º dia do calendário.
- A rotina diária roda às 09:00 no horário de São Paulo, seguindo os horários operacionais já documentados. Se o projeto já usar um horário comum para notificações operacionais, a migration deve reutilizar esse padrão.
- A central atual carrega no máximo 30 notificações. Como haverá uma por proposta/dia, a implementação deve permitir consultar os alertas diários sem ultrapassar esse limite silenciosamente (por paginação/carregamento adicional ou ajuste focado da consulta), sem mudar a regra de um alerta por proposta.
- O workspace já contém alterações locais preexistentes, inclusive em `PropostasKanban.tsx`; a implementação deverá preservar essas alterações e limitar o diff aos arquivos necessários.

## Arquivos esperados

- `app/src/components/PropostasKanban.tsx` — apresentação da idade da etapa e realce visual nos cards do Kanban Admin.
- `app/src/components/NotificationBell.tsx` — acomodar acesso a todos os alertas do período diário, sem remover funções existentes.
- `app/src/lib/adminScope.ts` (ou helper existente equivalente) — respeitar o escopo `full`/`limitado` na apresentação do alerta; não ampliar permissões.
- `app/src/lib/propostaStageAge.ts` e teste correspondente — cálculo determinístico e cobertura de limites/valores ausentes, se essa extração se encaixar nas convenções atuais.
- Nova migration Supabase — leitura segura da data de entrada na etapa, geração diária de notificações e deduplicação; execução restrita ao cron/servidor, `search_path` fixo, privilégios mínimos e rollback documentado.
- Testes SQL/smoke para limiar, status excluídos, escopo de destinatários, dia civil de São Paulo e idempotência.
- Atualização de `docs/operacao/runbooks.md` e registro do comportamento do recurso.

## Requisitos e critérios de aceite

1. A idade “Nesta etapa” acompanha somente mudanças reais de status; uma edição comum não reinicia o relógio.
2. O fallback de propostas sem transição anterior é estável e coberto por teste.
3. A partir de mais de 10 dias, o card fica claramente destacado para Admin full/limitado sem prejudicar arrastar, filtros, links ou responsividade; animação respeita movimento reduzido.
4. Admin full e limitado recebem, na central in-app, um lembrete por proposta em atraso por dia; jurídico e usuários não Admin não recebem.
5. Rodar o job novamente no mesmo dia não duplica notificações; no dia seguinte, enquanto continuar parado, gera novo lembrete.
6. Notificação leva ao detalhe correto e contém apenas dados operacionais necessários.
7. Nenhuma mudança é feita nos status, na autorização de transição ou no processo atual do Kanban.
8. Um operador consegue encontrar todos os lembretes diários mesmo quando ultrapassarem a página/limite inicial atual da central.

## Segurança

- O cliente não cria notificações nem define destinatários.
- A geração ocorre em rotina server-side/SQL com execução restrita; funções `SECURITY DEFINER`, se necessárias, usarão `search_path` explícito, checagem de escopo e grants mínimos.
- Não ampliar leitura de histórico ou propostas para parceiros/clientes.
- Notificações respeitam a RLS existente de `notificacoes`; cada registro é endereçado individualmente ao usuário Admin.
- Migration e rollback serão revisados e testados localmente antes de qualquer aplicação remota. Deploy e aplicação remota seguem autorização separada.

## Verificações previstas

- Testes unitários para cálculo de dias e corte `>10`.
- Testes SQL para status elegíveis/excluídos, fallback, destinatários full/limitado versus jurídico e idempotência diária.
- Testes do Kanban para rótulo/destaque normal e `prefers-reduced-motion`, preservando drag-and-drop e links.
- Rodar lint, typecheck e testes da aplicação; build conforme scripts disponíveis.
- Teste manual em navegador: card com menos de 10 dias, card acima do corte, mudança de etapa, alerta recebido na central, abrir detalhe, execução repetida no mesmo dia e visualização responsiva.
- Dry-run do job sem inserções antes de validar a migração; nenhum deploy ou aplicação remota nesta etapa.

## Considerações de release e rollback

Primeiro validar migration e UI localmente. O rollback deverá remover o cron, a função/índices auxiliares e apenas notificações geradas por este tipo de alerta, sem apagar notificações gerais nem o histórico de status. Não publicar nem aplicar no Supabase remoto como parte desta aprovação de implementação.

## Aplicação remota autorizada — 2026-11-03

- Projeto conferido antes da operação: `bhagksfvszeogtjvjtpx` (`mercurio`, produção).
- `npx supabase db push --remote=bhagksfvszeogtjvjtpx --dry-run` listou somente `20261103000001_kanban_stage_age_alerts.sql`.
- Após autorização explícita, aplicada somente essa migration com `--skip-vault`; CLI confirmou `Apply 1 migration` e `Finished supabase db push`.
- `supabase migration list --remote` confirmou `20261103000001` no histórico remoto.
- Consultas `SELECT` read-only confirmaram as três funções, permissões (anon sem acesso; authenticated pode chamar apenas as RPCs de leitura; job sem execução por authenticated), índice idempotente e cron `0 12 * * *`.
- O smoke versionado não foi executado porque usa bloco `DO`, bloqueado pelo modo `--read-only` do CLI; não foi feita tentativa de execução com escrita. Os contratos equivalentes foram verificados por `SELECT` read-only.
- A interface não foi publicada na Vercel. O frontend local aponta para esse projeto remoto; recarregar o Kanban deve agora permitir que `admin_kanban_etapa_inicio` retorne as datas reais. A validação visual autenticada permanece pendente.
