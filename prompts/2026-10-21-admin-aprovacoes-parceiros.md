# Plano — Aprovações de parceiros no Admin

## Objetivo

Reestruturar `/admin/aprovacoes` conforme a referência visual compartilhada: busca e filtros no topo, lista de solicitações à esquerda e painel de análise do parceiro à direita. Incluir a visualização dos documentos em modal dentro do Admin, em vez de abrir uma nova aba.

## Skills e documentos lidos

- `docs/README.md`
- `docs/operacao/change-management.md`
- `docs/operacao/security-checklist.md`
- `docs/operacao/release-checklist.md`
- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- Nenhuma skill adicional é necessária para esta alteração de UI e fluxo de visualização já existente.

## Código e configuração inspecionados

- `app/src/pages/admin/Aprovacoes.tsx`: consulta da fila, filtros, seleção, ações, convite e abertura dos documentos.
- `app/src/layouts/AdminLayout.tsx` e `app/src/router.tsx`: shell administrativo compartilhado e rota `admin/aprovacoes`.
- `supabase/migrations/20260803000001_lote_a_aprovacoes_parceiros.sql` e `20260519000001_aprovacoes_view_enriched.sql`: view usada pela fila e campos apresentados.
- `supabase/migrations/20260513000002_identidade.sql`: tabela existente `partner_documentos` e RLS.
- `supabase/migrations/20260514000001_storage_partner_docs.sql`: bucket privado `partner_docs`, políticas e formatos permitidos.
- `supabase/migrations/20260514000002_admin_partner_approval.sql`: RPCs existentes de aprovar e recusar.
- `app/package.json`: scripts de lint, typecheck, testes e build.
- O worktree já contém alterações locais em `Aprovacoes.tsx`, `AdminLayout.tsx`, `index.css` e testes; a implementação deverá preservá-las.

## Decisões e suposições

- A referência governa a apresentação da página: lista e painel de revisão lado a lado em desktop, layout empilhado em telas estreitas, estados ativos e modal de documento.
- Manter o `AdminLayout` atual e seu menu lateral/header compartilhado; a referência será aplicada ao conteúdo da rota, sem duplicar a identidade/topbar do exemplo.
- Os nomes, e-mails, status, datas, telefones, origem e contagem vêm da view `v_admin_partner_aprovacoes`; os documentos vêm de `partner_documentos`. Não copiar dados fictícios do exemplo.
- Preservar busca, filtros de todos os status atuais (incluindo suspenso), deep link `partner_id`, reenvio de convite, motivo de recusa e RPCs atuais de aprovação/recusa.
- O modal exibirá o arquivo real autorizado: PDF incorporado e imagens permitidas como imagem. Criar URL assinada somente ao abrir o arquivo, com TTL atual de 5 minutos, e oferecer download seguro. Fechar/limpar o documento ao fechar modal ou trocar seleção.
- O painel do documento não afirmará que o acesso foi auditado, nem exibirá identidade fictícia; manterá aviso de acesso restrito pela sessão administrativa.
- Nenhum esquema, view, policy, RPC, bucket ou dado será alterado. O acesso continua sujeito à sessão e às políticas existentes do Supabase Storage.
- A tarefa é local; não inclui deploy ou mutação de dados reais.

## Modelo de dados e regras de negócio

Sem modelo novo. A tela mantém as leituras existentes de `v_admin_partner_aprovacoes` e `partner_documentos`. Aprovação e recusa continuam chamando `admin_approve_partner` e `admin_reject_partner`, que são as autoridades server-side. O bucket `partner_docs` permanece privado e suas URLs de leitura expiram em 5 minutos.

## Impacto

- Web (`app/`): UI da rota de aprovações e estilos locais; teste de componente.
- Mobile: não afetado.
- Banco, migrations e RLS: não afetados.
- Edge Functions e integrações: não afetadas.
- Electron/updater: não afetado.
- Segurança e operação: preservar sessão administrativa, RLS, bucket privado, URLs assinadas de curta duração e RPCs existentes.
- Documentação/deploy: somente este plano; sem publicação.

## Arquivos esperados

- `app/src/pages/admin/Aprovacoes.tsx`
- `app/src/pages/admin/Aprovacoes.css` (novo, escopado à rota)
- `app/src/test/adminAprovacoes.test.tsx` (novo, com Supabase e Storage mockados)

## Requisitos e critérios de aceite

- A tela usa lista e painel de revisão no padrão visual da referência, com nomes e estados reais fornecidos pelas queries existentes.
- Pesquisa, filtros, deep link e estados loading/erro/vazio continuam funcionais.
- As ações de aprovar/recusar/reenvio mantêm confirmação, erros, loading e invalidação das queries existentes.
- Clicar num documento abre modal dentro do Admin. PDFs e imagens compatíveis podem ser visualizados; arquivo incompatível/indisponível apresenta alternativa de download/erro clara.
- O modal fecha por botão, clique fora e Escape; o URL assinado só é solicitado após ação explícita e é descartado ao fechar.
- A interface é responsiva, acessível por teclado e mantém a sidebar/topbar existentes.
- Nenhum fixture, CPF, e-mail ou dado pessoal ilustrativo do exemplo é inserido em produção.

## Considerações de segurança

- Não tornar o bucket público nem armazenar URLs assinadas em banco/local storage.
- Criar URLs por meio do cliente autenticado somente após clique explícito; conservar TTL de 300 segundos.
- Renderizar somente PDF e imagens permitidos pelo bucket. Para outros formatos, oferecer download da URL assinada sem tentar executar conteúdo ativo.
- Nunca usar `dangerouslySetInnerHTML` nem incluir PII fictícia na interface.
- Não testar aprovação/recusa sobre parceiros reais; cobrir mutações com mocks.

## Testes

- Automáticos: teste do componente para carregamento, seleção/busca/filtro, abertura/fechamento do viewer e uso de URL assinada; lint, typecheck e build em `app/`.
- Manual no navegador, sessão administrativa autorizada: desktop e mobile; filtro vazio e busca sem resultados; PDF e imagem; erro ao gerar URL; fechar com Escape; revisar sem aprovar/recusar cadastros reais.
- Verificar que a rota usa a sessão e dados reais existentes, sem submits durante o smoke visual.

## Rollout e rollback

- Implementar localmente após aprovação; não publicar neste escopo.
- Rollback restrito ao diff novo em `Aprovacoes.tsx`, `Aprovacoes.css` e teste, preservando alterações locais preexistentes nos arquivos compartilhados.
