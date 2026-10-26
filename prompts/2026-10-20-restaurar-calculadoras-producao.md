# Plano — Restaurar calculadoras públicas em produção

## Objetivo

Restaurar em `mercuriocapitalsa.com.br` os simuladores públicos de crédito e amortização que estão ausentes do bundle atualmente servido pela Vercel, preparando uma candidata isolada e publicando-a após validação e autorização final.

## Documentos e referências lidos

- Instruções `AGENTS.md` fornecidas na conversa.
- `docs/README.md`.
- `docs/operacao/release-checklist.md`.
- `docs/operacao/simulador-publico.md`.
- `prompts/2026-10-20-padrao-emails-simuladores-auth.md`.
- Registro de memória operacional do simulador público e do projeto Vercel.

## Diagnóstico confirmado

- O domínio público responde `200` para `/simulador`, mas a regra SPA devolve o mesmo `index.html`; isso, por si só, não confirma que a tela esteja no app.
- A publicação de produção que o Vercel CLI identifica como atual foi criada em 16/10/2026.
- O JavaScript dessa publicação não contém a rota `/simulador` nem a implementação atual do simulador. A build local contém a rota e os componentes públicos.
- O asset `call-to-DyM9aWlp.png` não é a causa: o endereço usado pelos templates responde `200` e o conteúdo servido é idêntico ao arquivo local.
- Há muitas alterações locais sem commit de áreas diferentes. Não se deve publicar o diretório de trabalho inteiro; a candidata deverá conter somente as dependências necessárias para restaurar as calculadoras públicas.

## Código e configuração inspecionados

- `app/src/router.tsx` e `app/src/pages/public/Simulador.tsx`.
- `app/src/pages/Landing.tsx`.
- `app/src/components/PublicSimulator.tsx`, `PublicAmortizationSimulator.tsx`, `PublicAmortizationResult.tsx` e `PublicSimulatorModeToggle.tsx`.
- `app/src/lib/supabaseConfig.ts`.
- `app/vercel.json` e `app/.vercel/project.json`.
- Estado remoto consultado somente para leitura via Vercel CLI e requisições HTTP públicas.

## Decisões e suposições

- O escopo desta correção é restaurar a UI pública das calculadoras e seus caminhos de entrada (`/simulador` e calculadora embutida na landing, se presente na versão aprovada), sem alterar fórmulas ou contrato de captura de leads.
- Nenhuma migration, Edge Function, configuração de Auth, template de e-mail ou build Electron faz parte deste reparo.
- A candidata será isolada a partir dos arquivos necessários; alterações locais não relacionadas permanecerão fora dela.
- A resposta HTTP `200` da rota depende do fallback SPA; a validação funcional exige confirmar que o bundle publicado contém as rotas/componentes e que a tela renderiza no navegador.

## Arquivos esperados

- Dependências aprovadas da calculadora já existentes localmente, incluindo a rota e componentes públicos e apenas os helpers/configurações estritamente necessários.
- Artefato de build e evidências de smoke da candidata; sem alterar outros módulos.
- Este plano atualizado com resultado e eventual referência de deploy.

## Critérios de aceite

- `/simulador` carrega o simulador e alterna entre crédito e amortização.
- A calculadora da landing, quando presente no escopo visual aprovado, renderiza e abre o fluxo correto.
- O bundle de produção contém os caminhos e os assets necessários; não aparece tela preta nem erro de inicialização Supabase.
- Build, typecheck, lint e testes focados passam; avisos preexistentes são identificados separadamente.
- Smoke antes e depois da publicação confirma status HTTP, conteúdo/bundle servido e renderização das rotas afetadas.
- O deploy não inclui arquivos locais de outros escopos e não cria release Electron.

## Segurança e rollout

- Não expor env vars, tokens, dados de leads ou credenciais nos logs/evidências.
- Verificar que o candidato está associado ao projeto `mercurio-digital` antes de publicar.
- Preservar o deployment anterior como rollback e registrar os IDs/caminhos publicados.
- Não alterar Supabase remoto nem enviar e-mails.

## Testes

- Automatizados: `npm run typecheck`, `npm run lint`, testes focados do simulador, `npm run build`.
- Manual/Preview: abrir `/simulador` em viewport desktop e mobile; validar simulador de crédito, alternância para amortização, entrada inválida/limite mínimo, e renderização da landing; confirmar ausência de tela preta/erro de inicialização.
- Produção após autorização final: HTTP smoke de `/`, `/simulador` e assets, inspeção do bundle publicado e teste visual do fluxo sem persistir lead real.

## Status

Plano aprovado. Candidata isolada montada em `/tmp/mercurio-calculators-candidate`, baseada no `HEAD` `5225be7` e contendo somente a implementação das calculadoras públicas, a rota e entrada da landing, o componente compartilhado de moeda e a validação de configuração Supabase já aprovada.

- `npm run typecheck`: aprovado.
- Testes focados (`publicSimulator`, `publicAmortizationSimulator`, `supabaseConfig`): 13 testes aprovados.
- `npm run lint`: 0 erros; 38 avisos preexistentes do app.
- `npm run build`: aprovado (4.195 módulos transformados).
- Preview Vercel `dpl_6TFNBDcvSZ54zctgLWsyZ8A3tJuh`: `READY`, destino `preview`; os caminhos `/` e `/simulador` entregam o HTML do app e o bundle contém os textos/fluxos de crédito e amortização. A proteção da Vercel exige autenticação para visualização no browser; smoke por `vercel curl` autenticado confirmou HTML e bundle. Nenhum formulário foi submetido.
- Asset do cabeçalho no Preview responde `200 image/png`.
- `npm audit --omit=dev`: 0 vulnerabilidades em dependências de runtime. O build remoto reportou 28 achados no grafo completo (11 High e 2 Critical), que permanecem no gate de segurança geral da release checklist.

Produção não foi alterada. A publicação permanece pendente de GO específico e da decisão sobre os achados High/Critical de dependências de build; seguir o plano `prompts/2026-10-16-migracao-major-dependencias.md` ou registrar aceitação explícita conforme o gate vigente.
