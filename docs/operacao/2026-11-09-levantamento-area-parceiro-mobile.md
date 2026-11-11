# Levantamento — área do parceiro no mobile

Data: 09/11/2026. Escopo solicitado: Perfil e seus atalhos, Carteira, Promoções, Propostas e Início. “Contato de parceria” foi confirmado pelo dono do produto como **Contrato de parceria**; “segurança 214” foi interpretado como o item existente **Segurança & 2FA**.

## Evidência e limites

Este levantamento compara o checkout local, os contratos de banco nas migrations, o catálogo do Supabase local e a documentação. Expo Router instalado: **58.0.30**. O comando `npm run typecheck` em `mobile/` passou nesta análise.

O banco local consultado foi exclusivamente o container `supabase_db_MercurioCapital`, por consultas de catálogo/assinaturas de funções, sem ler valores pessoais nem alterar registros. A existência local de tabelas/RPCs não prova configuração, permissões ou comportamento de produção. Não houve execução de recarga, convite, exportação com dados reais, contrato, migration ou publicação. Navegação e aparência no aparelho ainda precisam de validação depois da implementação aprovada.

## 1. Diagnóstico principal

### 1.1 Uma incompatibilidade de navegação afeta todas as telas secundárias

`mobile/app/(parceiro)/_layout.tsx` declara Universidade, Simulações, Equipe, Relatórios, Comissões, Contrato, Configurações, detalhe de proposta e aula com `options={{ href: null }}`.

Na implementação instalada do Expo Router 58:

- `node_modules/expo-router/build/layouts/TabsClient.js` transforma `href: null` em `hidden: true`.
- `node_modules/expo-router/build/standard-navigation/useVisibleTabsWithRedirect.js` exclui essas rotas de `visibleRoutes` e executa `router.replace()` para uma aba visível quando uma delas recebe foco.

Esse contrato explica a falha comum relatada nos atalhos do Perfil. A barra customizada já renderiza somente os cinco itens de `TABS`, portanto o primeiro ajuste pode manter as telas declaradas/navegáveis e controlar apenas os itens desenhados pela barra. Não é necessário decidir uma nova arquitetura de navegação para testar essa correção mínima. Voltar, histórico e links diretos exigem validação nativa.

### 1.2 Há implementação real, lacunas funcionais e conteúdo demonstrativo misturados

Simulações, Comissões, Equipe, Relatórios, Universidade e Configurações não são rotas vazias: já fazem consultas ao Supabase. Liberar a navegação é o primeiro passo, mas não conclui a paridade funcional nem visual.

Falhas de consulta são frequentemente tratadas visualmente como lista vazia ou valor zero. Isso pode levar o parceiro a interpretar indisponibilidade de dados como ausência de propostas, comissão ou saldo.

## 2. Matriz por tela

| Área | Evidência no código atual | Ajuste necessário |
|---|---|---|
| Perfil | `perfil.tsx`: atalhos reais; Notificações, Segurança e Configurações apontam para a mesma rota sem parâmetro; Central de ajuda não tem `onPress`; avatar de exemplo como fallback; versão fixa `v0.0.1 · Build 1`; KPIs sem erro visível. | Corrigir navegação e destinos; abrir a seção correta; distinguir caixa de notificações de preferências; identidade real/fallback neutro; versão obtida do app; estados de erro e atualização; padronização visual. |
| Simulações | `simulacoes.tsx`: lista até 100 propostas em `simulacao`, `pre_analise`, `analise_credito`; “Nova” abre o wizard de proposta. Não é o simulador rápido comercial documentado na web. Erros de query podem virar estado vazio. | Alinhar ao fluxo aprovado de simulação rápida e passagem explícita para proposta; separar cálculo sem persistência de proposta criada; filtros, validação e feedback. |
| Comissões | `comissoes.tsx`: lê `comissoes` e relaciona proposta/cliente; valores em reais convertidos em centavos para exibição; tem loading/erro/filtros. “Próximo recebimento” é a comissão aprovada mais antiga, sem data de pagamento prevista. | Restaurar acesso; conferir valores com o financeiro; não apresentar ordenação por criação como agenda de recebimento; usar regras reais de comissão; padronizar filtros, datas e estados. |
| Equipe | `equipe.tsx`: lê `equipes`, `v_equipe_membros_detalhe`, `v_equipe_convites_pendentes`; usa RPCs existentes de criação/convite/remoção e mostra fallback de link manual. Perfil e ações também são apresentados a `team_member`. | Restaurar acesso, refletir permissões no menu e ações, manter controles do backend; conferir aceite de convite/login e retorno; erros de cada lista e invalidação após mutações. |
| Relatórios | `relatorios.tsx`: views reais de funil/série; produtos limitados a 5.000 registros; estágios antigos hardcoded; nenhum período selecionável; botão PDF mostra “Em breve”; CSV tenta abrir arquivo local com `WebBrowser`. | Período e filtros reais, etapas canônicas por produto, contagens/volumes coerentes, exportação/compartilhamento nativo; reutilizar renderer/identidade de relatórios existentes quando compatíveis. PDF não está entregue nesta tela. |
| Universidade | `universidade.tsx` e `aula/[id].tsx`: catálogo, inscrição, progresso, player Vimeo, recursos e certificados reais; filtro “Em andamento” não inclui inscrição com 0%, embora o contador inclua; falha do catálogo pode aparecer como vazio; rota de aula também está oculta no Tabs. | Restaurar catálogo/player, alinhar filtros e contadores, estados de assinatura/acesso/erro, retorno e recursos; confirmar certificados e persistência de progresso. |
| Contrato de parceria | `contrato.tsx`: cláusulas, percentuais, dados Mercúrio e “Construtora Aurora Ltda.” fixos; CNPJs e endereços de exemplo; geração/compartilhamento de PDF a partir desse conteúdo, sem vínculo a contrato real do parceiro. A página web também contém texto/tabela fixos e não deve ser adotada como verdade contratual por simples cópia. | Definir e aprovar a fonte oficial e a finalidade do documento. Não apresentar nem distribuir o exemplo como contrato individual. Até definir a fonte, usar estado explícito de documento indisponível ou minuta demonstrativa, conforme decisão do dono do produto. |
| Notificações | O sino do Início usa `NotificationsSheet`, tabela real `notificacoes`, Realtime e RPCs de leitura. O item do Perfil abre Configurações/Empresa. Preferências existem em `partner_notif_prefs`. | Fazer o item abrir a caixa real; manter preferências como uma ação distinta; conferir destino de cada link, leitura individual/todas e erros. Push do sistema operacional é outra integração, não comprovada pelo toggle de preferência. |
| Segurança & 2FA | Configurações/Segurança oferece apenas recuperação de senha e logout. Há `/2fa/setup` e `/2fa/challenge` reais, mas sem gerenciamento pelo Perfil. Login verifica AAL, porém prossegue se a checagem lançar erro. Blueprint diz 2FA obrigatório para parceiro. | Ligar o gerenciamento real ao atalho; verificar política vigente e paridade com o web antes de mudar exigências; distinguir TOTP de Face ID/código do aparelho, já usado para desbloqueio local. |
| Configurações | `configuracoes.tsx`: abas Empresa, Notificações, Integrações e Segurança; sempre inicia em Empresa; perfil e preferências usam RPCs; integrações são cartões “Em breve”; validações e feedback de carga/erro são parciais. | Abrir seção por parâmetro, formulários e validação consistentes, save/error/dirty state, permissões por papel; recursos não implementados não podem aparentar conexão ativa. |
| Carteira | `carteira.tsx`: resumo/RPC, extrato/preços reais, Edge `wallet-topup`; usa browser/retorno custom scheme; polling escolhe a última recarga recente, sem correlacionar pelo `topup_id` retornado; cache de saldo do Dashboard usa outra chave. | Fonte financeira real, correlação da recarga exata, atualização entre telas, erro/pendência/cancelamento/timeout; membro somente leitura; validar retornos do checkout antes de cobrança real. |
| Promoções | `promocoes.tsx`: metas/prêmios/imagens fixos; calcula volume usando apenas `contrato_registrado` e `recurso_liberado`, chama tudo de CGI/liberação e usa teto fixo de R$ 100 mi. | Usar `partner_milestones_progress()` e `partner_milestones`, como a web, incluindo metas/imagens ativas e maior meta dinâmica. Aplicar semântica documentada: valor solicitado elegível de qualquer produto, e não liberação efetiva. |
| Propostas | `propostas.tsx`: lista até 200; busca só nome/CPF/protocolo; não inclui razão social/CNPJ; “dias na etapa” vem de `updated_at` com destaque após 7 dias. Dicionário compartilhado antigo omite etapas novas e chama `resolucao_pendencias` de Pré-análise. | Filtros/paginação, PF/PJ, rótulos canônicos e tempo real de entrada na etapa; não reaproveitar RPC Admin no parceiro; não alterar status ao corrigir visualização. |
| Detalhe da proposta | `propostas/[id].tsx`: resumo/proponentes/imóveis/histórico e download de modelo; não contém abas de documentos/pendências/consultas como a web; chat e avanço de etapa mostram “Em breve”. | Levantar paridade por ação antes de habilitar; preservar processo/servidor e acesso; evitar CTA sem função; integrar documentos/pendências usando contratos existentes dentro de fase aprovada. |
| Início | `dashboard.tsx`: perfil/KPIs/propostas/carteira reais; erro pode virar zero/vazio; status/PJ herdados dos mapas antigos; cache financeiro separado; dados não seguem um único mecanismo de atualização. | Concluir após os módulos-base: resumo confiável, acesso às ações reais, unidade monetária consistente, estados de erro/zero separados e atualização ao retornar. |

## 3. Dados existentes confirmados

O catálogo local confirma estas fontes (não criar tabelas equivalentes):

| Domínio | Entidades/relacionamentos | Leitura/escrita existente |
|---|---|---|
| Identidade | `usuarios 1:1 partners` pelo `partners.usuario_id`; `partner_get_profile` faz esse vínculo do dono. Membro não possui automaticamente um registro `partners` próprio. | `partner_get_profile`, `partner_update_profile`; perfil de membro precisa respeitar sua identidade e o vínculo com equipe. |
| Equipes | `partners 1:N equipes 1:N equipe_membros`; membro referencia `usuarios`; convites em `magic_links`. | Views de membros/convites e RPCs `partner_create_equipe`, `partner_invite_membro`, `partner_remove_membro`. |
| Comissões | `comissoes` referencia `propostas`, `partners` e opcionalmente `liberacoes_recurso`; `valor` em reais, `percentual` em %. | Leitura pelo parceiro; aprovação/pagamento pela equipe interna via RPCs já existentes. Não editar pelo app do parceiro. |
| Carteira | `partner_wallets`, `wallet_ledger`, `wallet_topups`, `precos_consulta`. | `partner_wallet_summary`, `v_wallet_extrato`, `wallet-topup`, webhook. Saldos/preços em centavos. |
| Universidade | `cursos → modulos → aulas`; inscrição/progresso/certificados por usuário. | `v_lms_catalogo`, `v_lms_curso_estrutura`, `lms_inscrever`, `lms_marcar_aula`, `certificado-gerar`. |
| Notificações | `notificacoes` por usuário; preferências por `partner_id + evento`. | Caixa Realtime e RPCs de marcação; `partner_notif_prefs_list/upsert`. Preferência não comprova entrega do canal. |
| Milestones | `partner_milestones` define metas, prêmio e imagem; progresso deriva de propostas elegíveis. | `partner_milestones_progress()` e catálogo ativo; ambos existem no banco local. |
| Métricas | `v_partner_dashboard_kpis`, `v_partner_funil_status`, `v_partner_propostas_por_mes`; todas possuem `partner_id`. | Reconciliar escopo por parceiro/equipe e definições com as fontes canônicas. Volume ganho, solicitado e liberado são conceitos diferentes. |

O contrato de parceria individual **não foi identificado como fonte real consumida pela tela atual**. A tabela `contratos` das operações não deve ser assumida como contrato de credenciamento do parceiro.

## 4. Segurança e consistência transversal

- Os menus do Perfil/FAB são iguais para `partner` e `team_member`, apesar de Equipe, Configurações e recarga terem restrições documentadas. O backend de criação de equipe e `wallet-topup` checa `role=partner`; o mobile deve refletir essas restrições.
- Várias queries têm chaves globais sem usuário/parceiro. `mobile/lib/auth.tsx` não limpa o `QueryClient` ao sair/trocar de conta. Há risco de conteúdo em cache da sessão anterior ser exibido temporariamente; isso exige teste de duas contas, sem concluir que a RLS está incorreta.
- As chamadas diretas `fetch` a Edge Functions em Carteira/Relatórios/certificado não usam o mesmo caminho `supabase.functions.invoke` já padronizado em outros fluxos. Revisar cabeçalhos, renovação de sessão e tratamento de erro; não assumir falha real de gateway sem teste.
- Valores de carteira usam centavos; propostas, comissões e volumes das views usam reais. Não aplicar multiplicação duas vezes nem somar dinheiro de universos diferentes.
- O helper `isPropostaAprovada` é permissivo para qualquer status desconhecido fora de uma denylist antiga. Conferir estados novos e `standby` antes de apresentar contrato como disponível.
- O esquema de retorno `mercurio://carteira/recarga` precisa ser validado com o Router atual e o checkout. Não houve tentativa real nesta análise.

## 5. Padrão visual que já existe

O app tem tokens preto/branco/vermelho em `mobile/tailwind.config.js`, mas o parceiro alterna telas claras, telas escuras, dourado literal (`#FFD700`), cores azuis em destaques e estilos legados. `KPICard` tem textos brancos mesmo quando usa o fundo branco padrão. Os paddings inferiores variam de 24/32/40 a 130, apesar da barra/FAB sobrepostos; telas secundárias podem ficar cobertas. Há fontes de 9–10 px e ações pequenas.

Base disponível para reaproveitamento: onboarding e área Cliente recentemente ajustados, incluindo superfícies escuras, borda neutra, ações vermelhas, cabeçalhos, feedback e botões nativos em `mobile/components/cliente/ClienteUI.tsx`. Componentes ligados ao papel Cliente não devem ser reutilizados diretamente como containers de Parceiro porque contêm destinos de navegação próprios; extrair/reutilizar apenas os padrões neutros quando aprovado.

A proposta de padronização é usar esses padrões já aprovados, mantendo a barra de cinco abas. Antes de codificar o novo visual, o dono do produto deve confirmar essa base ou fornecer outra referência. Não criar outro tema nem adicionar biblioteca.

## 6. O que a documentação diz e onde está desatualizada

| Fonte | Uso correto neste trabalho |
|---|---|
| `docs/09-roadmap.md`, Fase 11, e `docs/12-finalizacao.md`, seção 2.3 | Reconhecem mobile parcial, mas ainda listam SecureStore/login real como pendentes e citam área Admin mobile. São snapshots históricos e não descrevem sozinhos o checkout de novembro. |
| `mobile/README.md` | Mais recente: SDK 58, Auth/SecureStore/desbloqueio, áreas Cliente/Parceiro e remoção de Admin. Ainda tem “próximos passos” de instalar imagens/conectar Supabase e marca áreas inteiras como concluídas, sem refletir os problemas encontrados. |
| Handoffs `12` e `13` | Fontes dos contratos de comissões/LMS, unidades monetárias, RLS e aceitação. As tarefas antigas de criar schema não significam que ele ainda falta. |
| Handoffs `14` e `15` | Onboarding, equipe e convites; a extensão mobile era parcial. Não reabrir Admin no app. |
| Handoffs `16` e `17` | Checklist/documentos, modelo de contrato de proposta, evolução PF/PJ/wizard e regras de acesso. Não equivalem a contrato comercial do parceiro. |
| Handoffs `18`, `19` e `20` | Evoluções posteriores de documentos/financeiro/dashboard Admin. Reforçam fonte real, valores distintos e aprovação separada de publicação; não atestam entrega no parceiro mobile. |
| `docs/blueprint/06-modules-features.md`, M14 | Define milestones configuráveis e RPC de progresso; diverge do mobile hardcoded. |
| `docs/blueprint/03-routes-navigation.md`, `02-roles-permissions.md` | Matriz partner/team_member e navegação; possuem referências históricas Admin mobile a reconciliar com a decisão recente de manter somente Cliente/Parceiro. |

Atualizar a situação corrente em documento operacional e links no README, preservando os snapshots e evidências históricas de publicação.

## 7. Ordem de execução proposta

1. **Perfil e navegação:** compatibilidade com SDK 58, atalhos corretos, acesso por papel, caixa de notificações, segurança/configurações, cache por sessão e base visual aprovada. Validar todas as rotas que estavam ocultas antes de diagnosticar novos erros como backend.
2. **Módulos acessados pelo Perfil:** Simulações, Comissões, Equipe, Relatórios, Universidade e fonte oficial do Contrato de parceria. Separar em entregas revisáveis, sem promessas falsas de prazo/pagamento/prêmio.
3. **Carteira:** reconciliação do saldo/extrato e retorno/polling da recarga exata; leitura para membro.
4. **Promoções:** catálogo e regra de progresso canônicos; imagens/configuração do Admin.
5. **Propostas e detalhe:** PF/PJ, filtros, etapas e data real de entrada, documentos/pendências dentro do escopo aprovado, estados consistentes.
6. **Início:** consolidar os dados e componentes já reconciliados; KPIs e atalhos sem duplicar lógica de negócio.

Plano correspondente: `prompts/2026-11-09-area-parceiro-mobile-funcional-visual.md`.

## 8. Validação necessária por entrega

- No iPhone: tocar em cada atalho, permanecer no destino, voltar, trocar abas, abrir link direto e verificar que a última ação/lista não fica sob barra ou FAB.
- Sessão: parceiro aprovado, pendente/suspenso, membro permitido e conta sem acesso; sair da conta A e entrar na B sem mostrar dados antigos.
- Dados: loading, erro de rede, retry, vazio real, valores zero reais, PF/PJ, formatos BRL/data e ausência de dado sem invenção.
- Funções: preferências persistem; notificações marcam leitura e abrem destino correto; MFA tem estado real; convites respeitam papel; certificado/progresso persistem.
- Dinheiro: conferência read-only de comissões, saldo/extrato e milestones. Teste de pagamento somente em ambiente autorizado e com correlação do `topup_id`.
- Automação: typecheck, lint aplicável, testes focados com dados sintéticos e export dos bundles iOS/Android; build nativo/publicação em gate separado.

No Lote 1 local foram executados typecheck mobile, ESLint focado, 9 testes com dados sintéticos e export dos bundles iOS/Android. A caixa de notificações também foi corrigida para compartilhar uma única assinatura Realtime entre Início e Perfil, causa do erro `cannot add postgres_changes callbacks ... after subscribe()`. A autenticação local mantém a tela MFA montada sob o modal de bloqueio quando o usuário alterna para o autenticador.

A auditoria não equivale a homologação funcional/visual em produção. Permanecem pendentes o teste no iPhone, os demais lotes, a fonte oficial do Contrato de parceria e qualquer publicação/build nativo.
