# Publicação — resultados Serasa por proponente

Data: 28/10/2026. Estado: Publicada em produção em 29/10/2026 após GO do dono do produto e validação autenticada do preview.

## Objetivo

Publicar a visualização de consultas Serasa por proponente já implementada e compatível com a migration `20261028000003_serasa_resultados_por_proponente.sql`, já aplicada no projeto Supabase vinculado. A release contém duas Edge Functions e o bundle web relevante. Não inclui chamada Serasa real, habilitação de produto, backfill de aceite, alterações no banco, release Electron, tag, GitHub Release ou GitHub Actions.

## Documentação e referências lidas

- `AGENTS.md` fornecido pelo dono do produto nesta conversa.
- `docs/operacao/change-management.md` e `docs/operacao/release-checklist.md`.
- `prompts/2026-10-28-serasa-resultados-por-proponente.md`.
- `scripts/deploy-vercel-production.sh` e `app/package.json`.
- Documentação oficial previamente conferida: Serasa Relatório Avançado PF, Supabase Functions CLI e Vercel rollback.

## Código e ambiente inspecionados

- Frontend: `PropostaConsultas.tsx`, detalhes Admin/Partner e `ClienteProposta.tsx` (aceite usado pelo magic link).
- Backend: `consulta-executar`, `magic-link-consume` e normalizador compartilhado.
- Migration `20261028000003` aparece aplicada local/remoto pelo CLI; nenhuma migration pendente prevista.
- Produção atualmente usa `consulta-executar` v47 e `magic-link-consume` v40. Código remoto anterior foi baixado antes de qualquer publicação e seus SHA-256 estão abaixo.
- Vercel produção antes do rollout: `dpl_FAGnmr6Td8hM1XktsLNn9n2Hy8M2`; aliases `www.mercuriocapitalsa.com.br` e `mercuriocapitalsa.com.br`.
- Worktree tem mudanças alheias ao escopo; nenhuma publicação usará o diretório sujo integralmente.

## Decisões e suposições

- Edge primeiro, frontend depois: schema já está aplicado e o código Edge novo aceita o fluxo da UI nova. Se uma função falhar, abortar antes do Vercel.
- Publicar somente `consulta-executar` e `magic-link-consume`, sem `--prune` e sem desativar verificação JWT.
- O frontend será preparado em snapshot limpo baseado em `HEAD`, sobrepondo somente os cinco arquivos aprovados de UI. Excluir `app/vercel.json`, `app/package.json` e `app/package-lock.json` locais, imagens não relacionadas, `app/tmp/` e todo o restante do worktree.
- A conta Vercel mantém variáveis e configuração existentes; nenhum segredo será copiado para o cliente.
- Rollback Vercel: retornar ao deployment anterior registrado acima. Rollback Edge: redeploy do código anterior baixado, preservando JWT e sem alterar secrets. Não reverter a migration aditiva; preservar logs/aceites e corrigir para frente se necessário.

## Arquivos permitidos no artefato

Web:
- `app/src/components/PropostaConsultas.tsx`
- `app/src/pages/admin/Integracoes.tsx`
- `app/src/pages/admin/PropostaDetalhe.tsx`
- `app/src/pages/partner/PropostaDetalhe.tsx`
- `app/src/pages/public/ClienteProposta.tsx`

Supabase Functions:
- `supabase/functions/consulta-executar/**`
- `supabase/functions/magic-link-consume/**`
- `supabase/functions/_shared/serasa-reports.ts` (dependência chamada pela Edge)

Não publicar as mudanças em testes/mocks, migrations, smoke tests, documentação de auditoria não relacionada, `vercel.json`, metadados do package, imagens sem relação, scripts ou arquivos não listados. O plano/runbook não é parte do bundle web.

## Critérios de aceite

1. Lint, typecheck, testes focados e build local passam; diff do snapshot não contém arquivos alheios.
2. Preview web é válido e está compilado a partir do snapshot selecionado.
3. Edge Functions são publicadas com JWT verificado; implantação sem prune; versões ativas e logs de inicialização sem erros.
4. Vercel produção referencia o snapshot e mantém aliases; smoke visual/autenticado verifica abas Proponentes/Consultas para roles já permitidos sem fazer consulta real.
5. Nenhum backfill, ativação de produção ou consulta Serasa é acionado.
6. IDs de deployment, versões Edge, smoke e eventual rollback são registrados aqui.

## Segurança e impacto

- Navegador recebe somente resumos normalizados permitidos; documentos e credenciais permanecem server-side.
- RLS, role, vínculo proposta/proponente, JWT e cota diária existente permanecem obrigatórios.
- Web e duas Edge Functions afetadas. Banco, mobile, Electron, updater, GitHub e demais integrações não afetados.
- Dados Serasa reais não serão usados em validação automatizada ou smoke.

## Verificações e passos manuais

- Executar `npm run lint`, `npm run typecheck`, testes Serasa e telas relevantes, `npm run build` em `app/`; `git diff --check`.
- Revisar visualmente preview: proposta com um e vários proponentes, estados sem consulta e consulta histórica. Confirmar role partner limitada às propostas próprias/elegíveis e Admin conforme papel existente.
- Pós-deploy, abrir detalhes da proposta e confirmar resultado histórico exibido sob o titular apenas quando houver vínculo; histórico legado sem vínculo deve permanecer sem titular inferido. Não clicar em Executar consulta.
- Verificar que formulário de aceite continua limitado à proposta e que não há ação de backfill acionada.

## Rollout e rollback

1. Salvar os deployments atuais e funções anteriores (código e hashes); confirmar migration em ambas as colunas Local/Remote.
2. Validar e criar preview do snapshot limpo. Falha em qualquer gate: abortar sem produção.
3. Publicar `consulta-executar`, depois `magic-link-consume`, ambos com configuração padrão de JWT. Falha: redeploy do snapshot anterior das Edge e abortar.
4. Publicar o snapshot web em produção. Falha funcional: `vercel rollback dpl_FAGnmr6Td8hM1XktsLNn9n2Hy8M2`; manter Edge nova por compatibilidade e, se regressão atingir clientes existentes, restaurar Edge anterior. Não remover colunas/tabelas nem apagar dados.
5. Confirmar domínio, versão do bundle e smoke. Registrar evidência e limitar qualquer investigação a logs sanitizados.

Hashes SHA-256 do código Edge remoto anterior, baixado antes da publicação:
- `consulta-executar`: `f5608c3c4d286c8c6b3a7f168a42003ca84c76065043c843040b3ceca98c092c`
- `magic-link-consume`: `9927cda5c8c5b03fee087f5eb55e47dc77212a1c53af15b9aa6fb8e4fb9cb9d1`

## Aprovação

O dono do produto pediu seguir com a publicação e rollback seguro em 28/10/2026. Este GO cobre somente os artefatos e limites listados neste plano. O GO não abrange consultas Serasa, backfill, ativação de produto, migration adicional nem release desktop.

## Pré-publicação e bloqueio identificado — 28/10/2026

- Lint aprovado: zero erros, 33 warnings preexistentes.
- Typecheck e build aprovados. O build reporta bundles acima de 500 KB.
- Testes focados das telas: 5/5; normalizador Serasa: 6/6.
- Primeira execução integral teve 2 timeouts por concorrência (173/175); repetição com `--maxWorkers 2 --testTimeout 30000` passou: 45 arquivos, 175 testes.
- `git diff --check` aprovado.
- Snapshot Vercel isolado criado a partir de `HEAD`, cinco arquivos de UI sobrepostos, sem arquivos de trabalho alheios. Preview `dpl_4MhPFpMwfduSoN8FsEv7bT4DVbhd`, URL `https://mercurio-digital-128aoxq97-bonacciniwds-projects.vercel.app`, estado READY. Nenhum domínio de produção foi promovido.
- Audit remoto do build reportou 16 vulnerabilidades no grafo completo (7 moderate, 6 high, 3 critical). `npm audit --omit=dev` encontrou um Critical (`dompurify` 3.4.14, dependência transitiva de `posthog-js`) e dois Moderate (React Router, que exigiria major para corrigir). O dry-run de `npm audit fix` propõe correções sem major para todos os High/Critical, inclusive `dompurify` 3.4.17; não alterou package-lock nem package.json. Não se aplicou correção.
- Plano de remediação aprovado e aplicado: `npm audit fix` sem `--force` atualizou o lockfile; audit posterior ficou em 0 High/0 Critical e 2 Moderate (React Router, fix npm exigiria major). `npm audit --omit=dev` também sem High/Critical. Lockfile validado com lint, typecheck, suite completa (45 arquivos/175 testes), build, teste Serasa (6/6) e `git diff --check`.
- Preview atualizado `dpl_6QdWUSK4Tou8pABdoiKErY93jy7x`, URL `https://mercurio-digital-gwhi2z22g-bonacciniwds-projects.vercel.app`, READY; build remoto reportou somente 2 Moderate. `vercel curl` recebeu HTML 200.
- À época, o browser isolado foi redirecionado à proteção de Deployment do Vercel; aguardamos validação do dono no preview autenticado antes de publicar.
- SHA-256 remoto anterior e rollback Vercel permanecem registrados acima. O preview READY pode ser mantido; não é produção.

## Publicação e validação — 29/10/2026

- O dono confirmou que a captura do resultado da consulta foi feita no preview. O modal mostrou consulta Serasa PF concluída, identificação retornada, score ausente neste produto e zero registros negativos; nenhuma nova consulta foi iniciada pelo agente.
- Edge `consulta-executar` publicada como v48, SHA-256 `9e05647470ebfc228cfa04d1d65c8798d1733c03d136317bb11ed579192e2a1d`, `verify_jwt=true`.
- Edge `magic-link-consume` publicada como v41, SHA-256 `e2634ef85bedfddd663f920a77367f24c3330df151f9d7375bc166a11dfa9479`, `verify_jwt=false` conforme configuração existente deste endpoint público de magic link.
- Frontend publicado de snapshot isolado derivado de `HEAD`, com os cinco arquivos Serasa aprovados e o lockfile corrigido; metadados e demais alterações locais foram excluídos. Build Vercel `READY`.
- Deployment atual: `dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN`, URL `https://mercurio-digital-8zomq5jqn-bonacciniwds-projects.vercel.app`.
- Aliases confirmados no deployment: `www.mercuriocapitalsa.com.br` e `mercuriocapitalsa.com.br` (este redireciona para www). HTTP: www 200; raiz 308 para www. Bundle público contém `consulta_autorizacao_registrar_proponente` e o seletor de proponente.
- Rollback web: restaurar deployment anterior `dpl_FAGnmr6Td8hM1XktsLNn9n2Hy8M2`. Rollback Edge, se necessário: usar os snapshots remotos anteriores e hashes registrados no plano. A migration aditiva e os dados de auditoria permanecem intactos.
- Não houve migration adicional, backfill, ativação de produto, release Electron, tag, publicação GitHub, nem chamada Serasa pelo agente. Teste autenticado do dono no domínio de produção com resultado histórico ainda recomendado; não refazer consulta paga para esse smoke.
