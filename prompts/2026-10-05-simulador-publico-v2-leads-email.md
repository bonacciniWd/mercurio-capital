# Plano — Simulador público v2: leads internos e e-mail de resultado

## Objetivo

Evoluir o simulador público `/simulador` e o bloco equivalente da landing para:

1. registrar cada simulação enviada como lead, preservando os dados necessários para atendimento;
2. entregar esses leads somente à equipe interna da Mercúrio (`role = admin`), sem exposição a `partner`, `team_member` ou `client`;
3. enviar ao prospect um e-mail com o resultado da simulação, no padrão visual e textual da referência fornecida;
4. enviar à equipe interna uma notificação com o resumo do novo lead;
5. manter a infraestrutura existente de templates, `email_outbox` e `email-dispatcher`.

A entrega inicial será implementada e validada localmente. Aplicação de migration remota, deploy da Edge Function e publicação continuam sujeitos a um GO separado.

## Skills e documentação lidas

- `AGENTS.md` e regras de desenvolvimento/testes do projeto.
- `docs/operacao/simulador-publico.md`.
- `docs/operacao/integracoes-pendentes.md`.
- `docs/operacao/security-checklist.md`.
- `docs/blueprint/02-roles-permissions.md`.
- `docs/blueprint/03-routes-navigation.md`.
- `docs/blueprint/07-integrations-flows.md`.
- `docs/blueprint/08-security-compliance.md`.
- `prompts/2026-10-05-simulador-publico-landing.md`.
- Contratos existentes de `email_outbox`, `templates_mensagem`, `render_template`, `public_app_base_url` e `email-dispatcher`.

Não há skill adicional necessária para esta alteração; a implementação seguirá React/TypeScript, Supabase SQL e Edge Functions já adotados no repositório.

## Código e contratos inspecionados

- `app/src/components/PublicSimulator.tsx` e `app/src/pages/public/Simulador.tsx`.
- `app/src/router.tsx`, `app/src/guards/RequireRole.tsx`, `app/src/guards/RequireAdminScope.tsx` e `app/src/lib/adminScope.ts`.
- `supabase/migrations/20260513000003_originacao.sql`.
- `supabase/migrations/20260925000002_lead_classificacao_distribuicao.sql`.
- `supabase/migrations/20260520000020_fluxos_campanhas_fase12.sql`.
- `supabase/migrations/20260717000001_canonical_links_proposal_emails.sql`.
- `supabase/migrations/20260717000002_admin_email_template_management.sql`.
- `supabase/functions/email-dispatcher/index.ts` e padrões de funções públicas com CORS/rate limit.

## Decisões e suposições da v2

### Registro separado de leads públicos

Será criada a tabela `public.simulacao_leads_publicos`, separada de `public.simulacoes`. A tabela atual exige `partner_id` e possui regras voltadas a parceiros/equipes; reutilizá-la para uma entrada anônima mudaria um contrato existente e poderia misturar origem pública com simulações de parceiros.

Cada envio cria um novo registro, inclusive quando o mesmo e-mail simula novamente. Não haverá deduplicação silenciosa nesta primeira versão.

Campos previstos:

- identidade e contato: `id`, `created_at`, `updated_at`, `nome_completo`, `email`, `telefone`, `consentimento_em`;
- valores calculados: `valor_imovel`, `valor_credito`, `prazo_meses`, `taxa_juros_mensal`, `parcela_estimada`, `ltv`;
- imóvel: `tipo_imovel`, `situacao_imovel`, `cep`;
- perfil: `renda_mensal`, `objetivo_credito`, `tipo_renda`, `prazo_contratacao`, `origem`;
- operação: `status_email_prospect`, `status_email_interno`, `metadata` limitada a contexto técnico não sensível e `updated_at`.

O status de atendimento/classificação comercial não será inventado nesta v2. O registro começa como lead recebido e a tela interna será de consulta/triagem; classificação, distribuição automática e conversão para proposta permanecem nos fluxos já documentados e serão ligados depois que a política de negócio for aprovada.

### Endpoint seguro

O componente React chamará uma Edge Function pública `public-simulacao-lead`. A função:

- valida método, formato, faixas numéricas, e-mail, telefone, CEP, consentimento e campos permitidos;
- rejeita payload com honeypot preenchido;
- aplica rate limit server-side por e-mail e origem de rede usando os helpers já existentes;
- insere via cliente de serviço/RPC protegido, nunca pelo navegador;
- gera o resultado no servidor a partir dos valores validados, sem confiar em parcela/ltv enviados pelo cliente;
- enfileira os dois e-mails e retorna apenas confirmação e identificador público mínimo.

O browser não receberá `SERVICE_ROLE_KEY`, segredo de Resend, dados de outros leads ou detalhes internos da fila.

### E-mails

Serão adicionados dois templates de e-mail gerenciados pelo banco:

- `simulacao_publica_resultado_v1`: confirmação para o prospect, com valor solicitado, parcela, prazo, taxa, disclaimer de simulação e CTA configurável;
- `simulacao_publica_novo_lead_interno_v1`: aviso para os endereços de usuários internos ativos com `role = admin`, contendo resumo do lead e link para a tela interna.

Os corpos serão HTML com estilos inline e cabeçalho textual, usando a identidade da Mercúrio. O template pode receber uma imagem pública depois, sem depender dela para leitura. O CTA externo usa uma URL configurada; nenhum telefone será inventado.

Os itens serão gravados em `email_outbox` com `origem = 'simulacao_publica'`, `referencia_id = lead.id` e metadados de evento/recipiente. O dispatcher existente continuará responsável pelo envio via Resend.

### Área interna

Será criada a rota protegida `/admin/leads/simulacoes` e a página `LeadsSimulacoes` com:

- listagem paginada/ordenada por data;
- filtros por período e status de envio;
- busca por nome, e-mail e telefone;
- resumo dos valores calculados e origem;
- indicação do estado dos e-mails e possibilidade de abrir o detalhe do lead.

A leitura será permitida por `RequireRole(['admin'])` e RLS `public.app_is_admin()`. A rota será incluída no escopo dos admins limitados/jurídicos como leitura; não haverá rota equivalente em `/p` ou `/c`. Mutação de lead, reenvio manual e classificação ficam fora desta entrega para evitar uma política não aprovada.

## Arquivos esperados

- `supabase/migrations/20261005000003_simulacao_leads_publicos.sql` — tabela, índices, RLS, função segura de ingestão, templates e enqueue.
- `supabase/functions/public-simulacao-lead/index.ts` — endpoint público com CORS, validação e rate limit.
- `supabase/functions/_shared/...` — somente se um helper existente precisar ser reutilizado sem duplicação.
- `app/src/components/PublicSimulator.tsx` — submissão server-side, estados de envio/erro e confirmação.
- `app/src/pages/admin/LeadsSimulacoes.tsx` — leitura interna.
- `app/src/router.tsx` — rota admin lazy-loaded.
- `app/src/lib/adminScope.ts` — allowlist do novo caminho para admins de escopo reduzido.
- `docs/operacao/simulador-publico.md` — escopo v2, privacidade, operação de e-mail e rollback.
- `docs/blueprint/02-roles-permissions.md` e `docs/blueprint/03-routes-navigation.md` — permissões e rota.
- `supabase/smoke-tests/fase-38-simulador-publico-leads.sql` — verificações de schema, RLS, templates e idempotência mínima.
- testes React/TypeScript focados para submissão, sucesso, erro de endpoint e bloqueio sem consentimento.

## Critérios de aceite

- Uma simulação válida cria um registro persistido e mostra confirmação sem duplicar a simulação no refresh.
- Payload inválido, consentimento ausente, honeypot preenchido e excesso de tentativas são rejeitados sem gravação.
- Nenhuma chave privada ou chamada direta ao Resend aparece no bundle do navegador.
- O prospect recebe um e-mail com os valores do resultado e disclaimer; a falha do dispatcher não apaga o lead.
- Usuários `admin` conseguem consultar os leads; `partner`, `team_member` e `client` não conseguem consultar a tabela, a view ou a rota.
- A equipe interna recebe o aviso enfileirado sem revelar dados para destinatários externos.
- A tela interna mostra estado vazio, carregamento, erro, filtros e dados reais de teste sem expor o payload bruto de metadados.
- O fluxo v1 continua funcional quando a função pública ou o e-mail estiver temporariamente indisponível: o usuário recebe mensagem clara de falha e pode tentar novamente, sem estado parcial visível.

## Segurança, privacidade e operação

- Dados pessoais ficam protegidos por RLS e não entram em logs de aplicação em claro.
- E-mail e telefone serão mascarados em auditoria/erros; o conteúdo completo fica apenas na tabela protegida e no e-mail destinado ao próprio prospect/equipe autorizada.
- A função limitará tamanho de corpo e número de tentativas. O rate limit não dependerá apenas do cliente.
- O consentimento será registrado com data e versão do texto exibido.
- Nenhuma consulta Bacen/Serasa será disparada nesta v2; as credenciais e integrações continuam fora do fluxo público até haver contrato e autorização próprios.
- A tabela terá índices por `created_at`, `email` e status de e-mail para manter a listagem interna rápida.

## Testes previstos

### Automáticos

- testes da função/validação para payload válido, limites, consentimento, honeypot, rate limit e falha de fila;
- teste React do envio, loading, sucesso, erro recuperável e bloqueio sem consentimento;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- smoke SQL da migration, RLS, templates e existência de ambos os eventos no `email_outbox`.

### Manuais

- fluxo completo em desktop e mobile na landing e em `/simulador`;
- estado de rede lenta/erro da Edge Function;
- acesso à área interna com admin e tentativa de acesso com partner/client;
- conferência de conteúdo do e-mail do prospect e do e-mail interno na fila/caixa de teste;
- estado vazio, filtro por período, busca e visualização de um lead;
- refresh após confirmação para garantir que não há novo envio automático.

## Rollback

Antes da ativação remota, o rollback local consiste em retirar a chamada de envio e a rota/tela novas; a v1 continua utilizável. Se a migration for aplicada remotamente, a reversão deverá ser uma migration explícita que desative a função e remova a rota após a drenagem da fila, preservando os registros para auditoria até aprovação de retenção. Não haverá `DROP TABLE` automático em produção.

## Gate de aprovação

Após a aprovação deste plano, implementarei apenas a alteração local e executarei as verificações acima. A aplicação da migration em Supabase, publicação da Edge Function, configuração de secrets/templates e deploy em Vercel/Electron exigirão autorização explícita separada.

## Estado da execução local

Implementado localmente:

- migration `20261005000003_simulacao_leads_publicos.sql`;
- Edge Function `public-simulacao-lead` com validação, honeypot, idempotência e rate limit;
- envio para `email_outbox` do prospect e dos admins ativos;
- rota e tela interna `/admin/leads/simulacoes`, protegida por `role = admin` e RLS;
- integração do componente público e testes de regressão.

Validações executadas:

- `npm test -- --run` — 22 arquivos e 77 testes aprovados;
- `npm run typecheck` — aprovado;
- `npm run lint` — 0 erros e 38 avisos preexistentes;
- `npm run build` — aprovado, com o aviso preexistente de chunks grandes;
- validação manual do fluxo público até o erro recuperável quando a função local não está disponível.

Pendente para ativação: executar a migration e a Edge Function em um Supabase de teste, validar o envio real via `email_outbox`/Resend e fazer a validação autenticada da tela interna. O Docker local do Supabase não está disponível nesta máquina.

## Retomada em 2026-10-05

- A implementação local continua presente; a ativação remota e o deploy web desta retomada foram concluídos.
- Revalidação executada: `npm test -- --run` — 22 arquivos e 77 testes aprovados; `npm run typecheck` — aprovado; `npm run build` — aprovado; `npm run lint` — 0 erros e 38 avisos preexistentes.
- `supabase migration list --linked` confirmou `20261005000003` aplicada no remoto; as migrations anteriores continuam sincronizadas.
- `supabase functions list --project-ref bhagksfvszeogtjvjtpx` confirmou `public-simulacao-lead` ativa com `verify_jwt=false`. Os secrets necessários para a infraestrutura existente, incluindo Resend, estão cadastrados; seus valores não foram expostos.
- O frontend foi publicado na Vercel em 2026-10-07 com deployment READY e alias de produção `https://www.mercuriocapitalsa.com.br`.
- O próximo ciclo fica reservado para ajustes adicionais do sistema e sua validação visual. Os builds Electron/notarização de Windows, Linux e macOS não foram executados nesta etapa.

## Ativação remota em 2026-10-05 e deploy web em 2026-10-07

- Migration `20261005000003_simulacao_leads_publicos` aplicada no projeto Supabase `mercurio`.
- Edge Function `public-simulacao-lead` publicada e ativa com `verify_jwt=false`.
- Lead sintético criado para `contato@visionerifatta.space`, com chave de idempotência única; a captura retornou `created=true`, LTV `0,4118` e parcela estimada de `R$ 4.733,37`.
- Foram criados nove itens em `email_outbox`: um para o prospect e oito para administradores internos ativos. Todos terminaram com status `enviado` e sem erro.
- Acesso autenticado validado diretamente no banco: admin conseguiu ler a view de leads; `anon` recebeu bloqueio de privilégio/RLS.
- O teste deixou o lead identificado como `Teste Simulador v2` disponível na tela interna para conferência. Nenhuma limpeza automática foi executada.
- Deploy web publicado pelo Vercel CLI (`dpl_6Rsj6LSgtjg1vJhGtauQdpQQRKHN`); `https://www.mercuriocapitalsa.com.br/simulador` retornou o HTML do bundle publicado.
