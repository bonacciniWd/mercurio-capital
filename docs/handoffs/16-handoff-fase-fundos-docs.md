# Handoff — Fase Fundos & Documentos (Admin limitado/jurídico, Fundos, Checklist, Modelo de contrato)

> Documento de transferência cobrindo as Fases 1–5 deste ciclo (papel "admin limitado" + hardening, fundos por proposta, checklist real de documentos, modelo de contrato por proposta e paridade mobile). Continua o estado após a Fase 10 ([15-handoff-fase10.md](15-handoff-fase10.md)).
> **Data:** 2026-07-22 · **Branch:** `main` · **Escopo:** WEB + MOBILE + DB.

---

## 1. Resumo por fase

| Fase | Tema | Entrega |
|------|------|---------|
| 1 | Papel **admin limitado** + hardening | `app_admin_nivel()`, `app_is_admin_full()`, `admin_set_admin_nivel`; guard das RPCs sensíveis; guard de rota + nav filtrada |
| 2 | **Fundos** por proposta (admin) | enum `fundo_status`, tabelas `fundos`/`proposta_fundos`, RPCs, badges/filtro no Kanban e card no detalhe |
| 3 | **Checklist real** de documentos | expansão `documento_tipo`, `documento_requisitos`, `proposta_documentos.status`, `proposta_documentos_seed`, UI cliente/admin |
| 4 | **Modelo de contrato** + gate | `proposta_contrato_modelos`, RPCs, `isPropostaAprovada`, bloco na aba Contrato |
| 5 | **Paridade mobile** (Expo) | documentos, contrato (gate + modelos) e fundos (admin) |
| 6 | **Perfil admin jurídico** (upload-only) | `admin_nivel='juridico'`, hardening operacional (`app_is_admin_operacional`) e upload exclusivo de modelo |

---

## 2. Migrations

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/20260718000001_admin_nivel.sql` | `app_admin_nivel()`, `app_is_admin_full()`, `admin_set_admin_nivel(p_user_id, p_nivel)` (guard `app_is_admin_full()`, grava em `auth.users.raw_app_meta_data`, audita) |
| `supabase/migrations/20260718000002_admin_nivel_hardening.sql` | Troca de guard `app_is_admin()` → `app_is_admin_full()` nas RPCs sensíveis + policies `admin_full_config`/`admin_full_flags`/`admin_full_campanhas` |
| `supabase/migrations/20260722000001_fundos.sql` | enum `fundo_status`; tabelas `fundos` e `proposta_fundos`; RLS admin-only; triggers `set_updated_at` |
| `supabase/migrations/20260722000002_fundos_rpcs.sql` | `admin_fundo_upsert`, `admin_fundo_toggle_ativo`, `admin_proposta_fundo_set`, `admin_proposta_fundo_remove` |
| `supabase/migrations/20260722000003_documento_tipo_expand.sql` | **ISOLADA** — `ALTER TYPE documento_tipo ADD VALUE IF NOT EXISTS` (8 novos tipos) |
| `supabase/migrations/20260722000004_documentos_checklist.sql` | `proposta_documentos.status` + `storage_path` nullable + backfill; `documento_requisitos` + seed; `fn_sync_documento_status`; `proposta_documentos_seed`; trigger `fn_seed_docs_on_proponente` |
| `supabase/migrations/20260722000005_proposta_contrato_modelos.sql` | tabela `proposta_contrato_modelos`; RLS admin `all` + parceiro dono/cliente `select`; `proposta_contrato_modelo_add`, `proposta_contrato_modelo_remove` |
| `supabase/migrations/20260722000007_admin_juridico_hardening.sql` | `admin_nivel` com `juridico`; helpers `app_is_admin_operacional`/`app_is_admin_juridico`; hardening de escrita operacional + upload-only de modelo |

> A migration `20260722000003` é **isolada** por exigência do PostgreSQL: um valor de enum recém-adicionado não pode ser usado na mesma transação. Os novos valores são consumidos apenas em `20260722000004` (arquivo/transação seguinte).

---

## 3. RPCs (todas `security definer`, auditadas)

**Admin nível:** `admin_set_admin_nivel(uuid, text)` — guard `app_is_admin_full()`.

**Fundos** (guard `app_is_admin_operacional()`):
- `admin_fundo_upsert(p_id, p_nome, p_cor)` — valida cor `^#[0-9A-Fa-f]{6}$`; trata `unique_violation`.
- `admin_fundo_toggle_ativo(p_id, p_ativo)`.
- `admin_proposta_fundo_set(p_proposta_id, p_fundo_id, p_status, p_obs)` — upsert por `(proposta_id, fundo_id)`.
- `admin_proposta_fundo_remove(p_proposta_id, p_fundo_id)`.

**Documentos:** `proposta_documentos_seed(p_proposta_id)` — guard por ownership (admin/parceiro-dono/equipe/cliente), no-op se não autorizado; idempotente.

**Modelo de contrato:**
- `proposta_contrato_modelo_add(p_proposta_id, p_storage_path, p_nome_arquivo)` — guard `app_is_admin_operacional() OR app_is_admin_juridico()`, valida path `{proposta_id}/…`.
- `proposta_contrato_modelo_remove(p_id)` — apenas admin operacional; retorna `storage_path` para limpeza do bucket.

---

## 4. RLS

- `fundos` e `proposta_fundos`: escrita em `app_is_admin_operacional()`; leitura para admin preservada.
- `documento_requisitos`: `all` admin + `select` para qualquer autenticado (catálogo público).
- `proposta_documentos`: policies existentes preservadas; placeholders são inseridos pela RPC `security definer`. Coluna `status` sincronizada por trigger.
- `proposta_contrato_modelos`: escrita direta em `app_is_admin_operacional()`; leitura para admin preservada; parceiro/cliente seguem com `select` por ownership.
- Buckets reusados: `proposta-docs` (checklist) e `contratos` (modelos, path `{proposta_id}/modelos/`).

---

## 5. Front-end

**Web (`app/`):**
- Admin limitado: `app/src/lib/adminScope.ts`, `app/src/guards/RequireAdminScope.tsx`, `app/src/router.tsx`, `app/src/layouts/AdminLayout.tsx`, `app/src/auth/{types.ts,authClient.ts}`.
- Fundos: `app/src/lib/fundoStatus.ts`, `app/src/components/PropostaFundos.tsx`, `app/src/components/PropostasKanban.tsx`, `app/src/pages/admin/PropostaDetalhe.tsx`.
- Documentos: `app/src/lib/documentos.ts`, `app/src/components/PropostaDocsUploader.tsx`, `app/src/pages/client/{Documentos.tsx,Home.tsx}`, `app/src/pages/admin/PropostaDetalhe.tsx`.
- Contrato: `app/src/lib/propostaStatus.ts` (`isPropostaAprovada`), `app/src/components/PropostaContrato.tsx`.

**Mobile (`mobile/`):**
- Libs portadas: `mobile/lib/{documentos.ts,fundoStatus.ts,propostaStatus.ts}`.
- Cliente: `mobile/app/(cliente)/documentos.tsx`, `mobile/app/(cliente)/index.tsx`, `mobile/app/(cliente)/propostas/[id].tsx`.
- Admin: `mobile/app/(admin)/proposta/[id].tsx` (fundos + modelo), `mobile/app/(admin)/kanban.tsx` (badges de fundos).
- Parceiro: `mobile/app/(parceiro)/propostas/[id].tsx` (download de modelo, gate).

---

## 6. Smoke tests (transacionais, reversíveis)

| Arquivo | Cobre |
|---|---|
| `supabase/smoke-tests/fase-21-admin-nivel.sql` | 2 JWTs admin (full/limitado); RPC sensível barra limitado; `admin_set_proposta_status` permite ambos |
| `supabase/smoke-tests/fase-22-fundos.sql` | criar → atribuir → trocar status; nega SELECT partner/client; nega RPC partner |
| `supabase/smoke-tests/fase-23-documentos-checklist.sql` | proposta PF → seed → PF+Imóvel; PJ → PJ+Imóvel; seed idempotente |
| `supabase/smoke-tests/fase-24-contrato-modelos.sql` | admin adiciona; partner/cliente leem; partner não escreve (RLS + RPC) |
| `supabase/smoke-tests/fase-25-admin-juridico.sql` | helpers (`operacional` vs `juridico`), upload-only de modelo, bloqueio de escritas operacionais |

Execução: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <arquivo>`.

---

## 7. Validação

- Web: `cd app && npm run lint && npm run typecheck && CI=1 npm run test && npm run build`.
	- Resultado: typecheck/test/build verdes (`49/49`).
	- Lint: sem erros bloqueantes (warnings conhecidos legados, sem regressão funcional deste ciclo).
- Mobile: `cd mobile && npm run typecheck` — verde.

### 7.1 Checklist visual final por perfil

| Plataforma | Perfil | Checklist | Status |
|---|---|---|---|
| Web | Admin full | Admin (Dashboard/Kanban/Detalhe) com Fundos, Checklist de documentos e Modelos de contrato | ✅ |
| Web | Admin limitado | Guard de escopo ativo (`RequireAdminScope`) + navegação filtrada no `AdminLayout` | ✅ |
| Web | Admin jurídico | Aba Contrato com upload de modelo; ações operacionais ocultas/bloqueadas | ✅ |
| Web | Parceiro | Detalhe da proposta com leitura de modelos de contrato; sem acesso a Fundos | ✅ |
| Web | Cliente | `/c/documentos` real (sem mock), pendências obrigatórias na Home e visualização de contrato gated | ✅ |
| Mobile | Admin | Kanban com badges de fundos + detalhe com troca de status de fundo e gestão de modelos | ✅ |
| Mobile | Admin jurídico | Detalhe com upload de modelo; sem status/fundos/registro/liberação/remoção de modelo | ✅ |
| Mobile | Parceiro | Detalhe com acesso de leitura/download de modelos de contrato | ✅ |
| Mobile | Cliente | Documentos reais, pendências na Home e detalhe da proposta com bloco de contrato | ✅ |

## 8. Próximos passos

1. Aplicar migrations: `supabase db push --linked --include-all`.
2. Rodar os 5 smoke tests contra `bhagksfvszeogtjvjtpx`.
3. Promover um admin de teste: `select public.admin_set_admin_nivel('<uuid>', 'juridico');` (exige admin full) e refazer login para o JWT trazer o claim.
4. Provisionar `juridico@mercuriocapitalsa.com.br` conforme runbook operacional §17.

## 9. Encerramento operacional do ciclo

- Commit de reconciliação/smoke publicado no remoto: `4de0527` (via merge de sincronização `b3f3366`, após avanço de `origin/main`).
- Banco remoto alinhado com as migrations das Fases 1–5 e smoke tests oficiais Fase 21/22/23/24 em PASS.
- Web e Mobile com validações finais executadas e checklist por perfil concluído.
- Ciclo registrado como **encerrado** para release desta frente (Fundos + Documentos + Contrato + Admin nível).
