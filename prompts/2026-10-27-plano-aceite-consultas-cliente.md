# Plano — aceite do titular para consultas da proposta

Data: 27/10/2026. Estado: aprovado para implementação local; o usuário escolheu um único aceite do cliente principal cobrindo os proponentes e serviços de consulta no escopo descrito. Não inclui migration remota, deploy, consulta paga ou ativação em produção.

## Objetivo

Permitir que o cliente registre, no primeiro acesso ao portal pelo magic link da proposta, o aceite necessário para consultas de crédito e dos imóveis vinculados àquela proposta, sem exigir upload de um documento de autorização. O registro deve ser feito pelo backend, atribuído ao titular autenticado e validado pelas RPCs antes de cada consulta.

## Documentos e referências lidos

- `AGENTS.md` enviado na conversa e `docs/operacao/change-management.md`.
- `docs/operacao/security-checklist.md` e `docs/operacao/release-checklist.md`.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md` e `prompts/2026-10-27-plano-validacao-serasa-pf-producao.md`.
- ANPD: FAQ sobre consultas a birôs e bases legais; a hipótese legal e o texto de transparência devem ser confirmados pelo controlador, sem tratar CPF cadastrado como autorização automática.

## Código inspecionado

- `app/src/pages/public/ClienteProposta.tsx`: visualiza proposta pelo magic link e inicia a ativação da conta.
- `supabase/functions/magic-link-consume/index.ts`: consome o token, cria/resolve usuário `client` e vincula `clientes.usuario_id`.
- `supabase/migrations/20260514000004_cliente_peek_proposta.sql` e `supabase/migrations/20260513000002_identidade.sql`: preview público de escopo limitado, clientes, titulares e magic links.
- `app/src/pages/partner/Wizard.tsx`: parceiro cria proposta, cliente e proponentes; envia magic link para ativar portal.
- `app/src/components/PropostaConsultas.tsx`: hoje exige selecionar documento aprovado, registra autorização Serasa e executa consulta.
- `supabase/migrations/20261021000001_serasa_relatorios_autorizacoes.sql`: `consulta_autorizacoes.documento_evidencia_id` é obrigatório e a RPC valida vínculo e documento aprovado.
- `supabase/functions/consulta-executar/index.ts`: consulta Serasa resolve CPF/CNPJ da proposta no servidor e a autorização é verificada antes do débito.
- `supabase/migrations/20260513000001_enums.sql`: tipos de consulta atuais incluem Bacen, Serasa, Jusbrasil, Escavador, RI Digital e Nacional Consultas.
- `supabase/migrations/20260513000003_originacao.sql`: proponentes e imóveis estão vinculados à proposta; proponentes podem não ter usuário/conta próprio.
- `consulta-executar` foi verificada por tipo: Serasa usa o fluxo protegido; Bacen usa integração quando configurada; Jusbrasil/Escavador, RI Digital e Nacional Consultas retornam respostas mock geradas localmente, não consultas reais aos provedores.

## Regras já decididas e ponto a confirmar

- O aceite deve ser dado pelo cliente principal no primeiro acesso ao portal via magic link; a ação do parceiro não pode ser registrada como se fosse do titular.
- Marcar o aceite não dispara chamadas nem débitos. Cada consulta continua passando por preço, saldo, autorização de proposta, role e RLS já existentes.
- O CPF/CNPJ continua sendo lido no servidor a partir do cadastro relacionado. Não transportar documento no payload do navegador.
- Escopo pedido pelo usuário: um aceite do cliente principal cobrindo consultas sobre todos os proponentes e imóveis desta proposta, incluindo serviços atuais e futuros de consulta.
- O registro/auditoria sempre identifica o cliente principal que marcou o aceite; não deve afirmar que cada co-proponente aceitou individualmente. O texto deverá explicar que dados dos demais proponentes e imóveis informados serão enviados aos provedores correspondentes para análise da operação.
- Serviços atuais devem ser enumerados por categoria/provedor na versão do aceite. Novas integrações poderão ser adicionadas somente quando estiverem dentro do escopo descrito de forma inteligível ao titular; ampliação material de dados/finalidade exige novo aceite versionado. Uma cláusula vaga “quaisquer serviços futuros” não deve ativar automaticamente provedores desconhecidos.
- O consentimento/instrução não pode rotular respostas mock como pesquisa externa real nem autorizar cobrança por uma resposta simulada. Somente integrações reais/configuradas entram no fluxo faturável; mocks ficam fora deste aceite e da consulta em produção.
- O controlador deve confirmar se sua base legal e os contratos com provedores permitem consultas sobre os co-proponentes a partir da instrução do cliente principal. O sistema não deve representar o aceite principal como aceite individual dos terceiros.

## Modelo de dados proposto para aprovação

1. Nova tabela de recibos de aceite digital, por proposta e cliente principal, referenciando `propostas`, `clientes` e `usuarios`; campos mínimos: categorias/provedores permitidos em versão, texto mostrado/versão, `aceito_em`, usuário que aceitou, `revogado_em` e `revogado_por`. Sem cópia de CPF/CNPJ, documento bruto, IP completo ou resposta de provedor.
2. O recibo pertence ao cliente principal mas cobre os dados dos proponentes e imóveis vinculados à mesma proposta, conforme o escopo mostrado. Persistimos apenas a instrução/aceite do cliente principal, sem criar registros de aceite fictícios para co-proponentes.
3. `consulta_autorizacoes` permanece como autorização operacional por consulta. Tornar `documento_evidencia_id` opcional apenas para registros cuja origem aponte para recibo digital válido e correspondente à proposta, categoria e versão; registros antigos com documento continuam válidos e imutáveis. Logs de consulta devem referenciar o recibo usado sem duplicar PII.
4. Escopos serão uma allowlist por categoria de dados e provedor real/configurado, com nova versão do texto para ampliação material. Nenhum provedor novo será automaticamente habilitado só por estar no enum; a integração deve declarar categoria coberta, ambiente ativo e adequação do texto antes de poder usar o recibo. Os provedores mock atuais não são ativados nem cobrados por este aceite.
5. Revogação do aceite impede novas consultas cobertas, sem apagar o histórico; consultas concluídas permanecem no log e não são desfeitas.

Relacionamento: `propostas 1:N aceites/versionamentos`; cada recibo pertence ao cliente principal autenticado daquela proposta e permite consultas cobertas sobre a proposta inteira. Cada consulta faturável referencia autorização operacional, recibo digital ou evidência documental legada. A semântica é “aceite/instrução do cliente principal para a operação”, não “consentimento individual dos demais titulares”. A base legal aplicável e a forma de informar co-proponentes precisam ser validadas pelo controlador antes do rollout.

## Arquivos esperados

- Nova migration aditiva em `supabase/migrations/` para recibos, constraints, RPCs, grants e RLS.
- `supabase/functions/magic-link-consume/index.ts` para receber e registrar o aceite server-side de forma segura/idempotente, sem expor service role.
- `app/src/pages/public/ClienteProposta.tsx` para exibir o checkbox informativo antes de ativar o portal.
- `app/src/components/PropostaConsultas.tsx` para usar o aceite registrado em vez de exigir arquivo quando o escopo/titular corresponder.
- RPC de início Serasa em migration aditiva para validar recibo/evidência, titularidade, escopo, role, proposta, preço, saldo e idempotência antes de debitar.
- testes da Edge Function, migration/smoke RLS, UI de aceite e documentação operacional.

## Critérios de aceite

- Sem aceite explícito, a ativação não registra permissão para consultas; a UI informa o escopo descrito. A ativação da conta e o acesso básico ao portal não devem ficar condicionados ao aceite de consultas, salvo se o produto/controlador confirmar essa necessidade; a alternativa é permitir recusar e seguir sem consultas.
- Com aceite, o servidor persiste cliente principal, proposta, escopos e versão do texto uma única vez; repetição segura do magic link não duplica nem amplia o aceite.
- O aceite não executa consulta, não debita wallet e não libera o resultado de outras propostas.
- RPC recusa ausência, revogação, titular errado, proposta diferente, escopo não coberto, role incompatível, saldo insuficiente e preço ausente antes de chamada externa/débito.
- As consultas cobertas aos proponentes desta proposta usam somente os documentos já associados a cada registro e ficam visíveis/auditadas como uso do aceite do cliente principal; não gerar falsas autorizações por pessoa.
- A aplicação continua lendo CPF/CNPJ apenas no servidor e retornando resumo sanitizado; RLS impede leitura cruzada entre clientes/parceiros.
- Registros documentais legados continuam consultáveis e não são reescritos.

## Segurança, testes e rollout

- Processamento de token e gravação ficam na Edge/RPC segura; cliente não define titular, escopos, usuário, `aceito_em` ou base legal livremente.
- Idempotência e concorrência do magic link precisam ser cobertas por RPC transacional e testes; falha de gravação não pode produzir conta parcialmente ativa sem aceite registrado.
- Testar via fixtures sintéticas: aceite ausente, presente, repetição, revogação, tentativa de outra proposta, acesso partner/client/admin, titular adicional, e preservação de autorização documental legada.
- Executar lint, typecheck, build, testes focados, smoke SQL com RLS e `git diff --check`; não executar consulta Serasa real nem usar carteira real.
- Migration local primeiro; qualquer migration remota, deploy da Edge Function/Vercel e ativação de consulta são gates separados e exigem autorização específica.
- Rollback: manter registros e histórico; desativar uso do novo caminho por configuração/RPC forward-fix, sem apagar recibos válidos.

## Aprovação

O dono do produto aprovou a implementação local de um único aceite do cliente principal cobrindo os proponentes e serviços da proposta no escopo versionado. Texto e base legal ainda exigem validação do controlador antes de rollout. Não inclui publicar, executar consulta paga ou alterar estado de produção.
