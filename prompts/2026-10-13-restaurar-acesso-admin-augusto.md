# Restaurar acesso de admin limitado — Augusto César

## Objetivo

Restaurar o acesso interno de `augusto.cesar@mercuriocapitalsa.com.br` como `role=admin`, ativo e com `admin_nivel=limitado`, conforme a decisão já documentada em `prompts/2026-10-05-ajuste-nivel-admin-augusto.md`.

## Skills e documentos consultados

- `AGENTS.md` fornecido nesta sessão.
- `docs/operacao/change-management.md`.
- `docs/operacao/runbooks.md`.
- `docs/blueprint/02-roles-permissions.md`.
- `docs/blueprint/08-security-compliance.md`.
- `docs/handoffs/14-handoff-fase9.md`.
- `prompts/2026-10-05-ajuste-nivel-admin-augusto.md`.
- Não foi necessária skill externa.

## Diagnóstico e evidência

- Consulta somente leitura em produção retornou `public.usuarios.role=partner`, `ativo=false`; `auth.users.raw_app_meta_data.role=partner`, `admin_nivel=limitado`.
- O registro relacionado em `public.partners` está `suspended`.
- O histórico registra transição do parceiro de `pending` para `approved` em 2026-10-09 e de `approved` para `suspended` em 2026-10-13. Ambos os eventos foram registrados por Victor Hugo.
- A implementação de `public.admin_reactivate_partner(uuid)` regrava a claim Auth como `partner` e define `public.usuarios.role='partner', ativo=true`; `public.admin_suspend_partner(uuid,text)` marca `public.usuarios.ativo=false` e suspende o parceiro. Isso explica a divergência após a correção anterior.
- O login em `/admin/login` aceita apenas `role=admin`; o escopo `limitado` não impede autenticação no módulo.

## Modelo e dados afetados

Uma identidade vinculada por `auth.users.id = public.usuarios.id`, com registro associado em `public.partners`:

- `auth.users.raw_app_meta_data.role`: `partner` → `admin`.
- `auth.users.raw_app_meta_data.admin_nivel`: manter `limitado`.
- `public.usuarios.role`: `partner` → `admin`.
- `public.usuarios.ativo`: `false` → `true`.
- `public.partners.status`: manter `suspended`.
- Carteira do parceiro: manter bloqueada.

O registro e a carteira de parceiro permanecem suspensos para evitar reativação de acesso externo, desbloqueio financeiro ou alteração de status além do necessário para restaurar o papel interno.

## Decisão e escopo

- Reaplicar somente os quatro valores acima, na mesma transação, após validar novamente que o e-mail corresponde a uma única identidade e que o estado anterior ainda é o esperado.
- Preservar as demais chaves de `raw_app_meta_data`.
- Gravar um evento de auditoria delimitado para a mudança do papel Auth, seguindo o padrão já registrado na correção anterior.
- Não executar `admin_reactivate_partner`, pois essa RPC define o usuário como `partner`, ativa a conta e desbloqueia a carteira.
- Não alterar senha, e-mail, nível operacional, equipe, perfil de parceiro, carteira ou outras contas.
- Nenhum código, migration, deploy ou release faz parte deste escopo.

## Arquivos esperados

- Somente este plano; nenhuma mudança de código está prevista.

## Critérios de aceite

- `public.usuarios` passa a retornar `role=admin` e `ativo=true`.
- `auth.users` passa a retornar `role=admin` e `admin_nivel=limitado`.
- `public.partners.status` permanece `suspended` e a carteira permanece bloqueada.
- A transação gera auditoria e não altera outras identidades.
- Augusto consegue entrar por `/admin/login` após encerrar a sessão antiga e autenticar novamente; a autorização de rotas continua limitada pelo `admin_nivel`.

## Segurança

- Operação de produção exclusivamente por SQL transacional e consulta posterior, usando a conexão de Management API já autenticada.
- Revalidar precondições dentro da transação e abortar se role/ativo/status divergirem do estado inspecionado.
- Não ler nem imprimir senha, token de sessão, metadados completos ou dados pessoais sem relação com o objetivo.
- Não conceder papel `full`, não reativar o registro de parceiro e não desbloquear carteira.

## Testes e validação

- Antes: conferir unicidade do e-mail e estado atual de usuário/Auth/parceiro/carteira.
- Durante: transação com pré-condições explícitas; se uma condição falhar, rollback.
- Depois: consulta somente leitura das claims `role`/`admin_nivel`, `public.usuarios.role`/`ativo`, status do parceiro e bloqueio da carteira.
- Validação manual: novo login por `/admin/login`, conferência de que o destino é `/admin` e de que uma rota fora da allowlist de admin limitado continua bloqueada.
- Não realizar deploy; build/lint/typecheck não se aplicam por não haver alteração de código.

## Rollback

Se a validação pós-transação falhar, reverter somente os campos alterados para o estado prévio confirmado (`role=partner`, `ativo=false`, mantendo `admin_nivel=limitado`, parceiro suspenso e carteira bloqueada), registrar auditoria da reversão e confirmar novamente por consulta.

## Execução e validação

- Plano aprovado pelo usuário em 2026-10-13.
- Precondições revalidadas imediatamente antes da escrita: papel `partner` nas duas fontes, `ativo=false`, `admin_nivel=limitado`, parceiro suspenso e carteira bloqueada.
- Transação concluída sem erro; foi alterado somente `auth.users.raw_app_meta_data.role`, `public.usuarios.role` e `public.usuarios.ativo`, preservando o nível limitado e demais metadados.
- Evento `admin_role_restaurado_aprovacao` registrado em `public.audit_log`.
- Consulta pós-operação confirmou: papel `admin` em Auth e `public.usuarios`, `ativo=true`, `admin_nivel=limitado`, parceiro `suspended`, carteira bloqueada e auditoria presente.
- Validação manual pendente: Augusto deve encerrar a sessão antiga, entrar novamente por `/admin/login` e confirmar acesso ao módulo administrativo; a sessão atual pode ainda carregar o JWT com o papel `partner`.
- Nenhum código, migration, deploy ou release foi alterado/executado.
