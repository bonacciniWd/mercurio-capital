# Plano — Prospecção: Kanban, notas visíveis, prints e padronização de UI

**Data:** 2026-11-18

**Status:** GO explícito do dono em 2026-11-18 para migration, deploy e commit/push. Publicação concluída em produção; smokes e push confirmados, Actions desativados.

## Objetivo

Completar a experiência web de `/p/prospeccao` e da aba B2C em `/admin/prospeccao`: arrastar cards entre etapas, cards mais largos, notas acessíveis e upload de prints. Ajustar também a apresentação do funil B2B administrativo, reutilizando o Kanban e os tokens existentes.

O screenshot enviado mostra o estado inicial com cinco colunas comprimidas. O padrão funcional de referência solicitado pelo dono é o Kanban existente. A especificação visual e o modelo abaixo foram aprovados antes da implementação.

## Documentos, agentes e skills consultados

- `AGENTS.md`, `docs/README.md` e `docs/operacao/change-management.md`.
- `docs/12-finalizacao.md`, `docs/09-roadmap.md`, runbooks §§20–22, `docs/handoffs/22-handoff-observacoes-kanban.md`.
- `docs/blueprint/02-roles-permissions.md`, `04-database-schema.md`, `08-security-compliance.md` e `docs/design/05-visual-map.md`.
- Planos `2026-11-12-funil-prospeccao-parceiros.md`, `2026-11-18-prospeccao-clientes-b2c-parceiro-propostas.md` e `2026-11-18-correcao-frontend-kanban-push-ui.md`.
- `.github/agents/ux-ui-mercurio-capital.agent.md`: especificação incremental read-only concluída pelo UX/UI, conforme AGENTS. Confirmação: usar o campo existente em uma aba **Notas**, com preview/atalho no card, abas e rodapé fixos no detalhe e rascunho preservado ao trocar abas. O UX recomenda largura B2C mínima de 22rem; a medida proposta neste plano é 24rem, acima desse mínimo. B2B preserva 38rem e sua altura mínima atual.
- `.github/agents/revisor-mercurio-capital.agent.md`: revisão read-only obrigatória após a implementação.
- Nenhuma skill adicional ou nova biblioteca necessária; usar os pacotes instalados, incluindo `@dnd-kit/core`.

## Código inspecionado

- `app/src/components/ProspeccaoClientesBoard.tsx`: grid de cinco colunas, edição em modal, notas apenas no formulário, sem DnD/upload/detalhe consultável para convertidos.
- `ProspeccaoKanban.tsx`: DnD, movimento otimista com rollback, menu via portal, scroll horizontal sincronizado, expansão, largura atual B2B de **38rem**, cards com indicadores condicionais de notas/anexos.
- `ProspeccaoDetalheModal.tsx`: dados, notas, prints e histórico em seções longas; uploads B2B funcionais, sem barra de abas.
- `PropostasKanban.tsx`, `SearchablePartnerSelect.tsx`, `ui/reason-dialog.tsx`: interação, overlay, foco, menu e componentes existentes.
- `app/src/pages/admin/Prospeccao.tsx`, `app/src/router.tsx`, layouts Admin/Partner.
- `app/src/hooks/useProspeccoesClientes.ts`, `useProspeccoes.ts`, `useProspeccaoAnexos.ts` e `app/src/lib/prospeccaoAnexo.ts`.
- Migrations `20261112000001_prospeccoes_parceiro.sql`, `20261112000003_prospeccao_anexos.sql`, `20261118000001_prospeccoes_clientes_b2c.sql`, referências de Storage em `20261111000003_proposta_observacoes.sql`.
- Testes `prospeccaoClientesBoard.test.tsx`, `prospeccaoKanban.test.tsx`, `prospeccaoConverter.test.tsx`, e configuração de testes/dependências em `app/`.

## Diagnóstico e decisões

1. B2C tem etapas e persistência, mas não implementou a interação completa do Kanban B2B. Arrastar precisa usar a mesma RPC de movimentação existente, mantendo a autorização no banco.
2. Prints B2C ainda não têm entidade nem políticas de Storage. Não é um problema solucionável apenas por UI; a nova persistência será separada do B2B.
3. O pedido permite comentários **ou** notas: esta entrega usa **Notas**, reaproveitando `notas` por prospect, sem criar chat ou timeline de comentários. Histórico continua sendo o histórico real de etapas.
4. A rota existente é `/admin/prospeccao` (singular), não `/admin/prospeccoes`; ajustar a tela existente, sem criar outra rota ou mudar links.
5. Preservar as alterações locais já feitas no B2B (colunas 38rem, expansão e menu via portal), os funis separados e suas regras de acesso. Não reduzir silenciosamente a largura B2B.
6. Migrations já aplicadas, incluindo `20261118000001`, são imutáveis. Prints B2C entram em migration nova.
7. O roadmap e handoff contêm estados históricos de staging/ativação. O contexto atual prevalece: Docker local para validação; único projeto Mercúrio de produção `bhagksfvszeogtjvjtpx`; sem criar staging.

## Especificação de interface para aprovação

### Kanban B2C — parceiro e aba Admin

- Trocar `xl:grid-cols-5` por colunas de **24rem (384px)** no desktop, espaçamento **1rem**, scroll horizontal; em telas estreitas, limitar cada coluna à largura útil da viewport. Cards ocupam a largura interna com padding 16px e tipografia/tokens atuais.
- A área do board acompanha a altura disponível da viewport, com rolagem vertical quando necessário e barra horizontal superior sincronizada como no Kanban existente. Não deixar as colunas terminarem na altura de um único card.
- Cabeçalhos de coluna no padrão atual do Kanban (slate/navy, título legível, contador, controle de expansão), mantendo cor de marca nos estados ativos e feedback de drop. Sem nova paleta, fontes ou métricas inventadas.
- Cabeçalho da página com título, descrição objetiva, busca e botão “Novo prospect”; ações no padrão `btn-no-liquid` e componentes existentes.
- Card: nome com até duas linhas; contatos legíveis, origem e atribuição quando aplicáveis; preview de até duas linhas das notas quando existirem.
- Rodapé **sempre visível** com ações textuais **Notas** e **Anexos**, contador de anexos real (inclusive zero), e menu **Mover para…** via portal fora do card. Não depender apenas de hover, ícone sem rótulo ou editar cadastro para descobrir essas ações.
- Clique no título/card abre o detalhe. Clique em Notas ou Anexos abre a aba correspondente diretamente, sem disparar arraste ou outro modal.
- “Criar proposta” permanece exclusivo de Qualificados e abre o wizard atual. Proposta criada oferece “Abrir proposta” e detalhe consultável.

### Arraste e alternativas

- Reutilizar `@dnd-kit/core`, sensor com distância de ativação de 6px, overlay e áreas de drop, conforme o Kanban existente.
- Arraste apenas nos cards ainda não convertidos; botões, links, formulários e menus não iniciam drag nem pan. Manter alternativa de movimentação acessível por menu para teclado e toque.
- Drop entre etapas permitidas usa `status_esperado` e atualização otimista com rollback/refetch em erro/conflito; falhas ficam visíveis e anunciadas. Bloquear movimentações sobrepostas do mesmo card.
- Drop em Perdidos abre o motivo obrigatório; cancelar não muda a etapa. Drop em Proposta criada é recusado: somente a conversão atômica pelo wizard cria esse vínculo. Cards já convertidos não podem ser arrastados para fora.
- Qualificados também mantém o menu de movimentação, além da ação de conversão.

### Detalhe B2C e B2B

- Painel amplo (até **64rem**, limitado à viewport), com título/status no topo, barra de abas fixa abaixo do cabeçalho e ações persistentes no rodapé. Corpo com scroll próprio; telas estreitas usam a largura disponível.
- Abas textuais **Dados**, **Notas**, **Anexos**, **Histórico**, sempre visíveis, inclusive vazias. Usar navegação acessível de tabs e scroll horizontal da barra se necessário.
- Preservar rascunhos ao trocar abas; salvar mostra estado pendente/sucesso/erro; fechar com rascunho pede descarte. Escape, foco inicial, focus trap e retorno ao botão de origem, sem conflitos com ReasonDialog.
- Notas B2C usam limite atual de 2000 caracteres; B2B mantém seu limite atual. Leitura e gravação mantêm as RPCs e regras existentes; não criar uma tabela de comentários nem novas notificações.
- Após conversão B2C, permitir consultar Dados/Notas/Anexos/Histórico; edição, mudança de etapa e novos uploads ficam desabilitados, coerentes com o bloqueio atual de edição. Anexos existentes continuam acessíveis a quem tem escopo.
- Anexos B2C: selecionar imagem, arrastar arquivo para a área de upload ou colar print quando a aba/área estiver focada. Paste somente nessa área; nunca interceptar clipboard global. Prévia/nome/tamanho, progresso, erro visível e nova tentativa; nunca informar sucesso antes da confirmação no servidor.
- Reutilizar no B2B as seções e hooks já existentes de notas/anexos/histórico, organizados nas abas. Adicionar atalhos textuais permanentes no rodapé dos cards B2B. Preservar backend e regras atuais do B2B.

### Página Admin

- Harmonizar título, toolbar e abas “Parceiros (B2B)” / “Clientes (B2C)” com tokens e espaçamentos já usados no produto; evitar cabeçalhos repetidos.
- Preservar filtros/ordenação/expansão/dimensões B2B já existentes, menu via portal, conversão atual e query parameters de abas/prospect.
- A aba B2C usa o mesmo componente e experiência do parceiro, com visão administrativa já autorizada.

## Modelo de dados aditivo — requer aprovação

### `public.prospeccoes_clientes_anexos`

- `id uuid` PK com `gen_random_uuid()`.
- `prospeccao_id uuid not null` FK para `prospeccoes_clientes`: um prospect tem zero a três prints ativos; cada anexo pertence a um único prospect.
- `bucket text not null` fixo e validado como `prospeccao-clientes-anexos`; `storage_path text not null` único por bucket, gerado no servidor com UUIDs, sem nome/contato do prospect no caminho.
- `nome text not null` (1–200 caracteres, sanitizado), `mime_type text not null`, `tamanho_bytes integer not null` (>0 e até 2097152).
- `estado text not null` limitado a `preparado`/`recebido`; `expira_em timestamptz` para reserva de upload de 24h.
- `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`; autor pela sessão, nunca livre no payload.
- RLS de leitura vinculada ao prospect **ativo** e acessível, com `app_can_operate()`, papel/partner/equipe conforme a carteira B2C. Cliente final, anônimo, Jurídico e carteiras/equipes alheias sem acesso. Nada de escrita direta da tabela pelo navegador.

### Bucket privado e RPCs

- Bucket **privado**, limite de 2MB por arquivo e tipos JPG/PNG/WEBP/HEIC, no mesmo limite do B2B. Máximo **3 prints por prospect**, contado no servidor e incluindo reservas ativas para evitar ultrapassagem concorrente.
- RPCs dedicadas de preparar, confirmar e cancelar upload ainda não confirmado. Listagem/contagem podem usar leitura com RLS como no padrão atual. Guards por sessão/escopo e 2FA quando exigido; auditar metadados/eventos sem conteúdo de nota/print.
- Preparar bloqueia a linha do prospect e valida estado não convertido, contato ativo, quota, extensão/MIME/tamanho; cria reserva e path. Upload só do autor da reserva não expirada, usando `upsert:false`.
- Confirmar revalida autorização atual, prospect ativo/não convertido, quota e objeto correspondente no Storage, incluindo metadados de tamanho/MIME. Repetição não duplica vínculo.
- Cancelar atua só na reserva pendente do autor autorizado; não apagar evidência já recebida. Expiradas não bloqueiam a quota; cancelar/remover rascunho não remove anexos recebidos.
- Leitura por URLs assinadas com TTL máximo de **300s**, autorizadas pelas RLS de metadados e Storage. Confirmar que políticas genéricas permissivas não liberam este bucket; aplicar restrição limitada ao bucket novo, sem alterar acesso aos demais.
- Bloquear overwrite/update/delete direto dos objetos recebidos. Nenhum bucket público, path livre ou segredo no cliente. Sem ampliar grants para `anon`.
- Não criar purge automático ou novo job neste lote; retenção acompanha a prospecção. Eventual limpeza de reservas expiradas é operacional, não exclusão de anexos recebidos.

### Compatibilidade

- `prospeccoes_clientes`, `notas`, histórico e vínculo da proposta permanecem íntegros. Não mover prints B2B para a tabela nova nem copiar prints automaticamente para documentos de proposta.
- A migration é aditiva; frontend comunica indisponibilidade de anexos se ainda não publicada, evitando falso estado vazio ou upload aparentemente concluído.

## Arquivos esperados

- `app/src/components/ProspeccaoClientesBoard.tsx`, novo `ProspeccaoClienteDetalheModal.tsx` e componentes pequenos reaproveitáveis de tabs/anexos se necessário.
- `app/src/components/ProspeccaoKanban.tsx`, `ProspeccaoDetalheModal.tsx`, `app/src/pages/admin/Prospeccao.tsx` (UI B2B, sem alterações de autorização).
- `app/src/hooks/useProspeccoesClientes.ts`, novo hook de anexos B2C e lib de validação/upload B2C reaproveitando validação de imagens existente quando apropriado.
- Nova migration `supabase/migrations/20261118000002_prospeccoes_clientes_anexos.sql` e smoke `supabase/smoke-tests/fase-66-prospeccoes-clientes-anexos.sql` (ajustar numeração se ocupada antes de implementar).
- Testes de board, modal, tabs, upload/erros/conflitos e regressão B2B; documentação do modelo/RBAC/runbook/checklist e este plano.
- Sem nova Edge Function, dependência, alteração mobile ou build desktop.

## Segurança e testes de aceite

1. Arrastar card B2C e recarregar preserva etapa; conflito ou falha não deixa estado visual incorreto. Perdido exige motivo; Proposta criada só via conversão; overlays não escondem menus.
2. Cards B2C não ficam comprimidos em cinco colunas; busca, expansão e scroll funcionam em viewport desktop e estreita. B2B mantém 38rem e seus controles atuais.
3. Card sempre oferece Notas e Anexos; clicar abre aba correta, inclusive vazia. Texto de notas persiste após salvar/reabrir e não se perde ao alternar tabs.
4. Selecionar, soltar ou colar print autorizado gera um único anexo recebido; erro de upload/confirmar permite retry sem sucesso falso. Prévia/abertura usa URL curta privada.
5. Rejeitar imagem >2MB, formato inválido, quarto print, reserva expirada, path/objeto alheio, confirmação sem upload, usuário anônimo, perfil sem acesso e sessão sem 2FA exigido.
6. SQL transacional no Docker com identidades de teste locais: dois parceiros/equipes distintas, Admin full/limitado/comercial/jurídico, AAL1/AAL2, leituras REST/RPC e Storage cruzadas. Não criar dados de negócio em produção para testar. Novas identidades de teste apenas locais, descartáveis e identificadas como testes, não dados de produto.
7. Smoke estrutural e testes de comportamento SQL (quota/reserva/confirmação/rollback e autorização), além da regressão fase 65. Registrar limites: mocks unitários não equivalem a upload real pelo navegador.
8. `cd app && npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`; `git diff --check`. Não repetir checks sem mudança ou motivo.
9. Teste manual autenticado no navegador: fluxo feliz, vazio, erro, input inválido, teclado, mobile web responsivo, arraste sem clique acidental, foco ao fechar e menus nas bordas. Não declarar aprovação visual sem execução.
10. Revisor Mercurio Capital read-only após implementação; Critical/High bloqueiam publicação.

## Rollout, impacto e rollback

- Web: nova experiência B2C e padronização UI B2B. Banco/Storage: nova entidade restrita de prints B2C. Autorização existente permanece referência obrigatória.
- Mobile nativo, Electron/updater, notificações, integrações e demais telas: fora desta mudança.
- Após aprovação, implementar e validar no Docker local sem resetar banco nem alterar outras stacks. Banco de produção já contém `20261118000001`; não editar essa migration.
- GO desta implementação não inclui aplicar `20261118000002` em produção, deploy de frontend, commit/push, tag, release ou builds. Preparar evidências; obter GO separado para publicação conforme AGENTS §12.
- Publicação futura: migration aditiva e smoke, depois frontend; sem migração destrutiva de registros existentes. Se houver falha no frontend, reverter a UI preservando os anexos já gravados; banco publicado recebe forward-fix.
- Preservar os demais arquivos modificados/não rastreados da árvore de trabalho.

## Implementação e evidências locais — 2026-11-18

- B2C: colunas 384px, cabeçalhos no padrão do Kanban, scroll horizontal sincronizado, expansão, ordenação, busca, DnD com overlay e alternativa por menu via portal. Movimento serializado com estado esperado, atualização otimista e rollback em erro. Perdidos exige motivo; Proposta criada permanece exclusiva do wizard.
- Detalhe B2C e B2B: abas acessíveis e persistentes, atalhos Notas/Anexos no card, preview de nota, proteção de rascunho, focus trap e feedback. B2B preserva colunas 608px, backend e upload existentes. Corrigidos na inspeção renderizada: padding do título B2C, organização vertical da miniatura e cor de backdrop usando token existente (`slate-950/50`; `silver-950` não existe na configuração).
- Anexos B2C: reserva, upload privado e confirmação idempotente, retry com mesma reserva, cancelamento de pendentes, URLs assinadas 300s, paste/drop focados, erros visíveis. Sem nova dependência ou Edge.
- Migration `20261118000002` aplicada apenas no Docker, após dry-run que listou somente essa migration. Migration anterior permaneceu intacta. Smokes fases 65 e 66 executados com `ON_ERROR_STOP=1`: ambos passaram e encerraram em `ROLLBACK`.
- Revisão inicial de segurança identificou uma corrida upload/cancelamento. Corrigida antes da aplicação local por bloqueios `prospect → reserva`, inclusive nas policies de upload/delete. O runner `supabase/smoke-tests/fase-66-prospeccoes-clientes-anexos-concorrencia.mjs` confirmou em sessões simultâneas: cancelamento aguarda upload e recusa remover vínculo com objeto presente; delete aguarda confirmação e remove zero objetos recebidos; duas reservas concorrentes preservam quota final de três. Fixtures descartáveis removidas em `finally`.
- Testes direcionados finais: **37/37**, cinco arquivos (`prospeccaoClientesBoard`, `prospeccaoKanban`, `prospeccaoConverter`, `prospeccaoClienteAnexo`, `prospeccaoClientesMove`). Incluem conflito/rollback real do cache, notas/rascunhos, consulta de convertidos, upload/retry/confirmação, rejeições e signed URL. Log: `/tmp/mercurio-f66-target.log`.
- Lint completo: exit 0, **0 erros / 32 warnings**, nenhum warning nos arquivos desta entrega; lint direcionado final exit 0, sem warnings. Typecheck: exit 0. Build final após os últimos ajustes visuais e teste novo: exit 0 (`tsc -b && vite build`), build Vite em 8,54s; avisos de chunks >500kB e tempo de callbacks, sem falhas. Log: `/tmp/mercurio-f66-build-final.log`.
- Suíte completa inicial: **347/352 testes**, 65/70 arquivos. Cinco falhas em `adminAprovacoes`, `adminLeadsSimulacoes`, `dateRangePicker`, `partnerPropostaDetalhe`, `publicAmortizationSimulator`, com timeouts de teste/hook e espera de heading. **Rechecagem dos cinco arquivos com `--maxWorkers=1`: 25/25 passou**, sem alterar essas telas/testes. Log: `/tmp/mercurio-f66-recheck.log`. Não houve segunda execução da suíte completa; manter essa distinção ao reportar.
- `git diff --check`: exit 0. Consulta de resíduos: zero usuários `f66-browser-*`, `f66-race-*` e `smoke-f66-*` no Docker após cleanup/rollback.

### Navegador autenticado no Docker

Execução com Chromium real/Playwright do runtime (sem instalar dependência no projeto), frontend temporário em `http://127.0.0.1:5187`, backend `http://127.0.0.1:54321`. Identidade sintética `@test.invalid`, TOTP/AAL2 real, dados identificados como teste. Requisições para projetos `*.supabase.co` bloqueadas no contexto de teste. Nenhuma credencial registrada nas evidências.

**Passou:** arrastar de Novos para Em contato e recarregar; confirmar persistência pelo banco e ausência de modal acidental; largura real 384px; abrir Notas, alternar abas e salvar texto real; rejeitar imagem >2MB e remover rascunho; enviar PNG via Storage real, confirmar estado `recebido` e miniatura com signed URL; consultar histórico; mover via menu na etapa expandida; modal em viewport 390×844; Admin B2B com atalho Notas/abas; zero exceções JavaScript. Fixtures removidas e consulta final encontrou zero identidades de teste F66.

Screenshots locais inspecionados visualmente:

- `/tmp/mercurio-f66-evidence/01-partner-board.png` — 1440×1000, quadro B2C.
- `/tmp/mercurio-f66-evidence/02-private-print.png` — upload e miniatura privada.
- `/tmp/mercurio-f66-evidence/03-mobile-notes.png` — detalhe em 390×844. A navegação lateral do layout Partner é preexistente e não foi redesenhada neste lote.
- `/tmp/mercurio-f66-evidence/04-admin-b2b.png` — colunas 608px preservadas.
- `/tmp/mercurio-f66-evidence/05-b2b-tabs.png` — detalhe B2B na aba Notas.

Limites: aprovação visual do dono sobre o resultado final continua distinta da inspeção técnica; não executado em Safari/toque físico. Paste/drop de arquivo têm implementação local, mas a execução autenticada descrita usou seleção de arquivo. Produção, commit/push e deploy não foram executados. Servidor temporário 5187 encerrado após a validação; o serviço preexistente em 5173 foi preservado.

### Revisão independente final

Revisor Mercurio Capital (`/root/review_frontend_ui`), read-only: **nenhum achado Critical/High ou bloqueio técnico** no escopo. Parecer `Approved with reservations`: reservas iniciais sobre os cinco timeouts e navegador foram resolvidas pelas evidências acima; a última ressalva era confirmar o build final, posteriormente concluído com exit 0. O parecer exclui explicitamente `pushWeb` e layout de Kanban de propostas, pertencentes a outra frente. Aprovação visual do dono e autorização de publicação continuam pendentes; nenhuma produção foi alterada neste lote.

## GO e publicação — 2026-11-18

O dono autorizou explicitamente: **“Go para migration e deploy aprovados, não esqueca do commit no github”**. Isso autoriza a migration aditiva de prints, o frontend de prospecção aprovado (incluindo o B2C/wizard pesquisável que é sua dependência) e commit/push. Sem tag, GitHub Release, build desktop ou EAS. O registro NO-GO acima descreve a etapa local anterior.

- Projeto Supabase confirmado: `mercurio`, produção `bhagksfvszeogtjvjtpx`. Consulta prévia encontrou B2C presente e anexos ainda ausentes.
- CLI v3.2.0 em contexto temporário mínimo; dry-run remoto com `--skip-vault` listou **somente `20261118000002_prospeccoes_clientes_anexos.sql`**, nenhum seed/role. Não aplicar nem alterar outras migrations.
- Smoke adicional `fase-66-prospeccoes-clientes-anexos-estrutura.sql`: somente definições/grants/bucket/policies, sem fixtures ou alteração de dados; passou no Docker antes da execução remota. O smoke transacional com identidades sintéticas continua exclusivo do Docker.
- GitHub: `CI` e `Desktop Release` confirmados `disabled_manually` antes de qualquer push. CI local substitui Actions conforme restrição vigente do dono.
- Vercel: projeto `mercurio-digital` (`prj_dbwzPMi5knj8f7E0WAnlq1qbh9oO`), Root Directory `app`; rollback disponível para `dpl_5hVDNj6KUNWcWwwXrVZo2NGhyv79`, produção anterior em `mercurio-digital-r64xtmewv-bonacciniwds-projects.vercel.app`.
- Candidato Git/deploy: allowlist de arquivos de prospecção, seus testes/docs e migrations 00001/00002. Preservar fora do commit mobile, screenshots, config local MFA, push/expurgo e outros trabalhos. Em docs compartilhados, incluir apenas seções B2C.
- Ordem autorizada: aplicar 00002 → smoke estrutural/grants remoto → commit e candidato limpo → deploy Vercel e checks HTTP/assets → push GitHub e registro das evidências. Sem dados sintéticos em produção.
- Rollback: restaurar deployment Vercel anterior; manter bucket/tabela e anexos recebidos; correções de banco por nova migration forward-safe.

### Banco de produção — concluído

- CLI v3.2.0 aplicou somente `20261118000002` no projeto aprovado; sem Vault, seed ou roles. SHA-256 do SQL aplicado: `97b6ac9e096e4fc18ee03ac888174ee8cc7a462357e043d757066efdb31eb013`.
- Histórico remoto confirmou `20261118000001` e `20261118000002`.
- Smoke estrutural remoto: `fase66_estrutura_ok`, `rls=true`, `bucket_publico=false`. Smoke fase 65 reexecutado em transação read-only sem erro. Nenhum usuário/registro/print de teste foi criado em produção.
- Leitura efetiva de privilégios: preparar/confirmar/cancelar com `anon=false`, `authenticated=true`. Checks de papel/AAL/carteira continuam dentro das RPCs e RLS.
- A CLI recusa `BEGIN/DO` no filtro sintático `--read-only`; os arquivos foram executados com `--yes` e **transação SQL `BEGIN READ ONLY`**, preservando o limite de leitura no banco. As primeiras tentativas de leitura não executaram SQL por validação de caminho/parser; nenhuma mutation adicional ocorreu.

### Candidato Git/Vercel

- Commit local de implementação: `98fd6e8f84c98b8a8b4cac59717ef3b12c4fdf9e`, 37 arquivos da allowlist. Documentos compartilhados foram stageados parcialmente, preservando fora do commit as alterações de push/expurgo/SMTP.
- Worktree temporário limpo a partir do commit, sem envs ou secrets locais; todos os arquivos `app/` rastreados conferidos byte a byte com a árvore validada. `validate:release` e build do candidato passaram (Vite 4,22s); nenhum build nativo.
- Deploy manual submetido à Vercel com metadado do SHA aprovado: `dpl_DtRd7EvZyb4CB59AVTsxFgqMVZfc`, URL `https://mercurio-digital-huaw9qfht-bonacciniwds-projects.vercel.app`. Aguardar Ready e smoke antes de registrar conclusão.

### Publicação concluída

- Deployment `dpl_DtRd7EvZyb4CB59AVTsxFgqMVZfc` **Ready**, target production, build remoto 2m33s; alias `https://mercuriocapitalsa.com.br` e demais aliases preservados. Código do commit `98fd6e8f84c98b8a8b4cac59717ef3b12c4fdf9e`.
- Smoke HTTP: `/`, `/p/prospeccao`, `/admin/prospeccao?aba=b2c`, `/admin/propostas`, `/p/propostas` responderam 200. Bundles `/assets/Prospeccao-h-pnRwxO.js`, `/assets/index--jQExEwk.js` e `/assets/index-C3V6bcv0.css` responderam 200; marcadores de prints/RPCs e CSS 24rem conferidos nos chunks de rota e compartilhados. Configuração pública aponta para o projeto Supabase correto. `www/p/prospeccao` mantém 308 para o domínio canônico sem www.
- Smoke público no Chromium: guards de parceiro/Admin redirecionam respectivamente a `/p/login` e `/admin/login`; inputs renderizados, zero exceções JavaScript. Nenhuma sessão autenticada de produção nem fixture de negócio foi criada; o fluxo completo autenticado/upload já havia passado no Docker.
- Push `main` concluído no repositório `bonacciniWd/mercurio-capital` até o commit `98fd6e8`. GitHub API confirmou **zero Actions runs** para o SHA; workflows `CI` e `Desktop Release` desativados. O push também transportou os commits web/documentais anteriores já existentes na história local, sem incluir os demais arquivos da working tree.
- Ajustes locais de mobile, screenshots, config MFA, push/expurgo e seus documentos/migrations não foram incluídos. Sem tag, GitHub Release, build nativo ou alteração de artefatos de download.
- Rollback disponível: Vercel anterior `dpl_5hVDNj6KUNWcWwwXrVZo2NGhyv79`. Preservar bucket/tabela e anexos recebidos; forward-fix para banco.

### Observação de dependências preexistentes

O `npm install` remoto reportou 18 avisos no grafo completo. Auditoria read-only local `npm audit --omit=dev --json` identificou 4 High propagados por `@grpc/grpc-js@1.9.16 → @firebase/firestore@4.20.0/compat → firebase@13.3.0` e 2 Moderate de React Router. `app/package.json` e `app/package-lock.json` não mudaram neste lote.

Revisão pontual independente (`/root/review_frontend_ui`): **sem novo bloqueio para esta publicação web**, risco residual Low. Evidências: Vercel entrega site estático (`dist`), sem runtime servidor; fonte importa apenas `firebase/app` e `firebase/messaging`; service worker usa app/messaging compat; artefatos contêm nomes do registro de componentes, mas não implementação Firestore/gRPC. Os avisos do grafo de instalação são reais e devem ser tratados numa frente de dependências, junto com a avaliação dos avisos Moderate, seguida de audit/build. Não executado `npm audit fix`, downgrade ou alteração automática de SDK.
