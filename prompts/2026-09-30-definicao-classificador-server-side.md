# Plano — Definição do classificador server-side

## Objetivo
Formalizar as quatro classes de lead e o contrato de saída do classificador que será executado no servidor antes da distribuição automática.

## Escopo
- Propostas criadas pelo Wizard web.
- Dados de garantia, renda, documentação, pendências e consultas autorizadas.
- Sugestão estruturada, revisão humana e distribuição já existente.
- Sem decisão automática de aprovação de crédito ou desqualificação definitiva.

## Critérios-base propostos

### Triplo A — peso 1,0
Garantia adequada, renda/capacidade de pagamento comprovada, checklist mínimo sem pendência impeditiva e nenhuma ocorrência jurídica impeditiva conhecida.

### Double AA — peso 1,3
Garantia adequada e situação documental/jurídica aceitável, mas renda ausente, não comprovada ou dependente de composição/estruturação.

### Estressado — peso 1,7
Há garantia ou potencial de operação, mas existe pendência relevante de renda, documentação, imóvel, jurídico ou consulta que exige diligência e acompanhamento sênior.

### Desqualificado — peso 0
Somente quando houver motivo impeditivo definido pela operação e confirmação humana. Ausência de documento, consulta indisponível ou baixa confiança não desqualificam sozinhas.

## Política de confiança
- `>= 0.85`: pode seguir para distribuição automática, salvo sinal jurídico sensível.
- `0.60–0.8499`: fica aguardando revisão humana.
- `< 0.60`: fica pendente, sem classe definitiva.
- Qualquer sinal jurídico sensível exige revisão, independentemente da confiança.

## Contrato de saída
```json
{
  "classificacao": "triple_a | double_aa | estressado | desqualificado | null",
  "confianca": 0.0,
  "peso": 1.0,
  "evidencias": ["..."],
  "pendencias": ["..."],
  "motivo": "...",
  "revisao_obrigatoria": true,
  "versao_regra": "v1"
}
```

## Regras de segurança
- Execução server-side; nenhum token privado no navegador.
- O modelo recebe somente os dados mínimos necessários.
- Saída validada por schema antes de persistir.
- Toda sugestão registra evidências, versão da regra, confiança e auditoria.
- Desqualificação e casos jurídicos permanecem sujeitos a revisão humana.

## Critérios de aceite
1. Cada proposta nova recebe sugestão, revisão pendente ou motivo claro de ausência de dados.
2. A distribuição automática só ocorre na faixa de confiança aprovada.
3. A classe, peso, motivo e evidências ficam auditáveis.
4. Falha do modelo não impede a criação da proposta nem altera status do Kanban.
5. Uma feature flag permite desligar o classificador e voltar à classificação manual.
