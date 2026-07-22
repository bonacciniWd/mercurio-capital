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
  - `admin_nivel` (`full` | `limitado`, default `full` quando ausente) distingue admin pleno de admin limitado. Alterado apenas por admin full via RPC `admin_set_admin_nivel` (grava em `auth.users.raw_app_meta_data`).
- Sessão idle timeout: 30 min para `admin`, 8h para outros.

## 3. Autorização

- **Frontend**: route guards (`RequireAuth`, `RequireRole`, `RequireApproved`, `Require2FA`, `RequireAdminScope`).
- **Banco (RLS)**: policies por tabela (ver §02 e §04).
- **Edge Functions**: validação de JWT + claim antes de qualquer chamada externa.
- **Service role key**: nunca usado no frontend; apenas dentro de Edge.

### 3.1 Hardening admin limitado (`app_is_admin_full()`)

Helpers: `app_admin_nivel()` e `app_is_admin_full()` (= `app_is_admin() AND admin_nivel='full'`). Migrations `20260718000001_admin_nivel.sql` (helpers + `admin_set_admin_nivel`) e `20260718000002_admin_nivel_hardening.sql` (troca de guard).

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

**Não alteradas** (seguem em `app_is_admin()`, disponíveis ao admin limitado): aprovações de parceiro, `admin_set_proposta_status`, rede, dashboards, kanban, detalhe de proposta e as RPCs de **fundos**.

Smoke test: `supabase/smoke-tests/fase-21-admin-nivel.sql` (2 JWTs admin — full vs limitado — cobrindo 1 RPC sensível barrada para limitado e `admin_set_proposta_status` permitida para ambos).

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
