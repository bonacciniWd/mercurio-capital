# Plano — área Parceiro mobile: Lote 2 (atalhos do Perfil)

Data: 09/11/2026. Estado: implementação local aprovada, aguardando homologação no aparelho. O dono do produto informou que o Lote 1 e o ajuste visual de Login foram 100% validados no aparelho. Este lote cobre os atalhos operacionais do Perfil; não inclui Carteira, Promoções, Propostas ou Início, que permanecem nos lotes seguintes.

## Objetivo

Fazer os atalhos **Simulações, Comissões, Equipe, Relatórios, Universidade e Contrato de parceria** funcionarem de ponta a ponta no app e seguirem a identidade visual já aprovada para o Parceiro (fundo escuro, superfícies neutras, acentos vermelhos e tipografia legível). Reaproveitar fluxos, consultas, cálculos e limites de acesso existentes. Não criar contrato demonstrativo nem dar a entender que a prévia de simulação é uma proposta aprovada.

## Skills e documentação consultadas

- `AGENTS.md` fornecido nesta conversa: plano/aprovação antes de código, segurança, stack e testes.
- `skills/UX_skills.md`: revisão de fluxo, acessibilidade, alvos de toque, estados e consistência visual.
- `docs/README.md` e `docs/operacao/2026-11-09-levantamento-area-parceiro-mobile.md`.
- `prompts/2026-11-09-area-parceiro-mobile-funcional-visual.md`: escopo aprovado, identidade visual e matriz de lotes.
- `docs/blueprint/02-roles-permissions.md`, `docs/blueprint/03-routes-navigation.md`, `docs/blueprint/06-modules-features.md` e `docs/blueprint/07-integrations-flows.md`.
- `docs/handoffs/13-handoff-fase8.md`, `docs/handoffs/14-handoff-fase9.md`, `docs/handoffs/15-handoff-fase10.md` e `docs/12-finalizacao.md`.
- Código web de referência das telas de Simulações, Comissões, Equipe, Relatórios e Universidade; implementação mobile atual dessas telas e do player.
- Migrations/fontes já existentes de comissões, equipe, universidade, métricas e exportação. Nenhuma entidade nova foi identificada como necessária.

## Código/configuração inspecionados

- Mobile: `mobile/app/(parceiro)/{_layout,perfil,simulacoes,comissoes,equipe,relatorios,universidade,contrato}.tsx`, `mobile/app/(parceiro)/aula/[id].tsx`, `mobile/app/propostas/nova.tsx`, `mobile/lib/{credito,partner,partnerAccess,auth}.ts(x)`, `mobile/components/parceiro/PartnerUI.tsx` e dependências existentes em `mobile/package.json`.
- Web: `app/src/pages/partner/{Simulacoes,Comissoes,Equipe,Relatorios,UniversidadeLista,UniversidadePlayer,Contrato}.tsx`, componentes `SimuladorCredito` e helpers de simulação.
- Backend existente: `supabase/functions/relatorios-exportar`, RPCs `simulador_parametros_publicos`, `partner_create_equipe`, `partner_invite_membro`, `partner_remove_membro`, `lms_inscrever`, `lms_marcar_aula`; views de equipe, funil e LMS.
- Modelo: `comissoes` não contém data prevista de pagamento; `aprovada_em` e `paga_em` registram eventos reais. `relatorios-exportar` aceita filtros de status/produto/período e responde CSV sob JWT/RLS. O contrato individual de credenciamento não tem fonte oficial confirmada.

## Decisões e suposições

1. O padrão visual e a navegação base do Lote 1 foram validados pelo dono do produto; reaproveitar `PartnerScreen`, `PartnerCard`, botões e tokens existentes, sem reabrir identidade ou arquitetura.
2. **Simulações:** substituir a tela que hoje lista propostas por uma simulação comercial rápida baseada no modelo web. Usar as premissas públicas existentes e cálculo Price/SAC do domínio mobile. A simulação será transitória; converter para proposta somente pelo wizard existente, preenchendo apenas os campos financeiros compatíveis e mantendo cadastro, revisão e envio normais. Compartilhamento, quando oferecido, é texto nativo; não instalar biblioteca nem prometer PDF nesta etapa.
3. **Comissões:** manter leitura sob RLS e moeda do banco em reais, formatada em BRL. Remover a alegação “Próximo recebimento”, pois não há previsão de pagamento no modelo. Exibir somente datas/estados persistidos (criação, aprovação e pagamento), sem inferir agenda.
4. **Equipe:** tela e convites são exclusivos do papel autorizado pelo código/política (`partner` dono); membro de equipe recebe explicação/estado somente leitura ou não vê o atalho. Reutilizar RPCs existentes; não disparar convites reais em testes.
5. **Relatórios:** permitir filtros de período, produto e status e exportar CSV usando `relatorios-exportar` com JWT e filtros selecionados; compartilhar o arquivo pelo mecanismo nativo já instalado. Não implementar PDF/XLSX nem ampliar o Edge Function nesta entrega. Qualquer botão sem suporte não deve parecer ativo.
6. **Universidade:** manter catálogo, inscrição, progresso, player, recursos e certificados atuais; corrigir filtros/contadores e estados de carregamento, vazio e falha sem esconder erros como catálogo vazio. Preservar URLs assinadas e RPCs de progresso/certificado.
7. **Contrato de parceria:** preservar a página de indisponibilidade explícita. Não produzir/exportar conteúdo de exemplo. O arquivo oficial e a finalidade do documento continuam pendentes de fonte fornecida/aprovada.
8. Sem tabelas, migrations, novas RPCs/Edge Functions, dependências ou alterações web. Não publicar, registrar convites, gerar cobrança ou mudar políticas remotas.

## Modelo de dados

Sem novos registros principais ou mudanças de esquema. Reutilizar:

- Simulação transitória: estado local de parâmetros e resultados; não persiste proposta até o usuário entrar no wizard e confirmar o fluxo já existente.
- Comissão: `comissoes → propostas → clientes`, sob sessão/RLS do parceiro. Valores são reais e `aprovada_em`/`paga_em` são as únicas datas para os respectivos estados.
- Equipe: `partners → equipes → equipe_membros` e convites existentes em `magic_links`; criação/convite/remoção somente pelas RPCs autorizadas.
- Relatório: `propostas` sob RLS para métricas do mesmo recorte de criação, produto e status; export do conjunto de propostas via Edge `relatorios-exportar`, com os mesmos filtros e autorização existentes. A consulta e a Edge limitam o recorte a 5.000 linhas; a tela avisa quando esse limite é atingido.
- Universidade: `cursos → modulos → aulas`, inscrições, progresso e certificados; mutações somente pelas RPCs/Edge existentes.
- Contrato de credenciamento: nenhuma fonte individual confirmada; nenhum registro será criado nem a tabela de contratos operacionais será presumida como equivalente.

## Arquivos esperados

- `mobile/app/(parceiro)/simulacoes.tsx` e, se a organização atual pedir, um componente de simulador mobile no diretório existente `mobile/components/parceiro/`.
- `mobile/app/(parceiro)/comissoes.tsx` e `equipe.tsx` para corrigir significado, escopo e visual.
- `mobile/app/(parceiro)/relatorios.tsx` para filtros/exportação nativa CSV.
- `mobile/app/(parceiro)/universidade.tsx` e `aula/[id].tsx` somente nos estados/filtros e apresentação do fluxo aprovado.
- `mobile/app/(parceiro)/perfil.tsx` e `_layout.tsx` somente se o menu precisar refletir autorização/destinos deste lote.
- Helper transitório de simulação e testes focados no domínio de cálculo/filtros, apenas se necessários para manter o contrato claro.
- Atualização deste plano com o resultado da implementação após aprovação e validação.

## Critérios de aceite

- Cada atalho acessível do Perfil abre a tela certa, permite voltar e respeita parceiro dono versus membro.
- Simulação permite selecionar produto, PF/PJ e premissas compatíveis, apresenta resultado e ressalvas financeiras, calcula valores no padrão da web e converte para proposta sem persistir silenciosamente nem perder os dados financeiros ao abrir o wizard.
- Comissões mostram totais por status, filtro, detalhe da proposta e datas corretas; nenhum card chama comissão de pagamento futuro sem data no banco.
- Equipe permite as ações já autorizadas, atualiza as listas após sucesso e trata falha/convite pendente sem alegar envio quando houve apenas criação de link. Teste não envia convite real.
- Relatórios apresentam filtros aplicados aos dados e ao CSV; a exportação usa a sessão atual, respeita RLS, baixa/compartilha arquivo no iOS/Android e mostra erros sem expor dados internos. PDF/XLSX não aparece como ação implementada.
- Universidade distingue erro de consulta, catálogo vazio, inscrição, curso em andamento e conclusão; progresso e certificados continuam vinculados ao usuário correto; recurso privado usa URL assinada válida.
- Contrato permanece claramente indisponível até haver fonte oficial; nenhum dado demonstrativo aparece como obrigação.
- Visual alinhado à referência já aprovada, responsivo a telas iPhone, com texto legível, alvos confortáveis, safe area e estados de loading/erro/vazio/sucesso.

## Segurança e impacto

- Dados privados continuam no Supabase com JWT e RLS; nenhuma service role, senha ou segredo no cliente.
- Exportação é explicitamente iniciada pelo usuário, limitada pelo escopo de sessão/RLS e compartilhada pelo sistema operacional; não persistir cópia permanente de dados privados.
- Não desativar RLS nem chamar endpoints Admin na área Parceiro.
- Convite/criação/remoção de membro são mutações reais: usar testes automatizados/mocks e validação manual sem convidar ou remover usuário de produção.
- Nenhum pagamento, recarga, certificado real, alteração remota, migration, Edge deploy, build de produção, publicação ou GitHub Actions neste lote.

## Verificações

- Mobile: typecheck, lint focado, testes existentes e novos testes de cálculo/conversão/filtros; `git diff --check`; export dos bundles iOS e Android.
- Inspecionar diffs para garantir que outros lotes e alterações preexistentes do checkout permaneçam intactos.
- Homologação manual no iPhone com sessão de teste: Perfil → Simulação → prévia e entrada no wizard sem envio; Comissões (estados e filtros); Equipe sem enviar convite; Relatórios com e sem filtros e compartilhamento CSV; Universidade (catálogo, player, progresso/recurso/certificado); Contrato indisponível.
- Cobrir loading, erro e vazio; validar papel de membro versus dono sem gravar dados ou convites reais.
- Build nativo/distribuição e qualquer publicação permanecem gates separados.

## Rollout e rollback

Implementar localmente como lote isolado, mantendo a base do Lote 1. Revisar somente os arquivos allowlisted deste lote. Reverter pelo diff deste lote sem alterar migrations ou dados. Após homologação local, lotes 3–6 continuam independentes.

## Execução local

- Simulação comercial, prévia Price/SAC, compartilhamento nativo e preenchimento transitório do wizard implementados.
- Comissões exibem estados e datas persistidas sem alegar previsão de recebimento. Equipe restringe acesso ao parceiro responsável e preserva as RPCs existentes.
- Relatórios aplicam o mesmo recorte nos indicadores e no CSV compartilhado pelo sistema. PDF/XLSX permanecem fora deste lote.
- Universidade inclui inscrições com 0% em “Em andamento”, mostra falhas separadas dos vazios e recebeu ajuste visual escuro no catálogo e player.
- `npm run typecheck` e `node --test tests/*.test.mjs` passaram; export dos bundles iOS e Android passou. Homologação visual/funcional autenticada no aparelho ainda é necessária.
