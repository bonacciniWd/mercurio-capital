# Correção de captura de parcelas e estados da amortização

**Status:** aprovado pelo dono; ajustes de amortização implementados e validados localmente. Diagnóstico do erro de parcelas aguarda identificação da requisição real. Não publicado.

## Objetivo

Investigar e corrigir a falha de captura do simulador de parcelas. Na amortização, ajustar somente o resumo textual e a indicação visual dos botões selecionados, preservando layout e cálculos aprovados.

## Documentos e skills lidos

Instruções AGENTS fornecidas pelo dono; docs/README.md, docs/operacao/change-management.md, docs/operacao/simulador-publico.md e plano da publicação web de 2026-10-08. Nenhuma skill específica aplicável.

## Código inspecionado e diagnóstico

- PublicSimulator.tsx: captura via functions.invoke, com POST padrão do SDK.
- PublicAmortizationSimulator.tsx e PublicAmortizationResult.tsx: escolhas, planos, resumo e abas do cronograma.
- index.css: a regra global de botões aplica fundo escuro e texto importante aos botões sem btn-no-liquid. Os controles de objetivo/frequência do modal e abas do cronograma não usam essa exclusão, podendo esconder sua cor selecionada.
- public-simulacao-lead/index.ts, cors.ts e SDK FunctionsClient: OPTIONS permitido; somente POST captura; demais métodos retornam 405 method_not_allowed. O 400 relatado precisa ser associado à requisição real antes de concluir sua causa. Não substituir diagnóstico por adicionar GET de captura.

## Decisões e suposições

Reutilizar o estado vermelho Mercúrio e btn-no-liquid nos controles afetados; preservar aria-pressed/aria-selected, contraste, foco e estado desabilitado. Conferir também escolhas de imóvel/perfil, sem redesenhar outras áreas.

Resumo proposto: "Com os planos configurados, você amortizará um total extra de **R$ X**. O prazo estimado será de **N meses**, com redução de **Y meses**. A economia estimada em juros será de **R$ Z**." Quando não houver redução de prazo, informar que o prazo é mantido; tratar singular de mês corretamente. X usa o extra efetivamente aplicado, limitado pelo saldo, não a soma nominal dos planos mensais. Não alterar motor financeiro.

Captura: confirmar método/URL/resposta do erro real, manter POST, consentimento, idempotência, rate limit e validação server-side. A correção exata dependerá da evidência; caso exija mudança de contrato/modelo, revisar o plano antes de implementar.

## Arquivos esperados

PublicSimulator.tsx e seu teste se a captura exigir correção; PublicAmortizationResult.tsx e testes de amortização; documentação operacional e este plano. Edge Function somente se o diagnóstico mostrar necessidade, com publicação remota autorizada separadamente. Nenhuma nova dependência.

## Modelo e segurança

Sem alteração prevista de tabelas, regras financeiras, RLS, permissões ou dados. Não testar captura real enviando e-mails sem autorização específica. Não abrir captura por GET nem remover validações para contornar o erro. Não alterar simulador aprovado além dos três pontos pedidos.

## Aceite e testes

Captura de parcelas envia POST ao endpoint correto e apresenta resultado/erro coerente; provar a causa e correção com teste de regressão pertinente. Objetivo/frequência e cenário do cronograma exibem vermelho quando ativos, sem desaparecer o texto. Resumo mostra extra aplicado, duração/redução em meses e economia sem repetir redução do total pago.

Executar testes pertinentes, suíte, lint, typecheck, build e diff check. Navegador: seleção/troca dos controles, foco, singular/plural, redução de prazo e redução de parcela sem alterar dados reais; testes de captura com mock ou transação revertida, sem enviar mensagens. Registrar limites do teste manual.

## Rollout e rollback

Implementação local após aprovação, publicação web com GO específico; sem instaladores Electron. Rollback pelo deploy web anterior ou reversão do diff limitado. Nenhuma migration prevista.

## Resultado — 2026-10-08

- PublicAmortizationResult.tsx: resumo usa total efetivamente amortizado extra, quantidade final de meses, redução de meses (ou prazo mantido) e economia de juros. Não altera cálculos nem payload.
- Controles objetivo/frequência do plano e abas do cronograma excluídos do estilo global por btn-no-liquid. Estados selecionados mantêm aria-pressed/aria-selected, fundo vermelho e texto branco.
- Teste de fluxo ampliado: extra mensal efetivamente aplicado (R$ 100 mil no exemplo, limitado pelo saldo), 11 meses e redução de 1 mês; redução de parcela mantendo prazo; seleção dos controles e payload final preservado.
- Suíte: 28 arquivos/103 testes passaram. Lint: zero erros, 38 avisos existentes. Build passou com o aviso existente de bundle. Uma opção incorreta no tipo de consulta do teste causou erro inicial de typecheck, corrigido antes do build final.
- Navegador local: modal e cronograma com cor calculada rgb(220,38,38) e texto branco; plano único com prazo mantido; plano mensal com R$ 100 mil extra aplicado e 11 meses, reduzindo 1 mês. Nenhum clique de captura final ou envio de mensagem.
- Diagnóstico de parcelas: fonte e SDK usam POST; chamada real pelo SDK ao endpoint publicado com honeypot deliberadamente inválido confirmou POST/400 invalid_request, sem dados gravados. OPTIONS retorna 200, POST vazio 400 idempotency_key_invalida, GET 405 method_not_allowed. Não há evidência para concluir que o 400 e method_not_allowed relatados sejam a mesma requisição. Página disponível não tinha erros recuperáveis no console. Solicitados somente URL, método e resposta do pedido falho, sem headers/tokens/dados pessoais.
- Nenhuma correção especulativa da captura, alteração de banco ou publicação remota executada. Esse ponto permanece pendente, não considerado resolvido.
