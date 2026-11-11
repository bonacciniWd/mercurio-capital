# Plano — remoção da conta Auth órfã

Data: 29/10/2026. Estado: concluído; exclusão permanente verificada no Supabase Auth e auditoria preservada.

## Objetivo

Remover o acesso e a identidade Supabase Auth do usuário `ba2d720f-439e-40ce-9c0b-86fed4f4d278`, sem tocar em outras contas, dados de negócio, configurações ou tabelas de auditoria.

## Documentação lida

- `AGENTS.md` fornecido pelo dono do produto nesta conversa.
- `docs/blueprint/04-database-schema.md` — relações `usuarios`, `usuarios_internos`, `partners` e `clientes`.
- `docs/blueprint/08-security-compliance.md` — auditoria append-only, retenção e princípios de identidade.
- `docs/blueprint/02-roles-permissions.md` — escopos administrativos.
- `docs/operacao/change-management.md`.
- `supabase/migrations/20260513000006_plataforma.sql` — estrutura e imutabilidade de `audit_log`.
- `supabase/migrations/20261013000001_equipe_interna_organograma.sql` — vínculo do perfil interno.
- Documentação oficial Supabase: Auth Admin `deleteUser` e gestão de usuários.

## Código, configuração e banco inspecionados

- Busca no código por fluxos existentes de exclusão de usuários. Não existe endpoint administrativo próprio para excluir uma conta; as chamadas existentes de Auth Admin estão em Edge Functions para convite/magic link.
- CLI Supabase vinculado ao projeto `bhagksfvszeogtjvjtpx`; consultas remotas foram somente leitura.
- Resultado mínimo do alvo: linha existe em `auth.users`; claim `role=admin`, `admin_nivel=limitado`; sem linha em `public.usuarios` ou em seus perfis filhos (`usuarios_internos`, `partners`, `clientes`).
- Uma identidade Auth e um fator MFA; zero sessões Auth ativas, zero objetos no Storage pertencentes ao UUID e zero vínculos SCIM. O alvo não é SSO.
- Sete perfis `admin` ativos existem em `public.usuarios`; o alvo não é contado entre eles por estar sem perfil público.
- A varredura das colunas UUID de usuário/ator em tabelas públicas encontrou 65 referências em `public.audit_log.usuario_id` e nenhuma outra referência correspondente.
- `audit_log` não tem FK para `usuarios`, mas sua migração e a documentação definem a tabela como imutável: UPDATE e DELETE são negados.

## Decisões e suposições

- A intenção registrada é remover somente a conta Auth deste UUID. Não excluir nem modificar outras contas.
- O caminho tecnicamente correto é a exclusão permanente via Supabase Auth Admin API (`auth.admin.deleteUser`, sem soft-delete) ou Dashboard > Authentication > Users. Não executar `DELETE` manual em `auth.users` por SQL.
- A exclusão remove a linha Auth, identidade, fator MFA e tokens de refresh/sessões associados. Tokens JWT de acesso já emitidos podem permanecer válidos até expirarem.
- Os 65 registros de auditoria devem permanecer intocados conforme a regra append-only. Assim, “remover completamente” significa retirar a conta e a capacidade de autenticar; o UUID permanece como ator histórico nos eventos de auditoria.
- Sem vínculo público nem objetos Storage, não há evidência de dados de parceiro, cliente ou equipe interna para limpar nesta operação.
- A remoção permanente não é reversível. Se a exclusão for equivocada, a recuperação é por novo convite/criação de conta, com novo UUID e nova autenticação; não há restauração da senha/MFA anteriores.

## Arquivos esperados

- Este plano em `prompts/`.
- Nenhuma alteração de código, migration, dados de negócio ou UI.
- Ao concluir, registrar apenas o resultado operacional neste plano, sem expor e-mail ou outros dados pessoais.

## Critérios de aceite

1. O dono confirma que aceita preservar as 65 referências históricas no `audit_log`.
2. Exclusão permanente restrita ao Auth ID informado, usando Auth Admin API/Dashboard.
3. Após a exclusão, consultas de verificação confirmam: zero linha em `auth.users`, `auth.identities`, `auth.mfa_factors` e `auth.sessions`; zero perfil público antes e depois; 65 eventos de auditoria preservados.
4. Nenhuma consulta Serasa, mudança de role de outros usuários, migration, deploy ou limpeza de auditoria é executada.

## Segurança e impacto

- Operação remota, destrutiva e restrita a uma identidade Auth; não envolve chaves no navegador nem SQL direto em `auth.users`.
- Registrar apenas UUID e contagens mínimas; não imprimir e-mail, nome, telefone, JWT ou conteúdo dos eventos.
- Admins ativos com perfil público permanecem inalterados; os registros de auditoria são retidos.
- Auth poderá deixar de aceitar refresh imediatamente, mas um JWT de acesso já emitido pode continuar válido até o `exp`.

## Testes e verificação

- Dry-run executado com `supabase db query --linked`: confirmou alvo e contagens acima; nenhuma escrita foi feita.
- Após autorização da política de retenção, verificar ausência da identidade Auth por UUID e preservação da contagem de 65 eventos de auditoria. Não testar login com credenciais do usuário removido.

## Aprovação

O dono aprovou remover permanentemente somente a conta Auth deste UUID, preservando os 65 eventos append-only e o UUID histórico do ator.

## Execução — concluída

- Após a tentativa inicial falhar no Dashboard, o dono concluiu a exclusão manualmente via Auth Admin.
- Verificação pós-ação via `supabase db query --linked`: `auth.users=0`, `auth.identities=0`, `auth.mfa_factors=0`, `auth.sessions=0`, `public.usuarios=0` e `public.audit_log=65` para o UUID alvo.
- Resultado: conta Auth removida, vínculos de autenticação removidos, perfil público já ausente e trilha histórica preservada. Nenhuma escrita SQL foi executada pelo agente.

## Diagnóstico da tentativa inicial no Dashboard

- O dono tentou excluir a conta no Dashboard e recebeu `Failed to delete user: Database error loading user`.
- Nova consulta somente leitura confirmou que o registro Auth ainda existe e não há valor NULL nas colunas `NOT NULL` de `auth.users`.
- `auth.users` tem apenas o trigger customizado `on_auth_user_created`, `AFTER INSERT`; ele não participa da exclusão.
- Não foi executada nova tentativa de exclusão nem qualquer alteração SQL.
- A mensagem é genérica; a exclusão posterior foi concluída pelo dono e verificada. Não houve necessidade de alterar triggers, constraints ou tabelas.
