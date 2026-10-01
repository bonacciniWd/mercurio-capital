# Critérios do classificador de leads — versão 1

Esta é a definição funcional inicial para o classificador server-side. Ela orienta a sugestão de classe e a distribuição operacional; não substitui análise de crédito nem aprovação jurídica.

## Classes

| Classe | Peso | Regra funcional |
|---|---:|---|
| Triplo A | 1,0 | Garantia adequada, capacidade de pagamento comprovada, checklist mínimo sem pendência impeditiva e ausência de sinal jurídico impeditivo conhecido. |
| Double AA | 1,3 | Garantia adequada e situação documental/jurídica aceitável, mas renda ausente, não comprovada ou dependente de composição/estruturação. |
| Estressado | 1,7 | Existe potencial de operação, porém há pendência relevante de renda, documentação, imóvel, jurídico ou consulta que exige diligência e acompanhamento sênior. |
| Desqualificado | 0 | Motivo impeditivo fechado e confirmado por humano. Não é usado apenas por documento ausente, consulta indisponível ou baixa confiança. |

“Garantia adequada”, “capacidade comprovada” e “pendência impeditiva” devem ser configuráveis e refinadas com exemplos reais anonimizados.

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
