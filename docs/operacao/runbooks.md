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
10. [Incidente: assinatura Clicksign não atualiza contrato](#10-incidente-assinatura-clicksign-não-atualiza-contrato)
11. [Incidente: upload Vimeo no admin não conclui](#11-incidente-upload-vimeo-no-admin-não-conclui)
12. [Incidente: consulta Bacen SCR falhando](#12-incidente-consulta-bacen-scr-falhando)
13. [Incidente: parceiro aprovado bloqueado como não aprovado](#13-incidente-parceiro-aprovado-bloqueado-como-não-aprovado)

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

---

## 10. Incidente: assinatura Clicksign não atualiza contrato

**Sintoma**:
- Assinatura concluída na Clicksign, mas proposta segue em `aguardando_assinatura`.
- `contratos.assinado_em` continua `null`.

**Diagnóstico rápido**:
```sql
-- Eventos recebidos da Clicksign
select id, tipo, recebido_em, processado_em
  from clicksign_webhooks_inbox
 order by recebido_em desc
 limit 30;

-- Estado do contrato e signatários
select id, proposta_id, provider_envelope_id, assinado_em, registrado_em
  from contratos
 where id = '<CONTRATO_UUID>';

select id, signatario_email, status, provider_request_signature_key, assinado_em
  from assinaturas_contrato
 where contrato_id = '<CONTRATO_UUID>'
 order by ordem;
```

**Checklist de causa provável**:
- `CLICKSIGN_WEBHOOK_SECRET` ausente/incorreto.
- `CLICKSIGN_REQUIRE_SIGNED_WEBHOOK=true` com assinatura inválida no header.
- `provider_envelope_id` divergente do documento na Clicksign.
- `provider_request_signature_key` ausente para algum signatário.

**Ação imediata**:
1. Validar secrets da função:
   - `CLICKSIGN_API_TOKEN`
   - `CLICKSIGN_WEBHOOK_SECRET`
   - `CLICKSIGN_ALLOW_DEV_MODE=false` (produção)
   - `CLICKSIGN_REQUIRE_SIGNED_WEBHOOK=true` (produção)
2. Ver logs da função `clicksign-webhook` e confirmar retorno HTTP `200` para eventos.
3. Se o evento entrou no inbox mas não avançou status, reenfileirar reprocessamento manual via RPC admin (ou reenvio de evento no provedor).

**Validação de recuperação**:
```sql
select p.id, p.status, c.assinado_em
  from propostas p
  join contratos c on c.proposta_id = p.id
 where c.id = '<CONTRATO_UUID>';
```

Esperado após correção:
- `contratos.assinado_em` preenchido.
- `propostas.status = 'em_registro'`.

---

## 11. Incidente: upload Vimeo no admin não conclui

**Sintoma**:
- Admin seleciona video em `/admin/universidade`, mas upload para em 0% ou falha no fim.
- Aula de video nao recebe `vimeo_id` automaticamente.

**Diagnóstico rápido**:
1. Verificar secrets da edge:
  - `VIMEO_ACCESS_TOKEN`
  - `VIMEO_EMBED_DOMAINS` (json array de dominios permitidos)
2. Verificar logs das funções:
  - `vimeo-upload-init`
  - `integracao-testar` (chave `vimeo`)
3. Rodar health de integração Vimeo no admin e checar status/erro.

**SQL de apoio**:
```sql
select chave, ativo, ultimo_status, ultimo_erro, ultima_checagem, latencia_ms
  from integracoes_config
 where chave = 'vimeo';

select id, titulo, tipo, vimeo_id, updated_at
  from aulas
 where tipo = 'video'
 order by updated_at desc
 limit 20;
```

**Causas prováveis**:
- Token Vimeo ausente, expirado ou sem escopo para upload.
- Dominios de embed nao aplicados corretamente (`VIMEO_EMBED_DOMAINS` invalido).
- Upload TUS interrompido por rede do cliente.

**Ação imediata**:
1. Validar token Vimeo e refazer `supabase secrets set`.
2. Reexecutar teste de integração `vimeo` no painel admin.
3. Repetir upload por arquivo menor para isolar falha de rede/tamanho.
4. Confirmar que `vimeo_id` foi preenchido e salvar a aula novamente.

**Validação de recuperação**:
- Upload finaliza com progresso 100% no admin.
- `aulas.vimeo_id` preenchido com ID numerico.
- Player web/mobile reproduz a aula e atualiza `aula_progresso` normalmente.

---

## 12. Incidente: consulta Bacen SCR falhando

**Sintoma**:
- Consulta `bacen_cpf`/`bacen_cnpj` retorna `falha_provedor` (HTTP 502) com estorno.
- Log de consulta em status `estornada` com erro relacionado a Bacen.

**Diagnóstico rápido**:
```sql
-- Consultas Bacen recentes e status
select id, tipo, status, provedor, erro, preco_centavos, iniciado_em, concluido_em
  from logs_consultas
 where tipo in ('bacen_cpf','bacen_cnpj')
 order by iniciado_em desc
 limit 30;

-- Confirmar par débito/estorno (transacional)
select referencia_tipo, tipo, valor_centavos, descricao, created_at
  from wallet_ledger
 where referencia_tipo = 'consulta'
 order by created_at desc
 limit 20;

-- Status de integração
select chave, ativo, ultimo_status, ultimo_erro, ultima_checagem
  from integracoes_config
 where chave = 'bacen';
```

**Causas prováveis** (erro no campo `logs_consultas.erro`):
- `bacen_nao_configurado`: `BACEN_SCR_API_URL`/credenciais ausentes (e mock desabilitado).
- `documento_nao_encontrado_na_proposta`: proposta sem CPF/CNPJ no cliente/proponente.
- `Bacen auth 4xx/5xx`: credenciais inválidas ou token endpoint incorreto.
- `Bacen SCR 4xx/5xx`: endpoint/documento inválido no provedor homologado.

**Ação imediata**:
1. Validar secrets: `BACEN_SCR_API_URL`, `BACEN_SCR_AUTH_MODE`, credenciais do modo.
2. Rodar health de integração `bacen` no painel admin e checar `ultimo_erro`.
3. Confirmar que o cliente/proponente da proposta tem documento válido.
4. Como o fluxo estorna automaticamente, **não há débito indevido**; reexecutar após corrigir.

**Rollback (desativar integração real sem quebrar fluxo)**:
- Opção A (bloquear consultas Bacen): desativar a integração no catálogo
  ```sql
  select public.admin_integracao_toggle('bacen', false);
  ```
- Opção B (staging/testes): habilitar mock temporário
  ```bash
  supabase secrets set BACEN_ALLOW_MOCK=true --project-ref bhagksfvszeogtjvjtpx
  ```
  Reverter com `BACEN_ALLOW_MOCK=false` após o teste.
- Opção C (reverter código): `supabase functions deploy consulta-executar` a partir do commit anterior. O contrato transacional (débito/estorno) é preservado em qualquer versão.

**Validação de recuperação**:
- Nova consulta Bacen retorna HTTP 200 com `resumo.totals` preenchido.
- `logs_consultas.status = 'concluida'` e `provedor = 'bacen_scr'`.
- Sem par débito/estorno órfão no `wallet_ledger`.

---

## 13. Incidente: parceiro aprovado bloqueado como não aprovado

**Sintoma**:
- Partner aprovado consegue logar, mas operações como `partner_create_proposta` retornam `forbidden: parceiro não aprovado`.
- Pode ocorrer junto com mensagens de JWT stale no fluxo pós-aprovação.

**Causa raiz típica**:
- Claim `app_metadata.approved` no JWT local desatualizada após aprovação admin.
- Banco já está em `partners.status='approved'`, porém token antigo continua com `approved=false`.

**Diagnóstico rápido**:
```sql
-- 1) Status real no banco
select p.id, p.status, p.usuario_id, p.aprovado_em
  from public.partners p
 where p.id = '<PARTNER_ID>';

-- 2) Conferir metadados persistidos no auth.users
select id, raw_app_meta_data
  from auth.users
 where id = '<USUARIO_ID>';
```

**Ação imediata**:
1. Confirmar que a migration de fallback de claims foi aplicada (`20260701000015_fix_auth_claim_stale_fallbacks.sql`).
2. Pedir re-login do usuário (renovar JWT) caso sessão seja muito antiga.
3. Validar helpers no contexto do parceiro:
```sql
select public.app_partner_id(), public.app_is_approved();
```

**Validação de recuperação**:
- Partner aprovado consegue acessar `/p/propostas/nova` e concluir criação de proposta.
- Partner pendente continua redirecionado para `/acesso-pendente`.
- Sem novos 403 indevidos com mensagem de parceiro não aprovado.
