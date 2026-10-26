# Plano — distribuição visual dos leads públicos

Status: aprovado pelo usuário em 2026-10-23, com referência visual para a tela e ajuste do mapa ao SVG local.

## Objetivo

Adaptar `/admin/leads/simulacoes` à referência enviada: cabeçalho, indicadores, painel de distribuição geográfica com `app/src/assets/maps/world.svg`, destaque regional e tabela de leads. Preservar leitura real, filtros, paginação, detalhe, estados de e-mail e contato por WhatsApp.

## Skills e documentos lidos

- AGENTS.md fornecido pelo usuário nesta conversa; nenhuma skill adicional se aplica.
- `docs/README.md`, `docs/operacao/simulador-publico.md`, `docs/operacao/leads-publicos-cpc.md`, `docs/blueprint/03-routes-navigation.md` e plano anterior `prompts/2026-10-08-redesign-leads-simulacoes.md`.

## Código inspecionado

- `app/src/pages/admin/LeadsSimulacoes.tsx`, `app/src/assets/maps/world.svg`, `app/src/lib/simulacaoLeadPresentation.ts`, `app/src/components/SimulacaoLeadDetalhe.tsx`, `app/src/test/adminLeadsSimulacoes.test.tsx`.
- `app/src/pages/partner/Wizard.tsx`: consulta ViaCEP para cidade/UF pelo CEP e Nominatim para coordenadas do imóvel; este último usa endereço completo apenas ao clicar no mapa da proposta.
- `app/src/layouts/AdminLayout.tsx`, `app/src/index.css`, `app/package.json`, `supabase/migrations/20261016000001_leads_publicos_cpc.sql`.

## Modelo de dados, relacionamentos e regras

- Fonte única da lista: view autenticada `v_admin_leads_publicos`, união dos registros de `simulacao_leads_publicos` e `cpc_leads_publicos`, limitada no cliente aos 500 mais recentes. A configuração de mensagem vem de `config_mensagens_simulador`.
- Chave do registro: `id`; campos usados na lista incluem `nome_completo`, `email`, `telefone`, `tipo_simulacao`, `valor_credito`, `created_at`, `status_email_prospect` e `status_email_interno`. `cidade` e `uf` só são preenchidos para CPC; os demais registros recebem nulo pela view.
- Nenhuma tabela, coluna, RPC ou gravação nova. Indicadores e mapa serão derivados somente dos registros retornados; valores inexistentes aparecem como indisponíveis. Não haverá percentuais de crescimento, conversão, resposta, países ou regiões inventados.
- Para localização, usar `cidade`/`uf` já disponíveis no CPC e resolver `cep` dos leads de simulação pela mesma API ViaCEP já utilizada no cadastro da proposta. O CEP é do **imóvel/garantia**, portanto o mapa será rotulado como localização do imóvel/projeto, não residência ou origem pessoal do lead. Não supor país para registros sem cidade/UF ou CEP válido. Sem localização resolvida, mostrar contagem separada. Os filtros de busca, data, tipo de produto e estado do e-mail incidem sobre lista e indicadores de modo consistente.

## Decisões e suposições

- A referência define a composição visual, porém o cabeçalho global existente do AdminLayout continua responsável por marca, usuário e navegação; não duplicar a barra superior do exemplo.
- Usar `world.svg` como base do mapa, sem copiar os caminhos geográficos hardcoded do exemplo. O ViaCEP informa cidade/UF, mas não latitude/longitude; nesta etapa destacar o Brasil e apresentar a distribuição por UF no painel adjacente, sem pontos de cidade fictícios. O desenho não implica cobertura global do negócio.
- Consultar apenas CEPs distintos, válidos e presentes nos registros carregados, com cache em memória, concorrência limitada, estado de carregamento e fallback para “localização não informada” se o serviço falhar. Não enviar nome, contato ou demais campos do lead ao ViaCEP.
- Traduzir os controles demonstrativos da referência para os campos reais: período configurável, produto/tipo, busca e estados de e-mail. Manter datas opcionais e filtro de e-mail existentes.
- Ações “Ver análise completa”, “mais ações”, status comercial e “taxa de resposta” do exemplo não têm contrato existente; não criar botões inertes nem valores fictícios. O botão Ver abre `SimulacaoLeadDetalhe` e o WhatsApp existente permanece.
- Respeitar o estilo global de botões com `btn-no-liquid` nos controles que precisarem do acabamento claro da referência.

## Arquivos esperados

- `app/src/pages/admin/LeadsSimulacoes.tsx`: layout, filtros, agregados e mapa.
- `app/src/pages/admin/leads-simulacoes.css` (novo): estilos isolados e responsivos.
- `app/src/lib/simulacaoLeadPresentation.ts`: helpers derivados, se necessários.
- `app/src/test/adminLeadsSimulacoes.test.tsx`: cobertura apenas para agregados/filtros/mapa que não possam ser validados por verificações existentes.
- `docs/operacao/simulador-publico.md`: registrar a apresentação real implementada.

## Requisitos e critérios de aceite

1. Desktop reproduz a hierarquia, espaçamento, tipografia, cores, painéis e tabela da referência; mobile adapta sem cortar controles ou dados.
2. O mapa usa `app/src/assets/maps/world.svg` e só mostra distribuição sustentada pelos dados; casos sem localização são identificados.
3. Indicadores recalculam a partir dos leads filtrados, com denominador explícito; não apresentam crescimento/conversão inventados.
4. Busca, datas, filtro de e-mail, paginação de 50, detalhe lateral, e-mails e WhatsApp continuam funcionais.
5. Estados de carregamento, erro e vazio são claros; controles têm foco visível e rótulos acessíveis; nenhuma ação de exemplo fica inerte.

## Segurança

- Dados pessoais continuam na rota admin protegida e na view com privilégios existentes. Não inserir PII em mapa externo, URL, logs, telemetria ou armazenamento persistente.
- O SVG é um asset local estático. A única chamada geográfica adicional é ao ViaCEP já usado no projeto, enviando apenas o CEP necessário; não há envio de nome, e-mail, telefone ou endereço completo, nem uso do Nominatim em lote.
- Nenhuma migration, publicação, contato, disparo ou alteração de estado remoto nesta etapa.

## Testes manuais e automáticos

- Teste focado `npm test -- src/test/adminLeadsSimulacoes.test.tsx`, lint, typecheck, build e `git diff --check`.
- Navegador autenticado, desktop e 320 px: filtros, mapa com/sem localização, estados vazio/erro, paginação, detalhe e contato preparado sem envio.

## Resultado local

- Implementação local concluída em 2026-10-23; sem publicação.
- `npm test -- src/test/adminLeadsSimulacoes.test.tsx`: 9/9 aprovados; `npm run typecheck`, `npm run build` e `git diff --check`: aprovados. `npm run lint -- --no-warn-ignored`: sem erros, 38 avisos preexistentes em outros arquivos.
- A inspeção visual autenticada no navegador não foi concluída nesta execução; deve ser feita antes da publicação, incluindo posição do marcador sobre o SVG, responsividade e carregamento de ViaCEP.
