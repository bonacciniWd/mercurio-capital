# Plano de retomada — integração Serasa e preparação de produção

Data: 26/10/2026. Estado: implementação local concluída; migration, deploy e teste remoto ainda pendentes.

## Objetivo

Retomar a integração Serasa já existente, alinhando o código aos produtos confirmados no cadastro: Relatório Avançado PF e Relatório Avançado PJ. Validar com segurança o caminho até a consulta autenticada. Não executar consultas de crédito em produção nem habilitar a flag de produção nesta etapa.

## Documentação e fontes lidas

- Instruções AGENTS.md fornecidas pelo usuário.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md`.
- `prompts/2026-10-21-plano-revisado-serasa-merx.md`.
- `prompts/2026-10-22-modelo-dados-merx.md` e aprovações anteriores do fluxo/modelo registradas no contexto.
- Collections em `API/Serasa/Collections` (inventário já documentado na auditoria).
- Documentação oficial Serasa: [Portal de Integração](https://www.serasaexperian.com.br/portal-integracao/) e [manual oficial de API PF](https://developer.serasaexperian.com.br/api/relatorio-basico-pf).

## Código e configuração inspecionados

- `supabase/functions/_shared/serasa-reports.ts`.
- `supabase/functions/consulta-executar/index.ts`.
- `supabase/functions/integracao-testar/index.ts`.
- `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql`.
- `app/src/components/PropostaConsultas.tsx` (integração já registrada nas auditorias anteriores; verificar formato de renderização na execução).
- Nomes de secrets do projeto Supabase vinculado, consultados em modo somente leitura; valores não devem ser lidos, copiados ou registrados.

## Estado observado

- O usuário confirmou que cadastrou `SERASA_CLIENT_ID` e `SERASA_CLIENT_SECRET` verdadeiros no Supabase. A listagem atual de nomes confirma os dois, além dos aliases antigos `SERASA_LOGON` e `SERASA_SENHA` e `SERASA_API_URL`. Sem revelar o valor, o fingerprint do secret foi comparado localmente com os hosts permitidos: corresponde a `https://api.serasaexperian.com.br/` (produção, barra final removida pelo código).
- Não aparecem `SERASA_PRODUCTION_ENABLED` nem `SERASA_RETAILER_DOCUMENT_ID`. A função bloqueia consultas produtivas sem a primeira habilitação e sem um CNPJ consultante válido; não habilitar esses itens sem autorização específica.
- O health check atual autentica no IAM, mas não verifica autorização/contratação de relatório.
- O usuário confirmou que a conta tem Relatórios Avançados PF e PJ habilitados. A documentação pública do portal é uma aplicação dinâmica; a leitura automática não expôs o conteúdo das páginas específicas PF/PJ.
- O código atual solicita Top Score PF (`RELATORIO_AVANCADO_TOP_SCORE_PF`), que não foi o produto confirmado. A configuração PJ usa `RELATORIO_AVANCADO_PJ_ANALITICO`, que coincide com a collection PJ avançada/analítica já validada em UAT. O plano ajusta PF para `RELATORIO_AVANCADO_PF` e preserva PJ `RELATORIO_AVANCADO_PJ_ANALITICO`, sem acrescentar features Top Score nem assumir `segmentCode=028` como regra produtiva.
- Como a migration de configuração original já foi aplicada, alinhar o produto PF precisa de uma migration aditiva nova, local e não aplicada remotamente. Não há alteração no modelo MERX.
- A documentação oficial confirma o header `X-Retailer-Document-ID` como CNPJ consultante/cost center e alerta que features dependem do contrato. O usuário confirmou os produtos habilitados para esta conta.

## Decisões e suposições

- Preservar a integração server-side, autorização vinculada à proposta, validação de titular, idempotência, reconciliação e RLS existentes.
- Não imprimir nem transferir credenciais. Não solicitar exportação dos tokens; o proprietário configura secrets diretamente no projeto quando houver um plano aprovado.
- Manter produção bloqueada por padrão. Um health check autenticado não equivale a autorização para consultar relatório.
- Não assumir `segmentCode=028`, Score PJ, canal ou nome de relatório a partir de collections/exemplos.
- Separar evidência Serasa de análises MERX futuras; não tratar falta de score/dado como zero.

## Escopo proposto após aprovação

1. Corrigir documentação operacional antiga que descreve o health check/aliases de forma divergente do código atual e registrar que `SERASA_API_URL` aponta para produção.
2. Ajustar a seleção PF para `RELATORIO_AVANCADO_PF` e manter PJ `RELATORIO_AVANCADO_PJ_ANALITICO`; nenhum produto Top Score ou parâmetro de segmento será presumido.
3. Corrigir a visualização para consumir o shape normalizado atual da resposta PF/PJ, preservando estados indisponível, não retornado e sem cálculo.
4. Revisar a resposta do health check para deixar claro que testa IAM, sem alegar que valida o relatório contratado.
5. Criar migration aditiva que altera apenas o nome PF nas linhas UAT/produção, sem ativar produção; executar lint, typecheck, build e testes locais existentes para as Edge Functions/UI alteradas; verificar status/migration sem aplicar mudanças remotas.
6. Preparar passos de configuração no Supabase e smoke autenticado de UAT ou produção, dependendo da confirmação do endpoint. Execução de consulta produtiva, configuração remota de secrets/flags, deploy e migrations remotas ficam fora deste GO e exigem autorização própria.

## Arquivos esperados

- `supabase/functions/_shared/serasa-reports.ts` e `consulta-executar/index.ts`, apenas se a confirmação de contrato exigir ajuste.
- Nova migration local aditiva para corrigir `report_pf` nas configurações existentes; não será aplicada remotamente.
- `app/src/components/PropostaConsultas.tsx`.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md` ou novo runbook de configuração.
- Testes já existentes do adaptador/normalizador, sem adicionar dependências.

## Requisitos e critérios de aceite

- PF e PJ exibem campos a partir do contrato normalizado; nenhum dado bruto do fornecedor vai para o navegador.
- Relatórios enviados correspondem aos produtos avançados PF/PJ confirmados pelo usuário; sem Score opcional ou segmento inventado.
- Erros de IAM, produto não autorizado, relatório ausente, score sem cálculo e reconciliação pendente são estados distintos e não são convertidos em score zero.
- Filtros de autorização e vínculo de proposta/titular continuam no servidor.
- Produção segue bloqueada e nenhum relatório é consultado durante validações automatizadas.
- Lint/typecheck/build concluem sem erros novos; passos de validação manual são reportados sem alegar teste de produção.

## Segurança

- Nenhuma credencial em código, logs, plano, cliente ou artefatos de teste.
- Não executar chamada de consulta Serasa produtiva, alterar secrets/flags, publicar Edge Function ou aplicar migration remota sem aprovação específica.
- Usar titular e finalidade autorizados; não usar CPF/CNPJ real em fixtures ou smoke de desenvolvimento.
- Restringir qualquer leitura de resultado ao acesso já concedido sobre a proposta; preservar RLS e menor privilégio.

## Testes planejados

- Automatizados: lint, typecheck, build e testes focados já existentes de normalização/contrato.
- Manuais locais: exibição PF/PJ, sem resultado, score ausente/sem cálculo, erro de provedor e reconciliação pendente.
- Ambiente: inspeção somente leitura da configuração. Smoke de relatório apenas em UAT e com massa fictícia documentada, após autorização; smoke de produção requer novo GO explícito por potencial custo e uso de dados pessoais.
