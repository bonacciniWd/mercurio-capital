# 08 — Segurança, Storage & Compliance

## 1. Princípios

1. **Defense in depth**: RLS no banco + guards no front + checagens em Edge Functions.
2. **Menor privilégio**: cada chave/role tem o mínimo necessário.
3. **Segredo nunca no client**: chaves de Evolution, Bacen, Serasa, Jusbrasil ficam **somente** em variáveis de ambiente das Edge Functions.
4. **Auditoria total**: tudo que altera dado sensível registra em `audit_log`.
5. **Privacidade por default**: bucket público apenas para conteúdo realmente público (capas de cursos, avatares).

## 2. Autenticação

- Supabase Auth com:
  - E-mail/senha (com validador de força).
  - Magic link customizado (Edge) — preferencial para clientes.
  - 2FA TOTP obrigatório para `admin` e `partner` aprovados.
- JWT inclui claims customizados em `app_metadata`: `role`, `partner_id`, `equipe_id`, `approved`, `subscription_active`, `admin_nivel`.
  - `admin_nivel` (`full` | `limitado` | `juridico`, default `full` quando ausente) distingue admin pleno de perfis de escopo reduzido. Alterado apenas por admin full via RPC `admin_set_admin_nivel` (grava em `auth.users.raw_app_meta_data`).
- Sessão idle timeout: 30 min para `admin`, 8h para outros.

## 3. Autorização

- **Frontend**: route guards (`RequireAuth`, `RequireRole`, `RequireApproved`, `Require2FA`, `RequireAdminScope`).
- **Banco (RLS)**: policies por tabela (ver §02 e §04).
- **Edge Functions**: validação de JWT + claim antes de qualquer chamada externa.
- **Service role key**: nunca usado no frontend; apenas dentro de Edge.

### 3.1 Hardening admin de escopo reduzido (`limitado` + `juridico`)

Helpers:
- `app_admin_nivel()`
- `app_is_admin_full()` (= `app_is_admin() AND admin_nivel='full'`)
- `app_is_admin_operacional()` (= `app_is_admin() AND admin_nivel in ('full','limitado')`)
- `app_is_admin_juridico()` (= `app_is_admin() AND admin_nivel='juridico'`)

Migrations:
- `20260718000001_admin_nivel.sql` (base de `admin_nivel`)
- `20260718000002_admin_nivel_hardening.sql` (RPCs sensíveis em `app_is_admin_full()`)
- `20260722000007_admin_juridico_hardening.sql` (split operacional x juridico + upload-only de modelo)

RPCs sensíveis (fora do escopo do admin limitado) tiveram o guard `app_is_admin()` → `app_is_admin_full()`:

- Carteiras: `admin_wallet_ajuste`, `admin_wallet_set_bloqueio`.
- Preços: `admin_precos_upsert`.
- Feature flags: `admin_feature_flag_upsert`, `admin_feature_flag_delete`.
- LGPD: `lgpd_anonimizar_conta`.
- Integrações/WhatsApp: `admin_integracao_toggle`, `admin_integracao_config_set`.
- Fluxos: `admin_fluxo_upsert`, `admin_fluxo_delete`, `admin_fluxo_executar`.
- Campanhas: `admin_campanha_upsert`, `admin_campanha_cancelar`, `admin_campanha_disparar`.
- Templates de e-mail/WhatsApp: `admin_template_upsert`, `admin_template_delete`, `admin_email_template_test_enqueue`.
- Policies de escrita direta: `admin_full_config` (`configuracoes_sistema`), `admin_full_flags` (`feature_flags`), `admin_full_campanhas` (`campanhas`).

**Escopo operacional** (`app_is_admin_operacional()`): escritas de status, validação documental, fundos, contrato/registro/liberação/comissão e demais mutações do funil.

**Escopo jurídico** (`app_is_admin_juridico()`): somente `proposta_contrato_modelo_add` (upload de modelo). Remoção de modelo (`proposta_contrato_modelo_remove`) exige escopo operacional.

**Não alteradas para leitura**: admin jurídico mantém leitura administrativa no funil/kanban/detalhe; bloqueios de escrita são aplicados em guards de RPC + RLS de escrita.

Smoke tests:
- `supabase/smoke-tests/fase-21-admin-nivel.sql` (full vs limitado para hardening legado).
- `supabase/smoke-tests/fase-25-admin-juridico.sql` (operacional vs juridico, com upload-only de modelo).

## 4. Storage — políticas por bucket

| Bucket | Tipo | Política de leitura | Política de escrita |
|---|---|---|---|
| `partner-docs` | privado | dono (`partners.usuario_id = auth.uid()`) ou admin | dono ou admin |
| `proposta-docs` | privado | admin OU partner dono OU cliente vinculado | mesmas regras |
| `contratos` | privado | admin OU partes do contrato | admin |
| `cursos-videos` | privado | inscritos (existe `inscricoes` ativa) ou assinante | admin |
| `cursos-capas` | público | qualquer | admin |
| `certificados` | privado | dono ou admin | edge function |
| `protocolo-uploads` | privado | admin (não há leitura pública) | edge function via signed URL curta |
| `avatares` | público | qualquer | dono |

Todos os buckets privados: leitura apenas via `signedUrl` com TTL ≤ 5 min, geradas após verificação RLS.

## 5. Cálculos de risco / dados sensíveis

- **PII** (CPF, CNPJ, RG, endereço, telefone): nunca em logs em texto puro. Mascarar em `logs_consultas.request_payload` (ex: `123.***.***-09`).
- **Documentos**: armazenados criptografados em repouso (Supabase já criptografa em S3). Acesso sempre via signed URL.
- **Backups**: PITR Supabase habilitado.
- **Retenção**: documentos de propostas canceladas — 5 anos (LGPD legítimo interesse fiscal/regulatório). Logs de consulta — 1 ano.

## 6. LGPD — Conformidade mínima

- **Consentimento**: checkbox no registro/wizard com link para política.
- **Direito de acesso**: usuário pode exportar seus dados em `/c/perfil` ou `/p/perfil` (gera JSON via edge `lgpd/export`).
- **Direito de exclusão**: anonimização de PII mantendo dados estatísticos. Edge `lgpd/anonimizar`.
- **DPO** (e-mail de contato) na landing.
- **Bases legais documentadas** por finalidade (originação, marketing, educacional).

## 7. Rate limiting & abuso

| Endpoint | Limite |
|---|---|
| `/login` | 5 / 15 min / IP |
| `/registro` | 3 / hora / IP |
| `/recuperar-senha` | 3 / hora / e-mail |
| `/protocolo/consulta` | 10 / min / IP + CAPTCHA |
| `/protocolo/upload-url` | 5 / hora / protocolo |
| `magic-link/issue` | 5 / 24h / destinatário |
| Consultas Bacen/Serasa | cota por parceiro/dia configurável |

Implementação: tabela `rate_limits (chave, contagem, janela_inicio)` + função `check_and_increment`.

## 8. CSP e headers HTTP

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.evolutionapi.com;
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(self), microphone=()
```

## 9. Logs & monitoramento

- **Sentry** no front e edges (PII scrubbing ativo).
- **Supabase logs** retidos 30 dias.
- **PostHog/Mixpanel**: eventos de produto, sem PII.
- **Alertas**: erros 5xx > 1% em 5 min, latência p95 > 1s, falhas de Evolution > 3%.

## 10. OWASP Top 10 — checklist alvo

- [x] A01 — Acesso quebrado: RLS + guards + testes.
- [x] A02 — Cripto: TLS, hashes para tokens, sem segredo no client.
- [x] A03 — Injeção: parâmetros via Postgres functions, validação Zod.
- [x] A04 — Design inseguro: protocolo público sem PII, magic link single-use.
- [x] A05 — Misconfig: CSP, headers, RLS forçada por default.
- [x] A06 — Componentes vulneráveis: Renovate/Dependabot.
- [x] A07 — Auth quebrada: 2FA, lockout, hash bcrypt (Supabase).
- [x] A08 — Integridade: assinaturas dos webhooks (HMAC).
- [x] A09 — Logging: Sentry + audit_log.
- [x] A10 — SSRF: edge bloqueia hosts externos não whitelisted.

## 11. Ambientes

- `local` — Supabase CLI + dotenv.
- `staging` — projeto Supabase separado, dados sintéticos.
- `production` — projeto Supabase isolado, acesso restrito.
- Migrações via `supabase db push` versionadas em git, deploy automatizado.

## Validação CPF/CNPJ e PII (2026-07-22)

- A validação CPF/CNPJ (Invertexto) ocorre **exclusivamente** via Edge Function `documento-validar` com token server-side; o frontend nunca recebe segredos.
- Logs mascaram PII (documento) conforme LGPD; nenhum dado sensível é registrado em claro.
- Novos campos de renda/endereço/PJ herdam as políticas RLS existentes de `clientes`/`proponentes`/`imoveis` (admin operacional para escrita; leitura por dono/admin).
- Regra dos 50% validada no frontend e no backend (`proposta_payload_validar`), impedindo gravação inválida mesmo com bypass de UI.
