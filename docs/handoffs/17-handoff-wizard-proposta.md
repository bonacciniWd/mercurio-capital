# Handoff — Evolução Wizard Nova Proposta (Step 2/3/7 + validação CPF/CNPJ Invertexto)

Data: 2026-07-22 · **Fechado na Release 0.1.0 (2026-07-23)**

## Escopo entregue

Evolução ponta a ponta do Wizard de Nova Proposta, com CPF via Edge Function, schema aditivo, RPCs evoluídas, paridade web/mobile, detalhe de proposta e documentação.

## Arquivos alterados por domínio

### Backend (Supabase)
- `supabase/functions/documento-validar/index.ts` (novo) — validação CPF/CNPJ via Invertexto server-side.
- `supabase/functions/cnpj-consultar/index.ts` (novo) — consulta cadastral de CNPJ (autofill) via Invertexto.
- `supabase/config.toml` — registros `[functions.documento-validar]` e `[functions.cnpj-consultar]` (verify_jwt = true).
- `supabase/migrations/20260722000008_wizard_proposta_evolucao_schema.sql` (novo) — enum `modelo_renda_tipo`; colunas aditivas em `clientes`/`proponentes`/`imoveis`/`propostas`; função `proposta_payload_validar`.
- `supabase/migrations/20260722000009_wizard_proposta_evolucao_rpcs.sql` (novo) — `partner_create_proposta` e `admin_create_proposta` reescritas (validação + persistência + enqueue e-mail + taxa 1.29 + magic link 30min).
- `supabase/smoke-tests/fase-26-wizard-proposta.sql` (novo).

### Web (app/)
- `app/src/lib/documentoBr.ts` (novo) — máscara/validação CPF/CNPJ + `validarDocumento` (Invertexto).
- `app/src/pages/partner/Wizard.tsx` — fluxo reindexado para 6 passos (Produto, Cliente, Imóveis, Valores, Proponentes, Revisão). Passo 3 consolida cadastro completo do imóvel + valor da garantia (antigo passo 6 removido). Passo 6 (Revisão) com accordion totalmente editável por seção (substitui a edição rápida de valores). Mantém CPF/CNPJ-first, validação/consulta, renda, endereço, PJ, mapa e regra 50%.
- `app/src/pages/admin/PropostaDetalhe.tsx` — exibe renda/endereço/PJ, flag 50%, renda por proponente, imóvel principal.
- `app/src/pages/partner/PropostaDetalhe.tsx` — exibe novos campos do cliente.

### Mobile (mobile/)
- `mobile/app/propostas/nova.tsx` — CPF/CNPJ-first, PF/PJ completo, renda, endereço, cônjuge, regra 50%, sucesso com consultas recomendadas.
- `mobile/app/(admin)/proposta/[id].tsx` — exibe novos campos do cliente.

### Documentação
- `docs/blueprint/04-database-schema.md`, `06-modules-features.md`, `03-routes-navigation.md`, `07-integrations-flows.md`, `08-security-compliance.md`
- `docs/operacao/integracoes-pendentes.md`, `runbooks.md`

## Testes executados
- Migrations `20260722000008` e `20260722000009` aplicadas no remoto via `supabase db push`.
- Smoke `fase-26-wizard-proposta.sql`: PASS (cônjuge PF, PJ total, regra 50% bloqueio, criação feliz persistindo novos campos).
- Typecheck web (`tsc -b`) e mobile (`tsc`): verde.
- ESLint Wizard/documentoBr: 0 erros.

## Impacto em detalhes/listagens/kanban
- Detalhe de proposta (admin/partner web + admin mobile): novos campos de cliente (renda/endereço/PJ), flag 50%, renda por proponente e imóvel principal.
- Listagens e Kanban: sem alteração de contrato (colunas novas são aditivas e nullable); propostas legadas permanecem válidas.

## Conflito resolvido (decisão oficial)
`admin_create_proposta` aceita parceiro `approved` **ou** `pending` (bloqueia `rejected`/`suspended`). `partner_create_proposta` permanece restrita ao próprio parceiro aprovado. Registrado no cabeçalho de `20260722000009` e em `06-modules-features.md`.

## Ajuste — composição de renda por co-proponente (2026-07-22)

- Migration `20260722000010_proponente_compoe_renda.sql`: coluna `proponentes.compoe_renda` + regra em `proposta_payload_validar` (co-proponente deve responder Sim/Não; se Sim, renda obrigatória). RPCs `partner_create_proposta`/`admin_create_proposta` persistem a flag.
- Web ([Wizard.tsx](../../app/src/pages/partner/Wizard.tsx)) e mobile ([nova.tsx](../../mobile/app/propostas/nova.tsx)): pergunta Sim/Não por co-proponente (mobile: cônjuge) + renda condicional + bloqueio de avanço.
- Detalhe: exibe "Compõe renda" em admin/partner web e admin/partner mobile.
- Smoke `fase-27-coproponente-renda.sql`: PASS.

## Pendências
- Provisionar `INVERTEXTO_TOKEN` no Supabase (`supabase secrets set INVERTEXTO_TOKEN=...`).
- `documento-validar` já deployada; validar botão "Validar" no wizard após configurar o token.
- Geocodificação usa Nominatim/OSM (rate-limit público); avaliar provedor dedicado para produção.
