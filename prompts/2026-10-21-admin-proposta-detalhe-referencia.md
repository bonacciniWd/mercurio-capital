# Detalhe administrativo da proposta — referência fornecida

Data: 21/10/2026. Status: implementação local aprovada e executada; revisão visual do produto pendente.

## Objetivo e escopo

Aplicar o componente e CSS fornecidos pelo produto em `/admin/propostas/:id`: cabeçalho, faixa de status, navegação e conteúdo das nove abas. Manter o layout administrativo existente. A listagem `/admin/propostas`, barra lateral e topbar do exemplo estão fora do escopo.

## Documentos, skills e código inspecionados

- Instruções AGENTS.md fornecidas na conversa; não há AGENTS.md ou README.md na raiz consultada.
- `docs/README.md`, `docs/operacao/change-management.md`, seção M3 de `docs/blueprint/06-modules-features.md`.
- Componente anexado em `Texto colado.txt` e CSS enviados pelo produto.
- `app/src/pages/admin/Propostas.tsx`, `app/src/pages/admin/PropostaDetalhe.tsx`, `app/src/router.tsx`, `app/tailwind.config.js`, `app/package.json`.
- Queries e mutations atuais para proposta, cliente, proponentes, imóveis, documentos, histórico e responsáveis; componentes integrados de consultas, contratos, fundos e condição comercial.
- Migrations locais de identidade, originação e evolução do wizard para identificar os campos existentes.
- Nenhuma skill disponível é necessária para esta adaptação React/CSS local.

## Decisões e premissas

- Fonte visual: componente e CSS recebidos, adaptados à stack React 18/Tailwind 3 existente. Não importar Tailwind 4, `@theme` ou resets globais do exemplo.
- Isolar cores, tipografia Manrope, bordas, botões e espaçamentos em um contêiner específico da página. Impedir interferência nas classes genéricas `.button`, `.section`, `.avatar`, `.tabs`, `.progress` e nos efeitos globais de botões existentes.
- Reproduzir desktop e adaptar grids/cards/tabs para mobile com rolagem restrita à navegação ou tabelas necessárias.
- Usar Lucide e componentes existentes, sem dependências novas.
- Preservar ações de edição/salvamento, status, responsável, classificação, fundos, documentos, consultas, contrato e financeiro. Os controles demonstrativos só serão exibidos quando houver ação real correspondente; não criar botões sem comportamento.
- Manter Resumo como aba inicial, seguindo o comportamento atual.
- Preservar os fluxos de autorização documentada, cobrança, reconciliação e loader das consultas.

## Modelo de dados e mapeamento

Não criar tabelas, colunas ou migrations nesta etapa. Relacionamentos existentes: proposta pertence a um cliente/parceiro, possui múltiplos proponentes, imóveis, documentos, pendências, consultas e eventos de status; pode ter responsável e vínculos com fundos.

| Área | Fonte e regra |
| --- | --- |
| Cabeçalho | Protocolo, cliente, produto, datas e responsável da proposta; vínculos de fundo reais, sem escolher arbitrariamente um vencedor. |
| Resumo | Valor solicitado, prazo, carência, sistema, taxa, indexador, cliente e garantias persistidos. Simulação usa o cálculo já existente e identificação de estimativa. |
| Proponentes | Nome, documento, vínculo, estado civil, composição/modelo de renda, renda e endereço disponíveis em `proponentes`. Contato e nascimento do cliente principal somente quando a relação com o proponente estiver confirmada. |
| Imóveis | Tipo, principal, endereço, valor e quantidade dos registros vinculados. LTV calculado com os valores reais. |
| Documentos | Checklist/requisitos existentes; distinguir enviado de aprovado. Progresso documental baseado no checklist efetivo. |
| Pendências | Registros reais e ações já existentes. |
| Consultas | Preços, estados, resultados autorizados e histórico reais; nunca usar os preços ou score do exemplo. |
| Contrato/Financeiro | Estado e versões efetivos dos componentes existentes; manter regras de habilitação/aprovação. |
| Histórico | Eventos existentes de status, sem afirmar que são uma auditoria completa de todas as ações. Busca local nos eventos carregados. |

Campos ilustrativos sem fonte confirmada (nacionalidade, profissão, titularidade, área, saldo devedor, tempo como cliente) não serão preenchidos por inferência. Exibir ausência quando pertinente ou omitir o bloco. Não adicionar captura/persistência desses campos sem um modelo específico aprovado.

Score só pode aparecer quando houver um resultado persistido e autorizado com valor/modelo identificáveis. Sem resultado, usar estado indisponível, sem faixa de risco ou identidade validada inventadas. Completude cadastral percentual e elegibilidade de garantia não serão calculadas com critérios novos nesta etapa.

## Arquivos esperados

- `app/src/pages/admin/PropostaDetalhe.tsx`.
- Folha de estilos exclusiva da página e pequenos componentes locais, conforme necessário.
- `app/src/components/PropostaConsultas.tsx`, `PropostaPendencias.tsx`, `PropostaContrato.tsx`, `PropostaCondicaoComercial.tsx`, `PropostaFundos.tsx` e componentes documentais: apenas ajustes necessários para a referência, preferencialmente variantes opt-in limitadas ao admin.
- Testes direcionados de integração da página e documentação funcional pertinente.

## Critérios de aceite

1. Cabeçalho, faixa de status, tabs e cards seguem a referência visual fornecida.
2. Nove abas funcionais com dados reais, carregamento, vazio e erro distintos.
3. Formatação brasileira de valores/documentos/datas; ausência de dados não vira zero, aprovação ou cadastro completo.
4. Ações existentes respeitam permissões e continuam atualizando os dados via contratos atuais.
5. Nenhuma regressão visual nos módulos parceiro/cliente que reutilizam componentes.
6. Desktop e mobile sem overflow horizontal da página; navegação por teclado, foco visível e semântica de abas preservados.

## Segurança e impactos

- Web: página administrativa afetada. Electron herda o mesmo frontend; sem alteração de empacotamento/updater.
- Mobile Expo, banco/RLS/RPCs e Edge Functions: sem alteração prevista.
- Autorização permanece server-side, sem consultas privadas/credenciais no navegador e sem dados reais copiados para fixtures.
- Não disparar consulta paga, enviar mensagem ou criar proposta real para validar apenas UI. Usar mocks/sessão de teste apropriada.
- Publicação não está incluída; alterações locais de outros escopos serão preservadas.

## Verificação

- Executar lint, typecheck e build em `app/`.
- Testes direcionados com fixtures sintéticas: tabs, dados ausentes/PF/PJ, leitura limitada, erros e ações existentes relevantes.
- Navegador: comparar desktop e mobile; testar tabs, scroll, foco, estados vazios/erro e edição com ambiente de teste quando disponível.
- Validar consultas com mocks sem consumo Serasa; registrar limitações de sessão/autenticação caso impeçam smoke real.

## Rollout e rollback

Revisar diff local por escopo e apresentar evidências antes de qualquer publicação. Deploy exige autorização própria. Rollback restrito aos arquivos/trechos desta mudança, preservando alterações anteriores presentes no workspace.

## Execução e evidências — 21/10/2026

- Implementação local: stylesheet exclusivo, cabeçalho/status, tabs com navegação por teclado, resumo em cards, proponentes e imóveis em cards de dados reais, busca no histórico e estados de erro das queries dessas áreas.
- Componentes operacionais compartilhados continuam com seus contratos e ações existentes; a apresentação recebe os estilos restritos ao contêiner administrativo.
- Sem schema novo, resultados Serasa simulados, percentuais de completude ou marcadores de aprovação fictícios.
- `npm run lint --prefix app`: zero erros, 38 avisos do projeto.
- `npm run typecheck --prefix app`: passou após adequação de string.replace ao target TypeScript existente.
- `npm run build --prefix app`: passou, com aviso de tamanho de chunks.
- `npm test --prefix app -- src/test/adminPropostaDetalhe.test.tsx`: 2 testes passaram (tabs/teclado, dados ausentes e preservação do perfil jurídico).
- Chrome aberto em localhost: página administrativa renderizada, 9 tabs, largura 2133 px/documento 2133 px. Cópia do conteúdo com styles em iframe de 390 px: sem overflow horizontal. Iframe removido após medição.
- Limites: medição em iframe não equivale a smoke completo em dispositivo mobile. Nenhuma gravação real, consulta paga, envio, assinatura, validação financeira ou deploy foi executado. Revisão visual do produto e smoke das ações de escrita em ambiente de teste seguem pendentes.

### Correção de fidelidade solicitada pelo produto

A revisão apontou composição insuficiente, sobretudo em Proponentes. Dentro do escopo já aprovado: reproduzir o grid de duas colunas (1.8fr/0.7fr), seção de proponentes com cabeçalho/contador, identidade/avatar e campos em quatro colunas; lateral de análise cadastral e endereço do principal. Usar dados existentes com vínculo cliente/proponente confirmado, sem inventar score, completude percentual ou validações. Reposicionar edição dentro da seção, manter o fluxo de salvamento existente e verificar o layout com Chrome e testes direcionados.

#### Evidências da correção de Proponentes

- Grid desktop de duas colunas e oito campos cadastrais em quatro colunas, sem percentuais artificiais. Cabeçalho da seção com quantidade real e ação de edição.
- Lateral com estado neutro de score, classificação persistida da operação, responsável, navegação para consultas e endereço persistido do principal.
- Contatos/nascimento do cliente só associados por `cliente_id` ou CPF/CNPJ coincidente; consulta ampliada apenas com campos existentes nas migrations locais.
- Ações de cópia para documento/e-mail/telefone com feedback acessível e tratamento de falha do clipboard.
- Chrome: aba Proponentes ativa, lateral renderizada, zero alertas e documento sem overflow em viewport 1102 px. Cópias do conteúdo/estilos em 1440 e 390 px confirmaram duas/uma colunas e ausência de overflow; não equivalem a smoke completo em dispositivo mobile.
- Testes direcionados: dois passaram, incluindo vínculo do contato, endereço principal, ausência de score fictício e navegação da lateral para Consultas. Lint: zero erros, 38 avisos preexistentes.

### Refinamento do cabeçalho conforme screenshot

Referência complementar recebida: fundo #f6f6f7, título/ações compactos e faixa inferior de cinco campos. Dentro da implementação já aprovada, retirar o formulário alto de status do cabeçalho e colocá-lo em controle expansível na faixa de status; manter motivo e confirmação antes do envio, erros e bloqueio durante a mutation. A gestão existente de fundos ficará em “Mais ações”, sem reservar altura quando fechada. Exibir fundos reais na faixa, classificação persistida e edição da proposta no topo. Validar estados fechado/aberto sem gravar status real.

#### Evidências do refinamento do cabeçalho

- Fundo da página #f6f6f7, ações no topo, status compacto na faixa inferior, gestão de fundos em painel “Mais ações”, cinco campos com valores reais e simulação ocupando a linha inteira.
- Alteração de status mantém motivo, confirmação, bloqueio durante envio, fechamento após sucesso e Escape. Teste sintético via RPC mockada passou, sem gravação no banco real.
- Chrome: cabeçalho fechado ~132 px, faixa ~81 px, fundo rgb(246,246,247), sem overflow. Abertura do formulário exibiu conteúdo sem mudar a posição das abas; fechado ao terminar o teste.
- Testes direcionados: 3 passaram. Lint: zero erros, 38 avisos existentes.

### Correção do editor de condições

O screenshot revelou que o formulário inteiro estava sendo tratado como um único indicador dentro do grid de leitura. Separar explicitamente o estado de edição e aplicar um grid próprio (3/2/1 colunas), com campos de largura integral e checkbox em linha inteira. Preservar os dados, handlers e salvamento existentes. Validar abertura do editor no Chrome sem salvar a proposta real, lint, typecheck e build.

#### Evidências do editor de condições

Chrome: formulário aberto sem gravação; dez controles, largura ~1498 px em três colunas de ~483 px, sem overflow. Cópia do conteúdo/estilos em iframe 390 px: uma coluna e sem overflow. Edição cancelada após a medição. Três testes direcionados passaram; lint sem erros (38 avisos existentes).
