# Handoff — Fase 8 (Universidade Mercurio · LMS)

> Documento de transferência para o desenvolvedor que assume a Fase 8 a partir do estado atual (commit `7085cba`, branch `main`, **2026-05-18**).

---

## 1. Onde estamos

✅ **Fases 1 → 7 entregues** (Clicksign em sandbox; provedores de consulta em mock; Stripe em modo dev).

| Fase | Resumo |
|------|--------|
| 1 | Auth + RLS + Roles (admin/partner/team_member/client) + 2FA |
| 2 | CRUD parceiros, equipes, clientes, simulações |
| 3 | Originação completa (propostas, proponentes, imóveis, documentos, pendências, magic link, OCR) |
| 4 | Admin Ops, equipes, dashboards, CSV |
| 5 | **Carteira Stripe** + preços versionados + ajustes admin |
| 6 | **Consultas externas pagas** com débito/estorno automático |
| 7 | **Contratos + Clicksign + Liberação + Comissões + Financeiro Admin** |

Tudo descrito em [docs/09-roadmap.md](09-roadmap.md). **Sua tarefa começa exatamente na seção "Fase 8 — Universidade Mercurio (M9)".**

A UI da Universidade já existe em **mock** (arrays hardcoded em `app/src/pages/partner/UniversidadeLista.tsx`, `app/src/pages/partner/UniversidadePlayer.tsx`, `app/src/pages/admin/Universidade.tsx`, `app/src/pages/client/Universidade.tsx`). **Sua tarefa é trocar os mocks por dados reais do Supabase**, criar o schema, o player real, o tracking de progresso, certificados e gating por assinatura Stripe.

---

## 2. Setup local (5 min)

Idêntico às fases anteriores:

```bash
git clone git@github.com:bonacciniWd/mercurio-capital.git
cd mercurio-capital/app && npm install

# .env.local (pedir ao dono):
#   VITE_SUPABASE_URL=https://bhagksfvszeogtjvjtpx.supabase.co
#   VITE_SUPABASE_ANON_KEY=...

npm i -g supabase
supabase login
cd ..
supabase link --project-ref bhagksfvszeogtjvjtpx

cd app && npm run dev                  # localhost:5173
cd app && npx tsc --noEmit             # deve passar com 0 erros
```

**Project ref Supabase:** `bhagksfvszeogtjvjtpx`
**Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx

---

## 3. Convenções **OBRIGATÓRIAS** (mesmas das fases anteriores — não invente padrões novos)

### 3.1 Stack
- **Front:** React 18 + Vite + TypeScript + TanStack Query v5 + React Router v6 + Tailwind + lucide-react.
- **Back:** Supabase Postgres + RLS + Edge Functions (Deno).
- **Pacote oficial Deno em edges:** `https://esm.sh/@supabase/supabase-js@2.45.4` (não mudar versão).
- **Player de vídeo:** Vimeo Player ou YouTube embed via iframe. **Não usar SDK npm** — embed iframe + `postMessage` para tracking. Vimeo é preferido (suporta `private`).

### 3.2 Migrations
- Naming: `YYYYMMDDHHMMSS_descricao_fase.sql`. **Próxima sequência livre: `20260518000040_`**.
- Aplicação remota: `supabase db push`.
- **Sempre RLS habilitada** com policies por role.
- Funções de escrita: `security definer` + `set search_path = public` + `grant execute … to authenticated`.
- Exemplos canônicos para Fase 8: [20260518000030_contratos_fase7.sql](../supabase/migrations/20260518000030_contratos_fase7.sql) e [20260518000010_wallet_fase5.sql](../supabase/migrations/20260518000010_wallet_fase5.sql).

### 3.3 Edge Functions
- Pasta: `supabase/functions/<nome-kebab>/index.ts`.
- Helper de CORS/JSON: `import { corsHeaders, jsonResponse } from '../_shared/cors.ts'`.
- Header `Authorization` propagado para o `createClient` para respeitar RLS.
- Configuração `verify_jwt` em `supabase/config.toml`. **Webhooks externos = `verify_jwt = false`** (validar HMAC).
- Reaproveitar **stripe-webhook** existente — apenas adicionar branch para `proposito = 'lms_subscription'` (o enum em `stripe_payment_intents.proposito` já contempla isso).
- Exemplos de referência:
  - [supabase/functions/wallet-topup/index.ts](../supabase/functions/wallet-topup/index.ts) — Stripe Checkout + modo dev.
  - [supabase/functions/stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts) — HMAC + idempotência via inbox.
  - [supabase/functions/contrato-gerar/index.ts](../supabase/functions/contrato-gerar/index.ts) — upload no Storage + RPC.

### 3.4 UI / Front
- Telas em `app/src/pages/<role>/` (`admin`, `partner`, `client`, `public`). Roteamento em [app/src/router.tsx](../app/src/router.tsx).
- Componentes reusáveis em `app/src/components/`.
- **Sempre TanStack Query** para reads (`useQuery`) e mutations (`useMutation` + `invalidateQueries`). Não use `useEffect` para fetch.
- **Sempre supabase JS para RPC/views**, exceto quando precisa rodar lógica privilegiada — então Edge Function.
- Classes Tailwind: `card`, `btn-gold`, `btn-outline`, `input`, `badge`, paleta `navy/gold/silver/success/danger`.
- Formato monetário: `brl(centavos: number)` de [`@/lib/utils`](../app/src/lib/utils.ts) — entrada em centavos.
- Modais inline padrão: `<div className="fixed inset-0 z-50 …" onClick={onClose}><div onClick={stopPropagation}>…`.

### 3.5 Git
- Branch única `main`, sem PRs. Sempre rodar `npx tsc --noEmit` antes de commitar.
- Mensagens: `feat(fase-8): …`, `fix(…): …`, `docs: …`.

---

## 4. O que JÁ EXISTE para Fase 8 (não recriar!)

### 4.1 Telas em mock (substituir mocks por dados reais — **NÃO reescrever a UI do zero**)

| Tela | Caminho | Status |
|------|---------|--------|
| Catálogo do parceiro | [`app/src/pages/partner/UniversidadeLista.tsx`](../app/src/pages/partner/UniversidadeLista.tsx) | Mock com array hardcoded `courses[]`. Manter visual; trocar fonte por `useQuery`. |
| Player do parceiro | [`app/src/pages/partner/UniversidadePlayer.tsx`](../app/src/pages/partner/UniversidadePlayer.tsx) | Mock com `modules[]`. Substituir por dados reais; tracking de progresso. |
| Admin (CMS) | [`app/src/pages/admin/Universidade.tsx`](../app/src/pages/admin/Universidade.tsx) | Mock com `CURSOS[]`. Substituir por CRUD real (queries + mutations). |
| Portal cliente | [`app/src/pages/client/Universidade.tsx`](../app/src/pages/client/Universidade.tsx) | Mock com flag `subscribed = false`. Conectar a `assinaturas_universidade`. |

### 4.2 Rotas já registradas em [`app/src/router.tsx`](../app/src/router.tsx)

```ts
// Parceiro
{ path: 'universidade', element: <UniversidadeLista /> },
{ path: 'universidade/:cursoId/aula/:aulaId', element: <UniversidadePlayer /> },

// Admin
{ path: 'universidade', element: <AdminUniversidade /> },

// Cliente
{ path: 'universidade', element: <ClientUniversidade /> },
```

### 4.3 Stripe já configurado (Fase 5)

- Tabela `stripe_payment_intents` aceita `proposito = 'lms_subscription'` (já no CHECK constraint — veja [20260513000005_wallet.sql](../supabase/migrations/20260513000005_wallet.sql) linha 181).
- Edge function `stripe-webhook` ([supabase/functions/stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts)) só trata `proposito = 'wallet_topup'` hoje — **você vai adicionar branch para `lms_subscription`**.
- Tabela `stripe_webhooks_inbox` cobre idempotência para qualquer evento — **reaproveitar**, não criar nova.

### 4.4 Notificações

- Tabela `notificacoes` já existe ([20260513000006_plataforma.sql](../supabase/migrations/20260513000006_plataforma.sql) linha 100). Padrão de inserção em triggers: ver [20260518000010_wallet_fase5.sql](../supabase/migrations/20260518000010_wallet_fase5.sql) (`fn_notifica_wallet_movimento`).

### 4.5 Storage

Buckets atuais: `partner-docs`, `proposta-docs`, `contratos`, `comprovantes`.
**Você vai criar:** `lms-videos` (privado, só para arquivos PDF/recursos — vídeos ficam no Vimeo, **não no Storage**) e `lms-capas` (público).

---

## 5. Tarefas Fase 8 (em ordem sugerida)

### Tarefa 1 — Migration `20260518000040_universidade_fase8.sql`

Criar (em ordem):

1. **Enums** (no início):
   ```sql
   create type curso_nivel as enum ('iniciante','intermediario','avancado');
   create type curso_publico as enum ('cliente','parceiro','ambos');
   create type curso_status as enum ('rascunho','publicado','arquivado');
   create type aula_tipo as enum ('video','pdf','quiz','texto');
   create type assinatura_lms_status as enum ('ativa','cancelada','expirada','trialing','past_due');
   ```

2. **Tabela `cursos`**:
   ```sql
   id uuid pk, titulo text, slug text unique, descricao text,
   categoria text, nivel curso_nivel, publico curso_publico, status curso_status default 'rascunho',
   capa_storage_path text, ordem int default 0,
   gratuito boolean default true,                   -- se false, requer assinatura
   preco_centavos bigint,                           -- para futuro compra avulsa (não usar agora)
   criado_por uuid references usuarios(id), created_at/updated_at
   ```
   RLS:
   - Admin: full.
   - Authenticated: SELECT onde `status = 'publicado'` (filtro adicional de `publico` no front).

3. **Tabela `modulos`**: `id, curso_id fk cascade, titulo, ordem int, created_at`.
   RLS: herda do curso (select se curso é publicado ou admin).

4. **Tabela `aulas`**:
   ```sql
   id uuid pk, modulo_id fk cascade, titulo, ordem int,
   tipo aula_tipo not null default 'video',
   vimeo_id text,                  -- para tipo=video
   pdf_storage_path text,          -- para tipo=pdf
   conteudo_md text,               -- para tipo=texto/quiz
   duracao_segundos int,
   gratuita boolean default false, -- aula livre mesmo em curso pago (preview)
   created_at/updated_at
   ```
   RLS: select se curso publicado e (curso.gratuito ou aula.gratuita ou usuário tem assinatura ativa OU é admin).
   **Crie helper SQL** `public.app_has_lms_subscription()` que retorna boolean.

5. **Tabela `inscricoes`** (1 por usuário+curso):
   ```sql
   id uuid pk, usuario_id fk, curso_id fk,
   iniciado_em timestamptz default now(),
   concluido_em timestamptz,
   percentual numeric(5,2) default 0,     -- 0..100, mantido por trigger
   unique (usuario_id, curso_id)
   ```
   RLS: usuário lê só as próprias; admin lê todas.

6. **Tabela `aula_progresso`** (1 por usuário+aula):
   ```sql
   id uuid pk, usuario_id fk, aula_id fk,
   curso_id uuid fk (denormalizado, para trigger de % rápido),
   posicao_segundos int default 0,        -- onde parou no vídeo
   concluida boolean default false,
   concluida_em timestamptz,
   ultima_visualizacao timestamptz default now(),
   unique (usuario_id, aula_id)
   ```
   RLS: usuário lê/escreve só os próprios; admin lê todos.

7. **Tabela `certificados`**:
   ```sql
   id uuid pk, usuario_id fk, curso_id fk,
   codigo text unique,           -- ex.: MC-CERT-XXXX (gerar via trigger)
   pdf_storage_path text,
   emitido_em timestamptz default now()
   ```
   RLS: usuário lê os próprios; admin full.

8. **Tabela `assinaturas_universidade`**:
   ```sql
   id uuid pk, usuario_id fk unique,
   status assinatura_lms_status not null default 'trialing',
   stripe_customer_id text,
   stripe_subscription_id text unique,
   stripe_price_id text,
   valor_centavos bigint,
   ciclo text check (ciclo in ('mensal','anual')) default 'mensal',
   current_period_end timestamptz,
   cancelada_em timestamptz,
   created_at/updated_at
   ```
   RLS: usuário lê a própria; admin full.

9. **Trigger `trg_calcular_progresso`**:
   - `AFTER INSERT OR UPDATE OF concluida ON aula_progresso`.
   - Recalcula `inscricoes.percentual` = (aulas concluídas / total de aulas do curso) * 100.
   - Se atingiu 100% E não tem certificado ainda → gera linha em `certificados` (via call para `gerar_certificado(p_curso, p_usuario)`).

10. **RPCs**:
    - `lms_inscrever(p_curso_id)`: cria/upsert em `inscricoes` se permitido (curso publicado + gratuito ou tem assinatura).
    - `lms_marcar_aula(p_aula_id, p_posicao_segundos, p_concluida)`: upsert em `aula_progresso`.
    - `lms_gerar_certificado(p_inscricao_id)`: chamada explícita do trigger ou manual pelo admin.
    - `admin_curso_publicar(p_curso_id, p_status)`: muda status, valida que tem pelo menos 1 módulo + 1 aula.

11. **View `v_lms_catalogo`** (usado nas telas listagem):
    - Cursos publicados + (filtro de publico aplicado no front).
    - Inclui `qtd_modulos`, `qtd_aulas`, `duracao_total_segundos`.
    - Junta inscrição do usuário se existir (`percentual_concluido`, `iniciado_em`).

12. **View `v_lms_curso_estrutura`** (usado no player):
    - Curso → módulos ordenados → aulas ordenadas + progresso do usuário em cada aula.

13. **Bucket Storage**: 
    - `lms-capas` (público, max 2MB, png/jpeg/webp) — capas de cursos.
    - `lms-recursos` (privado, max 50MB, pdf) — PDFs/anexos de aulas.
    - Policy `lms-recursos`: SELECT só se o usuário tem inscrição ativa no curso da aula (verificar via `aulas.modulo_id → modulos.curso_id`).
    - Vídeos **NÃO ficam no Storage** — usar Vimeo (`vimeo_id` text na tabela `aulas`).

⚠️ Reaproveite o trigger genérico `trg_set_updated_at` e a função `set_updated_at()` (já existem em migrations anteriores).

### Tarefa 2 — Reescrever as 4 telas para usar dados reais

#### 2.1 `app/src/pages/admin/Universidade.tsx` (CMS)

Padrão idêntico ao layout atual, **mas trocar `CURSOS[]` mock por `useQuery`**:

```ts
const { data: cursos } = useQuery({
  queryKey: ['admin-cursos'],
  queryFn: async () => {
    const { data, error } = await supabase.from('cursos').select('*').order('ordem')
    if (error) throw error
    return data
  },
})
```

Adicionar mutations para:
- Criar curso (`supabase.from('cursos').insert(...)`).
- Editar curso (`.update(...)`).
- Adicionar/editar/remover módulos e aulas.
- Publicar/despublicar via RPC `admin_curso_publicar`.
- Upload de capa para bucket `lms-capas`.
- Upload de PDF de aula para bucket `lms-recursos`.

#### 2.2 `app/src/pages/partner/UniversidadeLista.tsx` (catálogo)

- Trocar array `courses` por `useQuery` da view `v_lms_catalogo` filtrada por `publico in ('parceiro','ambos')`.
- Botão "Inscrever-se" chama `supabase.rpc('lms_inscrever', { p_curso_id })`.
- Filtro de status (Todos / Em andamento / Concluídos / Certificados) usa o `percentual_concluido` da view.

#### 2.3 `app/src/pages/partner/UniversidadePlayer.tsx` (player)

- Trocar `modules` por `useQuery('v_lms_curso_estrutura', cursoId)`.
- Embed do Vimeo:
  ```tsx
  <iframe src={`https://player.vimeo.com/video/${aula.vimeo_id}?autoplay=0&title=0`} allow="autoplay; fullscreen" />
  ```
- Tracking de progresso:
  - Use Vimeo Player JS API ([https://github.com/vimeo/player.js](https://github.com/vimeo/player.js)) via CDN (não instalar como npm — carregue como `<script>` dinâmico).
  - Em `timeupdate` (debounce 5s), chamar `supabase.rpc('lms_marcar_aula', { p_aula_id, p_posicao_segundos })`.
  - Em `ended`, chamar com `p_concluida = true`.
- Botão "Próxima aula" navega para próxima ordem.
- Banner verde "Aula concluída" só aparece quando `concluida = true`.

#### 2.4 `app/src/pages/client/Universidade.tsx` (gating + catálogo cliente)

- Hook `useQuery('assinatura-lms')` → consulta `assinaturas_universidade` do usuário.
- Se `status not in ('ativa','trialing')` → mostra paywall + botão "Assinar".
- Botão "Assinar" chama edge `lms-assinar` (próxima tarefa) → retorna `checkout_url` → `window.location = url`.
- Se assinatura ativa → mostra catálogo da view `v_lms_catalogo` filtrada por `publico in ('cliente','ambos')`.

### Tarefa 3 — Edge Function `lms-assinar`

Igual ao padrão de [wallet-topup](../supabase/functions/wallet-topup/index.ts), mas:
- `mode = subscription` no Stripe Checkout.
- `line_items[0][price]` = `STRIPE_PRICE_ID_LMS_MONTHLY` (secret).
- Cria linha em `assinaturas_universidade` com `status='trialing'`, `valor_centavos = 4990`.
- Insere também em `stripe_payment_intents` com `proposito = 'lms_subscription'`.

**Modo dev (sem `STRIPE_SECRET_KEY`):** cria assinatura local com `status='ativa'` direto, retorna URL falsa redirecionando para `/c/universidade?subscribed=1` — facilita testes.

### Tarefa 4 — Estender `stripe-webhook`

Em [supabase/functions/stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts):

1. Adicionar tratamento para evento `customer.subscription.created`/`updated`/`deleted`:
   - Resolver `usuario_id` via metadata.
   - UPSERT em `assinaturas_universidade` com `status`, `current_period_end`, `stripe_subscription_id`, `stripe_price_id`.

2. Adicionar tratamento para `invoice.payment_succeeded` da subscription:
   - Atualizar `current_period_end` e `status = 'ativa'`.

3. Adicionar tratamento para `invoice.payment_failed`:
   - `status = 'past_due'`.

A função `handleSucceeded` atual só lida com `wallet_topup` — adicionar branch consultando `stripe_payment_intents.proposito` antes de creditar carteira ou ativar assinatura.

### Tarefa 5 — Geração de certificado em PDF

- Quando trigger `trg_calcular_progresso` detectar `percentual = 100`, chama RPC `lms_gerar_certificado` que:
  1. Insere linha em `certificados` com `codigo = 'MC-CERT-' || lpad(seq::text, 6, '0')`.
  2. Marca `inscricoes.concluido_em = now()`.
  3. Insere notificação para o usuário.
- O PDF em si é gerado on-demand pela Edge `certificado-gerar` (similar a `contrato-gerar`):
  - Template HTML em `supabase/functions/certificado-gerar/template.ts`.
  - Salva no bucket `lms-recursos/certificados/<usuario_id>/<codigo>.html`.
  - Path gravado em `certificados.pdf_storage_path`.
- Botão "Baixar PDF" no `UniversidadeLista` cria `createSignedUrl` e abre em nova aba.

### Tarefa 6 — Roadmap, typecheck, deploy, commit

```bash
cd app && npx tsc --noEmit                                       # 0 erros
supabase db push                                                  # aplica migration 040
supabase functions deploy lms-assinar       --project-ref bhagksfvszeogtjvjtpx
supabase functions deploy certificado-gerar --project-ref bhagksfvszeogtjvjtpx
supabase functions deploy stripe-webhook    --project-ref bhagksfvszeogtjvjtpx   # re-deploy com novo branch

# Atualizar docs/09-roadmap.md Fase 8 → marcar todos [x]
git add -A
git commit -m "feat(fase-8): universidade mercurio - cursos + player vimeo + progresso + certificados + assinatura stripe"
git push
```

---

## 6. Checklist de aceitação Fase 8

- [ ] Migration 040 aplicada (verificar com `supabase db push` no remote).
- [ ] Admin consegue criar/editar/publicar curso + módulos + aulas pela `/admin/universidade`.
- [ ] Upload de capa funciona e a imagem aparece na listagem.
- [ ] Parceiro consegue se inscrever em curso publicado com `publico = parceiro` ou `ambos`.
- [ ] Player do Vimeo carrega e o tempo de visualização é salvo em `aula_progresso.posicao_segundos`.
- [ ] Ao concluir todas as aulas do curso, `inscricoes.percentual = 100`, `concluido_em` é gravado e linha em `certificados` é criada.
- [ ] Cliente sem assinatura vê paywall em `/c/universidade`; com assinatura `ativa` vê catálogo.
- [ ] Stripe Checkout (modo real OU dev) cria/atualiza linha em `assinaturas_universidade` via webhook.
- [ ] Botão "Baixar PDF" do certificado gera URL assinada do storage com sucesso.
- [ ] Notificação enviada ao usuário quando certificado emitido (usar `notificacoes` existente — padrão de [`fn_notifica_wallet_movimento`](../supabase/migrations/20260518000010_wallet_fase5.sql)).
- [ ] `npx tsc --noEmit` sem erros.
- [ ] Roadmap atualizado e commit pushed.

---

## 7. Armadilhas conhecidas (leitura obrigatória)

1. **Não mexer no schema das fases anteriores.** Em particular: `stripe_payment_intents`, `wallet_*`, `notificacoes`, `contratos`, `comissoes`. Apenas **adicionar branches** ou colunas via `alter table … add column if not exists`. O resto está em produção e validado.

2. **Vimeo, não Cloudflare Stream nem Storage.** O dono já tem conta Vimeo Pro. Vídeos novos vão lá; `aulas.vimeo_id` guarda o ID numérico. **Não suba MP4 no bucket** — viola custo e CDN.

3. **Stripe `proposito` no enum existente.** A constraint `check (proposito in ('wallet_topup','lms_subscription'))` em `stripe_payment_intents` já contempla LMS. **Não criar nova tabela** de payment_intents para LMS — reaproveitar.

4. **Trigger de progresso pode dar loop.** Cuidado: o `trg_calcular_progresso` faz `UPDATE inscricoes` que tem `trg_*_updated_at`. Não chame de volta `aula_progresso` dentro do trigger.

5. **RLS de aulas** é a parte mais sensível. Teste manual:
   - Usuário sem assinatura, aula em curso pago e `aula.gratuita = false` → não retorna.
   - Usuário sem assinatura, aula em curso pago e `aula.gratuita = true` → retorna (preview).
   - Usuário com assinatura ativa → retorna tudo.
   - Admin → retorna tudo, inclusive rascunhos.
   Escreva um **smoke test SQL** em `supabase/smoke-tests/fase-8-smoke.sql` (igual ao da Fase 3) para garantir.

6. **Vimeo Player API** requer o vídeo ter `privacy.embed = whitelist` ou `unlisted`. Se o player não carregar, **não é bug do código** — é configuração do vídeo no Vimeo. Documentar isso no `docs/integrations` (que ainda não existe — criar `docs/13-vimeo-setup.md` se necessário).

7. **PDF do certificado** segue o mesmo modelo do contrato: HTML server-side + bucket. **Não use libs npm de PDF** (não funcionam em Deno). Se precisar de PDF real (não HTML), apontar para serviço externo via `fetch` (ex.: `https://api.pdfshift.io`).

8. **Centavos vs reais**: `assinaturas_universidade.valor_centavos = bigint centavos` (igual carteira). `cursos.preco_centavos = bigint centavos`. Use `brl(valor_centavos)` direto.

9. **Modo dev de assinatura** é essencial — sem ele, todos os testes locais quebram porque não há Stripe configurado. Replicar o padrão de `wallet-topup`: `if (!STRIPE_SECRET) { … cria local + retorna url fake }`.

10. **Tabela `partners` NÃO tem `nome`/`razao_social`.** Sempre `JOIN usuarios u on u.id = partners.usuario_id`. Lição herdada das fases 5–7.

---

## 8. Contatos e referências

- **Repositório:** https://github.com/bonacciniWd/mercurio-capital
- **Documentação técnica:** pasta [docs/](.)
  - [01-architecture.md](01-architecture.md)
  - [02-roles-permissions.md](02-roles-permissions.md)
  - [03-routes-navigation.md](03-routes-navigation.md)
  - [04-database-schema.md](04-database-schema.md)
  - [06-modules-features.md](06-modules-features.md)
  - [08-security-compliance.md](08-security-compliance.md)
  - [09-roadmap.md](09-roadmap.md)
  - [12-handoff-fase7.md](12-handoff-fase7.md) — fase anterior, ótimo modelo de referência.
- **Supabase Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx
- **Vimeo Player JS:** https://github.com/vimeo/player.js
- **Stripe Subscriptions API:** https://stripe.com/docs/api/subscriptions

---

## 9. Dica final

**Antes de codar qualquer linha**, rode:

```bash
git log --oneline -25
```

E leia os commits das fases 5, 6 e 7 — você vai entender o ritmo, granularidade e padrões de mensagem. Replique.

Para entender o estado atual do schema, abra:
```bash
ls supabase/migrations/
```

E leia da última (`20260518000030_contratos_fase7.sql`) para trás. **O código no repo é a fonte da verdade — este documento foi escrito em 2026-05-18 e pode ter atrasado um commit.**

**Boa sorte! A Universidade é o módulo mais "produto" do sistema — capricha na UX.**

