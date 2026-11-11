# WhatsApp — vincular template Meta ao catálogo interno

Data: 06/11/2026. Estado: migration aplicada e validada; publicação da Edge e Vercel aguardam credenciais/configuração Meta em produção. O `config.toml` do checkout não foi alterado.

## Objetivo

Fazer a tela `/admin/templates?canal=whatsapp` carregar seu catálogo e permitir reconciliar com segurança o template `status_proposta` já criado na Meta, sem criar duplicata nem habilitar envios.

## Documentos e instruções consultados

- `AGENTS.md` fornecido pelo proprietário nesta conversa.
- `docs/operacao/change-management.md` e `docs/operacao/release-checklist.md`.
- `docs/operacao/whatsapp-cloud-api-setup.md` e `docs/operacao/whatsapp-automacoes-atendimento.md`.
- `prompts/2026-11-06-whatsapp-templates-fluxos-atendimento.md` e `prompts/2026-11-06-whatsapp-entrega-real-diagnostico.md`.
- Anexo de referência React Flow já lido durante o plano WhatsApp anterior; não é necessário para esta alteração.

## Código e estado remoto inspecionados

- `app/src/components/admin/whatsapp/TemplateCatalog.tsx` e `app/src/pages/admin/Templates.tsx`.
- `supabase/functions/whatsapp-admin/index.ts`, `supabase/functions/_shared/whatsapp-runtime.ts` e `supabase/functions/_shared/whatsapp-meta.ts`.
- `supabase/migrations/20261106000002_whatsapp_fluxos_atendimento.sql` (arquivo local já existente e não rastreado; não será reescrito).
- `supabase/config.toml` está modificado no workspace; preservar seu conteúdo e demais alterações preexistentes.
- CLI remoto em modo somente leitura: produção tem `20261106000001` aplicada; `20261106000002` local está pendente. Edge `whatsapp-admin` e `whatsapp-worker` não aparecem implantadas. Os nomes `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_WORKER_SECRET` não aparecem entre os secrets; valores de secrets não foram lidos.
- MCP Meta, conta Mercúrio Capital: o template `status_proposta`, `pt_BR`, categoria `UTILITY`, foi criado com ID `2171131830108052` e está `PENDING`. Nenhuma mensagem foi enviada.
- O catálogo interno já tem `wa_status_proposta_v1`, com variáveis `nome`, `protocolo`, `status`. Os templates internos e os templates Meta são registros independentes.

## Diagnóstico e decisões

O aviso da interface é compatível com a migration pendente, mas existe uma segunda lacuna: a função atual recusa um nome já encontrado na Meta e a ação de sincronizar exige que a versão interna já possua `meta_template_id`. Portanto, aplicar a migration isoladamente não vincula o template criado pelo MCP.

O vínculo deve usar as entidades definidas na migration existente: `templates_mensagem` mantém o código interno e `whatsapp_template_versoes` guarda snapshot imutável, conta, nome, idioma, categoria, componentes, parâmetros, ID e estado Meta. Não criar outra tabela nem reescrever migration publicada.

Adicionar reconciliação server-side para localizar pelo nome/idioma exatos na conta configurada, validar categoria e componentes contra a versão interna e então associar ID/status Meta. Em caso de zero ou múltiplas correspondências, conta diferente ou conteúdo divergente, não gravar vínculo e mostrar motivo recuperável. Somente Admin full pode reconciliar. O browser não recebe token nem faz chamada Graph.

O estado Meta `PENDING` não ativa a versão de envio. `estado_local` permanece `rascunho`; nenhuma fila ou notificação é habilitada. O worker e `WHATSAPP_WORKER_SECRET` não são necessários para visualizar e reconciliar um template; envio continua desativado. A função administrativa precisará de `WHATSAPP_ACCESS_TOKEN` no servidor para consultar a Meta.

## Modelo de dados principal e regras

- `templates_mensagem` 1:N `whatsapp_template_versoes`, pela FK `template_id`.
- A versão guarda o snapshot Meta e referências `conta_id`/`meta_template_id`, preservando conteúdo e histórico.
- Reutilizar o registro interno `wa_status_proposta_v1`; não criar um novo código de template para o mesmo evento.
- Associação só é válida se conta, nome `status_proposta`, idioma `pt_BR`, categoria `UTILITY` e componentes corresponderem ao snapshot submetido. Estado aprovado é lido da Meta, nunca inferido.
- Nenhuma alteração no fluxo de envio, consentimento, limites, RLS ou processo de propostas.

## Arquivos esperados após aprovação

- `supabase/functions/whatsapp-admin/index.ts` — ação autenticada de reconciliação segura.
- `app/src/components/admin/whatsapp/TemplateCatalog.tsx` — affordance e feedback de reconciliar template existente.
- Teste focado para comparar nome/idioma/categoria/componentes, incluindo divergências e duplicatas.
- Atualização deste plano com resultado dos testes e roteiro operacional.

Não alterar migrations, `supabase/config.toml`, worker, outras integrações ou templates fora desse vínculo.

## Critérios de aceite

1. Catálogo lista versões sem erro quando schema e acesso Admin full estão presentes.
2. Admin limitado recebe negação do servidor para reconciliação.
3. Reconciliação do template existente associa o ID `2171131830108052` somente se o conteúdo real consultado corresponder exatamente ao snapshot interno.
4. Divergência, duplicidade ou falha Graph não altera ponteiros nem conteúdo imutável e aparece com mensagem clara.
5. Estado `PENDING` permanece rascunho e não pode ser usado para envio.
6. Nenhuma chamada de envio ou ativação automática é feita.

## Segurança

- Token Meta somente em secret de Edge; nunca no frontend, URL, log ou relatório.
- Autorização Admin full validada novamente na Edge Function; RLS continua impondo leitura administrativa.
- Consultar estado atual da Meta antes do vínculo; não confiar apenas no ID fornecido pelo navegador.
- Conteúdo do WhatsApp e dados de destinatários não são necessários para a reconciliação; usar exemplos sintéticos.
- Não imprimir saída bruta da listagem de secrets.

## Verificações

- Testes unitários de correspondência exata e de casos de erro.
- Typecheck, lint e build do app; verificação de tipos/format do Deno para Edge Function.
- Testes locais com resposta Meta simulada: match único, sem match, duplicata, conta/idioma/categoria/conteúdo divergentes, acesso limitado e falha de rede.
- Smoke visual no preview: catálogo carrega, status PENDING visível, sem ação de envio habilitada.
- Nenhuma consulta real a clientes nem mensagem será enviada.

## Rollout e rollback

Implementação local primeiro, em checkout sujo e sem stage/commit de arquivos alheios. Antes de qualquer publicação, fazer dry-run/revisão da migration pendente e confirmar Admin full, integração e configuração.

Aplicação da migration, publicação de Edge Function, cadastro/rotação de secret e deploy web são gates independentes que exigem autorização explícita para cada operação. Não executar nesta aprovação de implementação.

A migration já existente é aditiva, mas altera funções e políticas WhatsApp; não prometer rollback por `db reset` ou apagar versão após uso. Se publicação falhar, manter flags de envio/automação/atendimento desligadas, reverter apenas o artefato Edge para a versão anterior se necessário e corrigir por forward-fix. Não enviar nem ativar o template até sincronização correta e aprovação Meta.

## Resultado da implementação local

- `whatsapp-meta.ts` agora compara candidato e snapshot interno por nome, idioma, categoria e componentes, exigindo ID numérico e estado Meta válido; match ausente, duplicado ou divergente não é aceito.
- `whatsapp-admin` ganhou a ação autenticada `reconciliar_template`, acessível pelo gate Admin full existente. A Edge consulta a lista da conta configurada e só grava `meta_template_id`, conta, estado/motivo Meta e horário de sincronização, com condição para evitar sobrescrever um vínculo concorrente. Não publica localmente nem envia mensagens.
- `TemplateCatalog` mostra a ação de vincular um template existente somente para versão sem vínculo e exibe o resultado. O rascunho inicial de `wa_status_proposta_v1` foi alinhado ao conteúdo `UTILITY` criado na Meta, mantendo as três variáveis posicionais e sem botão.
- Testes focados do comparador: 4/4 passaram. ESLint focado do componente passou sem avisos. Typecheck e build passaram; build exibiu apenas aviso de chunk grande. Deno não está instalado neste ambiente, então `deno check` não foi executado.
- Suíte geral: 237 testes passaram; 4 testes em `adminLeadsSimulacoes`, `dateRangePicker` e `publicAmortizationSimulator` falharam por timeout de 5 s. Esses arquivos não fazem parte desta mudança; a suíte completa não ficou verde.
- Não foi possível validar visualmente no navegador nem contra a Edge remota: schema/migration e função remota continuam pendentes. Não houve stage/commit, alteração remota, consulta Serasa, envio WhatsApp ou deploy.

## Rollout autorizado e progresso em 06/11/2026

- O dono autorizou migration, secret, publicação da Edge e deploy web.
- O CLI 3.0.0 rejeitou o legado `[inbucket]` do `supabase/config.toml`. Para não alterar o arquivo compartilhado, a listagem/dry-run e aplicação foram executados em workspace temporário, removendo somente esse bloco obsoleto e preservando migrations/templates. O dry-run listou exclusivamente `20261106000002_whatsapp_fluxos_atendimento.sql`; a migration foi aplicada e a releitura confirmou a versão remota e `db push --dry-run` “up to date”.
- Smoke equivalente estritamente read-only confirmou tabelas/RLS, grants, índices, colunas e os dois jobs. O arquivo original usa `DO`, recusado pelo modo `--read-only` do CLI, então as mesmas asserções foram executadas como um único `SELECT` read-only.
- O registro `integracoes_config` para WhatsApp existe, mas produção não tem `conta_id` nem `phone_number_id`, e está inativo. As flags de envio/automação/atendimento permanecem desligadas; o cron de worker verifica o estado ativo e retorna sem chamar os workers enquanto desligado.
- A listagem segura de nomes de secrets não encontrou `WHATSAPP_ACCESS_TOKEN`; nenhum valor foi lido. A Edge `whatsapp-admin` ainda não foi publicada.
- Vercel: o último deployment listado está `Error`; o anterior inspecionado está `Ready` e o domínio canônico responde HTTP 200. Para evitar publicar alterações alheias, foi criado snapshot isolado baseado em `HEAD`, sobrepondo apenas `Templates.tsx`, `TemplateCatalog.tsx` e `api.ts`; typecheck/build desse snapshot passaram. O deploy ainda não foi executado.
- O usuário foi orientado a cadastrar `WHATSAPP_ACCESS_TOKEN` diretamente nos Supabase Edge Function Secrets, sem colar o token no chat. A publicação da Edge e da interface deve aguardar esse secret e o `conta_id` da WABA estarem configurados, para permitir validação real de reconciliação.

## Próximo passo operacional

Quando o secret e o ID da conta Meta estiverem configurados sem ativar flags de envio, publicar somente `whatsapp-admin` a partir do snapshot isolado e executar validação autenticada sem enviar mensagem. Depois, publicar o snapshot web isolado e confirmar o domínio/rota de templates. O template Meta `PENDING` continuará como rascunho; não usar nem habilitar envio.

## Publicação de produção concluída em 06/11/2026

- Secret `WHATSAPP_ACCESS_TOKEN` confirmado presente via inventário que exibiu somente nomes; nenhum valor foi lido. `WHATSAPP_WORKER_SECRET` continua ausente.
- O `conta_id` da integração foi preenchido com a conta fornecida pelo proprietário (`1413989444229654`). Estado relido no banco: `ativo=false`, `envio_habilitado=false`, `automacoes_habilitadas=false`, `atendimento_habilitado=false`.
- Migration `20261106000002` confirmada local/remota; listagem foi feita no workspace Supabase temporário sem o bloco legado `[inbucket]` e não há divergência até essa migration.
- Edge `whatsapp-admin` publicada isoladamente, sem publicar `whatsapp-worker` ou mudar flags. Consta `ACTIVE`, versão 1. Smoke HTTP sem JWT retornou 401 `unauthorized`, confirmando que a Edge exige identidade mesmo com verificação automática de JWT desativada.
- Vercel deployment `dpl_HQFxsMcC5Rfwf8nWhhcEG23DEMhw` ficou `READY`. O alias `www.mercuriocapitalsa.com.br` foi apontado para o novo deployment; apex preservou redirecionamento 308 para `www`. A rota retorna 200 e o chunk de Templates contém o catálogo Meta e a ação de reconciliação.
- A compilação remota instalou dependências e concluiu `tsc -b && vite build`; o Vercel reportou 28 vulnerabilidades no grafo de dependências e o aviso já conhecido de chunk acima de 500 KB.
- Não há versão em `whatsapp_template_versoes` para `wa_status_proposta_v1`; o catálogo interno existe e informa `status_proposta`/`pt_BR`. Nenhuma reconciliação foi executada, pois exige sessão Admin full autenticada. Nenhum envio foi feito.

### Validação manual pendente

Entrar como Admin full em `https://www.mercuriocapitalsa.com.br/admin/templates?canal=whatsapp`, localizar “Status da proposta”, clicar “Nova versão” e salvar a versão `status_proposta`. Em seguida, clicar “Vincular existente na Meta”. A ação deve confirmar correspondência exata, associar o ID Meta e manter o estado local como rascunho; revisar que o estado Meta retornado permanece `PENDING`. Não usar “Usar versão aprovada” enquanto a Meta não aprovar. Se o conteúdo divergir, interromper e reportar a mensagem sem submeter outra cópia.
