# Link da proposta em notificações WhatsApp e abertura no app

## Objetivo

Permitir que o cliente abra diretamente a proposta citada em notificações WhatsApp. Quando o app estiver instalado, o link HTTPS deve abrir a tela da proposta no app; sem o app, deve encaminhar o cliente para a loja correspondente, mantendo uma alternativa web segura.

## Skills e documentação lidas

- `AGENTS.md` fornecido pelo usuário nesta conversa.
- `docs/blueprint/07-integrations-flows.md` — links públicos, privacidade e magic links.
- `docs/blueprint/06-modules-features.md` — rotas do portal, notificações e links canônicos.
- `docs/12-finalizacao.md` e `docs/operacao/runbooks.md` — estado de distribuição mobile e critérios de release.
- `mobile/README.md` — configuração Expo do app.

## Código e configuração inspecionados

- `app/src/router.tsx`: rota web protegida `/c/propostas/:id` e ativação pública `/c/proposta/:token`.
- `app/src/pages/public/ClienteProposta.tsx`: magic link de ativação com consumo único.
- `mobile/app.json`: scheme `mercurio`, bundle/package `com.mercuriocapital.app`; sem configuração de Universal Links/App Links.
- `mobile/app/(cliente)/_layout.tsx`: autenticação do grupo cliente redireciona para login sem preservar atualmente o destino solicitado.
- `mobile/app/(cliente)/propostas/[id].tsx`: detalhe autenticado de proposta do cliente.
- Fluxos de WhatsApp e migrations de templates: a Meta tem o template `status_proposta` aprovado, mas sem link ou botão; o fluxo local possui modelos de notificação separados.
- Documentação atual registra iOS em TestFlight; não encontrei evidência de publicação pública na App Store/Google Play nem arquivos de associação do domínio.

## Decisões e suposições

- Usar URL HTTPS canônica do domínio Mercúrio para que o mesmo link funcione no WhatsApp, navegador e app.
- Links de atualização de status apontam para a rota autenticada da proposta (`/c/propostas/:id`), nunca para o magic link de ativação: o magic link atual é de uso único e expira em até 30 minutos.
- Não incluir nome, CPF, valor, token de sessão nem outros dados pessoais na URL. O ID da proposta só abre dados após autenticação e autorização/RLS.
- Preservar o template atualmente aprovado; preparar um novo template com CTA/link para análise da Meta, ativando-o no fluxo apenas depois de aprovado e sincronizado.
- Universal Links/App Links abrirão o app quando instalado. Sem app, a URL HTTPS cairá em uma página de encaminhamento web que oferece a loja da plataforma e o portal web. O redirecionamento automático à loja depende de termos as URLs públicas da App Store e Google Play; hoje não foram localizadas.
- Não presumir nem fabricar IDs Apple Team, fingerprints de assinatura Android ou URLs de loja.

## Modelo e fluxo de dados

- Nenhuma tabela ou registro novo previsto.
- O evento de mudança de status já identifica a proposta; o backend gera uma URL HTTPS canônica contendo somente o ID da proposta.
- A autorização continua sendo decidida pelo servidor/RLS em cada abertura; o deep link não concede acesso.
- O cliente sem sessão autentica-se e retorna à mesma proposta. No app, o guard precisa preservar o destino do deep link durante o login.

## Arquivos esperados

- Configuração Expo/EAS e entitlements Android/iOS para os domínios associados.
- Arquivos `.well-known/apple-app-site-association` e `.well-known/assetlinks.json`, com valores oficiais das assinaturas.
- Rotas web para encaminhamento seguro e retorno pós-login.
- Tratamento de URL inicial e recebida no app para navegar a `/c/propostas/:id`.
- Integração backend/fluxo WhatsApp para montar o link, sem expor credenciais ao cliente.
- Versão de template WhatsApp com botão de URL, preservando a versão atual até a nova receber aprovação da Meta.
- Testes de URL válida/inválida, usuário cliente autenticado, sessão ausente, role incompatível, app instalado e fallback web.

## Requisitos e critérios de aceite

- Toque no CTA em iOS/Android com app instalado abre a proposta correspondente no app.
- Sem app instalado, o mesmo HTTPS abre a página web e oferece a loja adequada; links de loja são ativados somente após confirmação das listagens públicas.
- Após login, o cliente retorna à proposta originalmente vinculada.
- Usuário sem autorização não acessa a proposta alterando o ID na URL.
- A rota de ativação por magic link permanece separada e mantém TTL/uso único.
- O template aprovado em produção não é substituído até a nova versão ser aprovada, sincronizada e validada.
- Não há envio de mensagens de teste ou publicação de templates durante a implementação local.

## Segurança

- Autorização exclusivamente por sessão e RLS/backend; deep link não equivale a credencial.
- Parâmetro da URL limitado ao identificador da proposta; sem PII ou tokens de acesso duradouros.
- Validar esquema, domínio e rota recebidos pelo app; rejeitar domínios externos e caminhos não permitidos.
- Preservar restrição de acesso do cliente às propostas associadas à sua conta.
- Não colocar tokens Meta, Supabase ou segredos em bundle, URL ou configuração pública.

## Testes

- Automatizados: unit tests para geração/parsing do link e retorno pós-login; testes de autorização/RLS existentes; typecheck, lint e build web/mobile.
- Manuais: WhatsApp real em iOS e Android com app instalado; app ausente abrindo fallback; login novo e sessão ativa; link inválido e tentativa com conta que não pertence à proposta.
- Testar a nova versão do template somente após submissão/aprovação Meta, em destinatário explicitamente escolhido e com mensagem revisada.

## Atenção / bloqueios externos

- Para Universal Links/App Links são necessários o Apple Team ID e o fingerprint SHA-256 da chave usada no build Android.
- O fallback real para lojas depende das URLs/listagens públicas da App Store e Google Play. A documentação atual só confirma TestFlight para iOS.
- Template Meta aprovado não pode receber botão/link sem revisão da nova versão.
- O comportamento de abertura no app só poderá ser validado em builds assinadas instaladas, não apenas no simulador web.
