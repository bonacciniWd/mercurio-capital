# Fase 2 — Dashboard admin e detalhamento financeiro

## Status

Implementacao local concluida e validada. A migration `20260902000001` foi aplicada em `2026-09-02` no projeto remoto confirmado `bhagksfvszeogtjvjtpx`, apos dry-run isolado, e o historico remoto ficou sincronizado. O pacote inclui dashboard multidimensional, livro financeiro manual, recorrencias, fechamento e condicoes comerciais por proposta. A estrategia de Open Finance permanece reservada para integracao futura de leitura/conciliacao; iniciacao de pagamentos esta fora desta entrega. Repasses apos o dia 02 ficam bloqueados enquanto a competencia anterior nao estiver fechada, com excecao somente justificada e auditada. A praca do calendario e Balneario Camboriu/SC. Deploy da aplicacao, tag e release continuam sem autorizacao neste registro.

## Objetivo

Evoluir `/admin` e alinhar sua leitura operacional com `/admin/financeiro`, incluindo:

- layout atualizado conforme referencias fornecidas pelo dono do produto;
- preservacao integral das cores/tokens atuais do Mercurio Capital;
- filtros personalizados por periodo/timeline;
- metricas customizadas;
- visibilidade e detalhamento das comissoes por parceiro e proposta;
- coerencia entre proposta ganha/concluida, liberacao de recurso e comissao.

## Skills e documentos lidos

Nao foi necessaria skill externa para o mapeamento. Foram consultados:

- instrucoes `AGENTS.md` fornecidas para o repositorio;
- `docs/operacao/change-management.md`;
- `docs/operacao/release-checklist.md`;
- agentes PM, UX/UI, DEV e Revisor em `.github/agents/`;
- `docs/README.md`;
- `docs/09-roadmap.md`;
- `docs/12-finalizacao.md`;
- `docs/blueprint/01-architecture.md`;
- `docs/blueprint/02-roles-permissions.md`;
- `docs/blueprint/04-database-schema.md`;
- `docs/blueprint/06-modules-features.md`;
- `docs/blueprint/08-security-compliance.md`;
- `docs/handoffs/12-handoff-fase7.md`;
- `docs/handoffs/15-handoff-fase10.md`;
- `docs/handoffs/16-handoff-fase-fundos-docs.md`;
- `docs/operacao/runbooks.md`.

## Referencias visuais

- Estado atual: `Captura de Tela 2026-09-02 as 17.08.23.png`.
- `17.18.56`: resumo financeiro em composicao modular, navegacao primaria por abas e estados de onboarding.
- `17.22.58`: escolha entre modalidades em cards, recomendacao visual e mensagem de seguranca.
- `17.23.27` e `17.23.34`: subabas de uma mesma entidade, cabecalho com acoes e empty state centralizado.
- `17.25.07`: formulario complexo em painel lateral largo, contexto preservado ao fundo e rodape fixo de acao.
- `17.26.02`: configuracao por abas, subnavegacao lateral e empty state com acao unica.
- Regra aprovada: referencias definem layout, espacamento, hierarquia e estados; cores continuam sendo as existentes no app.

As marcas, bancos, textos, funcionalidades de NFS-e e identidade visual presentes nas referencias nao sao requisitos do Mercurio Capital.

## Especificacao UX extraida das referencias

### Padroes aprovados para reaproveitamento

- cabecalho de modulo persistente, com titulo a esquerda e abas horizontais;
- indicador ativo discreto sob a aba;
- conteudo da aba isolado, sem remontar o layout administrativo inteiro;
- hierarquia com muito espaco em branco, cards de borda leve e uma acao primaria por contexto;
- empty states centralizados com icone, titulo, explicacao curta e CTA;
- acoes secundarias no cabecalho da secao;
- tabelas/listas abaixo de uma faixa de filtros;
- painel lateral para detalhe ou edicao, mantendo o contexto da lista ao fundo;
- rodape fixo no painel lateral para valor total e confirmacao;
- loading, vazio, erro, somente leitura e dados incompletos definidos por aba;
- navegacao responsiva: abas rolaveis horizontalmente e painel lateral ocupando a viewport no mobile.

### Aplicacao proposta no escopo original

`/admin` permanece como visao executiva e recebe:

- filtro temporal global no cabecalho;
- KPIs coerentes com o periodo;
- graficos e rankings modulares;
- alertas de conciliacao;
- links de aprofundamento para `/admin/financeiro` e propostas.

O filtro temporal nao sera apenas cosmetico: ele sera o contexto global de consulta. Toda metrica deve declarar sua data de competencia, origem, unidade, formula e comparativo. Alterar periodo, fundo, parceiro ou rede deve recalcular no servidor todos os cards, series, rankings e tabelas compativeis.

`/admin/financeiro` passa a ser um modulo multiabas com a seguinte especificacao para aprovacao final:

1. **Resumo** — caixa/competencia, receitas, despesas, margem, resultado, fluxo temporal e atalhos;
2. **Lancamentos** — entradas e saidas previstas/realizadas, filtros, tabela e cadastro em painel lateral;
3. **Recorrencias** — custos e receitas fixos mensais, proximas geracoes, pausa/encerramento e historico;
4. **Comissoes** — receita bruta Mercurio, comissao de parceiro, bases customizadas, status e detalhe por proposta;
5. **Fechamento e conciliacao** — checklist mensal, pendencias, bloqueio de repasses, excecoes e divergencias entre proposta, liberacao, receita e pagamento.

Configuracoes de categorias e calendario ficam em acoes contextuais dessas abas, sem criar uma sexta aba vazia. `Contas & Extratos` fica reservado para uma fase futura de Open Finance e nao implica integracao bancaria nesta entrega.

### Fluxos de interface fechados para aprovacao

- **Novo lancamento:** botao no cabecalho abre painel lateral largo; tipo, categoria, descricao, contraparte, competencia, vencimento, valor previsto, dimensoes e comprovante; realizacao pode ocorrer na criacao ou depois.
- **Nova recorrencia:** painel lateral com frequencia mensal, vigencia, dia de vencimento, regra de mes curto, categoria, valor e dimensoes.
- **Condicao comercial da proposta:** configurada no detalhe da proposta; mostra volume, percentual de receita Mercurio, base da comissao do parceiro, percentual customizado, custos diretos e previa de margem antes da confirmacao.
- **Detalhe financeiro:** painel lateral preserva lista/filtros ao fundo, mostra historico, vinculos, comprovante e auditoria.
- **Fechar competencia:** checklist explicito, totais reconciliados, pendencias bloqueantes e confirmacao; reabertura exige motivo.
- **Excecao de repasse:** acao restrita, com justificativa obrigatoria, alerta de risco e auditoria; nao altera o status do fechamento.

### Comportamento do painel lateral de comissao

Inspirado na referencia `17.25.07`, sem copiar cores:

- identificacao de parceiro, proposta e protocolo;
- valor solicitado, valor efetivamente liberado e base da comissao;
- percentual aplicado e valor calculado;
- status e timeline de criada/aprovada/paga;
- observacao e comprovante, quando existentes;
- links seguros para proposta e parceiro;
- acoes no rodape apenas para admin operacional;
- juridico ve o mesmo detalhe em modo somente leitura.

## Codigo e configuracoes inspecionados

- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/pages/admin/Financeiro.tsx`;
- `app/src/components/FunilParceirosCard.tsx`;
- `app/src/components/KPICard.tsx`;
- `app/src/router.tsx`;
- `app/src/lib/adminScope.ts`;
- `supabase/migrations/20260513000002_identidade.sql`;
- `supabase/migrations/20260513000004_operacoes.sql`;
- `supabase/migrations/20260518000009_dashboards_kpis.sql`;
- `supabase/migrations/20260518000030_contratos_fase7.sql`;
- `supabase/migrations/20260520000010_funil_parceiros_fase10.sql`;
- `supabase/migrations/20260715000003_kanban_scope_analytics.sql`;
- `supabase/migrations/20260722000007_admin_juridico_hardening.sql`.

## Diagnostico tecnico

### Dashboard

O `/admin` atual usa views sem parametros de periodo:

- `v_admin_dashboard_kpis`;
- `v_admin_top_partners`;
- `v_admin_funil_parceiros`.

As metricas sao acumuladas ou fixas no mes corrente e nao compartilham um intervalo temporal unico. O ranking soma `valor_solicitado` de todas as propostas, nao necessariamente valor liberado/ganho. O status considerado ganho ainda usa apenas `recurso_liberado` e `contrato_registrado`, enquanto o enum operacional mais recente inclui `pagamento_comissao` e `completo`. Isso pode produzir divergencia entre cards, resumo, funil e financeiro.

### Financeiro e comissoes

O `/admin/financeiro` lista `v_comissoes_admin` e permite filtrar apenas por status (`prevista`, `aprovada`, `paga`, `todas`). Nao ha:

- detalhe expandido da comissao/proposta;
- filtro por periodo, parceiro, protocolo ou status da proposta;
- comparativo temporal;
- navegacao direta para parceiro/proposta;
- paginacao server-side;
- conciliacao de propostas avancadas sem liberacao/comissao.

A regra vigente cria comissao exclusivamente pelo trigger `fn_calcular_comissao()` depois de um INSERT em `liberacoes_recurso`. Alterar o status da proposta para aprovado, pagamento de comissao ou completo nao cria liberacao nem comissao.

### Evidencia atual do projeto `bhagksfvszeogtjvjtpx`

Consulta agregada somente leitura, sem exibir PII:

- 156 propostas;
- 63 em `completo`;
- 3 em `pagamento_comissao`;
- 0 registros em `liberacoes_recurso`;
- 0 registros em `comissoes`;
- 66 propostas em estados avancados sem liberacao;
- 37 parceiros com proposta e 0 com comissao.

Portanto, a tela Financeiro nao esta apenas deixando de detalhar comissoes existentes: atualmente nao existe nenhuma comissao persistida para detalhar. O dado historico foi avancado por status sem passar pelo registro de liberacao que dispara a comissao.

## Contradicoes e decisoes pendentes

1. O dashboard chama `valor_solicitado` de volume ganho; Financeiro usa `valor_liberado`. A metrica canonica precisa ser definida.
2. A documentacao antiga considera alguns estados como ganhos, mas o fluxo atual possui estados posteriores (`pagamento_comissao`, `completo`). Uma classificacao canonica deve ser compartilhada.
3. Nao e seguro gerar comissao retroativa apenas com `valor_solicitado`: o valor efetivamente liberado pode ser diferente.
4. Os percentuais de parceiro podem ser zero e o trigger usa fallback de 1,5%; a regra comercial precisa ser confirmada antes de qualquer backfill.
5. Filtros de timeline devem declarar qual data dirigira cada metrica: criacao da proposta, liberacao, aprovacao ou pagamento.
6. Ainda nao existe no modelo inspecionado um livro financeiro geral para saidas previstas, despesas operacionais e custos de funcionarios. Esses valores nao podem ser derivados de propostas ou comissoes.
7. `equipe_membros` representa composicao de rede comercial, nao folha de pagamento nem cadastro trabalhista; nao deve ser tratado como custo de funcionarios.
8. `precos_consulta.custo_fornecedor_centavos` registra custo de consultas, mas nao representa sozinho todos os custos operacionais.
9. O percentual atual em `partners.comissao_percentual` e global por parceiro e alimenta `comissoes`, que representa obrigacao a pagar ao parceiro. Ele nao modela a receita comercial da Mercurio nem variacao por proposta.
10. A expressao “comissao da proposta” precisa ser desambiguada na UI e no banco entre receita bruta da Mercurio e comissao/reparticao devida ao parceiro. Definicao aprovada: o percentual comercial informado na proposta (por exemplo, 6%) representa receita bruta da Mercurio.

## Contrato analitico do dashboard

### Filtro temporal global

- presets: hoje, 7 dias, mes atual, trimestre atual, ano atual e intervalo personalizado;
- datas inclusivas exibidas em `America/Sao_Paulo`, com limites convertidos de forma segura para UTC nas consultas;
- comparacao opcional com periodo anterior de igual duracao;
- granularidade automatica: dia para intervalos curtos, semana para medios e mes para longos, com possibilidade de selecao explicita;
- estado refletido na URL: `inicio`, `fim`, `granularidade`, `fundo`, `parceiro` e `rede`;
- limite maximo de intervalo e paginacao definidos antes da implementacao para proteger desempenho;
- opcao “Todos” em cada dimensao, sem selecao implicita escondida.

### Dimensoes combinaveis

| Dimensao | Fonte existente | Regra proposta |
| --- | --- | --- |
| Fundo | `fundos` + `proposta_fundos` | filtrar operacoes vinculadas; definir tratamento de proposta associada a mais de um fundo para evitar dupla contagem |
| Parceiro | `partners` + `propostas.partner_id` | filtrar origem comercial direta |
| Rede | `equipes` + `equipe_membros` + relacoes de parceiro | definir se agrega somente a equipe selecionada ou toda a arvore descendente |
| Status | `propostas.status`, `comissoes.status`, `proposta_fundos.status_fundo` | status selecionado deve ser especifico de cada dominio, sem misturar enums |
| Produto/operacao | dados atuais da proposta | incluir somente se o campo canonico estiver preenchido e normalizado |
| Funcionario/responsavel | ainda nao confirmado | separar responsavel operacional de empregado e de membro de rede |

### Matriz preliminar de metricas

| Metrica | Definicao profissional proposta | Data do periodo | Situacao da fonte |
| --- | --- | --- | --- |
| Entradas realizadas | soma dos recursos efetivamente recebidos/liberados conforme evento financeiro aprovado | `liberacoes_recurso.data_liberacao` | estrutura existe, historico atual esta vazio |
| Entradas previstas | valores com recebimento futuro confirmado, sem somar simples expectativa comercial | data prevista de recebimento | fonte/estado de confirmacao ainda inexistentes |
| Saidas realizadas | pagamentos financeiros efetivos, incluindo comissoes pagas e demais despesas | data efetiva de pagamento | comissoes possuem parte da estrutura; livro geral inexiste |
| Saidas previstas | obrigacoes aprovadas com vencimento futuro e saldo em aberto | data de vencimento | fonte geral ainda inexistente |
| Custos operacionais | despesas classificadas em categorias operacionais, distinguindo previsto, realizado e recorrente | competencia, vencimento ou pagamento conforme visao | fonte geral ainda inexistente; custo de consulta cobre apenas um subconjunto |
| Funcionarios | headcount ativo e/ou custo de pessoal, exibidos como metricas separadas | vigencia e competencia da folha | cadastro trabalhista/folha ainda inexistente |
| Comissoes | prevista, aprovada e paga, sempre vinculada a liberacao real | criacao, aprovacao ou pagamento conforme serie | tabela existe, mas sem registros atuais |
| Resultado/caixa | entradas menos saidas, sem confundir fluxo de caixa com resultado por competencia | depende da visao escolhida | exige definicao caixa versus competencia |

Nenhum card exibira zero como se fosse dado confirmado quando a fonte nao existir. O estado correto sera “nao configurado”, “sem dados no periodo” ou “dados incompletos”, conforme o caso.

### Regras de consistencia

- nao somar `valor_solicitado`, `valor_aprovado` e `valor_liberado` numa mesma serie;
- nao tratar proposta concluida como entrada financeira realizada sem evento de liberacao;
- nao tratar comissao prevista como saida paga;
- evitar dupla contagem quando uma proposta tiver varios fundos ou participar de uma hierarquia de rede;
- cards e drill-downs devem reconciliar: clicar em um total abre exatamente os registros que o formam;
- cada metrica deve exibir tooltip com formula, data-base e ultima atualizacao;
- valores monetarios sao calculados no banco em unidade inteira/decimal segura, nunca com ponto flutuante no cliente;
- dados incompletos geram alerta de conciliacao e nao preenchimento estimado silencioso.

### Layout executivo proposto

1. cabecalho com periodo, comparacao, granularidade e acao de atualizar;
2. faixa de filtros dimensionais por fundo, parceiro, rede e demais dimensoes aprovadas;
3. cards separados para entradas realizadas, entradas previstas, saidas realizadas, saidas previstas, resultado e pendencias de conciliacao;
4. grafico principal de fluxo temporal com realizado e previsto visualmente distintos, usando a paleta atual;
5. composicao de custos operacionais e custos de pessoal, somente quando houver fontes aprovadas;
6. rankings por fundo, parceiro e rede, com metrica selecionavel e sem dupla contagem;
7. tabelas de detalhamento e alertas com navegacao para Financeiro, proposta ou parceiro.

## Modelo de dados proposto para aprovacao

### Entidades existentes preservadas

- `propostas`: origem comercial e status operacional;
- `liberacoes_recurso`: evento financeiro canonico, com valor e data efetivos;
- `comissoes`: valor, percentual e status da comissao vinculada a proposta/liberacao;
- `partners`: parceiro e percentual configurado.

### Evolucao minima prevista

Preferencia por RPCs/views parametrizadas ou funcoes SQL de leitura, sem duplicar dados:

- funcao de metricas admin recebendo `data_inicio`, `data_fim` e filtros opcionais;
- funcao de serie temporal com granularidade dia/semana/mes;
- funcao/listagem financeira com periodo, parceiro, protocolo e status;
- view/RPC de conciliacao para identificar proposta avancada sem liberacao e liberacao sem comissao.

Nao criar tabelas para filtros, cards ou abas. As novas tabelas abaixo decorrem exclusivamente do livro financeiro, recorrencias, fechamento, calendario e condicao comercial aprovados; dados existentes continuam reutilizados onde forem canonicos.

Campos de filtro nao devem ser persistidos como configuracao nesta fase, salvo aprovacao explicita. O estado pode viver na URL para permitir compartilhamento e navegacao previsivel.

### Livro financeiro manual proposto para aprovacao

A confirmacao do dono do produto inclui cadastro e gestao manual de entradas e saidas, previstas e realizadas, fixas/recorrentes ou variaveis. Isso exige entidades transacionais novas; elas permanecem apenas propostas ate a aprovacao deste modelo.

#### `financeiro_categorias`

Catalogo configuravel para classificacao sem hardcode de despesas:

- `id` uuid;
- `nome` text obrigatorio;
- `tipo` entrada ou saida;
- `grupo` operacional, pessoal, comissao, imposto, infraestrutura, ocupacao ou outros;
- `categoria_pai_id` opcional para subcategorias;
- `ativo` boolean;
- `ordem` integer;
- `created_by`, `created_at`, `updated_at`.

Exemplos iniciais, sem impedir categorias criadas pelo admin: salarios, energia, aluguel, condominio e comissoes. Categorias usadas nao serao apagadas; apenas inativadas.

#### `financeiro_recorrencias`

Regra geradora dos compromissos repetitivos:

- `id` uuid;
- `tipo`, `categoria_id`, `descricao`;
- `valor_previsto` numeric positivo;
- `frequencia` inicialmente mensal;
- `dia_vencimento` e regra para meses curtos;
- `inicio_em`, `fim_em` opcional;
- `fundo_id`, `partner_id` ou `equipe_id` opcionais, conforme centro analitico;
- `ativo`, `created_by`, `created_at`, `updated_at`.

A recorrencia e um modelo. Cada competencia gera um lancamento independente e auditavel; editar a regra nao reescreve meses fechados nem ocorrencias ja liquidadas.

#### `financeiro_lancamentos`

Livro de ocorrencias previstas e realizadas:

- `id` uuid;
- `tipo` entrada ou saida;
- `categoria_id` obrigatorio;
- `recorrencia_id` opcional;
- `descricao` e `contraparte`;
- `competencia` date normalizada para o primeiro dia do mes;
- `vencimento_em` date;
- `valor_previsto` numeric positivo;
- `valor_realizado` numeric positivo opcional;
- `realizado_em` date opcional;
- `status` previsto, realizado, vencido ou cancelado;
- `fundo_id`, `partner_id`, `equipe_id` opcionais;
- `proposta_id`, `liberacao_id` ou `comissao_id` opcionais para conciliacao, sem duplicar o evento de origem;
- `observacao` e `comprovante_storage_path` opcionais;
- `created_by`, `updated_by`, `created_at`, `updated_at`.

Regras: valor realizado e data de realizacao surgem juntos; cancelamento exige motivo; vinculos financeiros existentes sao unicos para evitar duplicidade; datas e valores nao podem ser alterados em competencia fechada sem reabertura auditada.

#### `financeiro_fechamentos`

Controle mensal da integridade financeira:

- `id` uuid;
- `competencia` date unica, normalizada para o primeiro dia do mes;
- `status` aberto, pendente, fechado ou reaberto;
- `prazo_fechamento` date;
- `fechado_por`, `fechado_em`;
- `reaberto_por`, `reaberto_em`, `motivo_reabertura`;
- `observacao`, `created_at`, `updated_at`.

Totais nao serao duplicados nessa tabela: serao reconciliados a partir dos lancamentos. O fechamento valida pendencias e cria uma trilha auditavel.

#### `proposta_condicoes_comerciais`

Condicao financeira versionada e configurada individualmente por proposta:

- `id` uuid;
- `proposta_id` obrigatorio;
- `versao` integer, unica por proposta;
- `status` rascunho, aprovada, substituida ou cancelada;
- `tipo_base` valor aprovado, valor liberado ou valor fixo;
- `valor_base_previsto` numeric positivo;
- `percentual_receita_mercurio` numeric entre 0 e 100;
- `valor_receita_prevista` numeric calculado e congelado na aprovacao;
- `base_comissao_parceiro` obrigatoria: valor liberado ou receita bruta Mercurio;
- `percentual_parceiro` customizado por proposta, numeric entre 0 e 100;
- `valor_comissao_parceiro_prevista` opcional;
- `vigente_desde`, `aprovada_por`, `aprovada_em`;
- `motivo_alteracao`, `created_by`, `created_at`.

Uma unica versao pode estar aprovada/vigente por proposta. Condicao aprovada nao e editada: qualquer mudanca cria nova versao, exige justificativa e preserva a anterior. O valor monetario calculado fica salvo junto aos percentuais para impedir que alteracoes futuras em parceiro, proposta ou arredondamento reescrevam o historico.

A base da comissao do parceiro sera selecionada na proposta por um controle de duas opcoes:

- **sobre o valor liberado**: `comissao_parceiro = valor_liberado x percentual_parceiro`;
- **sobre a receita bruta Mercurio**: `comissao_parceiro = receita_bruta_mercurio x percentual_parceiro`.

O percentual sera customizado na propria proposta. O sistema nao pre-selecionara base nem herdara silenciosamente o percentual global do parceiro: ambos serao obrigatorios para aprovar a condicao comercial. Antes da confirmacao, a UI exibira a formula, base monetaria, percentual e valor calculado. Se ainda nao houver valor liberado, a opcao correspondente exibira estimativa sobre a base prevista e sera recalculada/congelada quando houver liberacao efetiva.

Exemplo aprovado: base de R$ 2.000.000,00 e receita bruta Mercurio de 6% produz previsao de R$ 120.000,00; outra proposta pode registrar 10%. O credito de R$ 2.000.000,00 permanece volume operacional e nao entrada de caixa da Mercurio.

### Resultado e margens

- `receita_bruta_prevista_proposta = valor_base_previsto x percentual_receita_mercurio`;
- `receita_bruta_realizada` so existe quando a remuneracao e efetivamente recebida pela Mercurio;
- custos diretos da proposta podem incluir comissao do parceiro, imposto/retencao, taxa de fundo, fornecedor e outro custo inequivocamente atribuivel;
- `margem_contribuicao_proposta = receita_bruta - custos_diretos_da_proposta`;
- salarios, aluguel, energia, condominio e demais custos corporativos entram no resultado da competencia;
- `resultado_operacional_mensal = receitas_brutas_reconhecidas - custos_diretos - custos_operacionais - custos_de_pessoal`;
- custos corporativos nao serao repetidos integralmente em cada proposta;
- rateio de custos indiretos por proposta, parceiro, fundo ou rede sera opcional e exigira criterio configurado e versionado em fase propria, caso aprovado;
- dashboard exibira separadamente volume operacional, receita bruta, custos diretos, margem de contribuicao, despesas operacionais e resultado operacional.

### Fluxo comercial-financeiro por proposta

1. proposta aprovada define o volume operacional, mas ainda nao gera entrada realizada;
2. admin operacional configura a condicao comercial especifica da proposta;
3. sistema calcula uma previa, exibindo separadamente receita Mercurio, comissao do parceiro e margem prevista;
4. outro ato de confirmacao aprova e congela a versao da condicao;
5. a condicao aprovada pode gerar lancamento de entrada prevista da Mercurio;
6. liberacao efetiva atualiza a base realizada quando `tipo_base = valor_liberado`, sem confundir o valor liberado ao cliente com caixa da Mercurio;
7. recebimento da remuneracao pela Mercurio marca a entrada como realizada;
8. comissao do parceiro permanece uma saida independente e so vira realizada quando efetivamente paga;
9. divergencias entre previsto, contratado, liberado, recebido e pago aparecem na conciliacao.

A receita bruta e o teto economico para leitura da rentabilidade, mas o banco nao impedira genericamente custos mensais corporativos acima da receita de uma proposta: isso poderia esconder prejuizos reais. Em vez disso, o dashboard evidenciara margem positiva ou negativa e alertas de estouro de custos.

O fallback silencioso atual de 1,5% nao devera ser usado para novas propostas com condicao individual. Ausencia de condicao aprovada deve gerar pendencia explicita e bloquear o fechamento/repasses relacionados, sem inventar valores.

O campo global `partners.comissao_percentual` podera permanecer apenas como referencia cadastral/legada durante a transicao. Ele nao sera fonte automatica para novas condicoes comerciais sem uma decisao posterior explicita.

#### Calendario operacional

A praca aprovada e **Balneario Camboriu, Santa Catarina**. O calculo automatico do quinto dia util devera combinar:

- fins de semana;
- feriados nacionais;
- feriados estaduais de Santa Catarina;
- feriados municipais de Balneario Camboriu;
- dias sem expediente bancario aplicaveis aos repasses.

O calendario sera configuravel e versionado por data/abrangencia, porque fins de semana sozinhos nao cobrem feriados fixos, moveis e bancarios. As fontes oficiais, a antecedencia de carga e o comportamento quando um feriado ainda nao estiver cadastrado deverao ser documentados e testados antes da implementacao. Nao sera usada API publica diretamente no navegador nem dependencia externa em tempo real para autorizar um repasse.

#### `financeiro_dias_nao_uteis`

Calendario operacional local e auditavel:

- `data` date como chave natural;
- `nome` text;
- `abrangencia` nacional, estadual, municipal ou bancaria;
- `uf` e `municipio` opcionais conforme abrangencia;
- `fonte_oficial` text;
- `ativo`, `created_by`, `created_at`, `updated_at`.

O quinto dia util sera calculado no servidor para Balneario Camboriu/SC. Alteracoes no calendario nao modificam silenciosamente repasses ja aprovados; datas calculadas ficam registradas no evento correspondente.

### Open Finance — decisao aprovada

- o livro financeiro interno permanece como fonte dos valores previstos e das classificacoes gerenciais;
- Open Finance sera uma fonte futura de saldos e transacoes realizadas para conciliacao;
- a primeira integracao sera somente leitura, por provedor/agregador autorizado, nunca com credenciais bancarias ou tokens privados no cliente;
- cada transacao importada devera ter identificador externo idempotente e podera ser vinculada a no maximo um lancamento, com suporte a conciliacao parcial somente se aprovada em detalhe;
- consentimentos PJ, contas conectadas, expiracao/revogacao e status de sincronizacao serao controlados no servidor;
- dados bancarios brutos terao acesso restrito, retencao definida e auditoria; o dashboard recebera apenas o necessario;
- a ausencia ou indisponibilidade do provedor nao impedira o uso manual do Financeiro;
- iniciacao/agendamento de Pix ou transferencia nao faz parte da Fase 2; sera uma fase propria com analise regulatoria, antifraude, alcadas e dupla aprovacao;
- nenhum provedor sera escolhido ou contratado sem comparativo tecnico, regulatorio, cobertura bancaria, SLA e custo aprovado.

O modelo da Fase 2 pode reservar referencias externas neutras para futura conciliacao, mas nao criara tabelas especificas de um fornecedor antes da escolha do provedor.

### Ciclo mensal proposto

1. recorrencias ativas geram os lancamentos previstos da nova competencia de forma idempotente;
2. durante o mes, o admin confirma valores variaveis e marca pagamentos/recebimentos realizados;
3. no ultimo dia do mes, o sistema inicia a cobranca de fechamento da competencia encerrada;
4. dias 01 e 02 exibem alerta critico e checklist de pendencias;
5. apos o dia 02, a competencia anterior fica “fechamento atrasado” ate acao explicita do admin;
6. fechamento exige resolver ou justificar lancamentos vencidos, recorrencias nao geradas e valores previstos sem confirmacao;
7. fechamento nunca ocorre automaticamente e exige confirmacao do admin operacional;
8. uma competencia fechada fica imutavel; correcao exige reabertura com motivo e auditoria;
9. apos o dia 02, aprovacoes de repasses ficam bloqueadas enquanto o mes anterior nao estiver fechado;
10. uma excecao operacional exige justificativa obrigatoria, identidade do autorizador, data/hora e evento imutavel na auditoria; a excecao nao fecha a competencia nem elimina suas pendencias.

### Separacao entre competencia e caixa

- visao de competencia usa o mes a que o custo ou receita pertence;
- visao de caixa usa `realizado_em`;
- previsto usa vencimento/data esperada e saldo ainda nao realizado;
- o dashboard deve permitir alternar “Caixa” e “Competencia”, mantendo rotulos inequivocos;
- fechamento mensal e feito por competencia, enquanto a preparacao do repasse considera caixa e vencimentos.

### Regras propostas

- Comissao nasce de liberacao real, nao apenas de mudanca de status.
- Uma liberacao gera no maximo uma comissao, garantida por constraint/indice unico em `liberacao_id` se os dados atuais permitirem.
- Backfill exige valor liberado, data de liberacao e percentual aplicavel confirmados.
- Metricas financeiras usam `data_liberacao`; metricas de entrada usam `propostas.created_at`; pagamentos usam `comissoes.paga_em`.
- Admin juridico permanece somente leitura; mutacoes financeiras continuam exclusivas de admin operacional.
- Lancamentos manuais, recorrencias, fechamento e reabertura sao exclusivos de admin operacional e sempre auditados.
- Nenhum job pesado sera executado na requisicao; a materializacao mensal de recorrencias sera idempotente e podera rodar por job seguro ou acao administrativa controlada.
- Percentuais configurados por proposta exigem previa, aprovacao explicita e versionamento; nenhuma alteracao retroativa silenciosa e permitida.
- Base e percentual da comissao do parceiro sao independentes da taxa de receita bruta da Mercurio e ficam congelados na versao aprovada.

## Escopo de UX consolidado

O desenho final sera detalhado tela a tela depois do envio das referencias. A principio, mapear:

- barra global de periodo com presets e intervalo customizado;
- cards de KPI coerentes com o periodo;
- comparacao com periodo anterior equivalente;
- serie temporal e composicao por status/produto/parceiro;
- ranking com metrica selecionavel;
- bloco de alertas de conciliacao;
- Financeiro com filtros, tabela detalhada, drawer/modal de detalhe e links para proposta/parceiro;
- estados loading, vazio, erro, dados parciais e sem permissao;
- responsividade sem mudar a paleta atual.

## Arquivos esperados

Dependem das referencias e da aprovacao do modelo:

- `app/src/pages/admin/Dashboard.tsx`;
- `app/src/pages/admin/Financeiro.tsx`;
- componentes compartilhados de filtro, KPI, grafico e detalhe em `app/src/components/`;
- helpers de datas/metricas em `app/src/lib/`;
- nova migration forward-safe para RPCs/views/constraints aprovadas;
- smoke test SQL especifico;
- testes Vitest dos filtros, calculos e estados;
- atualizacao de blueprint, roadmap, runbook e handoff da fase.

## Criterios de aceite preliminares

- Um mesmo filtro temporal governa todos os blocos da tela correspondente.
- Metricas exibem rotulo e data canonica sem misturar solicitado, aprovado e liberado.
- Comparativo usa periodo anterior de mesma duracao.
- Filtros ficam refletidos na URL e sobrevivem a refresh.
- Financeiro permite localizar comissao por parceiro, protocolo, periodo e status.
- Detalhe mostra proposta, parceiro, percentual, base, valor, status e datas.
- Divergencias de conciliacao sao visiveis sem inventar comissoes.
- Admin juridico consulta, mas nao aprova/paga; admin operacional mantem as acoes.
- Layout corresponde as referencias futuras, preservando as cores atuais.
- Queries agregam no servidor e nao carregam arrays brutos sensiveis no cliente.
- Nenhuma release e criada sem novo mapeamento e GO explicito.
- Admin cadastra entrada ou saida avulsa como prevista e posteriormente informa a realizacao sem perder o historico.
- Admin cria custo mensal recorrente e o sistema gera uma unica ocorrencia por competencia, inclusive apos reexecucao.
- Alterar uma recorrencia afeta somente competencias futuras nao materializadas.
- Competencia anterior apresenta checklist de fechamento no fim do mes e alerta critico nos dias 01 e 02.
- Competencia fechada rejeita alteracoes; reabertura exige motivo, autor e data na auditoria.
- Dashboard alterna caixa e competencia sem misturar as respectivas datas-base.
- Categorias customizadas podem ser criadas e inativadas, mas nao excluidas quando possuirem historico.

## Seguranca

- RPCs de analytics devem validar `app_is_admin()`.
- Mutacoes financeiras devem validar `app_is_admin_operacional()`.
- Nao expor dados bancarios, documentos ou PII desnecessaria em metricas.
- Evitar calculos financeiros criticos exclusivamente no browser.
- Backfill sera transacional, auditavel e executado somente apos aprovacao dos valores.
- Nao executar alteracao remota durante o planejamento.

## Gate obrigatorio para migrations e novas tabelas

Antes de qualquer SQL:

1. aprovar o modelo completo, relacionamentos, campos obrigatorios, enums e regras;
2. confirmar que uma tabela nova e necessaria e que uma view/RPC sobre dados existentes nao resolve;
3. criar migration nova, aditiva e forward-safe; migrations publicadas nao serao editadas;
4. incluir RLS, grants, indices, auditoria e comentarios na mesma entrega;
5. criar smoke test transacional com rollback cobrindo admin full, limitado, juridico e nao admin;
6. executar em ambiente local/staging antes de producao;
7. validar compatibilidade com os 156 registros atuais e explicitar qualquer backfill;
8. separar backfill da migration estrutural quando houver dados financeiros reais;
9. revisar o SQL antes de solicitar autorizacao para `supabase db push`;
10. nao aplicar no projeto remoto sem aprovacao operacional especifica.

### Regras para eventual backfill financeiro

- nunca inferir `valor_liberado` a partir de `valor_solicitado` sem aprovacao;
- nunca marcar comissao como paga apenas pelo status da proposta;
- exigir valor, data de liberacao, percentual e origem da evidencia;
- gerar relatorio dry-run agregado antes da escrita;
- executar transacionalmente, com auditoria e idempotencia;
- validar contagens e totais antes e depois;
- manter estrategia de forward-fix pronta.

## Testes previstos

### Automaticos

- lint, typecheck, Vitest e build;
- smoke SQL por periodo, status, parceiro e permissao;
- bordas de timezone `America/Sao_Paulo`;
- intervalo vazio, data invalida e periodo maximo;
- consistencia entre cards, serie, ranking e tabela;
- idempotencia/constraint de comissao por liberacao;
- admin full, limitado, juridico e usuario nao admin.
- constraints de valor/data/status dos lancamentos;
- geracao idempotente de recorrencias e tratamento de meses curtos;
- fechamento no prazo, fechamento atrasado, bloqueio de escrita e reabertura auditada;
- isolamento de lancamentos sensiveis e comprovantes;
- conciliacao sem duplicidade com liberacoes e comissoes;
- calculo de quinto dia util conforme calendario aprovado, se entrar no escopo.

### Manuais

- referencias visuais desktop pixel a pixel e adaptacao responsiva;
- presets, intervalo customizado e refresh com query string;
- loading, vazio, erro e dados parciais;
- drill-down Dashboard -> Financeiro -> Proposta/Parceiro;
- aprovacao/pagamento e atualizacao dos KPIs;
- conciliacao de proposta avancada sem liberacao;
- teste no navegador local e preview antes de qualquer deploy.

## Rollout e rollback

- Implementacao em migration aditiva e componentes incrementais.
- Backfill separado da migration estrutural e nunca implicito no deploy.
- Feature flag pode ser usada se aprovada para comparar dashboard antigo/novo.
- Rollback de UI por reversao do diff; banco por forward-fix.
- Deploy, migration remota, tag e release ficam fora desta etapa.

## Proximos gates

1. Obter aprovacao formal deste pacote: cinco abas e cinco novas entidades (`financeiro_categorias`, `financeiro_recorrencias`, `financeiro_lancamentos`, `financeiro_fechamentos`, `financeiro_dias_nao_uteis`) mais `proposta_condicoes_comerciais`.
2. Depois do GO, escrever migrations aditivas e implementacao somente local.
3. Executar smoke SQL, lint, typecheck, testes, build e validacao manual das abas/estados.
4. Apresentar diff, resultados e pendencias para revisao.
5. Aplicacao no Supabase remoto, deploy, tag e release continuam exigindo autorizacao operacional separada.

Open Finance nao bloqueia a implementacao do livro manual: a direcao arquitetural de integracao futura ja esta aprovada, mas a selecao e implantacao do provedor permanecem fora do escopo atual.
