# Aceite digital de consultas da proposta

Data: 27/10/2026  
Estado: migration aplicada ao Supabase vinculado em 27/10/2026; código de aplicação local não publicado; backfill não executado e nenhuma consulta disparada por esta mudança.

## Modelo e regras

`proposta_consulta_aceites` registra a origem da autorização por proposta: `portal_digital` para a instrução enviada pelo cliente principal por magic link consumido, ou `atestado_controlador` para a confirmação retrospectiva feita por administrador. Guarda versão e cópia do texto, escopos, registro/ator e eventual revogação. Não copia CPF/CNPJ, IP ou resposta de provedor. O magic link é único; os registros ativos são idempotentes por proposta, cliente, versão e origem.

## Carteira existente: atestado retrospectivo

O controlador informou que os clientes das propostas em andamento já haviam aceitado anteriormente, mas o evento não foi gravado no sistema. A origem `atestado_controlador` registra essa declaração sem representar um clique do cliente e sem inventar quando ocorreu o aceite original: `aceito_em` fica nulo; `atestado_em` e `registrado_em` recebem o horário real do registro; `registrado_por` identifica o administrador autenticado. O texto do registro deixa essa distinção explícita.

A RPC `admin_proposta_consulta_aceites_atestar_retroativo()` é autenticada e verifica `app_is_admin()`. Ela cobre propostas com cliente associado, exceto status `simulacao` e `cancelado`; preserva recibos digitais e quaisquer recibos ativos já existentes; insere somente os ausentes e grava evento no `audit_log`. Sua resposta inclui total elegível, inseridos, já registrados e exclusões. A tela de consulta distingue o atestado do aceite digital e mostra o horário do atestado.

O script somente de leitura `supabase/manual/20261027-aceite-consultas-retroativo-dry-run.sql` mostra totais e protocolos/status mínimos para revisão, sem nomes ou documentos pessoais. A execução é uma chamada explícita à RPC a partir de sessão autenticada de administrador. Não executar até revisar os números e a lista. Migration remota, publicação da Edge Function e execução em produção são gates separados. O backfill não muda dados da proposta, não consulta provedores e não debita carteira.

Escopos atualmente cadastrados: `serasa_pf`, `serasa_pj`, `bacen_cpf`, `bacen_cnpj`. Novos serviços não são habilitados automaticamente pelo enum: precisam de integração real, escopo aprovado/versão adequada e validação no fluxo de cobrança. Os serviços Jusbrasil, Escavador, RI Digital e Nacional Consultas ainda retornam mocks, portanto a Edge Function e a RPC os recusam antes do débito.

`consulta_autorizacoes` continua registrando a autorização operacional Serasa por consulta. A fonte pode ser um documento aprovado legado ou um recibo digital ativo compatível com a proposta e o tipo; uma constraint exige exatamente uma dessas fontes. `logs_consultas.aceite_digital_id` liga o débito e o resultado ao recibo quando esse foi usado. Registros antigos permanecem documentais e intactos.

A RPC de consulta Serasa valida integração, relatório, tipo PF/PJ, documento do cliente principal, autorização, escopo, preço e acesso antes de debitar. A RPC genérica permite apenas Bacen PF/PJ com aceite compatível; a Edge exige Bacen configurado de verdade e recusa o fallback mock antes de chamar qualquer RPC faturável.

RLS permite leitura do recibo pelo próprio cliente e pelas roles que já podem acessar a proposta (partner/equipe/admin). Escrita não é concedida a `anon` nem `authenticated`; a gravação só ocorre na Edge usando service role, após consumir o link, resolver role client e vincular o cliente ao usuário.

## Fluxo do titular

Na página pública do magic link, o cliente principal pode marcar uma caixa opcional de instrução antes de entrar no portal. Recusar não bloqueia a criação/ativação da conta e não cria autorização. Marcar registra um recibo ao lado do vínculo de conta; não dispara consulta nem débito. A página informa que o aceite é do cliente principal e não se faz passar por aceite individual dos co-proponentes.

A tela interna de consultas mostra o recibo e oferece o caminho digital para Serasa; sem recibo, preserva a seleção do documento aprovado. O portal e as consultas não recebem CPF/CNPJ em payload de navegador.

## Limites antes de rollout

- O controlador deve validar texto, base legal e se a instrução do cliente principal é suficiente para encaminhar dados de co-proponentes/imóveis aos provedores contratados. O registro não afirma consentimento individual dos demais titulares.
- O texto limita provedores a categorias descritas e habilitadas; a adição material de finalidades ou categorias exige revisão e nova versão.
- Serasa hoje resolve CPF/CNPJ do cliente principal. O aceite registra o escopo da proposta, mas não muda a resolução/seleção dos proponentes nem cria consultas adicionais.
- Integrações mock não podem ser cobradas nem apresentadas como buscas reais. A Edge e a RPC genérica têm bloqueios antes do débito.
- Esta migration e a Edge Function precisam de revisão/aplicação/deploy separados. Não fazer consulta Serasa real nem ativar produção como parte deste trabalho.

## Verificação manual local

1. Abrir um link de ativação com aceite desmarcado; entrar no portal e confirmar ausência de recibo e que a conta ainda pode ser ativada.
2. Abrir outro link de fixture com a caixa marcada; confirmar um recibo com texto/versionamento e a proposta/cliente corretos, sem duplicar em replay controlado.
3. Com role partner autorizada, abrir Consultas da mesma proposta e confirmar o recibo; outra proposta deve não mostrar esse recibo.
4. Confirmar que Serasa aceita recibo válido ou documento aprovado legado e rejeita recibo revogado/fora do escopo antes do débito.
5. Confirmar Bacen sem configuração e qualquer provider mock falham antes de criar log/debitar; não usar credenciais ou carteira de produção.
6. Confirmar cliente de proposta diferente não lê recibo via RLS.
7. Conferir o dry-run e garantir que simulações, canceladas e propostas sem cliente estejam excluídas; comparar o total com os registros ativos existentes.
8. Em ambiente descartável/alinhado, chamar a RPC duas vezes como admin: a primeira deve inserir apenas os ausentes e auditar; a segunda não deve duplicar. Confirmar que a UI identifica o registro como atestado retrospectivo, sem data original.

## Estado das verificações anteriores ao atestado retrospectivo

- `npm run lint`: passou, com 33 avisos já existentes no projeto.
- `npm run typecheck` e `npm run build`: passaram; o build mantém o aviso existente sobre chunks acima de 500 kB.
- `npm test -- --run`: 45 arquivos e 175 testes passaram.
- `git diff --check`: passou.
- A migration `20261027000002` não foi aplicada ao banco local: o banco está com histórico aplicado apenas até `20260918000008`, enquanto várias migrations anteriores a esta mudança estão pendentes. Não foi feito reset nem aplicação em lote para preservar o estado local.
- `supabase db lint --local` rodou sobre o schema antigo e apontou issues já presentes nele, incluindo uma referência ambígua em `consulta_iniciar` (substituída por esta migration) e uma coluna ausente em `admin_campanha_disparar` (fora do escopo). A migration nova ainda precisa de aplicação e validação em um banco local alinhado.
- Esses resultados se referem à implementação digital anterior à extensão de atestado retrospectivo e precisam ser repetidos para a versão atual.
- A migration `20261027000002` ainda não foi aplicada ao schema local porque há migrations anteriores pendentes. No Supabase vinculado, ela foi aplicada após confirmação específica; a verificação subsequente do CLI mostrou o banco atualizado.
- Smoke SQL, typecheck Deno, verificação manual no navegador, idempotência/RLS da RPC e leitura do dry-run em banco alinhado permanecem pendentes.

## Verificações da extensão retrospectiva

- `npm run lint`: passou sem erros; manteve 33 avisos do projeto.
- `npm run typecheck`: passou.
- `npm run build`: passou, com o aviso já existente de chunks maiores que 500 kB.
- `npm test -- --run`: 45 arquivos e 175 testes passaram na execução isolada. Uma execução anterior em paralelo com o build teve timeout intermitente (174/175), que não se reproduziu isolando a suíte.
- `git diff --check`: passou.
- `supabase db push --linked --dry-run` antes da aplicação apontou somente `20261027000002`; após aplicar, o mesmo dry-run informou que o banco remoto está atualizado. `supabase migration list --linked` confirmou a versão `20261027000002` no remoto.
- `supabase db lint --linked --schema public` não apontou issues nas funções desta migration. Apontou erros em `admin_campanha_disparar` (coluna `usuarios.partner_id` inexistente) e `admin_config_leads_classificador_atualizar` (assinatura de `registrar_audit` incompatível), além de avisos em outras funções; esses itens são fora do escopo e não foram alterados.
- Não foi possível executar o smoke SQL nem validar a migration/RPC no banco local: as migrations disponíveis vão além do histórico aplicado no banco. Não foi feito reset nem aplicado lote pendente. O backfill não foi executado.
- Fluxo autenticado no navegador, RLS com múltiplas roles e dry-run real ainda requerem ambiente Supabase alinhado.

## Escopo revisado dos 138 protocolos

Em 28/10/2026, o controlador informou que ainda não havia executado o backfill. A RPC ampla `admin_proposta_consulta_aceites_atestar_retroativo()` não deve ser chamada porque selecionava toda proposta elegível no momento da execução, podendo incluir protocolos que não fizeram parte da revisão. A migration local `20261028000001_backfill_aceite_protocolos_revisados.sql` remove essa RPC ampla e introduz prévia e execução autenticadas limitadas à lista fixa dos 138 protocolos revisados. A lista está no schema `private`; a tela Admin recebe apenas protocolo, status revisado/atual e indicadores de elegibilidade/registro, sem PII.

A nova execução verifica `app_is_admin()`, confere a integridade da lista fixa, bloqueia item ausente, sem cliente, simulação ou cancelado, preserva recibos ativos, grava apenas os ausentes e cria eventos de auditoria. Mudanças de status elegíveis são exibidas para conferência. A operação permanece idempotente e não dispara consulta nem débito.

**Estado deste incremento em 28/10/2026:** migration `20261028000001` aplicada ao Supabase vinculado; interface publicada na Vercel e disponível em `/admin/integracoes`. O bundle e a rota foram verificados por HTTP 200 e pelos textos da interface. O backfill ainda não foi executado: falta conferir a prévia real na sessão Admin e acionar a confirmação por uma sessão autenticada. Não ampliar a lista sem nova revisão/autorização. O rollback operacional está em `supabase/manual/20261028-rollback-backfill-aceite.md`.
