# WhatsApp — templates, notificações e atendimento por fluxos

Data: 06/11/2026. Estado: plano, modelo e textos aprovados pelo proprietário; implementação local concluída em 06/11/2026. Publicação remota e ativação Meta continuam pendentes.

## 1. Objetivo e escopo confirmado

O proprietário confirmou **notificações e atendimento conversacional nesta entrega**. Reaproveitar `/admin/templates?canal=whatsapp`, `/admin/fluxos` e `/admin/integracoes/whatsapp`, com a biblioteca React Flow já instalada. Implementar:

1. Catálogo WhatsApp com versões, prévia, parâmetros e situação real na Meta.
2. Automações de notificações por eventos do sistema, com destinatários autorizados e execução confiável.
3. Atendimento conversacional determinístico, triagem, orientação pública e transferência humana.
4. Um formulário/menu nativo WhatsApp Flow para triagem, editável pelo subconjunto compatível do editor, com validação e publicação próprias na Meta.

Não inclui chamadas de IA, consultas Serasa, decisão de crédito, alteração de status do Kanban pelo chat, campanhas promocionais, criação automática de conta/proposta ou envio de documentos financeiros pelo WhatsApp. Os processos de proposta, e-mail e notificações internas existentes devem ser preservados.

## 2. Skills e documentação lidas

- Instruções AGENTS.md fornecidas pelo proprietário e `docs/operacao/change-management.md`.
- Skill `react-flow-usage` integralmente lida no anexo `/Users/macbook/.codex/attachments/0bfed793-5ab5-4e88-b8d9-e6a9b8673b28/Texto colado.txt`. Os diretórios auxiliares citados pelo anexo não foram fornecidos; não presumir conteúdo desses arquivos.
- `docs/README.md`; não existe README.md na raiz inspecionada.
- `docs/blueprint/02-roles-permissions.md`, `07-integrations-flows.md` e `08-security-compliance.md`.
- `docs/operacao/whatsapp-cloud-api-setup.md`, `2026-10-29-whatsapp-merx-inbound-pendencias.md` e `merx-publica-atendimento.md`.
- Planos `2026-10-22-whatsapp-business-templates-merx.md`, `2026-11-05-whatsapp-inbound-e-modelo.md` e `2026-11-06-whatsapp-entrega-real-diagnostico.md`.
- `.github/agents/ux-ui-mercurio-capital.agent.md`, para padrões existentes, responsividade e acessibilidade.
- Documentação oficial React Flow: https://reactflow.dev/learn/concepts/building-a-flow e https://reactflow.dev/examples/interaction/validation.
- Política oficial: https://whatsappbusiness.com/policy/.
- WhatsApp Flows: https://whatsappbusiness.com/products/whatsapp-flows/ e repositório oficial https://github.com/WhatsApp/WhatsApp-Flows-Tools.

Os documentos antigos descrevem Evolution e etapas já superadas do inbound. O código atual, as migrations efetivas e o diagnóstico de 06/11 têm precedência operacional. Exemplos antigos da Meta não definem a versão atual de Graph API; verificar a documentação técnica e validar a versão configurada durante a implementação.

## 3. Código e configuração inspecionados

- `app/package.json`: React 18, TypeScript, Vite, Tailwind 3, React Query e `@xyflow/react ^12.10.2`. Nenhuma dependência nova proposta.
- `app/src/pages/admin/Templates.tsx`, `Fluxos.tsx`, `WhatsAppConfig.tsx` e `app/src/router.tsx`.
- `app/src/lib/merxPublica.ts` e `supabase/functions/public-merx-lead/index.ts`: conteúdo público e validações existentes; o endpoint público exige reCAPTCHA e não deve ser reutilizado burlando essa exigência.
- `supabase/functions/whatsapp-send/index.ts`, `whatsapp-dispatcher/index.ts`, `whatsapp-webhook/index.ts`, helpers e testes `_shared/whatsapp-webhook-*`.
- `supabase/config.toml`.
- Migrations `20260520000020`, `20260609000003`, `20260609000004`, `20260609000005`, `20260717000001`, `20260718000002` e `20261106000001`.
- Consultas de leitura local e remota: catálogo, fluxos, filas, funções, agendamentos, relacionamentos de propostas/contratos/destinatários e nomes dos secrets.
- Leituras MCP na conta Mercúrio Capital: cadastro, número, catálogo de templates e biblioteca oficial. Não houve criação, edição, publicação ou envio na Meta neste levantamento.

## 4. Diagnóstico confirmado

| Item | Evidência observada nesta retomada |
| --- | --- |
| Recebimento real | Dois eventos reais foram confirmados no diagnóstico anterior de 06/11, com POST 200 e persistência única; não confundir com teste do painel Meta. |
| Catálogo no sistema | Sete templates WhatsApp, tanto localmente quanto em produção, ativos internamente, idioma `pt_BR`. |
| Catálogo na Meta | Listagem da conta vinculada retornou zero templates. Ativo no sistema não significa aprovado na Meta. |
| Editor | `/admin/fluxos` já usa React Flow; banco local e remoto retornaram zero fluxos cadastrados. |
| Persistência do desenho | `flowToFluxoPatch` salva ações e posições, mas não as conexões. `fluxoToFlow` reconstrói ligações diretas entre gatilho e ações. |
| Executor | `admin_fluxo_executar` exige Admin full, porém não avalia condições nem percorre as conexões. Não foi encontrado um consumidor automático de eventos nas funções consultadas. |
| Envio no código local | `whatsapp-send` e `whatsapp-dispatcher` marcam como enviado quando faltam credenciais. Há caminhos separados de envio direto e fila. |
| Worker no código local | Dispatcher sem validação de identidade própria no handler, com `verify_jwt=false`; precisa proteção antes da ativação. |
| Credenciais remotas | Entre os nomes WhatsApp consultados, existem APP_SECRET e VERIFY_TOKEN; faltam ACCESS_TOKEN e PHONE_NUMBER_ID usados pelo envio. Nenhum valor foi lido. |
| Inbound atual | Deduplicação, assinatura e retenção de 60 dias existentes; parser atual não interpreta respostas interativas de menus/formulários. |
| Preferências | Existe `partner_notif_prefs.whatsapp`, mas não foi localizada comprovação específica de autorização WhatsApp para todos os destinatários. Aceites Serasa não equivalem a essa autorização. |
| Contratos | `assinaturas_contrato` tem e-mail do signatário, mas não um telefone próprio. Não inferir destinatário por um e-mail ou telefone coincidente. |

As falhas de envio acima foram identificadas na fonte local; não se afirma que o mesmo comportamento foi reproduzido enviando mensagens em produção. Fila vazia e catálogo sem templates não autorizam preencher nem disparar retroativamente.

## 5. Distinção entre editor, templates e WhatsApp Flows

O grafo React Flow representa regras internas. Gatilhos de proposta, condições, resolução de destinatários e despacho ficam no servidor Mercúrio. Essa automação completa não é enviada à Meta como se fosse um formulário.

Templates de mensagem têm cadastro e análise próprios. Formulários nativos WhatsApp Flows usam outro documento, Flow JSON. O editor deve distinguir os modos **Automação de notificações** e **Atendimento**, expondo claramente o que pode ser exportado. Na primeira entrega, compilar apenas telas estáticas de menu, campos simples, navegação e conclusão compatíveis com o schema da Meta. Bloquear exportação de nós incompatíveis e exibir o erro no nó correspondente. Dados dinâmicos de proposta não entram nesse formulário.

Implementar criar rascunho remoto, enviar Flow JSON, ler erros de validação, pré-visualizar e publicar, sempre por backend autenticado. O MCP disponível auxilia templates, mas não oferece ferramentas nativas de gestão de Flows; esse caminho exige Graph API no servidor. Não executar essas ações durante a fase de planejamento.

Publicação ou aprovação não garante ausência de bloqueios. A política exige opt-in para mensagens subsequentes, respeito ao opt-out e templates aprovados fora da janela de atendimento de 24 horas. Automação deve oferecer saída clara para atendimento humano. Referência: https://whatsappbusiness.com/policy/.

## 6. Templates existentes e catálogo inicial proposto

Preservar os sete códigos, referências e históricos existentes. Versionar alterações de texto e parâmetros; não reescrever retroativamente mensagens nem versões aprovadas. Categoria pretendida para comunicações transacionais: `UTILITY`, sujeita à classificação/análise da Meta.

| Código existente | Nome Meta configurado | Parâmetros atuais, na ordem |
| --- | --- | --- |
| `wa_proposta_criada_v1` | `proposta_criada` | nome, protocolo, link |
| `wa_status_proposta_v1` | `status_proposta` | nome, protocolo, status |
| `wa_pendencia_doc_v1` | `pendencia_documento` | nome, protocolo, nome_doc, link |
| `wa_contrato_assinatura_v1` | `contrato_assinatura` | nome, protocolo, link |
| `wa_recurso_liberado_v1` | `recurso_liberado` | nome, protocolo, valor |
| `wa_partner_aprovado_v1` | `partner_aprovado` | nome, link |
| `wa_magic_link_v1` | `magic_link` | nome, link |

Novo código proposto: `wa_conta_criada_v1`, separado da aprovação do parceiro. Não comunicar aprovação quando existir apenas conta criada ou convite pendente.

Textos propostos para revisão do proprietário; chaves nomeadas internas serão convertidas para parâmetros Meta ordenados, com exemplos sintéticos:

| Evento | Corpo proposto | Ação |
| --- | --- | --- |
| Conta criada | Olá {{nome}}, sua conta na Mercúrio Capital foi criada. Acesse o workspace para acompanhar as informações do seu cadastro. | Acessar workspace |
| Parceiro aprovado | Olá {{nome}}, seu cadastro de parceiro na Mercúrio Capital foi aprovado. Você já pode acessar o workspace de parceiros. | Acessar workspace |
| Proposta criada | Olá {{nome}}, a proposta {{protocolo}} foi registrada na Mercúrio Capital. Acompanhe as informações no seu painel. | Ver proposta |
| Status atualizado | Olá {{nome}}, houve uma atualização na proposta {{protocolo}}. Etapa atual: {{status}}. | Ver proposta |
| Documento solicitado | Olá {{nome}}, há uma solicitação de {{nome_doc}} na proposta {{protocolo}}. Confira a pendência e envie o documento pelo painel. | Ver documentos |
| Contrato disponível | Olá {{nome}}, o contrato da proposta {{protocolo}} está disponível para assinatura. Confira as instruções no seu painel. | Ver contrato |
| Recurso liberado | Olá {{nome}}, foi registrada a liberação de recurso da proposta {{protocolo}}. Confira os detalhes no seu painel. | Ver proposta |

Botões levam ao domínio oficial e à rota já existente apropriada ao destinatário, com autenticação e autorização mantidas: `/c/propostas/:id`, `/p/propostas/:id` ou `/admin/propostas/:id`. Acesso geral usa o login do papel correto. Não colocar tokens de acesso em exemplos Meta, logs, grafo ou histórico. Os textos e componentes novos pertencem à nova versão, mantendo o mapeamento legado até a publicação aprovada.

O texto proposto de liberação evita confundir valor solicitado com valor efetivamente liberado. A variante histórica com `valor` permanece no histórico; não preencher esse campo com valor solicitado por conveniência. Status deve usar rótulo legível do catálogo atual, nunca o enum bruto. Documento deve ter descrição necessária e adequada ao destinatário; o arquivo fica no portal.

Biblioteca Meta pesquisada primeiro. Opção encontrada para criação de conta: `account_creation_confirmation_3`, `pt_BR`, `UTILITY`, **não pré-aprovada**. Texto retornado:

> Oi, {{1}},
>
> Sua nova conta foi criada com sucesso.
>
> Verifique {{2}} para concluir seu perfil.

Cabeçalho: “Finalize a configuração da conta”. Botão: “Verificar a conta”. É uma alternativa apenas se corresponder ao fluxo real; a recomendação para revisão é o texto específico da Mercúrio na tabela. Pesquisas por documento e proposta não retornaram opção pertinente. Não usar modelos de retirada de pedidos para pendências de crédito.

`wa_magic_link_v1` continua cadastrado, mas não integra o lote inicial de publicação/envio. Um link arbitrário não deve ser classificado como template de autenticação OTP sem atender ao formato próprio da Meta. Login atual por e-mail é preservado.

## 7. Eventos, destinatários e regras de execução

Eventos novos entram na fila somente após a alteração real confirmada no servidor: conta efetivamente criada, parceiro aprovado, proposta criada, status alterado, pendência criada/direcionada e contrato disponibilizado para assinatura. Liberação decorre da transição real correspondente, sem recalcular o processo financeiro. Não disparar para propostas preexistentes nem no carregamento da página.

| Evento | Destinatários permitidos |
| --- | --- |
| Conta criada / parceiro aprovado | O próprio titular, após resolver telefone e preferência/autorização aplicáveis. |
| Proposta criada / etapa alterada / liberação | Principal, originador, responsável e signatários vinculados, conforme seleção explícita no fluxo e autorização individual. Deduplicar a mesma pessoa/número no evento. |
| Pendência documental | Titulares da pendência e responsáveis autorizados, não todos os contatos indiscriminadamente. |
| Contrato disponível | Signatários e envolvidos explicitamente selecionados e autorizados, sem expor o contrato a terceiros. |

Resolver referências no servidor usando propostas, clientes, parceiros, usuários e assinaturas de contrato existentes. Falta de telefone verificado, opt-in, associação inequívoca ou acesso resulta em **ignorado/bloqueado com motivo**, e não em adivinhação. A tela mostra quem receberia e por quê no modo simulado.

O executor deve seguir nós e conexões aprovados, avaliar condições permitidas e registrar o caminho percorrido. Condições admitem apenas campos e operadores de um catálogo tipado. Proibir código livre, SQL, URLs arbitrárias e ciclos. Limitar tamanho do grafo, passos por execução e volume por destinatário. Configurações editáveis são não secretas e ficam no servidor.

Usar fila transacional para capturar eventos e worker para trabalho externo. Nenhuma chamada à Meta dentro de trigger SQL. Idempotência por evento + versão + nó + destinatário; publicar outra versão não reprocessa automaticamente eventos antigos. Concorrência precisa de reserva atômica; falha com resultado incerto não deve gerar reenvio cego.

## 8. Atendimento conversacional proposto

Fluxo inicial editável, apresentado ao proprietário antes da ativação:

1. Mensagem recebida válida cria/retoma atendimento, deduplicada pelo ID do provedor.
2. Saudação: “Olá! Sou a MERX, assistente virtual da Mercúrio Capital. Posso orientar você sobre nossos serviços e encaminhar seu atendimento. Como posso ajudar?”
3. Menu: **Já sou cliente ou parceiro**, **Quero conhecer as opções de crédito**, **Quero ser parceiro**, **Falar com a equipe**.
4. Cliente/parceiro: orientar acesso ao portal autenticado. Não fornecer dados privados apenas porque o telefone coincide com um cadastro.
5. Crédito: FAQ pública curada já existente, escolha do produto e encaminhamento à equipe. Sem promessa de taxa, prazo ou aprovação.
6. Parceria: orientação pública e link `/p/registro`, com possibilidade de encaminhamento humano.
7. Menu/formulário nativo opcional ao usuário: nome preferido e assunto, com aviso sobre o uso dos dados para atendimento; conclusão retorna à conversa/triagem. Não exigir CPF, CNPJ, endereço, score, dados bancários ou documento nesse formulário.
8. “Falar com a equipe” coloca em fila humana e pausa automação; Admin assume, responde e encerra ou devolve ao fluxo. Falta de operador deve ser informada sem prometer atendimento imediato. Reutilizar contatos oficiais existentes como alternativa.
9. “Sair”, “parar” e pedido equivalente encerram a automação e registram bloqueio de mensagens subsequentes. Retomar notificações exige nova autorização explícita.

Respostas desconhecidas têm fallback curto e opção humana, sem inventar entendimento. Botões/listas e respostas `interactive.nfm_reply` são entradas não confiáveis: validar schema, opção permitida, token de correlação, expiração e vínculo ao atendimento, além da assinatura e deduplicação já existentes. Mensagens recebidas fora de ordem não retrocedem a sessão.

A primeira entrega atende e encaminha; não muda silenciosamente a origem de leads existentes para simular captação pelo chat público. Captação adicional pode ser configurada depois com ação específica e modelo aprovado. O endpoint `public-merx-lead` e o reCAPTCHA público permanecem íntegros.

## 9. Modelo incremental proposto para aprovação

Nomes abaixo são propostos, não tabelas já existentes. Usar UUIDs, timestamptz, limites de tamanho, índices e constraints; campos opcionais explicitamente indicados. Confirmar ausência de colisões antes de criar migrations novas. Não renomear tabelas legadas nem reescrever migrations publicadas.

### Entidades existentes reutilizadas

- `templates_mensagem`: identidade e código estável. Adicionar ponteiro opcional para versão de envio publicada, sem alterar templates de e-mail.
- `fluxos_evolution`: identidade do fluxo; adicionar `modo` (`notificacao`/`atendimento`), rascunho validável e ponteiro opcional para versão publicada. Preservar `acoes` e `condicoes` para compatibilidade com fluxos legados; a conversão precisa ser explícita, nunca reinterpretar regras silenciosamente.
- `fluxo_execucoes`: adicionar referência de versão/evento/atendimento quando aplicável e trilha mínima de nós e motivos. Manter execução simulada identificada e sem efeitos.
- `whatsapp_mensagens`: fila/histórico de saída único; referências opcionais de versão de template, execução, evento e atendimento, chave idempotente, reserva do worker e situação de bloqueio/resultado incerto. Preservar `evolution_message_id` como campo histórico de ID do provedor; não reativar Evolution.
- `whatsapp_mensagens_recebidas`: manter unicidade de `provider_message_id`, expiração de 60 dias e associação explícita. Acrescentar referência opcional de atendimento e resposta interativa normalizada/limitada, sem payload bruto.
- Configuração de integração existente: flags independentes para envio, automações e atendimento; padrão desligado. Conta/número, versão da API, limites e horários não secretos são configuráveis. Secrets continuam exclusivamente no servidor.

### Novas entidades

| Entidade | Campos e relações principais |
| --- | --- |
| `whatsapp_template_versoes` | `id`, `template_id` FK, `versao`, `nome_meta`, `idioma`, `categoria`, `componentes` JSON tipado, `parametros` ordenados, `conteudo_hash`, `estado_local`, `conta_id`, timestamps. Opcionais: `meta_template_id`, `estado_meta`, `motivo_meta`, `sincronizado_em`, `publicado_por`. Unique `(template_id, versao)` e nome/idioma por conta. Sem destinatários nem exemplos pessoais. |
| `whatsapp_fluxo_versoes` | `id`, `fluxo_id` FK, `versao`, `schema_version`, `nodes`, `edges`, `viewport`, `conteudo_hash`, `publicado_por`, `publicado_em`. Opcionais para atendimento exportável: `flow_json`, `meta_flow_id`, `estado_meta`, erros de validação limitados, `sincronizado_em`. Unique `(fluxo_id, versao)`; versão publicada imutável e grafo limitado. |
| `whatsapp_eventos` | `id`, `evento`, `chave_origem` única, `ocorrido_em`, referências tipadas mínimas, `status`, `tentativas`, `disponivel_em`, reserva/expiração e motivo limitado. Opcionais: `proposta_id`, `usuario_id`, versão fixada no processamento. Não armazenar relatório, documento ou corpo integral do cadastro. |
| `whatsapp_atendimentos` | `id`, `phone_number_id`, `sender_phone`, `estado`, `ultima_mensagem_em`, `expira_em`, timestamps; opcionais `fluxo_versao_id`, `no_atual_id`, `responsavel_id`, `usuario_id`, `proposta_id` e contexto público mínimo. No máximo um atendimento aberto por número empresarial/remetente. Telefone não concede identidade nem proposta. |
| `whatsapp_consentimentos` | `id`, `phone_number_id`, `telefone`, `finalidade`, `estado`, `origem`, `versao_texto`, `registrado_em`; opcionais `usuario_id`, `evento_comprovante_id`, `revogado_em`. Preferência vigente única por número/finalidade; manter evidência mínima e revogação sem depender da existência do texto original da conversa. |

Relacionamentos: um template e um fluxo têm várias versões; uma execução aponta para uma versão fixa; um atendimento tem várias mensagens recebidas/enviadas e é associado a usuário/proposta somente após verificação. Um evento pode gerar saídas para vários destinatários autorizados, com unicidade por ação/destinatário. Versões publicadas não podem ser apagadas enquanto referenciadas por histórico operacional.

Retenção proposta: continuar 60 dias para conteúdo recebido e aplicar o mesmo prazo ao conteúdo de saída, respostas de formulários e contexto de atendimento; auditoria operacional pode preservar IDs, horários e motivos sem conteúdo pessoal. Preservar apenas a preferência/comprovação mínima enquanto a autorização estiver vigente e o bloqueio necessário para respeitar opt-out; não apagar o bloqueio ao expurgar mensagens. Sem prazo infinito para payloads, nomes ou formulários.

## 10. RLS, RPCs e fronteiras de segurança

- Admin full: editar configurações, templates e fluxos; validar/publicar versões internas; solicitar sincronização/publicação na Meta.
- Admin limitado: somente atendimento atribuído com contexto de proposta que já pode acessar. Conversa sem associação ou ambígua fica restrita a Admin full até atribuição válida; nenhuma liberação geral do inbox para parceiros/clientes.
- Backend revalida identidade, escopo e destino em toda mutação e no momento do envio. Views precisam preservar a RLS efetiva. RPCs privilegiadas têm `search_path` fixo e grants mínimos; não basta esconder botões.
- Worker recebe identidade interna validada; impedir drenagem pública da fila. Chamadas administrativas exigem JWT de usuário e nível full. Segredos e service role nunca chegam ao browser/MCP pelo app.
- Reutilizar RPCs administrativas existentes quando compatíveis; acrescentar operações explícitas de salvar rascunho, validar, simular, publicar versão, assumir/encerrar atendimento e consultar histórico filtrado. Ações de publicação externa passam por Edge autenticada e auditada.
- Opt-in é individual, por finalidade; preferência `partner_notif_prefs.whatsapp=false` sempre bloqueia. Mensagem espontânea permite atendimento na janela aplicável, mas não autorização genérica para futuras notificações. Sem backfill presumido de consentimento.
- Conteúdo de clientes tratado como texto e dados, nunca HTML/código executável. URLs de destino restritas ao domínio oficial/rotas permitidas. Sem CPF, relatório Serasa ou token de assinatura no texto de notificação, amostras ou logs.
- Mensagens e atendimento não autorizam alterações de proposta, consulta paga, débito ou concessão de crédito.

## 11. Interface proposta sobre as telas existentes

Sem referência visual nova fornecida, o padrão atual Mercúrio é a base sujeita à aprovação deste plano. Reutilizar TSX/Tailwind, componentes existentes e botões `btn-no-liquid`.

**Templates WhatsApp:** lista com estado local e estado Meta separados, idioma, categoria, versão e sincronização. Edição com parâmetros, componentes e prévia. Links “Usar em fluxo” e “Abrir fluxos”. Ações validar, salvar rascunho e solicitar publicação distintas; erro/pending/rejeitado/pausado nunca aparecem como aprovado.

**Fluxos:** seletor dos dois modos; lista lateral, canvas com área delimitada e painel do nó selecionado. Paleta tipada: evento/entrada, condição, destinatários, template, resposta de atendimento, menu/formulário, transferência e fim. Salvar nodes/edges/viewport; sem localStorage de destinatários. Rascunho, simulação, versão publicada e publicação Meta são estados separados. Nós incompatíveis mostram o motivo; não colocar execução real sob um botão que pareça prévia.

**Integração WhatsApp:** abas na rota existente para conexão, atendimentos e histórico/fila. Lista de atendimentos, responsável, estado e janela de resposta; painel de conversa com assumir, responder, pausar bot e encerrar. Mostrar bloqueios de envio sem falsa confirmação de entrega. Sem nova rota pública ou acesso ao portal por telefone.

Estados obrigatórios: carregando, vazio, falha, credenciais ausentes, permissão insuficiente, consentimento ausente/revogado, janela encerrada, template indisponível e Meta indisponível. Mobile adapta painéis; canvas mantém controles com tamanho explícito. Foco, teclado, labels, anúncio de estado e contraste verificáveis; movimento reduzido respeitado.

## 12. Correções necessárias antes de ativar envio

1. Remover sucesso fictício com credenciais ausentes. Simulação tem modo próprio e não consome fila real.
2. Unificar resolução e entrega pela fila; enviar uma vez, com reserva atômica. `template_codigo` resolve versão/nome/idioma/componentes/parâmetros validados no servidor.
3. Falhar fechado com template não aprovado, divergência de versão, parâmetro faltante, credencial inválida ou política não atendida. Não trocar por texto livre para contornar erro.
4. Proteger dispatcher e vincular seu agendamento a credencial interna segura, sem secret em repositório ou UI.
5. Tratar timeout com resultado desconhecido e callbacks repetidos/fora de ordem. Não regredir lido para enviado; distinguir aceitação da API, entrega e leitura.
6. Respeitar opt-out, janela de atendimento, preferência, horários/limites configuráveis e filas humanas. Sincronizar situação Meta e bloquear versão pausada/rejeitada.
7. Parser de interação e worker não atrasam o ACK do webhook. Preservar assinatura, limites, deduplicação e recebimento já validado.

## 13. Sequência e arquivos esperados

1. Aprovar este plano, modelo e textos. Implementar primeiro proteções/fila, depois catálogo e grafo, eventos e atendimento, por último adaptador Meta Flows e validação integrada. Ambas as modalidades fazem parte da entrega; ativação continua gradual.
2. Migrations aditivas novas em `supabase/migrations/`, com numeração reconciliada, e smoke SQL sintético com ROLLBACK em `supabase/smoke-tests/`.
3. Evoluir `app/src/pages/admin/Templates.tsx`, `Fluxos.tsx`, `WhatsAppConfig.tsx`; componentes específicos sob `app/src/components/admin/whatsapp/` e helpers/testes de grafo/template sob `app/src/lib/`.
4. Evoluir `supabase/functions/whatsapp-send/`, `whatsapp-dispatcher/`, `whatsapp-webhook/` e `_shared/whatsapp-*`; adicionar worker de automação e Edge administrativa de templates/Flows somente para as responsabilidades aprovadas.
5. Ajustar `supabase/config.toml` para proteções e funções novas. Eventuais testes/browser fixtures ficam nas convenções atuais do projeto. Não alterar dependências, bibliotecas nem empacotamento.
6. Atualizar documentação operacional, mapa de permissões e schema/integrações; registrar estado real de cada publicação, sem chamar código local de produção.

Impacto: web, banco/RLS, Edge e operação WhatsApp afetados. Mobile/Expo e Electron/updater/artefatos não têm alteração específica; preservar compatibilidade dos endpoints existentes. E-mail, financeiro, Serasa, MERX pública e Kanban não mudam de regra; os eventos apenas observam transições já existentes.

## 14. Verificações e critérios de aceite

Testes automatizados após implementação:

- `npm run lint`, `npm run typecheck`, testes focados com Vitest e `npm run build` em `app/`.
- Testes dos helpers Edge com o runner já usado no repositório, validação dos imports/entrypoints e smoke SQL local após migrations.
- Salvar/reabrir preserva conexões, posições e viewport. Condições, ramificações e destinatários simulados correspondem ao executor real; nós órfãos inválidos, ciclos, campos desconhecidos e variáveis faltantes bloqueiam publicação.
- Mesmo evento/replay/concorrência produz no máximo uma saída por destinatário/ação. A nova versão não duplica eventos já executados. Envios incertos não são reenviados cegamente.
- Credenciais ausentes não geram enviado; dispatcher anônimo é negado. Sem opt-in/preferência, fora da janela ou template pausado/rejeitado, o envio correto é bloqueado com motivo.
- Assinatura inválida, JSON inválido, interação forjada, token expirado e webhook duplicado não geram ações. Respostas repetidas não avançam dois passos.
- Simulador não enfileira nem envia. Publicação de Flow não aceita nós internos incompatíveis; erro da Meta mantém rascunho. Resposta nativa é correlacionada e normalizada.
- RPC/RLS testadas com anon, cliente, parceiro, Admin limitado fora/dentro do escopo e Admin full. Telefone coincidente não revela proposta alheia; signatário sem telefone não recebe por aproximação.
- Compatibilidade dos sete códigos legados, templates de e-mail, chamadas existentes e parser inbound coberta por testes de regressão proporcionais.
- Retenção expurga conteúdo aos 60 dias sem apagar opt-out vigente nem afetar registros de auditoria imutáveis existentes.

Validação manual no navegador: criar rascunho, editar grafo, simular, recarregar, conferir prévia de WhatsApp, parâmetros inválidos, erros Meta, estados vazios, teclado e mobile; assumir/encerrar atendimento e testar retomada da automação.

Ponta a ponta remoto somente após autorização: número interno escolhido, uma mensagem real de entrada, uma resposta na janela, um template aprovado e um Flow publicado, verificando ID do provedor, gravação única e callbacks. Não usar clientes reais como fixtures nem testes Meta como evidência de conversa real. Publicação do editor sem entrega real não encerra esse aceite.

O diagnóstico e o plano foram aprovados e a implementação local foi concluída. A migrations e as Edge Functions permanecem sem aplicação/publicação remota; nenhum template/Flow foi submetido à Meta e nenhuma mensagem foi enviada nesta etapa.

## 15. Rollout, rollback e próximos gates

- Checkout atual tem mudanças de outras frentes; preservar tudo. Para release, usar snapshot/worktree isolado e arquivos explicitamente revisados.
- Migrations novas são aditivas, flags começam desligadas e nenhum histórico é reenviado. Reconciliar local/remoto e apresentar dry-run antes da aplicação remota.
- Concluir implementação, verificações locais, revisão e preview; apresentar batch exato de templates/Flow, destinatário de teste e versões remotas antes de ativar.
- Aplicação remota de migrations, deploy Edge/Vercel, criação/publicação de templates/Flow na Meta e envio de teste precisam do go/no-go correspondente. Aprovar este plano autoriza implementação local, não esses efeitos externos.
- Rollback operacional: pausar automações/saída, manter inbound ativo, suspender atendimentos automáticos e preservar fila/histórico para reconciliação; restaurar versão anterior do frontend/Edge e ponteiro de fluxo quando compatível.
- Não restaurar dispatcher sem autenticação nem modo que marca enviado sem credencial. Não apagar migrations aplicadas, consentimentos, auditoria ou mensagens para simular rollback; usar correção aditiva quando necessário.
- Template/Flow já publicado na Meta pode exigir nova versão ou desativação; rollback do frontend não desfaz publicação externa. Nunca reenviar mensagens como consequência automática do rollback.

## 16. Resultado da implementação local (06/11/2026)

### Entregue

- Catálogo de templates com versões locais, placeholders, simulação, submissão/sincronização Meta autenticada e separação entre rascunho, aprovação externa e ativação interna.
- Editor React Flow com nós e conexões persistidos, simulação local e compilação limitada ao subconjunto de formulário nativo.
- Eventos de conta/parceiro/proposta/pendência/contrato, outbox com reserva e idempotência, dispatcher protegido por credencial interna e worker para notificação/triagem.
- Inbox com escopo restrito, vínculo de identidade manual verificado, consentimento individual, fila humana e controles de atendimento.
- Parser inbound limitado para respostas de lista e formulários, token correlacionado por hash, opt-out e expurgo em 60 dias.
- Migration aditiva `20261106000002_whatsapp_fluxos_atendimento.sql`, smoke read-only `supabase/smoke-tests/fase-56-whatsapp-fluxos.sql`, docs e runbook.

### Verificação executada

- `npm run typecheck` em `app/`: passou.
- `npm run lint` em `app/`: passou sem erros; 33 avisos preexistentes em arquivos diversos.
- `npm run build` em `app/`: passou; Vite reportou chunks maiores que 500 kB.
- Testes Vitest do grafo: 10 passaram.
- Testes Node do parser inbound, assinatura/webhook e comparação de template: 11 passaram.
- `deno check` nos cinco entrypoints WhatsApp: passou.
- Migrations inbound+automação e smoke fase 56 executados numa transação PostgreSQL local; smoke retornou `FASE 56 SMOKE: OK` e a transação terminou com `ROLLBACK`.

### Pendente antes de ativação

- Não foi possível executar verificação visual manual: não havia navegador remoto disponível em `127.0.0.1:9222` nem Playwright instalado no app. No próximo teste visual, abrir `/admin/fluxos`, criar/salvar/reabrir um rascunho, testar a simulação, revisar o canvas no desktop/mobile e conferir `/admin/templates?canal=whatsapp` e Inbox.
- Aplicar migrations somente após reconciliar novamente o remoto e aprovar o batch; publicar Edge/Vercel separadamente.
- Conferir os nomes dos secrets no Supabase. O código requer `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_WORKER_SECRET`; ID empresarial e ID do telefone ficam nos campos de configuração, não como secrets.
- Submeter templates na Meta e aguardar aprovação, validar formulário nativo na Meta, configurar consentimentos e habilitar uma flag por vez. Esses passos não ocorreram.

Próximo passo: aprovação explícita do plano, modelo de dados e lote de textos propostos; depois iniciar implementação local na ordem acima.
