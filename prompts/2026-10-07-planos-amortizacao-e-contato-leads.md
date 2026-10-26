# Plano — planos de amortização, documento e contato de leads

## Objetivo

Completar a calculadora pública de amortização e melhorar o tratamento dos leads capturados:

1. Permitir adicionar um ou mais planos de amortização extra, calculando e comparando dinamicamente o cenário sem antecipação com o cenário com antecipação, para Price e SAC.
2. Paginar o cronograma detalhado na tela e permitir salvar um documento PDF com a marca Mercúrio, incluindo o cronograma completo.
3. Melhorar a leitura dos dados em `/admin/leads/simulacoes` e oferecer um botão que abre o WhatsApp com uma mensagem preenchida a partir do nome, tipo da calculadora e valor simulado.
4. Disponibilizar regras editáveis para essas mensagens em Configurações, sem misturar comunicação com os critérios de classificação ou distribuição operacional.

O trabalho desta etapa é local. Aplicar migration no Supabase de produção, publicar Edge Function ou frontend na Vercel e enviar mensagens/e-mails de teste continuarão sendo gates separados, com autorização específica.

## Skills e documentos lidos

- AGENTS.md fornecido pelo usuário nesta conversa; não foi encontrado `AGENTS.md` nem `README.md` na raiz do checkout. `docs/README.md` é o índice de documentação do projeto.
- Nenhuma skill adicional foi necessária para este escopo.
- `docs/README.md`.
- `docs/operacao/change-management.md`.
- `docs/operacao/simulador-publico.md`.
- `docs/operacao/criterios-classificador-leads-v1.md` e `docs/operacao/matriz-criterios-classificacao-leads.md`.
- `docs/blueprint/01-architecture.md`, `docs/blueprint/03-routes-navigation.md`, `docs/blueprint/04-database-schema.md` e `docs/blueprint/08-security-compliance.md`.
- `prompts/2026-10-07-simulador-amortizacao-publico.md`.
- Referência funcional: [Amortizador Bext](https://amortizador.bext.vc/), que oferece planos de amortização extra, opção de reduzir prazo ou parcela, frequência e comparação com/sem antecipação.

## Código e configuração inspecionados

- `app/src/components/PublicAmortizationSimulator.tsx` — fluxo público, captura, resumo, gráfico e cronograma atual.
- `app/src/lib/credito.ts` e `app/src/lib/amortizacaoPublica.ts` — cálculo Price/SAC, periodicidade da taxa e datas civis.
- `app/src/pages/admin/LeadsSimulacoes.tsx` — lista, detalhe, filtros e paginação atual dos leads.
- `app/src/pages/admin/Configuracoes.tsx` — aba Classificador de leads e RPC de configuração existente.
- `app/src/router.tsx` — rota pública e rota administrativa existentes.
- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql` e `supabase/migrations/20261007000001_simulacao_amortizacao_publica.sql` — tabela, view administrativa, captura e templates atuais.
- `supabase/functions/public-simulacao-lead/index.ts` — validação server-side, rate limit, honeypot e captura idempotente.
- `supabase/migrations/20261002000001_classificador_server_side_v1.sql` e `supabase/migrations/20260925000002_lead_classificacao_distribuicao.sql` — configuração do classificador, RPC e RLS.
- `app/package.json` — React/TypeScript/Tailwind, Recharts e `html-to-image`; não há biblioteca de geração de PDF instalada.
- Marca disponível em `app/src/assets/logos/logowide.png` e `app/src/assets/logos/logo-dark.png`.

O worktree já contém alterações locais ainda não commitadas relacionadas ao simulador público, ao painel de leads e à extensão inicial de amortização. A implementação deve preservar esse estado e limitar o diff ao escopo aprovado.

## Modelo de dados aprovado

### 1. Lead de simulação

Estender `public.simulacao_leads_publicos`, sem alterar os significados dos registros já existentes:

- `planos_amortizacao jsonb not null default '[]'`: lista validada de até 10 planos. Cada plano contém `valor_extra` positivo, `objetivo` (`prazo` ou `parcela`), `frequencia` (`unica` ou `mensal`) e `apos_parcela` (número inteiro da parcela após a qual começa).
- `resultado_com_amortizacao jsonb`: resumo calculado e validado no servidor, com totais pagos e de juros nos dois cenários, total extra amortizado, economia estimada de juros, parcelas reduzidas e data estimada de quitação.
- Não persistir a tabela inteira de até 320 parcelas. As linhas serão derivadas dos parâmetros e dos planos, reduzindo duplicação e volume de dados.

O registro continua representando uma única submissão do simulador. Ao concluir as quatro etapas de dados, o usuário verá um resultado prévio com o editor de planos; a tabela só será gravada quando ele clicar em **Salvar simulação e receber resultado**. Nesse envio único, a Edge Function/RPC valida a quantidade e os campos dos planos, recalcula o resultado no servidor e grava os parâmetros e o resumo. Assim, não há atualização anônima posterior do lead nem necessidade de criar um token público de edição. A view administrativa passa a expor os campos estritamente necessários à equipe interna.

### 2. Regras para mensagens de WhatsApp

Criar a tabela singleton `public.config_mensagens_simulador`, separada de `config_leads_operacao.classificador_criterios`:

- `id boolean primary key default true check (id)`;
- `regras jsonb not null`, com regras ativas ordenadas por prioridade;
- `updated_at timestamptz not null` e `updated_by uuid` para controle/auditoria.

Cada regra pode combinar tipo da calculadora (`home_equity`, `amortizacao` ou ambos), faixa mínima/máxima do valor simulado e texto com variáveis permitidas (`{{nome}}`, `{{tipo_calculadora}}`, `{{valor_simulado}}`). A primeira regra ativa correspondente vence; uma mensagem padrão atende casos sem regra correspondente. Tipos e faixas serão condições de contato, não classes de crédito.

O bloco de edição ficará na aba existente **Configurações > Classificador de leads**, em uma seção separada chamada **Mensagens de contato do simulador**. Leitura e alteração serão autorizadas no servidor somente para admin; alterações usarão RPC com validação, `app_is_admin_full()` e registro de auditoria. A configuração do classificador de propostas permanece independente.

### Relacionamentos e acesso

- Cada configuração de mensagem é global e não possui relação com um lead específico.
- Planos e resumo pertencem ao lead por colunas na própria `simulacao_leads_publicos`.
- A leitura dos leads continua limitada à view com `security_invoker` e RLS admin-only. Parceiros, membros de equipe, clientes e visitantes não leem leads nem regras administrativas.
- Nenhum PDF será enviado ao Storage: a geração será local no navegador a pedido do usuário.

## Decisões aprovadas

### Cálculo e experiência

- Adicionar planos à simulação de amortização; manter intacto o modo Home Equity.
- Permitir escolher redução de prazo ou redução de parcela, uma única vez ou mensalmente, e a parcela inicial do plano. Vários planos podem coexistir.
- Aprovado pelo usuário: “Múltiplas vezes” repete o mesmo valor mensalmente a partir da parcela escolhida até a quitação. Cada plano pode ser único ou recorrente; o cronograma aplica a parcela regular e depois a amortização extra do período.
- Redução de prazo mantém a parcela regular e encurta o saldo de parcelas. Redução de parcela recalcula as prestações restantes, preservando o prazo contratado quando o saldo permitir.
- Se o valor extra exceder o saldo devedor, aplicar somente o saldo restante, zerar a dívida e não gerar saldo negativo nem cobranças extras posteriores.
- Taxa fixa convertida para a convenção mensal já existente; não incluir correção monetária, seguros, tarifas, IOF ou carência, pois esses campos não existem no simulador atual. O resultado continuará identificado como estimativa.
- O resultado comparará os dois cenários em resumo e gráfico. O cronograma detalhado terá paginação de 12 parcelas por página, seletor de cenário e navegação acessível.
- O preview será mostrado depois da captura completa de contato e consentimento, mas antes da gravação. A ação final salvará os planos e o resumo em uma única captura idempotente e enfileirará os e-mails com o cenário final; editar planos antes disso não fará escritas adicionais no banco.

### Documento

- Usar a impressão nativa do navegador para oferecer **Salvar como PDF**, sem adicionar dependência. O documento terá logo Mercúrio, resumo comparativo e todas as parcelas dos cenários, mesmo que a tela esteja em outra página do cronograma.
- A geração será local; não cria arquivo no servidor nem envia dados a terceiro. O nome do arquivo seguirá o título do documento definido na tela.
- Os templates de e-mail existentes serão estendidos para incluir o resumo sem/com amortização extra; não haverá anexo PDF nem envio repetido ao modificar o preview.

### Leads e mensagens

- Exibir campos com formato `pt-BR` e rótulos por tipo: valores em real, datas locais, telefone legível e detalhes específicos de cada calculadora, incluindo os planos e o resumo de economia quando houver.
- Mostrar botão de WhatsApp no detalhe do lead e, se couber no layout atual, na linha da lista. O link será montado com o telefone normalizado para `55` + DDD/número e mensagem codificada.
- Abrir o WhatsApp somente após clique do operador. Não enviar automaticamente nem integrar uma API de disparo.
- Regras por tipo/faixa de valor serão inicialmente editáveis no painel de configuração. Não usar classes Triplo A/Double AA/Estressado/Desqualificado para selecionar mensagem, pois os leads do simulador não passam pelo classificador de propostas.
- O texto padrão seguirá o exemplo do usuário e deixará explícito que é uma abordagem sobre simulação, sem afirmar aprovação de crédito.

## Arquivos esperados

- `app/src/lib/amortizacaoPublica.ts` ou novo módulo adjacente — cálculo e tipos dos planos, cenário base e cenário com extra.
- `app/src/components/PublicAmortizationSimulator.tsx` — editor de planos, comparação dinâmica, paginação do cronograma e ação de PDF.
- `app/src/pages/admin/LeadsSimulacoes.tsx` — formatação, dados dos planos e CTA de WhatsApp.
- `app/src/pages/admin/Configuracoes.tsx` — seção separada de mensagens editáveis.
- `app/src/test/publicAmortizationSimulator.test.tsx` e novos testes unitários do cálculo de amortização extra.
- `supabase/migrations/20261007000002_simulacao_planos_contato.sql` — colunas aditivas, tabela singleton, RLS, RPC de configuração, view e templates de e-mail atualizados.
- `supabase/functions/public-simulacao-lead/index.ts` — validação e persistência server-side dos planos e do resumo recalculado.
- `supabase/smoke-tests/fase-40-simulacao-planos-contato.sql` — verificação de estrutura, cálculo e permissões, sem dados reais.
- `docs/operacao/simulador-publico.md` e `docs/README.md` — contrato atualizado e novo registro operacional.

Não se espera alteração em `mobile/`, rotas, classificação/distribuição operacional, Electron, Serasa/Bacen, novos serviços externos ou dependências npm.

## Critérios de aceite

1. Sem plano extra, a tabela, totais e parcelas correspondem ao cálculo atual.
2. Price e SAC aceitam planos únicos e mensais, com escolha de redução de prazo ou parcela e início após a parcela indicada.
3. A comparação e o cronograma mudam imediatamente ao adicionar, editar ou remover um plano; o principal nunca fica negativo.
4. Vários planos no mesmo período têm resultado determinístico; parcelas posteriores à quitação deixam de receber extra.
5. Os resumos e planos gravados no lead são recalculados/validados no servidor e aparecem no painel interno.
6. O cronograma mostra uma página por vez, oferece navegação por teclado e o PDF contém o cronograma completo dos cenários, logo e resumo.
7. O PDF abre a impressão nativa; cancelar a impressão não altera o lead nem os parâmetros da simulação.
8. O painel de leads mostra contatos e valores formatados, com textos coerentes para Home Equity e amortização.
9. O botão WhatsApp preenche nome, tipo da calculadora e valor com caracteres codificados corretamente; não envia a mensagem sem ação humana.
10. Regras de mensagem podem ser editadas e salvas em Configurações; a regra por tipo/faixa seleciona o texto correto e o fallback funciona.
11. Parceiro/cliente/anon não acessa leads nem configurações; somente administrador autorizado altera regras. Nenhuma chave privada vai para o browser.
12. O simulador Home Equity, a captura existente, consentimento, idempotência, honeypot, rate limit e disparo de e-mail seguem sem regressão.

## Segurança e privacidade

- Validar no servidor números, enums, tamanho da lista, sequência e limites de cada plano; recalcular resultados e ignorar qualquer total fornecido pelo browser como fonte de verdade.
- Não permitir escrita direta anônima nas tabelas. Captura continuará pela Edge Function e RPC seguras; regras administrativas usarão RPC com guard de admin e auditoria.
- A view de leads mantém RLS e não será exposta ao perfil `anon` ou a parceiros. A configuração de mensagens não será publicada na rota pública.
- WhatsApp abre apenas pelo clique de um admin; normalizar o telefone, codificar a mensagem e usar contexto de janela segura. Não registrar telefone/mensagem em analytics ou logs.
- O PDF não persiste dados nem chama APIs externas. Aplicar CSS de impressão para excluir controles, menus e informações técnicas.
- Manter aviso de estimativa e não incluir dados de consulta Bacen/Serasa, LLM, aprovação ou classificação de crédito.

## Testes previstos

### Automáticos

- Testes de Price/SAC sem extra (regressão), extra único e mensal, redução de prazo/parcela, taxa zero, múltiplos planos, limite/excesso e encerramento do saldo.
- Testes de paginação (primeira, intermediária, última página) e garantia de que o PDF inclui todas as linhas.
- Teste de fluxo: concluir as quatro etapas mostra o preview sem criar lead; salvar o resultado captura uma vez, com planos finais, e enfileira os templates atualizados.
- Testes de regras de mensagem: tipo, faixas inclusivas, prioridade, variáveis, caracteres especiais, telefone inválido e fallback.
- `npm run test -- --run`, `npm run typecheck`, `npm run lint` e `npm run build`.
- Dry-run estático da migration e smoke SQL preparado; nenhum teste remoto ou envio será feito nesta aprovação.

### Manuais

- Completar fluxo público em Price e SAC; alternar planos, forma de amortizar e frequência; comparar resumo e parcelas.
- Testar quitação antecipada, primeira/última página do cronograma, viewport móvel e impressão PDF com várias páginas e logo.
- Conferir um lead de cada modo e um com plano no painel; abrir WhatsApp e verificar mensagem preenchida antes do envio.
- Salvar regras de mensagem, testar combinações por tipo/faixa e fallback.
- Confirmar que usuário parceiro e sessão anônima não veem o painel/regra; repetir o fluxo Home Equity sem alterações.

## Rollout e rollback

- Após aprovação, implementação e validações ocorrerão localmente. Produção permanece intacta até um gate posterior.
- Migration será aditiva e preservará registros atuais. Rollback operacional: ocultar a edição de planos e botão WhatsApp, voltar a usar o resumo base e desativar a leitura das novas regras; preservar dados e mensagens já enfileiradas.
- Aplicar migration, publicar Edge Function, enviar e-mail de teste, fazer deploy Vercel ou publicar builds desktop exigem aprovação específica depois do diff e dos testes locais.

## Aprovação e execução

O usuário aprovou o escopo, o modelo de dados e a premissa mensal antes do início da implementação. A extensão foi implementada somente no checkout local. Migration remota, publicação da Edge Function, teste com e-mail real e deploy Vercel continuam como gates separados, aguardando aprovação específica depois da revisão do diff e das validações locais.
