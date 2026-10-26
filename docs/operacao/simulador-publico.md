# Simulador público de Home Equity

## Escopo atual

O simulador está disponível na landing page e na rota pública `/simulador`. O toggle da tela permite escolher entre o simulador de parcelas/Home Equity e o simulador de amortização. Ambos reproduzem a captura completa em quatro etapas:

1. dados da operação (valor do imóvel e crédito no Home Equity; valor, data, taxa, sistema e prazo na amortização);
2. dados de contato e consentimento;
3. tipo, situação e CEP do imóvel;
4. perfil, objetivo e intenção de contratação.

No modo amortização, a primeira etapa acrescenta data de início, taxa e periodicidade, sistema Price ou SAC e quantidade de parcelas (até 320). O resultado mostra resumo, gráfico e cronograma com juros, amortização, parcela e saldo.

O seletor entre os modos usa uma pílula segmentada com dois estados claramente ativos/inativos, ambos usando o vermelho Mercúrio quando selecionados. Os campos de data, taxa, quantidade, moeda e seleções nativas compartilham altura, borda, raio, tipografia e foco visível; os `selects` exibem apenas um indicador de abertura para manter o padrão visual da Mercúrio em desktop e mobile.

O resultado usa o mesmo motor de cálculo de `app/src/lib/credito.ts` utilizado no módulo autenticado. A v1 usa taxa estimada de 1,29% a.m., sistema PRICE e prazo de 240 meses. Os limites de LTV seguem as regras documentadas do wizard: 60% para apartamento, 50% para casa, 40% para imóveis comerciais e 30% para terrenos.

## Dados e privacidade

Na v1 o estado ficava somente na sessão do navegador. Na v2, após o consentimento, o envio é validado pela Edge Function `public-simulacao-lead` e gravado em `simulacao_leads_publicos`. O campo `tipo_simulacao` diferencia `home_equity` e `amortizacao`; o segundo modo guarda também sistema, periodicidade, taxa, data inicial, quantidade, parcelas e totais. A tabela é legível apenas por usuários com `role = admin`; parceiros, equipes e clientes não têm acesso. CPF e data de nascimento continuam fora do formulário.

O resultado é enfileirado para o e-mail informado e para os administradores internos por meio de `email_outbox`; o envio efetivo continua sendo responsabilidade do `email-dispatcher`/Resend. O modo amortização usa templates próprios (`simulacao_publica_amortizacao_resultado_v1` e `simulacao_publica_amortizacao_novo_lead_interno_v1`). A tela interna fica em `/admin/leads/simulacoes`, com filtros por busca, período e estado dos e-mails, identificando o tipo e os detalhes de cada modo. Ela é somente leitura nesta etapa.

### Identidade visual dos e-mails

Os templates de resultado enviados aos clientes estão versionados em `supabase/templates/transacional/` e nas migrations `20261020000001_brand_simulador_result_email_templates.sql` e `20261020000002_email_template_brand_images.sql`. Os resultados de calculadora e proposta usam `https://www.mercuriocapitalsa.com.br/03.png`; avisos internos e convites de equipe usam `/02.png`. Os arquivos originais estão em `app/public/`; os três caminhos foram publicados na Vercel e verificados como `200 image/png` em 2026-10-20. A migration `20261020000002` foi aplicada em produção nessa data.

Os templates Auth estão versionados em `supabase/templates/auth/`: convite usa `/01.png`, e confirmação, magic link, recuperação, alteração de e-mail e reautenticação usam `/02.png`. O convite Auth é compartilhado entre parceiros e usuários internos; por isso ambos recebem a imagem de convite. O reenvio dedicado de convite de parceiro envia seu HTML pelo `email_outbox` e também usa `/01.png`.

Os templates Auth são separados e ficam em `supabase/templates/auth/`. Os arquivos são configurados para o Supabase local pelo `config.toml`; em projetos hospedados, devem ser copiados manualmente em Authentication → Email Templates. O template `email_change.html` cobre alteração de e-mail, e `reauthentication.html` mostra o código OTP por meio de `{{ .Token }}`. A configuração local não altera o dashboard hospedado, SMTP, secrets ou fluxo de autenticação.

Validação estática: `node supabase/scripts/validate-email-templates.mjs`. Ela verifica os placeholders de cada tipo, o asset público, os links do rodapé, os códigos e variáveis da migration e os caminhos locais do Auth. Em 2026-10-20, `admin-partner-invite-resend` foi publicada na versão 6. Nenhum e-mail de teste ou convite real foi enviado. Templates Auth no projeto hospedado continuam sendo configurados manualmente em Authentication → Email Templates; os arquivos em `supabase/templates/auth/` não sincronizam o Dashboard.

A captura usa chave de idempotência por envio, validação server-side, honeypot e rate limit. O consentimento é registrado com sua versão. Nenhuma consulta Bacen/Serasa é disparada pelo simulador.

O resultado informa que é uma estimativa e que IOF, tarifas, análise de crédito e condições finais podem alterar a parcela. O CTA do e-mail usa `configuracoes_sistema.simulador_contato_url` quando houver URL HTTPS configurada; caso contrário, volta ao simulador. A captura não cria uma proposta automaticamente.

No Home Equity, a seleção posterior do tipo de imóvel atualiza o teto do crédito pelo LTV correspondente e reduz automaticamente um valor acima desse teto. A etapa de imóvel informa o percentual e o valor máximo. O envio revalida esse limite; a função SQL continua sendo a validação final. O cálculo e a captura do modo amortização não são alterados.

## Validação e release

Validações executadas:

- `npm run test -- --run` — 25 arquivos e 86 testes aprovados;
- teste específico do simulador público — fluxo completo e bloqueio sem consentimento;
- `npm run typecheck` — aprovado;
- `npm run lint` — 0 erros; permanecem avisos preexistentes do projeto;
- `npm run build` — aprovado, com o aviso preexistente de chunks acima de 500 kB;
- validação manual em `/simulador` e na landing, em desktop e viewport móvel.
- fluxo local da v2 até a etapa final e estado de erro recuperável quando a Edge Function não está disponível.
- fluxo local do modo amortização com captura completa, Price/SAC, datas e cobertura do payload enviado à validação server-side;
- controles da etapa inicial revisados com toggle segmentado e campos padronizados;

A implementação da v2 inclui migration, Edge Function, tela interna e testes. A migration `20261005000003_simulacao_leads_publicos` já estava aplicada no projeto Supabase `mercurio`; a extensão `20261007000001_simulacao_amortizacao_publica.sql` também foi aplicada em 2026-10-07. Em 2026-10-08, a migration `20261007000002_simulacao_planos_contato.sql` foi aplicada e a Edge Function `public-simulacao-lead` passou à versão 3 com `verify_jwt=false`. Os secrets existentes da infraestrutura de e-mail foram preservados.

Smoke remoto executado com dados sintéticos: o lead foi persistido, uma mensagem para o prospect e oito notificações internas foram criadas no `email_outbox`, e todas terminaram com status `enviado`. A mensagem do prospect foi endereçada a `contato@visionerifatta.space`.

Acesso validado diretamente no banco: o registro de smoke e as nove mensagens relacionadas foram conferidos com credencial privilegiada; `anon` foi bloqueado por privilégio/RLS ao tentar consultar a tabela e a view. A confirmação de ingestão e do dispatcher foi feita pelo banco remoto e pelo `email-dispatcher` do próprio Supabase.

O frontend de amortização, os planos extras e a reformulação dos leads foram publicados na Vercel em 2026-10-08, com autorização específica web. O empacotamento e release dos instaladores Electron continuam separados e pendentes.

## Extensão local de planos e contato de leads

A continuação implementada localmente e validada em `2026-10-08` permite revisar o resultado antes de gravar a captura. O usuário pode incluir até 10 planos de amortização, cada um único ou mensal, iniciando após uma parcela indicada e reduzindo prazo ou valor das parcelas. A repetição mensal usa o mesmo valor a partir do mês escolhido até a quitação; valores excedentes são limitados ao saldo restante. O comparativo é recalculado em Price ou SAC.

O cronograma na tela exibe 12 parcelas por página e alterna entre os cenários. **Salvar como PDF** usa a impressão nativa do navegador, inclui a marca Mercúrio, resumo comparativo e os dois cronogramas completos; o PDF é gerado localmente e não é armazenado no servidor. A captura final envia os planos e o resumo calculado pela Edge Function/RPC, sem persistir as 320 linhas do cronograma. Os e-mails do prospect e da equipe incluem o resultado comparativo.

O painel `/admin/leads/simulacoes` formata telefone e valores, mostra planos e economia estimada, e oferece link `wa.me` com mensagem pré-preenchida. A mensagem só é aberta após clique do operador; o sistema não envia mensagens automaticamente. Em **Configurações > Classificador de leads**, uma seção separada permite configurar texto padrão e até 20 regras por tipo da calculadora, faixa de valor e prioridade. Essas condições servem apenas para a mensagem de contato e não alteram classificação ou distribuição operacional.

### Consulta interna dos leads

Em 2026-10-23, a apresentação local de `/admin/leads/simulacoes` passou a incluir indicadores e um mapa com o asset `app/src/assets/maps/world.svg`. O mapa representa a localização do imóvel/projeto: CPC usa cidade/UF recebidas no cadastro; os simuladores usam o CEP do imóvel, resolvido pela API ViaCEP já utilizada no cadastro de propostas. O ViaCEP retorna cidade/UF, não coordenadas, então o painel destaca Brasil e distribui os registros por UF. Registros sem local válido são contabilizados separadamente. Indicadores são calculados dos leads carregados e filtrados, e a taxa mostrada corresponde a e-mails de prospect com estado `enviado`, não a respostas comerciais. A listagem mantém detalhe, WhatsApp, filtros de data e e-mail e paginação de 50; mostra seis leads primeiro e oferece “Ver todos os leads” para acessar a lista paginada.

### Estado comercial e mapa interativo (preparação local)

O estado comercial dos leads públicos tem três valores: `novo`, `em_contato` e `qualificado`. É independente dos estados de entrega de e-mail e da classificação/distribuição de propostas. A migration `20261023000001_lead_status_comercial.sql` cria `lead_status_comercial` (estado atual, uma fonte por lead) e `lead_status_comercial_historico` (transições com ator e data). Leads sem alteração explícita aparecem como **Novo**; isso não significa que tenham sido contatados. Uma RPC autenticada grava cada alteração e histórico na mesma transação, exige admin operacional (`full` ou `limitado`) e rejeita alterações sobre estado desatualizado. Admin jurídico mantém leitura. O frontend atualiza a lista após a resposta da RPC e informa conflito/erro sem simular sucesso. A mudança não dispara e-mail nem WhatsApp.

O SVG mundial existente agora é renderizado com caminhos por país para hover/foco. Ao selecionar o Brasil, a tela usa uma cópia local dos limites das 27 UFs obtida da [API de malhas geográficas do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), consulta `paises/BR?intrarregiao=UF&qualidade=minima` em 2026-10-23. O mapa oferece roda/trackpad e botões de zoom, arraste, restauração, retorno ao mundo e seleção de UF. Somente o Brasil recebe contagem de leads, pois as fontes atuais fornecem cidade/UF brasileiras; outros países exibem zero com localização não identificada. A lista considera até os 500 registros mais recentes, limite preexistente da view no cliente.

Essa extensão está aplicada no projeto Supabase `mercurio` (`bhagksfvszeogtjvjtpx`) pela migration `20261023000001_lead_status_comercial.sql` em 2026-10-23. `supabase migration list --linked` confirmou a versão no histórico remoto. Smoke local: `supabase/smoke-tests/fase-48-lead-status-comercial.sql` em banco de teste após a migration; o script usa IDs sintéticos e termina com `ROLLBACK`. A interface autenticada ainda requer validação integrada no ambiente em que o frontend atualizado estiver publicado. Não executar o smoke no banco de produção sem adaptar os dados e a autorização ao ambiente.

Em `2026-10-08`, a lista foi reorganizada em seis colunas: lead e contato, tipo da simulação, crédito e parcela, estado dos dois e-mails, data de recebimento e ações. Imóvel, perfil, origem e detalhes financeiros são consultados em um painel lateral, que mantém os filtros e a página atual. A busca, os limites opcionais de data, o filtro de estado e a paginação de 50 itens preservam as consultas existentes; a tela continua limitada às 500 simulações mais recentes retornadas pela view administrativa.

O painel mostra operação, imóvel, perfil, estados de e-mail, planos e comparativo quando esses campos existem no registro. Datas civis são apresentadas em `dd/mm/aaaa`, valores em reais, telefones e CEPs são formatados, e campos ausentes são identificados sem transformá-los em zero. A lista mantém os badges dos e-mails separados para prospect e equipe. A ação acessível de WhatsApp abre uma mensagem pré-preenchida após clique e informa quando o telefone é inválido.

O painel é um diálogo modal acessível, com retorno de foco ao botão que o abriu, navegação por teclado e rolagem própria. Em telas estreitas, os filtros se empilham, a tabela rola dentro da própria área e o painel ocupa a largura disponível. Não houve mudança na view, RLS, gravação de dados, mensagens configuradas nem motor financeiro.

Validação desta reorganização: `npm test -- src/test/adminLeadsSimulacoes.test.tsx` — 8 testes aprovados; `npm test` — 28 arquivos e 101 testes aprovados; `npm run typecheck`, lint dos arquivos alterados e `npm run build` — aprovados. O lint geral não encontrou erros e reportou 38 avisos em arquivos fora desta mudança. Smoke visual local com fixtures fictícias em Chrome conferiu desktop, viewport de 320 px, calendário localizado, filtros, paginação com 53 registros, diálogo/teclado, WhatsApp como link somente para revisão e estados de carregamento, erro e vazio. Nenhum lead foi gravado nem mensagem enviada.

A migration `20261007000002_simulacao_planos_contato.sql`, o wrapper de captura e a extensão da Edge Function foram ativados em 2026-10-08 com GO específico do dono. A tabela de mensagens e sua alteração exigem admin completo; a captura continua restrita à Edge Function/service role, e a view administrativa mantém a política de acesso existente. Nenhum e-mail de teste foi enviado nessa publicação.

### Verificações desta extensão

- Testes unitários cobrem cenário sem extra, amortização única e mensal, redução de prazo/parcela, teto do saldo e regras/URL do WhatsApp.
- Teste de fluxo confirma que as quatro etapas exibem uma prévia sem gravar; a gravação ocorre após revisar e salvar, com os planos finais no payload.
- `fase-40-planos-amortizacao-contato.sql` reúne verificações estruturais e de privilégios para rodar somente após publicação aprovada; não insere lead nem envia mensagem.
- A validação visual real do PDF impresso permanece pendente. A ativação remota e a publicação web estão registradas abaixo.

### Publicação web e backend — 2026-10-08

- Deploy final READY: `dpl_HprnEB7yyi6wBAn8upRfuRqEh338`, promovido para `https://www.mercuriocapitalsa.com.br`; versão pública em `/simulador`.
- Build final feito na Vercel com variáveis de produção. Uma tentativa anterior de build local recebeu placeholders de variáveis sensíveis, falhou no navegador e foi revertida antes da publicação final corrigida.
- Smoke remoto fase 40 confirmou schema, RPC, privilégios e política de admin completo. Smoke transacional conferiu planos/comparativo, resumo no outbox e idempotência; rollback confirmado sem registro ou mensagem persistida.
- Navegador em produção conferiu toggle, campos, prazo inválido, consentimento, quatro etapas até prévia e recálculo do plano extra. Não foi acionado o botão final de captura; o envio efetivo de novos e-mails não foi validado nesta publicação.
- Suíte atual: 28 arquivos/103 testes; typecheck, lint sem erros (38 avisos existentes), build e diff check passaram. Rotas públicas e arquivos estáticos responderam 200.
- A correção da edição dos valores de imóveis/LTV também está neste deploy. Instaladores Electron, tags e release mobile não foram gerados/publicados.

Evidências e rollback: [plano da publicação web](../../prompts/2026-10-08-deploy-web-vercel.md).

## Ajuste local posterior à publicação — 2026-10-08

Resumo da amortização ajustado para total extra efetivamente aplicado, prazo final/redução em meses e economia de juros, sem repetir a redução do total pago. Controles de objetivo/frequência dos planos e cenários do cronograma usam a exclusão do estilo global para manter estado ativo vermelho e texto branco. Ver [plano e validações](../../prompts/2026-10-08-correcao-captura-parcelas-estados-amortizacao.md). Esses ajustes estão locais, ainda não publicados. O erro relatado na captura de parcelas segue em diagnóstico; não houve mudança de contrato ou liberação de captura por GET.

## Rollback

Para desligar a captura sem remover a v1, retire o toggle/ramo de amortização e mantenha o fluxo Home Equity. Em ambiente remoto, desative o envio do `tipo_simulacao = amortizacao` antes de qualquer reversão de migration. Os registros e a fila devem ser preservados até decisão de retenção; não há `DROP TABLE` automático.

## Piso de crédito das calculadoras — implementação local

Regra aprovada em 2026-10-08: o valor mínimo é R$ 400.000 nas calculadoras públicas de Home Equity e amortização. No Home Equity, o crédito também precisa caber no LTV do tipo de imóvel (apartamento 60%, casa 50%, comercial 40%, terreno 30%). Se o imóvel não suportar o piso, a interface explica o crédito máximo atual e o valor mínimo estimado do imóvel necessário. Amortização aplica o piso ao principal e não calcula LTV, pois não pede valor do imóvel.

A validação existe no formulário, na Edge Function e em migration insert-only para novas capturas. A migration não reescreve registros anteriores e aceita repetição idempotente de uma captura histórica já existente. A fórmula de parcelas, taxas, prazos e planos de amortização não foi alterada.

**Produção ativada em 2026-10-08:** migration `20261008000001_minimo_credito_simulacoes_publicas` aplicada ao projeto Supabase `bhagksfvszeogtjvjtpx`; `public-simulacao-lead` ativa na versão 4, mantendo `verify_jwt=false`; Vercel deploy `dpl_BTHtgzPZMJ5UqvEc1aH739vmAUAi` promovido para os domínios `mercuriocapitalsa.com.br` e `www.mercuriocapitalsa.com.br`. A rota `/simulador` responde 200 em `www`; o domínio sem `www` redireciona para o canônico.

Validação local: 28 arquivos e 106 testes passaram, typecheck e build passaram, lint sem erros (38 avisos preexistentes) e `git diff --check` passou. No navegador em produção, R$ 399.999,99 foi bloqueado e R$ 400.000 aceito na amortização; no Home Equity, imóvel comercial de R$ 850.000 mostrou capacidade de R$ 340.000 e exigência de imóvel de R$ 1.000.000. Testes HTTP sintéticos da função retornaram `valor_credito_minimo_400000` abaixo do piso e `valor_credito_acima_ltv` acima do LTV, ambos antes de qualquer gravação. Nenhum lead ou e-mail foi criado. O histórico remoto confirma a migration aplicada; o smoke SQL estrutural foi preparado, mas não executado.

## Impressão do cronograma de amortização — revisão local em 2026-10-20

O documento de impressão agora é montado em fluxo normal diretamente no `body`, sem o posicionamento absoluto que prejudicava a paginação. A largura é limitada à área imprimível de A4, as tabelas repetem o cabeçalho nas páginas seguintes e as linhas não quebram no meio. O PDF e o botão só aparecem depois que ao menos um plano extra válido foi salvo; se o último plano for removido, ambos deixam de estar disponíveis. O documento inclui o gráfico comparativo das parcelas em SVG estático, com dados do mesmo comparativo exibido na tela, além dos resumos e dos dois cronogramas.

Validação local no Chrome headless em `/simulador`, usando dados sintéticos e sem acionar o envio do lead: o PDF de 240 parcelas gerou sete páginas. As páginas renderizadas foram revisadas; o início apresenta logo, resumo e gráfico, as tabelas continuam com cabeçalho repetido e a última página fecha com o rodapé sem corte lateral. O teste automatizado cobre PDF indisponível sem plano, disponibilidade após salvar e remoção ao excluir o último plano. Esta alteração permanece local; nenhum deploy ou alteração de backend foi feito.

Verificações desta correção: 35 arquivos e 130 testes passaram (`npm test -- --maxWorkers=2 --testTimeout=15000`), typecheck e build passaram, e o lint terminou sem erros (38 avisos preexistentes).
