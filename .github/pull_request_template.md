## Objetivo e escopo

- Plano aprovado: `prompts/...`
- Objetivo:
- In scope:
- Out of scope:
- Perfis afetados: admin full / limitado / juridico / partner / team_member / client / public

## Impacto por area

- Web:
- Mobile:
- Banco, migrations e RLS:
- Edge Functions e integracoes:
- Electron/updater:
- Seguranca e compliance:
- Documentacao e operacao:

## Modelo de dados

- [ ] Nao aplicavel.
- [ ] Modelo aprovado antes da implementacao.
- Migration/compatibilidade/forward-fix:

## Seguranca

- [ ] Nenhum segredo, token ou PII foi versionado ou exposto em logs.
- [ ] Autorizacao server-side/RLS cobre as mudancas; guards de UI nao sao a unica barreira.
- [ ] Webhooks/integracoes tratam assinatura, retry e idempotencia quando aplicavel.

## Validacao executada

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test -- --run`
- [ ] `npm run build`
- [ ] Testes manuais: fluxo feliz, vazio, erro e entrada invalida.
- [ ] Smoke SQL/RLS/RPC/Edge aplicavel.
- [ ] Desktop/mobile aplicavel.

Evidencias e comandos executados:

## Rollout e rollback

- Rollout:
- Rollback ou forward-fix:
- Observabilidade:

## Release

- [ ] Esta PR nao cria tag, release ou deploy remoto.
- [ ] Se houver publicacao posterior, o checklist `docs/operacao/release-checklist.md` sera mapeado e recebera GO explicito do dono do produto.

