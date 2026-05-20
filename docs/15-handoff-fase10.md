# Handoff — Fase 10 (Equipes Admin & Funil de Parceiros)

> Documento de transferência para o desenvolvedor que assume a Fase 10 a partir do estado atual (após Fase 9 — Gestão de Parceiros & Onboarding por Convite, descrita em [docs/14-handoff-fase9.md](14-handoff-fase9.md)).
> **Data:** 2026-05-20 · **Branch:** `main` · **Escopo:** WEB ONLY (mobile permanece mock).

---

## 1. Onde estamos

✅ **Fases 1 → 9 entregues e em produção** (Clicksign sandbox, Stripe dev, provedores de consulta em mock, SMTP nativo Supabase com rate-limit conhecido).

| Fase | Resumo |
|------|--------|
| 1 | Auth + RLS + Roles + 2FA |
| 2 | CRUD parceiros, **equipes**, clientes, simulações |
| 3 | Originação completa |
| 4 | Admin Ops, equipes (convites), dashboards |
| 5 | Carteira Stripe + preços versionados |
| 6 | Consultas externas pagas |
| 7 | Contratos + Clicksign + Liberação + Comissões |
| 8 | Universidade Mercurio (LMS) |
| 9 | **Gestão de Parceiros (Admin) + Convite + Bootstrap** |

Roadmap completo: [docs/09-roadmap.md](09-roadmap.md). **Mobile (Expo) está 100% mock** e foi adiado para a Fase 11 — não tocar nele nesta fase.

---

## 2. Escopo da Fase 10

Três entregas, todas no app web (`app/`) + back (`supabase/`):

1. **UI admin de equipes do parceiro** — nova rota `/admin/parceiros/:partnerId/equipes`, consumindo as views `v_equipe_membros_detalhe` / `v_equipe_convites_pendentes` (criadas na Fase 4) + 2 RPCs novas para suspender/revogar.
2. **Funil de parceiros** — view `v_admin_funil_parceiros` + card no `/admin` (dashboard global) com 6 etapas e taxa de conversão entre elas.
3. **Webhook de bounce** — tabela `email_bounces_inbox` + Edge `email-bounce-webhook` (verify_jwt=false) marcando `partner_invites.status='expired'` automaticamente quando o provedor SMTP devolver bounce.

---

## 3. Setup local

```bash
git clone git@github.com:bonacciniWd/mercurio-capital.git
cd mercurio-capital

supabase login
supabase link --project-ref bhagksfvszeogtjvjtpx

cd app && npm install && npx tsc --noEmit && cd ..
```

**Project ref Supabase:** `bhagksfvszeogtjvjtpx`
**Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx

> Mobile (`mobile/`) **não faz parte desta fase**. Continuamos focando exclusivamente no web. Veja Fase 11 do roadmap para o port mobile.

---

## 4. Convenções obrigatórias (idênticas às fases anteriores)

- **Migrations**: `supabase/migrations/YYYYMMDDHHMMSS_descricao_fase.sql`. Próxima livre: `20260520000010_funil_parceiros_fase10.sql`.
- **Aplicar**: `supabase db push`.
- **Funções**: `security definer` + `set search_path = public` + `grant execute … to authenticated`.
- **RLS**: sempre habilitada; views com `security_invoker = true` para herdar policies das tabelas-base.
- **Edge Functions**: Deno, import `https://esm.sh/@supabase/supabase-js@2.45.4`, deploy via `supabase functions deploy <nome> --project-ref bhagksfvszeogtjvjtpx`.
- **Frontend**: React 18 + TanStack Query v5 + React Router v6 + Tailwind + lucide-react. Componentes em `app/src/components/`, páginas em `app/src/pages/admin/`.
- **Commits**: `feat(fase-10): …`, `fix: …`, `docs: …`.

---

## 5. O que JÁ EXISTE (não recriar!)

### 5.1 Tabelas/views já no banco

| Objeto | Migration | Uso na Fase 10 |
|---|---|---|
| `partners` + RLS | `20260513000002_identidade.sql` | Origem do funil |
| `partner_invites` (`sent/accepted/revoked/expired`) | `20260518000042_admin_partner_management.sql` | Etapa "convidados" + webhook bounce |
| `partner_documentos` | `20260513000002` + `20260514000001` | Etapa "enviou docs" |
| `propostas`, `comissoes` | originação + Fase 7 | Etapas finais do funil |
| `equipes`, `equipe_membros` | `20260513000002_identidade.sql` | UI admin equipes |
| `v_equipe_membros_detalhe` | `20260518000008_equipes_convites.sql` | Listagem de membros (já filtra para admin) |
| `v_equipe_convites_pendentes` | `20260518000008_equipes_convites.sql` | Listagem de convites de equipe abertos |
| `magic_links` (`finalidade='membro_convite'`) | core | Convites de membro |
| `v_admin_partners` | `20260518000042` | Lookup do partner pela tela mãe |
| `app_partner_user_ids(uuid)` helper | `20260519000002` | Útil em RPCs que precisam saber quais usuários pertencem ao partner |

### 5.2 Frontend já pronto

| Tela | Caminho | O que muda na Fase 10 |
|---|---|---|
| `/admin/parceiros` | `app/src/pages/admin/Parceiros.tsx` | Adicionar link "Ver equipes" no painel lateral do parceiro selecionado |
| `/admin` (dashboard) | `app/src/pages/admin/Dashboard.tsx` | Adicionar card `FunilParceirosCard` |
| Router | `app/src/router.tsx` linha ~196 | Registrar rota `parceiros/:partnerId/equipes` |

### 5.3 Onde NÃO mexer

- `app/src/pages/public/PartnerBootstrap.tsx` (Fase 9, intocável).
- `app/src/pages/public/AcessoPendente.tsx` (Fase 9, intocável).
- Toda a pasta `mobile/` (Fase 11).

---

## 6. Tarefas detalhadas (em ordem)

### Tarefa 1 — Migration `20260520000010_funil_parceiros_fase10.sql`

Contém **tudo** que precisa ser criado no banco:

1. **View `v_admin_funil_parceiros`** (`security_invoker = true`) — uma linha agregada com 6 colunas inteiras:
   - `convidados` — total de `partner_invites` (qualquer status).
   - `ativaram` — partners cujo `usuario_id` tem `auth.users.last_sign_in_at not null`.
   - `enviaram_docs` — partners com pelo menos um registro em `partner_documentos`.
   - `aprovados` — `partners.status = 'approved'`.
   - `com_proposta` — partners com pelo menos uma `propostas`.
   - `com_comissao_paga` — partners com pelo menos uma `comissoes` em status pago (consultar enum real de `comissoes` em `20260518000030_contratos_fase7.sql` — se for `'paga'` use isso; ajustar conforme exista).

   Permissão: `grant select on … to authenticated`. A view deve filtrar **automaticamente** para admin via `app_is_admin()` (se não-admin, retornar zeros). Padrão:

   ```sql
   create or replace view public.v_admin_funil_parceiros
   with (security_invoker = true) as
   select
     case when public.app_is_admin() then count(distinct pi.id) else 0 end as convidados,
     case when public.app_is_admin() then count(distinct p.id) filter (where au.last_sign_in_at is not null) else 0 end as ativaram,
     -- …
   from public.partners p
   left join public.partner_invites pi on pi.partner_id = p.id
   left join auth.users au on au.id = p.usuario_id
   …
   ```

2. **Tabela `email_bounces_inbox`**:
   ```sql
   create table public.email_bounces_inbox (
     event_id    text primary key,
     provider    text not null,
     email       text not null,
     reason      text,
     payload     jsonb not null default '{}',
     received_at timestamptz not null default now(),
     processed_at timestamptz
   );
   alter table public.email_bounces_inbox enable row level security;
   create policy "admin_read_bounces" on public.email_bounces_inbox
     for select using (public.app_is_admin());
   create index on public.email_bounces_inbox (lower(email), received_at desc);
   ```

3. **RPC `admin_revoke_equipe_membro_convite(p_magic_link_id uuid)`**:
   - Só admin.
   - `update magic_links set used_at = now() where id = $1 and finalidade = 'membro_convite' and used_at is null`.

4. **RPC `admin_suspend_equipe_membro(p_equipe_id uuid, p_usuario_id uuid)`** e `admin_reactivate_equipe_membro(...)`:
   - Só admin.
   - `update equipe_membros set permissoes = jsonb_set(permissoes, '{suspenso}', 'true'/'false')`.
   - Auditoria em `auditoria` (tabela existente).

5. **RPC `process_email_bounce(p_event_id text, p_provider text, p_email text, p_reason text, p_payload jsonb)`**:
   - `security definer` — chamada pela Edge.
   - Idempotência: insert em `email_bounces_inbox` com `on conflict (event_id) do nothing`.
   - Marca `update partner_invites set status='expired' where lower(email) = lower($3) and status='sent'`.
   - Marca `processed_at = now()` no inbox.
   - **Revoke** execute de `public` e grant **só para `service_role`** (a Edge usará service role).

### Tarefa 2 — Edge `email-bounce-webhook`

Pasta: `supabase/functions/email-bounce-webhook/`.

Estrutura mínima (espelhar `supabase/functions/stripe-webhook/index.ts`):

- `index.ts` lê `req.headers['x-signature']` (ajuste conforme provedor).
- HMAC-SHA256 com `Deno.env.get('BOUNCE_WEBHOOK_SECRET')` sobre `await req.text()`.
- Aceita payload genérico `{ event_id, email, reason }` ou loop sobre `events[]` (SendGrid manda array).
- Para cada evento de bounce/dropped/blocked: chama `supabase.rpc('process_email_bounce', { … })` com client **service role**.
- Retorna `200` mesmo em payload duplicado (idempotência garantida pelo `on conflict`).
- Deploy: `supabase functions deploy email-bounce-webhook --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt`.
- Secrets: `supabase secrets set BOUNCE_WEBHOOK_SECRET=... --project-ref bhagksfvszeogtjvjtpx`.

⚠️ Sem SMTP customizado configurado, a Edge não recebe tráfego — está pronta para o dia que SendGrid/Postmark for plugado. Documente isso no commit.

### Tarefa 3 — Rota `/admin/parceiros/:partnerId/equipes`

Criar `app/src/pages/admin/PartnerEquipes.tsx`:

- `useParams<{ partnerId: string }>()`.
- 3 queries paralelas (TanStack Query):
  - Partner info: `from('v_admin_partners').select('partner_id, nome, email, status').eq('partner_id', partnerId).maybeSingle()`.
  - Equipes: `from('equipes').select('id, nome, isolamento_estrito, created_at').eq('partner_id', partnerId).order('created_at')`.
  - Membros (todas equipes): `from('v_equipe_membros_detalhe').select('*').eq('partner_id', partnerId)`.
  - Convites pendentes: `from('v_equipe_convites_pendentes').select('*').eq('partner_id', partnerId)`.
- Layout:
  - Header com breadcrumb `Parceiros → {nome} → Equipes`.
  - Para cada equipe (accordion): tabela de membros (nome, email, papel, status); badge "isolamento estrito" se ativo; tabela de convites pendentes.
  - Ações por membro: botão "Suspender"/"Reativar" (chama RPCs novas), botão "Remover" (chama `partner_remove_membro`).
  - Ações por convite: botão "Revogar" (chama `admin_revoke_equipe_membro_convite`).
- Loading com `Loader2`; erros com toast (padrão das outras telas admin).

Registrar em [`app/src/router.tsx`](../app/src/router.tsx) (após `path: 'parceiros'`):

```tsx
{ path: 'parceiros/:partnerId/equipes', element: <AdminPartnerEquipes /> },
```

Em [`app/src/pages/admin/Parceiros.tsx`](../app/src/pages/admin/Parceiros.tsx), adicionar no painel lateral do parceiro selecionado um link:

```tsx
<Link to={`/admin/parceiros/${selected.partner_id}/equipes`}
      className="btn-secondary text-xs">Ver equipes ({selected.equipes_count})</Link>
```

### Tarefa 4 — Card de funil no dashboard admin

Criar `app/src/components/FunilParceirosCard.tsx`:

- Query: `from('v_admin_funil_parceiros').select('*').maybeSingle()`.
- 6 etapas em linha horizontal (scroll-x em mobile-web): valor absoluto + setinha + percentual da etapa anterior.
- Cor accent: gold/navy alternados.

Em [`app/src/pages/admin/Dashboard.tsx`](../app/src/pages/admin/Dashboard.tsx), inserir `<FunilParceirosCard />` em uma nova linha do grid logo abaixo dos 5 KPI cards e acima do "Top 10".

### Tarefa 5 — Smoke test `supabase/smoke-tests/fase-10-funil.sql`

Padrão das outras (`fase-3-smoke.sql`, `fase-8-smoke.sql`):

- `begin;` + cria admin + parceiro de teste.
- Insere 3 `partner_invites` (1 sent, 1 accepted, 1 expired).
- Insere 1 doc em `partner_documentos`.
- Aprova o parceiro.
- Cria 1 proposta + 1 comissão paga.
- `select * from v_admin_funil_parceiros` — assert via `assert (convidados >= 3 and com_comissao_paga >= 1)`.
- Simula bounce: chama `process_email_bounce('evt_test', 'sendgrid', 'expirar@test.com', 'hard_bounce', '{}'::jsonb)` e confirma que o invite virou `expired`.
- `rollback;` no final.

### Tarefa 6 — Roadmap + typecheck + commit

```bash
cd app && npx tsc --noEmit                                # 0 erros
cd ..
supabase db push                                          # aplica migration 010
supabase functions deploy email-bounce-webhook \
   --project-ref bhagksfvszeogtjvjtpx --no-verify-jwt

# Marcar [x] os 6 itens da Fase 10 em docs/09-roadmap.md
git add -A
git commit -m "feat(fase-10): equipes admin UI + funil parceiros + edge bounce webhook"
git push
```

---

## 7. Checklist de aceitação Fase 10

- [ ] Migration `20260520000010_funil_parceiros_fase10.sql` aplicada em produção.
- [ ] View `v_admin_funil_parceiros` retorna números coerentes para admin e zeros para não-admin.
- [ ] Tabela `email_bounces_inbox` criada com RLS.
- [ ] RPCs `admin_revoke_equipe_membro_convite`, `admin_suspend_equipe_membro`, `admin_reactivate_equipe_membro`, `process_email_bounce` granted corretamente.
- [ ] Rota `/admin/parceiros/:partnerId/equipes` acessível para admin, 403 para outros.
- [ ] Painel lateral em `/admin/parceiros` mostra link "Ver equipes".
- [ ] `FunilParceirosCard` aparece em `/admin` com 6 etapas e percentuais de conversão.
- [ ] Edge `email-bounce-webhook` deployada (`--no-verify-jwt`) e responde 200 ao payload mock.
- [ ] Smoke test passa (`fase-10-funil.sql`).
- [ ] `npx tsc --noEmit` em `app/` sem erros.
- [ ] Roadmap atualizado com `[x]` nos 6 itens.

---

## 8. Armadilhas conhecidas

1. **`comissoes` status** — Verifique o enum real em `20260518000030_contratos_fase7.sql` antes de hardcodar `'paga'`. Pode ser `'pago'`, `'liquidada'`, etc.

2. **`auth.users` requer service role** — A view do funil acessa `auth.users.last_sign_in_at`. Como ela é `security_invoker`, o `authenticated` precisa ter `select` em `auth.users`. **Não conceda** — em vez disso crie uma view auxiliar `security definer` ou refaça a métrica olhando `usuarios.ultimo_login_at` se existir (verifique schema antes). Provavelmente o caminho mais limpo é uma **function** `app_partner_funil()` `security definer` que retorna a linha agregada, e a "view" vira uma sugar que faz `select * from app_partner_funil()`.

3. **`v_equipe_membros_detalhe` já filtra por `app_is_admin()`** — não tente filtrar de novo no client, e não esqueça que ela é uma view sem RLS própria; a função `app_is_admin()` é checada dentro do SELECT.

4. **`equipe_membros.permissoes` é jsonb** — usar `permissoes ->> 'suspenso' = 'true'` para ler. Idempotência ao suspender duas vezes deve ser ok porque `jsonb_set` substitui.

5. **`magic_links` para convites de equipe** — não tem coluna `status`; o "convite revogado" é representado por `used_at not null`. A RPC `admin_revoke_equipe_membro_convite` faz exatamente isso.

6. **Bug recorrente — `usuarios.partner_id` não existe**. A relação correta é `partners.usuario_id`. Use o helper `app_partner_user_ids(p_partner_id)` (criado na Fase 9) sempre que precisar saber "quem são os usuários deste parceiro".

7. **Webhook signature differs por provedor** — SendGrid: `X-Twilio-Email-Event-Webhook-Signature` + base64; Postmark: HMAC simples; Mailgun: `X-Mailgun-Signature-256`. Faça a Edge **parametrizável por `provider` na URL** (`?provider=sendgrid`) para suportar troca sem redeploy.

8. **HMAC signature replay** — armazene `event_id` da requisição em `email_bounces_inbox` (PK) e use `on conflict do nothing`. Não confie em timestamp do header (alguns provedores não mandam).

---

## 9. Contatos e referências

- **Repositório:** https://github.com/bonacciniWd/mercurio-capital
- **Documentação:**
  - [09-roadmap.md](09-roadmap.md) — fonte da verdade do escopo.
  - [12-handoff-fase7.md](12-handoff-fase7.md), [13-handoff-fase8.md](13-handoff-fase8.md), [14-handoff-fase9.md](14-handoff-fase9.md) — handoffs anteriores; padrão a seguir aqui.
- **Supabase Dashboard:** https://supabase.com/dashboard/project/bhagksfvszeogtjvjtpx
- **Padrão Edge HMAC:** ver [`supabase/functions/stripe-webhook/index.ts`](../supabase/functions/stripe-webhook/index.ts).

---

## 10. Dica final

A Fase 10 é o "fechamento da experiência admin de parceiros": com ela, o admin consegue **(a)** entender o programa em números (funil), **(b)** agir no nível mais granular (membro de equipe), e **(c)** manter a base de convites limpa automaticamente (bounce webhook).

**Se algo do schema não bate com este doc, o código no repo é a fonte da verdade — este documento foi escrito em 2026-05-20.**
