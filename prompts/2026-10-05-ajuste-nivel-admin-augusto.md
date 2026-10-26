# Ajuste de escopo administrativo — Augusto César

## Objetivo

Alinhar o usuário `augusto.cesar@mercuriocapitalsa.com.br` ao mesmo escopo administrativo documentado para `victor.hugo@mercuriocapitalsa.com.br`: `role=admin` com `admin_nivel=limitado`.

## Documentos e regras consultados

- `AGENTS.md` e instruções operacionais da sessão.
- `docs/README.md`, `docs/operacao/change-management.md` e `docs/operacao/runbooks.md`.
- `docs/blueprint/02-roles-permissions.md` e `docs/blueprint/08-security-compliance.md`.
- `supabase/migrations/20260718000001_admin_nivel.sql`.
- `supabase/migrations/20260722000007_admin_juridico_hardening.sql`.
- `prompts/2026-09-02-fase-1-admin-documentos-recuperacao.md`.

## Diagnóstico e decisão

- `admin_nivel` controla o escopo administrativo; `nivel_operacional` controla distribuição de leads e não substitui essa claim.
- A ausência de `admin_nivel` resolve para `full` por compatibilidade.
- O histórico operacional registra Victor como `admin_nivel=limitado`.
- A alteração será feita somente se a consulta confirmar o usuário e seu `role=admin`.

## Operação autorizada

1. Consultar `auth.users` e `public.usuarios` dos dois e-mails, sem exibir metadados sensíveis.
2. Normalizar somente a claim `auth.users.raw_app_meta_data.role` de Augusto para `admin`, pois o espelho `public.usuarios` já estava correto e a RPC oficial valida a claim do Auth.
3. Chamar `public.admin_set_admin_nivel(<uuid_augusto>, 'limitado')` como admin full.
4. Consultar novamente a claim efetiva e o espelho público.
5. Solicitar novo login de Augusto para carregar a claim no JWT.

Não haverá alteração de código, migration, senha, papel `role`, status ativo ou nível operacional.

## Critérios de aceite

- Augusto permanece `role=admin`.
- A claim persistida de Augusto é `admin_nivel=limitado`.
- Victor permanece sem alteração e continua `admin_nivel=limitado`.
- A operação gera registro em `audit_log` pela RPC oficial.
- Nenhuma chave ou metadado bruto sensível é impresso nos logs.

## Rollback

Se a validação exigir reversão, um admin full poderá chamar a mesma RPC com o nível anterior confirmado (`full` ou `juridico`). A reversão também ficará auditada.

## Validação

- Consulta remota somente leitura antes e depois.
- Verificação do retorno da RPC.
- Novo login manual de Augusto após a operação.
- Nenhum deploy ou release será executado.

## Resultado da execução

- Diagnóstico confirmado: Augusto tinha `public.usuarios.role=admin`, porém as claims Auth `role` e `admin_nivel` estavam ausentes; a ausência do nível efetivava `full`.
- Correção aplicada em transação: claim Auth `role=admin` normalizada e RPC oficial executada com `admin_nivel=limitado`.
- Pós-condição retornada pela transação: Augusto `role=admin`, `admin_nivel=limitado`, nível efetivo `limitado`, `ativo=true`; Victor permaneceu `role=admin`, `admin_nivel=limitado`.
- A transação também registrou as alterações no `audit_log`; nenhum código, migration, senha, papel público, status ativo ou nível operacional foi alterado.
- Teste automatizado executado: `npm test -- --run src/test/adminScope.test.ts` — 7 testes aprovados.
- A validação manual restante é o novo login de Augusto e a confirmação de que o JWT novo restringe as rotas administrativas sensíveis.
