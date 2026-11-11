# Plano — substituição de usuário interno

## Objetivo

Avaliar a saída de `eduardo.alves@mercuriocapitalsa.com.br` e a entrada de `lene.sampario@mercuriocapitalsa.com.br`, preservando auditoria, atribuição histórica e a hierarquia interna. Nenhuma alteração foi executada.

## Fontes e documentação consultadas

- Instruções `AGENTS.md` fornecidas pelo responsável nesta conversa.
- `docs/blueprint/02-roles-permissions.md` — papéis administrativos e níveis.
- `docs/blueprint/04-database-schema.md` — `usuarios`, `usuarios_internos` e relações.
- `docs/blueprint/08-security-compliance.md` — convite interno via Edge Function e service role apenas no servidor.
- `prompts/2026-10-13-cadastro-equipe-organograma-interno.md` e migration `20261013000001_equipe_interna_organograma.sql`.
- `supabase/functions/admin-invite-internal/index.ts` — convite real enviado por Admin full; cria `role=admin`, `admin_nivel=limitado` e linha interna.
- Memória operacional sobre a remoção anterior: escopo sempre vinculado ao UUID exato, preservar `audit_log` e nunca apagar diretamente de `auth.users` por SQL.

## Inspeção somente leitura no Supabase de produção

Projeto `bhagksfvszeogtjvjtpx` (`mercurio`).

- Eduardo existe como `auth.users` e `public.usuarios` no UUID `11111111-1111-1111-1111-111111111111`; conta ativa, `role=admin`, sem `admin_nivel` explícito (nível efetivo `full`), último login em 24/10/2026.
- Há 1 identidade Auth, 0 sessões ativas e 0 fatores MFA.
- Há 1 linha em `usuarios_internos` para Eduardo, com cargo, departamento e gestor associados, e 4 subordinados diretos: Admin Recuperação, Juridico Mercurio Capital, `maria.eduarda` e Victor Hugo.
- O UUID informado para Lene foi confirmado como `lene.sampaio@mercuriocapitalsa.com.br`, nome cadastrado `Lene Sampaio`; conta ativa, `role=admin`, `admin_nivel=limitado`, convite aceito, perfil interno criado, ainda sem cargo/departamento/gestor e sem subordinados.
- Referências contadas para o UUID de Eduardo: `audit_log` 1.298; `proposta_status_historico.alterado_por` 559; `proposta_fundos.atribuido_por` 205; `notificacoes.usuario_id` 88; `partner_invites.created_by` 47; `email_outbox.usuario_id` 15; `partners.aprovado_por` 11; `fundos.created_by` 7; `usuarios_internos.usuario_id` 1. Nenhuma proposta tem Eduardo como responsável direto.
- Com exclusão Auth, conforme FKs atuais: 88 notificações pessoais seriam apagadas; campos de atribuição em histórico (559), fundos atribuídos (205), aprovações de parceiros (11), convites criados (47), outbox (15) e fundos criados (7) virariam `NULL`; o perfil interno seria removido e os 4 vínculos de gestor ficariam sem gestor, salvo transferência antes.
- `audit_log` não possui FK para apagar em cascata: as 1.298 linhas permaneceriam, mas com UUID de ator sem conta correspondente. Não se deve reatribuir auditoria ou autoria histórica para Lene.

## Decisões aprovadas

O responsável aprovou convidar Lene como Admin `full`, mover para ela o perfil organizacional de Eduardo e seus quatro subordinados diretos, e desativar Eduardo. A desativação deve preservar Auth e o histórico de autoria; não foi autorizada exclusão permanente. Lene já foi convidada e aceitou. Promoção e transferência organizacional concluídas; Eduardo permanece ativo enquanto o responsável executa manualmente o bloqueio/desativação.

## Fluxos e limitações encontrados

- `/admin/configuracoes` → Equipe interna envia o convite pela Edge Function existente, mas essa função sempre cria `admin_nivel=limitado` e a interface não permite escolher `full`.
- Existe `admin_set_admin_nivel(uuid,text)`, protegida por `app_is_admin_full()` e com auditoria. Ela pode promover Lene após a conta existir, desde que a operação seja executada com sessão autenticada de Admin full.
- A edição do organograma usa `admin_internal_team_update`, com validações contra auto-gestão e ciclos, e pode transferir o cargo/departamento/gestor de Eduardo e cada um dos quatro subordinados.
- O toggle “Desativar acesso” encontrado na seção Usuários internos apenas altera `public.usuarios.ativo`. Não há nessa tela revogação de sessões nem bloqueio em `auth.users`; portanto, não é suficiente para garantir que Eduardo perdeu acesso ao Auth.
- Para a promoção e transferência foi usada a janela Chrome remota autenticada na aplicação local, configurada para o Supabase de produção. O ator foi `admin.recuperacao@mercuriocapital.dev`, com Admin full. O bloqueio de Auth ficou para execução manual, conforme preferência expressa pelo responsável.

## Execução e estado atual

1. Promoção de Lene para `full` executada pela RPC `admin_set_admin_nivel`, protegida pelo Admin full e auditada.
2. Perfil de Eduardo transferido para Lene via `admin_internal_team_update`: cargo Diretor, departamento Gestão & Diretoria, gestor Bruno Alves. Não foram copiadas foto nem data de início pessoal.
3. Os quatro subordinados foram reatribuídos a Lene via a mesma RPC auditada, preservando seus cargos, departamentos, fotos e datas de início.
4. Verificação pós-alteração em produção confirmou Lene `role=admin`, `ativo=true`, `admin_nivel=full`; os quatro subordinados apontam para o UUID dela. Eduardo ainda está `ativo=true`, com o perfil organizacional limpo de subordinados. Nenhuma autoria/histórico foi reatribuída.
5. O responsável preferiu desativar Eduardo manualmente. Consulta read-only atual: `banned_until=NULL`, `active_sessions=0`, último login em 24/10/2026. A conta Auth deve ser mantida, banida por período longo (a documentação mostra 100 anos como `876000h`) e marcada `usuarios.ativo=false` para refletir o estado no app. Não há sessões ativas a revogar neste momento; JWT já emitido permanece válido até expirar. Apenas marcar a linha da aplicação como inativa não impede Auth, e ban temporário isoladamente não encerra sessões já existentes.

As consultas de verificação foram executadas em transação `--read-only` contra produção. Não compartilhar senha, token ou service-role. Após a desativação manual, conferir `banned_until`, sessões e `usuarios.ativo` antes de fechar a tarefa.

## Critérios de aceite e segurança

- O escopo aplicado foi somente Lene e Eduardo, incluindo as quatro relações diretas de gestão mapeadas.
- Convite foi enviado uma única vez; `full` aplicado após confirmação do UUID e aceite do convite.
- `audit_log` permanece imutável; não se reatribui histórico a outra pessoa.
- A operação permanece incompleta até o responsável banir a conta Auth e marcar `usuarios.ativo=false`. A verificação atual encontrou zero sessões ativas. `usuarios.ativo=false` isoladamente não atende ao critério.
- Pós-ação: conferir ambos os e-mails/UUIDs em Auth e `usuarios`, perfil interno, vínculos de gestor e referências/históricos preservados ou nulificados conforme escolha.
- Se Auth Admin não estiver disponível no ambiente autenticado, fornecer passos exatos do Dashboard para execução manual; não pedir senha, token ou service-role ao usuário.
