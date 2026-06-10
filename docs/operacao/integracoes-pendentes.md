# Status de integrações — Mercurio Capital
_Atualizado em 01/06/2026_

---

## ✅ Prontas / em andamento pelo cliente

| Serviço | Status |
|---|---|
| **Vimeo Pro** | ✅ Conta própria — só precisamos do e-mail para adicionar como colaborador e configurar whitelist do domínio |
| **Stripe** | ✅ Cliente providenciando — aguardando `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e Price IDs do LMS |
| **Clicksign** | ✅ Cliente providenciando — aguardando `CLICKSIGN_API_TOKEN` e `CLICKSIGN_WEBHOOK_SECRET` |
| **Resend** | ✅ Cliente providenciando — aguardando `RESEND_API_KEY` |
| **Bacen SCR** | ✅ Cliente providenciando — aguardando credenciais do parceiro homologado |
| **Jusbrasil** | ✅ Cliente providenciando |
| **Escavador** | ✅ Cliente providenciando |
| **RI Digital / ARISP** | ✅ Cliente providenciando |
| **Nacional Consultas** | ✅ Cliente providenciando |

---

## ⏳ Serasa — integração em progresso

API identificada: **Serasa Experian — Data Return for PF and PJ**
→ https://developer.serasaexperian.com.br/api/data-return-for-pf-and-pj

**O que precisamos do cliente:**
- `SERASA_CLIENT_ID` e `SERASA_CLIENT_SECRET` (OAuth 2.0 gerados no portal developer)
- Confirmar ambiente: sandbox → produção
- `SERASA_API_URL` = `https://api.serasaexperian.com.br` (produção) ou sandbox equivalente

**O que já está pronto no sistema:**
- Edge `consulta-executar` roteada para `serasa_pf` e `serasa_pj`
- Débito de carteira + estorno automático em falha
- Basta substituir o mock pelos endpoints reais quando as credenciais chegarem

---

## 🟢 WhatsApp — Cloud API oficial (Meta)

> **Guia de cadastro para o dono da empresa:** [whatsapp-cloud-api-setup.md](./whatsapp-cloud-api-setup.md)
> (decisão: usar a API **oficial** da Meta, não a Evolution — sem risco de banimento,
> compatível com LGPD/opt-in/templates, adequada a operação financeira).

Infraestrutura criada e pronta (modo dev/mock até as credenciais existirem):
- Tabela `whatsapp_mensagens` (envio + status de entrega) — também atua como **fila/outbox**
- Edge `whatsapp-send` (envia texto avulso ou template Meta; usa template de `templates_mensagem` canal `whatsapp` + interpolação `{{var}}`)
- Edge `whatsapp-dispatcher` (drena a fila `whatsapp_mensagens` via `whatsapp_outbox_pull`/`whatsapp_mensagem_marcar`)
- Edge `whatsapp-webhook` (verificação GET da Meta + status: enviado → entregue → lido; valida `X-Hub-Signature-256`)
- **Fluxos e campanhas** despacham WhatsApp: ações/canais `whatsapp` enfileiram via `whatsapp_enqueue` (resolve telefone do usuário: `telefone_ddi` + `telefone`)
- Tela web **Integrações → WhatsApp → Configurar** (`/admin/integracoes/whatsapp`): status, configs avançadas (rótulo, DDI padrão, idioma de template, throttle, janela de envio), webhook, envio de teste e mensagens recentes
- Catálogo/health na tela de Integrações (admin web + mobile)

**O que precisamos para ativar** (obtidos pelo dono no guia acima):
- `WHATSAPP_ACCESS_TOKEN` — token permanente do Usuário do Sistema
- `WHATSAPP_PHONE_NUMBER_ID` — ID do número de telefone
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — ID da WABA
- `WHATSAPP_APP_SECRET` — assinatura do webhook (`X-Hub-Signature-256`)
- `WHATSAPP_VERIFY_TOKEN` — token de verificação do webhook (você define)
- (opcional) `WHATSAPP_API_VERSION` — versão da Graph API (padrão `v21.0`)

**Webhook a configurar no painel da Meta** (WhatsApp → Configuração → Webhook):
`https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/whatsapp-webhook`
(use o mesmo `WHATSAPP_VERIFY_TOKEN`; assine os campos `messages` e `message_template_status_update`).

**Agendamento do dispatcher** (igual ao `email-dispatcher`): invocar periodicamente
`POST /functions/v1/whatsapp-dispatcher?limit=20` (ex.: cron externo a cada 1 min, ou
`pg_cron` + `pg_net` se habilitados). Sem isso, mensagens enfileiradas ficam `pendente`.

Sem `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`, o dispatcher opera em modo dev
(mensagem marcada como “enviado” sem chamar o provedor) — mesma filosofia do Serasa.

---

## Como ativar (após receber as credenciais)

```bash
# Stripe
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_ID_LMS_MONTHLY=price_xxx \
  STRIPE_PRICE_ID_LMS_ANNUAL=price_xxx \
  --project-ref bhagksfvszeogtjvjtpx

# Clicksign
supabase secrets set \
  CLICKSIGN_API_TOKEN=xxx \
  CLICKSIGN_API_URL=https://app.clicksign.com \
  CLICKSIGN_WEBHOOK_SECRET=xxx \
  --project-ref bhagksfvszeogtjvjtpx

# Resend
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM='Mercurio Capital <no-reply@mercuriocapital.com>' \
  --project-ref bhagksfvszeogtjvjtpx

# Serasa
supabase secrets set \
  SERASA_CLIENT_ID=xxx \
  SERASA_CLIENT_SECRET=xxx \
  SERASA_API_URL=https://api.serasaexperian.com.br \
  --project-ref bhagksfvszeogtjvjtpx

# WhatsApp (Cloud API oficial — Meta)
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=xxx \
  WHATSAPP_PHONE_NUMBER_ID=xxx \
  WHATSAPP_BUSINESS_ACCOUNT_ID=xxx \
  WHATSAPP_APP_SECRET=xxx \
  WHATSAPP_VERIFY_TOKEN=defina_uma_senha_aleatoria \
  --project-ref bhagksfvszeogtjvjtpx
```

Após cada `secrets set` a edge function já usa o provedor real — sem redeploy.

---

## ⚠️ Stripe no app iOS (Apple IAP)

Cobrança de **bens digitais** (recarga de carteira e assinatura da Universidade)
dentro do app iOS viola as regras da App Store, que exigem In-App Purchase.
Por isso, no app nativo iOS:
- Os botões de **recarga** (carteira) e **assinatura** (Universidade) ficam ocultos,
  com aviso para concluir pela **versão web**.
- Android e web seguem usando o checkout Stripe normalmente.
- A tela de Integrações sinaliza o Stripe com a marcação `ios_iap`.
