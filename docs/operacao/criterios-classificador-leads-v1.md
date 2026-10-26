# Critérios do classificador de leads — versão 1

Esta é a definição funcional inicial para o classificador server-side. Ela orienta a sugestão de classe e a distribuição operacional; não substitui análise de crédito nem aprovação jurídica.

As imagens [ParametrosIA-01.jpeg](./assets/ParametrosIA-01.jpeg) e
[ParametrosIA-02.jpeg](./assets/ParametrosIA-02.jpeg) registram o informativo
operacional recebido do Trello. Elas apresentam três perfis que seguem para
distribuição. Este documento mantém também uma quarta saída terminal,
`Desqualificado`, para os casos que não devem seguir na operação.

## Classes

| Classe | Peso | Regra funcional |
|---|---:|---|
| Triplo A | 1,0 | Garantia adequada, capacidade de pagamento comprovada, checklist mínimo sem pendência impeditiva e ausência de sinal jurídico impeditivo conhecido. |
| Double AA | 1,3 | Garantia adequada e situação documental/jurídica aceitável, mas renda ausente, não comprovada ou dependente de composição/estruturação. |
| Estressado | 1,7 | Existe potencial de operação, porém há pendência relevante de renda, documentação, imóvel, jurídico ou consulta que exige diligência e acompanhamento sênior. |
| Desqualificado | 0 | Motivo impeditivo fechado e confirmado por humano. Não é usado apenas por documento ausente, consulta indisponível ou baixa confiança. |

`Desqualificado` não participa do mix de distribuição, da capacidade ponderada
ou da bonificação. A atribuição exige confirmação humana, motivo fechado e
registro auditável.

“Garantia adequada”, “capacidade comprovada” e “pendência impeditiva” devem ser configuráveis e refinadas com exemplos reais anonimizados.

### Correspondência com o informativo

O informativo usa a seguinte leitura operacional:

- **Triplo A:** menor complexidade e encaminhamento preferencial para júnior,
  respeitada a capacidade configurada.
- **Double AA:** complexidade intermediária e encaminhamento preferencial para
  pleno.
- **Estressado:** maior complexidade, com acompanhamento sênior e revisão
  quando houver sinal sensível.
- **Desqualificado:** saída terminal confirmada por humano; não é encaminhado
  para analista.

Os limites numéricos exibidos nas imagens (score, percentual de renda, LTV,
materialidade de restrições, população da cidade e quantidade de pendências)
são parâmetros de trabalho do informativo. Eles ainda precisam ser validados
pela operação antes de substituir as definições configuráveis desta versão.

## Confiança e revisão

- **0,85 ou mais:** distribuição automática, exceto sinal jurídico sensível.
- **0,60 a 0,8499:** revisão humana obrigatória antes da distribuição.
- **Abaixo de 0,60:** permanece pendente, sem classe definitiva.
- Sinal jurídico sensível sempre exige revisão.

## Dados considerados

- Dados do imóvel e valor da garantia.
- Renda, modelo de renda e composição dos proponentes.
- Documentos recebidos e validados.
- Pendências abertas e prazos.
- Consultas Bacen/Serasa somente quando configuradas, consentidas e disponíveis.

## Resultado obrigatório

O classificador deve retornar classe, confiança, peso, evidências, pendências, motivo, indicação de revisão e versão da regra. A saída deve ser validada no servidor e registrada em auditoria.

## Limites

O classificador não aprova crédito, não recusa automaticamente, não inventa dados ausentes e não altera o status do Kanban. Falhas ou indisponibilidade deixam a proposta pendente para ação manual.
