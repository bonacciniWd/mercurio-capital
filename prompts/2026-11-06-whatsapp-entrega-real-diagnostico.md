# WhatsApp — diagnóstico de entrega real em 06/11/2026

## Objetivo

Localizar a falha entre uma mensagem real enviada ao número empresarial e sua persistência no inbox, sem alterar inscrições, callback, dados de clientes ou código durante o diagnóstico.

## Instruções e documentos consultados

- AGENTS.md fornecido pelo usuário na conversa.
- `docs/operacao/whatsapp-cloud-api-setup.md`.
- `docs/operacao/2026-10-29-whatsapp-merx-inbound-pendencias.md`.
- `prompts/2026-11-05-whatsapp-inbound-e-modelo.md`.
- Documentação oficial do Supabase: Query logs with SQL e Log sources and fields.
- Código oficial do CLI Supabase: resolução das credenciais e normalização do formato legado do Keychain, sem imprimir ou persistir credenciais.

## Código e estado inspecionados

- `supabase/functions/whatsapp-webhook/index.ts`.
- `supabase/functions/_shared/whatsapp-webhook-security.ts`.
- `supabase/functions/_shared/whatsapp-webhook-events.ts` e seus testes.
- `supabase/migrations/20261106000001_whatsapp_inbound.sql`.
- Fonte efetivamente publicada baixada via CLI em diretório temporário isolado. Os três arquivos publicados coincidem integralmente com os locais.
- Metadados da Edge, catálogo do banco e logs remotos consultados somente para leitura.

## Evidências confirmadas

- Edge `whatsapp-webhook`: ACTIVE, versão 43, `verify_jwt=false`.
- O usuário executou a leitura `phone_number_id?fields=webhook_configuration`. O retorno contém apenas o callback da aplicação, apontando para a Edge correta; não apresenta override de conta ou número.
- Na leitura feita pelo MCP, app publicado, campo `messages` inscrito, número registrado e conta inscrita ao app. A confirmação direta da relação pelo Graph API ainda será comparada com esse resultado.
- Leitura direta posterior fornecida pelo usuário: `GET /v26.0/1413989444229654/subscribed_apps` retorna o app `1642521770706455`, Mercúrio Capital. O vínculo está corroborado; não há motivo observado para repetir a inscrição.
- O token utilizado nessa leitura direta tem `whatsapp_business_management` e `public_profile`; não inclui `whatsapp_business_messaging`. Isso descreve somente o token mostrado pelo Explorer, não comprova a ausência dessa autorização em outros tokens ou no usuário do sistema. A referência oficial Meta `fbsamples/business-messaging-sample-tech-provider-app` documenta as duas permissões para uma integração de mensagens.
- Depois dessa leitura, o usuário forneceu `GET /v26.0/me/permissions` do mesmo app, com `whatsapp_business_management` e `whatsapp_business_messaging` explicitamente `granted`. A verificação dessas permissões está concluída. Foi solicitado novo teste real para verificar recebimento após a autorização; não há conclusão de causalidade somente pela mudança de scopes.
- Logs de invocação consultados pela Management API, com autenticação existente do CLI. A autorização foi validada com HTTP 200.
- Em 06/11, até a janela consultada, foram encontrados:
  - 03:34:49.608 UTC: GET 403, `curl`, versão 43.
  - 04:05:25.984 UTC: POST 200, origem Meta, 196 bytes, versão 43. Conteúdo e finalidade não determinados.
  - 04:06:03.388 UTC: POST 200, origem Meta, 537 bytes, versão 43. O usuário identificou esta chamada como teste manual do campo no painel Meta.
- A consulta das fontes de gateway/PostgREST não localizou chamadas contendo o nome do inbox na janela inspecionada. Isto não substitui uma captura do conteúdo do evento.
- Inbox remoto com zero linhas; `service_role` tem INSERT; RLS habilitada; zero triggers customizadas na tabela.
- O usuário informou novo envio real aproximadamente às 13:10 UTC (10:10 em São Paulo), depois da solicitação de teste. A primeira janela de acompanhamento terminou sem nova invocação e o inbox permaneceu vazio.
- Nova conferência às 13:12:55 UTC: nenhum evento na janela 13:00–13:12:55 nas fontes `function_edge_logs` ou `edge_logs`, filtrando pelo ID efetivo da função, nome no evento e URL. Há margem de aproximadamente dois minutos desde o envio informado; uma ausência nos logs consultados não substitui a informação de entrega do lado da Meta.

## Decisões e limites da interpretação

- HTTP 200 confirma que o handler aceitou a chamada e seu JSON passou pela validação de assinatura. Não comprova que havia uma mensagem inbound válida no envelope.
- O handler pode responder 200 com zero mensagens extraídas. O conteúdo dos POSTs antigos não foi armazenado e não será inventado nem reconstruído a partir do tamanho.
- Zero linhas no inbox, isoladamente, não prova ausência de entrega. A classificação da falha depende dos registros de invocação na janela do envio real.
- O POST de 04:05 não será atribuído ao envio real sem evidência adicional.
- Não repetir onboarding nem sobrescrever callback/inscrição para testar uma hipótese.

## Próximas verificações

1. Reconsultar os logs e o inbox após o envio real, incluindo margem para ingestão dos logs.
2. Comparação direta de `subscribed_apps` concluída: conta e app coincidem. `me/permissions` também confirmou os dois scopes de WhatsApp como `granted`. Acompanhar o novo envio real; não tratar a falta anterior do scope no token temporário do Explorer como causa definitiva do problema inbound.
3. Havendo POST novo, seguir seu status: 401 assinatura, 413 tamanho, 400 JSON/encoding, 503 persistência; 200 sem linha exige examinar a estrutura com diagnóstico mínimo previamente aprovado.
4. Sem POST novo e com configuração direta confirmada, investigar a geração/entrega do evento na Meta. Não atribuir o problema a RLS, parser ou falta de saldo sem evidência.

## Resultado posterior — recebimento real validado

Após o retorno de permissões concedidas e os envios reais confirmados pelo usuário, foram observados:

- POST 200 às 13:18:49.770 UTC (10:18:49 em São Paulo), versão 43; persistência às 13:18:49.586583 UTC.
- POST 200 às 13:27:14.002 UTC (10:27:14 em São Paulo); persistência às 13:27:13.911444 UTC, com timestamp de mensagem às 13:27:09 UTC.
- Conferência remota: duas linhas e dois `provider_message_id` distintos; número empresarial esperado nas duas; retenção de exatamente 60 dias nas duas.
- Mensagens permanecem `unmatched`, sem `usuario_id` nem `proposta_id`; o telefone não concedeu acesso ou vínculo automático.
- Conteúdo textual, nome e telefone do remetente não foram abertos, impressos nem registrados neste diagnóstico.

O critério de recebimento e persistência foi atendido em produção, sem alteração de código, deploy, callback ou reinscrição pelo agente. O sucesso ocorreu depois da concessão da permissão no Explorer; essa sequência temporal não comprova isoladamente qual condição anterior impedia a entrega. As janelas anteriores sem eventos não descrevem mais o estado atual.

O diagnóstico de ausência de recebimento está encerrado. Respostas automáticas, interface de atendimento e integração MERX continuam fora desta validação e dependem de seus próprios planos.

## Arquivos esperados e aprovação

Este arquivo registra o diagnóstico. Nenhuma alteração de código, migration, deploy ou mudança na Meta foi executada nesta etapa. Se necessário adicionar observabilidade, registrar antes o formato dos metadados e obter aprovação de implementação conforme AGENTS.md.

## Requisitos e critérios de aceite

- Correlacionar um envio real conhecido com uma invocação e uma única linha persistida, ou demonstrar precisamente o trecho em que não houve evento registrado.
- Não confundir o botão Teste da Meta com uma mensagem real de cliente.
- Preservar o controle de assinatura, a deduplicação e a retenção de 60 dias aprovados.

## Segurança

- Credenciais usadas somente em memória para acesso à Management API do projeto já vinculado; nenhum token, telefone de remetente ou corpo de mensagem impresso ou persistido neste diagnóstico.
- Queries de log retornam horários, método, status, versão e tamanhos. O payload das mensagens não foi capturado.
- Sem envio automático, consulta Serasa, alteração de status ou associação de proposta por telefone.

## Testes realizados

- `node --test supabase/functions/_shared/whatsapp-webhook-events.test.mjs supabase/functions/_shared/whatsapp-webhook-security.test.mjs`: 8/8 passaram.
- Comparação da fonte publicada com a local: os três arquivos coincidem.
- Banco remoto: conferência read-only de INSERT da service role, RLS, triggers e contagem do inbox.
- Não houve mudança de aplicação; lint, typecheck e build não foram repetidos nesta etapa de diagnóstico.
