# Plano — convite de proposta do e-mail para o app mobile

Status: frontend publicado na Vercel; domínio canônico ajustado para o apex; endpoints AASA e assetlinks validados diretamente em produção. Build nativo e validação em dispositivo permanecem pendentes.

## Objetivo

Permitir que o link de convite enviado por e-mail abra diretamente o onboarding nativo quando o app estiver instalado. Quando o link já tiver sido consumido ou expirado, orientar a pessoa sem sugerir incorretamente que deve falar com um parceiro. Dar ao Admin um caminho visível para reemitir o convite de uma proposta criada por ele.

## Evidência e causa provável

- O link de convite usa `/c/proposta/:token`. O app já aceita URL completa e extrai o último segmento em `extractToken()`.
- A página web chama `cliente_peek_proposta`, que apenas valida o token e não o consome. O botão “Entrar no portal” chama `magic-link-consume`; a função usa `cliente_consume_magic`, que grava `used_at` e torna o token de uso único.
- O onboarding mobile valida com `cliente_peek_proposta` antes de consumir. Portanto, colar no app um token já usado no portal, ou expirado após até 30 minutos, retorna o erro mostrado. A abertura isolada da página web não deveria consumi-lo.
- `magic-link-issue` e `partner_reissue_magic_link` já permitem reemissão para Admin, parceiro ou membro autorizado. A tela de detalhe do parceiro oferece a ação; a tela Admin não tem essa ação.
- O screenshot contém o link completo, que não será reutilizado, registrado ou incluído em testes.

## Documentos e skills lidos

- Instruções `AGENTS.md` fornecidas pelo usuário nesta conversa.
- `skills/UX_skills.md` — mensagens de erro, acessibilidade e interação nativa.
- `docs/blueprint/03-routes-navigation.md` e `docs/blueprint/07-integrations-flows.md` — rotas, magic link de uso único e limites de acesso.
- `prompts/2026-11-07-link-proposta-whatsapp-app.md` — plano relacionado de links do app e associação do domínio.
- `mobile/README.md` e `mobile/app.json` — configuração atual Expo.

## Código inspecionado

- `mobile/app/onboarding.tsx`, `mobile/app/magic/[token].tsx`, `mobile/app.json`.
- `app/src/pages/public/ClienteProposta.tsx` e `app/src/router.tsx`.
- `app/src/pages/partner/PropostaDetalhe.tsx` e `app/src/pages/admin/PropostaDetalhe.tsx`.
- `supabase/functions/magic-link-consume/index.ts`, `supabase/functions/magic-link-issue/index.ts`.
- `supabase/migrations/20260514000004_cliente_peek_proposta.sql` e `supabase/migrations/20260514000003_partner_create_proposta.sql`.

## Decisões e suposições

- Manter token de convite single-use e TTL atual; não relaxar `used_at`, expiração ou regras RLS.
- Reaproveitar o link HTTPS canônico existente e configurar Universal Links/App Links para abrir `/c/proposta/:token` no app instalado. Sem app, preservar a prévia/ativação web.
- A reemissão invalida convites anteriores ainda não usados, conforme a RPC atual; a ação Admin exigirá confirmação explícita e mostrará que um novo e-mail/link será gerado.
- Trocar a mensagem genérica no app por orientação clara de link inválido, já usado ou expirado e indicar que o Admin/parceiro da proposta pode reemitir. Não expor existência de e-mail ou proposta a usuário não autorizado.
- Não criar tabelas, migrations, nova forma de autenticação ou armazenamento de token.
- Apple Team ID confirmado pelo usuário: `29U8L34KC9`. Identificador iOS: `com.mercuriocapital.app`.
- Antes da autorização do usuário, EAS não tinha credenciais nem builds Android. Após aprovação explícita, foi criada a chave de assinatura de produção pelo EAS, sem gerar build. SHA-256 público: `CB:02:3D:A7:E8:F3:F3:DD:D7:5C:10:45:A1:61:E2:BE:E3:EB:39:B8:2F:3D:3A:18:23:E4:9C:FD:46:13:EE:1A`.
- Antes da alteração, o apex redirecionava para `www` e os arquivos de associação não estavam publicados. O usuário aprovou tornar `mercuriocapitalsa.com.br` canônico e redirecionar `www` para o apex.
- Valores oficiais das URLs App Store/Play Store não foram confirmados. Não inventá-los; o fallback para lojas permanece fora desta entrega.

## Arquivos esperados

- `mobile/app.json` e rota mobile do convite para receber o caminho HTTPS associado e encaminhar ao onboarding.
- `app/public/.well-known/apple-app-site-association` e `app/public/.well-known/assetlinks.json`, preenchidos somente com identificadores oficiais de assinatura.
- `app/src/pages/admin/PropostaDetalhe.tsx` para reemitir o convite com a Edge Function existente.
- `mobile/app/onboarding.tsx` para orientar token usado/expirado e preservar o fluxo de convite.
- `mobile/app/c/proposta/[token].tsx` para encaminhar o caminho HTTPS do e-mail ao onboarding nativo.
- `app/src/pages/admin/proposta-detalhe.css` e `app/src/test/adminPropostaDetalhe.test.tsx` para apresentação e cobertura da ação Admin.
- Testes focados de parsing/roteamento e da ação Admin, além de documentação operacional.

## Segurança

- Não reutilizar o token mostrado no screenshot, não gravá-lo em logs e não adicioná-lo a fixtures.
- Universal/App Links apenas transportam o token existente; não concedem acesso independente. Supabase valida e consome o token no fluxo atual.
- Validar domínio HTTPS e rota permitida; nunca aceitar esquema ou host arbitrário como credencial.
- Reemissão exige sessão Admin e autorização no backend; nenhum segredo entra no bundle mobile.
- Sem migration remota, Edge deploy ou build/distribuição nativa nesta implementação local. A publicação Vercel e a alteração do redirect foram aprovadas separadamente.

## Critérios de aceite

- Tocar no convite de e-mail em iOS/Android com app instalado abre onboarding com o token correto, sem abrir/consumir primeiro a rota web.
- Sem app, o link continua no fluxo web; nenhuma URL de loja inventada é usada.
- Token válido mantém a jornada e é consumido uma única vez ao autenticar.
- Token usado/expirado mostra orientação precisa e recuperação possível, sem mensagem que pressuponha um parceiro quando a proposta foi criada pelo Admin.
- Admin autorizado consegue reemitir link da proposta; conta sem permissão não consegue.
- Nenhum ID de proposta ou token permite acessar conteúdo sem autenticação/autorização.

## Testes

- Unitários para extrair somente o token de URL `https://.../c/proposta/:token`, deep link recebido a frio/quente e URL inválida.
- Testes de integração do erro para token válido, usado e expirado sem registrar tokens reais.
- Teste da ação Admin com sucesso, erro, carregamento, confirmação e acesso negado.
- `mobile`: typecheck e exports iOS/Android; `app`: testes relevantes, lint, typecheck e build.
- Manual: app instalado e não instalado; tocar no link no e-mail; retornar de browser; primeira utilização; link reemitido; sessão cliente e perfil não autorizado.
- Não declarar Universal Links/App Links validados sem build assinado e instalação em dispositivo real.

## Estado da implementação local

- Implementado: roteamento Expo para `/c/proposta/:token`, configuração de domínio associado no iOS e filtro HTTPS verificado no Android, mensagem de recuperação no onboarding e reemissão Admin com confirmação explícita e indicação do status do e-mail.
- Preparado localmente: `app/public/.well-known/apple-app-site-association` com o Team ID confirmado e somente a rota `/c/proposta/*`; `app/public/.well-known/assetlinks.json` com a chave pública de assinatura EAS criada após aprovação.
- Publicado na Vercel em `dpl_58jTrtmefwfgG5uqG4et9kuN2DuJ` usando artefato prebuilt; o alias apex aponta para este deployment. O deployment intermediário `dpl_HmmrzXHiyuwyZcbTsrLC7Kqkpjzr`, que recebeu o contexto de build do checkout antes da troca para prebuilt, foi removido e confirmado como `DELETED`. `mercuriocapitalsa.com.br` agora é canônico e `www.mercuriocapitalsa.com.br` redireciona para ele com status 308.
- Validado em produção em 2026-11-09: AASA e assetlinks respondem `200 application/json`, sem redirect, e os corpos contêm o app ID iOS, package Android e fingerprint EAS esperados. `www` responde 308 para o apex. A chave privada permanece no EAS; nenhum build nativo foi iniciado.
- Validado localmente: teste focado Admin, lint, typecheck web/mobile, build web e configuração Expo. Build nativo/dispositivo e associação de domínio não foram executados.

## Pendências externas e rollback

- Antes de distribuir builds Android, manter a credencial EAS protegida e assinar o app com a chave criada. Confirmar URLs públicas de loja somente se o fallback for ativado. Instalar builds iOS/Android em dispositivos reais para validar a abertura nativa; os endpoints e arquivos, isoladamente, não comprovam o comportamento do app instalado.
- A mudança de código é reversível pela versão anterior do frontend/app; tokens já consumidos não são restaurados. A reemissão envia um novo token e invalida tokens antigos não usados.
- O redirect pode ser revertido restaurando `www` como destino do apex e removendo o redirect de `www`; o frontend pode ser revertido pela promoção de um deployment anterior. Build nativo exige aprovação própria.
