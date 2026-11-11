# Plano — área Parceiro mobile: funcionalidade e padronização visual

Data: 09/11/2026. Estado: Lote 1 do Perfil e aditivo visual da tela Login implementados localmente. Aditivo de build de desenvolvimento iOS aprovado; preparando registro de aparelho e compilação EAS. Demais lotes aguardam aprovação própria. Sem autorização de migration remota, envio de convite, cobrança, deploy, GitHub Actions, build de produção ou publicação na App Store.

## Objetivo

Restaurar o acesso às telas do parceiro no Expo SDK 58 e ajustar os módulos na ordem solicitada: Perfil/atalhos, Carteira, Promoções, Propostas e Início. Cada lote deve ser funcional e visualmente consistente, com dados reais e permissões vigentes. O escopo principal é `mobile/`; web e banco são referências para contratos já existentes.

Levantamento e evidências: `docs/operacao/2026-11-09-levantamento-area-parceiro-mobile.md`.

## Skills e documentos lidos

- `AGENTS.md` fornecido pelo usuário; `docs/README.md`; `docs/operacao/change-management.md`.
- Roadmap `docs/09-roadmap.md` e finalização `docs/12-finalizacao.md` (trechos de mobile, equipe, relatórios, carteira, contratos e LMS).
- Handoffs `12`–`17` nos domínios envolvidos; `18`–`20` como evolução operacional posterior e distinção financeira.
- Blueprints `02-roles-permissions`, `03-routes-navigation`, `06-modules-features` (especialmente M14/Milestones).
- `mobile/README.md`, padrões da área Cliente/onboarding e instruções visuais de `.github/agents/ux-ui-mercurio-capital.agent.md` consultadas como documentação do projeto.
- Fonte local da versão instalada do Expo Router 58.0.30: `TabsClient.js` e `useVisibleTabsWithRedirect.js`. Não é necessário instalar outra biblioteca para corrigir os destinos.

## Código inspecionado

- Todas as rotas em `mobile/app/(parceiro)/`, incluindo detalhe de proposta e aula.
- `mobile/lib/{auth,partner,queryClient,notificationLinks,securityConfig,propostaStatus}.tsx/ts`, `mobile/components/{NotificationsSheet,Badge,KPICard}.tsx`, `components/cliente/ClienteUI.tsx`, `tailwind.config.js`.
- Login, setup/challenge 2FA, convite de equipe, configuração Expo e root Stack.
- Referências web: Configurações, Simulações, Relatórios, Milestones e Contrato; migrations/RPCs de perfil, equipe, métricas, carteira, comissões, LMS e milestones.
- Catálogo local do Supabase: fontes e RPCs dos domínios confirmadas por leitura de metadados, sem valores de clientes.

## Decisões e suposições

1. Apenas Cliente e Parceiro no app; manter a remoção de Admin.
2. “Contato de parceria” significa **Contrato de parceria**, confirmado pelo dono do produto. Segurança é o item **Segurança & 2FA**.
3. Manter as cinco abas atuais e os caminhos públicos existentes. Corrigir primeiro as declarações que usam `href: null`: na versão instalada isso ativa redirecionamento de rota oculta. A barra customizada já escolhe quais cinco itens desenhar.
4. Partner e team_member compartilham parte da área, mas a UI precisa respeitar a matriz vigente; servidor/RLS continuam autoridades.
5. Para o visual, propor a base escura/preto/vermelho já aprovada no onboarding/Cliente, componentes e tokens existentes. Confirmar essa referência antes de codificar; não criar identidade nova.
6. Documento de parceria individual precisa de fonte oficial confirmada. O conteúdo atual com empresa/CNPJ/percentuais de exemplo não é essa fonte. Reaproveitar PDF só depois de confirmar documento e finalidade; se for necessário persistir contrato próprio, apresentar modelo separado para aprovação.
7. Não generalizar snapshots antigos de “mobile em mock”: registrar o que o código usa de fato e validar em execução depois de liberar navegação.

## Lote 1 — Perfil e base de navegação (primeira implementação proposta)

- Corrigir declaração das rotas secundárias para não disparar redirecionamento automático no Router 58, mantendo os cinco botões da barra customizada.
- Reaproveitar padrões visuais neutros existentes em componentes do Parceiro; padding de safe area/barra/FAB, cabeçalho/voltar, cards, campos, botões, loading/erro/vazio.
- Perfil: dados reais e fallback neutro de identidade; versão obtida dos metadados do app; desempenho com erro distinto de zero e atualização.
- Atalhos: Notificações abre a caixa real; Configurações/Segurança abre a seção correspondente por parâmetro; preferências de notificação continuam distintas da caixa de mensagens.
- Gerenciamento 2FA baseado no estado real do Supabase e nas políticas vigentes, reaproveitando setup/challenge existentes. Face ID/desbloqueio do aparelho continua sendo um controle diferente.
- Condicionar Equipe, configurações e ações financeiras às permissões documentadas. Sem criar exceção de role nem ampliar autorização.
- Limpar/isolar queries privadas ao trocar de identidade e sair, evitando cache da conta anterior. Centralizar invalidação das informações compartilhadas.
- Central de ajuda não deve aparentar ação funcional sem destino configurado. Não inventar contato.
- Contrato de parceria: exibir condição verdadeira do documento; decisão sobre a fonte oficial é uma dependência antes de liberar exportação de contrato real.

## Lotes seguintes (aprovação por lote)

2. **Atalhos operacionais do Perfil:** simulação rápida de verdade; comissões com significado correto; equipe/convites; relatórios com filtros/export; Universidade/player/recursos/certificados; documento oficial de parceria conforme fonte aprovada.
3. **Carteira:** saldo e extrato consistentes entre telas, recarga correlacionada pelo ID exato, pendente/cancelado/erro e papel membro somente leitura.
4. **Promoções:** `partner_milestones_progress` e catálogo `partner_milestones`, metas/imagens/maior meta dinâmicas; regra já documentada.
5. **Propostas/detalhe:** PF/PJ, busca/filtros/paginação, etapas canônicas e início real da etapa; documentos/pendências e ações somente com backend existente e escopo aprovado.
6. **Início:** consolidar componentes e fontes já reconciliados; indicar atualização, erros e próximos passos reais.

## Modelo de dados

Primeiro lote não cria entidades nem migrações. Reutiliza:

- Perfil: `usuarios` e `partners`; membro autenticado vinculado via `equipe_membros → equipes → partners`.
- Caixa: `notificacoes.usuario_id`; preferências: `partner_notif_prefs(partner_id, evento)`.
- Sessão/MFA: Supabase Auth, fatores TOTP e armazenamento seguro já configurado; cache de query é memória local, nunca fonte de autorização.
- Consultas e métricas existentes, sem backfill e sem reescrever status/histórico.

Campos obrigatórios e relacionamentos dos módulos seguintes estão mapeados no levantamento. Qualquer necessidade de nova persistência (ex.: contrato de credenciamento) ou nova RPC scoped (ex.: início de etapa do parceiro) exige modelo e plano aditivo aprovados antes da implementação. Não chamar RPC Admin pela UI do parceiro.

## Arquivos esperados no primeiro lote

- `mobile/app/(parceiro)/{_layout,perfil,configuracoes}.tsx`.
- Componentes neutros/Parceiro e `NotificationsSheet` apenas se necessário para oferecer o mesmo histórico pelo Perfil.
- `mobile/lib/{partner,queryClient,auth}` somente para escopo/limpeza de cache e identidade, mantendo sessão e desbloqueio existentes.
- Rotas 2FA somente nos pontos necessários ao gerenciamento aprovado; não alterar políticas implicitamente.
- Testes focados conforme infraestrutura existente; documentação operacional e `mobile/README.md`.

## Requisitos e critérios de aceite

- Todo atalho listado abre a rota correta, permanece nela e permite voltar; detalhe e aula também são alcançáveis.
- A barra continua com cinco abas; conteúdo e botão final não ficam cobertos por ela/FAB.
- Perfil, Notificações, Segurança e Configurações têm destinos e estados identificáveis; atalho não cai sempre em Empresa.
- Partner e membro veem apenas ações permitidas; dados de uma conta não aparecem na outra após logout/login.
- Loading, falha de rede, vazio real e zero real são distinguíveis; retry e sucesso não deixam ações duplicadas.
- 2FA mostra estado real; não tratar desbloqueio biométrico como fator TOTP nem exibir toggle de canal como confirmação de entrega.
- Dinheiro segue a unidade do domínio: centavos para carteira/preços, reais para comissões/propostas; BRL/percentual/data com pontuação pt-BR.
- Contrato/prêmio/pagamento exibem fonte e significado reais, sem transformar dados demonstrativos em obrigações operacionais.
- Visual segue referência aprovada, cores Mercúrio, tipografia legível, ações com alvo mínimo de 44 pt, Dynamic Type, contraste, leitores de tela e movimento reduzido.

## Segurança e impacto

- Mobile: afetado. Web: referência, sem mudança funcional neste lote. Banco/RLS/Edge: sem mudança no primeiro lote. Desktop/updater/empacotamento: não afetados.
- Nenhuma senha, chave privada ou service role no cliente; não imprimir tokens ou dados de clientes durante validação.
- Chamadas seguras existentes e autorização server-side preservadas. Checkout, envio de convite e cadastro/remoção de fator são mutações reais: testes com ambiente/conta autorizados, sem alteração silenciosa de produção.
- Nenhuma nova dependência ou framework.

## Testes manuais e automáticos

- Baseline já executada no levantamento: `npm run typecheck` mobile passou. Não houve homologação no aparelho nesta etapa documental.
- Após implementar: typecheck, lint onde configurado, testes de navegação/escopo/cache e escolhas de seção com dados sintéticos; export de bundles iOS/Android; revisão de diff.
- iPhone: Perfil → cada atalho → voltar; deep link; alternância entre abas; scroll/teclado/safe area; tamanho de fonte ampliado; contraste e leitores de tela.
- Duas contas e membro: troca de sessão sem dados anteriores, permissões e fallback de guard; loading/erro/retry/ausência de dados.
- Notificações: leitura/erro/destino; configurações persistidas; MFA configurado/não configurado/cancelamento/erro conforme fluxo aprovado.
- Nenhuma cobrança, convite real, migration remota ou publicação como parte da verificação automática.

## Rollout e rollback

Implementar lotes pequenos para revisão local. Preservar alterações já existentes no checkout. Guardar diff identificável de cada lote. Publicação mobile e mudança remota são aprovações separadas; manter versões instaladas compatíveis. Reverter primeiro lote pelo diff de navegação/UI/cache se necessário, sem apagar registros de negócio.

## Implementação local — Lote 1

O dono do produto aprovou o plano e sua base visual. Navegação corrigida com rotas secundárias declaradas e guard de gestão; barra/FAB apenas nas rotas principais. Perfil e Configurações em preto/cinza/vermelho; caixa real de notificações acessível pelo Perfil; seleção de seção por parâmetro; gerenciamento TOTP com fluxo real e confirmação explícita. O setup não remove fatores de outras tentativas. Campos preservam máscaras/validação e exibem estado de alterações/sucesso/erro.

Identidade/cache: perfil e preferências têm chave por usuário; cache de queries/mutações é limpo ao trocar identidade e sair, e o carregamento de perfil ignora respostas de estados de autenticação antigos. O bloqueio local e tolerância de segundo plano foram preservados. O bloqueio agora aparece como modal sobre a tela ativa, mantendo o formulário de MFA montado enquanto a pessoa alterna para o app autenticador.

Correção trazida pela homologação local: o sino do Dashboard e o atalho Notificações do Perfil podiam montar duas `NotificationsSheet` ao mesmo tempo. Cada instância adicionava callbacks ao mesmo canal Realtime depois de `subscribe()`, causando `cannot add postgres_changes callbacks ... after subscribe()`. As instâncias agora compartilham uma assinatura por cliente/usuário e o último consumidor remove o canal; a remontagem usa tópico novo até a remoção anterior terminar.

Contrato: removida exibição/exportação do conteúdo demonstrativo, substituída por documento oficial indisponível. Carteira recebeu apenas a restrição de recarga para membro; a reconciliação financeira permanece no lote próprio. Nenhuma política, tabela ou integração remota foi alterada.

Novos componentes: `mobile/components/parceiro/{PartnerUI,PartnerSecurity}.tsx`; helpers `mobile/lib/partnerAccess.ts` e `mobile/lib/notificationSubscription.ts`; testes em `mobile/tests/*.test.mjs`. Baseline dos arquivos preexistentes preservada em `/tmp/mercurio-partner-lote1-baseline-20261109` para revisão isolada dos ajustes deste lote.

Verificação local: typecheck mobile passou; ESLint nos arquivos deste lote passou sem erros (dois avisos de Fast Refresh); 9 testes focados passaram; `npx expo export --platform ios --platform android --output-dir /tmp/mercurio-partner-lote1-final` gerou os bundles iOS e Android. Nenhum build nativo, teste em dispositivo, publicação, migration ou gravação remota foi realizado.

## Próxima decisão

Homologar Perfil/Notificações/MFA/Login no iPhone usando um build de desenvolvimento. Depois iniciar o Lote 2. A fonte oficial do Contrato de parceria continua pendente antes de liberar exportação desse documento.

## Aditivo proposto — apresentação da tela Login

### Objetivo

Alinhar `mobile/app/login.tsx` ao padrão visual já aprovado no onboarding/Cliente e no Perfil do Parceiro, corrigindo contraste e adaptação ao teclado sem alterar o fluxo de autenticação.

### Código inspecionado

`mobile/app/login.tsx`, `mobile/app/onboarding.tsx`, `mobile/app/index.tsx`, `mobile/app/_layout.tsx`, configuração Tailwind e o fluxo existente `auth-login` → `setSession` → MFA → roteamento por role.

### Escopo e decisões

- Aplicar a base já aprovada: fundo escuro, texto branco/cinza legível e vermelho Mercúrio em ações/foco; reutilizar componentes e ativos existentes.
- Ajustar logo, hierarquia, espaçamento responsivo e `KeyboardAvoidingView`/rolagem para telas menores e teclado aberto.
- Dar contraste suficiente aos rótulos, textos digitados e placeholders; manter alvos interativos confortáveis.
- Preservar os campos e ações existentes: entrar, recuperar senha, acompanhar proposta por protocolo e cadastro de parceiro.
- Preservar intactos endpoint, rate limit, mensagens de erro, sessão segura, challenge MFA e destinos Cliente/Parceiro/Admin indisponível.
- Não incluir novo cadastro de Cliente, Social Login, biometria como login ou alteração de política de acesso.

### Arquivos esperados

- `mobile/app/login.tsx`.
- `mobile/README.md` e este plano para registrar o resultado, se implementado.

### Critérios e validação

- Campos e ações legíveis no tema escuro e com teclado aberto; conteúdo pode rolar sem ficar sob teclado/safe area.
- Login vazio mostra validação; credenciais inválidas mostram mensagem segura já existente; fluxos de recuperação, protocolo e cadastro continuam navegáveis.
- Regressão técnica: typecheck, lint focado, testes existentes e export dos bundles iOS/Android. Build de desenvolvimento e inspeção em iPhone são o passo recomendado depois do ajuste visual, antes do Lote 2.
- Nenhuma sessão/credencial real será usada em teste automatizado; teste no aparelho usa conta de homologação escolhida pelo dono do produto.

### Segurança e impacto

Somente cliente mobile/UI; sem modelo de dados, migration, alteração de endpoint, logs de credenciais ou segredo no app. O fluxo seguro de autenticação permanece igual. Aditivo aprovado pelo dono do produto em 09/11/2026.

### Resultado local

Login atualizado com hierarquia/contraste escuros, foco vermelho nos campos, ações com alvo maior, navegação entre e-mail e senha pelo teclado, scroll com teclado aberto e logo redimensionada. Autenticação, rate limit, MFA, recuperação, protocolo e destinos por role foram preservados. Typecheck, ESLint focado e 9 testes existentes passaram; o export final iOS/Android concluiu em `/tmp/mercurio-mobile-login-final`. A tela ainda precisa ser conferida no iPhone.

## Aditivo aprovado — build iOS de desenvolvimento

O dono do produto aprovou configurar um perfil EAS de desenvolvimento iOS e iniciar o build para homologação no aparelho. Expo docs consultadas: perfil de development usa `expo-dev-client` e `distribution: internal`; distribuição iOS ad hoc exige registrar o aparelho. `expo-dev-client` foi instalado para SDK 58, o perfil `development` foi incluído sem alterar `production`, e `eas config --platform ios --profile development --non-interactive --json` confirmou a configuração. O UDID informado foi registrado no EAS e no Apple Developer Portal para o Team ID `29U8L34KC9`; o provisioning profile Ad Hoc foi atualizado e inclui o iPhone. As variáveis públicas `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_APP_URL` foram configuradas no ambiente EAS `development`. Para evitar arquivar o monorepo inteiro (55,6 MB, incluindo o histórico Git), o build foi enviado em modo No VCS com `EAS_PROJECT_ROOT` limitado a `mobile` (pacote de 4,1 MB). Build EAS `e1aa2713-a3be-45b9-a4b9-bec9b51aa860` terminou com status `finished`, perfil `development`, distribuição interna, SDK 58, versão `0.0.2`, build `4`; link de instalação: https://expo.dev/accounts/dbonaccini/projects/mercurio-capital/builds/e1aa2713-a3be-45b9-a4b9-bec9b51aa860. Build de desenvolvimento não publica na App Store nem usa GitHub Actions. Ainda falta instalar no iPhone e validar visual/login, incluindo alternância para autenticador e MFA com conta de homologação.
