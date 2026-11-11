# App mobile: onboarding, login e remoção das rotas Admin

## Objetivo

Preparar a revisão do app mobile para apresentar onboarding na entrada/autenticação e manter no aplicativo somente as jornadas de Parceiro e Cliente. Remover acessos de demonstração e telas/rotas Admin do cliente mobile. O plano do link de proposta WhatsApp permanece separado em `2026-11-07-link-proposta-whatsapp-app.md`.

## Skills e documentação lidas

- `AGENTS.md` fornecido pelo usuário nesta conversa.
- `mobile/README.md` — stack, comandos, rotas e estado de release.
- `docs/12-finalizacao.md` e `docs/operacao/runbooks.md` — estado de distribuição e smoke mobile.
- `docs/blueprint/02-roles-permissions.md` — papéis e limites de acesso.
- `docs/blueprint/06-modules-features.md` — jornadas web/mobile de cliente e parceiro.

## Código e configuração inspecionados

- `mobile/app/login.tsx`: autenticação real via Edge Function, atalho mock Cliente/Admin, botões Apple/Outlook que navegam diretamente ao dashboard de parceiro, botão biométrico sem fluxo conectado e link mágico fixo de demonstração.
- `mobile/app/index.tsx`: splash que direciona para login após atraso fixo.
- `mobile/app/_layout.tsx`: Stack raiz registra grupos cliente, parceiro e admin.
- `mobile/app/(admin)/`: telas mobile sob rotas Admin.
- `mobile/app/(parceiro)/_layout.tsx`: tabs de navegação do parceiro e redirecionamento de role.
- `mobile/app/(cliente)/_layout.tsx`: guarda de sessão do cliente.
- `mobile/lib/notificationLinks.ts`, `mobile/lib/adminScope.ts`, `mobile/components/AdminScreen.tsx`: referências mobile a rotas/componentes Admin.
- `mobile/app.json` e `mobile/package.json`: Expo SDK 54, Expo Router, scheme `mercurio`, scripts disponíveis (inclui typecheck; não declara lint/build).

## Decisões e suposições atuais

- “Tabs” neste escopo significa atalhos de perfil/demonstração na tela de login. As tabs internas que navegam pelas áreas do Parceiro serão preservadas por enquanto; só serão alteradas se o usuário especificar isso nos próximos detalhes.
- Remover a superfície Admin do app mobile não altera o papel Admin, permissões, RLS, rotas web ou backend. O usuário Admin será informado de que o app mobile atende apenas Cliente e Parceiro, sem abrir telas Admin.
- Onboarding será implementado conforme a próxima referência e os detalhes de fluxo do usuário. Como esses detalhes ainda serão discutidos, o plano não fixa telas, copy, quantidade de passos ou tratamento de cadastro.
- O login continuará usando autenticação segura existente. Controles de demonstração que contornam autenticação não permanecerão na entrega.
- A entrada do app deve respeitar sessão existente; o destino para sessão Cliente/Parceiro será preservado conforme a regra atual, salvo especificação posterior.

## Modelo de dados e regras

- Nenhuma tabela, migration ou registro novo previsto.
- Papéis suportados na experiência mobile: `client`, `partner` e `team_member` dentro da jornada de Parceiro.
- `admin` não deve navegar para rotas Admin mobile. Não se altera autorização de servidor nem a permissão Admin em outras superfícies.
- Acesso continua condicionado a sessão, role e status/aprovação do parceiro conforme as guards existentes.

## Arquivos esperados

- `mobile/app/login.tsx`, `mobile/app/index.tsx` e, conforme o onboarding aprovado, novas telas/rotas mobile.
- `mobile/app/_layout.tsx` e guards/roteamento de autenticação.
- `mobile/app/(admin)/**` para retirada do grupo e rotas Admin mobile.
- `mobile/lib/notificationLinks.ts`, `mobile/lib/adminScope.ts`, `mobile/components/AdminScreen.tsx` e testes correspondentes para remover referências Admin que ficarem sem uso.
- `mobile/README.md` para documentar as jornadas e estrutura atualizadas.

## Requisitos e critérios de aceite

- Onboarding e login correspondem à referência visual/funcional que o usuário fornecer antes da implementação.
- Nenhum atalho permite entrar em telas Cliente, Parceiro ou Admin sem autenticação válida.
- Nenhuma rota Admin é registrada ou acessível no app mobile.
- Admin autenticado recebe destino/aviso previsível sem crash nem redirect loop; os dados e permissões Admin permanecem intactos no backend e na web.
- Cliente, Parceiro e `team_member` continuam direcionados às áreas corretas, respeitando aprovação e guards atuais.
- As tabs funcionais do Parceiro permanecem operacionais até orientação diferente.
- Os links mágicos e links de notificação não apontam para rotas Admin mobile após a remoção.

## Segurança

- Não criar atalhos de papel que simulem sessão ou acessem rotas protegidas.
- Não mover autorização para o cliente; backend, RLS e verificações de sessão existentes permanecem fonte de verdade.
- Não ampliar acesso de Cliente, Parceiro ou `team_member` a dados Admin.
- Não alterar role, cadastro ou status de usuários por esta tarefa.

## Testes

- Automatizados: testes de login/roteamento por papel e links de notificação; `cd mobile && npm run typecheck`.
- Verificações disponíveis: validar configuração com `npx expo config --type public`; executar `git diff --check`.
- Manuais em iOS e Android: sessão ausente, sessão Cliente, Parceiro aprovado, Parceiro pendente, membro de equipe e usuário Admin; retorno de magic link; abertura de proposta via link; ausência de rotas Admin e ausência de loops.
- Teste visual do onboarding em viewport/dispositivo mobile após receber a referência.
- Não declarar build, instalação física ou publicação concluída sem executar e validar esses passos.

## Pendências antes da implementação

- Referência visual e conteúdo de cada tela de onboarding/login.
- Regras dos botões e destinos do onboarding: entrar, criar conta, ativar acesso e recuperar senha.
- Destino desejado para Admin que tente autenticar no app mobile.
- Confirmação futura caso “remover as tabs” também inclua as tabs de navegação do Parceiro.
