# Ajuste visual — Admin / Propostas

## Objetivo

Aplicar à tela `/admin/propostas` a referência visual compartilhada: fundo cinza claro, cabeçalho de operações, cards de indicadores, filtros compactos e tabela com hierarquia visual mais clara. Remover a coluna/ação de visualizar e tornar o protocolo clicável para abrir a rota de detalhes já existente (`/admin/propostas/:id`).

## Skills e documentação lidas

- Instruções `AGENTS.md` fornecidas na conversa.
- `docs/README.md` — organização e convenções do projeto.
- `docs/blueprint/03-routes-navigation.md` — rotas e navegação.
- `docs/blueprint/06-modules-features.md` — escopo do módulo de propostas.

## Código inspecionado

- `app/src/pages/admin/Propostas.tsx` — consulta, busca, filtros, KPIs, badges e navegação atual.
- `app/src/pages/admin/PropostaDetalhe.tsx` — componente existente de detalhes da proposta.
- `app/src/router.tsx` — rotas `/admin/propostas`, `/admin/propostas/nova` e `/admin/propostas/:id`.
- `app/src/components/KPICard.tsx` e estilos globais em `app/src/index.css` — padrões existentes.
- `app/package.json` — comandos de validação disponíveis.

## Decisões e suposições

- A referência visual do usuário é a fonte para cores, espaçamento, hierarquia e aparência da tabela.
- Este ajuste altera somente apresentação e o ponto de entrada para detalhes; mantém a navegação para `AdminPropostaDetalhe`.
- O exemplo contém dados simulados, formulário simulado e um painel lateral demonstrativo. Nenhum desses será copiado: os dados continuam vindo do banco e a criação continua indo para `/admin/propostas/nova`.
- Busca, filtros, cálculo dos KPIs, fundos, exportação no estado atual, permissões e link para Kanban permanecem com o comportamento existente.
- A lista passa a paginar os resultados reais em blocos de no máximo 50 linhas, conforme o exemplo fornecido; busca e filtros reiniciam na primeira página.
- Nenhuma alteração de banco, API ou modelo de dados será feita.

## Arquivos esperados

- `app/src/pages/admin/Propostas.tsx` — estrutura semântica, labels e link do protocolo.
- `app/src/pages/admin/propostas.css` — estilos isolados da tela, caso necessário para reproduzir a referência sem afetar outras páginas.

## Requisitos e critérios de aceite

1. A tela se aproxima da referência fornecida no desktop e adapta tabela, filtros, cards e ações para mobile.
2. O botão de olho e sua coluna deixam de aparecer.
3. O número do protocolo passa a ser um link acessível para `/admin/propostas/:id`.
4. O link usa o ID real da proposta e abre o componente de detalhe existente.
5. Nenhuma função existente de consulta, busca, filtros, indicadores, fundos, permissão, nova proposta ou Kanban é removida.
6. A página mostra no máximo 50 propostas e permite navegar entre páginas; o intervalo e o total respeitam a busca/filtros atuais.
7. O resumo visual dos fundos mostra um fundo e `+N`; hover e foco exibem a lista completa.
8. Nenhum dado sintético, painel lateral ou formulário demonstrativo do exemplo entra na aplicação.
9. Não há mudanças em schema, Edge Functions, segredos ou integrações.

## Considerações de segurança

- Manter `admin_list_propostas` e as permissões atuais sem ampliar a consulta.
- Preservar a máscara de CPF e não acrescentar dados pessoais à busca ou à URL.
- A rota de detalhes permanece sob as proteções existentes do router.

## Verificações

- Após aprovação: executar lint, typecheck e build conforme scripts existentes.
- Conferir `/admin/propostas` no navegador em desktop e mobile, incluindo estado vazio, busca/filtros e navegação pelo protocolo.
- Confirmar que nova proposta, Kanban e detalhes continuam navegando para as rotas atuais.
