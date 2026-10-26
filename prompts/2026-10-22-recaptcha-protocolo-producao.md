# reCAPTCHA na consulta pública de protocolo

## Objetivo
Concluir a integração existente de reCAPTCHA v2 checkbox em /protocolo, com validação obrigatória no servidor e configuração consistente para produção.

## Documentos e skills
Lidos docs/README.md, docs/operacao/change-management.md; código e configuração locais abaixo. Nenhuma skill especializada aplicável. Referência oficial: https://developers.google.com/recaptcha/docs/verify e https://vercel.com/docs/environment-variables/managing-environment-variables.

## Código inspecionado e diagnóstico
- app/src/pages/public/Protocolo.tsx: widget Google; RPC direta; aceita fallback VITE_HCAPTCHA_SITEKEY; token não é resetado após consumo.
- supabase/migrations/20260518000005_consulta_protocolo.sql: placeholder não valida token; anon/authenticated executam diretamente a RPC; resposta deve ser preservada.
- supabase/functions/public-cpc-lead/index.ts e _shared/cors.ts: padrões existentes de Edge Function pública e rate limiting.
- supabase/config.toml, app/src/lib/supabase.ts, app/package.json.
- Inventário remoto anterior: Vercel possui HCAPTCHA_SITEKEY sem prefixo VITE; última publicação antecede rotação. Secrets de Edge não incluem segredo reCAPTCHA. Configuração de CAPTCHA do Supabase Auth é distinta e não foi auditada; não será alterada neste escopo.

## Decisões e suposições propostas
- Manter React/Vite, Supabase e widget v2 atual; sem dependências novas. As chaves precisam corresponder a reCAPTCHA v2 checkbox; v3/Enterprise exigem revisão antes de implementar.
- Front usa exclusivamente VITE_RECAPTCHA_SITEKEY. Secret fica exclusivamente em RECAPTCHA_SECRET_KEY na Edge; RECAPTCHA_ALLOWED_HOSTNAMES define hosts aceitos, inicialmente mercuriocapitalsa.com.br e www.mercuriocapitalsa.com.br. Desenvolvimento exige chave/hosts próprios, sem bypass automático.
- Nova Edge pública public-consulta-protocolo recebe codigo/captcha_token, valida formato/tamanho, limita tentativas, verifica Google via POST form-urlencoded com timeout e exige success e hostname permitido antes de consultar banco. Ausência de configuração ou falha externa bloqueia consulta com mensagem recuperável.
- Migration nova revoga execução direta da RPC para PUBLIC/anon/authenticated e concede somente a service_role. Manter assinatura e JSON existentes, sem ampliar dados retornados. Conferir ACL efetiva e demais chamadores antes de aplicar.
- A Edge reutiliza mecanismos existentes de limitação por IP confiável da plataforma, sem aceitar IP no corpo. Evitar agrupar todos os usuários pelo IP da Edge; revisar contador legado ao mover a chamada para service_role. Registrar apenas metadados operacionais necessários, nunca tokens, secrets ou conteúdo de proposta.
- Front chama Edge, impede envio sem chave/token, reseta widget/token após tentativa e trata expiração, indisponibilidade, limite e protocolo inexistente; links com código preenchido aguardam verificação humana.

## Modelo de dados
Nenhuma nova entidade, tabela ou coluna. Propostas, pendências e histórico permanecem inalterados. rate_limits existente registra contadores temporários; função SQL passa a ser acessível somente pelo serviço. Não alterar contas, equipes, RLS geral, Serasa, login ou cadastro.

## Arquivos esperados
- app/src/pages/public/Protocolo.tsx e testes de UI relacionados.
- supabase/functions/public-consulta-protocolo/index.ts; módulo testável de verificação e testes conforme ferramentas existentes.
- supabase/config.toml; migration nova para ACL/ajuste restrito de rate limiting quando necessário; smoke SQL correspondente.
- documentação operacional de configuração, rollout e evidências.

## Critérios de aceite e segurança
Token ausente, inválido, expirado/reutilizado ou de hostname divergente nunca retorna dados. RPC direta pública bloqueada. Falha Google/configuração não libera consulta. Segredo não aparece no cliente/bundle/logs. Widget válido mantém a resposta atual. CORS não substitui CAPTCHA nem autorização. Não usar chave de teste como configuração de produção.

## Verificações
- lint, typecheck, build do app; testes unitários frontend/backend para sucesso, rejeição, hostname, timeout, payload inválido e reset/expiração.
- Smoke SQL local: service_role pode consultar; anon/authenticated não podem; preservar formato e limites.
- Navegador: desktop/mobile, widget, chave ausente, token expirado, erro recuperável, protocolo sintético inexistente. Desafio Google exige interação humana; não simular aprovação em produção.
- Após publicação autorizada: conferir bundle/configuração efetivos e domínio autorizado no Google; testar token real com ajuda do usuário, além de requisições ausentes/inválidas e RPC direta. Não consultar proposta real sem necessidade.

## Rollout / rollback
Aprovação deste plano libera implementação e verificações locais. Não libera migration remota, alteração de secrets/env ou deploy. Após evidências locais, pedir GO coordenado de backend e frontend; não publicar todo o checkout sujo. Ordem operacional: configurar env/secret corretos; publicar Edge; publicar frontend preparado; restringir RPC no mesmo período de manutenção e verificar ambos. Janela anterior à restrição permanece explicitamente sem proteção completa. Se falhar, bloquear consulta pública; não reabrir RPC sem CAPTCHA como rollback. Não remover variáveis legadas usadas por outro fluxo sem inventário.

## Impacto
Web e consulta pública: afetados. Banco: ACL/RPC e contadores existentes. Edge: nova função. Mobile/Electron: verificar se empacotam /protocolo e documentar necessidade de atualização; demais fluxos não afetados. Publicação e credenciais: etapa separada.

## Execução local — 22/10/2026
Implementados handler Edge testável, migração forward-only de ACL e limitador atômico por hash de IP, atualização do frontend com reset e erros recuperáveis, smoke SQL e runbook docs/operacao/recaptcha-protocolo.md. Nenhuma configuração remota ou publicação executada.
Validação: 13 testes passaram (11 handler e 2 interface); typecheck e build passaram; lint terminou com zero erros e 38 avisos existentes. git diff --check passou. SQL não executado: Docker local indisponível e sem psql instalado. Credenciais reais e desafio humano em produção ainda pendentes, assim como verificação do gateway/IP e smoke SQL antes da liberação.

### Smoke SQL retomado com Docker ativo — 22/10/2026
Banco confirmado: container supabase_db_MercurioCapital, PostgreSQL 17.6, tabelas propostas/rate_limits existentes. Migration candidata executada dentro de transação junto ao smoke, com ON_ERROR_STOP e ROLLBACK final. Passaram: ACL anon/authenticated bloqueada; service_role autorizado; cinco tentativas permitidas e sexta rejeitada; consulta sintética inexistente preserva JSON. Segunda transação confirmou negação real de execução com SET LOCAL ROLE anon e authenticated para ambas RPCs e rejeição de chave inválida para service_role. Ambas finalizaram em ROLLBACK; ausência da nova função após rollback confirmada. Nenhum container de outro projeto, dado de produção ou migration remota alterado. Validação real de Google/hosts/gateway permanece dependente de publicação coordenada e credenciais.
