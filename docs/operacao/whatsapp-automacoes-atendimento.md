# WhatsApp Cloud API: templates, notificações e atendimento

Este runbook registra a implementação local iniciada em 06/11/2026. A migration `20261106000002_whatsapp_fluxos_atendimento.sql`, as Edge Functions e o frontend permanecem locais até aprovação própria de publicação. Nenhuma credencial foi copiada para a interface ou para este documento.

## Estado e ativação

- O webhook inbound validado anteriormente permanece separado do worker de automação.
- As flags `envio_habilitado`, `automacoes_habilitadas` e `atendimento_habilitado` são independentes e começam desligadas.
- O catálogo interno de templates não comprova que um template exista ou esteja aprovado na Meta. Cada versão precisa ser submetida, sincronizada e comparada com o conteúdo remoto antes de ser usada.
- Flow nativo é opcional. O editor exporta somente o subconjunto estático de formulário compatível; a Meta ainda precisa validar e publicar o Flow.
- A FAQ conversacional é determinística e usa respostas públicas aprovadas no código/grafo. Não chama LLM, Serasa nem dados de proposta.
- A retenção de mensagens e contexto é de 60 dias. Opt-out e trilha mínima de auditoria são mantidos.

## Segredos e pré-requisitos

Guardar exclusivamente no Supabase Edge Secrets e no Vault do projeto:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_WORKER_SECRET` — segredo aleatório com pelo menos 32 caracteres, idêntico no runtime Edge e no Vault para o cron.

O ID da conta empresarial Meta e o ID do número são identificadores configurados na integração, não secrets. O projeto também precisa ter `pg_cron`, `pg_net` e Vault disponíveis, URL de Functions Supabase configurada no registro da integração, callback Meta validado e permissões necessárias no token. Nunca imprimir valores de secrets em terminal/logs.

## Ordem de rollout (não executada)

1. Conferir o estado atual remoto e o histórico de migrations. Fazer dry-run na sequência `20261106000001_whatsapp_inbound.sql` e `20261106000002_whatsapp_fluxos_atendimento.sql`; não resetar banco nem aplicar migrations históricas em lote.
2. Aplicar o par de migrations em janela controlada e executar `supabase/smoke-tests/fase-56-whatsapp-fluxos.sql`.
3. Publicar Edge Functions `whatsapp-admin`, `whatsapp-worker`, `whatsapp-dispatcher`, `whatsapp-send` e `whatsapp-webhook` com os secrets corretos; confirmar chamadas anônimas negadas nos workers e JWT obrigatório nas operações administrativas.
4. Publicar o frontend. Criar rascunhos de templates na interface, submeter para aprovação Meta e sincronizar antes de apontar fluxos para eles.
5. Validar grafo com simulação sem envio; testar atendimento com número interno autorizado, vínculo manual confirmado e consentimento exigido para notificações. Só então habilitar uma flag de cada vez.

## Guardrails de execução

- Notificações resolvem destinatários por relações atuais de usuário, papel, proposta, telefone verificado, consentimento e preferência. O dispatcher repete a verificação antes de enviar.
- Correspondência de telefone nunca concede acesso a proposta. Inbox de Admin limitado só mostra atendimento atribuído e associado a proposta que esse operador pode acessar; conversas não associadas ficam para Admin full.
- Texto livre só é enfileirado em atendimento assumido, dentro da janela de 24 horas. Templates exigem versão Meta `APPROVED`, conteúdo sincronizado, publicação interna e opt-in individual.
- `Sair`, `Parar` ou `Stop` bloqueia notificações e atendimento para aquele número. Não reativar sem consentimento conforme o fluxo previsto.
- Cota inicial: até 100 notificações automáticas por dia e 10 por destinatário/hora, com janela de 08h–20h de São Paulo; suporte pode alterar esses limites pela configuração do servidor. Atendimento dentro da janela é tratado separadamente.
- Resultado de rede incerto vira `incerto`; não reenviar automaticamente. Reconciliar com o histórico da Meta antes de qualquer reenvio manual.
- O cron consulta o Vault a cada minuto; enquanto as flags estiverem desligadas, não drena filas nem envia mensagens.

## Rollback operacional

1. Desligar as três flags no registro da integração. Manter webhook inbound ativo para registrar e deduplicar entradas; ele não deve disparar respostas.
2. Conferir mensagens `processando`, `incerto` e `pendente`. Não apagar fila, consentimentos, auditoria ou histórico e não repetir mensagens sem reconciliação.
3. Reverter frontend/Edge à versão anterior apenas se compatível com o schema. Não restaurar o antigo dispatcher sem autenticação ou qualquer comportamento que marque mensagens enviadas sem confirmação da Meta.
4. Se uma migration já estiver aplicada, corrigir com migration aditiva. Não apagar tabelas nem reescrever histórico aplicado. A publicação de template/Flow na Meta precisa de desativação/versionamento no painel da Meta; rollback de código não desfaz publicação externa.

## Verificação local realizada

- Migration de inbound e migration de automação compiladas em transação local, smoke test executado e `ROLLBACK` confirmado.
- Typecheck, lint e build da aplicação, testes focados do grafo/webhook/template e `deno check` das cinco Edge Functions executados; resultados detalhados constam em `prompts/2026-11-06-whatsapp-templates-fluxos-atendimento.md`.
- Não houve aplicação remota, deploy, submissão/publicação Meta ou envio real nesta implementação.
