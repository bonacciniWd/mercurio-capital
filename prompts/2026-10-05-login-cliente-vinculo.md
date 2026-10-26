# Plano — Login do cliente e vínculo com a conta de autenticação

## Objetivo

Permitir que clientes cadastrados em `public.clientes` sejam ativados e
autenticados de forma consistente no portal `/c`, preservando a decisão de que
a conta inicial do cliente é criada por magic link. O login por e-mail e senha
deve funcionar somente depois que existir uma conta no Supabase Auth, um
espelho em `public.usuarios` com `role = 'client'` e o vínculo
`clientes.usuario_id`.

## Diagnóstico confirmado

- O registro analisado possui `clientes.usuario_id = null`.
- `/c/login` chama a Edge Function `auth-login`, que autentica apenas em
  `auth.users` com e-mail e senha.
- Após autenticar, o frontend chama `public.me()`, que procura o usuário por
  `auth.uid()` em `public.usuarios`; sem esse espelho, o cliente recebe
  “Conta não encontrada para este usuário.”
- O cadastro público existente é de parceiro. A documentação define que
  cliente não se auto-registra: a ativação inicial ocorre por magic link.
- A Edge Function `magic-link-consume` gera o link, mas hoje não persiste o
  `usuario_id` retornado para o registro de `clientes` quando a conta é criada
  ou localizada.
- Um navegador com sessão de admin/parceiro também é redirecionado antes de
  exibir `/c/login`; é necessário sair ou usar uma sessão isolada para testar
  outro papel.

## Documentos e código lidos

- `docs/blueprint/02-roles-permissions.md`;
- `docs/blueprint/06-modules-features.md`;
- `app/src/router.tsx`;
- `app/src/pages/public/Login.tsx`;
- `app/src/auth/authClient.ts`;
- `app/src/auth/AuthContext.tsx`;
- `app/src/guards/RedirectIfAuthenticated.tsx`;
- `supabase/functions/auth-login/index.ts`;
- `supabase/functions/magic-link-consume/index.ts`;
- `supabase/migrations/20260513000009_auth_bridge.sql`;
- `supabase/migrations/20260514000003_partner_create_proposta.sql`.

## Correção proposta

1. Ajustar `magic-link-consume` para capturar o `auth user id` devolvido por
   `auth.admin.generateLink` e vincular o cliente somente quando o usuário for
   novo ou já tiver papel `client`.
2. Criar migration forward-safe para vincular registros legados apenas quando
   houver correspondência única, normalizada e segura entre
   `clientes.email` e `auth.users.email`, sem substituir vínculos existentes e
   sem associar e-mails cujo papel efetivo seja admin/parceiro/membro.
3. Adicionar smoke test para:
- cliente sem vínculo não enxergar propostas fora do vínculo por RLS;
   - vínculo ser criado no fluxo de ativação;
   - proposta ficar visível somente ao cliente vinculado;
   - nenhum papel interno ser vinculado por correspondência de e-mail.
4. Corrigir o retorno visual da recuperação de senha para preservar o módulo
   de origem (`/c/login` quando iniciada pelo portal do cliente), sem alterar
   a política de autenticação.

## Modelo de dados e invariantes

- `auth.users.id` é a identidade autenticada.
- `public.usuarios.id` espelha `auth.users.id` e deve ter `role = 'client'`.
- `public.clientes.usuario_id` é o vínculo único entre o cliente comercial e a
  identidade autenticada.
- Uma conta não pode ser vinculada a dois clientes.
- Correspondência por e-mail só pode preencher vínculo nulo e quando não
  houver ambiguidade nem papel interno conflitante.
- Nenhum token, senha ou service role será enviado ao navegador.

## Arquivos esperados

- `supabase/functions/magic-link-consume/index.ts`;
- nova migration em `supabase/migrations/`;
- `supabase/smoke-tests/fase-36-client-auth-link.sql`;
- `app/src/pages/public/RecuperarSenha.tsx`;
- documentação operacional do fluxo de ativação do cliente.

## Critérios de aceite

- O registro enviado pode ser ativado por magic link e passa a ter
  `clientes.usuario_id` preenchido.
- Depois de definir uma senha, o mesmo e-mail consegue entrar em `/c/login`.
- `public.me()` retorna o perfil com `role = 'client'`.
- O cliente vê somente propostas/documentos associados ao próprio vínculo.
- Contas admin, partner e team_member não são vinculadas por e-mail.
- Fluxos existentes de parceiros, admins e magic links já ativados continuam
  funcionando.

## Rollback e segurança

- Alterações de banco serão aditivas e terão forward-fix; não haverá `db reset`.
- A migration não apagará usuários, clientes ou vínculos existentes.
- A função rejeitará qualquer tentativa de vincular um papel interno.
- Em caso de falha, o frontend mantém o login existente e o vínculo poderá ser
  corrigido manualmente por SQL administrativo auditado.

## Verificações

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- testes unitários de `authClient` e roteamento;
- smoke SQL da fase 36;
- validação manual: magic link → `/c`, definição de senha → `/c/login`, sessão
  admin ativa tentando abrir `/c/login`, conta sem vínculo e papel conflitante.

## Estado da execução em 2026-10-05

- Implementação local concluída: Edge Function, migration, smoke test,
  recuperação de senha e documentação.
- Typecheck, lint, build, testes unitários e `git diff --check` passaram.
- `supabase db push --linked --dry-run` reconheceu a migration
  `20261005000001_client_auth_vinculo.sql`.
- Migration remota aplicada com sucesso: `20261005000001_client_auth_vinculo`.
- Edge Function `magic-link-consume` publicada com sucesso na versão 28 e em
  estado `ACTIVE`.
- `supabase migration list --linked` confirmou a migration local e remota.
- `supabase functions list --project-ref bhagksfvszeogtjvjtpx` confirmou a
  função ativa.
- As alterações de login/recuperação foram incluídas no deployment de produção
  `dpl_7z5VLZPMzYxC55uFDXPHhe6zbswo`, estado `READY`, com alias
  `www.mercuriocapitalsa.com.br`.
- O smoke SQL remoto ainda não foi executado: o ambiente não possui `psql` e o
  daemon Docker local não está disponível para o fluxo de banco local.
