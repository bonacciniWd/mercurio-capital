# Plano — imagens institucionais nos e-mails Mercúrio

## Objetivo

Substituir a arte promocional usada como cabeçalho dos e-mails por imagens institucionais versionadas em `app/public`, usando URLs públicas absolutas no domínio da Mercúrio. Manter os arquivos fornecidos sem alteração nesta etapa.

## Documentos e referências lidos

- `AGENTS.md` fornecido na conversa.
- `docs/README.md`.
- `docs/operacao/simulador-publico.md`.
- `docs/operacao/release-checklist.md`.
- `prompts/2026-10-20-padrao-emails-simuladores-auth.md`.
- Templates e migrations transacionais/Auth descritos abaixo.

## Código e configuração inspecionados

- `app/public/01.png`, `app/public/02.png` e `app/public/03.png`.
- `supabase/templates/transacional/simulacao-parcelas-resultado.html`.
- `supabase/templates/transacional/simulacao-amortizacao-resultado.html`.
- `supabase/templates/auth/*.html`.
- `supabase/migrations/20261020000001_brand_simulador_result_email_templates.sql`.
- `supabase/migrations/20260717000001_canonical_links_proposal_emails.sql`.
- Catálogo e fluxo existentes de `templates_mensagem`, `email_outbox` e Supabase Auth.

## Decisões e suposições

- `03.png` será usado nos resultados das calculadoras e nos e-mails transacionais relacionados a propostas (`proposta_cliente_magic_link_v1` e `proposta_status_changed_v1`).
- `01.png` será usado nos convites de parceiros. O convite inicial de parceiro usa `auth.admin.inviteUserByEmail`, o mesmo template global de convite que também serve convites internos; por isso o template Auth compartilhado terá `01.png` em todos os convites. O reenvio de convite de parceiro por `admin-partner-invite-resend` gera HTML próprio e também será atualizado para `01.png`.
- `02.png` será usado nos demais e-mails: avisos internos dos simuladores, convite de equipe, demais templates Auth e notificações que não sejam resultado de proposta.
- URLs propostas: `https://www.mercuriocapitalsa.com.br/01.png`, `/02.png` e `/03.png`. A verificação inicial encontrou fallback da aplicação HTML nessas rotas em produção; os arquivos precisam ser publicados pela Vercel antes que os templates possam carregá-los.
- Os assets têm aproximadamente 3,1 MB, 832 KB e 2,1 MB. Permanecerão intactos nesta implementação; compressão ou conversão fica fora do escopo.
- As alterações locais produzirão HTMLs atualizados para os templates Auth, que continuam sendo inseridos manualmente no painel Supabase, uma migration idempotente para os códigos acima em `templates_mensagem` e a atualização do HTML próprio usado no reenvio de convites de parceiros.
- Não serão enviados e-mails reais. Deploy Vercel e aplicação da migration em produção serão etapas separadas após revisão do resultado local e aprovação operacional específica.

## Arquivos esperados

- Atualizar as referências de imagem nos HTMLs em `supabase/templates/auth/` e `supabase/templates/transacional/`.
- Criar migration idempotente para atualizar os templates transacionais de calculadora, avisos internos de lead, convite de equipe e notificações de proposta mantendo códigos, variáveis, assunto, status e fluxo de envio.
- Atualizar `supabase/functions/admin-partner-invite-resend/index.ts` para usar a imagem de convite, preservando action link, destinatário, metadados e controles existentes.
- Atualizar `docs/operacao/simulador-publico.md` e os artefatos de template para registrar mapeamento e URLs.
- Atualizar `supabase/scripts/validate-email-templates.mjs` para verificar o mapeamento e os caminhos dos três PNGs.

## Critérios de aceite

- Os templates de resultado de Home Equity/amortização e de proposta referenciam `03.png`.
- Convites Auth e reenvios de convite de parceiro referenciam `01.png`; a imagem Auth também aparece em convites internos por compartilharem o fluxo Supabase Auth.
- Avisos internos dos simuladores, convite de equipe e demais templates acordados referenciam `02.png`.
- Nenhum template de e-mail continua apontando para `call-to-DyM9aWlp.png`.
- Os templates preservam todos os placeholders exigidos, conteúdo, links, destinatários e regras de envio existentes.
- Os três assets, quando publicados, respondem como `image/png` em HTTPS no domínio da Mercúrio, sem fallback SPA.
- Prévia/validação local não dispara e-mail e não revela dados reais de leads ou tokens.

## Segurança e publicação

- Não alterar a lógica de envio, destinatários, segredos, callbacks ou conteúdo sensível.
- Nenhum token privado, link de autenticação real ou dado de lead entra nos HTMLs.
- A aplicação da migration em produção, publicação Vercel e substituição manual dos templates Auth no painel exigem revisão dos artefatos finais e autorização específica.

## Verificações

- `node supabase/scripts/validate-email-templates.mjs`.
- `git diff --check`.
- Verificar placeholders/códigos da migration contra as funções que enfileiram cada e-mail.
- Após autorização de publicação, verificar status HTTP, `Content-Type: image/png` e os três caminhos no domínio de produção; consultar os templates transacionais no banco para confirmar o mapeamento.
- Conferir o HTML/Auth em preview com dados sintéticos e imagens habilitadas/desabilitadas, sem envio a destinatários reais.

## Publicação Vercel executada

- Projeto: `mercurio-digital`; Root Directory configurado como `app`, relativo à raiz Git.
- A tentativa de executar o CLI a partir de `app/` falhou porque o Vercel resolveu `app/app`. A publicação foi executada da raiz Git e ficou `READY`, com alias nos domínios Mercúrio.
- Para evitar recorrência, foi criado `scripts/deploy-vercel-production.sh`, que localiza a raiz Git antes de chamar o CLI. O runbook operacional documenta a causa e o comando canônico.
- Os três assets foram verificados no domínio público como `200 image/png`.
- Migration `20261020000002_email_template_brand_images.sql` aplicada em produção; histórico remoto conferido.
- Edge Function `admin-partner-invite-resend` publicada na versão 6; smoke HTTP sem autenticação respondeu `401`, confirmando o bloqueio do gateway. Nenhum convite ou e-mail foi enviado.
- Templates Auth permanecem para atualização manual no painel Supabase com os arquivos versionados em `supabase/templates/auth/`.
