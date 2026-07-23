# Runbooks Operacionais — Mercurio Capital

> Procedimentos operacionais. Cada runbook tem: gatilho, diagnóstico, ação, validação, escalation.
>
> **Release 0.1.0 (2026-07-23)**: web em produção via Vercel (Root Directory = `app`; deploy a partir da raiz do repositório com `.vercelignore` excluindo `node_modules`/`app/desktop`). Migrations até `20260722000010` aplicadas em `bhagksfvszeogtjvjtpx`. Edge Functions `documento-validar` e `cnpj-consultar` deployadas (requer `INVERTEXTO_TOKEN`).

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
14. [Incidente: credencial comprometida em documentação](#14-incidente-credencial-comprometida-em-documentação)
15. [Pre-flight Apple para release desktop macOS](#15-pre-flight-apple-para-release-desktop-macos)
16. [Governança de release desktop/mobile (go/no-go, rollback e pós-release)](#16-governança-de-release-desktopmobile-go-no-go-rollback-e-pós-release)
17. [Provisionamento do perfil Admin Jurídico](#17-provisionamento-do-perfil-admin-juridico)

---

## Atualização operacional v0.0.9 (2026-07-18)

- Vimeo Upload Access está em review no provedor Vimeo; uploads de vídeo podem falhar até a liberação.
- Resend e templates de e-mail estão operacionais (catálogo admin com preview/teste de enqueue).
- Dispatcher de e-mail e cron `email-dispatcher-every-5-minutes` estão ativos em produção.
- Links públicos canônicos padronizados para https://mercuriocapitalsa.com.br (`SITE_URL`, `APP_URL` e `VITE_PUBLIC_APP_URL`).
- Perfil `admin_nivel='juridico'` ativo com hardening de escrita operacional e permissão exclusiva de upload de modelo de contrato.

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
select status, count(*), max(created_at) as ultimo_item
  from email_outbox
 group by 1;

select id, destinatario, assunto, origem, status, tentativas, ultimo_erro, created_at
  from email_outbox
 where status = 'erro'
 order by created_at desc
 limit 20;

-- monitorar especificamente convites de equipe
select id, destinatario, status, ultimo_erro, metadata->>'evento' as evento, created_at
  from email_outbox
 where metadata->>'evento' = 'convite_equipe'
 order by created_at desc
 limit 20;

-- proposta criada e mudança de status
select id, destinatario, assunto, status, tentativas, ultimo_erro,
       metadata->>'evento' as evento, metadata->>'protocolo' as protocolo, created_at
  from email_outbox
 where metadata->>'evento' in ('proposta_criada', 'proposta_status_changed')
 order by created_at desc
 limit 30;

-- testes enfileirados pelo painel de templates
select id, destinatario, assunto, status, tentativas, ultimo_erro,
       metadata->>'template' as template, created_at
  from email_outbox
 where metadata->>'evento' = 'template_teste'
 order by created_at desc
 limit 10;
```

**Causas comuns**:
- `RESEND_API_KEY`/`RESEND_FROM` incorretos ou ausentes → revisar secrets da Edge Function `email-dispatcher`.
- `SITE_URL`/`APP_URL` ausentes ou incorretos → revisar secrets; o fallback é `https://mercuriocapitalsa.com.br`.
- Bounces alto → checar `email_bounces_inbox`, suspender envios.
- Template de convite removido/inativo no admin (`convite_equipe_v1`) — a RPC possui fallback, mas revisar catálogo para manter padronização visual.
- Templates de proposta removidos/inativos (`proposta_cliente_magic_link_v1`, `proposta_status_changed_v1`) → enqueue retorna falha/não cria item; reativar no catálogo.

**Ação**:
- Resetar itens travados: `update email_outbox set status='pendente' where status='processando' and agendado_para < now() - interval '10 min';`
- Re-disparar dispatcher (cron / `supabase functions invoke email-dispatcher`).
- Se convite de equipe voltar com `email_status='falha_enqueue'`, orientar fallback manual com o link de convite gerado na tela de Equipe (web/mobile).

**Teste controlado pelo admin**:
1. Acessar `/admin/configuracoes` → **Templates de e-mail** e abrir o catálogo, ou ir direto a `/admin/templates?canal=email`.
2. Editar o template, carregar dados fake e conferir o preview sandbox.
3. Na seção **Teste de envio**, escolher template, e-mail interno e variáveis JSON.
4. Clicar em **Enfileirar teste** e confirmar `evento=template_teste` na `email_outbox`.
5. Executar/aguardar o dispatcher e validar `status=enviado` ou `ultimo_erro` claro.
6. O teste operacional de convite continua disponível em Configurações e cria convite real via `partner_invite_membro`.

Templates críticos não podem ser removidos, inativados nem mudar de código/canal. O conteúdo e a lista de variáveis podem ser atualizados; divergências de placeholders aparecem como aviso no editor.

**Agendamento recorrente em produção**:

O job Supabase Cron `email-dispatcher-every-5-minutes` executa a cada 5 minutos via `pg_cron + pg_net`. O antigo workflow GitHub foi removido para evitar duplicidade.

```sql
select jobid, jobname, schedule, active
  from cron.job
 where jobname = 'email-dispatcher-every-5-minutes';

select status, return_message, start_time, end_time
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'email-dispatcher-every-5-minutes')
 order by start_time desc
 limit 10;
```

Para contingência manual:
```bash
curl -fsS -X POST \
  'https://bhagksfvszeogtjvjtpx.supabase.co/functions/v1/email-dispatcher?limit=20' \
  | cat
```

Se o job estiver inativo ou falhando, os registros permanecem em `pendente`; use a chamada manual e inspecione `cron.job_run_details` e `net._http_response`.

**Evidência operacional (2026-07-15)**:
- `supabase secrets list --project-ref bhagksfvszeogtjvjtpx` retornou `RESEND_API_KEY` e `RESEND_FROM`.
- `POST /functions/v1/email-dispatcher?limit=20` retornou `{"ok":true,"picked":0,"sent":0,"errors":0}`.

### Incidente: link público contém localhost/127.0.0.1

1. Confirmar que o frontend usa `publicAppUrl()` para links compartilháveis e que `VITE_PUBLIC_APP_URL=https://mercuriocapitalsa.com.br` no ambiente de build.
2. Confirmar `SITE_URL` e `APP_URL` nos Edge Secrets (listar nomes, nunca valores sensíveis).
3. Verificar a configuração do banco:
  ```sql
  select chave, valor from configuracoes_sistema
   where chave in ('app_url', 'frontend_url', 'site_url');
  ```
4. Reemitir o magic link após a correção; links já emitidos e enviados não são reescritos.
5. `localhost` e `127.0.0.1` só são permitidos em configuração local/testes (`supabase/config.toml`, Vite local e testes automatizados).

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
  - `VIMEO_MAX_UPLOAD_BYTES` (opcional; default 5GB)
2. Verificar logs das funções:
  - `vimeo-upload-init`
  - `integracao-testar` (chave `vimeo`)
3. Rodar health de integração Vimeo no admin e checar status/erro. O health cria um vídeo TUS de 1MB e apaga em seguida; isso valida escopo real de upload, não apenas `/me`.
4. Em `vimeo-upload-init`, procurar logs estruturados:
   - `event=vimeo_create_fail` com `status`, `detail`, `filename`, `size`, `content_type`.
   - `event=vimeo_payload_invalido` quando a resposta não contém `upload_link` ou `vimeo_id`.

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
- Token Vimeo ausente, expirado ou sem escopo para upload/criação (`upload`, `create`, `edit/delete` para health avançado).
- Erro explícito do Vimeo: `Your access token does not have the "upload" scope` → token foi gerado sem escopo `upload` ou app ainda não tem upload access aprovado.
- Plano/quota Vimeo sem permissão para upload ou limite de armazenamento atingido.
- Dominios de embed nao aplicados corretamente (`VIMEO_EMBED_DOMAINS` invalido).
- `VIMEO_MAX_UPLOAD_BYTES` abaixo do arquivo enviado.
- Upload TUS interrompido por rede do cliente.

**Ação imediata**:
1. Validar token Vimeo e refazer `supabase secrets set`.
   ```bash
   supabase secrets set \
     VIMEO_ACCESS_TOKEN=<NOVO_TOKEN_COM_UPLOAD> \
     VIMEO_EMBED_DOMAINS='["www.mercuriocapitalsa.com.br","mercuriocapitalsa.com.br","mercurio-digital-alpha.vercel.app"]' \
     --project-ref bhagksfvszeogtjvjtpx
   ```
2. Reexecutar teste de integração `vimeo` no painel admin.
3. Se o health retornar `vimeo_upload_create 401/403`, recriar o token com escopos de upload/criação. Se retornar quota/plano, ajustar plano ou liberar espaço no Vimeo.
  - Pela documentação Vimeo, upload TUS via `POST /me/videos` requer upload access no app e token com escopos `upload` e `edit`.
  - Para o health avançado remover o vídeo de teste, inclua também escopo de delete/remover vídeo quando disponível no painel.
4. Repetir upload por arquivo menor para isolar falha de rede/tamanho.
5. Confirmar que `vimeo_id` foi preenchido e salvar a aula novamente.

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

---

## 14. Incidente: credencial comprometida em documentação

**Gatilho**:
- Token, API key, secret ou credencial real identificado em arquivo de documentação, comentário de PR, issue ou snippet público.

**Resposta imediata (curta)**:
1. Revogar a credencial no provedor de origem (Meta, Supabase, Stripe, Vimeo, Resend etc.).
2. Gerar nova credencial com escopo mínimo necessário.
3. Atualizar secrets de runtime (Supabase/Vercel/GitHub Actions) com o novo valor.
4. Reimplantar somente funções/serviços que dependem da credencial alterada.
5. Sanitizar documentação: substituir valor real por placeholder explícito.
6. Registrar incidente com horário da exposição, escopo e responsável pela rotação.

**Comandos operacionais recomendados (rotação WhatsApp)**:
```bash
# 1) Atualizar segredo no Supabase
supabase secrets set WHATSAPP_ACCESS_TOKEN=<NOVO_TOKEN> --project-ref bhagksfvszeogtjvjtpx

# 2) Reimplantar função afetada
supabase functions deploy whatsapp-webhook --project-ref bhagksfvszeogtjvjtpx

# 3) Verificar logs pós-rotação
supabase functions logs whatsapp-webhook --project-ref bhagksfvszeogtjvjtpx --tail
```

**Checklist preventivo para documentação**:
- [ ] Nunca registrar tokens/chaves completos em docs (usar `<PLACEHOLDER>`).
- [ ] Não publicar IDs reais de produção quando não forem estritamente necessários.
- [ ] Antes de merge, rodar varredura rápida em docs: `rg -n "(EAA[[:alnum:]_\-]+|sk_live_|xoxb-|AKIA|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|WHATSAPP_ACCESS_TOKEN=)" docs`.
- [ ] Garantir que `.env` local não seja referenciado em documentação com valores reais.
- [ ] Em caso de exposição, rotacionar primeiro e só depois discutir limpeza de histórico Git.

**Validação de recuperação**:
- Fluxo afetado volta a operar com o novo segredo (sem 401/403 do provedor).
- Não há credencial real remanescente nos docs alterados.

---

## 15. Pre-flight Apple para release desktop macOS

**Gatilho**:
- Antes de criar tag `v*.*.*` para release desktop.

**Fonte primaria**:
- `docs/operacao/desktop-release-macos-signing.md`.

**Checklist P0**:
- [ ] `APPLE_SIGNING_CERT_BASE64` decodifica para `.p12` valido.
- [ ] `APPLE_SIGNING_CERT_PASSWORD` abre o `.p12` sem erro.
- [ ] `APPLE_ID` autentica com `APPLE_APP_SPECIFIC_PASSWORD`.
- [ ] `APPLE_TEAM_ID` corresponde ao Team de producao do app.
- [ ] Workflow `Desktop Release` passa no mac (`Validate mac signing secrets`, `Build desktop artifacts (mac signed + notarized)`, `Verify mac signature and notarization`).
- [ ] Verificacao de app bundle no mac segue hard-fail (`codesign verify`, `spctl execute`, `stapler validate`).
- [ ] Verificacao de DMG no mac segue hard-fail deterministico (`codesign`, `notarytool submit --wait`, `stapler staple`, `stapler validate`, `spctl open`) sem bypass por warning.
- [ ] Qualquer falha critica no job mac bloqueia `Publish GitHub Release` (dependencia em `build-desktop` verde).

**Validacao local (Mac de confianca)**:
```bash
tmp_p12="$(mktemp /tmp/apple-signing.XXXXXX.p12)"
printf '%s' "$APPLE_SIGNING_CERT_BASE64" | base64 -D > "$tmp_p12"
if ! openssl pkcs12 -in "$tmp_p12" -passin env:APPLE_SIGNING_CERT_PASSWORD -nokeys -clcerts -info -noout; then
  openssl pkcs12 -legacy -in "$tmp_p12" -passin env:APPLE_SIGNING_CERT_PASSWORD -nokeys -clcerts -info -noout
fi
rm -f "$tmp_p12"

xcrun notarytool store-credentials "mc-preflight" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --validate
```

**Governanca minima**:
1. Segredos Apple somente em GitHub Actions Secrets (nunca em codigo).
2. Permissao de editar secrets restrita a poucos owners.
3. Registrar responsavel e data de rotacao.

**Registro de rotacao (preencher a cada troca)**:

| Item | Responsavel | Ultima rotacao | Proxima rotacao | Observacoes |
| --- | --- | --- | --- | --- |
| APPLE_SIGNING_CERT_BASE64 + APPLE_SIGNING_CERT_PASSWORD | _definir_ | _aaaa-mm-dd_ | _aaaa-mm-dd_ | _anual ou incidente_ |
| APPLE_APP_SPECIFIC_PASSWORD | _definir_ | _aaaa-mm-dd_ | _aaaa-mm-dd_ | _rotacao imediata em revogacao_ |

---

## 16. Governança de release desktop/mobile (go/no-go, rollback e pós-release)

**Gatilho**:
- Antes de publicar release desktop (tag `v*.*.*`) e antes de promover build mobile para distribuição externa.

**Fontes primárias**:
- `docs/operacao/desktop-release-macos-signing.md`
- `docs/operacao/runbooks.md` (esta seção)
- `mobile/README.md`

**Estado consolidado (2026-07-08)**:
- Desktop: gate macOS hard-fail ativo para assinatura/notarização (app + DMG) e bloqueio de publish em falha crítica.
- Mobile iOS: fluxo operacional para `0.0.2` com build via EAS concluída e envio para TestFlight via Apple Transporter.
- Windows: assinatura de binários (EV/SmartScreen) ainda **não entregue**; tratar como pendência futura de governança.

### 16.1 Go/No-Go Desktop

**Go** somente se:
- [ ] Checklist P0 da seção 15 concluído sem exceções.
- [ ] Jobs macOS de signing/notarização em verde e sem bypass de validação.
- [ ] Evidências de release anexadas (run da Action + logs sem segredo + artefatos).
- [ ] Release notes deixam explícito o escopo de assinatura por plataforma.

**No-Go** se qualquer condição abaixo ocorrer:
- [ ] Falha em `codesign`, `notarytool`, `stapler` ou `spctl` no macOS.
- [ ] Inconsistência de Team ID/certificado Apple.
- [ ] Tentativa de comunicar assinatura Windows como concluída (status atual: pendente).

### 16.2 Go/No-Go Mobile iOS

**Go** somente se:
- [ ] `npm run typecheck` sem erro no `mobile/`.
- [ ] `npx expo config --type public` válido para versão alvo.
- [ ] `npx eas build -p ios --profile production` com status `FINISHED`.
- [ ] Envio para TestFlight concluído por um dos caminhos aprovados:
  - `npx eas submit -p ios --profile production --latest` com submissão agendada; ou
  - upload via Apple Transporter com build visível no App Store Connect/TestFlight.

**No-Go** se:
- [ ] Build iOS falhar (EAS status diferente de `FINISHED`).
- [ ] Envio para TestFlight falhar (EAS Submit ou Transporter) por credencial, validação ou bloqueio no App Store Connect.

### 16.3 Rollback Desktop

1. Se a falha ocorrer antes do publish, manter `no-go` e corrigir credenciais/assinatura antes de nova tag.
2. Se já houver release publicada com artefato inválido, despublicar os assets afetados e republicar somente após novo run verde.
3. Registrar incidente com causa raiz e timestamp no changelog operacional.

### 16.4 Rollback Mobile iOS/TestFlight

1. Não promover build com erro para grupos externos.
2. Expirar/remover o build de teste no App Store Connect quando necessário.
3. Gerar novo build number (`autoIncrement`) e refazer build+submit com correção.

### 16.5 Pós-release (D0 a D7)

1. Validar download/instalação dos artefatos desktop publicados.
2. Monitorar logs de Edge Functions e erros críticos no app web/mobile (Sentry/PostHog).
3. Revisar feedback inicial de parceiros/admin sobre onboarding, propostas e notificações.
4. Registrar resultado de go-live e pendências em documento de operação da sprint.

### 16.6 Pendências futuras de governança

- Plano de assinatura Windows (EV certificate + reputação SmartScreen + política de rotação) permanece no backlog operacional.
- Não tratar assinatura Windows como critério entregue até checklist dedicado existir e ser executado em CI.

### 16.7 Registro operacional — Desktop 0.0.4

**Escopo técnico esperado**:
- Bootstrap desktop em `/p/login` no app empacotado.
- `/login` mantido apenas como alias com redirect para `/p/login`.
- Widget de atualização com hide/show, reabertura manual persistente e autoexibição em estado crítico (`downloaded`, `installing`, `error`).
- Versão de artefatos alinhada à tag semver (`v0.0.4`) antes do pack.

**Go/No-Go 0.0.4**:
- [ ] `build-desktop` verde nas três plataformas (mac, windows, linux).
- [ ] Jobs de assinatura/notarização macOS verdes sem bypass.
- [ ] `publish-release` executado somente após `build-desktop` verde.
- [ ] Artefatos publicados com nome `0.0.4` (`.dmg`, `.exe`, `.AppImage`, `.deb`, `stable*.yml`, `sha256sums.txt`).

**Evidências obrigatórias (anexar no registro da release)**:
- URL da run GitHub Actions `Desktop Release` para a tag `v0.0.4`.
- Trechos de log dos passos `Validate mac signing secrets`, `Build desktop artifacts (mac signed + notarized)` e `Verify mac signature and notarization` (sem segredos).
- Lista dos assets finais publicados e checksums.

**Rollback específico 0.0.4**:
1. Se falhar antes do publish: manter no-go, corrigir e reexecutar com nova tag semver.
2. Se publicar artefato inconsistente: remover assets afetados da release e republicar somente após run verde.
3. Registrar ocorrência e mitigação aplicada no changelog operacional da sprint.

---

## 17. Provisionamento do perfil Admin Jurídico

**Gatilho**:
- Novo usuário interno jurídico precisa acesso administrativo com escopo de escrita restrito.

**Conta padrão deste ciclo**:
- e-mail: `juridico@mercuriocapitalsa.com.br`
- role: `admin`
- admin_nivel: `juridico`

**Passos (SQL transacional orientado a operação)**:
```sql
begin;

-- 1) Confirmar espelho em public.usuarios
select id, email, role from public.usuarios where lower(email) = 'juridico@mercuriocapitalsa.com.br';

-- 2) Garantir role admin no espelho
update public.usuarios
   set role = 'admin', ativo = true
 where lower(email) = 'juridico@mercuriocapitalsa.com.br';

-- 3) Garantir claim admin no Auth e nivel juridico
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('role', 'admin', 'admin_nivel', 'juridico')
 where lower(email) = 'juridico@mercuriocapitalsa.com.br';

commit;
```

**Quando precisar criar a conta no Auth**:
- Usar Supabase Dashboard (`Authentication > Users > Invite user`) com o e-mail acima.
- Definir senha inicial temporária e exigir troca imediata no primeiro acesso.
- Após criação, executar o bloco SQL acima para assegurar claims e espelho consistentes.

**Validação**:
```sql
select id, email, raw_app_meta_data ->> 'role' as role_claim,
       raw_app_meta_data ->> 'admin_nivel' as admin_nivel_claim
  from auth.users
 where lower(email) = 'juridico@mercuriocapitalsa.com.br';

select id, email, role, ativo
  from public.usuarios
 where lower(email) = 'juridico@mercuriocapitalsa.com.br';
```

Esperado:
- `role_claim = 'admin'`
- `admin_nivel_claim = 'juridico'`
- `public.usuarios.role = 'admin'`

**Teste funcional mínimo**:
1. Login web/mobile com a conta jurídica.
2. Em proposta aprovada, aba Contrato permite upload de modelo.
3. Ações operacionais (status, fundos, registro, liberação, remoção de modelo) retornam bloqueio.
4. Executar `supabase/smoke-tests/fase-25-admin-juridico.sql`.

**Pós-provisionamento**:
1. Forçar novo login para refresh de JWT/claims.
2. Registrar no changelog operacional: responsável, data/hora e evidências de validação.

## Runbook — Wizard Nova Proposta / Validação CPF-CNPJ (2026-07-22)

**Deploy**:
1. `supabase db push` aplica `20260722000008` e `20260722000009` (aditivas).
2. `supabase functions deploy documento-validar` e configurar `INVERTEXTO_TOKEN`.
3. Validar com `supabase/smoke-tests/fase-26-wizard-proposta.sql`.

**Troubleshooting**:
- Botão Validar falha com `invertexto_nao_configurado`: `INVERTEXTO_TOKEN` ausente.
- Criação bloqueada com `conjuge_obrigatorio` / `pj_campos_obrigatorios` / `limite_50_excedido`: regras de negócio funcionando (não é bug).
