# MERX pública — atendimento e captação por intenção

## Jornada

Ao abrir o chat, a MERX identifica-se como assistente virtual da Mercúrio Capital, explica que pode orientar parceiros e clientes e pergunta o nome. O visitante pode pular a pergunta. Depois escolhe entre **originador/parceiro** e **cliente buscando crédito**.

- Originador: recebe uma explicação curta sobre o workspace, pode abrir `/p/registro` ou pedir contato da equipe.
- Cliente: escolhe Home Equity, Crédito para Construção, Financiamento Imobiliário ou “Ainda estou avaliando”. A MERX oferece rotas públicas reais quando existentes e pode encaminhar um pedido de contato.
- Pergunta não coberta pela FAQ: recebe o fallback configurado; a escolha de trilha e a opção de contato continuam disponíveis.

O nome e as mensagens livres permanecem apenas no estado em memória do chat. Fechar pelo botão, pelo acionador ou por Escape limpa essa conversa. O nome só é transmitido ao servidor se a pessoa abrir o formulário, revisar os campos e enviar com o consentimento marcado. O nome pré-preenchido continua editável. Nenhum usuário/parceiro é criado e nenhuma proposta é aberta pelo chat.

## Conteúdo aprovado e fontes

As respostas base são curadas a partir destas fontes públicas do próprio produto:

- `app/src/pages/Landing.tsx`: produtos e recursos públicos do workspace.
- `app/src/pages/CreditoParaConstrucao.tsx`: finalidade, análise e etapas do CPC.
- `docs/operacao/simulador-publico.md` e `app/src/pages/public/Simulador.tsx`: estimativa do Home Equity e limites do simulador.
- `app/src/pages/public/Registro.tsx` e `docs/blueprint/02-roles-permissions.md`: cadastro, aprovação e limites de papel de parceiro.

Os textos de resposta para workspace, Home Equity, Construção e Financiamento podem ser revistos por Admin completo na configuração existente da MERX. Os botões de rota são um catálogo fixo de páginas públicas. A MERX não lê documentos privados no browser, não consulta Serasa/WhatsApp/MCP e não chama LLM. Não promete aprovação, taxa, prazo ou limite financeiro.

Financiamento Imobiliário é descrito na landing, sem rota pública própria identificada. A resposta pode apresentar a descrição publicada e oferecer contato; não simula uma operação.

## Lead armazenado

Reutiliza `merx_leads_publicos`; não cria uma tabela de sessão/conversa. O envio mantém nome, cidade, e-mail, telefone obrigatório, assunto/interesse, página de origem, consentimento e idempotência já existentes. O catálogo de `interesse` agora aceita:

- `atendimento`
- `home_equity`
- `construcao`
- `financiamento_imobiliario`
- `parceiro_originador`

“Ainda estou avaliando” usa `atendimento`. A origem técnica continua MERX; `parceiro_originador` apenas classifica a intenção declarada. No painel Admin, aparece como **Potencial parceiro · MERX** e não é somado a crédito, simuladores ou mapa de imóveis. O status comercial inicial permanece **Novo** e transições seguem a RPC auditada já existente.

O formulário continua dependendo de habilitação de captação e mantém validação server-side, reCAPTCHA v3, honeypot, rate limit, chave idempotente e acesso administrativo/RLS existentes. A política pública informa que o interesse em parceria não cria conta.

## Validação e publicação

Testes automatizados cobrem as duas trilhas, prefill editável, links, catálogo de interesse e apresentação Admin. O smoke `supabase/smoke-tests/fase-52-merx-interest-catalog.sql` usa dados sintéticos dentro de transação com `ROLLBACK`; executar apenas em local/teste após a migration.

A migration `20261030000003_merx_intent_catalog.sql` é local e aditiva. Ela não foi aplicada remotamente; a Edge Function não foi publicada e a configuração de produção não foi ativada. Antes de aplicar migrations remotamente, reconciliar a duplicidade preexistente do timestamp `20261029000001` no histórico local/remote.
