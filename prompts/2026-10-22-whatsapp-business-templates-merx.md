# WhatsApp Business e templates — complemento da fase MERX

## Objetivo
Reaproveitar integração Cloud API, editor e fila existentes; preparar templates e gestão administrativa, com vínculo futuro aos eventos MERX. Proposta sujeita à aprovação, sem envio, alteração Meta, instalação de MCP, migration ou deploy.

## Fontes e código inspecionados
Documento WhatsApp Business Tools MCP fornecido pelo usuário; docs/operacao/whatsapp-cloud-api-setup.md; migrations 20260609000004 e 20260609000005; app/src/pages/admin/WhatsAppConfig.tsx e Templates.tsx; funções whatsapp-send, whatsapp-dispatcher e whatsapp-webhook. Gestão de mudanças e modelo MERX de 22/10 permanecem referências. Nenhuma skill especializada utilizada.
Inspeção local: não confirma schema efetivo, templates aprovados, configuração ou entrega em produção. Documentação local de junho contém afirmações sobre cobrança, limites e onboarding que precisam de conferência atual em fontes oficiais antes de virarem instruções operacionais.

## Reutilização
- templates_mensagem, v_admin_templates e admin_template_upsert: corpo, variáveis ordenadas, wa_template_nome e wa_idioma já existem.
- WhatsAppConfig: configuração não secreta, health check, mensagens recentes e teste de envio.
- whatsapp_mensagens: fila e histórico; dispatcher já monta payload de template.
- whatsapp-send: envio Cloud API; whatsapp-webhook: confirmação GET e atualização de status.
- Preservar identificadores históricos evolution_message_id; nome legado não justifica duplicar histórico nem reativar Evolution.

## Lacunas confirmadas no código lido
1. whatsapp-send e dispatcher marcam enviado em modo dev sem credenciais. Produção deve falhar fechado; simulação precisa de estado explícito e não pode consumir fila real como entrega.
2. Webhook retorna assinatura válida quando APP_SECRET está ausente. Bloquear processamento sem secret; testar assinatura inválida, replay e limite de payload.
3. Envio direto por template_codigo busca apenas corpo; não resolve nome/idioma/parâmetros Meta armazenados. Unificar a resolução entre envio e dispatcher, sem fallback silencioso para texto livre.
4. Webhook implementa statuses, apesar de comentários mencionarem mensagens recebidas. Não foi localizado ali processamento de inbound, descadastro ou atualização de aprovação dos templates.
5. Editor registra nome Meta manualmente; isso não comprova aprovação. Preparar sincronização de status real e divergência entre conteúdo local/remoto.
6. Auditar reivindicação concorrente da fila, autenticação do dispatcher, retries, idempotência e atualização fora de ordem antes da ativação. Falha de persistência após aceite da Meta não deve causar reenvio automático indiscriminado.

## Modelo incremental proposto
Não criar outro cadastro de templates ou outra fila.
- templates_mensagem: acrescentar identificação WABA/ID Meta, categoria, status de aprovação, motivo de rejeição, componentes estruturados, versão/hash de conteúdo e ultima_sincronizacao. Ativo local é diferente de aprovado pela Meta. Rascunho editado não sobrescreve silenciosamente a versão aprovada usada por mensagens já enfileiradas.
- whatsapp_mensagens: auditar campos existentes antes de adicionar chave de idempotência e snapshot da versão/componentes do template; manter referência da proposta/evento originador e ID do provedor. Unique por evento/destinatário/template/versão conforme política aprovada.
- Opt-in/opt-out e última mensagem recebida: primeiro localizar cadastro/eventos existentes no schema completo; estender essa fonte. Não criar tabela paralela antes da auditoria. Registrar origem/data/finalidade e aplicar bloqueio no servidor.
- Configuração existente: IDs e status operacional acessíveis apenas a administradores autorizados; tokens e App Secret somente no backend.
- MERX: eventos como pendência confirmada podem solicitar comunicação pela fila existente, com decisão operacional autorizada. A IA não escolhe destinatário nem envia livremente. Não incluir score, restrições ou relatório de crédito na mensagem; usar portal autenticado.
RLS/RPCs devem aplicar escopo real de administrador e proposta, auditoria e proteção de payloads. Retenção de mensagens/eventos exige decisão própria.

## Templates já previstos — preparar antes de criar outros
| Código existente | Nome Meta previsto | Variáveis em ordem |
|---|---|---|
| wa_proposta_criada_v1 | proposta_criada | nome, protocolo, link |
| wa_status_proposta_v1 | status_proposta | nome, protocolo, status |
| wa_pendencia_doc_v1 | pendencia_documento | nome, protocolo, nome_doc, link |
| wa_contrato_assinatura_v1 | contrato_assinatura | nome, protocolo, link |
| wa_recurso_liberado_v1 | recurso_liberado | nome, protocolo, valor |
| wa_partner_aprovado_v1 | partner_aprovado | nome, link |
| wa_magic_link_v1 | magic_link | nome, link |
Esses registros foram encontrados em seed; existência remota e aprovação Meta ainda não verificadas. Antes de criar/submeter, listar templates da WABA e conciliar nome, idioma e componentes. Categoria e elegibilidade precisam de validação Meta; não presumir que magic link arbitrário será aceito como Authentication.

### Rascunhos de conteúdo para revisão
Revisões dos códigos existentes, sem insert nem submissão:
- Proposta criada: “Olá {{nome}}, sua proposta {{protocolo}} foi registrada na Mercúrio Capital. Acompanhe pelo portal: {{link}}.”
- Pendência: “Olá {{nome}}, há uma solicitação de documento para a proposta {{protocolo}}: {{nome_doc}}. Consulte os detalhes e envie pelo portal: {{link}}.”
- Status: “Olá {{nome}}, houve uma atualização na proposta {{protocolo}}. Status atual: {{status}}.”
- Contrato: “Olá {{nome}}, o contrato da proposta {{protocolo}} está disponível para assinatura: {{link}}.”
Usar apenas dados sintéticos nos exemplos enviados à Meta; conferir links e variáveis, limites e componentes antes de submeter. Nenhum template novo específico da MERX é necessário para reutilizar esses eventos.

## Papel do MCP fornecido
Segundo o documento, serve à administração de negócios/WABA/números/templates/webhooks e diagnóstico com OAuth; está em beta. Não substitui Cloud API/worker do sistema nem deve rodar no navegador. O runtime deve continuar independente da sessão OAuth pessoal do agente.
Nenhuma ferramenta whatsapp_biz_* está carregada nesta sessão. Após conexão autorizada, começar apenas por descoberta/listagem e conciliação. Criação/alteração de templates, registro de número, webhook e envio precisam de escopo explícito. Nenhuma mensagem enviada nesta revisão.

## Sequência e arquivos esperados
1. Inventário remoto somente leitura de schema/configuração e ativos Meta quando conexão disponível.
2. Aprovar modelo incremental, conteúdos e estados; resolver lacunas de segurança/envio antes de ativar.
3. Alterações nas funções existentes e helper compartilhado, migration aditiva apenas para campos faltantes, evolução de Templates.tsx/WhatsAppConfig.tsx e documentação.
4. Sincronização de templates e revisão administrativa; integrar eventos MERX usando a fila existente.
5. Smoke com destinatário interno explicitamente autorizado e acompanhamento dos callbacks.
Sem alteração de mobile/Electron nesta etapa; telas existentes são a base visual. Não adicionar biblioteca ou novo provedor por inferência.

## Testes e aceite
Fixtures de payloads; template sem aprovação/variável faltante bloqueado; credenciais ausentes não marcam enviado; assinatura inválida e APP_SECRET ausente rejeitados; status repetido/fora de ordem não regride entrega; concorrência não duplica envio; timeout incerto exige reconciliação; opt-out e janela de atendimento aplicados no servidor. Testar autenticação do dispatcher, RLS, revisão de template e estados vazios/erro no admin. Rodar lint/typecheck/build e testes direcionados após implementação.
Esta entrega é documentação baseada em inspeção estática; não houve testes funcionais ou acesso a dados operacionais.

## Rollout e rollback
Flags de envio desligadas até validação. Aprovação separada para envio de teste ao número indicado e publicação remota. Rollback pausa dispatch e preserva fila/histórico. Aprovação de template na Meta não é garantida pelo código local.
