# Plano: alinhar o estado local ao GitHub sem regressão

## Objetivo

Reconciliar o código local aprovado com `origin/main`, preservando o estado atual, sem sobrescrever trabalho, aplicar migrations ou publicar um deploy antes de revisar e validar cada lote.

## Skills e documentos lidos

- `docs/operacao/change-management.md`
- `docs/operacao/release-checklist.md`
- `docs/operacao/runbooks.md`
- `.github/workflows/ci.yml`
- `.github/workflows/desktop-release.yml`
- `.vercelignore` e `app/.vercelignore`
- Instruções `AGENTS.md` fornecidas pelo responsável no contexto da tarefa.

## Código e estado inspecionados

- Git local e `origin/main`, após `git fetch --no-tags origin main`.
- `app/`, `mobile/`, `supabase/`, documentação e prompts pelo estado de trabalho.
- Build web local gerado em `/tmp/mercurio-local-build-compare`.
- Deployment Vercel atual por `vercel ls`, `vercel inspect`, `vercel project inspect` e resposta HTTP pública.
- Histórico remoto de migrations com `supabase migration list --linked`.

## Evidências atuais

- `origin/main` é ancestral de `HEAD`: local contém 11 commits ainda não enviados; remoto não contém commits exclusivos.
- A árvore de trabalho tem 283 entradas não consolidadas: 73 arquivos rastreados modificados/removidos e 210 entradas não rastreadas.
- O build local passou por `tsc -b` e Vite. O HTML de produção referencia hashes diferentes do build atual em 23 chunks de páginas; o CSS principal tem o mesmo hash. Isso demonstra divergência de artefatos, não identifica sozinho qual versão funcional é a desejada.
- As 126 migrations locais coincidem com as 126 entradas remotas. Nenhuma migration deve ser aplicada como parte deste plano.
- A Vercel está `Ready`, com domínio de produção associado. O projeto usa `app` como Root Directory e Node 24.x.
- A credencial Serasa de produção chegou, segundo o responsável. Seu valor não deve entrar em arquivos, Git, bundles ou logs; configuração/teste da integração será tratado em etapa separada.

## Decisões e suposições

- Preservar `HEAD`, os 283 itens locais, `app/dist`, produção Vercel e banco remoto como referências; não executar reset, clean, rebase, cherry-pick ou deploy durante a auditoria.
- Separar os 11 commits já criados das alterações não commitadas. Não usar `git add -A` nem criar um commit monolítico.
- Agrupar o trabalho local por frente e por aprovação anterior; verificar cada grupo contra produção e contra o código-base do GitHub antes de promovê-lo.
- O workflow CI roda em todo push para `main`; verificar o resultado antes de considerar o GitHub alinhado.
- A publicação na Vercel é um gate independente. Primeiro verificar se o projeto está ligado ao GitHub e se push aciona deploy automático. Não publicar pela Vercel sem autorização específica.
- Credenciais Serasa ficam somente no gerenciador seguro de secrets aprovado; não serão usadas nesta reconciliação.

## Arquivos esperados

- Este plano em `prompts/2026-10-26-alinhar-local-github-sem-regressao.md`.
- Após aprovação, somente arquivos pertencentes aos lotes explicitamente selecionados, seus testes e documentação correspondente.
- Nenhuma migration nova é esperada neste plano, salvo descoberta documentada e aprovação adicional.

## Lotes para revisão após aprovação

1. **Histórico já commitado:** revisar os 11 commits locais (classificação operacional, relatórios, consultas e documentação); confirmar que cada mudança continua aprovada e compatível com CI antes de propor fast-forward de `main`.
2. **Web pública:** landing, crédito para construção, simuladores, protocolo/recaptcha e autenticação pública.
3. **Admin e propostas:** propostas/detalhes, aprovações, rede, leads/simulações, relatórios e configurações.
4. **Partner:** onboarding, equipe, propostas/detalhes, milestones, simulações/PDF e Universidade.
5. **Backend e mobile:** functions, configuração, migrations, smoke tests e telas mobile; só promover partes com aprovação e estado remoto verificados.
6. **Dependências/arquivos auxiliares:** tratar separadamente; excluir artefatos temporários, segredos e arquivos sem origem/aprovação confirmada.

## Requisitos e critérios de aceite

- Nenhum arquivo local existente é perdido ou substituído silenciosamente.
- Cada arquivo promovido tem origem, frente, aprovação e destino registrados.
- Nenhum segredo aparece no diff, commit, log ou bundle de cliente.
- Diff de cada lote é revisado contra `origin/main`; nenhuma alteração de outra frente é incluída incidentalmente.
- Lint, typecheck, testes e build aplicáveis passam; a CI do GitHub fica verde para o commit candidato.
- Estado remoto do Supabase continua sem migrations pendentes; nenhuma escrita remota é feita.
- Produção Vercel continua como baseline até comparação funcional do lote e autorização separada de deploy.
- Fluxos aprovados de propostas, partner/admin, milestones, consulta de protocolo e simulador são verificados antes de qualquer promoção que os toque.

## Segurança

- Não copiar credenciais Serasa para `.env` versionado, documentação ou código frontend.
- Revisar arquivos não rastreados e `app/tmp/` antes de qualquer staging; nunca adicionar tudo em lote.
- Confirmar RLS/autorização de mudanças Supabase server-side sem executar consulta que exponha dados pessoais.
- Manter migrations publicadas imutáveis e não executar `db push` neste escopo.

## Verificações

### Automáticas

- `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build` em `app/`, além da validação de release exigida pela CI.
- `git diff --check` e revisão do diff staged por lote.
- Confirmar migrations locais/remotas por CLI sem aplicar alterações.
- Confirmar deployment Vercel e hashes dos artefatos após eventual deploy autorizado.

### Manuais

- Comparar contra produção os fluxos afetados pelos arquivos do lote: login/role, lista e detalhe de propostas, área de partner, consulta de protocolo e simulador conforme aplicável.
- Verificar estados de erro, vazio e autorização, sem criar registros de teste em produção.

## Rollout e rollback

- Primeiro reconciliar GitHub por fast-forward somente para commits aprovados e testados; observar a CI.
- Promover alterações não commitadas em commits pequenos por frente, após aprovação do diff correspondente.
- Deploy Vercel e alterações de Supabase permanecem gates independentes, com plano de rollback próprio e GO específico.
- Se CI ou smoke falhar, não promover o lote seguinte; manter produção intacta e corrigir em novo diff revisável.

## Resultado da revisão do lote 1 — somente leitura

- `origin/main` é ancestral de `HEAD`: são 11 commits locais à frente e zero commits exclusivos no remoto. Os commits não apresentam conflito de ancestralidade; o `git diff --check` do intervalo passou.
- No worktree temporário em `HEAD`, `npm run validate:release`, `npm run typecheck`, `npm test -- --run` (21 arquivos, 75 testes) e `npm run build` passaram. `npm run lint` teve zero erros e 38 avisos.
- `npm ci` registrou 17 vulnerabilidades (7 moderate, 7 high, 3 critical). Nenhuma dependência foi alterada.
- A CI atual do GitHub usa Node 20, enquanto `app/package.json` declara `>=22.12.0`. A execução mais recente no GitHub reporta falha, mas o job terminou sem runner e sem steps; isso não fornece resultado sobre o código. A compatibilidade da CI precisa ser resolvida/validada antes de usar verde da CI como gate.
- A implementação do classificador mantém `classificador_ativo=false` por padrão e protege as RPCs com `app_is_admin_operacional()`. Porém, a classificação não consulta resultados Serasa/Bacen apesar de os documentos listarem consultas autorizadas entre os dados possíveis. Se ativada, pode atribuir confiança alta e distribuir sem esses resultados. Manter desativada até alinhar implementação e contrato operacional; as credenciais Serasa recém-recebidas não foram usadas.
- O relatório usa `admin_dashboard_analytics` para a série e também carrega propostas para agregações no cliente com limite de 20.000. A série pode vir em granularidade diária/semanal/mensal, mas o componente apenas troca os rótulos para mês e não agrega períodos repetidos. Revisar os intervalos customizados e agregações antes de aceitar esse bloco.
- O deployment Vercel atual está `Ready`; o `inspect` não expôs o commit-fonte. Seus hashes de entrada/módulos diferem do build atual. Não afirmar que GitHub seja a única origem da diferença nem publicar o worktree inteiro sem comparar lote por lote.
- `supabase migration list --linked` mostrou 126 versões locais e remotas coincidentes; nenhuma migration está pendente e nenhuma foi aplicada nesta revisão.
- Nenhum código foi alterado, enviado ao GitHub, publicado na Vercel ou escrito no banco durante esta revisão.

## Atualização do responsável e gate de sincronização

- O responsável confirma que a experiência atualmente servida pela Vercel atende às necessidades; ela passa a ser a referência funcional aprovada para esta reconciliação. Não redesenhar nem corrigir comportamento de produto neste escopo.
- Evidência do GitHub: o commit atual de `origin/main` possui status/deployment Vercel no ambiente `Production`. Portanto, atualizar `main` por push aciona o deployment de produção. O checklist `docs/operacao/change-management.md` exige gate separado para publicação.
- O `HEAD` local contém 11 commits ainda fora do GitHub; o restante do frontend aprovado está em alterações locais não commitadas. Enviar somente os 11 commits pode compilar uma árvore diferente do working tree que o responsável considera alinhado à Vercel.
- O responsável perguntou sobre rollback e aprovou explicitamente o push para `main` ciente do deployment automático. Em caso de regressão funcional após o deployment, reverter o commit de sincronização e confirmar o novo deployment de rollback; não executar rollback de banco, pois nenhuma migration será aplicada nesta operação.

## Preparação final do candidato

- Escopo committed: 291 arquivos de produto/documentação aprovados em web, mobile, Supabase, collections Serasa fornecidas pelo responsável, prompts e documentação operacional; o push não executa `supabase db push` nem publica Edge Functions.
- Excluídos do candidato público: arquivo local gerado pela Vercel (`-`), `.env` ignorados, script temporário de login UAT em `app/tmp/`, planilhas operacionais, PDF interno e screenshots de `docs/operacao/assets/`. O script de smoke UAT descartável, o script de deploy manual e assets públicos sem referência no código (`01.png`, `02.png`, `03.png`, `recovery.jpg`) também ficaram fora. A alteração local de e-mail autoral em `app/package.json` ficou preservada fora do commit.
- A coleção Postman foi validada como JSON; a revisão não encontrou campos de credencial preenchidos. Padrões genéricos de CPF/telefone encontrados em conteúdo de testes e código foram revisados como falsos positivos/sintéticos; nenhum valor foi reproduzido neste plano.
- A CI foi alinhada ao Node 24 e ao limite de 15 s por teste. No estado candidato: `validate:release`, lint (0 erros, 33 avisos), typecheck, build e suíte (45 arquivos, 175 testes) passaram. Os 2 testes do reCAPTCHA e os 14 de leads foram reproduzidos isoladamente; a suíte completa passou após ajuste de timeout. O build mantém aviso existente de chunks maiores que 500 kB.
- `git diff --cached --check` passou. A listagem vinculada do Supabase continuou com migrations locais/remotas coincidentes; nenhuma escrita foi feita.
- Pendência pós-push: acompanhar CI, deployment da Vercel, domínio de produção e smoke das rotas afetadas. Se falhar ou divergir da baseline aceita, reverter a sincronização e confirmar a versão restaurada.
