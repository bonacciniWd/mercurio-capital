# Plano de Disaster Recovery (DR)

> Última revisão: 2026-05-20

## Objetivos

| Métrica | Alvo |
|---------|------|
| **RTO** (Recovery Time Objective) | ≤ 1 hora |
| **RPO** (Recovery Point Objective) | ≤ 5 minutos |
| **Backup retention** | 7 dias (PITR) + 30 dias (daily) |

## Estratégia de Backup

### 1. Point-in-Time Recovery (PITR) — Supabase

- Habilitado no projeto **mercurio** (`bhagksfvszeogtjvjtpx`).
- Janela: últimos 7 dias, granularidade de 2 minutos.
- Cobre: schema + dados + extensões.
- **Não cobre**: Storage objects, Edge Function code, secrets.

### 2. Daily logical dumps (off-site)

Job semanal (manual ou GitHub Action):
```bash
pg_dump "$DATABASE_URL" \
  --no-owner --no-privileges \
  --schema=public \
  --file=mercurio-$(date +%Y%m%d).sql

# Comprimir e upload para bucket criptografado fora do Supabase
gzip mercurio-*.sql
# aws s3 cp mercurio-*.sql.gz s3://mercurio-dr/$(date +%Y/%m)/ --sse AES256
```

### 3. Storage (documentos KYC, avatares)

Replicar bucket `partner-documentos` para bucket DR mensalmente:
```bash
supabase storage cp --recursive \
  ss://partner-documentos \
  s3://mercurio-dr-storage/$(date +%Y%m)/
```

### 4. Código & infraestrutura

- Git (GitHub): origem da verdade. Tag de release por fase.
- Edge Functions: deploy via `supabase functions deploy` (código em `supabase/functions/`).
- Secrets: documentados em vault separado (1Password/Bitwarden — referência por nome, valores fora do repo).

## Cenários e procedimentos

### A) Corrupção lógica (ex.: DELETE acidental em produção)

1. Identificar timestamp anterior ao incidente via audit_log.
2. Supabase Dashboard → Database → Backups → PITR → restaurar para projeto stand-by.
3. Validar dados afetados em staging.
4. **Opção 1**: copiar registros do stand-by para produção (`pg_dump --table=...`).
5. **Opção 2**: promover stand-by (atualizar DNS e secrets).

**Tempo estimado**: 30-60 min.

### B) Indisponibilidade total Supabase

1. Acompanhar status (https://status.supabase.com).
2. Banner de manutenção no app.
3. Se > 4h, ativar plano de migração para projeto DR em outra região (cold).

**Tempo estimado**: dependente do Supabase; cold restart 2-4h.

### C) Perda da connection string / acesso admin

1. Recuperar via owner do projeto Supabase (sempre ≥ 2 admins).
2. Reset password via Supabase Dashboard (auth.supabase.io).
3. Atualizar secrets em todos os ambientes (ver runbook §8).

## Drill Semestral

Executar a cada 6 meses; resultado em `docs/dr-drill-log.md`.

**Checklist do drill**:
- [ ] Criar projeto Supabase de teste (free tier).
- [ ] Restaurar último PITR neste projeto.
- [ ] Validar:
  - `select count(*) from usuarios, partners, propostas, partner_wallet_movimentos`
  - `select sum(saldo) from partner_wallets`
  - Login admin OK; abrir `/admin/dashboard`.
- [ ] Documentar tempo total + falhas observadas.
- [ ] Deletar projeto de teste.

## Responsáveis

| Papel | Pessoa | Backup |
|-------|--------|--------|
| Owner Supabase | (preencher) | (preencher) |
| DBA / Migrations | (preencher) | (preencher) |
| Comunicação clientes | Suporte | Marketing |

## Próximos passos

- [ ] Configurar GitHub Action de dump semanal.
- [ ] Provisionar bucket S3 DR criptografado.
- [ ] Primeiro drill: 2026-Q3.
- [ ] Documentar Edge Functions secrets em vault.
