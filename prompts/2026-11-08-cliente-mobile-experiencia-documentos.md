# Plano — experiência do cliente mobile e documentos reutilizáveis

Status: implementado, validado visualmente e com migrations aplicadas em produção em 2026-11-09. O app mobile ainda não foi distribuído; o backfill documental segue pendente.

## Objetivo
Reestruturar `index.tsx`, `documentos.tsx`, `universidade.tsx` e `propostas/[id].tsx` do cliente. Mostrar somente o status atual da proposta e permitir reutilizar documentos do mesmo titular, solicitando novo envio quando houver pedido de atualização da equipe.

## Documentos e skill consultados
- Instruções AGENTS.md fornecidas na conversa.
- `skills/UX_skills.md`: hierarquia, contraste, estados de interação e consistência entre telas; adaptar recomendações web aos controles nativos.
- `mobile/README.md`, `docs/README.md`.
- `docs/blueprint/04-database-schema.md` e `06-modules-features.md` (documentos e portal cliente).
- Capturas enviadas mostram o estado atual a corrigir, não um novo layout a reproduzir.

## Código inspecionado e achados
- Quatro telas alvo e layout autenticado do cliente; `mobile/lib/documentos.ts`, `mobile/lib/propostaStatus.ts`; migration do checklist de documentos.
- Home seleciona a proposta mais recentemente atualizada, mesmo cancelada. O contador documental agrega documentos de diferentes propostas e não filtra canceladas.
- Timeline presume conclusão pela posição numa lista fixa de etapas. Retirar essa inferência da apresentação ao cliente.
- Documentos escolhe sempre a proposta mais recente, gera placeholders durante leitura e oferece exclusão de arquivos. Detalhe tem outro caminho de upload, sempre como `outros`.
- Documentos existentes são vinculados à proposta, com campos opcionais de proponente e imóvel. A leitura atual não demonstra um acervo único por cliente.
- Universidade já usa catálogo e assinatura reais, mas tem textos e preços fixos e os cursos abrem um alerta. Não apresentar esse alerta como reprodução de aula implementada.
- Home contém um WhatsApp de exemplo; usar contato oficial configurado e estado indisponível quando faltar configuração.
- Diagnóstico baseado no checkout e nas capturas. Schema remoto ainda não foi conferido nesta tarefa.

## Direção visual proposta para aprovação
- Reaproveitar a identidade do onboarding: grafite/preto, logo oficial, branco de alto contraste e vermelho Mercúrio nas ações. Cards com superfícies discretas, margens alinhadas, tipografia nativa consistente e botões sem efeito líquido.
- Cabeçalho compacto, conteúdo legível e ações prioritárias próximas ao contexto. Evitar imagem de fundo prejudicando contraste e grandes marcas sobre conteúdo.
- Componentes comuns de cabeçalho, card, status, ação e estados de carregamento/erro/vazio nas quatro telas. Alvos de toque mínimos de 44 pontos, safe areas e texto ampliado.
- Animações apenas sutis nas transições, respeitando movimento reduzido; nenhuma dependência nova.

## Estrutura por tela
### Início
1. Logo e saudação usando nome real; fallback neutro se indisponível.
2. Proposta em destaque: protocolo, produto, valor solicitado e único status atual; acesso aos detalhes. Priorizar operação ativa mais recente, com demais propostas acessíveis. Se só houver encerradas, apresentá-las claramente como encerradas.
3. “Precisamos de você” somente para solicitações reais acionáveis; não cobrar documentos de proposta cancelada por placeholders genéricos.
4. Atalhos para Meus documentos e Atendimento; card de Universidade e outras propostas abaixo.
5. Remover timeline e lista de etapas futuras. Erro de consulta não equivale a nenhuma proposta.

### Documentos
- “Meus documentos”: acervo persistente separado de “Solicitações da equipe”.
- Documento já recebido aparece como recebido/em análise/aprovado; não volta a solicitar upload apenas por haver outra proposta.
- Primeiro envio permitido quando faltar o documento aplicável ao titular. Reenvio substitutivo exige solicitação identificada; mostrar motivo, prazo quando informado e contexto da proposta.
- Preservar versões anteriores e acesso autenticado ao arquivo; remover exclusão destrutiva de documentos já usados.
- Documentos de imóvel/contrato continuam ligados ao imóvel/operação correspondentes; não reutilizar arquivo de outro imóvel ou outra pessoa.

### Proposta
- Cabeçalho com protocolo e status atual, resumo financeiro com R$ e datas pt-BR, dados PF/PJ coerentes com o cadastro e seções de documentos, solicitações e contrato.
- Remover lista de mudanças de status da interface cliente, preservando histórico no banco.
- Unificar acesso aos documentos com a biblioteca/solicitações; manter a proposta selecionada ao navegar.
- Preservar condições reais de acesso ao contrato, sem inferir aprovação de um status desconhecido.

### Universidade
- Mesma identidade e navegação; catálogo com capas, categoria, duração, aulas e progresso reais.
- Estados de assinatura, carregamento, vazio e erro claramente distintos.
- Reutilizar caminhos existentes de acesso às aulas quando autorizados ao cliente; não inventar métricas, benefícios ou preços. Player novo e mudanças de cobrança não fazem parte deste plano.

## Modelo de dados proposto para aprovação
Antes de implementar SQL, conferir definições locais/ambiente vinculado em leitura, RLS, triggers e fluxos de upload Admin/Partner.

- Existentes: `clientes` identifica o titular; `propostas.cliente_id` e `proponentes.cliente_id` estabelecem participação; `proposta_documentos` mantém uso e revisão por operação; `proposta_pendencias` registra pedidos da equipe.
- `cliente_documentos` (proposta de tabela): `id`, `cliente_id`, `categoria`, `tipo`, `created_at`. Representa um documento lógico do titular; documentos com múltiplas partes não devem ser limitados a um único arquivo por tipo.
- `cliente_documento_versoes` (proposta): `id`, `documento_id`, `versao`, `bucket`, `storage_path`, nome, MIME, tamanho, autor e data do envio, referência opcional à versão anterior e à solicitação atendida. Referência de objeto de Storage única; gravação idempotente para evitar duplicação por repetição de requisição.
- Vínculo nullable de `proposta_documentos` para a versão reutilizada. Várias operações podem referenciar o mesmo arquivo, sem copiar bytes. A aprovação de uma operação não aprova automaticamente outra.
- Solicitações documentais usam `proposta_pendencias`, com vínculo ao titular/documento quando necessário. Autorização de reenvio validada no servidor. O envio fica em análise e não encerra automaticamente a pendência sem a revisão prevista.
- Legado: criar inventário/dry-run de arquivos, proprietários, vínculos e ambiguidades. Associar automaticamente apenas titular inequívoco. Arquivos de coproponentes, PJ, imóveis ou titular incerto não serão atribuídos ao cliente principal por suposição.
- Cancelar uma proposta não apaga o acervo do cliente. Não mover/apagar objetos legados nesta etapa; preservar caminhos e auditoria.

## Segurança e compatibilidade
- Storage privado e URLs temporárias. Conferir autorização do cliente/titular e da operação em cada leitura/escrita; não confiar em IDs enviados pelo app.
- Reutilização, versão e reenvio controlados por RPC/endpoint autenticado, com RLS e validação de vínculo. Nenhum token privado no aplicativo.
- Garantir compatibilidade com Admin/Partner: leitura e revisão das versões usadas na proposta, sem quebrar uploads existentes; mudanças mínimas nesses fluxos apenas para integração documental.
- Cache segregado por usuário; atualizar acervo, pendências e contadores após envio e troca de sessão. Verificar que um cliente não recebe dados de outro.
- Sem migração remota, backfill ou distribuição mobile até revisão dos artefatos, dry-run e autorização própria.

## Arquivos esperados
- Quatro telas em `mobile/app/(cliente)/`, e `_layout.tsx` apenas se necessário à apresentação compartilhada.
- Componentes comuns em `mobile/components/cliente/`; hooks/helpers documentais em `mobile/lib/`.
- Migration aditiva e testes SQL em `supabase/migrations/` e `supabase/smoke-tests/`; RPC/Edge se necessário ao fluxo de upload seguro.
- Ajustes mínimos nos consumidores Admin/Partner dos documentos se a compatibilidade exigir, documentados antes da alteração.
- Documentação de modelo, portal do cliente e README mobile.

## Critérios de aceite e testes
- Somente status atual na home e detalhe, inclusive cancelada, desconhecida e concluída; dados financeiros não sugerem liberação por simples solicitação.
- PF/PJ, múltiplas propostas e coproponentes sem mistura de documentos. Uma nova operação não exige reenviar documento disponível do mesmo titular; atualização solicitada gera nova versão sem destruir a anterior.
- Canceladas não geram alerta automático de documentos; falha de rede não produz falsa ausência nem falso checklist completo.
- Reenvio concorrente/repetido idempotente; acesso cruzado negado; upload inválido/rejeitado e falha entre Storage e banco tratados.
- Typecheck mobile; lint aplicável (não há script mobile atual); bundles iOS/Android; diff incluindo arquivos novos; testes focados das regras e SQL local de permissões e reuso.
- Validação visual nativa das quatro telas: iPhone estreito/largo, texto ampliado, VoiceOver, contraste, safe area, estado vazio, erro, loading, atualização e navegação. Registrar o que efetivamente foi testado.
- Dry-run de migração/vínculo legado e rollback aditivo documentado, preservando todos os arquivos e versões criados.

## Execução local (2026-11-09)
- Implementadas as quatro telas mobile, componentes compartilhados e hooks/helpers de proposta, catálogo, pendências e acervo.
- Criada a migration `20261108000003_cliente_acervo_documental.sql`; aplicada com sucesso em banco de teste descartável reconstruído do schema local. Nenhum dado pessoal foi usado.
- A leitura do bucket valida titular, participantes autorizados da proposta ou Admin. No teste de policy, outro cliente recebeu zero linhas; titular, parceiro vinculado e Admin leram o arquivo. O teste também confirmou que coproponente acessa apenas a proposta à qual está vinculado. Todas as linhas sintéticas foram revertidas.
- Preservado o upload legado no bucket `proposta-docs` para não quebrar versões já instaladas; o app atualizado usa as RPCs do acervo. Arquivos antigos só são indexados quando a titularidade pode ser provada sem ambiguidade.
- Smoke test `supabase/smoke-tests/fase-58-cliente-acervo-documental.sql`: aprovado. `npm run typecheck` em `mobile/`: aprovado. `npx expo export --platform ios` e `--platform android`: aprovados.
- Não há script de lint no pacote `mobile`. A validação visual foi aprovada pelo usuário; VoiceOver, texto ampliado e inspeção em aparelho físico/simulador não foram verificados de forma independente nesta execução.
- Ao encerrar esta execução local, ainda não havia aplicação remota, deploy, publicação de app ou backfill; a aplicação remota está registrada na seção seguinte.

## Publicação das migrations (2026-11-09)
- Dry-run remoto listou somente `20261108000001_mobile_relock_config.sql`, `20261108000002_mobile_onboarding_respostas.sql` e `20261108000003_cliente_acervo_documental.sql`. As lacunas históricas anteriores não foram incluídas (`--include-all` não foi usado).
- As três migrations foram aplicadas com `supabase db push --linked --yes`; a execução terminou sem erro. `supabase migration list --linked` confirmou as três versões no histórico remoto.
- Após a publicação: `npm run typecheck`, `npx expo export --platform ios` e `npx expo export --platform android` passaram.
- O smoke SQL da fase 58 não foi repetido no banco local corrente: o dry-run local mostrou 23 migrations históricas anteriores fora de ordem. Não forcei a aplicação desse conjunto; o smoke já havia passado no banco descartável reconstruído do schema local, e os testes de acesso/reuso foram executados com dados sintéticos e revertidos.
- Nenhum `admin_cliente_acervo_dry_run()` ou backfill foi executado. Nenhum build nativo foi distribuído. Próximos passos separados: validar os fluxos autenticados no app contra o schema publicado; revisar o relatório do dry-run de legado antes de qualquer indexação; preparar e aprovar a distribuição do app mobile.
