# Exportação de simulações para clientes a partir do modelo XLSM

## Objetivo

Atualizar a simulação comercial para produzir um PDF Mercúrio adequado para compartilhar com clientes, usando `docs/Simulador_Mercurio_Capital.xlsm` como referência interna de campos e organização. `/admin/configuracoes` permitirá registrar premissas de IOF, TAC, registro e seguros como rascunho. Esses encargos ficam bloqueados e não alteram os cálculos até validação formal do Financeiro. O XLSM permanece interno e o cliente recebe PDF.

O escopo proposto cobre `/p/simulacoes` e reutiliza a mesma saída no simulador do fluxo administrativo `/admin/propostas/nova`, sem mudar a criação de propostas. A calculadora pública `/simulador` e seus leads ficam fora do escopo e devem manter o contrato e os cálculos atuais.

## Skills e documentos lidos

- Skill `spreadsheets:Spreadsheets`, com orientação de análise e preservação do arquivo-fonte; nenhum conteúdo foi editado e nenhuma macro foi executada.
- `AGENTS.md` fornecido pelo dono do produto nesta conversa.
- `docs/README.md`.
- `docs/operacao/change-management.md`.
- `docs/operacao/release-checklist.md`.
- `docs/operacao/simulador-publico.md`.
- `docs/blueprint/06-modules-features.md`.
- `docs/blueprint/08-security-compliance.md`.

## Código e arquivos inspecionados

- `app/src/pages/partner/Simulacoes.tsx`: calcula em tempo real, exporta atualmente PNG e abre WhatsApp com texto pré-preenchido; não persiste a simulação.
- `app/src/components/SimuladorCredito.tsx` e `app/src/lib/credito.ts`: campos atuais, resultados e cronograma Price/SAC usados pelo simulador comercial; extensão financeira deve ser opt-in para não alterar a calculadora pública compartilhada.
- `app/src/pages/partner/Wizard.tsx` e `app/src/router.tsx`: `/admin/propostas/nova` usa o mesmo componente de cálculo no passo de valores, mas não contém atualmente botões de exportação ou WhatsApp. A rota é um fluxo de criação de proposta, não uma tela administrativa de simulação isolada.
- `app/src/pages/admin/Configuracoes.tsx` e `supabase/migrations/20260513000006_plataforma.sql`: há uma tela de configurações com persistência em `configuracoes_sistema` (JSONB, `updated_by` e `updated_at`), mas não há seção específica para premissas financeiras do simulador. A taxa padrão `taxa_juros_mensal_default` existe como configuração; a tela `/p/simulacoes` ainda usa o valor inicial no código.
- `app/src/components/PublicAmortizationResult.tsx`: referência interna existente para PDF local via impressão do navegador, marca Mercúrio, resumo, cronograma completo e regras de impressão.
- `app/package.json`: React/TypeScript/Vite, já inclui `html-to-image`; não há biblioteca de geração de PDF dedicada.
- `docs/Simulador_Mercurio_Capital.xlsm`: cinco abas (Simulador, Price, SAC, Contrato e Registro; Registro oculta), fórmulas, macros VBA e nomes definidos. A inspeção XML encontrou referências `#REF!` em nomes definidos e cálculo iterativo; o arquivo declara `calcCompleted=0`.

## Decisões propostas e suposições

1. O XLSM será referência interna de campos e fórmulas candidatas, não uma especificação financeira aprovada nem o motor de cálculo. A inspeção encontrou cinco abas (incluindo `Registro` oculta), macros VBA, referências `#REF!` em nomes definidos e `calcCompleted=0`; nenhuma macro será executada e nenhuma fórmula/constante será copiada como regra vigente sem validação.
2. O PDF será montado no aplicativo com a saída do motor Price/SAC e impressão local do navegador, seguindo o padrão visual e de impressão já usado pelo resultado público de amortização. O navegador não abrirá nem executará a planilha ou suas macros.
3. A configuração permite registrar taxa padrão, IOF, TAC, registro, MIP e DFI como rascunho. Até validação formal do Financeiro, IOF, TAC, registro e seguros não entram no motor nem alteram parcelas/totais; o PDF deve indicar explicitamente que não foram calculados. O valor líquido solicitado não pode ser confundido com custos pendentes.
4. A equipe responsável por crédito/financeiro precisa validar fórmulas, bases, faixas, incidências, periodicidade, limites, arredondamento e casos de referência antes de qualquer ativação futura. A planilha sugere composições e incidências apenas como mapa de investigação, não como regra aprovada. Percentuais/valores do arquivo não serão tratados como defaults válidos. Esta implementação não inclui mecanismo de ativação.
5. Separar premissas globais de entradas por operação. Valor do imóvel, principal líquido, prazo, data, saldo devedor, idade, praça e débitos de IPTU/condomínio são dados da operação ou fatores de cálculo, não parâmetros globais. Variáveis por idade, praça ou perfil só entram quando a fonte e a regra estiverem aprovadas. Custos que não possam ser calculados com os dados disponíveis serão explicitados como não incluídos, sem estimativa silenciosa.
6. O status desta versão permanece sempre `aguardando_validacao_financeira`; não há transição para ativo. A tela e o PDF identificam o cálculo sem encargos como prévia e avisam que os valores podem mudar após validação financeira. As entradas de rascunho não são lidas pelo motor e não recalculam simulações.
7. `/p/simulacoes` e o modo administrativo do wizard `/admin/propostas/nova` são as superfícies deste escopo. A calculadora pública `/simulador`, seus formulários/leads, contratos de Edge Function e suas mensagens não serão alterados, pois compartilham partes do motor e declaram custos fora da simulação pública.
8. O compartilhamento continuará manual: WhatsApp abre texto revisável por `wa.me`; o operador/partner baixa o PDF e o anexa manualmente. Não haverá envio automático, upload do documento ou integração Cloud API nesta mudança.
9. Adicionar `Parâmetros do simulador` em `/admin/configuracoes` e reutilizar `configuracoes_sistema` com chave JSONB `simulador_parametros`, versão, estado pendente e bases/parâmetros em rascunho. RPCs controlam o acesso: usuários autenticados autorizados recebem apenas estado e taxa corrente; somente `app_is_admin_full()` pode ler/salvar a configuração completa, com validação no servidor e auditoria. A migration não inventa valores nem ativa encargos. A taxa padrão existente é preservada e pode ser ajustada por admin full.
10. Não criar nova tabela. O JSON de configuração contém `schema_version`, `versao`, `vigente_desde` nulo, status `aguardando_validacao_financeira`, taxa mensal padrão e campos editáveis para IOF, TAC, faixas de registro, MIP e DFI. A auditoria existente registra alterações. Não há campos de validação/ativação nem mecanismo de ativação nesta versão.
11. A paridade numérica com o XLSM não será alegada até comparar casos aprovados com referência financeira independente e reconciliar taxa, capitalização, custos, carência, seguros e arredondamento. As macros não serão executadas.

## Modelo de dados

O PDF é gerado a partir do estado transitório da tela e não é guardado no banco ou em Storage. A simulação continua sem persistência até conversão explícita em proposta. Para premissas globais, reutilizar `configuracoes_sistema` com chave `simulador_parametros`; `updated_by`/`updated_at` e o mecanismo de auditoria existente registram quem alterou e os valores anterior/novo. Não criar tabela nova na primeira versão, desde que a auditoria preserve o snapshot anterior; se não preservar, a lacuna será documentada e o modelo de histórico será submetido à aprovação antes de implementar. O objeto contém schema, versão, vigência, status de validação, taxa, IOF, TAC, registro, MIP e DFI com as respectivas bases e regras aprovadas. Uma RPC autenticada retorna status pendente, versão e taxa padrão corrente; ela não entrega os valores rascunho de encargos. Outra RPC dá leitura/escrita administrativa sob `app_is_admin_full()`. O PDF usa o mesmo cálculo existente da tela e deixa explícito que encargos e, quando aplicável, a variação futura do IPCA não foram projetados. O motor e os contratos de cálculo não ganham via fee-aware nesta versão.

## Arquivos esperados

- Novo `app/src/components/SimulacaoCreditoPdf.tsx` (ou nome equivalente): documento somente para impressão com marca Mercúrio, condições e cronograma.
- `app/src/pages/partner/Simulacoes.tsx`: ação principal de salvar PDF; preservação da ação existente de WhatsApp manual e conversão em proposta.
- `app/src/pages/partner/Wizard.tsx`: reutilização do mesmo documento e do cálculo atual no passo de valores em modo admin, sem alterar persistência ou validações da proposta.
- `app/src/pages/admin/Configuracoes.tsx`: nova seção de parâmetros do simulador, com estado pendente, validação, carregamento e salvamento seguro.
- `app/src/lib/simuladorParametros.ts` e testes de validação dos rascunhos.
- Migration/RPC para ler apenas status/taxa para usuários permitidos e atualizar o rascunho com permissão adequada, validação server-side, versão e auditoria; smoke SQL de privilégios e estado inicial.
- Testes de rascunho: limites de campos, faixas de registro sem sobreposição e confirmação de que nenhuma premissa pendente entra no motor.
- Teste de componente para conteúdo do PDF, cronograma e avisos financeiros, sem inclusão de PII desnecessária.
- Smoke SQL para existência das RPCs, estado inicial seguro, ausência de leitura por parceiro e ausência de execução por `anon`.
- Atualização de `docs/blueprint/06-modules-features.md` e/ou documentação operacional do simulador após validação.

Supabase poderá receber apenas a configuração/migration/RPC aprovada; não há alteração de leads, propostas existentes ou Edge Functions prevista. `mobile/`, Electron, Vercel e release de sistemas operacionais ficam fora desta implementação.

## Requisitos e critérios de aceite

- A ação principal gera uma prévia de impressão limpa e permite salvar como PDF no navegador, com nome de arquivo identificável e sem os controles da tela.
- O relatório apresenta crédito, garantia, LTV, taxa, prazo, sistema Price/SAC, carência, parcelas estimadas e cronograma calculados pelo motor atual. Mostra aviso de que IOF, TAC, registro, seguros e variação futura do IPCA não estão incluídos e podem alterar os valores.
- Nenhum encargo financeiro de rascunho altera o valor financiado, as parcelas ou os totais nesta versão; a RPC pública não expõe esses campos nem possui transição de ativação.
- A tela e o PDF apresentam o cálculo existente como prévia, sem encargo adicional, e mostram estado claro de validação financeira pendente.
- O PDF tem logo Mercúrio, moeda/data no padrão brasileiro, cabeçalho de tabela repetido e linhas que não quebram entre páginas; cronogramas extensos imprimem sem cortes horizontais ou conteúdo duplicado.
- O botão de WhatsApp permanece uma ação do usuário, abre texto pré-preenchido revisável e deixa explícito que o PDF deve ser anexado manualmente.
- Usuário `admin_nivel=full` pode salvar premissas como rascunho. Não existe ação para validar/ativar. Administrador limitado não pode ler ou alterar a configuração completa. Valores inválidos são rejeitados no servidor/RPC e cada atualização é auditada.
- A taxa padrão persistida existente é usada pelo simulador de parceiro e pelo modo admin; configurações de encargos ficam apenas no rascunho e não são consumidas pelo motor.
- A tela e o PDF refletem o mesmo estado do simulador no momento da impressão; salvar um rascunho não altera propostas gravadas nem o resultado público.
- A exportação no modo admin, se habilitada, usa o mesmo componente e não interfere na validação, no parceiro obrigatório, na gravação ou no envio da proposta.
- Não se mostram campos não calculados como zero nem se inferem custos ausentes. As diferenças entre a planilha e o motor atual ficam documentadas; percentuais/valores do workbook não são presumidos como regras comerciais vigentes.
- `/simulador` continua com cálculo, captura, leads e mensagens atuais; testes de regressão confirmam que nenhum encargo/configuração nova vaza para essa rota.
- Nenhuma macro é executada; nenhum dado é enviado ou salvo por gerar o documento.

## Segurança e privacidade

- Gerar o PDF inteiramente a partir do estado já autorizado da página; sem chaves, tokens, service role ou chamadas privadas no navegador.
- Expor a parceiros e usuários internos autorizados somente estado pendente, versão e taxa padrão atual; os campos financeiros de rascunho ficam restritos a admin full e são validados em RPC e auditados.
- Não incluir CPF, telefone, endereço, dados bancários ou outras PII do wizard no PDF por padrão.
- Não usar `wa.me` para enviar mensagem automaticamente; somente abrir uma composição revisável após clique.
- Manter o XLSM interno e não colocá-lo em `public/`, bucket público ou URL acessível ao cliente.
- Não introduzir logs com valores financeiros ou dados pessoais.

## Testes manuais e automáticos

- Unitários: validar campos, percentuais, limites e faixas de registro como rascunho, sem os aplicar ao cálculo.
- Unitários: confirmar que a configuração fica pendente e os encargos não alteram os resultados; conferir avisos e valores consistentes no PDF.
- Unitários/integrados: validar versão de rascunho, leitura/gravação limitada a admin full, estado inicial pendente e evento de auditoria. Nenhuma transição de ativação será testada porque não faz parte deste escopo.
- Regressão: confirmar cálculo, payload/leads e comportamento de `/simulador` sem alteração por IOF/TAC/registro/seguros.
- Componente: confirmar conteúdo do PDF, título/arquivo, botão de impressão, WhatsApp revisável, estados de carregamento/erro e ausência de CPF/endereço.
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` em `app/`.
- Navegador desktop: fluxo Price/SAC conforme disponível em cada tela, alteração das entradas existentes, revisão da impressão e PDF de várias páginas; conferir que parcelas, totais e cronograma batem com a tela e que os encargos ficam explicitamente fora do cálculo.
- Navegador em viewport estreito: layout da simulação, impressão/PDF e texto de compartilhamento.
- Se o modo admin for incluído, validar `/admin/propostas/nova` com usuário operacional autorizado e confirmar que sair/voltar do passo não altera o wizard nem persiste conteúdo do PDF.
- Não enviar mensagens reais, gravar propostas ou leads, executar macros ou publicar durante esses testes. A migration/RPC de configuração fica sujeita à aprovação específica de modelo e a smoke local/ambiente de teste; não aplicar em produção neste escopo.

## Rollout e rollback

- Implementação local e reversível; a migration/RPC de configuração precisa ser aplicada primeiro em ambiente de teste e terá gate de produção separado.
- Revisão do diff e verificações locais antes de solicitar qualquer publicação.
- Publicação web/Vercel exige plano de release e autorização específica posterior. Desktop/Electron, mobile, tags e instaladores ficam fora deste escopo.
- Rollback: reverter o componente de impressão e restaurar o botão atual de exportação PNG, sem afetar a calculadora ou propostas existentes.

## Aprovação e decisão registrada

Aprovado pelo usuário em 13/10/2026, com decisão explícita de gerar o PDF e permitir salvar a configuração como rascunho, mas manter IOF, TAC, registro e seguros bloqueados até validação do Financeiro. Esses campos não alteram o cálculo nesta versão. A planilha contém fórmulas/macros e referências inválidas preexistentes; seus percentuais não são defaults comerciais e nenhuma macro será executada. A rota pública `/simulador` permanece inalterada. A migration e a implementação permanecem locais até solicitação de release/aplicação em ambiente remoto.
