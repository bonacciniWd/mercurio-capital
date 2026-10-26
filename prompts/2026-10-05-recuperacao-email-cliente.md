# Plano — recuperação e reenvio de acesso do cliente

## Objetivo

Garantir que o cliente receba o link inicial de acesso por e-mail quando um
parceiro ou administrador reemitir o magic link da proposta, e deixar explícita
a diferença entre ativação inicial e recuperação de senha.

## Skills e documentação lidas

- `AGENTS.md` do workspace.
- `docs/operacao/runbooks.md`, especialmente o incidente de e-mails e a seção
  de ativação/login do cliente.
- `docs/blueprint/06-modules-features.md` e
  `docs/blueprint/07-integrations-flows.md`.

## Código inspecionado

- `app/src/pages/public/RecuperarSenha.tsx`;
- `app/src/pages/public/Login.tsx`;
- `app/src/pages/public/MagicLink.tsx`;
- `app/src/pages/partner/PropostaDetalhe.tsx`;
- `supabase/functions/magic-link-issue/index.ts`;
- `supabase/functions/magic-link-consume/index.ts`;
- `supabase/functions/email-dispatcher/index.ts`;
- RPCs `partner_reissue_magic_link` e `enqueue_proposta_criada_email`;
- tabela/fila `email_outbox` e template
  `proposta_cliente_magic_link_v1`.

## Diagnóstico e decisão

- `clientes` é cadastro comercial; recuperação Supabase só funciona para uma
  conta que já exista em `auth.users`.
- A ativação inicial deve continuar sendo feita pelo magic link da proposta.
- O reenvio da tela de proposta deve enfileirar o e-mail no backend, usando o
  template transacional existente e o `email-dispatcher`/Resend.
- O link continuará disponível para cópia como fallback operacional.
- Não enviar tokens, service role ou chamadas ao Resend pelo navegador.

## Alterações esperadas

- Criar uma RPC server-side específica para enfileirar reemissão de magic link,
  com evento e metadados próprios, sem conflitar com o índice de primeiro envio.
- Alterar `magic-link-issue` para chamar essa RPC com service role depois de
  validar o JWT e a posse da proposta; retornar `email_status` e erro seguro,
  mantendo o link manual quando o provedor estiver indisponível.
- Atualizar `PropostaDetalhe` para mostrar se o e-mail foi enfileirado ou se o
  link deve ser copiado manualmente.
- Ajustar o texto de recuperação para explicar que ela é para contas já
  ativadas e orientar o primeiro acesso pelo link da proposta.
- Atualizar runbook e criar smoke SQL da fila/reemissão.

## Critérios de aceite

- Reemitir o link de uma proposta com e-mail cria uma linha `pendente` em
  `email_outbox` com evento de reemissão e link canônico.
- O dispatcher processa essa linha e registra `enviado` ou `erro` detalhado.
- O link manual continua funcionando se o envio falhar.
- Um cliente sem `auth.users` é orientado para ativação inicial; não é tratado
  como recuperação de senha.
- Usuários internos não podem ser associados a clientes por esse fluxo.

## Segurança e rollback

- Validar autorização e posse da proposta antes de gerar/reemitir.
- Manter rate limit existente e invalidar tokens anteriores.
- Não expor token em logs, audit payload ou resposta além do link operacional já
  existente na tela autorizada.
- Migration aditiva e reversível por forward-fix; não usar `db reset`.

## Verificação

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Smoke SQL da nova RPC com rollback transacional.
- Teste manual autenticado: reemitir, confirmar fila, executar dispatcher e
  validar recebimento; testar fallback de cópia e conta ainda não ativada.
- Deploy remoto somente após GO explícito, incluindo migration, função e
  frontend.

## Estado

Implementação local concluída após a confirmação de que o cliente já consegue
ativar e acessar o portal:

- RPC `enqueue_proposta_magic_link_reissue_email` criada em migration aditiva.
- `magic-link-issue` passou a enfileirar a reemissão quando recebe
  `send_email=true`, sem bloquear o link copiável em caso de falha.
- Detalhe da proposta passou a solicitar o envio e informar o resultado da fila.
- Runbook e smoke test da fase 37 adicionados.
- Testes locais, typecheck, lint, build, dry-run da migration e
  `git diff --check` passaram.
- Migration `20261005000002_reissue_magic_link_email` aplicada no projeto
  remoto.
- Edge Function `magic-link-issue` publicada na versão 28, com status ACTIVE.
- Frontend publicado no Vercel em `dpl_GBnsHMmbmLMnxjvuzk9Wx7ATARJv`, status
  READY, com os aliases de produção ativos.
- Domínio público respondeu HTTP 200.
- O smoke SQL remoto ainda não foi executado: o ambiente local não possui
  `psql` nem Docker disponível para executar a transação de verificação.
