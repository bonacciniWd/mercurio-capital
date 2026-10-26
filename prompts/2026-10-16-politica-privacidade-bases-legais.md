# Plano — ampliar a minuta de privacidade para a operação Mercúrio

**Status:** escopo inicial implementado e validado em 16/10/2026. A atualização posterior do status da página, após aprovação jurídica informada pelo usuário, está registrada em `prompts/2026-10-16-ajuste-status-politica-aprovada.md`. Nenhuma configuração de produção foi consultada ou alterada.

## Objetivo

Revisar `/politica-de-privacidade` para que a minuta cubra, em linguagem clara e separada por finalidade, os formulários públicos e o tratamento de dados nas propostas e na operação autenticada da plataforma. Descrever somente fluxos confirmados no código e na configuração que vier a ser verificada; distinguir capacidades disponíveis, uso efetivo e iniciativas futuras de IA.

O classificador operacional atual não deve ser chamado de IA: a versão encontrada é uma função determinística server-side. O LLM descrito no plano de melhoria operacional permanece como iniciativa futura até confirmação de implementação e ativação.

## Instruções, documentos e fontes consultados

- `AGENTS.md` fornecido nesta conversa.
- `docs/README.md`.
- `app/src/pages/public/PoliticaPrivacidade.tsx`.
- `docs/operacao/politica-privacidade-publica.md` e `docs/operacao/leads-publicos-cpc.md`.
- `docs/escopo-melhoria-operacao-llm.md`.
- `docs/operacao/criterios-classificador-leads-v1.md`.
- `prompts/2026-09-30-definicao-classificador-server-side.md`.
- `prompts/2026-09-25-integracao-serasa-verify-id.md`.
- `supabase/migrations/20261002000001_classificador_server_side_v1.sql`.
- `supabase/functions/consulta-executar/index.ts`.
- `docs/blueprint/07-integrations-flows.md` e `docs/blueprint/08-security-compliance.md`.
- LGPD no Planalto: https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm.
- Direitos dos titulares, incluindo revisão de decisões exclusivamente automatizadas, ANPD: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares.

## Código e fatos observados

- A rota pública já existe como minuta e atualmente declara que cobre CPC, Home Equity e amortização. Não cobre propostas ou módulos autenticados.
- Os simuladores públicos enviam campos de contato e operação e registram leads para consulta da equipe interna. O fluxo dos simuladores não executa consulta a bureau durante a simulação.
- CPC usa tabela e endpoint próprios; sua função verifica uma configuração server-side antes de gravar. Não será alterada nem habilitada neste escopo.
- A plataforma possui propostas, clientes, imóveis, documentos, pendências e logs de consultas. A consulta externa é executada pela Edge Function `consulta-executar`; a implementação contém caminhos para provedores reais quando as credenciais server-side estão configuradas, além de estados de falha/estorno. A configuração efetiva de produção não foi verificada.
- O classificador v1 está implementado como função SQL server-side e é acionado pela tela da proposta. Usa valor/situação da garantia, renda ou faturamento, documentos obrigatórios aprovados e pendências abertas/sinal jurídico. Não consulta diretamente os resultados de Serasa/Bacen e não chama um LLM.
- `classificador_ativo` tem default `false` na migration, mas o valor efetivo em produção não foi verificado. A função pode distribuir a proposta automaticamente quando habilitada e quando os critérios de confiança forem atendidos; sinal jurídico ou baixa confiança exigem revisão.
- O plano de LLM prevê assistência para classificação, checklist e explicação; isso não comprova que um modelo esteja ativo nem que dados de propostas sejam enviados a um provedor de IA.
- A documentação de segurança registra políticas de acesso e retenção-alvo para alguns registros, mas os prazos e fornecedores efetivos precisam ser reconciliados com a configuração e a operação atuais antes de aparecerem como compromissos da política.
- O código e os documentos revisados não confirmam razão social completa, canal de privacidade/encarregado, contratos atuais de correspondente ou lista final de instituições destinatárias. Não afirmar esses fatos sem confirmação.

## Decisões e suposições propostas

- Manter uma única rota pública, mas organizar o conteúdo em blocos distintos: formulários públicos; propostas e documentos na plataforma autenticada; consultas externas solicitadas no contexto de uma proposta; classificação e distribuição operacional; comunicações e prestadores.
- Distinguir a classificação determinística atual da iniciativa futura de LLM. Não dizer que a IA analisa consultas ou propostas até existir prova do fluxo ativo, provedor, dados enviados e finalidade.
- Descrever consultas externas como condicionais ao pedido autorizado e à configuração do provedor; não afirmar que todos os usuários ou todas as propostas são consultados.
- Não tratar o art. 7º, X como autorização genérica para qualquer consulta/compartilhamento, nem apresentar consentimento como base universal. A redação de cada finalidade ficará sujeita à validação jurídica.
- Não afirmar que a Mercúrio atua como correspondente ou compartilha dados com instituições financeiras específicas sem confirmação institucional e contratual.
- Manter aviso de minuta e links atuais; não transformar esta revisão técnica em aprovação jurídica ou publicação definitiva.
- Não alterar formulários, checkboxes, payloads, classificação, consultas, migrations, Edge Functions, credenciais, flags, envio de mensagens, banco remoto ou deploy.

## Confirmações necessárias antes da redação final

1. Razão social/controlador associado ao CNPJ e canal público para solicitações de privacidade/encarregado.
2. Quais fornecedores externos estão ativos e quais dados recebem, incluindo hospedagem, e-mail, analytics, consultas e eventual IA.
3. Se e quais consultas externas estão habilitadas em produção, campos efetivamente enviados e destinatários/provedores.
4. Se o classificador está ativo em produção e se a distribuição automática está habilitada; confirmar que a v1 usa regras determinísticas e não resultados de bureau.
5. Se algum LLM recebe dados de propostas hoje; se não, manter o plano de IA como futuro e revisar a política antes da ativação.
6. Prazos vigentes para propostas, documentos, logs de consultas, leads, backups e dados anonimizados.
7. Se a Mercúrio possui contratos de correspondente ativos; se sim, validar instituições, produtos e divulgações regulatórias aplicáveis.

As confirmações podem ser inseridas como pendências no rascunho. Nenhum campo em aberto será preenchido por inferência.

## Arquivos esperados após aprovação

- `app/src/pages/public/PoliticaPrivacidade.tsx` — ampliar e reorganizar a minuta com distinção entre dados públicos, dados de propostas e classificação/consultas condicionais.
- `docs/operacao/politica-privacidade-publica.md` — atualizar mapa de tratamento, fatos confirmados e pendências.
- `app/src/test/creditoParaConstrucao.test.tsx` e/ou `app/src/test/publicSimulator.test.tsx` — ajustar verificações de cobertura/rotulagem da política, se necessário.
- Este plano — registrar o escopo aprovado e os resultados da validação.

## Requisitos e critérios de aceite

- O leitor consegue distinguir os formulários públicos dos dados tratados em propostas autenticadas.
- A minuta descreve categorias e finalidades confirmadas: contato, dados da proposta/garantia, documentos, pendências, consultas quando solicitadas e classificação operacional.
- O texto explica que a classificação apoia organização/distribuição interna e não equivale à aprovação de crédito; qualquer distribuição automática permanece sujeita à configuração e aos critérios operacionais.
- A v1 determinística não é descrita como IA nem como baseada em consultas externas.
- LLM, parceiros financeiros, bureaus, transferência internacional, prazos de retenção e condição de correspondente só aparecem como operações atuais quando confirmados.
- A página continua marcada como minuta e a revisão não habilita captura CPC nem altera os consentimentos existentes.
- Nenhuma informação real de lead, CPF, credencial ou resultado de consulta é inserida no texto ou nos testes.

## Segurança e privacidade

- Não consultar, imprimir ou registrar valores de secrets; verificar configuração somente por metadados autorizados caso essa verificação seja aprovada em etapa própria.
- Não enviar PII ou documentos a LLM, provedor de teste, log ou chat.
- Preservar RLS, acesso por papel, logs de auditoria e gates existentes.
- Nenhuma alteração remota, migration, ativação de integração, teste com dados reais ou deploy faz parte da implementação da minuta.

## Testes após aprovação

- Teste direcionado da rota e dos links para a política.
- `npm test -- src/test/creditoParaConstrucao.test.tsx src/test/publicSimulator.test.tsx` em `app/`.
- `npm run lint`, `npm run typecheck` e `npm run build` em `app/`.
- Smoke manual no navegador para `/politica-de-privacidade` em desktop e mobile; conferir aviso de minuta e links nos formulários.
- Não enviar formulário, não disparar e-mail/WhatsApp, não alterar configuração de produção e não publicar/deployar.

## Aprovação e execução

- O usuário aprovou a implementação local do escopo em 16/10/2026.
- Implementada a ampliação da minuta e do mapa operacional, e atualizado o teste da página para validar o escopo autenticado, a classificação determinística e as pendências de revisão.
- Testes direcionados: `npm test -- src/test/creditoParaConstrucao.test.tsx src/test/publicSimulator.test.tsx` — 2 arquivos e 8 testes passaram.
- `npm run lint` — exit 0, sem erros; 38 avisos existentes em arquivos do projeto.
- `npm run typecheck` — passou.
- `npm run build` — passou; Vite emitiu apenas o aviso existente de chunk principal acima de 500 kB.
- Smoke visual em Chrome headless para `/politica-de-privacidade` em desktop e mobile. Na emulação mobile via DevTools Protocol, `innerWidth` e `documentWidth` foram ambos 390 px. Nenhum formulário foi enviado.
- Nenhuma migration, gravação com dados reais, envio de mensagem, consulta de secrets, alteração remota ou deploy foi executado.
- A aprovação técnica não equivale à validação jurídica, à confirmação de dados institucionais nem à autorização para publicação, ativação de integrações ou alteração de produção.

## Atualização posterior de status

Em 16/10/2026, o usuário informou que o advogado aprovou o texto e solicitou remover apenas os campos que o apresentavam como minuta ou em revisão jurídica/interna. A edição local remove esses marcadores sem inferir dados operacionais ausentes; veja `prompts/2026-10-16-ajuste-status-politica-aprovada.md`.
