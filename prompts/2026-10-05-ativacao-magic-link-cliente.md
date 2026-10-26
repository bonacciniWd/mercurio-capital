# Plano — ativação do cliente pelo link da proposta

## Objetivo

Corrigir a ativação do cliente após o recebimento do e-mail de uma proposta,
evitando o erro `magic-link-consume 400` seguido de `auth verify 403`, e manter
separados os fluxos de convite de equipe e proposta de cliente.

## Diagnóstico confirmado

- O template `convite_equipe_v1` deve levar a `/convite/:token` e, portanto,
  abre o módulo de parceiros; ele não cria usuário cliente.
- O template `proposta_cliente_magic_link_v1` leva a `/c/proposta/:token` e o
  e-mail real da proposta está chegando corretamente.
- A tela pública consulta a proposta sem consumir o token e, ao clicar em
  “Entrar no portal”, chama `magic-link-consume`.
- A Edge Function consome o token customizado, gera um link Auth nativo e o
  frontend tenta verificar `hashed_token` diretamente com `verifyOtp`.
- O navegador registrou falha 403 na verificação; uma segunda tentativa recebe
  400 porque o token customizado já foi marcado como usado.

## Código e documentação inspecionados

- `app/src/pages/public/ClienteProposta.tsx`;
- `app/src/pages/public/ConviteMembro.tsx`;
- `app/src/pages/public/MagicLink.tsx`;
- `app/src/auth/authClient.ts` e `AuthContext.tsx`;
- `app/src/router.tsx`;
- `supabase/functions/magic-link-consume/index.ts`;
- RPCs `cliente_peek_proposta` e `cliente_consume_magic`;
- `docs/blueprint/06-modules-features.md`,
  `docs/blueprint/07-integrations-flows.md` e `docs/operacao/runbooks.md`.

## Decisão de implementação

- Usar o `action_link` nativo retornado por `generateLink` para concluir a
  autenticação por navegação do navegador, evitando a chamada direta que está
  retornando 403.
- Manter o vínculo server-side entre `auth.users`, `usuarios` e `clientes`.
- Impedir alteração silenciosa de papel: se o e-mail já for de parceiro ou
  membro de equipe, informar conflito e não convertê-lo em cliente.
- Tratar resposta/erro da função na tela com mensagem acionável e evitar
  reenvio duplicado enquanto a tentativa está em andamento.
- Manter o link customizado de proposta single-use; a recuperação de senha só
  será usada depois que a conta cliente estiver ativada.

## Arquivos esperados

- `app/src/pages/public/ClienteProposta.tsx`;
- `supabase/functions/magic-link-consume/index.ts`, se necessário para resposta
  segura e mensagens de conflito;
- testes de autenticação/roteamento;
- `docs/operacao/runbooks.md` e smoke test da fase correspondente, se houver
  mudança server-side.

## Critérios de aceite

- Link do convite de equipe continua em `/convite` e não cria cliente.
- Link real da proposta abre `/c/proposta/:token`, permite entrar uma vez e
  termina em `/c` com papel `client`.
- Não ocorre `verify 403` no fluxo normal.
- Repetição de um token já consumido mostra erro claro e orienta solicitar
  reemissão.
- E-mail já vinculado a `partner`, `team_member` ou `admin` não é convertido.
- Nenhum token privado, service role ou chamada de provedor fica no navegador.

## Verificação e rollout

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e
  `git diff --check`.
- Teste manual com nova proposta e e-mail de cliente ainda não usado, em janela
  anônima, incluindo reabertura do link e conflito com e-mail de equipe.
- Se a Edge Function mudar, fazer deploy remoto somente após GO explícito.
- Nenhuma alteração de dados existentes será feita automaticamente.

## Estado

Implementação local concluída após aprovação:

- `ClienteProposta` agora usa o `action_link` nativo do Supabase em navegação
  direta, sem chamar `verifyOtp` pelo navegador.
- Erros de token consumido, rate limit e conflito de papel recebem mensagens
  acionáveis.
- Runbook atualizado com a separação entre convite de equipe e proposta de
  cliente.
- Testes locais, typecheck, lint, build e `git diff --check` passaram.
- Publicação no Vercel concluída após GO: deployment de produção
  `dpl_7z5VLZPMzYxC55uFDXPHhe6zbswo`, estado `READY`, alias
  `www.mercuriocapitalsa.com.br`.
- Verificação pós-deploy: `vercel inspect` confirmou `READY` e o domínio público
  respondeu HTTP 200.
