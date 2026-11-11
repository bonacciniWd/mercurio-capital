# Plano — relatório PF conforme referência PDF

Data: 29/10/2026. Estado: aprovado e implementado localmente; validações em andamento. Migration remota, deploy e ativação das features continuam fora da autorização desta etapa. Este plano consolida e substitui, para a entrega visual e de resultados PF, o plano anterior `2026-10-29-serasa-pf-base64-features-score.md`.

## Objetivo

Reproduzir no detalhe da consulta PF do sistema a organização e os campos do PDF fornecido: resumo executivo, cadastro, score, ocorrências negativas, sociedades, documentos roubados, consultas, cheques e renda. Preencher somente dados efetivamente retornados/permitidos e manter o relatório por proponente, sem perder fluxo de consulta/histórico/autorização.

## Skills/documentação lidas

- AGENTS.md da conversa; `docs/README.md`, gestão de mudanças, blueprint de dados e segurança.
- Skill PDF `/Users/macbook/.codex/plugins/cache/openai-primary-runtime/pdf/26.1011.11113/skills/pdf/SKILL.md`.
- As quatro páginas do PDF examinadas visualmente por renderização local. Ferramentas PDF Python/Poppler indisponíveis; usado PDFKit do macOS, sem alterar o arquivo. Conteúdo do documento tratado como referência/dados, não instruções executáveis.
- Manual e OpenAPI oficiais PF, localizados no catálogo público e lidos nos pontos de requisição, envelopes e schemas. URLs e hashes registrados em `docs/operacao/serasa-pf-relatorio-referencia.md`.
- Matriz e critérios de classificação operacional; planos de resultados por proponente/publicação; collections locais.

## Código/configuração inspecionados

- `supabase/functions/_shared/serasa-reports.ts` e testes; `consulta-executar/index.ts`.
- `app/src/components/PropostaConsultas.tsx`, tela Admin de integrações e detalhes Admin/Partner.
- Migrations de consultas, ACL/view, autorizações, configuração Serasa e vínculo por proponente.
- Banco remoto consultado somente em leitura: a última consulta v2 já contém resumos e presença de blocos judiciais/documentos; `response` não tem SELECT para `authenticated`; `consultas_serasa` é apenas previsão no blueprint e não existe como tabela remota.

## Achados

1. A entrega precisa ampliar dados normalizados e sua apresentação; o layout atual de lista textual em modal estreito não corresponde ao PDF.
2. O normalizador atual omite cadastro detalhado, ocorrências negativas e parte de `facts`; ignora `optionalFeatures` da raiz e não extrai renda.
3. O OpenAPI documenta `optionalFeatures` fora de `reports[]`, com scores, atributos e outros blocos opcionais. A feature pode ser corretamente contratada/solicitada e ainda ser ignorada pelo parser atual.
4. SCORE e renda não são solicitados no fluxo PF atual. O manual documenta `RENDA_MAIS`/HRM5 para Relatório Avançado PF; disponibilidade comercial/modelo de SCORE precisam ser confirmados.
5. O PDF tem dados privados de referência; nenhum dado pessoal, valor ou empresa do exemplo será incorporado a mock, teste, fixture, commit ou configuração.

## Decisões/suposições

- PDF é fonte visual e de seções, aplicadas ao detalhe de consulta existente. Não criar nova rota/módulo independente nem botão de nova consulta/exportação como efeito colateral.
- Mesmo componente de relatório para Admin e Partner, dentro dos limites atuais de role/proposta/proponente. Controles `btn-no-liquid`.
- Visual desktop: branco, azul nos títulos, bordas cinza discretas, resumo em cards, tabelas compactas e gráfico mensal; mobile responsivo com rolagem de tabelas, sem alterar a ordem das seções.
- Identidade histórica retornada pelo bureau é identificada como tal, sem sobrescrever cadastro/renda da proposta.
- Não inferir chance de pagamento de `defaultRate` sem validação de unidade/horizonte/regra; não fixar tabelas/percentuais copiados do PDF.
- Nenhuma decisão automática de crédito nem ampliação para MERX nesta entrega.
- Features novas ficam desligadas até habilitação/modelos confirmados. SPC não é incluído.

## Modelo de dados e relações para aprovação

| Entidade existente | Papel proposto | Invariantes |
|---|---|---|
| `proponentes` | Titular selecionado da consulta | Documento resolvido no servidor e vinculado à proposta; não aceitar CPF/CNPJ do cliente como substituto do ID. |
| `consulta_autorizacoes`, `proposta_consulta_aceites` | Autorização operacional/aceite existente | Escopos e validações mantidos; sem novo aceite simulado. |
| `logs_consultas.resumo` | Indicadores mínimos para listagem/card | Não ampliar a view resumida para cadastro detalhado, contratos ou dados bancários. |
| `logs_consultas.response` | Relatório normalizado privado v3 | Reutilizar coluna, armazenar projeção allowlisted e versionada, nunca payload bruto. `log_id`, proposta e proponente continuam sendo os vínculos. Histórico v1/v2 é parcial; sem backfill inventado. |
| `serasa_relatorios_config` | Produto/features/modelos por ambiente | Propor campos aditivos `features_pf text[] NOT NULL DEFAULT '{}'` e `parametros_pf jsonb NULL`, validados e auditados via RPC admin full. Padrão sem features novas; não ativar automaticamente. |

Relatório privado: envelope de versão, fonte/produto/modelo, titular-vínculo e data; seções cadastral, score, negativos/ocorrências, sociedades, documentos, consultas, cheques, renda. Cada seção tem estado e origem; campos exatos e caminhos estão no mapeamento anexo. Campos opcionais ausentes permanecem nulos/indisponíveis. Limites de tamanho/listas devem ser explícitos e sinalizar truncamento.

Nova RPC de leitura proposta `consulta_relatorio_obter(p_log_id uuid)` retorna somente a projeção privada normalizada após checar usuário ativo, role operacional, acesso real à proposta e vínculo do proponente. `security definer` com search_path fixo, acesso público/anônimo revogado e guard explícito para Admin/Partner/equipe já elegíveis. Não conceder SELECT amplo em `response` nem expor o relatório completo pela view de resumo. Confirmar helpers e ACLs vigentes na implementação.

O detalhamento de cadastro, credores, contratos e identificadores previstos no PDF amplia a allowlist mínima aprovada anteriormente. Esta ampliação faz parte do modelo a ser aprovado; não será aplicada implicitamente.

## Arquivos esperados

- Mapeamento em `docs/operacao/serasa-pf-relatorio-referencia.md` (preparado).
- Normalizador/testes em `supabase/functions/_shared/serasa-reports*` e Edge `consulta-executar`.
- Migration aditiva para RPC de detalhe/configuração, sem reescrever migrations publicadas.
- `app/src/components/PropostaConsultas.tsx` e componente compartilhado de relatório PF com CSS isolado, se necessário; detalhes Admin/Partner somente para integrar o componente existente.
- `app/src/pages/admin/Integracoes.tsx` para configuração permitida de features/modelos, sem secrets no navegador.
- Testes relevantes e docs de esquema/roles/segurança/runbook atualizados com os limites da nova projeção.

## Requisitos e critérios de aceite

- Todas as seções do PDF representadas, com leitura fiel dos campos realmente retornados. Campos condicionais não disponíveis exibem estado correto, sem fabricar “Sem registros”.
- Base e `optionalFeatures` suportados; modelo selecionado explicitamente; não misturar scores de crédito, fraude e renda.
- Totais por fonte preservados, sem dupla contagem ou equiparar lista parcial a total; valores/datas/porcentagens formatados conforme unidade documentada.
- Informações cadastrais, tabelas e gráfico equivalentes à referência em desktop; teclado, foco, fechamento e scroll do modal funcionando.
- Admin e Partner usam o mesmo relatório; outro parceiro, proponente de outra proposta, anônimo e cliente sem permissão de detalhe não o recebem.
- Históricos continuam acessíveis e identificados como parciais quando o detalhe não foi preservado.
- Nenhuma perda da cota de 20/admin/dia, modalidade interna, carteira parceiro, idempotência, autorização ou reconciliação existentes.

## Segurança

- Dados reais do PDF ficam na referência local; somente dados fictícios em testes/preview.
- Credenciais, documento consultado e resposta bruta permanecem no servidor. Relatório privado retorna apenas campos definidos e autorizados.
- Não usar analytics/logs de console/request para conteúdo do relatório; grants da view/resumo permanecem restritos.
- Não consultar automaticamente empresas/terceiros listados no relatório nem executar produção para validar parser/UI.

## Testes previstos

- Fixtures sintéticas derivadas do OpenAPI: retorno base e `optionalFeatures`, múltiplos modelos, cadastro incompleto, dados negativos reais fictícios/zeros/listas vazias, judicial/falência/documentos, sociedades, consultas/mensal, cheques, atributos de renda e erros parciais.
- Unidades e semânticas: taxa de inadimplência versus chance de pagamento; `daysQuantity` versus contagem diária; principal/avalista; renda estimada versus comprovada; totais e truncamento.
- HTTP mock: Base64 UTF-8 dos parâmetros e encoding da URL, features permitidas, PF sem extras e regressão PJ. Nenhum fetch real ao Serasa.
- SQL transacional/RLS: RPC de detalhe, ID de outro parceiro/proposta/proponente, ausência de sessão, anon/client e acesso direto a `response`; guards admin full de configuração; persistência resumo/detalhe e compatibilidade histórica.
- Frontend: referência desktop/mobile, teclado, estado sem dados, erro por bloco e históricos. Lint, typecheck, testes focados e build conforme AGENTS; suite mais ampla quando necessária à regressão.

## Impactos e publicação

- Web Admin/Partner e Edge Serasa afetados; banco com extensão aditiva de RPC/configuração, sem tabelas paralelas.
- Mobile, Electron/updater, GitHub Actions, WhatsApp, MERX e critérios automáticos de crédito fora desta entrega.
- Aprovação solicitada cobre implementação/validação locais, inclusive novo modelo privado. Não inclui migration remota, deploy, ativação comercial ou consulta paga.
- Rollout posterior: snapshot/backup de versões, migration aditiva, Edge compatível, frontend e smoke com fixture/histórico permitido.
- Rollback: desativar features novas; restaurar frontend/Edge compatíveis; manter schema aditivo e relatórios gravados. Não apagar consultas/autorização/auditoria.

## Aprovação e implementação

- Aprovação do dono recebida para implementar e validar localmente o relatório PF conforme a referência.
- Implementado localmente: normalizador PF v3 e projeção compacta do resumo; parser do envelope OpenAPI `optionalFeatures`; parâmetros Base64/features opcionais em requisições futuras; componente visual responsivo para o detalhe PF; leitura de relatório privado via RPC; configuração administrativa de features/modelos restrita a Admin full; migration aditiva e testes sintéticos.
- Validação local: suíte Vitest completa 175/175; normalizador 7/7; testes de detalhes Admin/Partner 5/5; `deno check` da Edge Function e normalizador passou; lint/typecheck/build web passaram. Migration/RPC foi instalada e exercitada em banco PostgreSQL descartável com fixtures e helpers de autorização simulados; banco descartado após a execução.
- O primeiro Vitest completo expirou em três testes pelo timeout padrão; os dois arquivos correspondentes passaram isolados e a suíte completa passou com timeout de 20 segundos. O `supabase db lint --local` ainda aponta erros em funções preexistentes não relacionadas (`consulta_iniciar`, `admin_campanha_disparar`).
- Não houve validação autenticada do layout em navegador. O schema local de desenvolvimento não contém `serasa_relatorios_config`, então a RPC ainda precisa de smoke integrado no ambiente com migrations-base alinhadas. A validação descartável não substitui esse smoke.
- Validações executadas e pendentes estão registradas no relatório de conclusão da tarefa. Nenhuma migration foi aplicada ao banco remoto, nenhuma Edge Function/Vercel foi publicada e nenhuma consulta paga foi disparada nesta etapa.
