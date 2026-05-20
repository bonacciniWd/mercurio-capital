# Handoff — Fase 10 (Mobile Onboarding & Métricas de Funil)

> Documento de transferência para o desenvolvedor que assume a Fase 10 a partir do estado atual (após Fase 9 — Gestão de Parceiros & Onboarding por Convite, descrita em [docs/14-handoff-fase9.md](14-handoff-fase9.md)).
> **Data:** 2026-05-20 · **Branch:** `main`

---

## 1. Onde estamos

✅ **Fases 1 → 9 entregues e em produção** (Clicksign sandbox, Stripe dev, provedores de consulta em mock, SMTP nativo Supabase com rate-limit conhecido).

| Fase | Resumo |
|------|--------|
| 1 | Auth + RLS + Roles + 2FA |
| 2 | CRUD parceiros, equipes, clientes, simulações |
| 3 | Originação completa |
| 4 | Admin Ops, equipes, dashboards |
| 5 | Carteira Stripe + preços versionados |
| 6 | Consultas externas pagas |
| 7 | Contratos + Clicksign + Liberação + Comissões |
| 8 | Universidade Mercurio (LMS) |
| 9 | **Gestão de Parceiros (Admin) + Convite + Bootstrap** |

Roadmap completo: [docs/09-roadmap.md](09-roadmap.md). **Sua tarefa começa na Fase 10.**

---

## 2. Escopo da Fase 10

Cinco entregas, na ordem sugerida:

1. **Mobile — Supabase JS conectado** (hoje o app Expo está 100% mock).
2. **Mobile — Onboarding do parceiro convidado** (replicar `/auth/partner-bootstrap` + `/acesso-pendente` do web).
3. **Mobile — Substituir mocks** das telas `(admin)/aprovacoes.tsx` e `(admin)/parceiros.tsx` por dados reais (mesmas views/RPCs criadas na Fase 9).
4. **Web — UI admin de equipes do parceiro**, consumindo `equipes` + `equipe_membros` (tabelas já existem desde a Fase 2, sem UI dedicada).
5. **Web — Funil de parceiros**: view `v_admin_funil_parceiros` + card no dashboard admin + webhook de bounce de SMTP marcando `partner_invites.status='expired'`.

---

## 3. Setup local (mobile + back)

```bash
git clone git@github.com:bonacciniWd/mercurio-capital.git
cd mercurio-capital

# Back (já familiar das fases anteriores)
supabase login
supabase link --project-ref bhagksfvszeogtjvjtpx

# Web (revisar typecheck antes de começar)
cd app && npm install && npx tsc --noEmit && cd ..

# Mobile (novo)
cd mobile
npm install
npx expo start         # iOS sim / Android sim / Expo Go
# typecheck:
npm run typecheck
```

**Project ref Supabase:** `bhagksfvszeogtjvjtpx`
**Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx

⚠️ **Mobile ainda não tem `@supabase/supabase-js` instalado** — a primeira coisa da Tarefa 1 é adicionar a dependência.

---

## 4. Convenções **OBRIGATÓRIAS** (mantenha o padrão das fases anteriores)

### 4.1 Stack mobile (já configurada)

- **Expo SDK 54** + **Expo Router v6** (file-based routing em `mobile/app/`).
- **NativeWind 4** (Tailwind para RN). Não use StyleSheet.
- **TypeScript estrito** (`mobile/tsconfig.json`).
- **lucide-react-native** para ícones.
- **react-native-reanimated 4** + **gesture-handler 2.28** já presentes.
- Estrutura de rotas:
  - `(admin)/` → área protegida admin.
  - `(parceiro)/` → área protegida parceiro.
  - `(cliente)/` → área protegida cliente.
  - `magic/` → consumo de magic-link (já existe pasta).
  - `propostas/` → telas compartilhadas.

### 4.2 Stack mobile (a adicionar)

Adicione com versões compatíveis com Expo SDK 54:

```bash
cd mobile
npx expo install @supabase/supabase-js@2.45.4 \
                 react-native-url-polyfill \
                 @react-native-async-storage/async-storage \
                 expo-secure-store

# TanStack Query (consistência com web)
npm install @tanstack/react-query@5
```

### 4.3 Padrões de código

- **TanStack Query** para fetch/mutations (mesma versão do web: v5).
- **Sempre** propagar JWT no client Supabase (storage = `expo-secure-store` para tokens, evita AsyncStorage em prod por questão de segurança LGPD).
- **Sempre** RLS — não use service role no app.
- **Edge Functions:** reaproveite as do web (`admin-invite-partner` já está deployada).
- Mensagens de commit: `feat(fase-10): …`, `fix(mobile): …`, `docs: …`.

### 4.4 Bibliotecas vetadas

- ❌ `react-native-supabase` (não oficial — use o pacote oficial `@supabase/supabase-js`).
- ❌ AsyncStorage para tokens de auth — só para cache não sensível.
- ❌ StyleSheet (use NativeWind).

---

## 5. O que JÁ EXISTE para Fase 10 (não recriar!)

### 5.1 Backend pronto (criado na Fase 9)

| Objeto | Caminho | Uso na Fase 10 |
|---|---|---|
| View `v_admin_partners` | migration `20260518000042` | Lista admin mobile |
| View `v_admin_partner_aprovacoes` | migration `20260519000001` | Tela aprovações mobile |
| View `v_admin_partner_invites` | migration `20260518000042` | Listar convites (mobile/web) |
| RPCs `admin_suspend_partner`, `admin_reactivate_partner`, `admin_invite_partner_record`, `admin_revoke_partner_invite` | migration `20260518000042` | Ações admin |
| Edge `admin-invite-partner` (deployed) | `supabase/functions/admin-invite-partner/` | Já em produção |
| Tabela `partner_invites` | migration `20260518000042` | Para webhook de bounce |
| Tabelas `equipes` + `equipe_membros` | migration `20260513000002_identidade.sql` | Base da Tarefa 4 |
| RPCs `partner_invite_membro` / `membro_accept_convite` | migration `20260518000008_equipes_convites.sql` | Reaproveitar para UI admin |

### 5.2 Web pronto (referências para replicar)

| Tela web | Onde está | Replica mobile |
|---|---|---|
| `/auth/partner-bootstrap` | `app/src/pages/public/PartnerBootstrap.tsx` | `mobile/app/magic/partner-bootstrap.tsx` |
| `/acesso-pendente` | `app/src/pages/public/AcessoPendente.tsx` | `mobile/app/(parceiro)/pendente.tsx` |
| `/admin/parceiros` | `app/src/pages/admin/Parceiros.tsx` | `mobile/app/(admin)/parceiros.tsx` (hoje mock) |
| `/admin/aprovacoes` | `app/src/pages/admin/Aprovacoes.tsx` | `mobile/app/(admin)/aprovacoes.tsx` (hoje mock) |
| `PartnerDocsUploader` | `app/src/components/PartnerDocsUploader.tsx` | Criar versão RN em `mobile/components/PartnerDocsUploader.tsx` |

### 5.3 Mobile mock atual (substituir)

- [`mobile/app/(admin)/aprovacoes.tsx`](../mobile/app/(admin)/aprovacoes.tsx) — array hardcoded.
- [`mobile/app/(admin)/parceiros.tsx`](../mobile/app/(admin)/parceiros.tsx) — array hardcoded.
- [`mobile/app/login.tsx`](../mobile/app/login.tsx) — não chama Supabase ainda.

---

## 6. Tarefas detalhadas (em ordem)

### Tarefa 1 — Cliente Supabase no mobile (~½ dia)

Criar `mobile/lib/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

// Storage híbrido: tokens em SecureStore, cache em AsyncStorage
const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
}

const url = Constants.expoConfig?.extra?.SUPABASE_URL as string
const anon = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anon, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

Adicionar em `mobile/app.json` na chave `expo.extra`:

```json
"extra": {
  "SUPABASE_URL": "https://bhagksfvszeogtjvjtpx.supabase.co",
  "SUPABASE_ANON_KEY": "<pedir ao dono>"
}
```

Criar `mobile/auth/AuthContext.tsx` espelhando [`app/src/auth/AuthContext.tsx`](../app/src/auth/AuthContext.tsx): expõe `session`, `user`, `role`, `partner_id`, `partner_status`, `loading`, `login`, `logout`, `refresh`.

Wrap em `mobile/app/_layout.tsx`:

```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <Stack screenOptions={{ headerShown: false }} />
  </AuthProvider>
</QueryClientProvider>
```

Implementar `mobile/app/login.tsx` real chamando `supabase.auth.signInWithPassword`.

Adicionar guards:

- `mobile/app/(admin)/_layout.tsx` → redireciona se `role !== 'admin'`.
- `mobile/app/(parceiro)/_layout.tsx` → redireciona se `role !== 'partner'` OU `partner_status !== 'approved'` (manda para `/(parceiro)/pendente`).

### Tarefa 2 — Onboarding do parceiro convidado (mobile)

Deep-link já configurado no `mobile/app.json` (`scheme: 'mercurio'`).

1. Atualizar Edge `admin-invite-partner` em `supabase/functions/admin-invite-partner/index.ts`: adicionar suporte a `?platform=mobile` no `redirectTo` → `mercurio://magic/partner-bootstrap`.

2. Criar `mobile/app/magic/partner-bootstrap.tsx`:
   - `useLocalSearchParams()` lê `token_hash`, `type`, `email` do deep-link.
   - Chama `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`.
   - Refresh session.
   - Form de definir senha (`supabase.auth.updateUser({ password })`) — opcional.
   - Resolve rota final com `supabase.rpc('me')`:
     - `partner+approved` → `/(parceiro)/dashboard`
     - `partner+pending` → `/(parceiro)/pendente`
     - `admin` → `/(admin)/dashboard`

3. Criar `mobile/app/(parceiro)/pendente.tsx` (réplica do web `AcessoPendente.tsx`):
   - Header com email + botão Sair.
   - Mostra `PartnerDocsUploader` (componente novo abaixo) com 3 slots.
   - Botão "Enviar para análise" (atualiza `partners.status` para `analise` via RPC existente).

4. Criar `mobile/components/PartnerDocsUploader.tsx`:
   - Use `expo-image-picker` para foto/galeria (já comum em apps mobile).
   - Use `expo-document-picker` para PDFs.
   - Upload via `supabase.storage.from('partner-docs').upload(...)`.
   - Insert em `partner_documentos` (tabela existente desde Fase 1).
   - Slots: `contrato_social` (obrig.), `cpf` (obrig.), `comprovante_residencia` (opcional).

   ⚠️ Adicionar a `mobile/package.json`:
   ```bash
   npx expo install expo-image-picker expo-document-picker
   ```

### Tarefa 3 — Substituir mocks `(admin)/aprovacoes.tsx` e `(admin)/parceiros.tsx`

Padrão idêntico ao web — só trocando layout React Native:

**`mobile/app/(admin)/parceiros.tsx`:**

```tsx
const { data: partners } = useQuery({
  queryKey: ['admin-partners-mobile'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('v_admin_partners')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
})
```

Renderizar com `FlatList`, cards com `Pressable` (NativeWind classes). Botão "Suspender" abre modal RN (`Modal` do react-native) → chama `supabase.rpc('admin_suspend_partner', { p_partner_id, p_motivo })`.

**`mobile/app/(admin)/aprovacoes.tsx`:**

```tsx
const { data } = useQuery({
  queryKey: ['admin-aprovacoes-mobile'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('v_admin_partner_aprovacoes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
})
```

Ações: `supabase.rpc('admin_approve_partner', { p_partner_id })` e `admin_reject_partner`. Mostre `origem`, `invite_observacoes`, `invite_criado_por_nome` no detalhe.

### Tarefa 4 — UI admin de equipes do parceiro (web)

Criar `app/src/pages/admin/PartnerEquipes.tsx`:

- Rota: `/admin/parceiros/:partnerId/equipes` em [`app/src/router.tsx`](../app/src/router.tsx) no grupo admin.
- Lista de equipes do parceiro (`select * from equipes where partner_id = $1`).
- Para cada equipe, expandir membros (`equipe_membros` join `usuarios`).
- Mostrar status do convite (`aceito_em` null = pendente).
- Ações admin:
  - Suspender membro (`update equipe_membros set permissoes = jsonb_set(permissoes, '{suspenso}', 'true')`).
  - Revogar convite pendente (delete onde `aceito_em is null`).
- Adicionar link "Ver equipes" no painel lateral de `/admin/parceiros` que abre essa rota.

⚠️ Como RLS atual em `equipe_membros` permite só `partner+admin`, isso já funciona para admin. Não precisa migration.

### Tarefa 5 — Funil + webhook de bounce

#### 5.1 Migration `20260520000010_funil_parceiros.sql`

```sql
create or replace view public.v_admin_funil_parceiros
with (security_invoker = on)
as
select
  count(*) filter (where pi.status in ('sent','accepted','revoked','expired')) as convidados,
  count(*) filter (where p.usuario_id is not null
                   and exists (select 1 from auth.users au
                               where au.id = u.id and au.last_sign_in_at is not null)) as ativaram,
  count(*) filter (where exists (select 1 from partner_documentos pd
                                  where pd.partner_id = p.id and pd.tipo in ('contrato_social','cpf'))) as enviaram_docs,
  count(*) filter (where p.status = 'approved') as aprovados,
  count(*) filter (where exists (select 1 from propostas pr where pr.partner_id = p.id)) as com_proposta,
  count(*) filter (where exists (select 1 from comissoes c where c.partner_id = p.id and c.status = 'paga')) as com_comissao_paga
from partners p
left join partner_invites pi on pi.partner_id = p.id
left join usuarios u on u.id = p.usuario_id;

grant select on public.v_admin_funil_parceiros to authenticated;
```

Adicionar card no dashboard admin existente ([`app/src/pages/admin/Dashboard.tsx`](../app/src/pages/admin/Dashboard.tsx)) com 6 etapas mostrando absoluto + percentual de conversão.

#### 5.2 Edge `email-bounce-webhook`

- Configure SMTP customizado no Dashboard Supabase (recomendado: SendGrid ou Postmark).
- Provedor manda webhook ao seu endpoint quando email faz bounce.
- Pasta: `supabase/functions/email-bounce-webhook/index.ts` (`verify_jwt = false`).
- Valida assinatura HMAC do provedor (padrão idêntico ao `stripe-webhook`).
- Idempotência: criar tabela `email_bounces_inbox(event_id text primary key, payload jsonb, processed_at timestamptz)` na mesma migration.
- Lógica: extrai email do payload → `update partner_invites set status='expired' where email=$1 and status='sent'`.

### Tarefa 6 — Smoke test mobile

Criar `supabase/smoke-tests/fase-10-mobile.sql`:

- Cria usuário admin de teste.
- Chama `admin_invite_partner_record` (simula Edge).
- Verifica que `partner_invites.status='sent'`.
- Simula aceite (insere `last_sign_in_at` em `auth.users` via dump direto).
- Confirma que view `v_admin_funil_parceiros` conta na etapa correta.
- Roda em transação com ROLLBACK no final.

Padrão: olhar [`supabase/smoke-tests/fase-3-smoke.sql`](../supabase/smoke-tests/fase-3-smoke.sql) e [`fase-8-smoke.sql`](../supabase/smoke-tests/fase-8-smoke.sql).

### Tarefa 7 — Roadmap, typecheck, deploy, commit

```bash
cd app && npx tsc --noEmit                                 # 0 erros
cd ../mobile && npm run typecheck                          # 0 erros
cd ..
supabase db push                                            # aplica migration 020 (funil)
supabase functions deploy admin-invite-partner   --project-ref bhagksfvszeogtjvjtpx  # re-deploy se mudou
supabase functions deploy email-bounce-webhook   --project-ref bhagksfvszeogtjvjtpx

# Marcar Fase 10 em docs/09-roadmap.md
git add -A
git commit -m "feat(fase-10): mobile onboarding + funil parceiros + equipes admin"
git push
```

---

## 7. Checklist de aceitação Fase 10

- [ ] `mobile/lib/supabase.ts` criado com SecureStore para tokens.
- [ ] Login mobile real funciona em iOS e Android (testar pelo Expo Go).
- [ ] Deep-link `mercurio://magic/partner-bootstrap` abre o app e completa o bootstrap.
- [ ] Tela `(parceiro)/pendente.tsx` faz upload de docs reais para o bucket `partner-docs`.
- [ ] Tela `(admin)/parceiros.tsx` lista parceiros reais com filtros.
- [ ] Tela `(admin)/aprovacoes.tsx` mostra `origem` e permite aprovar/recusar.
- [ ] UI web `/admin/parceiros/:id/equipes` lista equipes e membros.
- [ ] View `v_admin_funil_parceiros` retorna números coerentes (testar com seed).
- [ ] Card de funil aparece em `/admin/dashboard`.
- [ ] Webhook `email-bounce-webhook` marca convites como `expired` (testar com payload mock).
- [ ] `npx tsc --noEmit` em `app/` e `mobile/` sem erros.
- [ ] Smoke test `fase-10-mobile.sql` passa.
- [ ] Roadmap atualizado com `[x]` nos 6 itens.

---

## 8. Armadilhas conhecidas (leitura obrigatória)

1. **Expo SDK 54 + RN 0.81** — versões muito novas. Sempre use `npx expo install` (não `npm install`) para libs que falam com nativo; o Expo resolve a versão compatível.

2. **`expo-secure-store` vs AsyncStorage** — use SecureStore só para tokens; AsyncStorage para cache do React Query. Misturar quebra logout (token persiste em AsyncStorage também).

3. **Deep-links no iOS exigem associated domains** se você quiser universal links. Para magic-link via custom scheme `mercurio://`, basta declarar `scheme` no `app.json` (já feito).

4. **NativeWind 4 vs Tailwind config** — não use as classes `text-navy/gold/silver/success/danger` do web direto; o `mobile/tailwind.config.js` precisa estar sincronizado. Confira que os tokens estão lá antes de criar componentes.

5. **RLS no mobile** — o token expira em 1h; configure `autoRefreshToken: true` (já no exemplo) e respeite os listeners de `onAuthStateChange` para invalidar queries.

6. **Cliente Supabase JS no Expo precisa do polyfill** — sempre `import 'react-native-url-polyfill/auto'` no topo do arquivo que cria o client.

7. **Bug recorrente — `usuarios.partner_id` não existe.** A relação é via `partners.usuario_id`. Se você criar query nova mobile, use o helper `app_partner_user_ids()` (criado na Fase 9) ou faça join correto. Não invente coluna.

8. **`partner_documentos` tem RLS estrito** — upload precisa ser feito com o JWT do usuário dono do `partner_id`. Não tente uploads via service role no mobile.

9. **Bounce de e-mail**: SMTP nativo do Supabase **não envia webhook de bounce**. Por isso a Tarefa 5.2 exige SMTP customizado. Configure SendGrid/Postmark **antes** de implementar o webhook.

10. **Storage no mobile** — `supabase.storage.from('bucket').upload(path, file)` requer um `Blob`/`File`. No RN você precisa do `expo-file-system` para ler arquivo binário e converter via `FormData`. Veja o padrão em [`app/src/components/PartnerDocsUploader.tsx`](../app/src/components/PartnerDocsUploader.tsx) e adapte com `FormData` + `fetch` direto contra `storage/v1/object/...`.

---

## 9. Contatos e referências

- **Repositório:** https://github.com/bonacciniWd/mercurio-capital
- **Documentação:**
  - [09-roadmap.md](09-roadmap.md) — fonte da verdade do escopo.
  - [12-handoff-fase7.md](12-handoff-fase7.md) — referência de fluxo contratos.
  - [13-handoff-fase8.md](13-handoff-fase8.md) — referência LMS.
  - [14-handoff-fase9.md](14-handoff-fase9.md) — fonte para entender o backend de parceiros e o fluxo de convite que você vai replicar no mobile.
  - [stripe-setup.md](stripe-setup.md) — configuração de pagamentos.
- **Supabase Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx
- **Expo Docs SDK 54:** https://docs.expo.dev/versions/v54.0.0/

---

## 10. Dica final

**Antes de codar:**

```bash
git log --oneline -25
cat docs/14-handoff-fase9.md     # você vai chamar essas mesmas RPCs no mobile
```

A Fase 9 foi a primeira a unificar **convite → bootstrap → aprovação**. Sua missão é levar exatamente esse fluxo para o mobile com **zero refatoração de backend** — só consumir o que já existe.

**Se algo do schema não bate com este doc, o código no repo é a fonte da verdade — este documento foi escrito em 2026-05-20.**
