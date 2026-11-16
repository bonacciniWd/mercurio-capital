# Aditivo de segurança — issues #35, #36 e #37

**Data:** 2026-11-16
**Plano-base aprovado:** `prompts/2026-11-12-funil-prospeccao-parceiros.md`
**Status:** implementado, validado e publicado em produção em 2026-11-16 após GO separado.

## Objetivo

Concluir a entrega dos issues #35–#37 do funil de prospecção e garantir que o nível `admin_nivel='comercial'` tenha acesso realmente somente leitura à Universidade, conforme a regra de autorização server-side do projeto.

## Contexto e documentos lidos

- `AGENTS.md`, incluindo segurança/RLS, modelo de dados, workflow e verificações.
- Plano aprovado `prompts/2026-11-12-funil-prospeccao-parceiros.md`, em especial WS-B, AC6 e backlog #9 e #10–#12.
- Migration de origem `supabase/migrations/20260518000040_universidade_fase8.sql`.
- Runbook `docs/operacao/runbooks.md` e smoke tests do nível admin e da prospecção.
- Revisão read-only do agente Revisor Mercurio Capital, que encontrou um bloqueio High: as políticas LMS ainda autorizam escrita com `app_is_admin()`.

## Código inspecionado

- `supabase/migrations/20260518000040_universidade_fase8.sql`: policies de cursos, módulos, aulas e buckets LMS; RPC `admin_curso_publicar`.
- `supabase/functions/vimeo-upload-init/index.ts`: inicia criação de vídeo no Vimeo após validar apenas `app_is_admin()`.
- `app/src/pages/admin/Universidade.tsx` e `app/src/pages/admin/Carteiras.tsx`: controles de escrita por nível.
- `supabase/functions/admin-invite-internal/index.ts` e `app/src/components/admin/EquipeInterna.tsx`: convite de admin comercial.
- `app/src/test/adminCommercialAccess.test.tsx` e `app/src/test/prospeccaoKanban.test.tsx`.

## Decisão proposta e modelo de autorização

Sem novas entidades ou colunas. O JWT existente continua sendo a fonte de nível: `role='admin'` com `admin_nivel='full'` ou `'comercial'`.

- `comercial` e demais admins autorizados mantêm leitura LMS conforme as policies atuais.
- Somente `app_is_admin_full()` pode inserir, atualizar ou excluir cursos, módulos e aulas; publicar curso; gravar nos buckets `lms-capas` e `lms-recursos`; e iniciar criação de vídeo via `vimeo-upload-init`.
- O nível full mantém os fluxos existentes; demais leituras/inscrições de usuário não mudam.
- As proteções serão aplicadas no banco/Edge. Os controles visuais são apenas UX.

## Mudanças esperadas após aprovação

- Nova migration forward-safe que substitui policies de escrita LMS por policies full-only e recria `admin_curso_publicar` com guard full-only.
- `vimeo-upload-init` exige `app_is_admin_full()` antes de chamar o Vimeo.
- Novo smoke SQL cobrindo leitura comercial, negação de escrita/publicação/Storage para comercial e permissão full, sem deixar dados persistidos.
- Eventuais testes Edge direcionados para o convite (`p_nivel` inválido, default limitado e guard full preservado), caso harness local permita.
- Corrigir a localização da nota de métricas no runbook, sob a seção de prospecção.

## Critérios de aceite

1. Edge `admin-invite-internal` aceita apenas `limitado` ou `comercial`, usa `limitado` por padrão e mantém admin full como requisito.
2. Carteiras e Universidade ocultam ações de escrita para comercial.
3. Chamadas diretas ao PostgREST/RPC/Storage e Edge de upload não permitem gravação LMS para comercial.
4. Admin full preserva criação, edição, publicação e upload.
5. Detalhe do card apresenta notas, responsável e próxima ação; contagem por coluna reflete os filtros e não é confundida com os agregados legados.
6. Documentação do runbook aponta para a seção correta do funil.
7. Testes direcionados, lint, typecheck, testes completos e build executados; revisão read-only sem findings High/Critical.

## Segurança e rollout

- Migration aditiva; não reescrever migration publicada.
- Smoke test transacional, rollback automático do próprio teste e sem alteração de dados de produção.
- Esta aprovação cobre somente implementação e validação local. Aplicar migration/deploy em Supabase, publicar Edge/frontend e fechar issues externamente exigem GO separado, conforme `AGENTS.md`.
- Rollback do hardening exigiria nova migration forward-fix; não remover as policies atuais por rollback destrutivo.

## Testes

- `cd app && npm run lint && npm run typecheck && npm run test && npm run build`.
- Rodar testes direcionados de `adminCommercialAccess` e `prospeccaoKanban`.
- Executar smoke SQL local no banco de desenvolvimento se disponível; sem produção nesta etapa.
- Revisão read-only final dos arquivos tocados.
- Teste manual autenticado: comercial lê conteúdo LMS sem controles de escrita; full mantém ações; cartões do funil mostram detalhe e contagens corretos.

## Execução desta entrega

- `npm run test -- --run src/test/adminCommercialAccess.test.tsx src/test/prospeccaoKanban.test.tsx`: passou, 2 arquivos / 16 testes.
- `npm run lint`: passou, 0 erros / 34 avisos existentes.
- `npm run typecheck`: passou.
- `npm run build`: passou; Vite reportou aviso já existente de chunks maiores que 500 kB.
- `npm run test -- --maxWorkers=2 --testTimeout=15000`: 310 passaram e 14 falharam em `adminLeadsSimulacoes.test.tsx` (fixture `Marina Exemplo` ausente), fora dos arquivos desta entrega.
- `supabase migration up --local`: aplicou `20261116000002_universidade_admin_full_only.sql` ao banco local.
- `supabase/smoke-tests/fase-63-universidade-admin-full-only.sql`: passou em Docker/local com transação revertida; full autorizado e comercial só leitura, incluindo Storage.
- Edge Function servida no runtime local para compilação; não foi feita chamada externa ao Vimeo.
- `supabase db lint --local --schema public,storage --level error`: sem erro nas alterações da FASE 63; encontrou issues existentes em `admin_campanha_disparar`, `admin_config_leads_classificador_atualizar` e funções Storage do ambiente.
- `git diff --check`: passou.

Na validação local, não houve acesso à produção, deploy, publicação de Edge, fechamento remoto de issue nem alteração persistente pelo smoke.

## Ativação em produção — GO separado de 2026-11-16

- Commit `7d3ab4a` enviado para `main`, contendo apenas os arquivos de #35–#37 e a correção de data do fixture de testes. Alterações paralelas do working tree ficaram fora do commit.
- Workflow CI do GitHub estava desativado; o workflow Desktop Release está ativo somente para tags. Nenhum GitHub Action foi iniciado.
- Migration `20261116000002_universidade_admin_full_only.sql` aplicada no projeto `bhagksfvszeogtjvjtpx`; `supabase migration list --linked` confirma `20261116000001` e `20261116000002` sincronizadas.
- Smoke remoto `fase-63-universidade-admin-full-only.sql`: `FASE 63 SMOKE: OK` (transação revertida).
- Edges publicadas: `admin-invite-internal` v20 e `vimeo-upload-init` v46. POST sem autenticação recebeu HTTP 401 nas duas.
- Vercel produção Ready: deployment `dpl_JVXwiqDWHWoEUzhEZo3QcUNwMtv7`, alias `https://mercuriocapitalsa.com.br`. Rotas `/`, `/admin/carteiras` e `/admin/universidade` responderam HTTP 200; bundles Carteiras, Universidade e Configurações retornaram HTTP 200 e contêm os novos textos de somente leitura/nível comercial.
- Pós-publicação autenticado como admin comercial e admin full ainda precisa ser validado pelo usuário no navegador. Não foram criados convites, vídeos ou dados persistentes.
- Nenhuma nova tag ou release desktop foi criada. A versão local validada por `npm run validate:release` segue `0.3.0`; a release desktop v0.3.1 existente ainda precisa ser reconciliada com `main` numa frente própria.
