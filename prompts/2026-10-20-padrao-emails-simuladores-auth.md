# Plano — Identidade visual dos e-mails de simulação e autenticação

## Objetivo

Padronizar os e-mails enviados ao cliente com resultados dos simuladores de parcelas/Home Equity e amortização com a identidade visual Mercúrio mostrada nos HTMLs fornecidos. Preparar também os templates de autenticação do Supabase Auth: confirmação, convite, magic link, recuperação de senha, alteração de e-mail e o template de código OTP/reautenticação fornecido.

Esta etapa não altera produção, não envia e-mail real e não modifica os templates de notificação interna de novos leads.

## Documentos e referências consultados

- Instruções de trabalho `AGENTS.md` fornecidas na conversa.
- `docs/README.md`.
- `docs/operacao/simulador-publico.md`.
- `prompts/2026-09-28-documentacao-imagem-template-email.md`.
- Supabase Docs: [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates), [CLI Config](https://supabase.com/docs/guides/local-development/cli/config), [Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Código e configuração inspecionados

- `app/src/pages/admin/Templates.tsx` e `app/src/lib/templateEmail.ts`: gerenciamento, preview e enqueue de templates transacionais.
- `supabase/functions/email-dispatcher/index.ts`: entrega da fila `email_outbox` via Resend.
- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql`: template de resultado do simulador Home Equity e conjunto de variáveis.
- `supabase/migrations/20261007000001_simulacao_amortizacao_publica.sql`: template de resultado de amortização e conjunto de variáveis.
- `supabase/config.toml`: atualmente sem caminhos locais para templates HTML do Auth.
- `docs/operacao/simulador-publico.md`: separação entre captura, templates de resultado e dispatcher.

## Decisões e suposições

- Os resultados aos clientes continuam no catálogo `templates_mensagem`, são renderizados no servidor e enviados pelo fluxo existente `email_outbox`/Resend. O contrato e os nomes das variáveis financeiras permanecem inalterados.
- Os e-mails Auth permanecem no Supabase Auth e usam exclusivamente os placeholders Go Template documentados pelo Supabase, como `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` e `{{ .Token }}` conforme o tipo de mensagem.
- O HTML de alteração de e-mail será criado, pois foi informado que esse template ainda não existe. O template de OTP/reautenticação será associado ao tipo correto do painel após validar o rótulo do fluxo, sem mudar o comportamento de autenticação.
- O visual de referência será o HTML enviado: vermelho Mercúrio, preto e neutros, cabeçalho com imagem pública HTTPS, tabelas e estilos inline compatíveis com clientes de e-mail, com texto alternativo e conteúdo legível se imagens remotas forem bloqueadas.
- Como URL inicial do cabeçalho, considerar `https://www.mercuriocapitalsa.com.br/assets/call-to-DyM9aWlp.png`, já usada nos HTMLs e verificada com resposta HTTP 200. O arquivo atual tem aproximadamente 1 MB; otimização será recomendada, sem substituir ou publicar outro binário sem a fonte final disponível.
- O painel Supabase hospedado não é atualizado por `config.toml`; os arquivos locais serão artefatos versionados e a sincronização do Auth em produção exigirá inserção manual no Dashboard ou autorização específica para alteração remota.
- Não serão alterados SMTP, secrets, URLs de callback, validade de tokens, regras de signup/invite, destinatários, tracking, consentimento ou lógica de negócio.

## Arquivos esperados após aprovação

- Nova migration idempotente para atualizar somente os dois templates de resultado enviados ao cliente.
- HTMLs versionados em `supabase/templates/auth/` para os fluxos Auth acordados, incluindo o novo template de alteração de e-mail.
- `supabase/config.toml` com os `content_path` locais compatíveis para desenvolvimento, sem segredos.
- Atualização de `docs/operacao/simulador-publico.md` com o fluxo, os assets e o procedimento de aplicação no Dashboard Auth hospedado.
- Testes focados para confirmar preservação das variáveis de simulação e presença dos placeholders Auth exigidos por cada fluxo.

## Critérios de aceite

- Os dois e-mails de resultado exibem a marca Mercúrio, imagem do cabeçalho com URL HTTPS absoluta, CTA existente e seus resumos financeiros atuais.
- Price/SAC, valores, parcelas, juros, prazos, links de contato e aviso de simulação continuam corretos e usam exatamente os placeholders esperados pelos respectivos fluxos.
- Cada template de Auth contém o placeholder obrigatório do fluxo e não mistura placeholders de outros tipos.
- Alteração de e-mail tem template próprio com `.NewEmail`; OTP/reautenticação exibe `.Token` sem expor valores de exemplo em produção.
- O HTML funciona sem CSS externo e mantém conteúdo utilizável em viewport móvel e com imagens bloqueadas.
- Nenhuma alteração é enviada ao Supabase/Vercel e nenhum e-mail é disparado nesta etapa.

## Segurança

- Não colocar tokens privados, chaves SMTP/API, dados de leads ou links reais de autenticação nos arquivos ou previews.
- Preservar as URLs e placeholders de ação gerados pelo Supabase; não construir links de autenticação manualmente nem alterar callbacks.
- Não inserir conteúdo privado no Storage público; o asset de cabeçalho deve ser institucional e acessível sem autenticação.
- Os templates transacionais permanecem renderizados/enfileirados no servidor; nenhuma credencial ou lógica de envio vai para o navegador.
- Aplicação no Dashboard hospedado, migration remota, envio de teste e publicação exigem autorização separada.

## Verificações

### Automáticas

- Testes focados de placeholders para os dois templates transacionais e HTMLs Auth.
- `npm run typecheck` e `npm run build` se houver alteração em configuração consumida pelo projeto.
- `git diff --check`.

### Manuais

- Preview dos dois templates de resultado em `/admin/templates` com valores sintéticos.
- Preview local dos templates Auth e captura via Inbucket/Supabase local para confirmação, convite, magic link, recovery, alteração de e-mail e OTP/reautenticação, sem enviar para destinatários reais.
- Conferir layout em desktop e viewport móvel, texto alternativo, contraste, links, variável de cada botão e renderização sem imagem.
- Confirmar por inspeção que o dispatcher/outbox continua usando o HTML e os campos dinâmicos sem alteração do contrato.

## Status da execução local

Implementação aprovada e preparada localmente. O script `node supabase/scripts/validate-email-templates.mjs` passou; `supabase/config.toml` passou pela leitura de `tomllib`; a URL da imagem respondeu HTTP 200 e a rota pública da Política de Privacidade respondeu HTTP 200. Nenhum acesso remoto autenticado, migration, alteração do Dashboard Supabase, e-mail real ou publicação foi executado.
