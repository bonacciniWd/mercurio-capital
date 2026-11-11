# Tracker — Mercúrio Capital

Visão resumida do trabalho em aberto. **O sistema oficial é o GitHub Issues** —
este espelho existe para leitura rápida e deve ser atualizado junto com elas.

## Como funciona

- Cada frente de trabalho tem uma issue em
  [bonacciniWd/mercurio-capital/issues](https://github.com/bonacciniWd/mercurio-capital/issues).
- Commits referenciam issues (`refs #N` ou `closes #N` quando a issue é concluída).
- Mudanças funcionais seguem o `AGENTS.md`: plano em `prompts/` + aprovação do dono antes de implementar.
- Releases (tags, deploys, EAS build/submit, submissão Apple) exigem go/no-go explícito do dono.

**Legenda:** ⚪ pendente · 🟡 em andamento · 🔴 bloqueada · 🟢 concluída

## App Store (submissão iOS)

| Issue | Item | Status | Notas |
|---|---|---|---|
| #2 | Preencher placeholders de submissão | ⚪ | Só o dono: contato App Review + conta demo |
| #3 | Screenshots iPad 13" (2064×2752) | 🟡 | 3 telas em `screenshots/ios/ipad-13/`; 2064×2752 é o nativo do 13" M4/M5 (2048×2732 é do 12.9"); falta commit (fase #7) |
| #4 | Decisões ⚖️ (nome, países, versão) | ⚪ | Dono decide; registrar em `screenshots/app-store-connect.md` |
| #5 | Submeter build para App Review | 🔴 | Bloqueada por #2, #3, #4. Go/no-go do dono |

Feito: screenshots iPhone 6.9" (1320×2868) de onboarding, login e recuperar-senha
em `screenshots/ios/6.9/`; textos e campos completos em `screenshots/app-store-connect.md`.

## Mobile

| Issue | Item | Status | Notas |
|---|---|---|---|
| #6 | Contraste quebrado em "Recuperar acesso" | 🟡 | Fix aplicado em `recuperar-senha.tsx` (2 classes) + screenshot 03 recapturado; falta commit (fase #7) |
| #9 | Validar área do parceiro (Configurações) no aparelho | ⚪ | Roles admin e membro |

## Web

| Issue | Item | Status | Notas |
|---|---|---|---|
| #8 | Nova frente no projeto `/app` | ⚪ | Começa com plano em `prompts/` + aprovação |

## Repositório

| Issue | Item | Status | Notas |
|---|---|---|---|
| #7 | Organizar ~235 arquivos não commitados | ⚪ | Commits temáticos, sem misturar frentes |

---
Atualizado em 2026-11-11.
