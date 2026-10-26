# Plano — backend de leads CPC e painel administrativo em produção

**Status:** aprovado pelo usuário em 16/10/2026 e executado. A captura CPC permanece desativada.

## Objetivo

Remover a falha de carregamento de `/admin/leads/simulacoes` e preparar o endpoint CPC em produção, mantendo `cpc_captura_publica_ativa = false` enquanto a Política de Privacidade permanecer como minuta. Não publicar o frontend na Vercel nem habilitar captura CPC nesta etapa.

## Documentos e instruções lidos

- `AGENTS.md` fornecido nesta conversa.
- `docs/README.md` — stack e convenções.
- `docs/blueprint/08-security-compliance.md` — RLS, menor privilégio e limites das Edge Functions.
- `docs/blueprint/03-routes-navigation.md` — rotas públicas e administrativas.
- `docs/operacao/simulador-publico.md` — captura atual e acesso aos leads.
- `docs/operacao/leads-publicos-cpc.md` e `docs/operacao/politica-privacidade-publica.md` — estado de ativação e privacidade.
- `prompts/2026-10-16-captura-lead-publico-cpc.md` — escopo aprovado para implementação local e gate de publicação.

## Código, configuração e produção inspecionados

- `app/src/pages/admin/LeadsSimulacoes.tsx` — consulta `v_admin_leads_publicos`.
- `app/src/components/CpcLeadForm.tsx` e `app/src/lib/cpcLead.ts` — formulário e chamada à função CPC.
- `supabase/functions/public-cpc-lead/index.ts` e `supabase/config.toml` — contrato, validação e configuração da função.
- `supabase/migrations/20261013000003_simulador_comercial_parametros.sql` — configuração pendente, com parâmetros em estado de validação financeira.
- `supabase/migrations/20261016000001_leads_publicos_cpc.sql` — tabela CPC, view administrativa, RLS e gate inicialmente desligado.
- `supabase/smoke-tests/fase-44-leads-publicos-cpc.sql` — verificações read-only de segurança e estado do gate.
- Histórico remoto: as migrations `20261013000003` e `20261016000001` não aparecem aplicadas; `public-cpc-lead` não aparece na lista de funções publicadas.
- `supabase db push --linked --dry-run` informa que publicaria as duas migrations pendentes. Uma consulta à função CPC respondeu HTTP 404.

## Decisões e suposições

- O `db push` deverá aplicar as duas migrations pendentes em ordem, conforme o dry-run do CLI; não executar SQL manualmente para contornar o histórico.
- Publicar somente a Edge Function `public-cpc-lead`; não alterar `public-simulacao-lead`.
- Manter o gate CPC desligado e não criar lead CPC de teste nesta etapa.
- Verificar a configuração `cpc_captura_publica_ativa` por consulta read-only antes de publicar a função; se estiver `true` ou não puder ser verificada, interromper e pedir nova autorização. A migration usa `ON CONFLICT DO NOTHING`, portanto seu valor inicial local não prova o estado remoto.
- Não publicar a rota do site na Vercel nem gerar artefatos Electron.
- A mensagem da página e a captura CPC só poderão ser habilitadas após aprovação e publicação da Política de Privacidade.

## Arquivos e recursos esperados

- Em produção: aplicar `20261013000003_simulador_comercial_parametros.sql` e `20261016000001_leads_publicos_cpc.sql` pelo fluxo versionado do Supabase.
- Em produção: publicar `supabase/functions/public-cpc-lead`.
- No workspace: somente este plano; nenhuma alteração de código prevista.

## Requisitos e critérios de aceite

- O histórico remoto registra as duas migrations aplicadas sem divergências.
- O smoke `fase-44-leads-publicos-cpc.sql` confirma tabela, view, RLS, privilégios e gate CPC desligado; se falhar nesse critério, não publicar a função.
- `public-cpc-lead` está ativa e uma solicitação sintética válida retorna `capture_disabled`, sem gravar lead.
- Usuário interno autorizado abre `/admin/leads/simulacoes` sem o erro de carregamento e pode consultar leads existentes; parceiros e usuários anônimos não recebem acesso.
- A configuração `simulador_parametros` permanece `aguardando_validacao_financeira`; encargos não são ativados nem calculados.
- A rota pública e os artefatos Electron permanecem sem publicação nesta etapa.

## Considerações de segurança

- `v_admin_leads_publicos` usa `security_invoker`; a tabela CPC tem RLS e leitura restrita a `app_is_admin()`.
- `anon` não recebe SELECT/INSERT direto; gravações CPC usam service role apenas na Edge Function.
- O gate permanece `false`; não enviar e-mail nem criar registros CPC durante o smoke.
- Não registrar tokens, headers de sessão, payloads com PII ou conteúdo de outros leads.
- O migration dry-run inclui a migration anterior de parâmetros comerciais; ela será aplicada somente com este escopo aprovado e seus valores continuarão nulos/pendentes.

## Testes após autorização

- Repetir `supabase db push --linked --dry-run` imediatamente antes da operação e confirmar que a lista contém somente as duas migrations descritas.
- Antes da publicação da função, verificar o gate em consulta read-only; interromper caso não esteja comprovadamente desligado.
- Aplicar migrations pelo fluxo oficial; confirmar histórico remoto.
- Executar `supabase/smoke-tests/fase-44-leads-publicos-cpc.sql` e revisar privilégios/RLS.
- Publicar a Edge Function e enviar payload sintético, esperando `capture_disabled`.
- No Chrome autenticado como usuário interno, validar `/admin/leads/simulacoes`; não inspecionar outros dados de leads.
- Rodar `npm test -- src/test/adminLeadsSimulacoes.test.tsx` e `npm test -- src/test/creditoParaConstrucao.test.tsx`.

## Aprovação

O usuário autorizou a execução deste plano em 16/10/2026. A autorização não habilita a captura CPC nem autoriza publicação do site.

## Resultado da execução — 16/10/2026

- Aplicadas em produção, pelo fluxo versionado, as migrations `20261013000003` e `20261016000001`; o histórico remoto confirma ambas.
- O smoke SQL `fase-44-leads-publicos-cpc.sql` passou sem exceções. A tabela e a view foram criadas com os privilégios e RLS definidos; a configuração da captura ficou `false`.
- A consulta read-only confirmou `simulador_parametros_status = aguardando_validacao_financeira`; os encargos seguem sem ativação.
- Publicada somente a Edge Function `public-cpc-lead` (versão 1). Um payload sintético válido retornou `capture_disabled` (HTTP 503), antes de gravação ou rate limit. Nenhum lead CPC ou e-mail foi criado/enviado.
- No Chrome, o formulário CPC local foi submetido com dados sintéticos e exibiu a mensagem prevista de captura desativada; houve uma chamada ao endpoint e nenhum registro foi criado. O navegador voltou a `localhost:5173/admin/leads/simulacoes`, onde o título “Leads do site”, 7 linhas e ausência de erro de carregamento foram confirmados. A listagem publicada no domínio também havia carregado normalmente; não houve deploy do frontend.
- Testes focados: `adminLeadsSimulacoes.test.tsx` — 9 aprovados; `creditoParaConstrucao.test.tsx` — 4 aprovados.
- O Chrome confirmou que `/credito-para-construcao` em produção ainda redireciona à página inicial. Esta publicação não alterou a Vercel nem habilitou captura CPC.
