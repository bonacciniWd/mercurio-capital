# Mercurio Capital — Documentação de Escopo & Arquitetura

Esta pasta consolida o escopo da plataforma **Mercurio Capital** e as atualizações operacionais pós-entrega. Serve como fonte única de verdade para alinhar produto, design, engenharia e governança de release.

## Índice

### Principal (raiz)
- [09 — Roadmap de Entregas (Fases)](./09-roadmap.md)
- [12 — Finalização do MVP](./12-finalizacao.md)
- [Status consolidado de release desktop/mobile](./operacao/runbooks.md)

### 📐 Blueprint — escopo & arquitetura ([`blueprint/`](./blueprint/))
1. [01 — Visão Geral & Arquitetura](./blueprint/01-architecture.md)
2. [02 — Papéis (RBAC) & Permissões](./blueprint/02-roles-permissions.md)
3. [03 — Rotas & Navegação por Perfil](./blueprint/03-routes-navigation.md)
4. [04 — Modelagem do Banco (PostgreSQL/Supabase)](./blueprint/04-database-schema.md)
5. [06 — Módulos & Funcionalidades](./blueprint/06-modules-features.md)
6. [07 — Integrações & Fluxos Operacionais](./blueprint/07-integrations-flows.md)
7. [08 — Segurança, Storage & Compliance](./blueprint/08-security-compliance.md)
8. [11 — Proposta de Desenvolvimento](./blueprint/11-dev-proposal.md)

### 🎨 Design ([`design/`](./design/))
- [05 — Mapa Visual da Aplicação (Mermaid)](./design/05-visual-map.md)
- [10 — Blueprint Visual Completo (Mermaid)](./design/10-blueprint-visual.md)
- [Figma Make — Prompts](./design/figma-make-prompts.md)

### ⚙️ Operação ([`operacao/`](./operacao/))
- [Runbooks operacionais](./operacao/runbooks.md)
- [Release desktop macOS (signing + notarização)](./operacao/desktop-release-macos-signing.md)
- [Plano de Disaster Recovery (PITR + dumps)](./operacao/dr-plan.md)
- [Checklist de segurança (OWASP Top 10)](./operacao/security-checklist.md)
- [Setup Stripe](./operacao/stripe-setup.md)

### 🔁 Handoffs entre fases ([`handoffs/`](./handoffs/))
- [Fase 7 → 8](./handoffs/12-handoff-fase7.md)
- [Fase 8 → 9](./handoffs/13-handoff-fase8.md)
- [Fase 9 → 10](./handoffs/14-handoff-fase9.md)
- [Fase 10 → 11](./handoffs/15-handoff-fase10.md)

## Convenções

- **Stack alvo**: React (frontend) + Supabase (Postgres + Auth + Storage + Edge Functions) + Node.js (serviços auxiliares quando necessário).
- **Idioma do banco**: nomes de tabelas e colunas em `snake_case`, em português, conforme escopo original.
- **Idioma do código**: TypeScript no front; SQL/PLpgSQL para policies; Deno (Edge Functions) para integrações externas.
- **Identificadores**: `uuid` (gerado por `gen_random_uuid()`).
- **Datas**: `timestamptz`, default `now()`.
- **Soft delete**: campo `deleted_at timestamptz NULL` quando aplicável.
- **Auditoria**: `created_at`, `updated_at`, `created_by`, `updated_by`.

## Glossário rápido

| Termo | Significado |
|---|---|
| **Parceiro (partner)** | Colaborador externo que origina propostas/leads. |
| **Assistente (team member)** | Membro da equipe de um parceiro com privilégios reduzidos. |
| **Cliente (lead)** | Pessoa física/jurídica cadastrada pelo parceiro como tomador. |
| **Admin** | Operador interno Mercurio com acesso total. |
| **Proposta** | Operação de crédito originada (Home Equity, Construção, Financiamento). |
| **Magic link** | Link único de autenticação enviado por e-mail e/ou WhatsApp (Evolution API). |
| **Protocolo** | Identificador público da proposta para consulta sem autenticação. |
