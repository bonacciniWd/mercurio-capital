# Plano — área Parceiro mobile: Lote 4, detalhe da proposta

Data: 09/11/2026. Estado: plano para aprovação. O Lote 3 entregou a lista de propostas; este lote cobre `propostas/[id].tsx`, com conversa e progressão de etapa.

## Objetivo

Transformar o detalhe da proposta em uma tela operacional do Parceiro, mantendo as abas de resumo, proponentes, imóveis e histórico, adicionando:

- conversa contextual com o cliente usando a infraestrutura oficial existente;
- avanço de etapa usando o mecanismo atual de transição e suas validações;
- estados claros de permissão, erro, carregamento e sucesso;
- visual coerente com os lotes anteriores.

## Evidências levantadas

- `mobile/app/(parceiro)/propostas/[id].tsx` hoje exibe os dados, mas os botões inferiores apenas abrem alertas “Em breve”.
- `supabase/migrations/20260715000002_operational_kanban_rpcs.sql` define `partner_set_proposta_status(p_id, p_status, p_motivo)` para parceiro e membro, com validação server-side e histórico.
- `mobile/lib/partner.ts` possui o dicionário de status, mas a lista de transições permitidas precisa ser confirmada contra o enum/validador antes de aparecer no seletor.
- A infraestrutura WhatsApp existente usa `whatsapp_atendimentos`, `whatsapp_mensagens_recebidas` e `whatsapp_mensagens`; a relação de atendimento com uma proposta precisa ser confirmada antes de tratar esse canal como chat da proposta.
- Não foi encontrada uma tabela de chat interno com `proposta_id` no levantamento inicial. Não será criado um chat paralelo sem modelo aprovado.

## Modelo e decisões

1. **Etapa:** usar `partner_set_proposta_status` com o status esperado atual, motivo opcional e invalidação das queries da proposta/lista. O cliente deve ver apenas as transições que o validador aceita; erro de transição retorna ao usuário sem alterar a UI como se tivesse sucesso.
2. **Chat:** reutilizar um atendimento WhatsApp já vinculado à proposta, caso a leitura do schema confirme essa relação. Se não houver vínculo, a primeira entrega exibirá o canal oficial disponível e um estado explícito de conversa ainda não vinculada, sem inventar histórico nem gravar mensagens em tabela errada.
3. Nenhuma mensagem real será enviada durante os testes. O botão de envio deve respeitar janela, template/fluxo e autorização já existentes.
4. O detalhe não modifica documentos, fundos, cliente ou condições financeiras. Apenas lê dados existentes e solicita a transição autorizada.

## Arquivos esperados

- `mobile/app/(parceiro)/propostas/[id].tsx`.
- Helper de transições/chat somente se o contrato existente exigir reutilização.
- Testes focados para transições permitidas, status esperado, erro de RPC e estado de chat.
- Atualização deste plano após a implementação.

## Critérios de aceite

- O detalhe abre para uma proposta acessível pelo parceiro/membro e mostra resumo, proponentes, imóveis e histórico.
- “Avançar etapa” abre somente destinos válidos para a etapa atual, pede confirmação quando necessário e chama `partner_set_proposta_status` com o status correto.
- Após sucesso, o novo status, histórico e lista são atualizados; após conflito/erro, a proposta permanece com o status real do banco e a mensagem é legível.
- O chat mostra apenas mensagens do atendimento/proposta corretamente vinculado, com remetente, data, estado de envio e loading/erro/vazio; não expõe mensagens de outro cliente.
- O envio, se a relação e autorização estiverem disponíveis, usa a Edge/RPC oficial existente e não coloca token privado no app.
- Visual escuro, safe area, contraste e alvos de toque permanecem alinhados ao Parceiro.

## Segurança e validação

- RLS e RPCs existentes continuam autoridades; não chamar `admin_set_proposta_status` pelo app do Parceiro.
- Não criar migration, tabela de chat, vínculo de atendimento, template Meta, cobrança ou mensagem real neste lote.
- Executar typecheck, testes focados, diff check e export Expo iOS/Android.
- Homologar com uma proposta de teste: abrir detalhe, verificar cada aba, avançar uma etapa permitida, testar conflito/erro sem mutação indevida e conferir o chat sem enviar mensagem real.

## Rollout

Implementar localmente como lote isolado. Build nativo, deploy, migration e publicação permanecem aprovações separadas.

## Resultado da implementação local

- O detalhe passou a consultar o atendimento WhatsApp vinculado à proposta e exibir o histórico recebido em uma aba própria, sem criar uma tabela paralela nem enviar mensagens durante o lote.
- O avanço usa `partner_set_proposta_status` e só oferece as transições permitidas pelo validador atual (`proposta_cliente`/`resolucao_pendencias` para diligência e `emissao_contrato` para aguardando assinatura).
- O botão fica desabilitado quando não existe transição autorizada; as queries do detalhe, histórico e listas são invalidadas após sucesso.
- Promoções foi incluída no escopo visual aprovado e usa `PartnerScreen`, `PartnerCard` e feedback de erro/retry no shell escuro do parceiro.
- Typecheck, testes Node, diff check e export Expo iOS/Android foram executados com sucesso. Não houve migration, deploy, build nativo ou envio real.
