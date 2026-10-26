# Plano — simulador público de amortização

## Objetivo

Adicionar uma segunda calculadora pública ao mesmo caminho `/simulador`, com um toggle visível para alternar entre:

- **Simulador de parcelas/Home Equity**, preservando o fluxo atual de quatro etapas, a captura v2 e seus limites;
- **Simulador de amortização**, com os sistemas Price (parcelas fixas) e SAC (parcelas decrescentes), seguindo os dados e a hierarquia visual da referência fornecida e usando os tokens de cor da Mercúrio.

O mesmo seletor também deve aparecer quando o componente é embutido na landing page. Não será criada uma nova rota.

## Skills e documentos lidos

- `docs/README.md` — fonte de navegação e convenções do projeto;
- `docs/operacao/change-management.md` — plano obrigatório, aprovação, modelo de dados, testes e rollback;
- `docs/operacao/simulador-publico.md` — contrato atual do simulador público, captura v2 e rollback;
- `docs/blueprint/01-architecture.md` — stack, fronteiras cliente/servidor e cálculo compartilhado;
- `docs/blueprint/03-routes-navigation.md` — rota pública `/simulador` e landing;
- `docs/blueprint/04-database-schema.md` — ausência de persistência para o simulador rápido e contratos existentes;
- `docs/blueprint/08-security-compliance.md` — segredos, LGPD, rate limit e fronteiras de integração;
- `docs/09-roadmap.md` e `docs/12-finalizacao.md` — cálculo Price/SAC já existente e gates de release.

Não existe `README.md` na raiz do repositório; o README de escopo é `docs/README.md`.

## Código inspecionado

- `app/src/components/PublicSimulator.tsx` — fluxo público atual, estados, captura de lead e resultado;
- `app/src/pages/public/Simulador.tsx` — composição da rota pública;
- `app/src/pages/Landing.tsx` — uso embutido do simulador na landing;
- `app/src/router.tsx` — rota `/simulador` existente;
- `app/src/lib/credito.ts` — motor `calcularFinanciamento`, já cobrindo Price e SAC e retornando o cronograma completo;
- `app/src/components/SimuladorCredito.tsx` — tipos, convenções de taxa e limites do simulador autenticado;
- `app/src/test/publicSimulator.test.tsx` e `app/src/lib/credito.test.ts` — cobertura atual do fluxo público e das fórmulas.

## Modelo de dados e decisão de persistência

### Estado local da calculadora

Na primeira implementação do simulador de amortização, o estado será local ao navegador:

- `valorEmprestimo` (R$);
- `dataInicio`;
- `taxaJuros` e `periodicidadeJuros` (mensal/anual, convertidos para taxa mensal antes do cálculo);
- `quantidadeParcelas`;
- `sistemaAmortizacao` (`price` ou `sac`);
- linhas calculadas do cronograma, derivadas pelo motor financeiro existente.

O cálculo continua sendo derivado no navegador para resposta imediata, mas a submissão da captura será feita somente pela Edge Function existente, como no simulador atual. O navegador não receberá nenhum segredo e não fará consultas a Bacen, Serasa ou LLM.

### Resultado

O resultado deverá expor, de forma legível e responsiva:

- valor emprestado;
- total a pagar;
- total amortizado;
- total de juros;
- taxa informada e periodicidade;
- quantidade de parcelas;
- primeira e última parcela;
- data da última parcela;
- sistema escolhido;
- gráfico simples de parcela e amortização mensal;
- tabela detalhada com mês/data, juros, amortização, parcela e saldo.

Os recursos de antecipação/novos planos vistos na referência ficam fora deste primeiro incremento. Só entram com uma decisão de escopo específica, porque exigem regras adicionais de negócio e um modelo de cálculo para cenários comparativos.

### Contato e lead

Os prints incluem nome, e-mail, WhatsApp e consentimento. A captura do modo amortização seguirá as quatro etapas e os mesmos campos do simulador atual: valores, contato, imóvel e perfil. Além disso, enviará os parâmetros próprios da calculadora (`tipo_simulacao`, data inicial, periodicidade da taxa, sistema de amortização, quantidade de parcelas, taxa informada, valor da primeira parcela, valor da última parcela, total pago e total de juros).

O contrato será uma extensão versionada e compatível da tabela `simulacao_leads_publicos`, sem preencher artificialmente campos de Home Equity:

- adicionar `tipo_simulacao` (`home_equity` ou `amortizacao`), mantendo `home_equity` como padrão para registros existentes;
- tornar os campos específicos de garantia (`valor_imovel`, `ltv`, `tipo_imovel`, `situacao_imovel`, `cep`) opcionais para o modo amortização;
- adicionar `data_inicio`, `periodicidade_juros`, `sistema_amortizacao`, `quantidade_parcelas`, `taxa_juros_informada`, `total_pago`, `total_juros`, `primeira_parcela` e `ultima_parcela`;
- manter `valor_credito` como valor principal da operação e os campos de contato/perfil, consentimento, idempotência e estados de e-mail comuns;
- atualizar a view administrativa e `LeadsSimulacoes` para exibir o tipo e os dados próprios de cada modo;
- versionar a Edge Function e a RPC de captura com validação específica por `tipo_simulacao`, preservando o contrato atual do modo Home Equity;
- reutilizar `email_outbox`, com templates versionados para o resultado ao prospect e a notificação interna contendo Price/SAC, taxa, prazo e resumo da simulação.

Relacionamentos: um registro em `simulacao_leads_publicos` representa uma submissão idempotente; seus e-mails têm `email_outbox.referencia_id` apontando para esse lead. Não será criada proposta automaticamente.

## Decisões de interface

- Toggle no topo do cartão público, com rótulos claros **Simulador de parcelas** e **Amortização**;
- mesma rota e mesmo componente público, sem alterar a URL;
- layout da referência reproduzido em estrutura, estados, hierarquia, campos e resultado, adaptado responsivamente;
- cores, tipografia, bordas, botões e componentes reutilizados da Mercúrio (`navy`, `red`, `silver` e utilitários existentes);
- Price: parcelas constantes dentro da precisão monetária adotada;
- SAC: amortização constante e parcelas decrescentes;
- validações explícitas para valores inválidos, taxa negativa, prazo inválido e data ausente;
- datas calculadas a partir da data inicial, sem depender do fuso do servidor;
- tabela extensa com rolagem acessível e gráfico sem bloquear o formulário.

## Arquivos esperados

- `app/src/components/PublicSimulator.tsx` — composição do toggle e preservação do fluxo atual;
- `app/src/components/PublicSimulatorModeToggle.tsx` — seletor compartilhado entre os dois modos;
- `app/src/components/PublicAmortizationSimulator.tsx` — formulário, resultado, cronograma e gráfico da nova calculadora;
- `app/src/lib/amortizacaoPublica.ts` — conversão de taxa e datas do cronograma;
- `app/src/test/publicSimulator.test.tsx` — regressão do toggle e preservação da captação existente;
- `app/src/test/publicAmortizationSimulator.test.tsx` — validações, Price, SAC, resumo, tabela e datas;
- `app/src/lib/credito.test.ts` — casos adicionais somente se o adapter de taxa/data for alterado;
- `supabase/migrations/<timestamp>_simulacao_amortizacao_publica.sql` — extensão compatível da tabela/view/RPC/templates, RLS e índices;
- `supabase/functions/public-simulacao-lead/index.ts` — payload e validação do modo amortização sem expor segredos;
- `app/src/pages/admin/LeadsSimulacoes.tsx` — identificação e detalhe dos leads de amortização;
- `docs/operacao/simulador-publico.md` — contrato, limites e instruções de rollback atualizados;
- este plano permanece como registro de escopo e aprovação.

Não se espera alteração em `mobile/`, Electron, updater ou integrações externas nesta etapa. A parte Supabase/Edge entra somente como contrato preparado localmente; publicação remota e Vercel permanecem gates separados.

## Requisitos e critérios de aceite

1. `/simulador` abre o simulador atual sem regressão e permite alternar para amortização sem navegar.
2. A landing mostra o mesmo toggle e mantém o fluxo atual de Home Equity.
3. Price mantém a parcela dentro de uma tolerância de centavos e SAC reduz o valor da parcela a cada período, salvo arredondamento final.
4. O resumo e a tabela fecham com o valor principal, juros totais e saldo final próximo de zero.
5. Periodicidade anual é convertida para a convenção mensal documentada antes do cálculo.
6. A data da última parcela é calculada corretamente para viradas de mês e ano.
7. Campos obrigatórios e entradas inválidas exibem mensagens acionáveis; o formulário não calcula nem envia com dados incompletos.
8. O cronograma permanece utilizável em desktop e viewport móvel, com foco visível e labels associados.
9. Ambos os modos capturam os mesmos dados de contato, imóvel, perfil e consentimento; o modo amortização também persiste os parâmetros e o resumo do cálculo.
10. O simulador de parcelas continua compatível com registros e e-mails já existentes; a extensão não altera o significado dos leads antigos.
11. Leads dos dois modos aparecem para a equipe interna na mesma tela, com tipo e detalhes coerentes.
12. Nenhuma chave privada, chamada externa ou consulta de bureau é adicionada ao navegador.

## Segurança e privacidade

- cálculo local para o resultado e persistência mínima do lead pelo servidor;
- nenhum CPF, documento de renda ou dado de bureau será solicitado;
- Edge Function, validação server-side, rate limit, idempotência, consentimento versionado e templates serão reutilizados/estendidos, nunca uma chamada direta do browser a provedor externo;
- a migration terá rollback aditivo: novos campos e templates podem ser desativados sem apagar leads ou reverter a tabela existente.

## Testes

### Automáticos

- `npm run test -- --run`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`.

### Manuais

- rota `/simulador`: alternar nos dois sentidos e completar o fluxo atual;
- modo Price com taxa mensal, taxa anual, prazo curto e prazo longo;
- modo SAC e verificação de parcela decrescente;
- data inicial no fim do mês e virada de ano;
- valor/taxa/prazo inválidos, estado vazio e tabela com muitas parcelas;
- landing e viewport móvel;
- verificar que cada modo invoca `public-simulacao-lead` somente após consentimento, com payload validado e idempotência;
- confirmar no Admin que um lead de cada modo aparece com os dados correspondentes e que os e-mails prospect/interno entram no `email_outbox`;
- confirmar que não há requests novos a Bacen, Serasa ou LLM.

## Rollout e rollback

O rollout começa com validação local do frontend e dry-run da migration. A publicação remota da migration, Edge Function, templates ou Vercel exige aprovação específica depois dos testes.

Rollback: desativar a opção de amortização e o envio desse `tipo_simulacao` no frontend; manter o modo Home Equity e os registros existentes. Se a parte remota já tiver sido publicada, reverter apenas a função/rotas de captura e os templates novos; não apagar a tabela nem leads, e preservar os novos campos para auditoria.

## Dependência de aprovação

Escopo funcional confirmado: o novo simulador terá a mesma captura completa do simulador atual e notificará prospect/equipe pelo fluxo seguro existente. Antes do código, aprovar o modelo acima: extensão versionada de `simulacao_leads_publicos`, uma view interna unificada e novos dados de amortização validados server-side. A publicação remota continuará sendo um gate separado após a validação local.

## Registro pós-aprovação — 2026-10-07

O modelo foi aprovado e implementado. A migration `20261007000001_simulacao_amortizacao_publica.sql` foi aplicada no projeto Supabase `mercurio`, e a Edge Function `public-simulacao-lead` foi publicada na versão 2. O smoke remoto criou um lead sintético SAC de R$ 100.000 em 12 parcelas, confirmou a segunda chamada idempotente (`created: false`) e verificou no banco uma mensagem para o prospect e oito internas, todas com status `enviado`. A publicação do frontend na Vercel permanece separada para validação visual final.
