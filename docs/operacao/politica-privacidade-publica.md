# Política de Privacidade — mapa operacional

**Estado:** após o usuário informar aprovação jurídica, foram removidos da página pública os marcadores que a chamavam de minuta/em revisão. A alteração permanece local e não foi publicada por este trabalho.

## Escopo da rota

A rota `/politica-de-privacidade` descreve separadamente:

- formulários públicos de Crédito para Construção (CPC), Home Equity e amortização;
- dados tratados em propostas e áreas autenticadas de clientes, parceiros, equipes e equipe Mercúrio;
- consultas externas solicitadas no contexto de propostas;
- classificação e distribuição operacional.

## Identificação institucional

- Mercurio Capital Ltda.
- CNPJ 64.382.034/0001-70.
- Rua 1301, 471, Centro, Balneário Camboriú/SC, CEP 88330-795.

## Fatos confirmados no código e documentação

### Formulários públicos

- CPC coleta nome, e-mail, telefone, fase do projeto e, se informados, cidade/UF e resumo curto. Não pede CPF, documentos, valor de crédito nem endereço completo. A Edge Function valida a configuração no servidor antes de gravar. A configuração efetiva de produção não foi verificada e não foi alterada.
- Home Equity coleta contato, dados da garantia e operação, CEP, renda opcional e perfil da solicitação.
- Amortização coleta contato, dados da garantia, parâmetros do cálculo, planos extras e perfil da solicitação.
- Os simuladores registram leads internos e os fluxos podem enfileirar resultado por e-mail e notificação interna. A simulação pública não solicita CPF/documentos e não executa consulta a bureau durante o cálculo.
- Os endpoints processam IP e e-mail para controles contra abuso; prazos desses registros precisam ser confirmados.
- A seção de direitos disponibiliza um link `mailto:` para `contato@mercuriocapitalsa.com`, com assunto e modelo de solicitação pré-preenchidos. A pessoa completa os próprios dados, revisa e envia pelo aplicativo de e-mail; o site não envia automaticamente.

### Propostas autenticadas

- Propostas e seus vínculos podem tratar identificadores e contato dos proponentes, dados PF/PJ, renda/faturamento, informações da operação e dos imóveis/garantias, documentos enviados, pendências e histórico operacional.
- A tabela `logs_consultas` registra tipo, status, provedor, pedido, resposta/resumo, autor e horários. A Edge Function `consulta-executar` chama provedores reais quando os secrets server-side estão configurados e mantém caminho de falha/estorno. A configuração efetiva dos provedores em produção não foi verificada.
- As políticas do banco restringem acesso a propostas, documentos e logs por perfil, vínculo com a operação e escopo administrativo. Documentos usam bucket privado e URLs assinadas temporárias conforme a documentação de segurança.

### Classificação de leads/propostas

- A função `admin_classificar_proposta_automatico` é uma implementação SQL server-side determinística, protegida por papel administrativo.
- Ela consulta dados de garantia, renda/faturamento, checklist de documentos e pendências; o código revisado não consulta diretamente `logs_consultas` nem chama um LLM.
- A configuração `classificador_ativo` tem default `false` na migration. A configuração efetiva de produção não foi verificada. Quando habilitado, a função pode distribuir internamente casos que atingem o nível de confiança configurado; baixa confiança e sinais jurídicos seguem para revisão.
- O classificador apoia triagem e encaminhamento operacional; não concede nem recusa crédito.
- O plano de LLM documenta uma iniciativa futura de apoio a classificação, checklist e explicação. Não há confirmação de que um LLM receba dados de propostas atualmente.

## Verificações operacionais internas

1. Confirmar se há encarregado indicado e, em caso positivo, seu contato específico.
2. Confirmar quais provedores de consulta estão ativos, quais campos recebem e se respostas completas ou resumos são retidos em produção.
3. Confirmar se o classificador está ativo e se a distribuição automática está habilitada em produção.
4. Confirmar se existe qualquer integração de LLM ativa, que dados usa, qual provedor recebe os dados e a finalidade.
5. Confirmar os fornecedores ativos de hospedagem, banco, e-mail, telemetria e notificações, local de tratamento e eventuais transferências internacionais.
6. Definir prazos de retenção, descarte e tratamento de backups para leads, propostas, documentos, consultas e registros técnicos. A documentação de segurança contém prazos-alvo para alguns itens, ainda não reconciliados com a operação efetiva.
7. Confirmar o estado do gate CPC em produção separadamente; a edição desta página não o altera nem o habilita.

## Referências legais

- [LGPD — texto compilado no Planalto](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), em especial os arts. 6º a 10, 18 e 20.
- [Direitos dos titulares — ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).

As referências foram consultadas na elaboração do conteúdo. A operação descrita deve continuar refletindo a configuração e as práticas efetivamente adotadas.

## Controle da implementação local

- Atualizada a página `app/src/pages/public/PoliticaPrivacidade.tsx` para distinguir formulários públicos, propostas autenticadas, consultas e classificação operacional; removidos o selo de minuta/revisão interna e essa qualificação dos links no formulário CPC e nos dois simuladores públicos. A seção de direitos abre o aplicativo de e-mail com destinatário, assunto e corpo-modelo, sem envio automático.
- Mantidos o conteúdo dos formulários, consentimentos, endpoint CPC e sua configuração. O aviso de indisponibilidade CPC não atribui mais a situação à revisão da política; o controle server-side e seu estado remoto não foram alterados.
- Não foram consultados nem alterados secrets ou configurações remotas; não houve gravação com dados reais, migration, envio de mensagem ou deploy.
- A página não envia e-mail durante a navegação. Nenhum e-mail foi enviado durante a implementação.
- Testes direcionados passaram: 3 arquivos, 12 testes. Lint passou sem erros (38 avisos no projeto), typecheck e build passaram.
- Smoke da versão compilada em Chrome: dados institucionais e link `mailto:` corretos; desktop `1440/1440` e mobile `390/390`, sem overflow horizontal nem ressalvas removidas.
- A política publica a identificação jurídica e o endereço confirmados. As validações de provedores, fornecedores e estado do gate CPC permanecem como controle operacional interno; nenhum estado remoto foi inferido ou alterado.

## Prontidão da candidata isolada — 16/10/2026

- A política e a rota CPC foram compiladas e testadas em uma candidata isolada baseada no commit remoto `3e3d8fa`; a publicação em Preview não ocorreu.
- Na candidata: 22 arquivos e 80 testes passaram; lint sem erros (38 avisos), typecheck, build e validador de release passaram. A build ainda avisa que o bundle principal excede 500 kB.
- O audit completo reporta 5 High e 12 Moderate após atualizações transitivas sem `--force`. A correção High indicada exige Tailwind CSS 4, uma mudança major; o Preview está suspenso até decisão sobre esse escopo.
- A função CPC está ativa, mas o valor atual do gate `cpc_captura_publica_ativa` não foi confirmado por leitura somente. Nenhum dado de formulário foi enviado e nenhuma configuração foi alterada.
- A captura CPC, o Preview e a produção permanecem pendentes; não usar o comportamento da migration inicial como prova do estado remoto.
