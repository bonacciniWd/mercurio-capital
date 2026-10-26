# Plano — reformulação visual dos leads do simulador

## Objetivo e aprovação

Reorganizar `/admin/leads/simulacoes` para facilitar a leitura dos leads e a consulta dos detalhes pela equipe interna Mercúrio.

O usuário confirmou a direção: **tabela mais legível, com detalhes em painel lateral**. O print enviado registra a tela atual. A especificação abaixo é a proposta de execução dessa direção; sua aprovação é necessária antes de alterar o código, conforme o AGENTS.md fornecido na conversa.

Status: aprovado, implementado e validado localmente em 2026-10-08.

## Documentos e skills consultados

- AGENTS.md fornecido pelo usuário nesta conversa.
- `docs/README.md` e `docs/operacao/change-management.md`.
- `docs/operacao/simulador-publico.md`.
- `docs/blueprint/01-architecture.md` e trecho de permissões do módulo em `docs/blueprint/02-roles-permissions.md`.
- `docs/handoffs/20-handoff-fase2-1-dashboard-ui.md`.
- `.github/agents/ux-ui-mercurio-capital.agent.md`, como orientação local de interface.
- Captura de tela fornecida pelo usuário e escolha de organização confirmada no chat.
- Nenhuma skill adicional é necessária: o trabalho usa componentes React/Tailwind existentes e não exige geração de imagens ou nova biblioteca.

## Código inspecionado

- `app/src/pages/admin/LeadsSimulacoes.tsx`: consultas, filtros, tabela, paginação, detalhes e WhatsApp.
- `app/src/components/ui/button.tsx`, `date-range-picker.tsx`, `reason-dialog.tsx`: controles locais, calendário e comportamento de diálogo.
- `app/src/index.css`: estilos globais de botões, campos e cards.
- `app/src/pages/admin/Relatorios.tsx`: uso dos controles administrativos existentes.
- `app/src/components/PublicSimulator.tsx` e `PublicAmortizationSimulator.tsx`: rótulos dos tipos e situações de imóvel.
- `app/src/lib/mensagensSimulador.ts`: mensagem dinâmica e normalização do telefone.
- `app/src/router.tsx`, `app/src/lib/adminScope.ts` e `app/src/test/adminScope.test.ts`: acesso à rota.
- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql`: acesso admin à tabela/view.
- `app/package.json`: stack e comandos locais.

## Diagnóstico

- A tabela divide a atenção entre sete colunas e vários textos pequenos; imóvel e perfil competem com contato e valor da simulação.
- O bloco de detalhes aparece depois da tabela, repetindo dados e exigindo deslocamento vertical para conferir o lead selecionado.
- Botões de leitura, paginação e contato recebem o mesmo acabamento escuro com relevo, por herança do CSS global.
- Há valores técnicos visíveis (`casa_condominio`), CEP sem máscara e campos ausentes que podem ser apresentados como zero.
- O filtro de busca e os campos com legenda não compartilham o mesmo alinhamento vertical.

## Especificação proposta

### Estrutura e identidade visual

- Manter título, descrição e contagem de resultados, com organização consistente com o admin.
- Limitar o conteúdo a aproximadamente 1600 px, centralizado em telas largas; largura disponível em telas menores.
- Usar branco/cinza, texto escuro e vermelho Mercúrio, seguindo o handoff mais recente do dashboard e os componentes `ui/button`.
- Tipografia principal de 14–16 px; metadados de 12–13 px; contraste legível para textos secundários.
- Controles com 44 px de altura e foco visível. Separadores suaves e espaçamento consistente, sem mudar o CSS global.

### Filtros

- Uma faixa com busca flexível, data inicial, data final e estado do e-mail, alinhados pela base dos campos.
- Preservar busca por nome/e-mail/telefone, datas opcionais e semântica atual do filtro de e-mail (prospect ou interno).
- Usar seleção de data localizada em pt-BR com os recursos já instalados de calendário/popover; permitir limpar cada limite independentemente.
- O `DateRangePicker` atual exige início e fim válidos: não adotá-lo sem adaptação que preserve os intervalos abertos. Preferir um controle local, sem alterar o contrato usado por Relatórios.
- Reorganizar filtros em duas colunas ou uma coluna conforme a largura, mantendo rótulos visíveis.

### Tabela desktop

| Coluna | Conteúdo |
| --- | --- |
| Lead | Nome destacado, e-mail e telefone formatado |
| Simulação | Home Equity ou Amortização; Price/SAC quando aplicável |
| Crédito | Valor simulado, parcela estimada/primeira parcela e prazo |
| E-mails | Estados separados de prospect e equipe, com texto e cor semântica |
| Recebido | Data brasileira e horário em linhas distintas |
| Ações | Abrir detalhes e atalho compacto de WhatsApp com nome acessível |

- Mover imóvel, perfil, origem, LTV e demais detalhes para o painel lateral, preservando sua consulta.
- Destacar discretamente a linha selecionada.
- Manter tabela semântica, cabeçalhos e ações explícitas; não transformar toda a linha em botão que interfira com links.
- Preservar ordenação por recebimento, paginação de 50 itens e limite atual da consulta. A contagem representa o conjunto carregado/filtrado, sem inventar métricas globais.
- Em telas estreitas, conter a rolagem horizontal na tabela; filtros e ações continuam acessíveis sem ampliar a página inteira.

### Painel lateral de detalhes

- Abrir pela direita, sobre a tela, com largura máxima aproximada de 600 px, altura da viewport e fundo sombreado. No mobile, ocupar a largura disponível.
- Manter o contexto da lista e a página atual ao abrir/fechar.
- Cabeçalho com nome, tipo da simulação, data de recebimento e botão de fechar.
- Organizar conteúdo em: contato; operação; imóvel; perfil e intenção; e-mails; planos de amortização e comparativo, quando aplicáveis.
- Destacar crédito e parcela estimada/primeira parcela; exibir totais do comparativo já recebido, sem recalcular valores financeiros no painel.
- Mostrar os planos existentes e distinguir ausência de plano de ausência de comparativo em registros anteriores.
- Ação de WhatsApp no rodapé do painel, usando a mensagem configurada e os parâmetros atuais.
- Corpo com rolagem própria; fechamento por botão, Escape e clique no fundo. Foco inicial, retenção do foco dentro do diálogo e retorno ao botão de abertura ao fechar. Bloquear rolagem/interação com o fundo enquanto aberto.

### Formatação e estados

- Rótulos humanos conforme o simulador: por exemplo, `casa_condominio` → “Casa em condomínio” e `comercial` → “Sala comercial”.
- CEP `00000-000`, telefone com DDD, moedas em BRL e taxas com vírgula decimal.
- Usar o tratamento existente de datas civis para data inicial; preservar a representação dos timestamps de recebimento em pt-BR.
- Campos ausentes mostram “Não informado” ou “—”; zero informado continua sendo zero.
- Carregamento, erro, lista vazia e filtro sem resultados têm mensagens claras e layout coerente.
- Telefone inválido mantém contato indisponível; nenhum link de WhatsApp deve ser construído com um destino incorreto.

## Modelo de dados e decisões de escopo

- Não haverá nova tabela, coluna, RPC ou registro. A tela continua somente leitura.
- Fontes existentes: `v_admin_simulacao_leads_publicos` e `config_mensagens_simulador`.
- Seleção de lead, abertura do painel, filtros e paginação são estado local de interface.
- Preservar acesso da equipe interna conforme guards/RLS existentes, incluindo os níveis admin já autorizados para a rota.
- Preservar compatibilidade com leads antigos, sem planos ou resumo de amortização.
- Não introduzir status comerciais, distribuição, classificação, métricas, exportação, automação de contato ou novo filtro de negócio nesta mudança.
- Não alterar a calculadora pública, o motor financeiro nem o editor de mensagens.
- O worktree contém trabalho anterior ainda não commitado; preservar todas as alterações preexistentes.

## Arquivos previstos

- `app/src/pages/admin/LeadsSimulacoes.tsx`: composição visual, filtros, tabela e integração do painel.
- `app/src/components/SimulacaoLeadDetalhe.tsx`, se a separação do painel facilitar a manutenção.
- `app/src/lib/simulacaoLeadPresentation.ts`, se necessário para centralizar tipos e formatação usados pela lista e pelo painel.
- `app/src/test/adminLeadsSimulacoes.test.tsx`: cobertura das interações alteradas, com Supabase mockado.
- `docs/operacao/simulador-publico.md`: atualização do comportamento da tela interna após validação.

## Impacto e segurança

| Área | Impacto |
| --- | --- |
| Web admin | Reformulação visual e abertura de detalhes |
| Web público | Não afetado |
| Mobile nativo | Não afetado; validar responsividade da rota web |
| Banco, migrations e RLS | Não afetados |
| Edge Functions e integrações | Não afetadas |
| Electron/updater | Interface herdada do web; nenhum empacotamento ou atualização de versão |
| Operação/deploy | Alterações locais; publicação é uma etapa posterior |

- Manter Supabase autenticado e as restrições existentes; não adicionar consulta pública para dados pessoais.
- Não gravar informações do lead em URL, armazenamento persistente ou logs de teste.
- WhatsApp abre apenas após clique, com número normalizado, mensagem codificada e `noopener noreferrer`; não dispara mensagem automaticamente.
- Renderizar dados como texto React; nenhuma inserção de HTML externo.
- Validações locais com fixtures fictícias e chamadas mockadas, sem inserir lead ou enviar e-mail/WhatsApp real.
- As pendências remotas da extensão anterior do simulador continuam fora desta mudança visual.

## Critérios de aceite e verificações

1. Tabela apresenta as seis colunas propostas, com nomes/valores legíveis e dados longos tratados sem sobreposição.
2. Todos os dados atualmente disponíveis continuam consultáveis no painel lateral.
3. Abrir e fechar detalhes preserva busca, datas, filtro de e-mail e página.
4. Painel funciona por teclado, devolve foco e adapta-se à viewport móvel.
5. Filtros mantêm seu significado, inclusive limites de data vazios; seleção exibe datas brasileiras.
6. Contatos, valores, CEPs e nomes de imóvel ficam formatados; campos ausentes não viram valores inventados.
7. A mensagem do WhatsApp mantém os parâmetros e regras existentes. Revisar o `href` sem enviar mensagens.
8. Leads Home Equity, Price, SAC, com/sem planos e registros antigos são exibidos corretamente.
9. Conferir loading, erro, vazio, dados longos, telefone inválido e paginação com mais de 50 fixtures.
10. Testes de interação: `npm test -- src/test/adminLeadsSimulacoes.test.tsx --reporter=verbose` — 8 testes aprovados. Suíte completa `npm test` — 28 arquivos e 101 testes aprovados. Lint direcionado aos arquivos da mudança — 0 erros e 0 avisos.
11. `npm run typecheck` e `npm run build` concluídos sem erros; lint geral do aplicativo — 0 erros e 38 avisos em arquivos fora desta mudança.
12. Smoke local no Chrome com fixtures fictícias: seis colunas; Price, SAC e Home Equity; campos ausentes e zero; filtros de status e data; intervalo invertido; calendário em português; paginação 1/2 com 53 registros; abertura/fechamento, foco, Tab, Shift+Tab, Escape e retorno de foco; estados de carregamento/erro/vazio; e layout de desktop e 320 px sem transbordamento da página.
13. Verificado que o link WhatsApp contém a mensagem parametrizada, usa `noopener noreferrer` e não é acionado pelo smoke; telefone inválido não gera link. Nenhum acesso ao banco, gravação real, envio de mensagem ou deploy foi feito nesta validação.
14. `docs/operacao/simulador-publico.md` atualizado com o comportamento da tela interna.

## Rollout e rollback

Implementar e validar localmente após aprovação deste plano. Não aplicar migrations, publicar Edge Functions, fazer deploy Vercel ou gerar instaladores nesta etapa. Rollback consiste em reverter apenas o diff visual desta mudança, preservando a implementação anterior do simulador e as demais alterações do worktree.

### Publicação posterior autorizada

Em 2026-10-08, o dono deu GO específico para a versão web atual. O redesign foi incluído no deploy `dpl_HprnEB7yyi6wBAn8upRfuRqEh338`, confirmado READY no domínio principal. Ver [plano e evidências da publicação](./2026-10-08-deploy-web-vercel.md). A restrição inicial acima aplica-se à etapa de implementação; o GO posterior cobre a publicação web. Nenhum instalador Electron foi publicado.
