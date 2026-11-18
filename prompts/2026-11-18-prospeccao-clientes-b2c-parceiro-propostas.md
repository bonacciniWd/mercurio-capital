# Plano — Prospecção B2C de parceiros e atribuição à proposta

**Data:** 2026-11-18

**Status:** migration e smoke estrutural aplicados em produção; matriz autenticada e teste visual pendentes
**Escopo relacionado:** adendo ao funil B2B aprovado em `prompts/2026-11-12-funil-prospeccao-parceiros.md`; o funil B2B continua separado e preservado.

## Objetivo

Adicionar uma carteira de prospecção de clientes B2C para parceiros/equipes em `/p/prospeccao`, mantendo o Kanban B2B atual em `/admin/prospeccao` e acrescentando nele uma aba B2C de visão global. Ao converter um prospect B2C, a proposta deve herdar o parceiro e, quando houver, a equipe do registro. Melhorar também a seleção manual de parceiro no wizard administrativo com busca por nome/e-mail.

## Fontes e documentos consultados

- `AGENTS.md` e o histórico relacionado em `prompts/`.
- `docs/README.md`, `docs/09-roadmap.md`, `docs/12-finalizacao.md`.
- `docs/operacao/change-management.md`, `docs/operacao/runbooks.md`, `docs/operacao/security-checklist.md`.
- `docs/blueprint/02-roles-permissions.md`, `docs/blueprint/03-routes-navigation.md`, `docs/blueprint/04-database-schema.md`, `docs/blueprint/08-security-compliance.md`.
- Especificação read-only do agente UX/UI para o funil e o seletor pesquisável.
- Plano B2B existente `prompts/2026-11-12-funil-prospeccao-parceiros.md`.

## Código inspecionado

- `supabase/migrations/20261112000001_prospeccoes_parceiro.sql`: tabela, histórico, RLS e RPCs do funil B2B.
- `supabase/migrations/20261112000003_prospeccao_anexos.sql`: conversão B2B atual e uso de `admin_create_proposta`.
- `supabase/migrations/20261023000001_lead_status_comercial.sql`: estados comerciais dos leads públicos; esses registros seguem sendo um domínio separado.
- `supabase/migrations/20260513000001_enums.sql`, `20260513000002_identidade.sql` e `20260513000003_originacao.sql`: helpers de identidade, equipes e escopo de propostas.
- `supabase/migrations/20260722000009_wizard_proposta_evolucao_rpcs.sql`: criação de proposta para parceiro e para Admin.
- `app/src/pages/partner/Wizard.tsx`: wizard compartilhado, parâmetro `prospeccao`, consulta atual a parceiros aprovados/pendentes e `<select>` extenso.
- `app/src/lib/adminScope.ts`, `app/src/layouts/AdminLayout.tsx`, testes de `adminScope` e `prospeccaoKanban`.
- Rotas e telas atuais de propostas Admin/Partner e padrões existentes para busca acessível.

## Confirmações do dono

- `/p/prospeccao` será um funil próprio de clientes B2C; não reutiliza nem altera o funil B2B de recrutamento de parceiros.
- `/admin/prospeccao` manterá o Kanban B2B e ganhará uma aba B2C com visão global.
- O parceiro vê os prospects da própria carteira; membros de equipe veem somente os registros da própria equipe; Admin autorizado vê todos.
- A atribuição do parceiro/equipe deve acompanhar a conversão em proposta.
- Telas envolvidas: `/p/propostas`, `/admin/propostas`, `/p/prospeccao`, `/admin/prospeccao`.

## Modelo de dados proposto — requer aprovação antes da implementação

Criar uma entidade B2C própria, sem reutilizar `prospeccoes_parceiro`, `simulacao_leads_publicos`, `cpc_leads_publicos` ou `lead_status_comercial`.

### `public.prospeccoes_clientes`

- `id uuid primary key`.
- `partner_id uuid not null references partners(id)` — dono da relação e da futura proposta.
- `equipe_id uuid null references equipes(id)` — equipe atribuída, se aplicável; deve pertencer ao mesmo `partner_id`.
- `responsavel_id uuid not null references usuarios(id)` — usuário que originou o registro.
- `nome_completo text not null`.
- `email text null`, `telefone text null` — ao menos um canal de contato obrigatório.
- `origem text null` e `notas text null` — contexto comercial estritamente necessário.
- `status text not null default 'novo'`.
- `motivo_perda text null` — obrigatório quando `status='perdido'`.
- `proposta_id uuid null unique references propostas(id)` — no máximo uma proposta convertida por prospect nesta primeira versão.
- `convertido_em timestamptz null`.
- Auditoria e ciclo de vida: `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.

### `public.prospeccoes_clientes_historico`

- `id`, `prospeccao_id`, `status_anterior`, `status_novo`, `alterado_em`, `alterado_por`.
- Histórico append-only das mudanças de etapa, conversão e encerramento; não expor escrita direta ao cliente.

### Relações e regras propostas

- Um parceiro tem muitas prospecções; uma equipe pode ter muitas; cada prospect pertence a exatamente um parceiro e no máximo uma equipe.
- Um prospect pode gerar zero ou uma proposta; a relação permanece ligada após cancelamento da proposta para preservar a origem/auditoria.
- O parceiro dono pode consultar toda a carteira `partner_id=app_partner_id()`; um membro de equipe só consulta `equipe_id=app_equipe_id()`; nenhum deles escolhe ou altera o `partner_id` enviado pelo cliente.
- O parceiro pode atribuir um registro a uma equipe própria; membro de equipe recebe sua equipe do contexto autenticado e não pode apontar para outra equipe.
- Admin full/limitado/comercial consulta a visão global e pode operar a carteira; Jurídico continua fora de `/admin/prospeccao`, conforme o escopo vigente.
- Leitura pode usar tabela/view com RLS e exige `app_can_operate()`; registros soft-deleted não ficam acessíveis pela tabela nem pelo histórico. Inserção, edição, movimentação, perda e conversão serão RPCs `security definer` com guardas por papel/escopo, validação da relação equipe-parceiro, AAL2 quando `app_requires_2fa()` for verdadeiro e auditoria. Nenhuma autorização dependerá apenas de filtro React.
- Não guardar CPF/CNPJ, documentos, dados financeiros ou consentimento de simulador nesta etapa. Esses dados são coletados no wizard de proposta, com os controles existentes.

### Etapas recomendadas para aprovação

`novo` → `em_contato` → `qualificado` → `proposta_criada`; encerramento alternativo `perdido` com motivo obrigatório. Todas as transições serão auditadas e usarão controle otimista para evitar sobrescrita concorrente. A etapa não será inferida de status de proposta: a conversão registra `proposta_id` e avança o prospect na mesma transação.

## Comportamento por superfície

- **`/p/prospeccao`:** novo Kanban B2C do parceiro, limitado no servidor às próprias prospecções e às da equipe correspondente. Criar/editar/mover/perder/converter por RPC. Ao converter, mostrar a atribuição vigente e abrir o wizard com nome, e-mail e telefone pré-preenchidos.
- **`/admin/prospeccao`:** preservar sem alteração funcional o Kanban B2B e adicionar aba B2C global, com operações de acompanhamento e conversão dentro do escopo administrativo já permitido.
- **`/admin/propostas`:** preservar a listagem global e permitir identificar a origem B2C e retornar à prospecção correspondente quando houver vínculo.
- **`/p/propostas`:** preservar o escopo RLS atual; propostas convertidas devem ficar vinculadas ao parceiro/equipe de origem e identificar a origem B2C quando aplicável.
- **Wizard Admin de proposta:** trocar o seletor comprido por combobox pesquisável por nome/e-mail, mantendo status aprovado/pendente, estados de carregamento/erro/vazio/sem resultado e teclado acessível. Isso atende o fluxo administrativo normal e a conversão B2B, em que o responsável continua sendo escolhido manualmente: `responsavel_id` do prospect B2B é usuário interno e não identifica um parceiro.
- **Conversão B2C por Admin:** exibir parceiro/equipe atribuídos como contexto bloqueado; não oferecer seleção arbitrária de outro parceiro nessa conversão. Qualquer reatribuição de carteira fica fora deste plano.

## Decisões, limites e riscos

- A tabela atual `prospeccoes_parceiro` é B2B e seu `partner_id` só passa a existir ao converter; seu `responsavel_id` é Admin interno. Ela não fornece atribuição confiável para conversão automática de cliente.
- Leads de simulador têm consentimentos e dados próprios, além de RLS administrativa; não serão transformados ou compartilhados automaticamente com a carteira de parceiros.
- A proposta precisa ser criada e ligada ao prospect atomicamente. Os RPCs não aceitarão `partner_id` ou `equipe_id` arbitrários do navegador; atribuição será derivada do prospect autenticado e validada no servidor.
- A UI seguirá componentes/tokens já usados no produto e a especificação UX/UI consultada; nenhuma dependência nova.
- Acesso a contatos é dado pessoal: minimizar campos, aplicar RLS a tabela, histórico e views, registrar auditoria e não incluir dados de contato em logs desnecessários. Não adicionar política de retenção ou compartilhamento externo fora de documentação já aprovada.

## Arquivos esperados após aprovação

- Nova migration forward-safe e novo smoke test SQL para a entidade B2C, suas RPCs, grants, índices e RLS.
- Telas/consultas/mutações React para `/p/prospeccao` e aba B2C em `/admin/prospeccao`.
- Wizard Admin e fluxo Partner para seleção/preservação de atribuição e pré-preenchimento; combobox pesquisável para seleção Admin existente.
- Ajustes pontuais nas listas/detalhes de propostas Admin/Partner para apresentar a origem/vínculo.
- Testes de componentes/escopo e documentação em `docs/blueprint/02-roles-permissions.md`, `docs/blueprint/04-database-schema.md`, runbook e checklist de segurança.

## Critérios de aceite

1. Parceiro A não consegue ler, editar, mover ou converter prospects do Parceiro B, mesmo chamando REST/RPC diretamente.
2. Membro de equipe A só acessa registros da equipe de seu contexto; não consegue trocar `equipe_id` ou `partner_id` na requisição.
3. Dono do parceiro vê a carteira do parceiro; Admin com escopo atual vê globalmente; Jurídico continua bloqueado pela rota/guard e RPCs aplicáveis.
4. Criar, editar, mover e marcar perdido atualizam histórico/auditoria; conflito otimista não sobrescreve mudança concorrente.
5. Converter como parceiro, equipe ou Admin cria uma única proposta, vincula `proposta_id`, parceiro e equipe corretos e avança o prospect na mesma transação. Uma segunda conversão é recusada sem criar duplicata.
6. Dados básicos de contato chegam pré-preenchidos no wizard; CPF/CNPJ e demais dados continuam sendo solicitados somente nos passos existentes da proposta.
7. B2B continua funcional e separado; a conversão B2B mantém escolha manual do parceiro via busca acessível, sem confundir usuário interno responsável com parceiro.
8. As duas listas de propostas continuam respeitando o RLS existente e tornam visível o vínculo/origem para quem já tem acesso à proposta.
9. UX validada nas quatro superfícies em estados de carregamento, erro, vazio, busca sem resultado, responsividade e teclado.
10. Sessões AAL1 sem segundo fator não leem nem operam carteiras de Admin/parceiros que exigem 2FA; AAL2 autorizado funciona. Registros com soft delete e seu histórico não são legíveis via REST.

## Testes e validações

- Smoke SQL: matriz de papéis (parceiro, membro da mesma equipe, membro de outra equipe, outro parceiro, Admin full/limitado/comercial e Jurídico), AAL1 negado/AAL2 permitido, bypass por REST/RPC, soft delete, equipe pertencente a outro parceiro, conversão duplicada, transação de conversão, histórico e conflito de estado.
- Web: `cd app && npm run lint && npm run typecheck && npm run test && npm run build`.
- Revisão manual autenticada: quatro telas com usuários de escopos diferentes; validar também chamadas diretas e deep links.
- Revisão visual/responsiva do combobox e dos novos boards usando a especificação UX/UI; sem afirmar validação visual sem inspeção no navegador.
- Submeter o diff ao Revisor Mercurio Capital, conforme `AGENTS.md`.

## Rollout e rollback

- Implementação local apenas depois da aprovação do plano e do modelo acima.
- Migration aditiva com smoke test. Após o GO separado do dono em 2026-11-18, `20261118000001` foi aplicada no projeto Supabase de produção e o smoke fase 65 passou; a validação autenticada segue pendente.
- O GO cobriu somente a migration e sua validação. Não inclui commit, deploy Vercel/frontend, build/submissão mobile ou alteração de dados de negócio; cada uma exige GO separado conforme `docs/operacao/release-checklist.md`.
- Se houver falha antes da publicação, reverter o diff local. Após aplicação remota, qualquer correção será migration forward-fix; manter registros/histórico.

## Aprovação

Plano e modelo de dados aprovados pelo dono em 2026-11-18 para implementação local. Depois, o dono autorizou separadamente a aplicação da migration B2C em produção e o smoke remoto, concluídos em 2026-11-18. Deploy frontend, commit e release continuam fora do escopo.

## Implementação local e verificações

- Implementados a carteira B2C do parceiro/equipe, a aba global B2C no Admin, RPCs e RLS próprios, vínculo atômico à proposta e seletor pesquisável para o wizard Admin. A RLS aplica gate AAL2 conforme a política vigente, exclui soft-deleted e os vínculos da proposta levam de volta ao prospect correspondente com destaque.
- `cd app && npm run lint`: passou, 0 erros e 32 avisos preexistentes em arquivos do projeto.
- `cd app && npm run typecheck`: passou.
- `cd app && npm run test`: passou, 69 arquivos e 338 testes.
- `cd app && npm run build`: passou; Vite reportou chunks maiores que 500 kB, incluindo bundles existentes de 1.3 MB e 2.2 MB.
- `git diff --check`: passou.
- `supabase db push --local --dry-run`: listou somente `20261118000001_prospeccoes_clientes_b2c.sql`.
- Migration aplicada somente ao Postgres local; confirmação em `supabase_migrations.schema_migrations` para `20261118000001`.
- Smoke `supabase/smoke-tests/fase-65-prospeccoes-clientes-b2c.sql`: passou (`fase65_ok`), verificando RLS, grants, RPCs `security definer`, gates AAL2 e constraints estruturais.
- Preflight remoto confirmou o projeto `mercurio` (`bhagksfvszeogtjvjtpx`) em produção e uma única migration pendente. A CLI v2 não autenticou; o dry-run e a aplicação foram concluídos com CLI v3.2.0 usando o token da CLI e configuração temporária compatível, com Vault/seed/roles explicitamente fora da operação.
- Migration `20261118000001_prospeccoes_clientes_b2c.sql` aplicada em produção; o histórico remoto confirma a versão.
- Smoke fase 65 executado também em produção pela Management API e terminou sem erro. Consulta read-only confirmou `to_regclass('public.v_prospeccoes_clientes')` como presente.
- GET REST autenticado apenas com a chave pública anon retornou `HTTP 401 / 42501 permission denied for view`, em vez de 404; isso confirma que a view está no schema cache e permanece protegida para usuários não autenticados, conforme o grant restrito a `authenticated`.
- O Revisor Mercurio Capital fez a revisão read-only do código: **Approved with reservations**, sem findings Critical/High/Medium/Low. A ressalva restante é validar com sessões reais AAL1/AAL2 e os papéis Admin, parceiro e equipe antes de concluir o checklist.
- Não foram feitos commit, deploy do frontend ou release. Revisão visual/autenticada, teclado, deep links, escopo por papel, tentativas diretas por REST/RPC e conversões concorrentes/duplicadas continuam pendentes.
