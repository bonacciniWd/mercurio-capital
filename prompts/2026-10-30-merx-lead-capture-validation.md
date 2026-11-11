# MERX — mensagem, validação de contato e captação de lead

Status: implementação local concluída e aprovada; publicação remota continua aguardando autorização específica.

## Objetivo

Concluir o fluxo público da MERX para que a mensagem do visitante tenha apresentação própria, a pessoa possa solicitar contato informando nome, cidade, e-mail e telefone, o formato do e-mail seja validado no navegador e novamente no servidor, e a solicitação chegue à gestão interna de leads.

## Contexto e constatações

- A inscrição de parceiro em `app/src/pages/public/Registro.tsx` valida e-mail com `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/`, normalizando para minúsculas. A validação está local ao componente, não é um helper reutilizável.
- `supabase/functions/public-merx-lead/index.ts` repete a expressão, valida consentimento, nome, telefone, rota e interesse, e grava com service role em `merx_leads_publicos`.
- O formulário atual da MERX pergunta nome, e-mail, telefone, interesse e consentimento; não pede cidade. A tabela não tem coluna de cidade.
- A função da MERX ainda não implementa honeypot, rate limit nem validação reCAPTCHA v3, apesar de esses controles constarem no plano anterior. A função também precisa confirmar o consentimento e a configuração ativa antes de gravar.
- A tabela `merx_leads_publicos` ainda não aparece em `app/src/pages/admin/LeadsSimulacoes.tsx` nem em uma view administrativa. Sem essa integração, persistir o contato não o torna visível no fluxo normal da equipe.
- A política pública descreve os dados de CPC, Home Equity e simuladores; não descreve a coleta de cidade pela MERX.
- A bolha do visitante já é alinhada à direita e vermelha em `app/src/index.css`; revisar e finalizar estilo, quebra de texto, foco e visual em desktop/mobile conforme os tokens existentes.

## Documentos e skill lidos

- `AGENTS.md` fornecido pelo dono do produto.
- `skills/UX_skills.md`.
- `docs/README.md`, `docs/operacao/politica-privacidade-publica.md`, `docs/operacao/leads-publicos-cpc.md`, `docs/blueprint/08-security-compliance.md`.
- `prompts/2026-10-29-merx-publica-faq-captacao.md`.

## Código/configuração inspecionados

- `app/src/pages/public/Registro.tsx`, `app/src/components/merx/MerxPublicChat.tsx`, `app/src/components/admin/MerxPublicaTab.tsx`, `app/src/lib/merxPublica.ts`, `app/src/index.css`.
- `app/src/pages/admin/LeadsSimulacoes.tsx`, `app/src/lib/recaptchaV3.ts`, `app/.env`.
- `supabase/functions/public-merx-lead/index.ts`, `public-cpc-lead/index.ts`, `public-simulacao-lead/index.ts`, `public-consulta-protocolo/index.ts`.
- `supabase/migrations/20261029000001_merx_publica.sql`, migration local de FAQ e as RPCs de rate limit já usadas por outros formulários públicos.

## Modelo e decisões propostas

- Acrescentar `cidade` à tabela `merx_leads_publicos`, texto curto e opcional para preservar qualquer registro já criado. A Edge Function exigirá cidade em novos envios e limitará o comprimento; não coletaremos UF, CEP ou endereço.
- Manter nome, e-mail, telefone, interesse e consentimento. Telefone obrigatório confirmado pelo dono do produto.
- Reutilizar um helper no app para normalizar e verificar o formato do e-mail no cadastro de parceiro e no formulário MERX. A Edge Function repetirá a regra e a tabela manterá sua restrição. Isso valida sintaxe; não confirma existência da caixa postal nem titularidade. Não enviar e-mail de confirmação nesta fase.
- Atualizar a política pública para explicar a coleta de cidade e a finalidade de retorno/atendimento.
- Exibir contatos MERX na lista administrativa `/admin/leads/simulacoes`, com origem identificada, cidade e status comercial existente. Não convertê-los em leads de simulação/CPC nem inferir valor, região, score ou status. Se a estrutura atual não aceitar a origem sem alterar contratos existentes, interromper e documentar a diferença antes de ampliar o modelo.
- Não persistir transcrição/perguntas livres nem enviar perguntas a LLM. Persistir apenas campos do formulário após consentimento explícito.

## Segurança

- Manter escrita somente pela Edge Function com service role; nunca expor chave privilegiada no browser. Respeitar `captacao_habilitada` e `habilitado` no servidor.
- Validar tamanho do body, nome, cidade, e-mail, telefone, interesse, rota permitida, UUID idempotente e consentimento. Validar honeypot e rate limit atômico por hash de e-mail e IP, seguindo o padrão CPC.
- Validar reCAPTCHA v3 no servidor com action própria, hostname, idade e score; usar `VITE_RECAPTCHA_SITEKEY` no cliente e `RECAPTCHA_SECRET_KEY` somente no servidor. Falhar fechado para captação se o token/configuração estiver ausente ou inválido; FAQ permanece disponível.
- Não registrar payload ou PII em logs. Manter RLS da tabela somente para Admin autorizado e não habilitar SELECT/INSERT anônimo.
- Criar migration aditiva para cidade e integração da view/consulta administrativa; preservar registros existentes e preparar reversão sem apagar leads.

## Arquivos alterados

- `app/src/lib/emailValidation.ts` e seu uso em `Registro.tsx` e MERX.
- `app/src/components/merx/MerxPublicChat.tsx`, `app/src/index.css`.
- `app/src/pages/admin/LeadsSimulacoes.tsx` e helpers/tipos usados por essa listagem.
- `app/src/pages/public/PoliticaPrivacidade.tsx` e `docs/operacao/politica-privacidade-publica.md`.
- `supabase/functions/public-merx-lead/index.ts`, `supabase/config.toml` e envio via `supabase.functions.invoke`, para incluir a chave pública do gateway.
- Migration `20261030000002_merx_lead_cidade_admin.sql` e smoke test `supabase/smoke-tests/fase-51-merx-lead-capture.sql`.
- Testes em `app/src/test/emailValidation.test.ts`, `app/src/test/merxPublicChat.test.tsx` e `app/src/test/adminLeadsSimulacoes.test.tsx`.
- Política pública atualizada em `app/src/pages/public/PoliticaPrivacidade.tsx` e `docs/operacao/politica-privacidade-publica.md`.

## Critérios de aceite e validação

1. A mensagem do visitante fica visualmente distinta, legível, alinhada e responsiva; texto longo não estoura o balão; foco de teclado continua visível.
2. E-mail válido (ex.: `pessoa@dominio.com`) passa; formatos inválidos são indicados junto ao campo antes do envio e recusados novamente pelo servidor. O campo aceita colagem e autocomplete apropriado.
3. Nome, cidade, e-mail, telefone conforme decisão, interesse e consentimento chegam ao servidor e aparecem na gestão administrativa como lead MERX após confirmação de sucesso. Falha não mostra sucesso.
4. Consentimento ausente, cidade/nome/telefone fora dos limites, email inválido, rota ou interesse adulterados, honeypot preenchido, token reCAPTCHA inválido/expirado e rate limit atingido não gravam lead.
5. Idempotência continua impedindo duplicação. Dados preexistentes permanecem consultáveis e sem cidade até eventual atualização manual.
6. RLS/ACL impede leitura pública e mantém acesso somente aos administradores autorizados.
7. Rodar testes direcionados da validação, chat, função Edge e SQL; `npm run lint`, `npm run typecheck` e `npm run build` em `app`; abrir preview local no navegador e conferir desktop/mobile, erro, sucesso e campos inválidos.

## Limites

- Não se comprovou entrega nem titularidade do e-mail; a validação é sintática e o consentimento cobre retorno sobre o assunto escolhido.
- O botão de envio fica bloqueado durante a requisição e a mesma chave idempotente é mantida após falha/rate limit para que uma repetição não crie um segundo registro. Uma nova solicitação iniciada pelo visitante recebe uma chave nova.
- O fluxo habilitado não foi validado visualmente no browser porque a configuração local mantém o chat/captação desativados; testes de componente cobrem validação, erro de rate limit, retry e sucesso.
- Não foram executadas migrations, publicação de Edge Function ou deploy. A duplicidade de timestamp local `20261029000001` precisa ser resolvida antes de aplicar migrations remotamente.

## Resultado e verificações

- Reutilizado o helper `emailValidation.ts` no cadastro de parceiro e no formulário MERX. Ele valida sintaxe, normalização e comprimento, não existência do endereço.
- O formulário MERX exige nome, cidade, e-mail, telefone, assunto e consentimento; as mensagens do visitante têm estilo próprio.
- O envio evita duplicatas rápidas e preserva a chave de idempotência para retry após erro; o botão mostra estado “Enviando…” e fica desabilitado enquanto aguarda resposta.
- O endpoint valida o tamanho do payload, campos, consentimento, rota, interesse, honeypot, reCAPTCHA v3 (action, hostname, score e idade), idempotência e rate limit atômico por hash de e-mail/IP. A escrita usa service role no servidor; leads só são lidos por admins via view com RLS.
- A lista de Admin inclui MERX, busca por cidade, status comercial e detalhe de cidade/interesse/consentimento, sem inventar UF nem valores financeiros.
- Testes direcionados: `npm run test -- --run src/test/emailValidation.test.ts src/test/merxPublicChat.test.tsx src/test/adminLeadsSimulacoes.test.tsx` — 29 passaram.
- Reteste do chat após adicionar retry/idempotência: `npm test -- --run src/test/merxPublicChat.test.tsx` — 7 passaram; a repetição após rate limit enviou a mesma chave idempotente.
- Suíte total: `npm test -- --maxWorkers=1` — 191 testes em 48 arquivos passaram. A suíte padrão paralela teve três timeouts em testes existentes sob disputa de CPU; o teste de amortização também passou isolado e a suíte serial passou completa.
- `npm run typecheck` passou; `npm run lint` passou com 33 warnings em arquivos fora do escopo; `git diff --check` passou após as alterações finais.
- `npm run build` passou com aviso existente de chunks acima de 500 kB.
- `supabase db lint --local --schema public` encontrou erros preexistentes em `consulta_iniciar` (coluna `preco_centavos` ambígua) e `admin_campanha_disparar` (`usuarios.partner_id` ausente), além de warnings. O banco local não inclui estas migrations pendentes, então o smoke test SQL não foi executado.
- Deno não está instalado, portanto a Edge Function não foi executada localmente.
- A rota pública foi aberta em `http://127.0.0.1:5173/`; o chat não estava ativo na configuração local. O fluxo habilitado foi coberto pelos testes de componente, mas não validado manualmente no browser.
- `supabase migration list --local` mostrou duas migrations locais com o timestamp duplicado `20261029000001` (`merx_publica` e `serasa_pf_relatorio_detalhado`). A ordem/histórico dessas migrations precisa ser reconciliada antes de qualquer aplicação remota; esta implementação não alterou esse histórico.

Migration remota, publicação da Edge Function, deploy Vercel, ativação em produção e envio de e-mails permanecem fora deste passo e exigem autorização própria. Testes usam fixtures sintéticas, sem leads reais.
