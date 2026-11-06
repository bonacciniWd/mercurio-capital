# Plano - Aba Documentos dos detalhes de proposta (Admin e Partner)

Status: implementado localmente; verificações automatizadas concluídas.

## Objetivo

Atualizar a apresentação da aba Documentos nos detalhes de proposta de Admin e Partner para corresponder à referência fornecida: superfícies claras, dropzone amplo com borda tracejada, controles de envio agrupados e ilustração SVG animada de upload. Preservar o comportamento e os limites atuais de cada perfil.

## Referências e documentação consultadas

- TSX e CSS de referência anexados pelo proprietário, incluindo o SVG de upload e animações `upload-file-float`, `upload-arrow-rise`, `upload-shadow-pulse` e `upload-dot-drift`.
- `skills/UX_skills.md`: semântica nativa, foco visível, suporte completo a teclado, redução de movimento, responsividade e uso do sistema de estilos existente.
- `.github/agents/ux-ui-mercurio-capital.agent.md` e instruções `AGENTS.md` fornecidas pelo proprietário nesta conversa.
- `docs/README.md`, `docs/blueprint/03-routes-navigation.md`, `docs/blueprint/08-security-compliance.md` e `docs/handoffs/17-handoff-wizard-proposta.md`.
- `prompts/2026-11-06-upload-multiplos-documentos-proposta.md`, que registra o fluxo de lote aprovado e as permissões atuais.

## Código e comportamento inspecionados

- `app/src/components/PropostaDocsUploader.tsx`: upload unitário/lote, drag-and-drop, fila por arquivo, tipo documental, validação de extensão e limite de 20 MB, Storage privado, registro individual, OCR best-effort, retry e listagem.
- `app/src/pages/partner/PropostaDetalhe.tsx`: renderiza o uploader com lote na aba Documentos e navegação/telas do Partner.
- `app/src/pages/admin/PropostaDetalhe.tsx`: exibe checklist e validação reais com controles operacionais de documento e o mesmo uploader compartilhado.
- `app/src/pages/admin/proposta-detalhe.css`: sistema visual compartilhado entre as telas Admin e Partner.
- `app/src/test/PropostaDocsUploader.test.tsx`, `app/src/test/adminPropostaDetalhe.test.tsx` e `app/src/test/partnerPropostaDetalhe.test.tsx`.

## Decisões e limites

1. Aplicar o visual da referência à aba Documentos de Admin e Partner, sem redesenhar as demais abas do detalhe.
2. Reutilizar `PropostaDocsUploader` e o CSS escopado do detalhe. A alteração visual de lote será opt-in por `enableBatchUpload`; o portal de cliente mantém sua apresentação e fluxo unitário atuais.
3. Adaptar o SVG e as animações fornecidas, respeitando `prefers-reduced-motion`; o SVG é decorativo e não substitui o nome acessível do controle.
4. Manter seleção por teclado, seletor de arquivo nativo, drag-and-drop como atalho, rótulos associados e foco visível. Novos botões seguem `btn-no-liquid`.
5. A referência contém checklist de exemplo. Não copiar seus documentos hardcoded nem introduzir dados fictícios. Admin conserva o checklist e as ações reais de validação existentes; Partner conserva somente os dados e ações que já pode acessar. Ambos recebem a mesma linguagem visual dentro dos respectivos limites de role/RLS.
6. Preservar seleção múltipla, classificação independente por arquivo, estados de fila, sucesso parcial/retry, upload sequencial, OCR, remoção, mensagens de erro, callbacks e invalidação de consultas.
7. Não alterar tabelas, Storage, RLS, RPCs, Edge Functions, rotas, modelo de dados nem dependências. Nenhum deploy faz parte deste plano.

## Arquivos esperados

- `app/src/components/PropostaDocsUploader.tsx`: estrutura visual do dropzone, SVG animado e organização dos estados existentes.
- `app/src/pages/admin/proposta-detalhe.css`: estilos responsivos, foco/hover e animação escopados ao uploader de lote no detalhe de proposta.
- `app/src/test/PropostaDocsUploader.test.tsx`: conferir ilustração decorativa, acessibilidade do seletor e controles, estado batch e preservação do fluxo unitário.
- Este plano: registrar implementação e verificações após aprovação.

## Critérios de aceite

1. Desktop reproduz a hierarquia da referência na aba Documentos; em larguras estreitas controles e fila se reorganizam sem overflow horizontal.
2. O dropzone aceita vários arquivos por botão ou arraste e informa visualmente o estado de arraste.
3. SVG animado é exibido e para quando `prefers-reduced-motion: reduce` estiver ativo.
4. O seletor mantém label explícito e o botão continua acionável por teclado; foco é visível e controles usam `btn-no-liquid`.
5. O lote mantém tipo por arquivo, validação, envio sequencial, sucesso parcial e retry; os status dos documentos permanecem derivados do sistema.
6. Checklist, visualização/aprovação Admin, listagem e upload permanecem funcionais e limitados pelas permissões atuais.
7. Portal cliente não recebe o novo layout batch e conserva o fluxo unitário.
8. Testes focados, lint focal, typecheck e build do app passam; revisar visualmente estados vazio, fila, erro/sucesso parcial em viewport desktop e estreita.

## Segurança

- O bucket `proposta-docs` continua privado e as policies atuais permanecem a autoridade para leitura e escrita.
- Nenhum documento, checklist administrativo, ação de aprovação ou dado de outra proposta será exposto ao Partner.
- Nenhum dado do exemplo hardcoded será inserido. Não registrar PII nem conteúdo de arquivos nos logs.

## Testes previstos

- Automatizados: suíte focal de `PropostaDocsUploader`, testes focados dos detalhes Admin e Partner; typecheck, lint focal e build em `app/`.
- Manuais: seleção de lote, drag-and-drop, foco/teclado, estado hover/dragging, fila, falha e retry; larguras desktop/mobile; `prefers-reduced-motion`.
- Sem escrita remota, migration, mudança de Storage/RLS ou deploy.

## Implementação e verificações

- Aplicado o dropzone de referência à variante batch compartilhada por Admin e Partner, com SVG animado decorativo, tipografia/cores da referência, estados de arraste, fila preservada e layout responsivo.
- O portal de cliente permanece com a variante unitária anterior. A orientação agora enumera os formatos realmente aceitos (`PDF`, `JPG`, `PNG`, `WEBP`, `HEIC`, `HEIF`) e o limite atual de 20 MB.
- O seletor de arquivos batch mantém foco visível e `btn-no-liquid`; animações são desativadas para `prefers-reduced-motion: reduce`.
- Testes focados: 3 arquivos, 11 testes passaram (`PropostaDocsUploader`, detalhe Admin e detalhe Partner).
- ESLint focal passou; `npm run typecheck` passou; `npm run build` passou. O build reportou o aviso já existente de chunks acima de 500 kB.
- `git diff --check` identificou trailing whitespace em `mobile/app/_layout.tsx`, arquivo preexistente e fora do escopo; não foi alterado.
- Não foi feita validação manual em navegador nesta execução. Sem alterações de banco/RLS, chamadas remotas ou deploy.
