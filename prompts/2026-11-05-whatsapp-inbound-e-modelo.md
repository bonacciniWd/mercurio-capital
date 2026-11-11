# WhatsApp Business — modelo inbound e conferência de templates

## Objetivo

Preparar a próxima etapa da integração WhatsApp Cloud API: distinguir o catálogo de templates interno dos templates aprovados na Meta e definir uma ingestão segura das mensagens que chegam ao número empresarial. Esta etapa é de auditoria e planejamento; não altera código, banco, configuração Meta ou produção.

## Documentação e instruções consultadas

- Instruções de implementação fornecidas pelo usuário (AGENTS.md no contexto).
- `docs/README.md`.
- `docs/blueprint/02-roles-permissions.md`.
- `docs/blueprint/07-integrations-flows.md`.
- `docs/blueprint/08-security-compliance.md`.
- `docs/operacao/whatsapp-cloud-api-setup.md`.
- `docs/operacao/integracoes-pendentes.md`.
- `docs/operacao/2026-10-29-whatsapp-merx-inbound-pendencias.md`.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md`.
- `docs/operacao/merx-publica-atendimento.md`.
- `prompts/2026-10-22-whatsapp-business-templates-merx.md`.
- `prompts/2026-10-29-whatsapp-webhook-retomada.md`.

## Código e estado consultados

- `app/src/pages/admin/Templates.tsx` e migrations de `templates_mensagem` e do catálogo WhatsApp.
- `supabase/migrations/20260609000001_integracoes_evolution.sql` — tabela e RLS de `whatsapp_mensagens`.
- `supabase/functions/whatsapp-webhook/index.ts` e validador HMAC em `supabase/functions/_shared/whatsapp-webhook-security.ts`.
- `supabase/migrations/20260513000002_identidade.sql` e `20260513000003_originacao.sql` — identidade de usuários, clientes, propostas e proponentes.
- `supabase/migrations/20260925000004_responsavel_acesso_propostas.sql` — escopo de acesso de equipe.
- Estado do Supabase local via CLI/Postgres local e estado da conta Meta via WhatsApp Business MCP. Nenhum conteúdo de mensagens, credenciais ou payload de cliente foi consultado.
- `git status` foi consultado para preservar o checkout compartilhado. Há várias alterações locais preexistentes; este plano é o único arquivo criado nesta etapa.

## Diagnóstico

- `/admin/templates?canal=whatsapp` é o catálogo interno de modelos de saída: permite mapear código interno, nome do template Meta, idioma, texto e variáveis. Não é uma caixa de entrada e não persiste conversas recebidas.
- O banco local possui sete modelos seed de WhatsApp. A lista da conta WhatsApp Business consultada na Meta retornou zero templates. Portanto, os modelos locais não devem ser tratados como aprovados na Meta; isso afeta envio iniciado pela empresa, não o recebimento de mensagens.
- A configuração Meta consultada anteriormente indica webhook inscrito em `messages` e `message_statuses`. Isso confirma a inscrição, não comprova que a mensagem “oi” chegou à Edge Function ou foi armazenada. O MCP não oferece leitura dos eventos recebidos.
- A Edge Function publicada valida a assinatura HMAC e atualiza apenas status de mensagens enviadas. Seu tipo de evento não modela `messages[]` e não há persistência inbound.
- `whatsapp_mensagens` é um outbox/histórico de saída: requer `corpo`, usa status de despacho e possui policy de leitura administrativa. Reutilizá-la para entrada misturaria semânticas e exigiria mudanças de schema/RLS não definidas.
- O blueprint de banco descreve campos de mensagem diferentes dos campos da migration efetiva. A migration e o schema local foram tratados como referência para a tabela atual; a divergência documental precisa ser corrigida na etapa de implementação.
- Telefone não é uma chave de autorização: um número pode coincidir com mais de um usuário, cliente ou proposta. Nenhuma conversa deve herdar acesso a dados de proposta apenas por correspondência de telefone.

## Modelo proposto para aprovação

Manter `whatsapp_mensagens` exclusivamente para mensagens de saída e criar, se aprovado, uma tabela separada `whatsapp_mensagens_recebidas` para eventos de entrada.

Campos propostos para a primeira versão:

- `id` UUID como chave interna.
- `provider_message_id` texto único, obrigatório, para deduplicação idempotente do ID da mensagem atribuído pela Meta.
- `phone_number_id` texto obrigatório, para identificar o número empresarial que recebeu o evento.
- `sender_phone` texto obrigatório e normalizado em formato internacional.
- `sender_profile_name` texto opcional, apenas se presente no evento.
- `message_type` texto obrigatório; `text_body` nullable para mensagens de texto.
- `received_at` timestamptz obrigatório, derivado do timestamp do evento.
- `association_status` com estados explícitos `unmatched`, `ambiguous` ou `linked`.
- `usuario_id` e `proposta_id` nullable, preenchidos somente por resolução server-side autorizada; associação inicial não será automática por telefone.
- `expires_at` timestamptz obrigatório conforme prazo de retenção que o produto aprovar.
- `created_at` e `processed_at` para operação e auditoria mínima.

Não persistir payload bruto do webhook, tokens, mídia baixada, conteúdo de anexos ou campos não necessários. Na primeira fase, tipos não textuais podem registrar apenas tipo e metadados mínimos necessários para informar que a mídia não foi processada. A retenção do texto recebido e do telefone depende de prazo aprovado; a Edge deve responder rapidamente à Meta, validar assinatura, limitar tamanho/estrutura e deduplicar pela chave do provedor.

## Regras de acesso e negócio propostas

- Escrita somente pela Edge Function com service role, após validação HMAC.
- RLS habilitada; primeira versão visível apenas a Admin autorizado. Sem leitura direta por parceiros, equipe ou clientes até existir uma associação inequívoca e testes para cada papel.
- Eventos sem correspondência ou com mais de uma correspondência ficam `unmatched`/`ambiguous` e não são associados a usuário ou proposta.
- Mensagem recebida não inicia consulta Serasa, não muda status de proposta, não envia resposta automática e não chama MERX/LLM.
- O evento deve ser confirmado à Meta após persistência idempotente bem-sucedida; falha transitória deve permitir retry, sem duplicar a mensagem. Erros permanentes de formato devem ser observáveis sem armazenar PII ou payload bruto.
- Expurgo por `expires_at` deverá ser implementado e testado. Não existe hoje prazo específico documentado para retenção de conversas WhatsApp.

## Decisões pendentes do dono do produto

1. Aprovar ou ajustar a tabela separada e o conjunto mínimo de campos acima.
2. Definir por quanto tempo o sistema conserva telefone e texto de mensagens recebidas.
3. Confirmar se, nesta primeira etapa, mensagens não textuais ficam apenas como indicação de tipo, sem baixar nem persistir o anexo.
4. Confirmar se a primeira tela/consulta de mensagens fica restrita a Admin até existir vínculo inequívoco com proposta.

Sem essas decisões e aprovação do modelo, não criar migration nem alterar o webhook.

## Arquivos esperados após aprovação

- `supabase/migrations/<timestamp>_whatsapp_inbound.sql` — tabela, índices, constraints, RLS, grants e rotina de expurgo, se necessária.
- `supabase/functions/whatsapp-webhook/index.ts` — processamento inbound idempotente sem regressão nos status outbound.
- Testes isolados para validação do payload, assinatura, deduplicação, classificação de associação, tipos não suportados e ausência de PII em logs.
- Possível tela administrativa somente se a aprovação incluir essa etapa; não há UI de inbox incluída neste plano.
- Atualização da documentação do schema, do setup WhatsApp e das pendências MERX.

## Critérios de aceite

- Evento de mensagem válida é persistido uma única vez, mesmo quando a Meta repete a entrega.
- Assinatura ausente/inválida, JSON inválido ou evento acima do limite não escreve dados.
- Status de mensagens enviadas continuam sendo atualizados como hoje.
- Eventos não associados ou ambíguos não revelam dados de proposta e ficam restritos a Admin.
- Testes demonstram isolamento de Admin, parceiro, membro de equipe e cliente, inclusive quando telefones coincidem.
- Nenhum texto, telefone, payload bruto, token ou conteúdo Serasa é gravado em logs.
- Expurgo respeita o prazo aprovado e não remove registros de auditoria exigidos.
- Build, lint, typecheck e testes pertinentes passam; validação local da Edge e smoke tests documentam dependências do Deno/Supabase.
- Deploy e migração remota foram publicados após autorização própria; alterações na Meta e envio de mensagens continuam fora deste escopo.

## Testes planejados

- Unitários: payload de texto válido, áudio/imagem/documento sem download, remetente sem correspondência, múltiplas correspondências, timestamp inválido, ID repetido, JSON inválido e assinatura inválida.
- Banco/RLS: gravação por service role; leitura Admin; tentativas de leitura por parceiro, equipe e cliente sem vínculo; expurgo por vencimento em fixture local.
- Regressão: evento `statuses[]` atualiza a mensagem enviada correspondente e mantém comportamento anterior.
- Manual em ambiente de teste: enviar uma mensagem de uma conta de teste ao número empresarial, conferir evento recebido e registro único sem resposta automática. Não usar nova mensagem de cliente real para teste sem confirmação do dono.
- Verificações do projeto: lint, typecheck e build, além dos testes relevantes.

## Segurança e limites

- Não ler nem expor valores de secrets; não registrar payload bruto.
- Não usar telefone isolado para conceder acesso a proposta.
- Não ampliar escopo para MERX, Serasa, respostas automáticas, inbox de parceiros ou mudanças de billing.
- Nenhuma configuração Meta, template ou envio de mensagem foi alterado nesta etapa.

## Estado

Modelo aprovado pelo usuário em 06/11/2026, com retenção de 60 dias, sem baixar anexos e com acesso inicial restrito a Admin. Implementação:

- Migration: `supabase/migrations/20261106000001_whatsapp_inbound.sql`.
- Edge: `supabase/functions/whatsapp-webhook/index.ts`.
- Parser/testes: `supabase/functions/_shared/whatsapp-webhook-events.ts` e `.test.mjs`.
- Smoke SQL: `supabase/smoke-tests/fase-55-whatsapp-inbound.sql`.
- Rollback: `supabase/manual/rollback-20261106-whatsapp-inbound/README.md`.

Migration aplicada no projeto Supabase remoto e Edge `whatsapp-webhook` publicada na versão 43 em 06/11/2026, após autorização do usuário. O teste real de recebimento foi validado em produção em 06/11/2026: POSTs 200 às 10:18:49 e 10:27:14 (São Paulo), duas mensagens distintas persistidas, retenção de 60 dias e nenhum vínculo automático de usuário/proposta. Ver `prompts/2026-11-06-whatsapp-entrega-real-diagnostico.md` para evidências e limites.

### Verificações executadas em 06/11/2026

- Oito testes Node do validador HMAC e parser inbound passaram.
- Lint do app passou sem erros (33 avisos preexistentes); typecheck e build passaram. O build mostrou somente o aviso existente de bundle grande.
- A migration e o smoke SQL foram executados em transação no Supabase local e revertidos; o smoke terminou com `FASE 55 SMOKE: OK`.
- Uma segunda transação com registro sintético confirmou que parceiro não lê o inbox e Admin lê; a transação também foi revertida.
- `supabase db lint --local --level error --fail-on error` encontrou erros preexistentes em `public.consulta_iniciar` (`preco_centavos` ambíguo) e `public.admin_campanha_disparar` (referência a `usuarios.partner_id`). Nenhum deles aponta para os objetos desta migration.
- Deno não está instalado, então não foi possível executar/typecheck da Edge Function no runtime Deno neste ambiente.
- A migration e o smoke SQL foram executados em transação no Supabase local e revertidos; o smoke terminou com `FASE 55 SMOKE: OK`.
- O `supabase db push --dry-run --linked` listou somente `20261106000001_whatsapp_inbound.sql`; depois o `db push --linked` aplicou somente essa migration.
- `supabase migration list --linked` confirmou a migration aplicada no remoto e `supabase functions list` confirmou `whatsapp-webhook` ativa na versão 43.
- Nenhuma outra migration, Edge Function ou configuração Meta foi alterada.
