# Plano — Classificação e distribuição de leads

## Objetivo

Criar a base server-side para registrar a classificação operacional de cada lead e distribuir leads qualificados entre analistas configurados, respeitando senioridade, peso de complexidade, capacidade mensal e headcount ativo.

## Documentação e código inspecionados

- `docs/README.md`, `docs/operacao/` e `docs/escopo-melhoria-operacao-llm.md`.
- `supabase/migrations/20260513000001_enums.sql`.
- `supabase/migrations/20260513000002_identidade.sql`.
- `supabase/migrations/20260513000003_originacao.sql`.
- `supabase/migrations/20260803000002_lote_c_proposta_edicao_responsavel.sql`.
- `app/src/components/PropostasKanban.tsx` e `app/src/pages/admin/PropostaDetalhe.tsx`.

## Modelo de dados proposto

- `usuarios.nivel_operacional`: `junior`, `pleno` ou `senior`, nullable até configuração.
- `usuarios.capacidade_leads_mensal`: capacidade-base configurável.
- `simulacoes.classificacao_lead`: `triple_a`, `double_aa`, `estressado` ou `desqualificado`.
- `simulacoes.classificacao_peso`: 1,0; 1,3; 1,7; ou zero para desqualificado.
- `simulacoes.classificacao_confianca`, `classificacao_motivo`, `classificado_em` e `classificado_por`.
- `simulacoes.distribuido_em` e `distribuicao_motivo` para auditoria.
- `proposta_lead_distribuicao` para registrar histórico de atribuições, origem, peso, analista e redistribuições.

Os pesos e o limite de 100 leads qualificados/mês serão constantes de configuração no banco, não hardcodes no frontend. Os critérios de negócio para decidir a classe continuarão explícitos e revisáveis; esta etapa não fará rejeição automática baseada em campos incompletos.

## Regras de distribuição

- Desqualificados não entram na fila de distribuição nem no limite de bonificação.
- O roteamento considera apenas analistas ativos com nível e capacidade configurados.
- A carga é medida em operações-equivalentes usando peso 1,0/1,3/1,7.
- O número de 100 leads/mês **não é limite de distribuição nem capacidade da equipe**. É o gatilho agregado a partir do qual a produção qualificada começa a ser considerada para a contabilização de comissões, conforme a regra confirmada pela usuária.
- A capacidade-base individual (Júnior 4, Pleno 8, Sênior/Líder 9, sujeita à confirmação) continua sendo usada apenas para dimensionar carga e excedente operacional.
- O algoritmo prioriza o analista com menor carga relativa e compatibilidade com a complexidade.
- Toda atribuição e redistribuição gera histórico e auditoria.
- A atribuição automática poderá ser substituída por supervisor autorizado.

## Arquivos esperados

- Nova migration em `supabase/migrations/` para tipos, colunas, índices, RLS e RPCs.
- Smoke test SQL em `supabase/smoke-tests/` para pesos, exclusão de desqualificados, capacidade e auditoria.
- Ajustes mínimos em `PropostasKanban`/detalhe somente após a camada de dados estar validada.

## Segurança

- Classificação e distribuição serão executadas por RPCs protegidas; o navegador não decide a atribuição.
- LLM futuro deverá chamar uma função server-side e fornecer resultado estruturado, confiança e justificativa.
- Nenhum dado sensível será enviado ao LLM sem consentimento e minimização.
- A decisão final permanece revisável por operador autorizado.

## Verificação

- `supabase db push --dry-run` antes de aplicar.
- Smoke test SQL em banco local/remoto autorizado.
- `npm run lint`, `npm run typecheck` e build do frontend.
- Teste manual com lead de cada classe, analistas configurados, capacidade cheia e redistribuição.
