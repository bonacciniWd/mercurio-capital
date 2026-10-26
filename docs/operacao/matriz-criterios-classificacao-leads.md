# Matriz de critérios para classificação de leads

> Documento de definição operacional. Os critérios abaixo organizam os dados já disponíveis no sistema; não autorizam classificação automática até serem validados pela operação.

O informativo operacional do Trello está anexado em
[ParametrosIA-01.jpeg](./assets/ParametrosIA-01.jpeg) e
[ParametrosIA-02.jpeg](./assets/ParametrosIA-02.jpeg). A leitura do
informativo foi incorporada como referência, sem transformar seus limites
numéricos em configuração de produção.

## Estado atual

A distribuição automática já está implementada. Uma proposta nova fica `aguardando classificação operacional`. Depois que a classe é definida, o sistema aplica o peso e escolhe um analista elegível conforme senioridade, capacidade e carga do mês.

O que ainda falta é transformar as descrições comerciais em critérios observáveis para que um classificador server-side possa sugerir uma classe com confiança e justificativa.

## Quatro saídas da classificação

O material visual exibe três perfis distribuíveis. Para manter o controle
operacional e a regra já aprovada, o sistema trabalha com quatro saídas:

| Saída | Participa da distribuição? | Regra de encaminhamento |
|---|---|---|
| Triplo A | Sim | Lead de menor complexidade, respeitando capacidade e balanceamento. |
| Double AA | Sim | Lead de complexidade intermediária, com estruturação quando necessário. |
| Estressado | Sim, com revisão conforme o caso | Lead de maior complexidade, com preferência por pleno/sênior e acompanhamento. |
| Desqualificado | Não | Encerramento operacional confirmado por humano, com motivo e auditoria. |

Desqualificado não entra no mix de senioridade, na capacidade ponderada nem no
gatilho de bonificação. Ausência de documento, consulta indisponível ou baixa
confiança não são motivos suficientes para essa saída.

## Parâmetros adicionais do informativo

O material sugere limites para score, renda mínima, LTV, materialidade de
restrições, população da cidade e quantidade de pendências. Esses limites são
referências para a próxima validação da operação. Enquanto não houver aprovação
formal, permanecem fora da automação e não substituem os campos configuráveis
da versão 1.

## Dados que podem alimentar a análise

| Dimensão | Fonte atual | Sinais disponíveis |
|---|---|---|
| Garantia | `imoveis` | valor, tipo, localização, financiamento, saldo devedor, débitos de IPTU/condomínio, fotos e documentos associados |
| Pessoa física | `clientes`, `proponentes` | renda mensal, modelo de renda, estado civil, composição de renda, documentos e extratos enviados |
| Pessoa jurídica | `clientes`, `proponentes` | faturamento, tipo de empresa, ramo, data de abertura, contrato social, balanço/DRE e extratos |
| Documentação | `proposta_documentos` | tipo, categoria, origem, presença, validação e OCR quando disponível |
| Pendências | `proposta_pendencias` | descrição, tipo de documento, prazo e status |
| Consultas externas | consultas da proposta | situação e data da consulta, somente quando houver credencial, consentimento e resultado autorizado |

## Definições para validação da operação

### Triplo A — peso 1,0

Confirmar quais condições são obrigatórias para considerar simultaneamente:

- imóvel aceitável para a operação;
- capacidade de pagamento comprovada;
- situação documental e jurídica sem pendência impeditiva;
- consultas externas sem alerta impeditivo, quando disponíveis.

A operação precisa informar os limites ou evidências que tornam cada item “aceitável”, “comprovado” e “sem pendência impeditiva”.

### Double AA — peso 1,3

Confirmar se a regra é:

- imóvel aceitável;
- situação documental/jurídica aceitável;
- ausência de renda declarada ou comprovada;
- possibilidade de análise por garantia ou composição de renda.

Também é necessário informar quando a falta de renda transforma o caso em Estressado ou apenas reduz a confiança.

### Estressado — peso 1,7

Confirmar quais sinais tornam o caso um desafio operacional, por exemplo:

- pendência jurídica ou documental relevante;
- débitos de imóvel ou inconsistência de garantia;
- renda insuficiente, inconsistente ou não verificável;
- dados incompletos que exigem diligência adicional;
- alerta de consulta externa que não seja uma reprovação automática.

Cada sinal deve ter severidade e ação esperada: solicitar documento, encaminhar para revisão ou manter em análise.

### Desqualificado — peso 0

Definir uma lista fechada de motivos impeditivos e quem pode confirmá-los. O classificador não deve marcar esta classe apenas por documento ausente, baixa confiança ou consulta indisponível.

A desqualificação deve exigir revisão humana e registrar motivo auditável, data e responsável.

## Campos que ainda precisam de decisão

1. Faixas de valor e tipos de imóvel aceitos.
2. Percentual máximo entre crédito solicitado, valor do imóvel e saldo devedor.
3. Evidências mínimas de renda PF e PJ.
4. Débitos que são impeditivos, tratáveis ou apenas informativos.
5. Como tratar consulta Bacen/Serasa ausente, indisponível ou com alerta.
6. Critério para diferenciar Double AA de Estressado.
7. Motivos fechados de Desqualificado.
8. Confiança mínima para distribuição automática; abaixo dela, revisão manual.
9. Confirmação da capacidade mensal do nível Sênior/Líder: 9 ou 12.

## Próxima validação necessária

A operação deve preencher os campos acima usando exemplos reais anonimizados. Com essa matriz aprovada, a engenharia poderá criar um endpoint server-side que devolve:

- classe sugerida;
- peso aplicado;
- confiança;
- evidências utilizadas;
- pendências encontradas;
- recomendação de revisão ou distribuição.

O endpoint não aprovará crédito, não recusará automaticamente e não enviará credenciais ao modelo.
