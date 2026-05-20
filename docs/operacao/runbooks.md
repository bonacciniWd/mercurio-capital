# Runbooks Operacionais — Mercurio Capital

> Procedimentos operacionais. Cada runbook tem: gatilho, diagnóstico, ação, validação, escalation.

## Sumário

1. [Deploy de migration](#1-deploy-de-migration)
2. [Deploy de Edge Function](#2-deploy-de-edge-function)
3. [Deploy do web app](#3-deploy-do-web-app)
4. [Incidente: API Supabase fora do ar](#4-incidente-api-supabase-fora-do-ar)
5. [Incidente: emails não estão sendo enviados](#5-incidente-emails-não-estão-sendo-enviados)
6. [Incidente: parceiro reporta erro de saldo](#6-incidente-parceiro-reporta-erro-de-saldo)
7. [Resposta a solicitação LGPD](#7-resposta-a-solicitação-lgpd)
8. [Rotação de senha do banco](#8-rotação-de-senha-do-banco)
9. [Restore from backup (DR)](#9-restore-from-backup-dr)

---

## 1. Deploy de migration

**Gatilho**: nova migration em `supabase/migrations/`.

**Passos**:
```bash
# 1. Verificar diff local
git --no-pager diff main -- supabase/migrations/

# 2. Aplicar no remoto
supabase db push --linked --include-all

# 3. Smoke test correspondente
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/fase-XX.sql
```

**Validação**:
- `supabase db push` retorna `Finished` sem erro.
- Smoke `FASE XX SMOKE: OK`.
- `select * from public.schema_migrations order by version desc limit 5` mostra a nova.

**Rollback**: criar migration reversa (não usar `db reset` em prod). Se quebrou de forma crítica, abrir ticket Supabase para PITR (ver §9).

---

## 2. Deploy de Edge Function

```bash
supabase functions deploy <nome> --project-ref bhagksfvszeogtjvjtpx [--no-verify-jwt]
supabase functions logs <nome> --project-ref bhagksfvszeogtjvjtpx --tail
```

**Validação**: chamar manualmente com `curl`:
```bash
curl -X POST "https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/<nome>" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 3. Deploy do web app

Pipeline padrão (Vercel/Cloudflare Pages):
- `main` → produção.
- Pré-deploy: `cd app && npm ci && npx tsc --noEmit && npm run build`.
- Smoke pós-deploy: login admin + abrir `/admin` + verificar lazy chunks carregando.

---

## 4. Incidente: API Supabase fora do ar

**Diagnóstico**:
1. Status: https://status.supabase.com
2. `curl -sI https://bhagksfvszeogtjvjtpx.supabase.co/rest/v1/` → esperar 401 (não 5xx).
3. PostHog/Sentry erros recentes.

**Ação**:
- Banner de manutenção no app (`public.banner_manutencao` feature flag).
- Acompanhar status; abrir ticket P1 se indisponibilidade > 15 min.

**Escalation**: CTO + suporte Supabase.

---

## 5. Incidente: emails não estão sendo enviados

**Diagnóstico**:
```sql
-- itens travados em email_outbox
select status, count(*), max(updated_at)
  from email_outbox
 group by 1;

select * from email_outbox where status = 'erro' order by updated_at desc limit 20;
```

**Causas comuns**:
- SMTP creds incorretos → revisar secrets da Edge Function `email-dispatcher`.
- Bounces alto → checar `email_bounces_inbox`, suspender envios.

**Ação**:
- Resetar itens travados: `update email_outbox set status='pendente' where status='enviando' and updated_at < now() - interval '10 min';`
- Re-disparar dispatcher (cron / `supabase functions invoke email-dispatcher`).

---

## 6. Incidente: parceiro reporta erro de saldo

**Diagnóstico**:
```sql
-- ledger do parceiro
select * from partner_wallet_movimentos
 where partner_id = '<UUID>'
 order by created_at desc limit 50;

select * from partner_wallets where partner_id = '<UUID>';
```

Saldo deve ser igual ao último `saldo_depois` do ledger.

**Ação**: se divergir, abrir incidente P1 e NÃO ajustar manualmente. Investigar via audit_log.

---

## 7. Resposta a solicitação LGPD

**Export**:
```sql
select public.lgpd_export_meus_dados('<USER_UUID>');
```
Salvar JSON em local seguro e enviar ao titular via canal autenticado.

**Anonimização**:
```sql
select public.lgpd_anonimizar_conta('<USER_UUID>', p_motivo := 'Solicitação LGPD ticket #123');
```

**Validar**:
```sql
select email, ativo from usuarios where id = '<USER_UUID>';
select * from v_admin_lgpd_solicitacoes where titular_id = '<USER_UUID>';
```

**SLA**: responder em até **15 dias** (LGPD art. 19).

---

## 8. Rotação de senha do banco

1. Supabase Dashboard → Settings → Database → **Reset database password**.
2. Atualizar `DATABASE_URL` em:
   - Vercel/Cloudflare env vars
   - Edge Functions secrets (`supabase secrets set DATABASE_URL=...`)
   - GitHub Actions secrets
3. Validar com `psql "$DATABASE_URL" -c "select 1"`.

---

## 9. Restore from backup (DR)

**RTO**: 1h · **RPO**: 5 min (PITR).

Passos (Supabase Pro/Team plan):
1. Dashboard → Database → Backups → **Point in Time Recovery**.
2. Escolher timestamp imediatamente antes do incidente.
3. Confirmar restore — Supabase cria projeto stand-by (~15-30 min).
4. Validar dados em staging antes de promover.
5. Atualizar DNS / connection strings.

**Drill semestral**: executar restore para projeto de teste, validar:
- contagens de `partners`, `propostas`, `comissoes`
- `select sum(saldo) from partner_wallets`
- Login admin OK.

Registrar resultado em `docs/dr-drill-log.md` (criar a cada drill).
