# Plano — tornar clara a instrução de consulta no convite web e mobile

Data: 09/11/2026. Estado: implementação local concluída e validada. Não inclui deploy, consulta Serasa real ou publicação.

## Objetivo

Corrigir o fluxo em que uma consulta Serasa PF volta a exigir documento de autorização quando o aceite digital do cliente não foi registrado, cobrindo web e mobile com prioridade para a experiência web.

Na página web do convite, tornar a instrução opcional já existente mais visível e explicar claramente que, se não for marcada, consultas continuarão exigindo documento de autorização aprovado. No onboarding mobile, apresentar a mesma escolha explícita antes de validar/consumir o convite. Marcada, enviar `aceite_consultas: true`; desmarcada, enviar `false`.

Na tela web de consultas Admin/Partner, explicitar quando o requisito vem da ausência de aceite do cliente e indicar os dois caminhos válidos: documento aprovado ou reemissão do convite para o cliente registrar sua instrução no fluxo web. Para clientes já ativados, usar a reemissão de convite já existente; não registrar aceite em nome do cliente.

CPF e nome identificam quem consultar; não substituem autorização. Marcar a instrução não executa consulta nem gera cobrança. A chamada Serasa continua restrita à ação administrativa/parceiro existente e às validações atuais.

## Skills e documentos lidos

- `AGENTS.md` fornecido na conversa.
- `prompts/2026-10-27-plano-aceite-consultas-cliente.md` — regra previamente aprovada para aceite explícito opcional e evidência documental como alternativa.
- `prompts/2026-11-07-mobile-onboarding-figma-pf-pj-implementacao.md` — exige que o aceite de consulta seja separado dos aceites gerais e nunca implícito.
- `app/src/pages/public/ClienteProposta.tsx` — instrução web atual já existente antes de consumir o convite.
- `app/src/components/PropostaConsultas.tsx` — consulta Admin/Partner mostra seletor de evidência quando não há aceite ativo.
- `app/src/pages/client/PropostaDetalhe.tsx` — portal autenticado atual não oferece registro de instrução de consulta.
- `mobile/app/onboarding.tsx` — consumo do convite envia `aceite_consultas: false`; etapa de privacidade ocorre depois.
- `supabase/functions/magic-link-consume/index.ts`, `supabase/functions/magic-link-issue/index.ts`, e migrations `20261027000002_proposta_consulta_aceite_cliente.sql` e `20261028000003_serasa_resultados_por_proponente.sql`.

## Estado e causa

A página pública web já oferece a opção no convite, mas sua consequência ao deixar desmarcada não está clara. No mobile, o convite é consumido sempre com `aceite_consultas: false`. Sem aceite registrado, a tela Admin/Partner exige evidência documental aprovada. Clientes já ativados podem receber novo link pelos fluxos de reemissão existentes e decidir no mesmo convite web.

As migrations relacionadas constam aplicadas no projeto Supabase remoto e local sincronizado. O fluxo de autorização aceita recibo digital válido ou documento aprovado; não há evidência de que o endpoint da Serasa exija seleção de arquivo.

## Modelo de dados e regras

- Nenhuma tabela, coluna ou migration nova.
- Reutilizar `proposta_consulta_aceites`, `magic-link-consume`, o parâmetro existente `aceite_consultas` e os fluxos atuais de emissão/reemissão.
- Associar o aceite somente ao cliente principal, proposta, link consumido e escopos validados pelo backend.
- Estado inicial desmarcado; os aceites genéricos de privacidade/uso de dados não alteram este estado.
- Recusar não impede ativar a conta nem continuar o onboarding; mantém a via de evidência documental aprovada.
- O aceite não dispara consulta, não debita saldo e não envia CPF/CNPJ no payload do cliente.
- Admin/Partner não pode registrar aceite em nome do cliente; a UI apenas explica a ausência e orienta a reemissão ou o documento aprovado.

## Arquivos esperados

- `app/src/pages/public/ClienteProposta.tsx`: destacar a instrução opcional existente e explicar a consequência de não aceitá-la, mantendo-a desmarcada e antes do consumo.
- `app/src/components/PropostaConsultas.tsx`: quando faltar aceite, explicar a causa e orientar os dois caminhos autorizados, preservando o seletor de documento.
- `mobile/app/onboarding.tsx`: apresentar a mesma escolha explícita antes da validação/consumo do convite e enviar o booleano correspondente.
- Testes focados dos fluxos web/mobile, conforme infraestrutura existente.
- Este plano atualizado com resultado da implementação e verificações.

## Critérios de aceite

- A opção web permanece explícita, opcional e desmarcada inicialmente; informa que, sem ela, será necessário documento aprovado para consultas externas.
- No mobile, a opção aparece antes de validar/consumir convite, inicia desmarcada e envia `true` ou `false` conforme a escolha.
- Quando Admin/Partner não encontra aceite, a UI explica a causa e orienta reemitir o convite ao cliente ou usar documento aprovado, sem aceitar em nome dele.
- Erro ou convite recusado não concede aceite; nenhuma consulta ou cobrança ocorre durante o onboarding.
- Os aceites gerais de privacidade e uso de dados permanecem independentes.
- Depois do fluxo, consulta usa aceite digital quando registrado; sem ele, permanece a exigência de documento aprovado.
- Não altera regra de autorização, provedor, preço, migrations, Edge Function ou publicação.

## Segurança e validação

- Titular, proposta, escopos e registro continuam determinados e validados pelo backend; clientes só enviam a escolha booleana explícita junto ao token existente.
- Verificar estados marcado/desmarcado, texto e posição, erro de consumo, independência dos aceites gerais e orientação para reemissão sem enviar e-mail nem modificar dados de cliente.
- Executar testes focados, typecheck, lint, build web/mobile conforme scripts do projeto e `git diff --check`.
- Não usar fixture/cliente real, não rodar consulta Serasa, não alterar dados de produção e não publicar.

## Resultado e validação

- Implementado o destaque e a explicação no convite web, a instrução opcional no onboarding mobile, e a orientação sobre aceite/documento na tela Admin/Partner.
- Teste focado web: 3 passaram. Lint dos arquivos web alterados passou. Typecheck web e mobile passaram.
- Build web e export estático do bundle iOS passaram.
- Suíte web completa: 227 passaram e 15 falharam em `adminLeadsSimulacoes.test.tsx` e `publicAmortizationSimulator.test.tsx` (dados ausentes esperados pelos testes e timeout no teste do simulador). Essas falhas não envolvem os arquivos alterados.
- Lint geral web passou com avisos já existentes em arquivos não alterados. A verificação `git diff --check` escopada passou; a verificação global apontou uma linha em branco no fim de `mobile/global.css`, arquivo preexistente modificado fora deste escopo.
- Não foi possível executar inspeção manual no navegador local, pois não há sessão Chrome com depuração remota disponível. Nenhuma consulta Serasa, alteração remota ou publicação foi realizada.

O aceite original autorizou a implementação local. Deploy, publicação ou consulta paga continuam exigindo autorização separada.
