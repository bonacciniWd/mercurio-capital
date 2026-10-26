# Plano — captura e gestão de leads CPC

**Status:** aprovado para implementação local com ajuste solicitado pelo usuário em 2026-10-16: reservar `/politica-de-privacidade` como destino público; o modelo básico da política será implementado em etapa posterior. Nenhuma alteração remota ou publicação está autorizada.

## Objetivo

Fazer o CTA “Solicitar análise do projeto” da rota pública `/credito-para-construcao` abrir um formulário CPC na própria página. Após consentimento e envio válido, registrar o contato como lead do tipo CPC e exibi-lo em `/admin/leads/simulacoes`, separado visualmente dos leads Home Equity e amortização.

## Documentos e instruções consultados

- Instruções `AGENTS.md` fornecidas nesta conversa.
- `docs/README.md` — stack e convenções do projeto.
- `docs/blueprint/08-security-compliance.md` — RLS, consentimento, PII e segurança de Edge Functions.
- `docs/blueprint/03-routes-navigation.md` — rotas administrativas e escopo interno.
- `docs/operacao/simulador-publico.md` — captura, acesso e limites dos leads atuais.
- `prompts/2026-10-16-rota-credito-para-construcao.md` — decisões e limites da página CPC.
- Skill externa: nenhuma aplicável à alteração de uma página já existente neste app React/Vite.

## Código e configuração inspecionados

- `app/src/pages/CreditoParaConstrucao.tsx` e `app/src/pages/credito-para-construcao.css` — CTA atual e padrões visuais do CPC.
- `app/src/pages/admin/LeadsSimulacoes.tsx`, `app/src/components/SimulacaoLeadDetalhe.tsx` e `app/src/lib/simulacaoLeadPresentation.ts` — listagem, filtros, paginação e painel de detalhes.
- `app/src/lib/mensagensSimulador.ts` e seção de mensagens em `app/src/pages/admin/Configuracoes.tsx` — contato WhatsApp atual.
- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql`, `20261007000001_simulacao_amortizacao_publica.sql` e `20261007000002_simulacao_planos_contato.sql` — tabela, view administrativa, RLS e captura dos simuladores.
- `supabase/functions/public-simulacao-lead/index.ts` e `supabase/config.toml` — padrão de endpoint público, validação, idempotência, honeypot e rate limit.
- `app/src/test/creditoParaConstrucao.test.tsx` e `app/src/test/adminLeadsSimulacoes.test.tsx` — testes dos fluxos existentes.

O endpoint e a tabela dos simuladores exigem dados financeiros específicos. A implementação CPC não enviará valores fictícios nem alterará os contratos dessas calculadoras.

## Modelo de dados proposto

### `public.cpc_leads_publicos`

Tabela própria, sem relacionamento obrigatório com propostas ou simulações. Campos:

| Campo | Regra |
|---|---|
| `id` | UUID, chave primária gerada pelo banco. |
| `idempotency_key` | UUID obrigatório e único para evitar duplicidade em reenvios. |
| `nome_completo` | Obrigatório, 3–160 caracteres após trim. |
| `email` | Obrigatório, validado e normalizado para minúsculas. |
| `telefone` | Obrigatório, armazenado apenas com 10–11 dígitos. |
| `cidade` e `uf` | Opcionais; localização do projeto, sem endereço completo. `uf` limitado às UFs brasileiras. |
| `fase_projeto` | Obrigatória; domínio fechado: terreno definido, projeto aprovado, orçamento/cronograma, obra iniciada ou outro. |
| `resumo_projeto` | Opcional, texto curto com limite de 2.000 caracteres. Não aceitar documentos nem dados financeiros sensíveis nesta captura. |
| `consentimento_em` | Horário registrado pelo servidor. |
| `consentimento_versao` | Identificador da versão do texto de consentimento. |
| `origem` | Fixo como `Site da Mercúrio · CPC`, definido no servidor. |
| `created_at` | `timestamptz`, definido pelo banco. |

Não haverá valor de crédito, parcela, LTV ou resultado de análise: a página CPC não calcula esses dados.

### Leitura administrativa

Criar a view `v_admin_leads_publicos`, combinando a view existente dos simuladores com os registros CPC. A linha CPC terá `tipo_simulacao = 'cpc'` e campos financeiros/e-mail não aplicáveis como `NULL`. A view usará `security_invoker = on`; RLS da tabela CPC permitirá leitura apenas a `app_is_admin()`. `anon` e `public` não terão leitura nem escrita direta. Parceiros continuam sem acesso.

A migration incluirá a configuração `cpc_captura_publica_ativa`, iniciada como `false`. A Edge Function recusará gravações enquanto ela estiver desativada. Isso permite preparar e testar a captura sem coletar dados reais antes da publicação do conteúdo de privacidade.

O painel continuará lendo uma única lista ordenada por data, preservando a busca, os filtros por período, a paginação e os registros atuais. A busca por estado de e-mail continuará filtrando apenas calculadoras, pois CPC não dispara e-mails nesta etapa. O detalhe CPC exibirá contato, fase, localidade, resumo, consentimento e data, sem blocos financeiros.

## Decisões e suposições para aprovação

- O botão abre um formulário embutido na seção de conversão da página; não redireciona.
- Nome, e-mail, telefone, fase do projeto e consentimento serão obrigatórios. Cidade/UF e resumo do projeto serão opcionais para minimizar a coleta.
- A captura CPC usa uma nova Edge Function `public-cpc-lead`, isolada de `public-simulacao-lead`; gravação ocorre somente no servidor.
- A listagem e o detalhe existentes receberão uma categoria CPC. O botão WhatsApp do detalhe usará uma mensagem própria, com o nome e a referência a Crédito para Construção, sem inventar valor simulado; envio continuará manual, após revisão do operador.
- Não enviar e-mail ao lead nem à equipe, não criar proposta e não classificar/aprovar crédito automaticamente.
- O formulário exigirá consentimento e link para a Política de Privacidade. Não encontrei rota ou URL pública da política no app/documentação; o link será requisito antes de habilitar a captura em produção.
- Reservar a rota pública `/politica-de-privacidade` como destino do consentimento e apresentar nela um aviso temporário de que o conteúdo está em elaboração; o modelo básico da política fica para etapa posterior.
- Não redigir nem publicar conteúdo jurídico como parte da implementação técnica sem texto aprovado pela Mercúrio. A captura CPC não será publicada/ativada em produção até existir conteúdo de Política de Privacidade aprovado nessa rota.
- A alteração prevista é local. Migration, publicação da Edge Function, deploy Vercel e artefatos Electron ficam fora deste plano e precisarão de autorização própria.

## Arquivos esperados

- `app/src/pages/CreditoParaConstrucao.tsx` — estado de abertura, envio e confirmação do formulário.
- `app/src/pages/credito-para-construcao.css` — estilos do formulário seguindo os tokens e componentes visuais da própria página.
- `app/src/pages/public/PoliticaPrivacidade.tsx` e `app/src/router.tsx` — rota pública reservada com aviso temporário, sem conteúdo jurídico.
- `app/src/lib/cpcLead.ts` — tipos e chamada segura ao endpoint, sem acesso direto à tabela.
- `app/src/pages/admin/LeadsSimulacoes.tsx` — consumo da view unificada e apresentação do tipo CPC.
- `app/src/components/SimulacaoLeadDetalhe.tsx` e `app/src/lib/simulacaoLeadPresentation.ts` — campos CPC e rótulos específicos.
- `app/src/test/creditoParaConstrucao.test.tsx` e `app/src/test/adminLeadsSimulacoes.test.tsx` — envio, erros, classificação e detalhe CPC.
- `supabase/migrations/20261016000001_leads_publicos_cpc.sql` — tabela, índices, RLS, privilégios, configuração de captura iniciada desligada e view administrativa unificada.
- `supabase/functions/public-cpc-lead/index.ts` e `supabase/config.toml` — endpoint público restrito a POST/OPTIONS e `verify_jwt = false`.
- `supabase/smoke-tests/fase-44-leads-publicos-cpc.sql` — verificações de privilégios e isolamento entre anon, parceiro e admin.
- `docs/operacao/leads-publicos-cpc.md` — finalidade, campos, acesso, retenção e procedimento de validação.

## Critérios de aceite

1. CTA abre o formulário na página; fluxo de sucesso e falha é anunciado por tecnologia assistiva e funciona em celular/desktop.
2. Campos obrigatórios, formato de e-mail/telefone, limites de texto e consentimento são validados no cliente e novamente na Edge Function/banco.
3. Envio válido aparece no módulo `/admin/leads/simulacoes` com rótulo CPC, sem parecer Home Equity ou amortização.
4. Busca, ordenação, filtros de data e paginação incluem leads CPC; filtro de estado de e-mail não inventa status para CPC.
5. Detalhe CPC mostra somente os dados CPC e oferece contato manual por WhatsApp sem valor financeiro fictício.
6. As calculadoras atuais, seus dados e a captura existente continuam sem alteração de comportamento.
7. Repetir a mesma chave de idempotência não cria duplicidade; honeypot e rate limit bloqueiam abuso.
8. Usuário anônimo/parceiro não pode ler dados CPC nem gravar diretamente na tabela; somente o endpoint pode gravar e somente admin interno pode consultar.
9. O checkbox vincula a Política de Privacidade pública e registra versão/data do consentimento.

## Segurança e privacidade

- Edge Function pública sem JWT, mas com validação de método, tamanho de payload, campos, consentimento, honeypot, idempotência e rate limit por e-mail/IP.
- Service role restrita à função; nenhuma chave privilegiada no navegador.
- Tabela com RLS habilitada, privilégios mínimos, leitura `app_is_admin()` e sem política pública de insert.
- Configuração de captura pública começa desativada; a função valida esse estado no servidor antes de gravar.
- Respostas e logs não incluem telefone/e-mail em claro; erros retornam códigos genéricos e o payload nunca inclui stack trace.
- Coletar apenas contato e informações resumidas necessárias para triagem; sem endereço completo, documentos, CPF ou análise automática.
- Não executar smoke com PII real ou em produção nesta etapa.

## Testes previstos após aprovação

**Automáticos:** testes do formulário e painel CPC; lint; typecheck; suíte Vitest; build web; revisão de `git diff --check`.

**Manuais no navegador:** abrir a rota diretamente; expandir o formulário; testar obrigatórios e consentimento ausente; submeter um contato sintético ao backend local; confirmar mensagem de sucesso e erro recuperável; verificar listagem/detalhe/admin; confirmar que o simulador continua funcionando; revisar desktop e mobile e navegação por teclado.

**Banco local/staging:** aplicar migration isolada e executar o smoke SQL verificando acesso de anon, parceiro e admin. Produção exige aprovação separada.

## Pontos pendentes antes do aceite final

- Implementar e aprovar o modelo básico da Política de Privacidade antes de habilitar a captura CPC em produção. O usuário confirmou que a página pública ainda não existe e pediu para reservar o slug agora.
