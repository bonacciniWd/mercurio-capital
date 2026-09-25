# Escopo de desenvolvimento — Operação, relatórios e classificação inteligente

**Prazo estimado:** 1,5 a 2 semanas (8 a 10 dias úteis)  
**Produto:** Mercurio Capital  
**Versão de referência:** v0.2.2

## 1. Objetivo

Melhorar a leitura dos indicadores operacionais e financeiros, tornar a distribuição de leads mais equilibrada entre a equipe e iniciar uma camada de inteligência para classificar novos leads com base nas regras da operação e no histórico disponível.

O trabalho será entregue de forma incremental. As métricas continuarão sendo calculadas pelo sistema; a inteligência artificial servirá para classificar, explicar e recomendar encaminhamentos com base em dados reais.

## 1.1 Baseline confirmado na planilha de bonificação

A planilha analisada não contém histórico de leads individuais. Ela define parâmetros de capacidade, complexidade e distribuição que serão usados como referência inicial:

- **Triplo A:** peso de complexidade 1,0.
- **Double A:** peso de complexidade 1,3.
- **Estressado (desafio):** peso de complexidade 1,7.
- **Desqualificado:** quarta classe, excluída do total de leads qualificados.

O mix-alvo por senioridade é:

| Nível | Triplo A | Double A | Estressado |
|---|---:|---:|---:|
| Júnior | 60% | 30% | 10% |
| Pleno | 25% | 55% | 20% |
| Sênior/Líder | 10% | 25% | 65% |

As capacidades-base indicadas são 4 leads/mês para Júnior, 8 para Pleno e 9 para Sênior/Líder. A capacidade do Sênior/Líder ainda precisa ser confirmada, pois a planilha registra 9 como placeholder e menciona 12 como valor anterior.

### Parâmetros confirmados para a próxima etapa

- **Headcount-alvo:** 3 analistas.
- **Limite mensal para bonificação:** 100 leads qualificados por mês.
- **Referência de conversão:** aproximadamente 30 propostas a cada 100 leads (30%); é uma métrica de planejamento, não um requisito para liberar a bonificação.
- **Peso por lead:** Triplo A = 1,0; Double AA = 1,3; Estressado = 1,7.
- **Regra de excedente:** a bonificação por volume só começa depois que a equipe ultrapassar 100 leads qualificados no mês. A conversão observada será acompanhada separadamente.
- **Base de cálculo:** cada lead será convertido em operações-equivalentes pelo seu peso; a soma ponderada será usada para medir o excedente.

Esses parâmetros definem o gatilho operacional. O valor monetário por operação-equivalente, o percentual de pagamento, retenções e eventuais regras de conversão ainda precisam ser formalizados antes de entrar em produção.

## 2. Entregas previstas

### 2.0 Checklist de abertura da proposta

Antes da classificação e da distribuição do lead, o sistema deverá organizar o checklist mínimo da esteira rápida de CGI/Home Equity. O checklist será persistido por proposta, com status por item, responsável, data de recebimento e observação de pendência.

#### Documentos do imóvel

- Matrícula do imóvel.
- Espelho do IPTU ou ficha cadastral com metragem da área construída.
- Fotos internas e externas do imóvel.

#### Documentos de pessoa física (PF)

- Documento de identidade.
- Certidão de estado civil (nascimento ou casamento).
- Comprovante de residência.
- IRPF do último exercício.
- Extratos bancários dos últimos 3 meses.
- E-mail e telefone de todos os proponentes.

#### Documentos de pessoa jurídica (PJ)

- Contrato social.
- Balanço, DRE, faturamento e balancete dos últimos 2 exercícios.
- Extratos bancários dos últimos 3 meses.

O checklist deverá permitir identificar documentos recebidos, ausentes, inválidos, vencidos ou aguardando conferência. O LLM poderá ajudar a localizar informações nos documentos e sugerir pendências, mas a confirmação final continuará com a equipe.

### 2.0.1 Consultas Bacen e Serasa

As consultas externas serão uma etapa posterior do fluxo, executada somente após a configuração das integrações e a validação jurídica/operacional:

- cadastrar as credenciais Bacen e Serasa exclusivamente no backend;
- criar conectores server-side com timeout, logs técnicos e tratamento de indisponibilidade;
- registrar consentimento, finalidade, usuário solicitante, data e resultado resumido;
- limitar o acesso aos usuários e níveis autorizados;
- armazenar apenas os dados necessários para a análise;
- apresentar o resultado como subsídio para a equipe, sem aprovação ou rejeição automática;
- manter auditoria e possibilidade de revisão manual.

As chaves de API ainda não estão cadastradas. Portanto, a primeira entrega deve preparar o contrato de integração e os estados `não configurado`, `aguardando consulta`, `concluído` e `erro`, sem simular resultados reais.

### 2.1 Relatórios e funil de conversão

- Revisar os filtros do painel de relatórios.
- Alinhar os filtros de período, parceiro, fundo, responsável e status entre os cards e o gráfico.
- Ajustar o gráfico do funil para exibir as mesmas propostas consideradas nos cards.
- Deixar explícito o critério de data utilizado em cada indicador.
- Diferenciar propostas em operação, standby, canceladas e etapas de ganho/liberação.
- Exibir estados vazios e mensagens de conferência quando não houver dados no período.
- Validar os números com consultas de conferência antes da publicação.

**Critério de aceite:** ao aplicar um filtro, cards, funil e tabelas devem refletir o mesmo conjunto de propostas e o mesmo período.

### 2.2 Classificação e distribuição de leads

Será criado um fluxo de classificação para novos leads, com registro da decisão e da justificativa.

A classificação deverá considerar o checklist documental e, quando estiverem disponíveis e autorizadas, as consultas externas. Documentos ausentes não devem ser tratados automaticamente como reprovação; devem gerar pendência ou reduzir a confiança da classificação.

#### Classificação inicial

O modelo deverá analisar os dados disponíveis do lead e retornar uma classificação estruturada. As quatro classes de trabalho estão definidas, mas seus critérios objetivos ainda precisam ser formalizados:

- **Triplo A:** referência inicial para imóvel bom, capacidade de pagamento boa e situação jurídica tranquila.
- **Double A:** referência inicial para imóvel bom e situação jurídica tranquila, mas sem renda declarada ou comprovada.
- **Estressado (desafio):** referência inicial para pendências jurídicas, documentais, de renda, sociais ou de garantia.
- **Desqualificado:** lead que não deve seguir para a operação e fica fora do total de leads qualificados.

Essas descrições são hipóteses operacionais iniciais. O sistema só deve automatizar a decisão depois que a equipe transformar “imóvel bom”, “renda comprovada” e “situação jurídica tranquila” em critérios verificáveis.

#### Distribuição por senioridade

- Identificar o nível do responsável: júnior, pleno ou sênior.
- Considerar capacidade atual, quantidade de leads recebidos e distribuição recente dentro do headcount-alvo de 3 analistas.
- Encaminhar leads compatíveis com o nível e a classificação de complexidade, usando os pesos 1,0 / 1,3 / 1,7 para capacidade equivalente.
- Considerar o limite agregado de 100 leads qualificados/mês antes de calcular bonificação por excedente.
- Evitar concentração de leads em uma única pessoa.
- Registrar responsável, classe, data, motivo e origem da distribuição.
- Permitir redistribuição manual por um supervisor autorizado.
- Preparar a estrutura para equipes, supervisores e células operacionais.

A distribuição automática não substituirá a revisão humana em casos desclassificados, juridicamente sensíveis ou com baixa confiança do modelo.

#### Uso do histórico

O histórico existente será usado inicialmente para identificar padrões, testar a classificação e construir exemplos de referência. O treinamento ou ajuste fino de um modelo próprio será considerado somente depois da avaliação da qualidade, consistência e autorização de uso desses dados.

### 2.3 Assistente de gestão no dashboard financeiro

Será preparada a base técnica para um assistente que possa:

- explicar indicadores do dashboard;
- responder perguntas sobre o período filtrado;
- apontar propostas sem data de entrada em pagamento de comissão;
- identificar divergências e pendências operacionais;
- gerar um resumo do período com os registros utilizados como evidência.

O assistente deverá consultar dados por rotas seguras no servidor. O modelo não poderá inventar valores, alterar registros ou substituir as consultas financeiras determinísticas.

Para a primeira versão, a integração pode usar a API da NVIDIA. A chave ficará somente no backend. A hospedagem local de um modelo Nemotron será avaliada separadamente conforme GPU, custo, latência, licença e necessidade de privacidade.

### 2.4 Limpeza automática de convites de parceiros

- Criar um job agendado (CRON) para localizar convites pendentes há mais de 15 dias.
- Cancelar ou arquivar esses convites conforme a regra definida para o produto.
- Registrar a execução, quantidade processada e eventuais erros.
- Garantir que convites aceitos, recusados ou já utilizados não sejam alterados.
- Permitir execução idempotente, sem duplicar registros ou auditorias.

## 3. Regras de segurança e governança

- O LLM não terá acesso direto ao banco nem às credenciais privadas.
- Consultas financeiras e regras de classificação serão executadas no servidor.
- Cada resposta deverá respeitar a autorização do usuário e o escopo da equipe.
- Dados pessoais serão minimizados antes de serem enviados ao modelo.
- Classificações de risco, jurídicas ou sociais terão trilha de auditoria e possibilidade de revisão.
- Nenhum lead será excluído automaticamente sem uma regra aprovada e reversível.

## 4. Plano de execução

### Dias 1–2 — Mapeamento e definição

- Conferir consultas atuais dos relatórios e do funil.
- Transformar o checklist de CGI/Home Equity em itens estruturados da proposta.
- Definir estados, responsáveis e validações para cada documento.
- Fechar os critérios verificáveis das quatro classes já nomeadas: Triplo A, Double A, Estressado e Desqualificado.
- Mapear campos de senioridade, capacidade, equipe e responsável.
- Definir o comportamento do convite após 15 dias.

### Dias 3–5 — Relatórios e distribuição

- Ajustar filtros e funil.
- Criar a estrutura de classificação e distribuição.
- Implementar registro de justificativa, confiança e revisão manual.

### Dias 6–8 — Assistente e automação

- Implementar o endpoint seguro para classificação/explicação.
- Implementar a leitura assistida do checklist e a preparação dos conectores Bacen/Serasa.
- Integrar a API escolhida em ambiente controlado.
- Criar o CRON de convites e os registros de auditoria.

### Dias 9–10 — Validação e entrega

- Testar cenários reais e casos sem dados.
- Comparar relatórios com consultas SQL de conferência.
- Validar distribuição por senioridade.
- Testar falhas da API, repetição do CRON e revisão manual.
- Preparar documentação e entrega para homologação.

## 5. Fora do escopo desta etapa

- Treinamento completo ou fine-tuning de um modelo proprietário.
- Construção de infraestrutura GPU dedicada.
- Decisões automáticas irreversíveis sobre aprovação ou recusa de crédito.
- Alteração de regras financeiras sem validação da operação.
- Integrações externas não descritas neste documento.

## 6. Dependências para cumprir o prazo

- Acesso a exemplos históricos aprovados e anonimizados.
- Definição dos critérios verificáveis das quatro classes: Triplo A, Double A, Estressado e Desqualificado.
- Definição das regras de capacidade e senioridade.
- Acesso seguro à API da NVIDIA ou ambiente de teste equivalente.
- Chaves e contratos de API do Bacen e do Serasa, quando a integração for autorizada.
- Definição do texto e do fluxo de consentimento para consultas externas.
- Confirmação sobre arquivar ou cancelar convites vencidos.
- Disponibilidade de uma pessoa da operação para validar os casos reais.
- Confirmação da capacidade do Sênior/Líder (9 ou 12 leads/mês).
- Validação dos pesos de complexidade e dos parâmetros de bonificação antes de qualquer cálculo financeiro.

## 7. Critérios gerais de aceite

- Os filtros do relatório e o funil apresentam números coerentes para mês, trimestre, ano e histórico.
- Um novo lead recebe classe, justificativa e responsável ou fica pendente de revisão.
- A distribuição respeita senioridade, capacidade e regras de balanceamento.
- O assistente responde somente com dados autorizados e referências do sistema.
- Convites pendentes há mais de 15 dias são tratados pelo CRON sem alterar convites válidos.
- Todas as ações relevantes ficam auditáveis e podem ser revisadas.
- A bonificação só é calculada quando o volume mensal de leads qualificados ultrapassa 100, usando a soma ponderada por complexidade.

## 8. Resultado esperado

Ao final da etapa, a empresa terá uma visão mais confiável do funil e dos relatórios, uma distribuição de leads baseada em regras claras e uma primeira camada de inteligência integrada à operação, preparada para evoluir posteriormente para um modelo próprio caso os dados e os resultados justifiquem esse investimento.
