# Plano — prontidão de produção da Política de Privacidade e rota CPC

**Status:** implementação isolada validada localmente; Preview bloqueado aguardando decisão sobre achados de segurança que exigem mudanças major e revalidação do gate CPC.

## Objetivo

Preparar uma candidata isolada para publicar em Vercel a Política de Privacidade aprovada e a rota pública Crédito para Construção (CPC), sem incluir as demais alterações pendentes da aplicação. Manter a captura de leads CPC desativada. A publicação em produção continuará sujeita a um GO específico após preview, revisão e smoke.

## Instruções, skills e documentos consultados

- `AGENTS.md` fornecido nesta conversa: plano e aprovação antes de código, limites server-side e validações obrigatórias.
- `docs/README.md`: stack React/Vite/Supabase e convenções.
- `docs/operacao/change-management.md`: mapeamento, plano, revisão, deploy e autorização separados.
- `docs/operacao/release-checklist.md`: critérios de release, segurança, preview, smoke e GO/no-GO.
- `docs/operacao/runbooks.md`: publicação web e validação pós-deploy.
- `docs/operacao/security-checklist.md`: controles de segurança.
- `docs/operacao/politica-privacidade-publica.md` e `docs/operacao/leads-publicos-cpc.md`: conteúdo da política e contrato/gate CPC.
- `prompts/2026-10-16-ajuste-status-politica-aprovada.md`, `prompts/2026-10-16-politica-privacidade-publica.md` e `prompts/2026-10-16-publicacao-backend-leads-cpc.md`: aprovações e histórico do escopo.
- Não foi necessária uma skill externa; o trabalho segue ferramentas e documentação locais do projeto.

## Código e configuração inspecionados

- `app/src/pages/public/PoliticaPrivacidade.tsx`.
- `app/src/pages/CreditoParaConstrucao.tsx` e `app/src/pages/credito-para-construcao.css`.
- `app/src/components/CpcLeadForm.tsx` e `app/src/lib/cpcLead.ts`.
- `app/src/router.tsx` e `app/src/test/creditoParaConstrucao.test.tsx`.
- `supabase/functions/public-cpc-lead/index.ts` e `supabase/migrations/20261016000001_leads_publicos_cpc.sql`.
- `app/package.json`, `app/package-lock.json`, `app/vercel.json` e `.vercelignore`.
- Estado Git: branch `main`, 144 arquivos modificados ou não rastreados; a candidata precisa ser isolada para não publicar escopos alheios.

## Diagnóstico já executado

- `npm run lint`: passou sem erros; 38 avisos.
- `npm test -- --reporter=dot`: 35 arquivos e 125 testes passaram.
- `npm run typecheck`: passou.
- `npm run build`: passou; bundle principal de aproximadamente 1,98 MB minificado e aviso de chunk acima de 500 kB.
- `npm run validate:release`: passou para `v0.2.2`.
- Após `npm audit fix` sem `--force` e `npm ci --include=dev`, `npm audit --audit-level=high` ainda falha com 17 vulnerabilidades no grafo completo (12 Moderate e 5 High; zero Critical). Os achados High vêm da árvore Tailwind CSS 3 (`braces`, `chokidar`, `fast-glob`, `micromatch` e `tailwindcss`); o npm oferece Tailwind CSS 4, uma mudança major. Também restam Moderate em React Router 6 (correção indicada no React Router 7) e na árvore do Electron Builder.
- `npm audit --omit=dev --audit-level=high`: zero High/Critical; permanecem 2 Moderate de React Router 6. Os avisos do grafo completo continuam relevantes para uma instalação Vercel com dependências de desenvolvimento.
- `supabase migration list --linked`: migrations locais e remotas alinhadas até `20261016000001`.
- `supabase functions list`: `public-cpc-lead` está ativa. O valor atual de `cpc_captura_publica_ativa` não pôde ser revalidado por um canal SQL somente leitura. A migration define o valor inicial como `false` com `ON CONFLICT DO NOTHING`, o que não prova o estado remoto atual. Nenhum POST de formulário foi enviado.
- As URLs de produção respondem com shell SPA HTTP 200. O bundle atualmente servido não contém os marcadores/rotas da política nem da página CPC; esse status HTTP sozinho não prova que as rotas estejam implementadas.

## Execução após aprovação

- Candidata isolada criada em `/tmp/mercurio-policy-cpc-20261016`, baseada no commit remoto `3e3d8fa`; a pasta de trabalho `main` com alterações preexistentes foi preservada.
- A candidata recebeu apenas a política, a página CPC, o formulário, o cliente do endpoint, o CSS, o teste e as duas rotas. `app/package-lock.json` recebeu atualizações transitivas compatíveis pelo `npm audit fix`; `app/package.json` não mudou.
- `npm ci --include=dev`: passou de forma reproduzível; reportou 17 vulnerabilidades no grafo de dependências.
- `npm test -- --reporter=dot`: 22 arquivos e 80 testes passaram.
- `npm run lint`: passou sem erros; 38 avisos já existentes no código-base.
- `npm run typecheck`, `npm run build` e `npm run validate:release`: passaram. A build mantém aviso de chunk principal acima de 500 kB (1.935 kB minificado; 576,5 kB gzip).
- Não foi enviado Preview Vercel: o critério de audit completo continua reprovado e o gate CPC remoto não foi revalidado. Também não houve smoke manual em Chrome.
- Sem deploy de produção, migration, alteração de configuração remota, envio de e-mail ou gravação de lead.

## Decisões e limites

- Escopo confirmado pelo usuário: Política de Privacidade e rota CPC apenas.
- Não incluir as demais telas e mudanças locais da branch `main`.
- Não ativar `cpc_captura_publica_ativa`, não gravar leads reais ou sintéticos, não enviar e-mails e não aplicar migrations.
- Backend CPC e histórico de migrations serão apenas conferidos em leitura; a captura permanecerá indisponível enquanto o gate estiver desligado.
- O usuário autorizou a preparação de Preview Vercel, sem produção e sem ativação CPC. Esse Preview não foi enviado porque os critérios de segurança abaixo não foram satisfeitos; qualquer retomada deve manter o endpoint sem envios de formulário até revalidar o gate.
- Mapear os avisos do audit por dependência e caminho. Aplicar apenas atualizações compatíveis previstas neste plano; se a correção exigir mudança major ou alteração de arquitetura, interromper e pedir uma decisão específica em vez de usar `--force` ou ignorar o risco.
- Não modificar a Política de Privacidade aprovada pelo advogado além dos fatos e ajustes já aprovados.

## Arquivos e recursos esperados

- Criar uma candidata de release isolada a partir do estado versionado, preservando integralmente a pasta de trabalho atual.
- Incluir na candidata somente os arquivos necessários da rota `/politica-de-privacidade`, da página `/credito-para-construcao`, do formulário CPC, do roteamento e dos testes correspondentes.
- Atualizar `app/package.json` e `app/package-lock.json` somente se a revisão aprovada confirmar correções compatíveis de dependências necessárias ao gate de segurança.
- Atualizar este plano com arquivos e resultados finais; atualizar `docs/operacao/politica-privacidade-publica.md`, `docs/operacao/leads-publicos-cpc.md` e `docs/operacao/release-checklist.md` com evidências sanitizadas.

## Requisitos e critérios de aceite

1. A candidata contém somente Política de Privacidade e rota CPC, sem publicar o restante das 144 alterações pendentes.
2. As duas rotas carregam no preview em desktop e mobile; política, razão social/CNPJ/endereço, links e formulário correspondem ao conteúdo aprovado.
3. Consentimento obrigatório, validação de campos e estados de captura desativada funcionam; nenhum dado é gravado com o gate desligado.
4. Migrations remotas continuam alinhadas; função CPC ativa; gate comprovadamente `false` antes de qualquer teste de formulário.
5. Lint, typecheck, suíte aplicável, build, `npm ci` e validador de release passam na candidata.
6. O audit completo não deixa achados Critical/High; achados Moderate/Low restantes são descritos com dependência, exposição e justificativa antes do GO. **Pendente:** há 5 High e 12 Moderate.
7. Smoke de preview confirma as duas rotas, fluxo do formulário desativado e links. **Pendente:** Preview não criado; o gate CPC remoto também não foi revalidado.

## Segurança, rollout e rollback

- O cliente continua chamando apenas a Edge Function pública; service role, dados privados e configuração do gate permanecem no servidor.
- Não coletar ou exibir tokens, segredos, PII de leads ou detalhes de sessão nos logs/evidências.
- Nenhuma migration ou mudança de estado remoto faz parte do rollout.
- Rollout: publicar primeiro em Preview Vercel; revisar e executar smoke sem envio de lead; apresentar URL e evidências para GO específico de produção.
- Rollback: reatribuir o domínio à implantação Vercel de produção anterior; sem rollback de banco, pois o plano não aplica migrations.

## Testes planejados

- `npm ci --include=dev` na candidata isolada.
- `npm run lint`, `npm run typecheck`, testes CPC/política e `npm test`.
- `npm run build`, `npm run validate:release` e auditorias npm completas e de produção.
- Verificação Supabase somente leitura de migrations, função e gate CPC.
- Preview Vercel e smoke manual em Chrome: política, navegação CPC, campos obrigatórios, entrada inválida, consentimento e resposta de captura desativada; conferir desktop e mobile.
- Depois de eventual GO de produção: smoke HTTP/visual das duas rotas e confirmação do bundle publicado; sem ativar captura CPC.

## Aprovação

O usuário aprovou o escopo restrito a Política de Privacidade e rota CPC, revisão de dependências e preparação de Preview, sem deploy de produção nem ativação da captura CPC. Para prosseguir além do bloqueio atual é necessária nova decisão: o próprio plano determina interromper quando as correções restantes exigirem mudanças major; em paralelo, é preciso obter uma confirmação somente leitura do estado remoto do gate antes de qualquer smoke que possa enviar dados.
