# Mercurio Capital — Documentação de Escopo & Arquitetura

Esta pasta consolida o escopo inicial da plataforma **Mercurio Capital**, antes de qualquer codificação. Serve como fonte única de verdade para alinhar produto, design e engenharia.

## Índice

1. [01 — Visão Geral & Arquitetura](./01-architecture.md)
2. [02 — Papéis (RBAC) & Permissões](./02-roles-permissions.md)
3. [03 — Rotas & Navegação por Perfil](./03-routes-navigation.md)
4. [04 — Modelagem do Banco (PostgreSQL/Supabase)](./04-database-schema.md)
5. [05 — Mapa Visual da Aplicação (Mermaid)](./05-visual-map.md)
6. [06 — Módulos & Funcionalidades](./06-modules-features.md)
7. [07 — Integrações & Fluxos Operacionais](./07-integrations-flows.md)
8. [08 — Segurança, Storage & Compliance](./08-security-compliance.md)
9. [09 — Roadmap de Entregas (Fases)](./09-roadmap.md)
10. [10 — Blueprint Visual Completo (Mermaid)](./10-blueprint-visual.md)

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
