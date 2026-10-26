# Plano — simulador público na landing page

## Objetivo

Adicionar à rota pública uma calculadora de simulação de Home Equity, acessível a parceiros e clientes sem autenticação e integrada à landing page da Mercúrio. O fluxo seguirá a referência do Simulador Bext em quatro etapas, usando os componentes visuais existentes da Mercúrio e o mesmo motor de cálculo já usado no módulo de parceiros.

O resultado será apresentado como uma estimativa, sem promessa de aprovação ou proposta vinculante. A primeira versão deve permitir que a pessoa simule o valor, veja parcela, taxa e prazo estimados e escolha um próximo contato seguro.

## Documentos e referências lidos

- `docs/README.md`
- `docs/blueprint/01-architecture.md`
- `docs/blueprint/03-routes-navigation.md`
- `docs/blueprint/04-database-schema.md`
- `docs/blueprint/06-modules-features.md`
- `docs/blueprint/07-integrations-flows.md`
- `docs/operacao/change-management.md`
- `docs/operacao/security-checklist.md`
- `docs/operacao/runbooks.md`
- Referência visual e comportamental enviada no Trello: Simulador Bext, URL de Home Equity e seis capturas do fluxo.

## Código inspecionado

- `app/src/pages/Landing.tsx`: landing pública atual e seus CTAs.
- `app/src/router.tsx`: rotas públicas, de cliente e de parceiro.
- `app/src/components/SimuladorCredito.tsx`: formulário e integração existente com o cálculo.
- `app/src/components/MoneyInput.tsx`: entrada monetária em reais.
- `app/src/lib/credito.ts`: cálculo de Price/SAC, juros, prazo, LTV e renda mínima.
- `app/src/pages/partner/Simulacoes.tsx`: fluxo autenticado de simulações e conversão em proposta.
- `app/src/lib/simulacaoDraft.ts`: formato do rascunho usado pelo wizard de parceiro.
- `supabase/migrations/20260513000003_originacao.sql`: tabela `simulacoes` e suas políticas RLS.

## Decisões e suposições para a v1

1. O escopo inicial é Home Equity, pois a referência do Trello é o simulador de Home Equity. A inclusão de Crédito Construção ou Financiamento Imobiliário fica para uma decisão posterior.
2. A calculadora reutilizará `calcularFinanciamento` e `calcularLTV`; não haverá um segundo motor de cálculo no navegador.
3. A taxa e os limites devem vir de configuração já existente ou de constantes explicitamente documentadas. Na ausência de uma configuração pública aprovada, a v1 usará a regra atual do simulador compartilhado e exibirá os valores como estimativas.
4. A experiência terá quatro etapas: valores da operação; contato; imóvel; perfil. Campos de CPF e data de nascimento só serão coletados se forem necessários para o encaminhamento aprovado. Para uma calculadora pública, a recomendação inicial é não persistir esses dois campos.
5. O primeiro resultado poderá funcionar localmente no navegador. Caso o produto exija criar lead/simulação após o contato, isso será feito por uma função ou RPC segura no servidor, com validação, consentimento e limitação de abuso. O navegador não poderá inserir anonimamente em `simulacoes` nem chamar RPC de parceiro/admin.
6. A landing terá uma seção/âncora para iniciar a calculadora. Também será criada uma entrada pública compartilhável (`/simulador`) que usa o mesmo componente, sem duplicar a regra de negócio.
7. O CTA final encaminhará para o canal aprovado pela Mercúrio, sem criar automaticamente uma proposta autenticada e sem expor dados privados na URL.

## Modelo de dados e segurança

### Sem persistência na primeira entrega

O estado do formulário e o resultado permanecem na sessão do navegador. Nenhuma tabela nova é necessária. Essa é a opção mais segura para validar o cálculo e o UX antes de ativar captação de leads.

### Se a captação for aprovada junto com a implementação

Será criado um endpoint server-side dedicado, ou uma RPC com contrato mínimo, para gravar um lead de simulação. O registro deverá conter apenas os dados necessários: produto, valor do imóvel, crédito solicitado, prazo, taxa aplicada, tipo/situação do imóvel, CEP, renda e preferências de contato, consentimento e origem/UTM. O estado inicial será `aguardando_classificacao`.

O endpoint deverá rejeitar payloads inválidos, limitar frequência por origem, registrar auditoria técnica sem dados sensíveis e aplicar RLS/política de acesso para equipe autorizada. Chaves, tokens, Serasa/Bacen e qualquer credencial continuarão somente no servidor.

## Arquivos esperados

- `app/src/components/PublicSimulator.tsx` ou equivalente, com o fluxo de quatro etapas e estados de validação.
- `app/src/pages/public/Simulador.tsx`, caso a rota compartilhável seja separada da seção embutida.
- `app/src/pages/Landing.tsx`, para a seção e o CTA da landing.
- `app/src/router.tsx`, para a rota pública `/simulador`.
- `app/src/lib/credito.ts` ou arquivo de configuração de produto, apenas se for necessário expor regras sem duplicação.
- Testes unitários do cálculo/validação e, se houver persistência, migration/RPC e smoke test correspondente.
- Documentação operacional em `docs/operacao/` descrevendo premissas de taxa, LTV, disclaimer, consentimento e procedimento de rollback.

## Requisitos e critérios de aceite

- A calculadora abre a partir da landing e da rota pública sem login.
- O fluxo possui quatro etapas, indicador de progresso, voltar/avançar e validação de campos obrigatórios.
- Valor do imóvel e valor solicitado usam máscara de reais; o crédito respeita mínimo de R$ 100.000 e o limite de LTV aplicável.
- O cálculo apresentado é o mesmo motor usado no módulo autenticado e inclui taxa, parcela estimada, prazo e aviso de que não é aprovação.
- O resultado trata valores inválidos, limite de crédito excedido, imóvel abaixo do mínimo e campos incompletos com mensagens claras.
- A interface reproduz a referência de hierarquia, cards, barra de progresso e ações, adaptada às cores e tipografia já usadas pela Mercúrio.
- O layout funciona em desktop e mobile, respeitando redução de movimento e acessibilidade básica de teclado/labels.
- Nenhuma rota pública consulta ou expõe propostas, usuários, `simulacoes` protegidas ou credenciais.
- Se a captação server-side fizer parte do escopo aprovado, o consentimento é obrigatório e o erro de envio não apaga o resultado local.
- A alteração é reversível: remoção da seção/rota e, se aplicável, desativação da função de captação sem alterar propostas existentes.

## Considerações de segurança e LGPD

- Não enviar tokens, chaves de serviço ou chamadas de Serasa/Bacen para o navegador.
- Não usar CPF/data de nascimento na v1 sem necessidade de negócio e base legal definida.
- Exibir consentimento e política de privacidade antes de enviar dados de contato.
- Sanitizar e validar todos os valores no servidor quando houver persistência.
- Não prometer aprovação, taxa final ou prazo de liberação; deixar explícito que a simulação é indicativa.
- Evitar dados pessoais em query string, logs de frontend ou mensagens de erro.

## Verificações previstas

### Automatizadas

- Testes unitários para LTV, mínimo/máximo do crédito, Price/SAC, arredondamento monetário e bloqueio de avanço inválido.
- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.
- Se houver migration/RPC: validação local e smoke SQL sem inserir dados reais.

### Manuais no navegador

- Abrir a landing deslogado e iniciar a calculadora.
- Percorrer o fluxo feliz nas quatro etapas e conferir o resultado.
- Testar voltar, atualizar a página, teclado, campos vazios, valores abaixo/acima dos limites e CEP inválido.
- Conferir desktop, viewport estreito e preferência por redução de movimento.
- Confirmar que nenhuma chamada pública retorna dados de propostas ou falha por ausência de autenticação.
- Se houver captação: testar consentimento, sucesso, erro/reenvio e limite de frequência com dados de teste não reais.

## Limites de mudança e release

Esta etapa cobre código local, testes e documentação. Não aplicar migration remota, publicar na Vercel, alterar DNS, enviar e-mail ou criar leads reais sem uma aprovação de release separada depois das validações locais.

## Estado após aprovação

- Implementado localmente em `app/src/components/PublicSimulator.tsx`.
- Landing integrada em `app/src/pages/Landing.tsx` e rota pública `/simulador` adicionada em `app/src/router.tsx`.
- Teste de fluxo em `app/src/test/publicSimulator.test.tsx`.
- Validações executadas: `npm run test -- --run` (22 arquivos, 77 testes), `npm run lint` (0 erros; avisos preexistentes), `npm run typecheck` e `npm run build` concluídos.
- Validação manual concluída em `/simulador` e na landing em viewport desktop e móvel.
- Não houve migration, persistência de lead, deploy ou alteração remota.
