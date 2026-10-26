# Plano — minuta pública da Política de Privacidade

**Status:** aprovado para implementação local; minuta 0.1 implementada em 16/10/2026. A versão não é tratada como política jurídica final nem foi publicada em produção nesta etapa. O estado do gate CPC em produção não foi consultado nem alterado neste trabalho.

## Objetivo

Substituir o aviso temporário em `/politica-de-privacidade` por uma minuta básica em português para os formulários públicos CPC, Home Equity e amortização. Explicar, com base no fluxo real do produto, os dados solicitados, as finalidades, o envio dos resultados, a gravação dos leads no painel interno, os direitos dos titulares e os canais ainda pendentes de confirmação.

O documento desta etapa não cobre os módulos autenticados de parceiros, clientes e equipe, não altera o processamento de dados desses módulos e não declara conformidade jurídica final.

## Instruções, documentos e fontes consultados

- `AGENTS.md` fornecido nesta conversa — plano e aprovação obrigatórios antes de codificar; limites server-side; validações obrigatórias.
- `docs/README.md` — stack React/Vite/Supabase e convenções do repositório.
- `docs/blueprint/08-security-compliance.md` — minimização de dados, consentimento, direitos e canal do encarregado.
- `docs/operacao/security-checklist.md` — controles de segurança e privacidade do app.
- `docs/operacao/leads-publicos-cpc.md` — captura CPC, dados, acesso e estado do gate.
- `docs/operacao/simulador-publico.md` — campos dos simuladores, gravação dos leads e e-mails.
- `prompts/2026-10-16-captura-lead-publico-cpc.md` — decisões aprovadas para o formulário CPC e rota reservada.
- Lei nº 13.709/2018 (LGPD), texto vigente no Planalto: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Aviso de Privacidade da ANPD, consultado como referência estrutural, atualizado em 23/09/2026: https://www.gov.br/anpd/pt-br/acesso-a-informacao/aviso-de-privacidade
- Página da ANPD sobre titulares e agentes de tratamento: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados
- Nenhuma skill técnica específica se aplica à edição de uma página já existente neste React/Vite; fontes jurídicas oficiais foram consultadas para orientar a estrutura, não para substituir revisão jurídica da Mercúrio.

## Código e configuração inspecionados

- `app/src/pages/public/PoliticaPrivacidade.tsx` — aviso temporário existente.
- `app/src/router.tsx` — rota `/politica-de-privacidade` já registrada.
- `app/src/components/CpcLeadForm.tsx` — campos, consentimento e link CPC.
- `app/src/components/PublicSimulator.tsx` e `app/src/components/PublicAmortizationSimulator.tsx` — campos, consentimento e resultados das calculadoras.
- `supabase/functions/public-cpc-lead/index.ts` e `supabase/migrations/20261016000001_leads_publicos_cpc.sql` — contrato isolado CPC e captura inicialmente desativada.
- `supabase/functions/public-simulacao-lead/index.ts`, `supabase/migrations/20261005000003_simulacao_leads_publicos.sql`, `20261007000001_simulacao_amortizacao_publica.sql` e `20261007000002_simulacao_planos_contato.sql` — validação e persistência server-side dos simuladores.
- `app/src/pages/admin/LeadsSimulacoes.tsx` e `app/src/components/SimulacaoLeadDetalhe.tsx` — leitura administrativa dos leads CPC e dos simuladores.
- `app/src/lib/observability.ts` e `app/src/main.tsx` — PostHog e Sentry são opcionais por configuração; PostHog pode usar localStorage, pageviews e autocapture. A configuração de produção e os eventos efetivamente coletados precisam ser confirmados antes da publicação do texto final.
- `app/src/pages/Landing.tsx` — rodapé informa o CNPJ 64.382.034/0001-70 e endereço Rua 1301, 471, Centro, Balneário Camboriú/SC, 88330-795. A razão social legal não está indicada no trecho consultado.

## Conteúdo e modelo previstos

A página será uma minuta versionada, com data de revisão, contendo:

1. **Quem trata os dados:** marca Mercúrio Capital e CNPJ/endereço atualmente exibidos no site; razão social, contato de privacidade e eventual encarregado aparecerão como pendências claramente marcadas até confirmação.
2. **Escopo:** formulário CPC e simuladores públicos Home Equity e amortização; declaração expressa de que áreas autenticadas não fazem parte desta minuta.
3. **Dados coletados:** nome, e-mail e telefone; CPC também pode coletar cidade/UF, fase e resumo do projeto; simuladores coletam dados da operação/garantia e perfil informados para calcular e contextualizar o resultado, inclusive valores, tipo/situação do imóvel, CEP, renda opcional, objetivo, tipo de renda, prazo e, para amortização, sistema, taxa, prazo, data e planos extras.
4. **Finalidades:** receber a solicitação, calcular/exibir/enviar resultado, registrar e organizar o lead para atendimento interno e responder a pedidos do titular. Não afirmar aprovação de crédito nem decisão automatizada.
5. **Compartilhamento e fornecedores:** explicar que o resultado pode ser enviado ao e-mail informado e que o registro fica no Supabase; identificar fornecedores de analytics, monitoramento e e-mail somente após confirmar configuração/uso no ambiente de produção. Não inventar transferência internacional ou lista de destinatários.
6. **Retenção e segurança:** explicar controles observáveis, sem prometer prazo ou medidas que não estejam comprovados; marcar o prazo de retenção dos leads e a regra de descarte como pendentes de decisão da Mercúrio.
7. **Direitos e contato:** resumir direitos relevantes do titular conforme LGPD, informar que solicitações serão recebidas por canal de privacidade a confirmar e que não há canal público confirmado no código/documentação revisados.
8. **Cookies/telemetria:** descrever apenas o que for confirmado sobre PostHog, Sentry, armazenamento local e autocapture; até essa confirmação, o texto não alegará que essas ferramentas estão sempre ativas ou inativas.

As seções com dados ainda não confirmados serão marcadas como “pendente de confirmação interna” na minuta local; não haverá placeholders apresentados como dados verdadeiros da empresa.

## Decisões e suposições

- A resposta do usuário confirma que o escopo cobre CPC e as calculadoras/simuladores públicos que já gravam leads em `/admin/leads/simulacoes`.
- As áreas autenticadas de parceiros, clientes e equipe ficam fora desta primeira versão.
- A página será redigida como minuta para revisão da Mercúrio/jurídico, não como parecer nem certificação de conformidade.
- O checkbox CPC e a configuração server-side de captura serão preservados. Não habilitar captura CPC nesta etapa; o valor atual de produção não foi consultado.
- Os links dos consentimentos das duas calculadoras serão direcionados para a rota pública; o consentimento e o payload existentes não serão ampliados nem enfraquecidos.
- Não alterar migration, Edge Functions, fluxo de e-mail, registros existentes ou dados de produção.
- A publicação exige confirmação posterior da razão social, canal de privacidade/encarregado, retenção e configuração real dos fornecedores. Essa confirmação não bloqueia a criação de uma minuta local visivelmente incompleta.

## Arquivos esperados

- `app/src/pages/public/PoliticaPrivacidade.tsx` — minuta em seções acessíveis e status de revisão.
- Estilos Tailwind existentes na página — apresentação responsiva coerente com o site.
- `app/src/components/CpcLeadForm.tsx` — rótulo do link apontando para a minuta, sem alegar que já foi aprovada.
- `app/src/components/PublicSimulator.tsx` e `app/src/components/PublicAmortizationSimulator.tsx` — link para a mesma rota nos consentimentos.
- `app/src/test/creditoParaConstrucao.test.tsx`, `publicSimulator.test.tsx` e `publicAmortizationSimulator.test.tsx` — conteúdo essencial, links, pendências explícitas e preservação dos fluxos.
- `docs/operacao/politica-privacidade-publica.md` — inventário de informações confirmadas, pendências e checklist de revisão/publicação.
- Este plano em `prompts/2026-10-16-politica-privacidade-publica.md`.

## Critérios de aceite

1. `/politica-de-privacidade` apresenta minuta legível e responsiva, com título, versão/data e seções adequadas a leitores e tecnologias assistivas.
2. O texto descreve os fluxos públicos CPC e dos dois simuladores conforme os campos e processamento inspecionados.
3. O texto distingue informações confirmadas de pendências e não inventa razão social, canal, encarregado, retenção, fornecedor ativo ou transferência internacional.
4. CPC e ambos os simuladores têm link visível para a mesma rota nos respectivos avisos de consentimento.
5. O texto não promete aprovação de crédito, segurança absoluta, prazos ou direitos além do que a operação consegue atender.
6. O gate CPC e os contratos de simulador, gravações, emails e painel de leads não são alterados; o estado de produção do gate CPC não é afirmado sem consulta.
7. Nada é migrado, ativado ou publicado remotamente.

## Segurança e privacidade

- Nenhum dado será coletado durante a leitura da política; nenhum novo endpoint/tabela será criado.
- A gravação continua exclusivamente server-side nos fluxos já existentes.
- Não revelar nomes de tabelas, detalhes operacionais desnecessários, endereços de infraestrutura ou dados de outros usuários.
- Evitar divulgar nomes de ferramentas de terceiros como ativas sem confirmar a configuração real de produção.
- A política local fica identificada como minuta até que os responsáveis preencham e aprovem os dados institucionais pendentes.
- O gate CPC e a função server-side não foram consultados ou alterados neste trabalho.

## Verificações executadas

- Testes focados CPC/Home Equity/amortização: 3 arquivos e 11 testes aprovados.
- Suíte completa Vitest: 35 arquivos e 124 testes aprovados.
- `npm run typecheck`: aprovado; o `tsc -b` também passou no build final.
- `npm run lint`: 0 erros e 38 avisos existentes em arquivos do projeto, fora desta alteração.
- `npm run build`: aprovado; Vite reportou o aviso existente de chunk JavaScript acima de 500 kB.
- `git diff --check`: aprovado após a revisão final; os arquivos desta entrega também não têm espaços em branco ao fim das linhas.

**Navegador:** não executado; este ambiente não disponibiliza navegador/Playwright. Os links e estados foram validados pelos testes jsdom, mas a revisão visual em desktop/mobile e por teclado segue pendente.

**Banco/integrações:** não se aplica; não executar migration nem teste que grave lead.

**Produção:** nenhuma consulta, alteração, migration, ativação de gate, envio de mensagem ou publicação foi realizada.

## Pendências para revisão institucional antes de publicação

- Razão social completa associada ao CNPJ já exibido no site.
- Endereço/canal oficial para solicitações de privacidade e confirmação sobre encarregado.
- Prazo e critério de retenção para leads CPC e de simuladores.
- Confirmação dos fornecedores ativos em produção (banco, e-mail, analytics e monitoramento), finalidade, escopo e eventual transferência internacional.
- Revisão/aprovação da Mercúrio e do responsável jurídico antes de retirar o status de minuta ou habilitar CPC.
