# Piso de R$ 400 mil nas calculadoras públicas

## Objetivo

Definir R$ 400.000 como valor mínimo de crédito/financiamento nas calculadoras públicas Home Equity e amortização. No Home Equity, impedir o avanço quando o tipo e o valor do imóvel não suportarem o mínimo pelo LTV vigente.

## Instruções, skills e documentação lidas

- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- `docs/README.md` e `docs/operacao/simulador-publico.md`.
- `docs/blueprint/08-security-compliance.md` (validação server-side/defense in depth).
- Migrations que definem a captura pública: `20261005000003_simulacao_leads_publicos.sql`, `20261007000001_simulacao_amortizacao_publica.sql` e `20261007000002_simulacao_planos_contato.sql`.
- Código de `PublicSimulator.tsx`, `PublicAmortizationSimulator.tsx`, `MoneyInput.tsx`, Edge Function `public-simulacao-lead` e testes das duas calculadoras.

## Código e modelo de dados inspecionados

- Home Equity usa `CREDIT_MIN = R$ 100.000`, imóvel mínimo R$ 280.000 e LTV por tipo: apartamento 60%, casa 50%, comercial 40% e terreno 30%.
- Amortização atualmente aceita principal maior que zero; coleta tipo de imóvel, mas não valor do imóvel, portanto não calcula LTV.
- Ambos os modos gravam em `simulacao_leads_publicos.valor_credito`; Home Equity também grava `valor_imovel` e `ltv`, enquanto amortização deixa esses campos nulos.
- A captura pública passa pela Edge Function com service role e RPCs protegidas. As regras atuais do banco permitem créditos inferiores a R$ 400.000.
- Há registros públicos históricos abaixo do novo piso que devem continuar válidos e legíveis.

## Regra confirmada

- Crédito mínimo: R$ 400.000 nas duas calculadoras.
- Home Equity: além do piso, validar o teto LTV por tipo do imóvel; impedir avançar quando o imóvel não comportar R$ 400.000.
- Amortização: aplicar apenas o piso de R$ 400.000, sem acrescentar cálculo de LTV, pois o formulário não informa valor do imóvel.
- Não alterar, apagar ou reclassificar simulações históricas.

## Decisões e suposições de implementação

- Exibir R$ 400.000 como mínimo no slider/campo e atualizar o valor inicial do Home Equity para esse piso.
- Ao selecionar/trocar imóvel no Home Equity, recalcular o teto; se o limite ficar abaixo de R$ 400.000, mostrar o valor máximo e o valor de imóvel necessário, bloqueando o avanço.
- Valores de imóvel necessários para o piso, conforme LTV atual: apartamento R$ 666.667; casa R$ 800.000; comercial R$ 1.000.000; terreno R$ 1.333.334. O texto deve ser calculado pelo percentual, sem duplicar esses números em regras separadas.
- Amortização inicia em valor não inferior a R$ 400.000, informa esse mínimo e bloqueia a prévia/captura se o campo estiver abaixo.
- Validar também na Edge Function antes da RPC e no banco para novas inserções. A proteção de banco será uma migration aditiva com trigger `BEFORE INSERT` em `simulacao_leads_publicos`, cobrindo ambos os tipos de simulação e sem alterar linhas existentes. A Edge Function devolverá erro de validação claro e não dependerá de mensagem crua do trigger.
- Não mudar fórmulas financeiras, taxas, prazos, sistemas Price/SAC, planos de amortização, e-mails ou telas administrativas.

## Arquivos esperados

- `app/src/components/PublicSimulator.tsx`
- `app/src/components/PublicAmortizationSimulator.tsx`
- `app/src/test/publicSimulator.test.tsx`
- `app/src/test/publicAmortizationSimulator.test.tsx`
- `supabase/functions/public-simulacao-lead/index.ts`
- Nova migration para o piso de captura, com smoke test de estrutura/guardas se necessário.
- `docs/operacao/simulador-publico.md`

## Requisitos e critérios de aceite

- Home Equity não aceita crédito inferior a R$ 400.000.
- Exemplo: apartamento com imóvel de R$ 850.000 comporta R$ 400.000; comercial com imóvel de R$ 850.000 não comporta e mostra que precisa de R$ 1.000.000 para esse piso.
- Trocar o tipo ou valor do imóvel atualiza teto e bloqueio de forma consistente.
- Amortização não permite simular, pré-visualizar ou capturar principal inferior a R$ 400.000.
- Requests que contornem o navegador continuam rejeitados no servidor/banco.
- Linhas históricas abaixo de R$ 400.000 permanecem inalteradas.
- Nenhum cálculo, estado, estilo ou fluxo exclusivo da amortização é afetado além do piso do principal.

## Segurança e dados

- Nenhum token privado no cliente; a Edge Function continua sendo a entrada pública.
- Migration valida apenas novas linhas; não adiciona constraint retroativa que invalide histórico.
- Não usar PII ou gravar lead em teste. Não publicar migration/função nesta tarefa.

## Testes

- Casos de limite R$ 399.999,99 e R$ 400.000 nas duas interfaces.
- Home Equity nos limites por categoria, incluindo imóveis insuficientes e suficientes para suportar o piso.
- Testes da Edge Function/banco em contexto de staging ou mocks; sem inserir lead de produção.
- `npm test -- --run`, lint, typecheck, build e `git diff --check`.
- Smoke visual local dos dois modos; não submeter formulário real.

## Execução após aprovação — 2026-10-08

Implementado nos componentes das duas calculadoras, Edge Function, migration aditiva, smoke SQL somente leitura e testes. A migration protege novas inserções e preserva repetições idempotentes de leads antigos abaixo do piso. Não foi aplicada no banco nem publicada a função.

Verificações concluídas:

- `npm test -- --run src/test/publicSimulator.test.tsx src/test/publicAmortizationSimulator.test.tsx`: 7 testes aprovados.
- `npm test -- --run --maxWorkers=2`: 28 arquivos e 106 testes aprovados.
- `npm run typecheck`: aprovado.
- `npm run lint`: 0 erros; 38 avisos preexistentes.
- `npm run build`: aprovado; permaneceu o aviso de chunk acima de 500 kB.
- `git diff --check`: aprovado.
- Chrome local em `/simulador`: R$399.999,99 bloqueado na amortização e R$400.000 aceito; Home Equity mostrou bloqueio para imóvel comercial de R$850.000, com limite R$340.000 e imóvel mínimo de R$1.000.000. Nenhum lead foi enviado.

## Ativação em produção — 2026-10-08

- Inventário prévio: projeto `bhagksfvszeogtjvjtpx`; a migration de hoje era a única pendente; `public-simulacao-lead` estava ativa na versão 3.
- Aplicada `20261008000001_minimo_credito_simulacoes_publicas`; `supabase migration list --linked` confirmou presença na tabela remota.
- Publicada `public-simulacao-lead` versão 4 com `verify_jwt=false` preservado.
- Dois requests sintéticos de rejeição foram feitos. `R$ 399.999,99` recebeu HTTP 400 `valor_credito_minimo_400000`; crédito `R$ 400.000` para imóvel comercial de `R$ 850.000` recebeu HTTP 400 `valor_credito_acima_ltv`. Ambos são validados antes da inicialização do cliente service-role, da consulta/consumo do rate limit e de qualquer gravação; nenhum lead ou e-mail foi criado.
- Publicada a interface Vercel `dpl_BTHtgzPZMJ5UqvEc1aH739vmAUAi`, preservando como base a origem congelada da publicação anterior e sobrepondo os três componentes de simulador aprovados. Aliases `mercuriocapitalsa.com.br` e `www.mercuriocapitalsa.com.br` confirmados no novo deployment.
- Smoke visual no site: formulário inicial mostra R$ 400.000; amortização bloqueia `R$ 399.999,99` e aceita `R$ 400.000` avançando ao contato; Home Equity apresenta o limite LTV de `R$ 340.000` e imóvel mínimo `R$ 1.000.000` para imóvel comercial de `R$ 850.000`. Nenhuma etapa final foi enviada.
- HTTP HEAD no domínio `www`/`simulador` retornou 200; domínio sem `www` redireciona para o canônico. `vercel inspect` confirmou estado `Ready` e ambiente `production`.

Limitação: a migration consta aplicada no histórico remoto e os dois guardas da Edge Function foram exercitados sem escrita; o smoke SQL estrutural de leitura não foi executado porque a CLI Supabase disponível não oferece comando de query SQL direta. Nenhuma linha histórica foi atualizada.
