# Publicação — MERX pública

**Status:** publicado e smoke HTTP concluído. A publicação ficou limitada à MERX Pública; Serasa e WhatsApp não foram incluídos como mudanças deste release.

## Objetivo e limite

Publicar somente o widget público MERX, sua configuração administrativa, FAQ determinística e captação opcional de contato. Não incluir alterações locais de Serasa, WhatsApp, propostas ou outras telas. Não alterar migrations neste release.

## Documentação consultada

- `docs/operacao/change-management.md` e `docs/operacao/release-checklist.md`.
- `docs/operacao/merx-publica-atendimento.md`.
- `docs/operacao/2026-10-29-whatsapp-merx-inbound-pendencias.md`.
- `docs/operacao/2026-10-21-auditoria-serasa-merx.md`.
- `prompts/2026-10-30-merx-fluxo-atendimento-originador-cliente.md`.
- `prompts/2026-10-30-merx-lead-capture-validation.md`.
- `prompts/2026-10-30-reconciliacao-migrations-merx.md`.

## Escopo implementado no artefato

- Widget MERX apenas nas quatro rotas comerciais definidas.
- FAQ determinística, saudação, triagem parceiro/cliente e links públicos.
- Captação opcional, com consentimento, validação server-side, reCAPTCHA v3, honeypot, rate limit e idempotência.
- Configuração/FAQ administrativa, usando RPCs já instaladas no Supabase remoto.
- Sem LLM, sem uso de contexto privado e sem persistência do histórico da conversa.
- Edge `public-merx-lead` é necessária para envio dos formulários; nenhuma outra Edge Function faz parte da publicação.

## Dados, autorização e rollback

- Usa `merx_leads_publicos` e a view administrativa existentes; sem novo modelo neste release.
- Migrations MERX `20261029000002` e `20261030000000` a `20261030000003` foram aplicadas no projeto `bhagksfvszeogtjvjtpx` em execução autorizada anterior. Nenhuma migration será aplicada agora.
- A Edge pública exige consentimento, CAPTCHA válido, limite de requisições e configuração ativa; grava somente após as validações.
- Rollback: promover a implantação Vercel anterior; desligar `habilitado`/`captacao_habilitada` pela configuração Admin caso necessário. A tabela e migrations permanecem intactas.

## Artefato e verificações

- Base limpa no commit `cfdfc02eedcddd2e3787c55597d0e73447470150` (igual a `origin/main`); arquivos MERX aprovados foram copiados para diretório temporário isolado.
- Lockfile local incluído para usar as resoluções corrigidas; `npm audit --omit=dev` e auditoria completa: zero Critical/High, dois Moderate (React Router).
- `npm run lint`: aprovado, zero erros, 33 avisos existentes.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado com aviso de chunk grande preexistente.
- `npm test -- --maxWorkers=1`: 191 testes em 47 arquivos aprovados, com lockfile atualizado.
- Testes visuais e captação real de lead não fazem parte do smoke; não submeter PII nem criar fixture em produção.

## Registro de publicação (2026-10-30)

- Vercel produção: deployment `dpl_BbwD4bqYMJuuC8gYbiA5xEV6UYjq`, READY, alias `https://www.mercuriocapitalsa.com.br`.
- HTTP GET retornou 200 para `/`, `/simulador`, `/credito-para-construcao` e `/download`.
- Bundle publicado contém os identificadores da MERX Pública. O bundle também inclui código preexistente do app base; nenhum arquivo local de integração Serasa ou WhatsApp foi copiado para o artefato isolado. Não foi realizado POST de lead.
- Supabase Edge Function `public-merx-lead`: deployment ativo v1, `verify_jwt=false` como exige o endpoint público; OPTIONS retornou 200 com CORS esperado e GET retornou 405 `method_not_allowed`. Nenhum POST foi realizado.
- O deploy inicial falhou antes de criar deployment por incompatibilidade de diretório raiz; a tentativa corrigida foi concluída e é a deployment registrada acima.
- Rollback Vercel: promover `dpl_6s7mYUtSHyboxWZuLhXWqhn4cncs`. Se necessário, desativar `habilitado`/`captacao_habilitada` no Admin para interromper captação sem apagar dados ou migrations.
- Nenhuma migration nova, commit, push ou publicação desktop/mobile foi feita.
- Validação visual autenticada e envio de lead real não foram executados; operação manual no Admin pode confirmar a exibição da configuração pública.

Nenhum commit, push ou release desktop/mobile foi feito.
