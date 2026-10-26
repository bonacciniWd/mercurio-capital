# Cadastro da equipe interna e organograma

## Objetivo

Completar a área **Usuários internos** de `/admin/configuracoes` para administrar perfis organizacionais da equipe Mercúrio — foto, cargo, departamento e gestor — e permitir convidar novos usuários internos com conta de acesso. Preparar esses dados para um organograma na Rede, preservando a visualização atual de parceiros e equipes.

## Skills e documentos consultados

- `AGENTS.md` fornecido nesta sessão.
- `docs/README.md`.
- `docs/operacao/change-management.md` e `docs/operacao/release-checklist.md`.
- `docs/operacao/desktop-release-macos-signing.md`.
- `docs/blueprint/02-roles-permissions.md`, `03-routes-navigation.md`, `04-database-schema.md` e `08-security-compliance.md`.
- `docs/handoffs/14-handoff-fase9.md`.
- Skills externas: nenhuma necessária para este mapeamento.

## Código e configuração inspecionados

- `app/src/pages/admin/Configuracoes.tsx` — aba atual já lista `admin` e `team_member`, configura distribuição operacional e ativa/desativa usuário; não possui campos de cargo/gestor nem criação de contas.
- `app/src/pages/admin/Rede.tsx` e `app/src/components/rede/RedeFlow.tsx` — grafo atual representa parceiros/equipes via `admin_rede_graph`; não representa hierarquia de funcionários.
- `app/src/lib/adminScope.ts` — `/admin/configuracoes` é acessível somente a `admin full`; `/admin/rede` é permitido também para admin limitado/jurídico.
- `app/src/auth/authClient.ts` e `app/src/guards/RequireAdminScope.tsx` — papéis de acesso vêm de Auth/`me()` e o nível administrativo não deve ser confundido com cargo corporativo.
- `supabase/migrations/20260513000002_identidade.sql`, `20260520000030_fase13_analytics.sql`, `20260716000002_partner_rede_graph_admin_pending.sql`, `20260718000001_admin_nivel.sql` e `20260722000007_admin_juridico_hardening.sql`.
- Consulta somente leitura ao banco publicado: `usuarios` já tem `avatar_url`, mas não há tabelas/colunas de cargos, departamentos ou hierarquia interna.
- `app/package.json` e checklist de release para mapear canais web/desktop sem autorizar builds ou publicação.

## Modelo de dados proposto

Não criar outra tabela genérica de usuários. `auth.users` continua sendo a identidade de login e `public.usuarios` continua sendo o espelho central. Proponho três tabelas novas:

1. **`departamentos_internos`** — `id`, `nome` único, `descricao` opcional, `ativo`, `created_at`, `updated_at`. Guarda o catálogo organizacional exibido na referência.
2. **`cargos_internos`** — `id`, `nome` único, `descricao` opcional, `ativo`, `created_at`, `updated_at`. Guarda cargos reutilizáveis; cargo e departamento ficam separados para não limitar um cargo a um único departamento.
3. **`usuarios_internos`** — `usuario_id` como PK/FK para `public.usuarios.id`, `departamento_id` FK opcional, `cargo_id` FK opcional, `gestor_usuario_id` FK opcional para outro `usuarios_internos.usuario_id`, `foto_path` opcional, `data_inicio` opcional (campo presente no cartão da referência), `created_at`, `updated_at`.

Relacionamentos: um departamento e um cargo podem ser associados a vários funcionários; cada funcionário tem no máximo um gestor direto e um gestor pode ter vários subordinados. O gestor deve ser outro usuário interno ativo. Não permitir auto-gestão nem ciclos na hierarquia. As contas continuam vinculadas por `usuarios_internos.usuario_id → usuarios.id → auth.users.id`.

Foto: armazenar somente o caminho do objeto em `foto_path` num bucket privado novo `avatares-internos`; não reutilizar `avatar_url`, que é consumido como URL pública em perfis existentes. Exibir por URL assinada curta após autorização.

## Escopo funcional proposto

- Na aba `/admin/configuracoes`, separar cadastro organizacional de distribuição de leads para que os campos existentes de `admin`/`team_member` e suas regras de distribuição não sejam alterados.
- Listar usuários internos (`role=admin`) com nome, e-mail, status, foto, cargo, departamento, gestor e último acesso; permitir convidar novo usuário interno e editar esses dados.
- Manter cargo e nível de acesso como conceitos separados. Convites criam `role=admin` com `admin_nivel=limitado` por padrão; a interface não concede `full`. Promoção para `full` continua no processo administrativo já existente.
- Gerenciar catálogos de departamentos e cargos conforme as abas da referência.
- Na tela `/admin/rede`, adicionar uma visualização separada **Rede Interna/Organograma**, sem substituir nem misturar o grafo de originação existente. Cartões mostram foto, cargo, departamento, gestor/linhas e data de início quando informada.
- A nova visão do organograma será somente leitura para qualquer admin autenticado; configuração de usuários/catálogos e convites permanece exclusiva a admin full, coerente com a rota atual.
- Convite por e-mail ocorrerá somente quando um operador iniciar a ação. Testes automatizados e homologação não enviarão e-mail real; envio a destinatários reais requer autorização separada.

## Decisões e suposições a validar na aprovação

- O pedido de cadastro inclui criar/convidar contas novas e completar perfis já existentes.
- Admin limitado é o nível inicial seguro para novos funcionários; papel/cargo corporativo não altera RBAC.
- A referência inclui Departamentos, Cargos e data de início; por isso os catálogos entram no primeiro escopo e `data_inicio` fica opcional.
- O organograma entra como nova visualização dentro de `/admin/rede`; a atual Rede de Originação permanece intacta.
- O trabalho termina com validação web local e preparação do código/migration/functions. Builds instaláveis/notarizados para Windows, Linux ou macOS, publicação, tags e release permanecem fora deste escopo e terão gate próprio.

## Arquivos esperados

- `app/src/pages/admin/Configuracoes.tsx` — cadastro, catálogos e convite.
- `app/src/pages/admin/Rede.tsx`, novo componente em `app/src/components/rede/` e `app/src/lib/adminScope.ts` se uma permissão de leitura precisar ser explicitada.
- Nova Edge Function segura de convite interno, separada de `admin-invite-partner`.
- Nova migration aditiva em `supabase/migrations/` para as três tabelas, FKs, índices, RLS, bucket privado/policies, RPCs de consulta e mutação/auditoria.
- Tipos e testes em `app/src/` e smoke SQL em `supabase/smoke-tests/`.
- Atualização de `docs/blueprint/02-roles-permissions.md`, `03-routes-navigation.md`, `04-database-schema.md` e `08-security-compliance.md`.
- Preservar as alterações já existentes no working tree, especialmente o diff não relacionado em `app/src/pages/admin/Configuracoes.tsx`.

## Critérios de aceite

- Admin full consegue convidar uma nova conta interna, editar foto/cargo/departamento/gestor e manter os demais campos operacionais atuais.
- Convite cria conta Auth com papel admin e nível limitado; convite repetido ou e-mail de conta já existente não converte silenciosamente perfil externo e retorna erro seguro.
- Admin limitado/jurídico não consegue convidar, alterar cadastro organizacional ou catálogo por chamada direta; leitura do organograma expõe somente campos organizacionais necessários.
- Upload e leitura de fotos respeitam bucket privado e políticas por papel; não há URL pública nem chave privada no navegador.
- Validação do gestor rejeita usuário externo/inativo, auto-referência e ciclos.
- A Rede de Originação atual continua idêntica; a Rede Interna mostra hierarquia e estados vazios/sem gestor.
- Funcionários sem foto, cargo, departamento, data de início ou gestor continuam válidos.
- Layout segue a referência fornecida e se adapta para telas estreitas.

## Segurança e privacidade

- A Edge Function de convite valida JWT, `role=admin` e `admin_nivel=full` antes de usar service role; nunca reutiliza o fluxo de convite de parceiro.
- RLS em todas as novas tabelas: leitura mínima a admins; mutações e convites apenas por admin full, via RPC/Edge protegida e auditada.
- Storage privado com validação de tipo/tamanho de imagem, path vinculado ao `usuario_id`, URL assinada de curta duração e remoção/substituição limitada.
- Campos organizacionais são dados pessoais internos; a visão só retorna nome, foto, cargo, departamento, gestor e data de início, sem e-mail/telefone salvo onde a tela de cadastro exigir.
- Preservar RLS e claims existentes; sem alterar `role` ou `admin_nivel` de funcionários já cadastrados.

## Testes previstos

- Unitários: hierarquia/ordenamento, validação de gestor e detecção de ciclos.
- Componentes: cadastro, estados vazios, validações, permissões e visualização responsiva.
- Edge Function: usuário não autenticado, não-admin, admin limitado, convite válido, e-mail existente e falha do Auth; sem disparo real de mensagens em testes.
- Smoke SQL transacional: RLS por nível, FKs, catálogo, gestor, ciclo, auditoria e Storage; rollback integral do fixture.
- Verificações locais obrigatórias: lint, typecheck, testes e build web.
- Navegador: login/admin full, convite em ambiente de teste sem destinatário real, CRUD de metadados, organograma sem dados, árvore com vários níveis e admin limitado em leitura.
- Release desktop: somente registrar impacto e validar que build desktop compila após aprovação; não empacotar, assinar, notarizar ou publicar nesta mudança.

## Rollout e rollback

- Migration apenas aditiva; inicialmente sem impor cargo/departamento/gestor obrigatórios aos usuários existentes.
- Implantar backend/migration e função antes do frontend que as chama; não executar produção até aprovação específica do modelo e plano de rollout.
- Rollback preferencial por forward-fix. Se não houver dados de funcionários ainda, tabelas/Edge podem ser removidas em migration corretiva após validação; não apagar contas Auth por rollback. Fotos podem ser mantidas até decisão de retenção/remoção.
- Deploy web, builds por SO e release não estão autorizados por este plano.

## Aprovação

- Modelo e escopo aprovados pelo usuário em 2026-10-13.
- Implementação local concluída: migration aditiva, Edge Function de convite, cadastro/perfis e catálogos em Configurações e visualização separada de organograma em Rede.
- Validação executada: lint (sem erros; avisos legados), typecheck, 31 arquivos de teste/113 testes e build web.
- Smoke pré-publicação em produção: confirmado que tabela, RPC e bucket da equipe interna ainda não existiam; o site respondia HTTP 200 após redirect para `www`.
- Aplicadas em produção as migrations `20261013000001_equipe_interna_organograma.sql` e `20261013000002_equipe_interna_rpc_privileges.sql`. O segundo arquivo remove grants diretos a `anon` que o primeiro smoke detectou nas RPCs; o smoke SQL completo passou depois da correção.
- Edge Function `admin-invite-internal` publicada. Requisição POST sem autenticação retornou 401; nenhum convite/e-mail foi criado ou enviado.
- Deploy Vercel de produção concluído em 2026-10-13: `https://www.mercuriocapitalsa.com.br`, deployment `dpl_EQYstrvmyYEnWdbppHFAGfqavvje`. O primeiro comando iniciado dentro de `app/` falhou sem ativar versão; repetido da raiz do repositório, com sucesso.
- Smoke após deploy: migration list confirma as duas versões remotas; smoke SQL completo passou; cinco RPCs negam execução a `anon` e permitem a `authenticated`; rota `/admin/configuracoes` respondeu HTTP 200 e o bundle de equipe interna publicado contém o organograma e as chamadas RPC. Navegador local autenticado, conectado ao banco publicado, carregou os perfis internos e exibiu o organograma sem criar ou editar dados.
- Build remoto Vercel passou; alertou vulnerabilidades de dependências (26 no install remoto) e chunk principal acima de 500 kB. Nenhum ajuste de dependências foi feito neste rollout.
- Não realizados: builds ou release desktop/notarizados para Windows, Linux ou macOS.
