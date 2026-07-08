# WhatsApp Business Platform (Cloud API) — Guia de Cadastro

> **Para quem é este guia:** o(a) responsável pela empresa (dono/gestor) que vai
> criar e verificar a conta oficial do WhatsApp junto à Meta. Ao final, você terá
> as credenciais que devem ser entregues ao time técnico para ativar o envio de
> mensagens no sistema Mercurio Capital.
>
> **Por que a API oficial (e não a Evolution):** a Mercurio Capital é uma operação
> financeira regulada. A API oficial da Meta é a única sancionada pelo WhatsApp,
> não corre risco de banimento do número, suporta opt-in e templates aprovados e
> gera trilha auditável — requisitos de LGPD e de comunicação transacional confiável.

---

## Visão geral do que será criado

```
Conta Meta Business  ──►  Verificação do negócio (CNPJ)
        │
        ├─► App na Meta for Developers (produto "WhatsApp")
        │
        ├─► WhatsApp Business Account (WABA)
        │
        ├─► Número de telefone oficial (Phone Number ID)
        │
        ├─► Usuário do Sistema  ──►  Token permanente (acesso à API)
        │
        ├─► Templates de mensagem (aprovados pela Meta)
        │
        └─► Webhook (status de entrega: enviado → entregue → lido)
```

No final, você entrega ao time técnico **6 valores** (seção 8). Sem eles, o sistema
opera em **modo dev** (registra a mensagem mas não envia).

---

## Pré-requisitos

- [ ] **CNPJ ativo** da Mercurio Capital + documentos do negócio (para verificação).
- [ ] Um **número de telefone dedicado** que **NÃO** esteja em uso no app do WhatsApp
      comum nem no WhatsApp Business (app). Pode ser fixo ou móvel, mas precisa
      receber SMS/ligação para verificação. **Recomendado:** um número novo, só para o sistema.
- [ ] Acesso a um e-mail corporativo e ao **Facebook Business Manager**.
- [ ] Cartão de crédito internacional (a cobrança por conversa é faturada pela Meta).

---

## 1. Criar a conta Meta Business

1. Acesse **https://business.facebook.com** e crie (ou use) a conta da empresa.
2. Em **Configurações do Negócio → Informações do negócio**, preencha:
   - Razão social: **Mercurio Capital Ltda**
   - CNPJ, endereço e site oficiais.
3. Inicie a **Verificação do Negócio** em **Centro de Segurança** (ou
   *Business Settings → Security Center*). A Meta pede documento do CNPJ + comprovação.
   > A verificação pode levar alguns dias. Ela é necessária para liberar limites
   > maiores de envio e remover restrições.

---

## 2. Criar o App na Meta for Developers

1. Acesse **https://developers.facebook.com** → **Meus Apps → Criar app**.
2. Tipo do app: **Empresa (Business)**.
3. Dê o nome (ex.: `Mercurio Capital WhatsApp`) e vincule à conta Business da seção 1.
4. No painel do app, em **Adicionar produtos**, escolha **WhatsApp → Configurar**.

---

## 3. Vincular a WhatsApp Business Account (WABA) e o número

1. Dentro do produto WhatsApp, a Meta cria/associa uma **WhatsApp Business Account (WABA)**.
2. Em **WhatsApp → Configuração da API**:
   - Você verá um **número de teste** gratuito (para validar a integração).
   - Para produção, clique em **Adicionar número de telefone** e cadastre o número
     dedicado (seção Pré-requisitos). Verifique via SMS/ligação.
3. Defina o **nome de exibição** (display name) do número — ex.: `Mercurio Capital`.
   A Meta revisa esse nome (regras de marca). Ele aparece para o cliente.
4. Preencha o **perfil comercial** (logo, descrição, site, endereço).

Anote dois identificadores que aparecem nesta tela: 
- **Phone Number ID** (ID do número de telefone) → vira `WHATSAPP_PHONE_NUMBER_ID` (exemplo fictício: `123456789012345`).
- **WhatsApp Business Account ID** (ID da WABA) → vira `WHATSAPP_BUSINESS_ACCOUNT_ID` (exemplo fictício: `109876543210987`).

> Todos os IDs nesta seção são exemplos fictícios para documentação.
---

## 4. Gerar o token permanente (Usuário do Sistema)

O token temporário que aparece no painel **expira em 24h** — não serve para produção.
Crie um **Usuário do Sistema** com token permanente:

1. **business.facebook.com → Configurações do Negócio → Usuários → Usuários do sistema**.
2. **Adicionar** → nome (ex.: `mercurio-whatsapp-bot`) → função **Admin** (ou Funcionário).
3. Em **Adicionar ativos**, vincule a **WABA** criada na seção 3 com **controle total**.
4. Clique em **Gerar novo token**:
   - App: selecione o app da seção 2.
   - **Permissões (scopes):** marque
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Defina expiração **Nunca**.
5. **Copie o token gerado e guarde com segurança** (ele só aparece uma vez) →
   vira `WHATSAPP_ACCESS_TOKEN`.

---

## 5. Obter o App Secret (para validar o webhook)

1. No painel do app (developers.facebook.com) → **Configurações → Básico**.
2. Copie o **Chave secreta do app (App Secret)** → vira `WHATSAPP_APP_SECRET`.
   > Usado para verificar a assinatura `X-Hub-Signature-256` dos webhooks da Meta,
   > garantindo que os eventos vêm mesmo do WhatsApp.

---

## 6. Configurar o Webhook (status de entrega)

O webhook permite que o sistema saiba quando a mensagem foi **entregue** e **lida**,
e receba respostas do cliente.

1. Combine com o time técnico um **token de verificação** — uma senha aleatória
   qualquer que você inventa (ex.: `mercurio_wpp_token_exemplo_2026`). Esse valor vira
   `WHATSAPP_VERIFY_TOKEN` (o mesmo string vai nos secrets e no painel da Meta).
2. No painel do app → **WhatsApp → Configuração → Webhook → Editar**:
   - **URL de callback:**
     `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
   - **Token de verificação:** o mesmo `WHATSAPP_VERIFY_TOKEN` acima.
   - Clique em **Verificar e salvar** (a Meta faz um GET de validação).
3. Em **Gerenciar campos do webhook**, assine no mínimo:
   - `messages` (respostas recebidas)
   - `message_template_status_update` (aprovação/rejeição de templates)
   > O status de entrega (`sent/delivered/read`) chega dentro de `messages`.

---

## 7. Criar e aprovar os Templates de mensagem

**Por que templates:** o WhatsApp só permite **texto livre** dentro de uma janela de
**24 horas** após o cliente te enviar uma mensagem. Para iniciar conversa (ex.: enviar
um magic link, avisar mudança de status), é **obrigatório** usar um **template aprovado** pela Meta.

1. **business.facebook.com → WhatsApp Manager → Modelos de mensagem → Criar modelo**.
2. Para cada caso de uso, escolha a **categoria** correta:

| Caso de uso no sistema | Categoria recomendada |
|---|---|
| Link de acesso / código (magic link, 2FA) | **Authentication** |
| Status da proposta, pendência de documento, contrato pronto | **Utility** |
| Campanhas / novidades / promoções | **Marketing** |

3. Escreva o corpo usando variáveis numeradas da Meta: `{{1}}`, `{{2}}`…
   - Exemplo (Utility): `Olá {{1}}, sua proposta {{2}} mudou para o status: {{3}}.`
4. Envie para aprovação. A análise costuma levar de minutos a algumas horas.
5. Anote o **nome (código) de cada template aprovado** — o time técnico vai cadastrá-lo
   em **/admin/templates** com o canal **WhatsApp** para casar com o template da Meta.

> ⚠️ Importante: o texto do template no painel da Meta precisa corresponder ao
> template cadastrado no sistema. Variáveis numeradas (`{{1}}`) na Meta ↔ variáveis
> nomeadas (`{{nome}}`) no nosso editor são mapeadas pelo time técnico.

---

## 8. Valores para entregar ao time técnico

Reúna estes **6 valores** e entregue ao time técnico (eles configuram em
**Supabase → Edge Functions → Secrets**, nunca em código):

| Secret | Onde obter (seção) |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Token permanente do Usuário do Sistema (seção 4) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número de telefone (seção 3) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da WABA (seção 3) |
| `WHATSAPP_APP_SECRET` | App Secret do app (seção 5) |
| `WHATSAPP_VERIFY_TOKEN` | Senha aleatória que você definiu (seção 6) |
| `WHATSAPP_API_VERSION` *(opcional)* | Versão da Graph API, ex.: `v21.0` (padrão se omitido) |

> 🔒 **Nunca** envie o `WHATSAPP_ACCESS_TOKEN` por e-mail/chat aberto. Use um cofre de
> senhas ou digite direto no painel do Supabase.
>
> Se um valor real aparecer em documentação, trate como comprometido e siga o runbook §14 em `docs/operacao/runbooks.md`.

---

## 9. Opt-in e LGPD (obrigatório)

A Meta exige **consentimento explícito** do cliente antes de receber mensagens no WhatsApp:

- [ ] Adicionar caixa de **opt-in** no cadastro/proposta ("Aceito receber comunicações
      da Mercurio Capital por WhatsApp").
- [ ] Registrar data/hora e origem do consentimento (auditoria LGPD).
- [ ] Disponibilizar opção de **descadastro** (responder "SAIR", por exemplo).
- [ ] Não usar a base para spam — apenas comunicação relacionada à operação contratada.

---

## 10. Modelo de cobrança (resumo)

A Meta cobra **por conversa de 24h**, agrupada por categoria (Authentication, Utility,
Marketing, Service). O preço varia por país (Brasil tem tabela própria) e algumas
conversas iniciadas pelo cliente (Service) têm cota gratuita mensal.

- Acompanhe consumo em **WhatsApp Manager → Insights / Faturamento**.
- Cadastre forma de pagamento em **Configurações do Negócio → Pagamentos**.

> Consulte a tabela vigente em
> https://developers.facebook.com/docs/whatsapp/pricing — os valores são atualizados
> periodicamente pela Meta.

---

## 11. Limites de envio (messaging tiers)

Números novos começam com limite menor e sobem automaticamente conforme volume e
**qualidade** (quality rating):

| Tier | Clientes únicos / 24h |
|---|---|
| Inicial | 250 |
| 1 | 1.000 |
| 2 | 10.000 |
| 3 | 100.000 |
| 4 | Ilimitado |

- A **verificação do negócio** (seção 1) é o que destrava a subida de tier.
- Mantenha **quality rating** alto: evite spam, respeite opt-in, use a categoria certa.

---

## 12. Checklist de Go-Live

- [ ] Conta Meta Business criada e **negócio verificado** (CNPJ).
- [ ] App criado com produto **WhatsApp**.
- [ ] Número de produção adicionado, verificado e com **display name aprovado**.
- [ ] **Usuário do Sistema** com token permanente (scopes corretos).
- [ ] Os **6 secrets** configurados no Supabase pelo time técnico.
- [ ] Webhook **verificado** apontando para `/functions/v1/whatsapp-webhook`.
- [ ] Pelo menos 1 template **Utility** e 1 **Authentication** aprovados.
- [ ] Templates cadastrados em **/admin/templates** (canal WhatsApp).
- [ ] Opt-in implementado no cadastro/proposta.
- [ ] Forma de pagamento cadastrada na Meta.
- [ ] Teste real: enviar template para um número interno → confirmar status
      **entregue/lido** em **/admin/integracoes → WhatsApp**.

---

## Links oficiais

- Cloud API (visão geral): https://developers.facebook.com/docs/whatsapp/cloud-api
- Primeiros passos: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Templates de mensagem: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
- Preços: https://developers.facebook.com/docs/whatsapp/pricing
- Verificação do negócio: https://www.facebook.com/business/help/2058515294227817

---

**Status do backend:** as tabelas (`whatsapp_mensagens`, fila, fluxos/campanhas) já
estão prontas e são **agnósticas de provedor**. A camada de envio será ligada à
Cloud API oficial assim que os 6 secrets forem fornecidos. Até lá, o sistema opera
em **modo dev** (registra a mensagem sem enviar).

**Última revisão:** 2026-06-09.
