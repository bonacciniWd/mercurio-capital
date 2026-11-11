# MERX pública — saudação, triagem e captação por intenção

Status: aprovado e implementado localmente em 30/10/2026. Nenhuma migration remota, publicação de Edge Function, ativação em produção ou deploy Vercel realizada.

## Objetivo

Fazer o chat público da MERX iniciar o atendimento com uma saudação que apresente a Mercúrio Capital e o workspace, pergunte como chamar o visitante e conduza a conversa por uma das duas intenções: originador interessado em parceria ou cliente buscando crédito. Respostas devem ser úteis, curtas e fundamentadas em conteúdo público validado. A captação de contato deve acontecer como convite opcional e contextual, sem interromper as respostas nem exigir dados para navegar.

## Skill, instruções e documentos lidos

- Instruções `AGENTS.md` fornecidas nesta conversa: leitura e inspeção antes de alterações, plano aprovado antes de implementar, preservar stack e privilégios, validações e relatório final.
- `skills/UX_skills.md`: acessibilidade, ordem/clareza do fluxo, labels, teclado, foco, motion reduzido e linguagem simples.
- `docs/README.md` e `docs/12-finalizacao.md`.
- `docs/blueprint/01-architecture.md`, `02-roles-permissions.md`, `03-routes-navigation.md`, `06-modules-features.md` e `08-security-compliance.md`.
- `docs/operacao/simulador-publico.md`, `docs/operacao/politica-privacidade-publica.md` e `docs/operacao/2026-10-29-whatsapp-merx-inbound-pendencias.md`.
- `prompts/2026-10-29-merx-publica-faq-captacao.md` e `prompts/2026-10-30-merx-lead-capture-validation.md`.
- Conteúdo público atual em `app/src/pages/Landing.tsx`, `app/src/pages/CreditoParaConstrucao.tsx`, `app/src/pages/public/Simulador.tsx` e `app/src/pages/public/Registro.tsx`.

## Código e modelo existentes inspecionados

- Chat e FAQ determinística: `app/src/components/merx/MerxPublicChat.tsx` e `app/src/lib/merxPublica.ts`.
- Edição de saudação/FAQ: `app/src/components/admin/MerxPublicaTab.tsx` e RPCs da migration `20261030000001_merx_public_faq.sql`.
- Envio e validação segura: `supabase/functions/public-merx-lead/index.ts`, `app/src/lib/emailValidation.ts` e `app/src/lib/recaptchaV3.ts`.
- Modelo de lead e lista Admin: `merx_leads_publicos`, `v_admin_leads_publicos`, `app/src/pages/admin/LeadsSimulacoes.tsx`, `app/src/lib/simulacaoLeadPresentation.ts` e `app/src/components/SimulacaoLeadDetalhe.tsx`.
- O interesse atualmente aceita `atendimento`, `home_equity` e `construcao`; a Edge Function e a restrição da tabela validam o mesmo catálogo. O painel já apresenta contatos MERX, cidade, assunto e status comercial.

## Decisões e suposições propostas

1. **Duas trilhas explícitas.** Depois da saudação e do nome/preferência de tratamento, oferecer botões “Quero ser parceiro/originador” e “Busco crédito”. Não inferir o ramo a partir de mensagens ambíguas; perguntar com botões quando necessário.
2. **Trilha de originador.** Explicar em texto curto, a partir da descrição pública do workspace, que o parceiro pode cadastrar e acompanhar propostas e atividades. Oferecer `https://www.mercuriocapitalsa.com.br/p/registro` (ou rota relativa `/p/registro`) e, separadamente, “Pedir contato da equipe”. O usuário confirmou que quer captar o contato e oferecer cadastro.
3. **Trilha de cliente.** Identificar o interesse com escolhas públicas disponíveis: Home Equity, Crédito para Construção, Financiamento Imobiliário ou “Ainda estou avaliando”. Usar FAQ curada para explicar apenas o que os materiais públicos dizem; oferecer links para `/simulador` e `/credito-para-construcao` quando aplicáveis. Para outros produtos/perguntas sem fonte pública, oferecer contato ou dizer claramente que a informação não está disponível.
4. **Nome e privacidade.** Perguntar como a pessoa prefere ser chamada e manter o nome apenas em estado volátil do componente. Não enviar nem persistir a conversa. Se a pessoa solicitar contato, pré-preencher o formulário existente com esse nome, permitindo editar; cidade, e-mail, telefone e consentimento continuam exigidos no formulário. O envio só grava após consentimento explícito. Encerrar/reiniciar a conversa apaga o nome e a intenção em memória.
5. **Captação sutil e opcional.** O chat responde às perguntas primeiro. A cada trilha, oferecer no momento adequado o CTA contextual “Falar com a equipe”; não abrir formulário automaticamente nem bloquear simulador, cadastro ou navegação.
6. **Fonte de resposta.** Não conectar documentos internos diretamente ao navegador, não expor conteúdo restrito, não indexar ou recuperar documentos em tempo real e não usar LLM nesta fase. Criar/ajustar um catálogo curado de FAQ com origem rastreável para páginas/documentos públicos e respostas em texto simples, sujeito a edição/publicação pelo Admin. A FAQ permanece determinística e configurável em `admin/configuracoes`.
7. **Sem condições financeiras inventadas.** Não prometer aprovação, limite, taxa, prazo de retorno, custo ou disponibilidade de produto. Valores demonstrativos do simulador sempre identificados como estimativa e sujeitos à análise, conforme os avisos já existentes.
8. **Novo interesse de originador.** Reutilizar a tabela existente `merx_leads_publicos`; adicionar `parceiro_originador` ao catálogo permitido do campo `interesse`, sem nova tabela, sem duplicar origens e sem vincular automaticamente o contato a uma conta/parceiro. Atualizar validação server-side e rótulos/tipos da view Admin. Preservar `atendimento`, `home_equity` e `construcao`.
9. **Financiamento Imobiliário.** A landing o apresenta como produto, mas não foi localizada uma rota pública dedicada ou simulador documentado para ele. A resposta deve limitar-se à descrição pública aprovada e oferecer contato; não inventar um fluxo digital inexistente.
10. **Acessibilidade.** Botões nativos e navegáveis por teclado, foco visível, anúncios de resposta sem narrar caractere a caractere, sem depender de cor e respeitando `prefers-reduced-motion`. Todos os botões novos mantêm `btn-no-liquid`.

## Fluxo proposto

1. Ao abrir, a MERX cumprimenta, identifica-se como assistente virtual da Mercúrio Capital, apresenta em uma frase o workspace para parceiros e informa que também orienta clientes sobre crédito. Mostra opções “Sou originador/parceiro” e “Busco crédito”, além do campo livre já existente.
2. Pergunta “Como prefere que eu te chame?”; com a resposta, usa o primeiro nome apenas durante a sessão da conversa. Não repetir nem armazenar a mensagem além do estado volátil atual.
3. Se for originador: explica a função pública do workspace; sugere cadastro `/p/registro`; oferece FAQ sobre originação e a opção independente de solicitar contato, registrando `interesse = parceiro_originador` se o formulário for enviado.
4. Se busca crédito: oferece escolhas de produto; responde com texto aprovado e links pertinentes; para simulação, direciona a `/simulador`; para construção, direciona a `/credito-para-construcao`; oferece solicitar contato com o interesse selecionado.
5. Pergunta livre sem resposta correspondente: usa fallback claro e oferece escolher uma trilha ou falar com a equipe. Não inventa nem tenta preencher lacunas com conhecimento geral.
6. O formulário existente conserva nome completo, cidade, e-mail, telefone obrigatório, consentimento, reCAPTCHA, rate limit e idempotência. Reutiliza o nome lembrado apenas como valor inicial editável; o consentimento continua desmarcado.

## Modelo de dados / relacionamentos

- Registro principal continua sendo `merx_leads_publicos` (UUID, dados de contato, interesse, página de origem, consentimento e idempotência); não será criada tabela de sessão/conversa.
- O valor `interesse` passa a aceitar também `parceiro_originador` e `financiamento_imobiliario`. “Ainda estou avaliando” usa `atendimento`, preservando o catálogo menor e a compatibilidade com os tipos existentes. O mesmo catálogo foi aplicado na Edge e na constraint SQL.
- `v_admin_leads_publicos` continua unindo origens sem duplicação. A origem técnica continua `merx`; o interesse identifica a intenção de parceria/produto. O status comercial continua `novo`, `em_contato` ou `qualificado` e só muda por ação administrativa auditada.
- Nenhum usuário/parceiro é criado pela captação. A rota de cadastro permanece fluxo separado, com suas próprias validações e aprovação administrativa.

## Arquivos esperados

- `app/src/components/merx/MerxPublicChat.tsx`: máquina de estados curta, botões de intenção/produto, pergunta do nome, texto contextual, CTA de contato e reinício seguro.
- `app/src/lib/merxPublica.ts`: modelos de fluxo e FAQ curada, busca determinística e links de rota permitidos; sem conteúdo confidencial.
- `app/src/components/admin/MerxPublicaTab.tsx`: se necessário, edição/revisão de intents e respostas no painel existente; sem criar nova rota.
- `supabase/functions/public-merx-lead/index.ts`: aceitar e validar o novo interesse de originador e interesses de cliente confirmados.
- Nova migration aditiva de catálogo/constraint, somente se a constraint do banco exigir; não editar migration já existente. Manter a view administrativa e RLS atuais.
- `app/src/pages/admin/LeadsSimulacoes.tsx` e `app/src/lib/simulacaoLeadPresentation.ts`: apresentar rótulo claro “Potencial parceiro originador” sem misturar com simulações financeiras.
- Testes de fluxo e validação em `app/src/test/merxPublicChat.test.tsx`, funções de FAQ e Admin; smoke SQL/RLS se houver migration.
- Atualizar documentação operacional e índice `docs/README.md` após implementação.

## Critérios de aceite

1. Abrir o chat mostra saudação útil, apresentação curta da Mercúrio/área de trabalho e dois caminhos explícitos, sem bloquear o visitante.
2. A pergunta do nome é clara; a personalização usa somente a sessão ativa e o nome não vai à rede até o formulário de contato ser enviado com consentimento.
3. A trilha de originador explica a proposta de valor apenas com fatos documentados, oferece `/p/registro` e captação opcional; a trilha de cliente oferece produtos e links reais, com formulário associado ao interesse correto.
4. FAQ continua determinística e configurável pelo Admin. Cada resposta publicada tem fonte aprovada; pergunta fora do conteúdo recebe fallback honesto e não resposta fabricada.
5. Formulário mantém nome, cidade, e-mail validado, telefone obrigatório, consentimento, reCAPTCHA, rate limit e idempotência atuais. Duplo clique/retry não cria lead duplicado.
6. Lead `parceiro_originador` aparece na gestão Admin com rótulo próprio e estado comercial padrão `novo`, sem valor de crédito, produto simulado, CEP/UF ou proposta inferidos.
7. Cadastro de parceiro não é criado automaticamente; papéis, aprovação, guards e RLS não são alterados.
8. Fluxo é operável por teclado, leitor de tela e viewport mobile; reduced motion mantém respostas instantâneas.

## Segurança e validações previstas

- Conteúdo de resposta é texto curado e escapado; links vêm de allowlist de rotas públicas. Sem HTML arbitrário ou URLs editáveis livres.
- Sem consulta a arquivos privados no cliente, embeddings, modelo generativo, WhatsApp ou Serasa. A captura mantém Edge Function/server-side, service role privada, consentimento, reCAPTCHA v3, honeypot, rate limit e idempotência.
- Não aceitar identidade/role informada pelo navegador e não transformar uma captação pública em acesso ao workspace.
- Testes: fluxo inicial e botões; perguntas de ambas as trilhas; fallback fora do FAQ; captação opcional; nome prefill/editável; consentimento e campos inválidos; retry/duplo envio; interesses e rótulos no Admin; regressão de FAQ e recursos atuais.
- Executar lint, typecheck, build, suíte completa e `git diff --check`. Se houver migration, preparar teste SQL com rollback e auditar privileges/RLS; não aplicar em banco remoto.
- Validação de browser desktop/mobile com chat habilitado em configuração local, teclado, erro, sucesso, foco, zoom e reduced motion. Distinguir claramente essa prova local de produção.

## Fora de escopo / gates

- Não ativar IA generativa nem ligar automaticamente o chat a documentos internos ou consultas Serasa.
- Não criar leads como propostas, não enviar e-mail/WhatsApp automático e não automatizar onboarding/aprovação do parceiro.
- Este plano não autoriza execução de migration remota, publicação de Edge Function, ativação de configuração em produção, Vercel deploy ou envio externo. Cada operação requer autorização própria.

## Ponto técnico conhecido

O histórico local mostra duas migrations com o timestamp `20261029000001` (`merx_publica` e `serasa_pf_relatorio_detalhado`). Esta implementação não deve aplicar ou reordenar migrations antigas. Antes de uma publicação futura, reconcile a sequência e o histórico remoto; prefira uma migration nova com timestamp único.

## Implementação local concluída

- O chat abre com apresentação e saudação, pergunta o nome e deixa continuar sem informar. O nome e as mensagens ficam em estado volátil; fechar pelo botão ou Escape limpa a sessão.
- As duas trilhas funcionam: originador/parceiro oferece `/p/registro` e contato opcional; cliente escolhe Home Equity, Construção, Financiamento Imobiliário ou atendimento geral e recebe links públicos existentes.
- O formulário reaproveitado mantém nome editável, cidade, e-mail validado, telefone obrigatório, consentimento explícito, reCAPTCHA v3, idempotência e proteções server-side existentes.
- A classificação `parceiro_originador` é mostrada no painel administrativo e pesquisável sem gerar métricas ou valores de crédito fictícios.
- Documentação operacional criada em `docs/operacao/merx-publica-atendimento.md` e adicionada ao índice `docs/README.md`.
- Migration aditiva criada em `supabase/migrations/20261030000003_merx_intent_catalog.sql`, com smoke SQL sintético em `supabase/smoke-tests/fase-52-merx-interest-catalog.sql`. Ambos permanecem locais.

## Resultado de validação

- `npm run lint`: passou, 0 erros e 33 avisos preexistentes fora desta alteração.
- `npm run typecheck`: passou.
- `npm run build`: passou; Vite reportou aviso preexistente de chunks maiores que 500 kB.
- Suíte completa: 194 testes passaram em 48 arquivos com `npm test -- --run --testTimeout=15000`. O timeout maior foi aplicado apenas à execução, sem mudar a configuração do projeto.
- Validação visual/manual em navegador não foi concluída nesta execução.
- Nenhuma migration foi aplicada remotamente, nenhuma Edge Function foi publicada e nenhum deploy foi realizado.
