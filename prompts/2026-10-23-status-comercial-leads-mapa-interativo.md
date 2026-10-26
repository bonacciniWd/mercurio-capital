# Status comercial dos leads e mapa interativo — plano para aprovação

## Objetivo

Adicionar os estados comerciais **Novo**, **Em contato** e **Qualificado** aos leads de `/admin/leads/simulacoes`, com alteração segura e histórico; tornar o mapa navegável com zoom, pan/rolagem e hover por país e, ao entrar no Brasil, por UF. Preservar os estados de e-mail, filtros, detalhe, WhatsApp e a referência visual existente.

## Skills e documentos lidos

- `AGENTS.md` fornecido pelo usuário nesta conversa; nenhuma skill adicional se aplica a uma alteração no repositório React/Supabase e em SVG.
- `docs/README.md`, `docs/operacao/simulador-publico.md`, `docs/operacao/leads-publicos-cpc.md`, `docs/blueprint/02-roles-permissions.md`, `prompts/2026-10-23-leads-simulacoes-mapa-distribuicao.md`.
- Documentação oficial da [API de malhas geográficas do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) para obter contornos estaduais estáticos; conferir o endpoint e o arquivo gerado antes de incluí-lo.

## Código e configuração inspecionados

- `app/src/pages/admin/LeadsSimulacoes.tsx`, `app/src/pages/admin/leads-simulacoes.css`, `app/src/lib/simulacaoLeadPresentation.ts`, `app/src/test/adminLeadsSimulacoes.test.tsx`, `app/src/assets/maps/world.svg`, `app/src/lib/adminScope.ts`, `app/package.json`.
- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql`, `supabase/migrations/20261016000001_leads_publicos_cpc.sql` e funções de autorização `app_is_admin`, `app_is_admin_operacional`.
- A view `v_admin_leads_publicos` une as duas fontes e fornece IDs `simulacao:<uuid>` e `cpc:<uuid>`. As tabelas de captura são legíveis pelo admin, sem escrita direta do cliente. Os campos `status_email_*` descrevem entrega de e-mail, não relacionamento comercial. O SVG mundial contém caminhos identificados por país, mas hoje é exibido como `<img>`, sem eventos nos caminhos; não há geometria de UFs no projeto.

## Modelo de dados proposto — requer aprovação

- `lead_status_comercial`: uma linha opcional por lead, com `id uuid`, `simulacao_lead_id uuid` FK nullable, `cpc_lead_id uuid` FK nullable, `status` restrito a `novo | em_contato | qualificado`, `updated_at timestamptz`, `updated_by uuid` (usuário autenticado). `CHECK` exige exatamente uma FK preenchida; índices únicos parciais impedem dois estados atuais para o mesmo lead. Relação 1:0..1 com uma das tabelas de captura.
- `lead_status_comercial_historico`: eventos append-only com `id uuid`, referência ao estado atual, `status_anterior`, `status_novo`, `alterado_em`, `alterado_por`. Relação 1:N com `lead_status_comercial`. Sem nome, e-mail, telefone ou CEP duplicados. Gravação do evento na mesma transação da mudança.
- `v_admin_leads_publicos`: expor `status_comercial` e data/ator da última alteração por `LEFT JOIN` à tabela nova; registro sem linha explícita é exibido como **Novo**. A coluna será acrescentada ao fim da view para preservar o contrato existente. Leitura permanece sob RLS/admin.
- RPC `admin_set_lead_status_comercial(lead_id, novo_status, status_esperado)`: valida o formato/UUID e a existência do lead, exige `app_is_admin_operacional()` (**full ou limitado**; jurídico mantém leitura), valida a enumeração, confere o estado esperado para evitar sobrescrever uma edição concorrente, atualiza estado e histórico atomicamente. `authenticated` recebe somente `EXECUTE`; tabelas não recebem escrita direta. `anon` e outros perfis não alteram o status.
- `Novo` significa ausência de acompanhamento registrado para leads antigos; a migration não reclassifica nem inventa contato/qualificação. Mudanças são manuais, reversíveis pelos três estados e não disparam mensagens nem distribuição automática.

## Decisões e suposições

- Estado comercial é independente de `status_email_*` e da classificação/distribuição de propostas. A listagem ganha a coluna/controle comercial e filtro correspondente; o estado do e-mail continua acessível sem perda de função.
- Usar `world.svg` local como geometria dos países, lendo somente `id`, `title` e `d` de caminhos do asset confiável para renderização React interativa; não inserir SVG externo como HTML. Clique no Brasil abre a vista estadual. Outros países permitem hover/foco e retorno de contagem sustentada pelos dados, sem presumir leads internacionais.
- Obter uma vez os limites das 27 UFs da malha oficial do IBGE, normalizar para asset local e exibir em uma vista própria do Brasil. Hover/foco mostra UF e contagem real. Sem CEP válido/cidade/UF resolvida, o lead continua em “localização não informada”; ViaCEP continua recebendo apenas CEP.
- Zoom por roda/trackpad e botões `+`, `−`, “Restaurar”; arraste para mover com limites; clicar no Brasil entra na vista estadual, com botão de volta ao mundo. Roda/scroll fora do mapa mantém a rolagem da página; gestos não interceptam a página quando o mapa não está em foco/uso. Mouse, toque e teclado devem funcionar sem tooltip preso ou navegação acidental.
- Não introduzir biblioteca de mapas, geocodificação em massa, números fictícios ou mudanças na captação pública.

## Arquivos esperados

- Migration nova em `supabase/migrations/` e smoke SQL em `supabase/smoke-tests/`.
- `app/src/pages/admin/LeadsSimulacoes.tsx`, `app/src/pages/admin/leads-simulacoes.css`, `app/src/lib/simulacaoLeadPresentation.ts`, testes focados.
- Componente/auxiliar de mapa em `app/src/components/admin/` e geometria local de UFs em `app/src/assets/maps/`; manter `world.svg` como fonte do mapa global.
- `docs/operacao/simulador-publico.md` e `docs/operacao/leads-publicos-cpc.md` para contrato, permissão, teste e limitações.

## Requisitos e critérios de aceite

1. O estado mostrado para qualquer lead sem edição é **Novo**; **Em contato** e **Qualificado** só aparecem após gravação manual bem-sucedida. Mudanças persistem, atualizam a lista/detalhe e registram ator, hora e transição.
2. Usuário jurídico, parceiro, cliente e anônimo não conseguem gravar via API; duas edições simultâneas não sobrescrevem silenciosamente uma à outra. Falhas preservam o estado anterior e exibem opção de tentar novamente.
3. Filtro comercial funciona junto dos filtros atuais; estado de e-mail permanece separado. Paginador de 50 e ações existentes continuam operantes.
4. Mapa permite zoom, pan e restauração; hover/foco em país e UF mostram nome e contagem correta; entrar/sair do Brasil não perde filtros. Estados sem dados mostram zero, e leads sem localização permanecem fora dos pontos geográficos.
5. Layout desktop segue a referência, mobile permite navegação sem cortar controles. Botões e formas têm nomes acessíveis, foco visível e suporte a teclado.

## Segurança

- Escrita apenas por RPC autenticada com verificação de perfil no banco; permissões diretas revogadas, RLS ativada, `search_path` seguro e IDs validados. Histórico é append-only para o cliente.
- Sem PII em asset geográfico, tooltip, URL, logs ou ferramenta externa. Apenas agregados de localização aparecem no mapa.
- A publicação da interface não está incluída. A aplicação remota da migration foi autorizada separadamente pelo usuário em 2026-10-23 e está registrada abaixo.

## Testes manuais e automáticos

- SQL smoke em Supabase local: leitura, primeira transição, reversão, histórico, concorrência, ID inválido e rejeição de usuário sem permissão; sem alterar dados de produção.
- Testes React para estado inicial, filtro, sucesso/erro/conflito, permissões de controle e agregação/seleção do mapa.
- `npm run lint`, `npm run typecheck`, `npm run build`, testes focados e `git diff --check`.
- Navegador autenticado desktop/mobile: fluxo feliz, vazio, localização ausente, zoom com roda/botões, pan, hover/foco país/UF, filtros, detalhe, estado inválido e usuário somente leitura. Relatar qualquer verificação que não puder ser executada.

## Execução remota autorizada — 2026-10-23

- Projeto vinculado confirmado pelo CLI: `mercurio` (`bhagksfvszeogtjvjtpx`).
- Dry-run mostrou somente `20261023000001_lead_status_comercial.sql` pendente.
- `supabase db push --linked` aplicou a migration sem erro; `supabase migration list --linked` confirmou a versão no histórico remoto, após `20261022000001`.
- Nenhum dado de lead foi atualizado ou inserido na aplicação da migration. O smoke autenticado da RPC e a verificação da interface integrada permanecem pendentes; os testes SQL sintéticos devem continuar restritos ao banco de teste.

## Publicação coordenada — 2026-10-23

- Com autorização do usuário, a Edge Function `consulta-executar` foi publicada no projeto `bhagksfvszeogtjvjtpx`. O CLI confirmou a versão 38 ativa em 2026-10-23 18:19:52 UTC; `verify_jwt=true` foi mantido.
- Antes do deploy, foi adicionada a trava server-side `SERASA_PRODUCTION_ENABLED`, cujo padrão é `false`. Chamadas cujo endpoint corresponda ao ambiente de produção retornam `serasa_producao_bloqueada` até que a liberação seja explicitamente configurada. Credenciais e ativação produtiva não foram alteradas. UAT continua sujeito à configuração e autorização existentes.
- O frontend foi publicado no projeto Vercel `mercurio-digital`, deployment `dpl_cJkaK3qpLQikKecf45MjhZjExwb6`, URL `https://mercurio-digital-cymqsx1qt-bonacciniwds-projects.vercel.app`, status **Ready / Production**. Aliases confirmados: `www.mercuriocapitalsa.com.br`, `mercuriocapitalsa.com.br`, `mercurio-digital-alpha.vercel.app` e `mercurio-digital-bonacciniwds-projects.vercel.app`.
- Smoke HTTP em `https://www.mercuriocapitalsa.com.br` retornou 200 para `/`, `/credito-para-construcao`, `/admin/propostas` e `/admin/leads/simulacoes`; as rotas internas foram verificadas como respostas SPA, sem sessão autenticada. A inspeção do deployment confirmou **Ready** e os aliases acima.
- `supabase/migrations` permaneceu fora do pacote Vercel conforme `.vercelignore`; nenhuma migration foi publicada com o frontend.
- `node --test supabase/functions/_shared/serasa-reports.test.mjs`: 4/4 testes passaram. `git diff --check` passou. Lint, typecheck, build e testes de frontend haviam sido executados antes desta publicação: lint sem erros (38 avisos), typecheck/build aprovados, teste focado de leads 14/14; suíte completa 168/170, com as duas falhas locais conhecidas do reCAPTCHA dependente do domínio autorizado em produção.
- O comando de deploy da Vercel terminou com `fetch failed` ao buscar o estado final, mas a consulta subsequente `vercel ls --prod` e `vercel inspect` confirmou o deployment como **Ready / Production**. A leitura posterior dos bundles remotos sofreu timeout intermitente; por isso, os smokes confirmam disponibilidade HTTP e roteamento, não execução visual autenticada dos fluxos.
- O build remoto reportou 19 vulnerabilidades de dependências (10 moderadas, 6 altas, 3 críticas) durante `npm install`; não foi executado `npm audit fix` no escopo desta publicação.
