# Correção de validação LTV no simulador Home Equity

## Objetivo

Impedir que o simulador envie uma proposta de crédito acima do LTV permitido após a seleção do tipo de imóvel, exibindo o limite aplicável e permitindo corrigir o valor antes do envio.

## Documentos e instruções lidos

- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- `docs/operacao/simulador-publico.md`.
- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql`.
- Código atual de `app/src/components/PublicSimulator.tsx` e testes em `app/src/test/publicSimulator.test.tsx`.

## Código inspecionado

- O simulador calcula LTV máximo por tipo de imóvel; para imóvel comercial, usa 40%.
- A validação do limite ocorre na etapa de valores, antes da escolha de tipo de imóvel.
- A seleção posterior do imóvel não limita novamente `creditValue`, e a etapa final não verifica o LTV.
- A função SQL `capture_public_simulacao_lead` também rejeita crédito acima do LTV, retornando a falha como `dados_invalidos`.
- O caso enviado no diagnóstico tem imóvel comercial de R$ 850.000 e crédito de R$ 500.000; o máximo correspondente a 40% é R$ 340.000.

## Decisões e suposições

- Preservar os limites de LTV já definidos no cliente e no banco; não alterar política de crédito.
- Ao mudar o tipo de imóvel ou o valor do imóvel, recalcular o teto e ajustar o crédito selecionado para não ultrapassá-lo.
- Revalidar o LTV imediatamente antes do envio, além da proteção existente no banco.
- Exibir uma mensagem clara com o percentual e o valor máximo permitido quando o valor precisar ser corrigido.
- O `method_not_allowed` relatado anteriormente não foi reproduzido: testes diretos `POST` chegam à validação da função. Este plano trata o erro confirmado `dados_invalidos` do payload compartilhado.

## Modelo de dados

Sem alterações. Não serão criadas tabelas, colunas ou registros novos.

## Arquivos esperados

- `app/src/components/PublicSimulator.tsx`
- `app/src/test/publicSimulator.test.tsx`
- `docs/operacao/simulador-publico.md` (registro da validação do LTV, se necessário)

## Requisitos e critérios de aceite

- Selecionar imóvel comercial de R$ 850.000 e crédito de R$ 500.000 limita ou corrige o crédito para no máximo R$ 340.000.
- Trocar o tipo do imóvel recalcula o teto com a regra correspondente.
- O envio final não chama a Edge Function se o crédito exceder o LTV atual.
- Casos válidos continuam podendo enviar; nenhuma alteração ao endpoint ou à política do banco.

## Segurança

- Manter a validação no servidor/banco como autoridade final.
- Não incluir credenciais privadas nem dados reais nos testes.
- Testar a interface com dados sintéticos e sem enviar/gravar leads em produção.

## Verificações

- Teste focado Home Equity: `src/test/publicSimulator.test.tsx` — 3 testes aprovados.
- Typecheck e build aprovados; lint sem erros (38 avisos gerais já existentes).
- A primeira suíte completa teve 27 arquivos/103 testes aprovados e um timeout de 5 s no teste de amortização; esse arquivo passou isoladamente (2 testes). A repetição completa com `--maxWorkers=2` passou: 28 arquivos/104 testes, incluindo a amortização; sem mudança nos arquivos de amortização.
- Smoke visual local confirmou que comercial com imóvel de R$ 850.000 mostra limite de 40%/R$ 340.000 e ajusta o valor de R$ 350.000 para R$ 340.000 ao retornar à etapa de crédito. Nenhum envio foi feito.
- Nenhuma alteração em Edge Function, banco, publicação ou arquivos da calculadora de amortização.
