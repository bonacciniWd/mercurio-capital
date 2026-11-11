# Plano — Upload múltiplo e drag-and-drop de documentos da proposta

Status: aprovado pelo proprietário em 2026-11-06 e implementado localmente. O tipo documental é definido por arquivo na fila. Nenhuma migration, publicação ou deploy foi feita.

## Objetivo

Permitir que `partner` e `admin` enviem mais de um documento por operação na aba Documentos do detalhe de proposta, usando seleção múltipla ou arrastar e soltar. Preservar o seletor de tipo, a lista e validação de documentos, OCR e permissões existentes. A referência visual é a área “Enviar novo documento” mostrada na captura fornecida pelo proprietário.

## Skills e documentação consultadas

- `.github/agents/ux-ui-mercurio-capital.agent.md` e procedimento obrigatório de aprovação antes de alterar UI.
- `docs/operacao/change-management.md`.
- `docs/blueprint/03-routes-navigation.md`: detalhes de proposta para `partner`, `team_member` e `admin`.
- `docs/blueprint/08-security-compliance.md`: RBAC, acesso a documentos e storage privado.
- `docs/handoffs/17-handoff-wizard-proposta.md` e `docs/12-finalizacao.md`.
- Referência visual fornecida pelo proprietário nesta solicitação.

## Código e segurança inspecionados

- `app/src/components/PropostaDocsUploader.tsx`: antes da implementação lia apenas `files[0]` e recebia mutation de um arquivo; agora oferece modo opt-in em lote, fila com tipo por arquivo, validação individual e upload sequencial. Preserva limite de 20 MB, bucket `proposta-docs`, um registro em `proposta_documentos` por arquivo e OCR best-effort.
- `app/src/pages/partner/PropostaDetalhe.tsx`: usa o componente na aba Documentos com `origem="parceiro"`.
- `app/src/pages/admin/PropostaDetalhe.tsx`: usa o mesmo componente e revalida o painel de validação rápida por `onChange`.
- `app/src/pages/client/PropostaDetalhe.tsx` e `app/src/pages/client/Documentos.tsx`: também usam o componente compartilhado; não fazem parte do escopo solicitado e devem manter o comportamento atual.
- `supabase/migrations/20260518000001_storage_proposta_docs.sql`: policies existentes restringem o bucket privado por admin ou acesso ao caminho da proposta; não propor bypass pelo cliente.
- `app/src/test/PropostaDocsUploader.test.tsx`: suite criada para seleção múltipla, drag-and-drop, classificação individual, validação, falha parcial/retry e comportamento unitário padrão.

## Diagnóstico e decisões propostas

1. A limitação está no componente compartilhado, não nas páginas partner/admin: só o primeiro arquivo do input é processado e a mutation aceita um arquivo por chamada.
2. Adicionar suporte por opt-in ao uploader: habilitar lote/drag-and-drop apenas nas duas chamadas de detalhe solicitadas. O default permanece desabilitado para não alterar silenciosamente as telas do cliente.
3. O seletor superior define o tipo padrão para arquivos adicionados depois; cada item da fila tem seu próprio seletor editável. Arquivos de tipos diferentes podem ser enviados no mesmo lote sem classificação automática incorreta.
4. Cada arquivo mantém sua própria validação, registro e resultado. Uploads rodam sequencialmente para limitar pressão no Storage e preservar o fluxo de rollback existente quando a inserção de metadados falha.
5. Uma falha em um arquivo não desfaz uploads já confirmados nem impede o restante do lote. Apresentar sucesso/falha por arquivo e permitir tentar novamente os itens que falharam.
6. Preservar formatos atualmente aceitos (`pdf`, `png`, `jpg`, `jpeg`, `webp`, `heic`, `heif`), máximo atual de 20 MB por arquivo, OCR, origem, bucket, nomes/caminhos, status e invalidation de queries.
7. O dropzone é um atalho; botão nativo de seleção continua disponível e utilizável por teclado. Não criar fluxo que dependa exclusivamente de drag-and-drop.
8. Sem alteração em permissões, relações, RLS, RPCs, Edge Functions, dados existentes ou experiência mobile.

## Interação e estados

- O seletor superior é identificado como “Tipo padrão para novos arquivos”. Cada arquivo selecionado ou arrastado recebe esse tipo inicialmente, mas mostra um seletor próprio na fila para revisão/correção antes do envio.
- A fila mostra nome, tamanho, tipo, estado individual (aguardando, enviando, enviado ou falhou) e erro de validação/upload. Arquivos incompatíveis ou acima do limite são identificados por item antes do upload.
- O lote começa pelo mesmo comando explícito de envio, evitando upload acidental durante a seleção; permitir remover um arquivo da fila antes de iniciar.
- Durante o envio, bloquear novo lote ou enfileirá-lo claramente; não perder a fila em navegação acidental sem aviso.
- Após cada sucesso, atualizar a lista “Documentos enviados” e chamar `onChange` para manter o painel Admin sincronizado.
- Se parte do lote falhar, preservar os sucessos e oferecer retry somente aos itens com falha. Não exibir sucesso global quando houve falhas.
- Estado vazio, hover/focus do dropzone, arquivos arrastados, envio, sucesso completo, sucesso parcial e erro devem ter feedback visual/semântico.

## Arquivos esperados

- `app/src/components/PropostaDocsUploader.tsx`: suporte opt-in a múltiplos arquivos, drag-and-drop, fila, validação por item e upload sequencial com resultado parcial.
- `app/src/pages/partner/PropostaDetalhe.tsx` e `app/src/pages/admin/PropostaDetalhe.tsx`: habilitar o novo comportamento somente nessas duas telas.
- `app/src/test/PropostaDocsUploader.test.tsx`: cobertura do fluxo compartilhado sem alterar o comportamento padrão do portal cliente.
- Atualizar este plano com implementação e evidências depois da aprovação.

Não se espera alteração em `mobile/`, `supabase/migrations/`, `supabase/functions/`, `app/src/router.tsx` ou contratos de dados.

## Segurança e privacidade

- Manter o bucket `proposta-docs` privado e as policies atuais; não adicionar permissões por conveniência.
- Continuar validando tipo/extensão e tamanho no cliente para feedback e deixar o servidor/storage como autoridade final.
- Preservar a inserção de um registro por documento e rollback do objeto se a inserção correspondente falhar.
- Não registrar conteúdo de documentos, PII ou URLs assinadas em logs.
- Não alterar as regras de remoção, validação ou OCR existentes.

## Critérios de aceite e testes

1. Nas abas Documentos do detalhe partner e Admin, o seletor aceita vários arquivos e o dropzone recebe vários arquivos.
2. Cada arquivo pode ter tipo diferente dentro do mesmo lote; o registro individual em `proposta_documentos` e a categoria/path do Storage correspondem ao seletor daquele arquivo.
3. Um arquivo inválido ou acima de 20 MB é identificado individualmente, sem bloquear uploads válidos do mesmo lote.
4. Uma falha de upload/inserção não apaga documentos já enviados com sucesso; itens falhos podem ser reenviados sem duplicar os sucessos.
5. OCR best-effort segue funcionando para cada imagem e falha de OCR não altera o status do upload.
6. Lista e painel Admin atualizam após cada sucesso; origem continua igual à chamada existente.
7. As telas cliente mantêm o fluxo atual de arquivo único até aprovação explícita de expansão de escopo.
8. Fluxo completo pode ser operado por teclado e botão de seleção; drag-and-drop oferece feedback sem substituir o caminho acessível.
9. Testes automatizados cobrem múltipla seleção, drop, tipo individual por arquivo, validação, sucesso parcial, retry e regressão do default cliente.
10. Rodar testes direcionados, `npm run typecheck`, lint focal e `npm run build` no pacote `app`; inspecionar desktop/mobile em captura antes de concluir.

## Rollout e rollback

1. Obter aprovação deste plano antes do código.
2. Implementar localmente sem alterar a migration ou publicar dados.
3. Validar com fixtures/arquivos sintéticos e revisar o diff para confirmar que o comportamento só foi habilitado em partner/Admin.
4. Em regressão, retirar as props opt-in das duas chamadas ou reverter o componente aos uploads unitários; não é necessário rollback de banco.
5. Deploy ou release requer autorização separada conforme `docs/operacao/change-management.md`.

## Implementação e validação

O proprietário aprovou o upload em lote com drag-and-drop em 2026-11-06. Após esclarecimento, cada arquivo do lote passou a ter seu próprio tipo; o seletor superior é somente o padrão para arquivos adicionados depois. A funcionalidade está ativada por opt-in nas telas partner/Admin. Portal cliente preserva o upload unitário.

Verificações locais: suíte `PropostaDocsUploader.test.tsx` (6 testes), `npm run typecheck`, ESLint focal e `npm run build` passaram. O build mantém o aviso já existente de chunks acima de 500 kB. Nenhuma migration, mudança de RLS, `db push`, deploy, commit ou publicação foi feita.
