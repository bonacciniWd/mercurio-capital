# Datas civis das propostas

`propostas.created_at` continua sendo um `timestamptz`, porque a mesma coluna alimenta filtros, métricas e auditoria. Quando o admin edita a data da proposta, o campo `input[type=date]` representa uma data civil brasileira (`aaaa-mm-dd`) e o frontend a serializa ao meio-dia UTC. Isso evita que a conversão por meia-noite mova a data para o dia anterior em `America/Sao_Paulo`.

As telas exibem a data operacional como `dd/mm/aaaa`. Timestamps reais continuam sendo convertidos para `America/Sao_Paulo`; registros antigos gravados pelo fluxo anterior exatamente à meia-noite UTC são interpretados pelo trecho de data UTC para preservar o dia que o operador informou.

Casos mínimos de validação:

- `2026-08-23` permanece `23/08/2026` ao salvar e reabrir;
- `2026-01-22` permanece em janeiro;
- `2026-12-02` permanece em dezembro;
- datas do histórico, contratos, comissões e `updated_at` continuam sendo instantes com data e hora.
