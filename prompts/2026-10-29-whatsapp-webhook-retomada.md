# Retomada segura do WhatsApp Business

## Objetivo
Retomar o onboarding Cloud API para o número já vinculado **+55 47 9774-7284**, começando pela proteção e configuração dos webhooks existentes, sem criar número, conta, templates, filas ou fluxos duplicados.

## Documentos e instruções lidos
- Instruções de implementação fornecidas pelo usuário (`AGENTS.md` no contexto da tarefa).
- `docs/operacao/integracoes-pendentes.md`.
- `docs/operacao/whatsapp-cloud-api-setup.md`.
- `prompts/2026-10-22-whatsapp-business-templates-merx.md`.
- Registro de memória do onboarding existente, revalidado com MCP nesta sessão.

## Código e estado inspecionados
- `supabase/functions/whatsapp-webhook/index.ts` — GET de verificação Meta, validação HMAC do POST e atualização de status em `whatsapp_mensagens`.
- `app/src/pages/admin/WhatsAppConfig.tsx` — tela existente e URL do webhook.
- Edge Functions publicadas: `whatsapp-webhook`, `whatsapp-dispatcher`, `whatsapp-send` e funções legadas Evolution.
- Secrets no Supabase: `WHATSAPP_VERIFY_TOKEN` presente; `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` e `WHATSAPP_API_VERSION` ausentes. Valores dos secrets não foram lidos.
- MCP, conta Mercúrio Capital: perfil, app e número estão prontos; o número vinculado é **+55 47 9774-7284**. Webhook não configurado, app não assinado aos eventos da conta, app em modo de desenvolvimento e meio de pagamento ausente.

## Decisões e suposições
- Reutilizar a conta, app, número, Edge Function, histórico e fila existentes.
- Corrigir primeiro a validação de assinatura: POST deve falhar fechado quando `WHATSAPP_APP_SECRET` estiver ausente, e rejeitar assinatura inválida. O GET de verificação continua usando `WHATSAPP_VERIFY_TOKEN`.
- Não transmitir nem registrar tokens ou segredos. O usuário insere credenciais diretamente no Supabase.
- A escolha do número não autoriza registro de outro número, envio de mensagem, alteração de webhook, assinatura de conta, publicação de app ou alteração de faturamento.
- Não serão feitas alterações remotas até a implementação local ser revisada e o usuário autorizar separadamente deploy da Edge Function e alterações Meta necessárias.

## Modelo de dados
Sem alterações de schema. Mantêm-se `whatsapp_mensagens` como fila/histórico e seus IDs/status existentes. O webhook continua gravando apenas status de entrega dos eventos que já consegue processar.

## Arquivos esperados
- `supabase/functions/whatsapp-webhook/index.ts` — assinatura obrigatória para POST.
- Novo teste isolado para validar configuração ausente, assinatura válida/inválida e verificação GET, adequado ao setup Deno existente; se não houver harness Deno no ambiente, documentar exatamente essa limitação.
- Este plano.

## Critérios de aceite
- POST sem `WHATSAPP_APP_SECRET` retorna erro e não altera dados.
- POST sem assinatura ou com assinatura inválida retorna 401 e não altera dados.
- GET só retorna o challenge quando modo e `WHATSAPP_VERIFY_TOKEN` coincidem.
- Assinatura HMAC válida segue processando os status existentes sem mudar semântica.
- Nenhuma credencial aparece no cliente, logs, testes, diff ou saída de comandos.
- A configuração Meta só será considerada operacional quando callback, assinatura da conta e modo de publicação forem confirmados pelo MCP.

## Segurança
- Não expor IDs internos, tokens nem payloads de clientes.
- Comparar assinatura em tempo constante quando suportado pelo runtime.
- Limitar a mudança ao webhook; não alterar dispatcher, envio, opt-in, templates ou esquema de cobrança nesta fase.
- Sem consulta ou envio pago durante validação.

## Verificações
- Teste unitário da verificação HMAC e GET, sem chamar Meta nem gravar no banco.
- Lint/typecheck/build conforme scripts do projeto; smoke test HTTP local somente se o runtime Deno estiver disponível.
- Deploy Supabase e configuração Meta são etapas remotas separadas, cada uma com autorização própria; antes delas, confirmar que os secrets requeridos foram adicionados manualmente.

## Estado
Implementação local concluída após aprovação. Testes focados, lint, typecheck e build passaram. Deno não está instalado no ambiente, portanto a Edge Function não foi executada localmente. Nenhum secret, configuração Meta ou serviço remoto foi alterado. O deploy do webhook permanece pendente de autorização própria e do cadastro manual de `WHATSAPP_APP_SECRET`.
