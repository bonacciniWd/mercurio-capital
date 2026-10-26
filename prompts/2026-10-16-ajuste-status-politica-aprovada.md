# Plano — atualizar o status da política aprovada pelo advogado

**Status:** implementação e validação local concluídas em 16/10/2026.

## Objetivo

Apresentar a política aprovada sem rótulos de minuta/revisão e sem ressalvas públicas que contradigam fatos institucionais confirmados. Informar a razão social, CNPJ, endereço e canal de privacidade; permitir que a pessoa abra o próprio cliente de e-mail com pedido pré-preenchido.

## Contexto e arquivos inspecionados

- Instruções `AGENTS.md` fornecidas nesta conversa.
- `app/src/pages/public/PoliticaPrivacidade.tsx`.
- `app/src/components/CpcLeadForm.tsx`.
- `app/src/components/PublicSimulator.tsx`.
- `app/src/components/PublicAmortizationSimulator.tsx`.
- `app/src/test/creditoParaConstrucao.test.tsx`.
- `app/src/test/publicSimulator.test.tsx`.
- `app/src/test/publicAmortizationSimulator.test.tsx`.
- `app/src/pages/Landing.tsx` para conferir CNPJ e endereço existentes.
- `docs/operacao/whatsapp-cloud-api-setup.md` e `supabase/migrations/20260609000007_seed_empresa_config.sql` para conferir a razão social já registrada no projeto.
- `docs/operacao/leads-publicos-cpc.md`.
- `docs/operacao/politica-privacidade-publica.md`.
- `prompts/2026-10-16-ajuste-status-politica-aprovada.md`.
- `prompts/2026-10-16-ajuste-status-politica-aprovada.md`.
- Foi localizada linguagem de “Minuta em revisão interna”, “Minuta 0.2”, necessidade de validação jurídica das bases legais e submissão futura à revisão jurídica.

## Decisões e suposições propostas

- Atualizar o título visual de “Minuta 0.2” para “Política de Privacidade” e remover o aviso de revisão interna da página pública.
- Reescrever referências autorreferentes a “minuta” e à aprovação/revisão jurídica como texto de política já aprovado.
- Remover a pendência de validação jurídica das bases legais, sem inventar novos fundamentos ou ampliar finalidades.
- Identificar a empresa como Mercurio Capital Ltda., CNPJ 64.382.034/0001-70, com endereço Rua 1301, 471, Centro, Balneário Camboriú/SC, CEP 88330-795, conforme confirmação do usuário e material institucional existente.
- Remover o rodapé que negava confirmação sobre correspondente/compartilhamento e apontava razão social ausente; não inventar nomes de instituições financeiras.
- Preservar apenas condicionais operacionais que descrevem corretamente recursos executados conforme solicitação ou configuração; não apresentar pendências internas como aviso público.
- Fazer varredura das ressalvas públicas de pendência (“não identificado”, retenção a confirmar, configuração efetiva por confirmar) e substituí-las por descrições objetivas do tratamento, sem inventar estado de produção, prestador ou destinatário.
- Atualizar teste, mapa operacional e plano anterior para registrar que a revisão jurídica foi informada como concluída.
- Na seção de direitos, oferecer um `mailto:` para `contato@mercuriocapitalsa.com` com assunto e corpo-modelo, sem envio automático; a pessoa completa seus dados e envia pelo próprio aplicativo de e-mail.
- Remover do formulário CPC as mensagens que vinculavam a indisponibilidade à revisão/publicação da política; manter a recusa server-side e explicar apenas a indisponibilidade temporária, sem ativar a captura.
- Não alterar a lógica dos formulários, consentimentos, dados coletados, endpoints, funções de servidor ou configuração remota. O escopo inclui apenas links, mensagens de status, redação da política e fatos institucionais informados.

## Arquivos esperados

- `app/src/pages/public/PoliticaPrivacidade.tsx`.
- `app/src/test/creditoParaConstrucao.test.tsx`.
- `app/src/components/CpcLeadForm.tsx`.
- `app/src/components/PublicSimulator.tsx`.
- `app/src/components/PublicAmortizationSimulator.tsx`.
- `app/src/test/publicSimulator.test.tsx`.
- `app/src/test/publicAmortizationSimulator.test.tsx`.
- `docs/operacao/leads-publicos-cpc.md`.
- `docs/operacao/politica-privacidade-publica.md`.
- `prompts/2026-10-16-politica-privacidade-bases-legais.md`.

## Requisitos e critérios de aceite

- A página não se apresenta como minuta nem diz que aguarda revisão jurídica/interna.
- A página informa os dados institucionais confirmados e não apresenta ressalvas sobre ausência desses dados.
- O link abre o cliente de e-mail com destinatário, assunto e modelo preenchidos; o site não envia a mensagem automaticamente.
- Não são inventados nomes de instituições financeiras, contatos de encarregado, prazos de retenção, fornecedores ou estados de configuração em produção.
- Consentimentos, endpoints, classificação, banco de dados e funções de servidor não mudam.
- Testes, lint, typecheck e build passam; smoke em Chrome desktop e mobile confirma a página e seus links.

## Segurança e limites

- Nenhum dado pessoal, segredo ou configuração de produção será consultado ou alterado.
- Nenhuma migration, envio de formulário/mensagem, publicação ou deploy está incluído.
- A atualização do status jurídico não será usada como evidência de que configurações ou fornecedores em produção foram confirmados.

## Adendo — canal de privacidade por e-mail

O usuário informou o canal `contato@mercuriocapitalsa.com` e pediu um link que abra o aplicativo de e-mail com destinatário, assunto e corpo-modelo preenchidos, para que a própria pessoa complete seus dados e envie a solicitação. Incluir os campos mínimos nome, e-mail de contato e descrição do pedido. O link não envia a mensagem automaticamente; nenhum e-mail será enviado durante a implementação.

## Aprovação

O usuário informou que o texto foi aprovado pelo advogado, pediu remover as ressalvas públicas de revisão, e forneceu o canal de e-mail e os dados institucionais confirmados. A execução não altera consentimento, captura, configuração remota ou fluxo de envio; registrar abaixo os testes efetivamente executados.

## Validação executada

- `npm test -- src/test/creditoParaConstrucao.test.tsx src/test/publicSimulator.test.tsx src/test/publicAmortizationSimulator.test.tsx` — 3 arquivos e 12 testes passaram.
- `npm run lint` — exit 0, sem erros; 38 avisos já existentes no projeto.
- `npm run typecheck` — passou.
- `npm run build` — passou; permanece o aviso do chunk principal acima de 500 kB.
- Smoke da versão compilada em Chrome: título correto, sem marcadores de minuta/revisão nem ressalvas removidas; razão social, CNPJ, endereço e link `mailto:` conferidos. Desktop `1440/1440` e mobile `390/390` entre largura do viewport e do documento. O link foi inspecionado sem abrir o cliente ou enviar mensagem.
- Nenhum dado real ou e-mail foi enviado; não houve alteração remota, publicação ou deploy.
