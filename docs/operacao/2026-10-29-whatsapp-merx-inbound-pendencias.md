# WhatsApp Business e MERX — pendências para retomada

**Data da verificação:** 29/10/2026  
**Status:** integração Meta habilitada para webhooks; ingestão de mensagens recebidas e integração com MERX ainda pendentes. Este registro documenta o ponto de retomada. Não autoriza implementação, novas migrations, envio de mensagens ou deploy.

## Estado confirmado

- O número empresarial vinculado é **+55 47 9774-7284**.
- O callback `https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/whatsapp-webhook` foi verificado pela Meta.
- O app Mercúrio Capital está publicado, e a conta WhatsApp está assinada ao app para eventos.
- Campos configurados no webhook: `account_update`, `message_statuses`, `message_template_status_update`, `messages` e `phone_number_name_update`.
- A Edge Function `whatsapp-webhook` está ativa. Ela valida `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` e processa atualmente somente atualizações de status de mensagens enviadas. Mensagens recebidas não são persistidas nem exibidas pelo sistema.
- Os nomes dos secrets `WHATSAPP_APP_SECRET` e `WHATSAPP_VERIFY_TOKEN` foram confirmados no Supabase; seus valores não foram lidos nem registrados. O token de verificação foi rotacionado e gravado diretamente no Supabase nesta retomada.
- Ainda não foi executado teste ponta a ponta com mensagem real de cliente chegando e sendo salva no sistema.
- Na listagem de nomes de secrets feita nesta retomada, não constavam `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` ou `WHATSAPP_BUSINESS_ACCOUNT_ID`. O onboarding da Meta também aponta meio de pagamento pendente.

## Pendências WhatsApp inbound

1. Auditar o schema e as políticas RLS atuais antes de definir uma caixa de entrada. `whatsapp_mensagens` foi criada principalmente como fila/histórico de saída, contém campos de template e despacho, e sua policy de leitura é administrativa. Não presumir que ela seja suficiente para conversas de clientes/parceiros nem criar tabela paralela sem essa auditoria.
2. Definir e aprovar o modelo de dados de mensagens recebidas: identificador idempotente do provedor, referência à conta/número empresarial, identidade do remetente, associação autorizada a usuário e proposta, horário, tipo de conteúdo, estado de processamento, retenção e dados mínimos necessários. A estrutura final continua em aberto.
3. Implementar o processamento inbound no servidor: validar assinatura, validar o envelope, deduplicar evento, resolver identidade e contexto sem confiar em associação enviada pelo cliente, persistir minimamente e responder à Meta sem esperar processamento de IA.
4. Definir como tratar remetentes que correspondem a vários usuários, papéis ou propostas. Telefone isolado não deve conceder acesso nem selecionar automaticamente uma proposta.
5. Aplicar e validar RLS/autorização para Admin, parceiro, membro da equipe e cliente. Cada conversa e contexto MERX deve respeitar as propostas que aquele usuário já pode acessar.
6. Configurar observabilidade sem registrar token, payload bruto ou dados pessoais desnecessários; definir expurgo e recuperação de eventos duplicados/falhos.
7. Depois da persistência e autorização, executar teste controlado de webhook com mensagem de entrada, confirmar entrega na Edge e registro associado ao titular/proposta corretos. Não habilitar resposta automática neste teste.

## Pendências para integrar a MERX

- A direção já apresentada no onboarding é um assistente por usuário e proposta, limitado às propostas autorizadas para aquele perfil/equipe. A auditoria MERX define processamento no servidor, minimização de dados pessoais, escopo de equipe e revisão humana.
- Projetar o canal WhatsApp como transporte de mensagens. A lógica de contexto, autorização, consulta à proposta e chamada futura da MERX fica em serviços server-side separados do webhook.
- O assistente só poderá receber fatos da proposta a que o usuário tem acesso e resultados Serasa normalizados/permitidos. Não enviar relatório Serasa bruto por padrão.
- Mensagem inbound não inicia automaticamente consulta Serasa, altera status, decide crédito nem envia resposta. Essas ações exigem regras, auditoria e autorização próprias.
- Antes de habilitar envio pelo sistema, adicionar os secrets de envio faltantes, configurar o meio de pagamento na Meta, confirmar templates aprovados e alinhar opt-in/opt-out e limites de envio. Não usar o teste inbound para disparar mensagens.
- A parte Serasa da MERX segue separada: o relatório PF foi exercitado em produção, mas o produto utilizado não retornou score na resposta apresentada; a confirmação de produtos/campos habilitados foi solicitada ao suporte Serasa. O caminho PJ permanece para uma etapa específica de implementação e validação.

## Critérios para retomar

- Auditoria do modelo atual e da RLS concluída; modelo inbound revisado e aprovado antes da migration.
- Caso de múltiplos usuários/propostas resolvido com regra server-side explícita.
- Testes de assinatura inválida, evento duplicado, remetente não vinculado, remetente com várias propostas e isolamento por perfil aprovados.
- Mensagem real de teste recebida, persistida uma vez e visível apenas aos perfis autorizados.
- MERX só recebe contexto de proposta permitido, com fonte/horário rastreáveis e revisão humana; nenhuma ação externa é disparada automaticamente.
- Envio e templates permanecem desligados até credenciais, pagamento, opt-in e casos de uso serem verificados.

## Referências

- [Auditoria Serasa + MERX](./2026-10-21-auditoria-serasa-merx.md)
- [Setup WhatsApp Cloud API](./whatsapp-cloud-api-setup.md)
- [Pendências de integrações](./integracoes-pendentes.md)
- [Handoff mais recente registrado — fase 2.1](../handoffs/20-handoff-fase2-1-dashboard-ui.md). É anterior a esta retomada e não documenta a integração MERX/WhatsApp atual.
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/migrations/20260609000001_integracoes_evolution.sql`

## Retomada

O trabalho de implementação fica pausado neste ponto para permitir atuação em outra área do produto. Ao retornar, começar pela auditoria read-only do schema/RLS e pela proposta do modelo inbound; não repetir onboarding do número, callback ou publicação do app.

## Atualização de 06/11/2026 — ingestão preparada localmente

- O usuário aprovou uma tabela inbound separada e retenção de 60 dias.
- A migration `20261106000001_whatsapp_inbound.sql` cria `whatsapp_mensagens_recebidas`, mantém leitura apenas administrativa, deduplica por `provider_message_id` e agenda expurgo diário. A tabela outbound `whatsapp_mensagens` permanece separada.
- `supabase/functions/whatsapp-webhook/index.ts` agora extrai mensagens recebidas com campos mínimos, limita o corpo textual a 4.000 caracteres, não baixa anexos e não associa por telefone. Eventos repetidos são idempotentes; falhas de persistência retornam 503 para retry da Meta.
- Testes locais de parser e smoke SQL estão em `supabase/functions/_shared/whatsapp-webhook-events.test.mjs` e `supabase/smoke-tests/fase-55-whatsapp-inbound.sql`.
- A migration foi aplicada ao projeto remoto em 06/11/2026; a Edge `whatsapp-webhook` foi publicada na versão 43. O teste real de recebimento pós-deploy continua pendente; a mensagem “oi” enviada antes da publicação não comprova a ingestão atual.
- O teste não responde automaticamente, não chama MERX/LLM/Serasa e não mostra mensagens a parceiro, equipe ou cliente.
- Reversão preparada em `supabase/manual/rollback-20261106-whatsapp-inbound/README.md`. Não executada; qualquer rollback remoto precisa de autorização própria porque remove os registros inbound armazenados.

## Validação real em produção — 06/11/2026

- O recebimento real pós-deploy foi confirmado: POSTs 200 às 10:18:49 e 10:27:14, horário de São Paulo, com duas mensagens distintas persistidas no inbox.
- Conferência somente dos metadados: número empresarial correto, retenção de 60 dias e ausência de vínculo automático com usuário/proposta. O conteúdo e os dados pessoais dos remetentes não foram abertos no diagnóstico.
- A leitura direta do Graph API confirmou o app correto em `subscribed_apps`, callback padrão correto e, posteriormente, `whatsapp_business_management` e `whatsapp_business_messaging` como `granted`.
- A fonte da Edge publicada foi baixada em pasta isolada e comparada à local: os três arquivos coincidem; os oito testes de assinatura/parser passaram.
- Nenhum ajuste de código, callback, inscrição ou deploy foi necessário nesta validação. A concessão de permissões precedeu o sucesso; não foi estabelecida causalidade definitiva da falha anterior.
- A pendência de teste inbound acima está concluída. Permanecem os próximos trabalhos de atendimento, autorização por contexto e integração MERX; esta validação não habilitou resposta automática.
- Evidências e limites: `prompts/2026-11-06-whatsapp-entrega-real-diagnostico.md`.
