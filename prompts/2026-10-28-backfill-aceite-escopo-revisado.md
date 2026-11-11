# Plano — executar o backfill somente nas propostas revisadas

## Objetivo

Permitir que um administrador autenticado execute o backfill de aceite retrospectivo somente para os protocolos revisados e autorizados, sem incluir propostas novas que apareçam depois do dry-run.

## Documentos e código inspecionados

- `AGENTS.md` fornecido na conversa.
- `docs/operacao/2026-10-27-aceite-consultas-cliente.md`.
- `prompts/2026-10-27-plano-aceite-retroativo-propostas.md`.
- `supabase/manual/20261027-aceite-consultas-retroativo-dry-run.sql`.
- `supabase/migrations/20261027000002_proposta_consulta_aceite_cliente.sql`.
- `app/src/pages/admin/Integracoes.tsx` e padrão Supabase/RPC existente.
- Estado remoto verificado: migration `20261027000002` aplicada; `admin_proposta_consulta_aceites_atestar_retroativo()` está disponível, mas não existe botão chamador na UI.

## Decisões e suposições

- O backfill previamente autorizado cobre apenas a lista de 138 protocolos revisada em 27/10/2026.
- O RPC atual não recebe lista nem limite e inclui todas as propostas elegíveis no instante da chamada; não será chamado nessa forma.
- Não criar tabelas nem alterar recibos digitais/documentos. A lista exata dos 138 protocolos revisados fica fixa em helper no schema `private`; a interface não envia a lista e a RPC valida em transação a elegibilidade de cada registro. Isto impede que o cliente amplie o escopo.
- A interface Admin mostrará uma prévia atualizada sem PII, exigirá confirmação explícita e enviará ao servidor apenas os protocolos elegíveis revisados.
- A gravação continuará com `app_is_admin()`, trilha `audit_log`, idempotência, RLS e sem consulta Serasa/débito.
- Qualquer protocolo novo ou alterado fora da lista permanece sem atestado e exige revisão/autorização separada.
- Migration e deploy da interface são etapas remotas separadas e precisam de GO próprio. Nenhuma consulta Serasa faz parte desta mudança.

## Arquivos esperados

- Migration em `supabase/migrations/` para remover o RPC amplo e criar versões limitadas à lista fixa de protocolos, mantendo permissão apenas a `authenticated` e validação de administrador.
- `app/src/pages/admin/Integracoes.tsx` para prévia e botão explícito de execução.
- Smoke SQL da migration/RPC, teste focado da apresentação/estado da interface e atualização de `docs/operacao/2026-10-27-aceite-consultas-cliente.md`.

## Critérios de aceite

- A prévia identifica somente protocolos presentes na lista revisada e ainda elegíveis, mostra totais e mudanças desde o dry-run anterior, sem nome/CPF/CNPJ.
- O RPC rejeita role não-admin, lista corrompida/repetida, protocolo inexistente, status inelegível ou associação de cliente inválida.
- A execução grava apenas protocolos recebidos, com origem `atestado_controlador`, `aceito_em` nulo, ator e instante reais, escopos aprovados e audit log.
- Repetir a mesma chamada não duplica registros nem logs de atestado.
- Um protocolo criado após a lista revisada nunca é incluído implicitamente.
- Nenhuma chamada ao Serasa ou débito ocorre.

## Segurança

- Nenhuma identidade administrativa simulada por CLI/SQL Editor.
- Toda escrita passa pelo JWT da sessão Admin e validação `app_is_admin()` no servidor.
- A lista de protocolos é apenas identificador operacional; nenhum CPF/CNPJ ou payload Serasa é enviado ao cliente.
- A função usa `SECURITY DEFINER` com `search_path` fixo e grants mínimos.

## Verificações

- Testes SQL em banco descartável/alinhado: role admin e não-admin, escopo exato, status/cliente alterados, inserção, idempotência e auditoria.
- `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check`.
- Smoke manual como Admin: prévia, cancelamento, confirmação e leitura posterior dos recibos; sem disparar consulta.
- Aplicação da migration Supabase e deploy Vercel não estão autorizados por este plano.

## Implementação local após aprovação

- `app/src/pages/admin/Integracoes.tsx`: prévia protegida e ação com confirmação explícita, contagem e estados revisados; mensagem informa que não há consulta Serasa nem débito.
- `supabase/migrations/20261028000001_backfill_aceite_protocolos_revisados.sql`: allowlist fixa dos 138 protocolos no schema `private`, retirada do RPC abrangente, prévia e execução `SECURITY DEFINER` autenticadas, validação admin, idempotência e auditoria.
- `supabase/smoke-tests/fase-49-backfill-aceite-protocolos-revisados.sql`: checagens estruturais e de privilégios, sem executar escrita.
- `docs/operacao/2026-10-27-aceite-consultas-cliente.md`: estado e limites atualizados.
- Migration aplicada ao Supabase vinculado em 28/10/2026; deploy Admin isolado publicado como `dpl_FAGnmr6Td8hM1XktsLNn9n2Hy8M2` (READY). A rota de produção respondeu HTTP 200 e o bundle publicado contém os rótulos da prévia e da ação.
- O RPC de escrita não foi chamado. O backfill permanece pendente até conferir a prévia real e confirmar a ação por uma sessão Admin autenticada; nenhum JWT de administrador foi simulado nem houve SQL privilegiado de backfill.
- Rollback da aplicação e kill switch do RPC de escrita preparados em `supabase/manual/20261028-rollback-backfill-aceite.md`; não acionados.
