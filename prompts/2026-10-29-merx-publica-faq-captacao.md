# MERX pública — FAQ, captação de contatos e configuração administrativa

Status: aprovado pelo dono do produto em 2026-10-29 para implementação local. Nesta retomada foram ajustados layout, sugestões fixas, escrita progressiva, marca/asa, botão de fechar e fallback de visibilidade do chat. A retenção/expiração do cache local ainda precisa de decisão antes de implementar persistência. A migration de compatibilidade é local e não foi aplicada. Deploy, migration remota, ativação pública e release não estão autorizados.

## Objetivo

Adicionar um chat flutuante nas páginas comerciais públicas, com respostas baseadas em FAQ configurável e formulário de contato. Reutilizar a identidade Mercúrio, o SVG animado e a gestão de leads existente. A configuração fica em uma nova aba de `/admin/configuracoes`, sem nova rota administrativa.

## Instruções, skill e documentos consultados

- Instruções AGENTS.md fornecidas pelo usuário; não foi encontrado arquivo AGENTS.md no checkout na busca realizada.
- `skills/UX_skills.md`: skill de UI disponível no repositório, correspondente à referência solicitada; acessibilidade, responsividade, animação e redução de movimento.
- `docs/README.md`, `docs/12-finalizacao.md`, `docs/handoffs/12-handoff-fase7.md`.
- `docs/blueprint/01-architecture.md`, `02-roles-permissions.md`, `08-security-compliance.md`.
- `docs/operacao/change-management.md`, `leads-publicos-cpc.md` e `2026-10-29-whatsapp-merx-inbound-pendencias.md`.
- `prompts/2026-10-22-modelo-dados-merx.md`: trata análises privadas futuras, sem presumir que estejam implementadas.
- Não há README.md na raiz. O índice documental consultado é `docs/README.md`. Handoffs antigos não confirmam o estado atual de integrações.

## Código e configurações inspecionados

- `app/package.json`, `app/src/main.tsx`, `app/src/router.tsx`, `app/src/layouts/PublicLayout.tsx`.
- `app/src/pages/Landing.tsx`, `CreditoParaConstrucao.tsx`, `Download.tsx` e rotas públicas de simulação.
- `app/src/pages/admin/Configuracoes.tsx`, `LeadsSimulacoes.tsx`, `app/src/lib/simulacaoLeadPresentation.ts`.
- `app/src/assets/logos/logo.svg`, `app/src/components/BrandLoading.tsx`, `PartnerOnboardingTour.tsx`, `DesktopUpdateWidget.tsx`.
- `app/src/index.css`, configuração Tailwind e dependências instaladas.
- `supabase/functions/public-cpc-lead/index.ts`, `public-simulacao-lead/index.ts`, `public-consulta-protocolo/index.ts`, `app/src/lib/recaptchaV3.ts`.
- Migrations locais de parâmetros do simulador, leads públicos CPC, status comercial e cota administrativa Serasa. Não foi realizada auditoria remota do banco nesta etapa.

## Constatações e decisões propostas

1. `/` e `/download` estão fora de PublicLayout. Esse layout também contém login e links privados por token. Usar um host compartilhado com lista explícita de rotas permitidas; não habilitar indiscriminadamente em PublicLayout.
2. Rotas iniciais: `/`, `/download`, `/simulador`, `/credito-para-construcao`. Não exibir em login, recuperação, bootstrap, magic links, convites, consulta de protocolo, portais autenticados ou páginas privadas por token.
3. O host ficará dentro do contexto do React Router, em um layout sem alteração visual que envolve as rotas atuais e renderiza Outlet + widget. A lista permitida restringe sua montagem e chamadas. Preservar todos os guards existentes.
4. Primeira versão: FAQ determinístico. Perguntas sugeridas e busca textual consultam somente respostas publicadas. Sem correspondência segura, informar que o FAQ não cobre a pergunta e oferecer contato. Não completar respostas por inferência.
5. O conteúdo do FAQ pode ser resolvido no cliente por ser público; dados de contato e toda escrita passam pelo servidor. Sem chamadas a LLM, Serasa ou MCP pelo widget. Reservar a flag interna `ia_habilitada`, sempre `false`, sem controle na UI e sem efeito no comportamento atual; ativação futura exige plano, segurança e aprovação próprios.
6. Usuário autenticado navegando nessas páginas continua no escopo público. Não aceitar `role`, usuário ou proposta do payload como concessão de acesso. A futura MERX privada terá endpoint e autorização próprios, conforme o modelo já documentado.
7. A conversa em texto livre não será persistida. Com opção explícita “Lembrar meus dados neste dispositivo”, guardar localmente apenas nome, e-mail e telefone, após o servidor confirmar o primeiro envio, para pré-preencher formulários futuros; a opção começa desmarcada. Não guardar consentimento, CPF/CNPJ, renda, valores, documentos, texto da conversa, tokens ou IDs internos. Permitir apagar os dados salvos. A retenção/expiração do cache local precisa ser aprovada antes da implementação.
8. Com a opção de lembrança ativa, manter histórico local limitado aos metadados de envios confirmados (data, página de origem, interesse e resultado), sem transcrição nem conteúdo livre. Nunca tratar localStorage como fonte de identidade, autorização, confirmação de consentimento ou prova de envio; a confirmação depende sempre da resposta do servidor. Não carregar ou consultar um lead por API apenas para preencher o formulário.
9. Não há referência visual específica para o chat nesta solicitação. Reutilizar as cores, fontes, campos e cartões existentes; não adicionar biblioteca nem redesenhar as páginas hospedeiras.
10. Leads de simuladores e CPC possuem contratos próprios. Um contato genérico da MERX não será gravado como simulação ou obra fictícia. Propor uma origem adicional na listagem administrativa existente.

## Interface e comportamento

- Acionador flutuante circular com símbolo animado e nome acessível “Abrir MERX”; substitui o botão de vídeo atualmente exibido no widget fechado. O painel tem cabeçalho, fechamento, conteúdo, sugestões e campo de pergunta.
- Painel com dimensões estáveis desde a abertura, altura mínima adequada ao viewport e rolagem somente na área de conteúdo. O campo de entrada tem fundo branco, texto escuro e placeholder com contraste legível.
- Texto inicial identifica o atendimento como assistente de perguntas frequentes. Animação de digitação breve antes da resposta completa, sem anunciar cada caractere ao leitor de tela e sem sugerir que uma pessoa está digitando.
- Ações contextuais para páginas públicas reais: simular, conhecer crédito para construção e solicitar contato. Nenhuma promessa de aprovação, taxa, prazo ou score não publicada.
- Formulário de contato explícito e opcional; campos podem ser pré-preenchidos a partir do cache local somente após opt-in. Consentimento de contato começa desmarcado em cada envio. Estados de envio, sucesso, erro e tentativa novamente; nunca apresentar sucesso sem confirmação do servidor.
- Oferecer ação clara para apagar os dados locais lembrados e histórico de envios. A limpeza local não exclui registros já recebidos pelo servidor; solicitações de exclusão seguem o canal de privacidade.
- Desktop: painel não modal, sem bloquear navegação da página. Mobile: painel adaptado à viewport/teclado, safe areas e comportamento modal acessível quando ocupar a tela. Escape fecha e devolve foco ao acionador; fluxo completo por teclado.
- Todos os botões novos, incluindo aba/configuração e controles do chat, usam `btn-no-liquid`.
- Evitar sobreposição com DesktopUpdateWidget e outros controles flutuantes. Não alterar o funcionamento do updater.

### Símbolo animado

- Reutilizar a geometria e as cores de `app/src/assets/logos/logo.svg` em componente isolado; preservar o asset compartilhado e os consumidores existentes.
- Ajustar o enquadramento ao símbolo: o viewBox atual inclui bastante espaço vazio.
- Animação de montagem uma vez por ciclo, repetida a cada 15 segundos entre inícios. Ao terminar, manter a marca completa, sem a etapa de apagamento presente no SVG atual.
- IDs de gradientes únicos por instância, sem conflitos entre acionador e cabeçalho. Apenas SVG confiável do repositório; upload de SVG/HTML no Admin não integra este escopo.
- Suspender temporizadores ao desmontar/ocultar a aba. Preferência de movimento reduzido mostra a marca montada e respostas imediatas. Não exibir controle Pause; o acionador circular permanece acessível e operável.

## Modelo de dados proposto

### Configuração existente: `configuracoes_sistema`

Reutilizar uma chave `merx_publica`, com JSON validado no servidor:

- `versao_schema`, `habilitado` (inicialmente false), `captacao_habilitada` (false), `ia_habilitada` (reservada, false e sem uso nesta fase).
- `saudacao`, `mensagem_sem_resposta` e lista `faq`.
- FAQ: `id` estável, `pergunta`, `resposta`, `palavras_chave`, `ordem`, `ativo` e ação opcional escolhida de catálogo de rotas públicas permitido.
- Limites de tamanho/quantidade, IDs únicos e conteúdo em texto simples. Sem scripts, HTML arbitrário, URLs livres, prompts internos ou configuração de privilégios.
- Reutilizar `updated_at`/`updated_by` e auditoria existente. Salvar com controle de versão para evitar sobrescrita silenciosa por dois administradores.
- Uma gravação validada publica o conteúdo ativo. A prévia local da aba permite revisar antes de salvar; não adicionar sistema de drafts/versionamento editorial nesta fase.

Contratos propostos: `admin_merx_publica_obter`, `admin_merx_publica_salvar`, `public_merx_config_obter`. Escrita restrita a `app_is_admin_full()` no servidor. Leitura pública devolve apenas a projeção publicada; não abre SELECT anônimo na tabela de configurações. `ia_habilitada` não integra a projeção pública nem habilita chamadas de IA; ativação futura depende de nova aprovação.

Revisar policies permissivas cumulativas antes de adicionar a chave. Impedir bypass da validação por upsert direto, preservando proteções de parâmetros do simulador e demais chaves.

### Contatos: `merx_leads_publicos` (nova origem)

- Obrigatórios: `id` UUID, `idempotency_key` UUID único, `nome_completo`, `email`, `telefone`, `origem` fixa `merx_publica`, `pagina_origem` do catálogo permitido, `consentimento_em`, `consentimento_versao`, `created_at`.
- Opcional: `interesse` de catálogo validado (produtos públicos ou atendimento geral).
- Sem CPF, CNPJ, renda, valor solicitado, endereço completo, anexos, texto da conversa ou vínculo automático a proposta/usuário.
- Consentimento desmarcado por padrão; texto de contato e versão definidos pelo sistema e apresentados com link à política de privacidade. Datas e versão efetiva são gravadas no servidor.
- Inserção somente por Edge Function `public-merx-lead`, com schema estrito. Sem INSERT/SELECT/UPDATE anônimos na tabela.
- Leitura somente por perfis administrativos já autorizados à gestão de leads, via RLS. Partner, team_member e client não acessam esses contatos.
- Reenvio da mesma submissão é idempotente; resposta genérica não revela contato existente. Não mesclar pessoas ou propostas pelo e-mail/telefone automaticamente.
- Aplicar aos contatos a política de retenção/exclusão vigente de leads públicos. Antes de publicar, confirmar que a finalidade e retenção estão cobertas na política; se não estiverem, registrar decisão pendente sem inventar prazo nem criar expurgo automático.

### Integração ao acompanhamento existente

- Estender `v_admin_leads_publicos` com IDs `merx:<uuid>` e origem/tipo identificável, mantendo todas as colunas e registros atuais.
- Dados financeiros/localização ausentes permanecem null e aparecem como “Não informado”; nenhum aumento artificial de volume ou mapa.
- Adicionar FK opcional `merx_lead_id` a `lead_status_comercial`; atualizar constraint para exatamente uma das três origens. Preservar status/histórico atuais.
- Estender `admin_set_lead_status_comercial` com a nova origem, mantendo autorização, auditoria e estados Novo/Em contato/Qualificado. Não qualificar automaticamente por enviar mensagem.
- Adaptar filtros, tipos, detalhe e métricas da listagem existente. Excluir contatos MERX de reenvios de e-mail de simulação e ações que dependam de cálculo/obra. Nenhum envio automático por WhatsApp ou e-mail nesta etapa.

## Segurança e processamento

- reCAPTCHA v3 na submissão de contato, reaproveitando a implementação existente onde aplicável, validado no servidor com action/hostname/score/idade. Nunca criar bypass de produção para resolver domínio localhost.
- Limitar tamanho do body, tamanhos dos campos, frequência de tentativas e honeypot. Limitação server-side com reserva atômica por rede/identificador para não permitir estouro por concorrência.
- Timeouts e falha segura quando config/captcha/banco não responder. Estado indisponível permite navegar para páginas públicas existentes; sem resposta falsa ou captação perdida silenciosamente.
- Nada de tokens privados ou service role no bundle. Não registrar body, perguntas ou dados pessoais em logs, Sentry, URLs ou analytics.
- Renderização escapada, links por catálogo. Permissões validadas no servidor; CORS é camada adicional, não autorização.
- Migration aditiva, sem editar migrations publicadas, sem tocar Serasa, autorização de consultas ou mensagens Meta.

## Arquivos esperados

- `app/src/components/merx/`: host, chat público, símbolo animado e estilos locais.
- `app/src/lib/merxPublica.ts` e testes: contrato público, FAQ e validações reutilizáveis adequadas ao ambiente.
- `app/src/router.tsx`: envolver árvore em host compartilhado preservando guards.
- `app/src/pages/admin/Configuracoes.tsx` e componente de aba MERX pública seguindo a organização existente.
- `app/src/pages/admin/LeadsSimulacoes.tsx`, helpers de apresentação/localização e detalhes de leads somente onde exigido pela nova origem.
- Nova migration em `supabase/migrations/`; `supabase/functions/public-merx-lead/`; configuração de deploy da função pública.
- Testes SQL/RLS/RPC, testes da Edge, testes React e documento operacional com rollout/rollback. Atualização do índice `docs/README.md`.

## Impactos

- Web: widget público, aba administrativa e compatibilidade da listagem de leads.
- Banco/RLS: configuração protegida, origem MERX, view/status existentes estendidos.
- Edge: recebimento seguro de contato; sem provider de IA novo.
- Mobile nativo: sem alteração. Web responsiva coberta.
- Electron: sem empacotamento/updater/release; validar que host não invade rotas internas nem controles do updater.
- Serasa, WhatsApp e MERX privada: pendências preservadas no documento específico, sem ativação nesta fase.

## Critérios de aceite e testes

1. Chat visível apenas nas quatro rotas aprovadas; ausente em rotas privadas/token/login para anônimo e todos os perfis autenticados.
2. FAQ atende conteúdos configurados e devolve fallback em pergunta não relacionada, sem vazar configuração privada nem inventar condição comercial.
3. Admin full edita; anônimo, partner, cliente e admin limitado não conseguem gravar por RPC nem acesso direto. Leitura pública não retorna campos administrativos.
4. Contato válido persiste uma única vez e aparece no painel existente como MERX. Testar entrada inválida, consentimento ausente, captcha inválido/expirado, timeout, concorrência e duplo clique. Sem configuração/RPC, FAQ local permanece visível e captação desabilitada; `habilitado=false` explícito esconde o widget.
5. Simulador/CPC, filtros, mapa, e-mails e status/histórico existentes continuam funcionando; contatos sem valores não contam como crédito zero nem localização presumida.
6. Acionador circular animado substitui o botão de vídeo; símbolo monta, mantém estado final e reinicia no ciclo de 15s; timers limpos em StrictMode/desmontagem; reduced-motion funciona sem controle Pause. Todas as ações livres do efeito líquido.
7. Dados de contato só são salvos após opt-in, pré-preenchem o formulário e podem ser apagados; consentimento permanece desmarcado. Histórico local registra apenas metadados de envios confirmados, nunca conversa; falhas de rede não aparecem como sucesso. Validar retenção/expiração local após decisão do dono do produto.
8. Painel mantém dimensões estáveis, altura mínima responsiva e scroll interno; input branco com texto legível. Testes de teclado, foco/restauração, leitor de tela/live region, contraste, desktop/mobile e zoom de texto. Inspeção visual real com capturas; verificar colisão com overlays/updater e teclado móvel.
9. Executar `npm run lint`, `npm run typecheck`, `npm run build` em `app`, testes automatizados direcionados (Vitest/Edge) e SQL local com RLS por perfil. Registrar comandos e resultados reais; distinguir testes mockados de submissão autenticada/produção.

## Retomada em outro worktree

Este checkout contém a revisão aprovada do plano e artefatos locais de implementação MERX (chat, aba administrativa, Edge Function e migration); esses artefatos não foram auditados integralmente neste handoff. O arquivo do plano está não rastreado pelo Git, portanto não presuma que outro worktree ou clone já recebeu esta versão. Na consulta a `git worktree list` em 2026-10-29, somente `/Users/macbook/Desktop/MercurioCapital` estava ativo; os worktrees em `/private/tmp/` estavam marcados como removidos (`prunable`).

Ao retomar no checkout onde a implementação começou:

1. Confirme o caminho e execute `git status --short`; preserve todas as alterações existentes. Não use reset/checkout para limpar diferenças.
2. Compare este plano com a versão presente no checkout de implementação. Se estiver ausente ou desatualizada, transfira esta versão sem substituir alterações de código nem descartar o plano local existente; resolva diferenças manualmente.
3. Use este arquivo como escopo aprovado: FAQ determinística, `ia_habilitada=false` sem uso, quatro rotas públicas permitidas, cache local de contato e metadados de envio apenas após opt-in e confirmação do servidor, acionador circular animado sem Pause, layout estável com rolagem e input branco.
4. Antes de persistir dados pessoais, obtenha decisão do dono do produto sobre prazo de retenção/expiração. Até lá, não implemente gravação de dados no localStorage; mantenha a conversa não persistida.
5. Inspecione o estado real do código e retome incrementalmente nos componentes MERX existentes; não recrie componentes já implementados e não altere guards, contratos de leads ou componentes compartilhados fora do escopo.
6. Rode verificações locais e registre os resultados neste plano ou no handoff da implementação. Deploy, migrations remotas, ativação pública e release exigem autorização separada.

## Estado desta retomada (2026-10-29)

Correções implementadas neste checkout:

- `app/src/components/merx/MerxPublicChat.tsx`: usa saudação e fallback publicados; mantém FAQ local visível sem configuração/RPC, com captação desabilitada; respeita `habilitado=false` explícito; apresenta “MERX está pensando” por 500 ms antes de escrever progressivamente e anuncia a resposta completa somente ao terminar; movimento reduzido pula a espera; o cabeçalho aberto mostra apenas a asa ao lado de “MERX”, sem o SVG grande; o SVG animado permanece no launcher fechado; mantém a pergunta no rodapé.
- `app/src/index.css`: launcher com largura/altura iguais, aspect-ratio 1:1 e radius 50% mesmo com `btn-no-liquid`; painel com altura previsível e mínimo responsivo; sugestões e atalho de contato fixos junto ao input; scroll interno; X vermelho em botão circular claro para contraste; campos claros com texto legível.
- `app/src/router.tsx`: monta o widget nas quatro rotas comerciais permitidas; `app/src/layouts/PublicLayout.tsx` deixa de adicioná-lo a login, protocolo, magic links e demais rotas públicas genéricas.
- `app/src/test/merxPublicChat.test.tsx`: cobre saudação publicada, ausência de Pause, FAQ visível sem configuração, ocultação por flag explícita, sugestões junto ao input e escrita progressiva.
- `supabase/migrations/20261029000002_merx_public_config_visibility.sql`: altera a projeção pública para distinguir configuração ausente de configuração explicitamente desativada; apenas criada localmente, sem aplicação remota.

Verificações concluídas em `app/`: `npm run test -- src/test/merxPublicChat.test.tsx` (5 testes), `npm run typecheck`, lint focal com ESLint e `npm run build`. Build passou com aviso de chunks acima de 500 kB. O preview local está em `http://127.0.0.1:5174/`; não foi feita captura visual automatizada.

Ainda pendente: definir prazo de retenção/expiração e então implementar opt-in, pré-preenchimento e histórico local de metadados. Nenhuma gravação de contato/histórico no localStorage foi adicionada. Os demais artefatos locais de admin, Edge Function e migration não foram auditados integralmente; não presumir backend/RLS pronto para publicar. Sem aplicar a migration `20261029000002`, a RPC remota antiga ainda pode não distinguir “sem configuração” de “desativada”; nesse caso o fallback mantém a FAQ visível e o toggle administrativo de desligamento não funciona de forma confiável.

## Execução, publicação e rollback

1. A aprovação para implementação local foi registrada em 2026-10-29. Resolver a decisão de retenção do cache antes de implementar persistência local.
2. Implementar e testar localmente, incluindo dados sintéticos isolados; preservar todas as alterações locais preexistentes.
3. Revisar diff, evidências e migration com dry-run no projeto correto. Remoto só na etapa de publicação autorizada, respeitando gestão de mudanças.
4. Publicar backend/migration e preview com flags desativadas; validar config, segurança e captação controlada antes de habilitar em produção. reCAPTCHA exige hostname permitido; não confundir testes locais com homologação remota.
5. Registrar deployment anterior e artefatos de rollback. Em falha, desabilitar widget/captação pelas flags e restaurar frontend anterior; preservar leads e registros de auditoria. Preferir correção aditiva no banco a DROP de tabela/coluna com dados.
6. Build/release Electron, migrations remotas, Vercel e ativação pública têm autorização própria. Este plano não promove o checkout atual inteiro.

## Aprovação registrada

O dono do produto aprovou a implementação local desta base em 2026-10-29: FAQ público determinístico sem IA ativa, flag interna futura desabilitada, as quatro rotas comerciais, cache local de dados de contato e metadados de envios por opt-in, animação circular a cada 15s sem controle Pause, correções de layout/input, aba MERX pública, captação com nova origem integrada ao painel existente e o modelo/RLS descritos. A retenção/expiração do cache segue pendente e bloqueia apenas a implementação da persistência local. Publicações e ativação serão revisadas com o resultado testado e aprovação separada.

## Complemento: FAQ administrável e campo de conversa (2026-10-30)

- `app/src/components/merx/MerxPublicChat.tsx`: uma pergunta sem correspondência agora recebe o fallback sem abrir automaticamente o formulário de contato; o campo continua acessível. O formulário de contato tem ação para voltar às perguntas. “Oi” é reconhecido como saudação por correspondência de palavra, sem falso positivo dentro de palavras maiores.
- `app/src/lib/merxPublica.ts`: contém FAQ inicial determinístico com saudação, captação de lead, Home Equity, construção e simulação. A saudação orienta o visitante sobre captação e opções; as sugestões exibidas priorizam perguntas de serviço.
- `app/src/components/admin/MerxPublicaTab.tsx`: permite editar saudação, fallback e até 20 itens de pergunta, resposta e palavras-chave; valida itens antes do envio e usa botões `btn-no-liquid`.
- `supabase/migrations/20261030000001_merx_public_faq.sql`: adiciona validação server-side dos campos/limites e projeção pública apenas dos campos permitidos; leitura e gravação administrativa exigem `app_is_admin_full()`. Migration local, ainda não aplicada remotamente.
- A conversa e perguntas digitadas não são persistidas nem enviadas a um modelo de IA. O formulário de contato segue como ação explícita. Publicação/deploy continuam pendentes de autorização própria.
