# reCAPTCHA — consulta de protocolo

## Configuração
Este fluxo usa reCAPTCHA v3 (score baseado em ação), não checkbox v2, hCaptcha ou Enterprise assessments.
- Vercel Production: `VITE_RECAPTCHA_SITEKEY` (site key pública).
- Supabase Edge secrets: `RECAPTCHA_SECRET_KEY` (segredo privado correspondente), `RECAPTCHA_ALLOWED_HOSTNAMES` (hosts separados por vírgula, sem esquema/caminho) e, opcionalmente, `RECAPTCHA_MIN_SCORE` (0–1; padrão 0.5).
- Hosts de produção: `mercuriocapitalsa.com.br,www.mercuriocapitalsa.com.br`, também autorizados no console Google. O host local precisa estar autorizado na chave de desenvolvimento.
- Desenvolvimento: usar configuração própria e hostname localhost autorizado; nunca bypass em produção.
- Variáveis de CAPTCHA no Supabase Auth são configuração separada; este fluxo não altera login/cadastro.

Não exportar segredos em conversa, terminal ou bundle. Fornecer secrets diretamente pelo dashboard Supabase ou arquivo temporário protegido fora do repositório; remover arquivo após configuração. Site key não substitui secret.

## Implementação
`public-consulta-protocolo` verifica token no Google com timeout de oito segundos, `success`, hostname permitido, `action=consulta_protocolo` e score mínimo. `RECAPTCHA_MIN_SCORE` é opcional, aceita 0–1 e assume `0.5`; valor inválido falha fechado. O frontend só executa a ação no envio do formulário e emite um token novo por tentativa. Não consulta proposta antes da validação. Limite atômico: cinco tentativas com token por IP em 60 segundos, independentemente do protocolo. O IP depende de x-forwarded-for entregue pelo gateway Supabase; confirmar a política do gateway no ambiente publicado. Falta de IP cai em grupo restritivo compartilhado, sem bypass. Token não é persistido. Google rejeita tokens vencidos/reutilizados. Resposta de sucesso não permite cache.
A RPC SQL conserva o JSON anterior, mas somente service_role pode executá-la. Nenhuma tabela nova.

## Publicação coordenada — requer GO separado
1. Confirmar que `VITE_RECAPTCHA_SITEKEY` na Vercel e `RECAPTCHA_SECRET_KEY` no Supabase pertencem ao mesmo projeto/chave v3; manter segredos fora de logs.
2. Confirmar `RECAPTCHA_ALLOWED_HOSTNAMES` com os domínios publicados e definir opcionalmente `RECAPTCHA_MIN_SCORE` (0–1; padrão 0.5).
3. Publicar Edge e frontend em coordenação, preservando mudanças locais não relacionadas. A migration `20261022000001` já está aplicada; não reaplicar nem reabrir grants públicos.
4. Conferir bundle servido, hostname e chamada sem erro de tipo. Com usuário humano, enviar protocolo sintético inexistente; resposta esperada `encontrado=false`. Cada nova tentativa gera token novo.
5. Confirmar rejeição de token inválido/ausente, ação/hostname incorretos e score abaixo do limite, além de chamada RPC direta por anon/authenticated. Não automatizar resolução do desafio Google.

Falha após restrição: manter consulta bloqueada e corrigir/publicar novamente. Não restaurar grants públicos como rollback.

## Verificação local
`cd app && npm run lint && npm run typecheck && npm run build`
`cd app && VITE_RECAPTCHA_SITEKEY=synthetic npm run test -- --run src/test/protocoloCaptcha.test.ts src/test/protocoloCaptchaUI.test.tsx`
SQL local após migration: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/smoke-tests/protocolo-recaptcha.sql` (transação com rollback).
Smoke SQL requer banco local disponível; não executar contra produção sem autorização. Testes de handler usam Google simulado e não provam validade das credenciais reais.

### Smoke local, antes da publicação — 22/10/2026
Smoke SQL executado com sucesso no container supabase_db_MercurioCapital (PostgreSQL 17.6), aplicando a migration candidata somente dentro da transação e revertendo ao final. Confirmados grants, rejeição real sob anon/authenticated, consulta service_role com JSON esperado, cinco chamadas permitidas/sexta bloqueada e chave inválida rejeitada. Ausência da função nova após rollback confirmou reversão. Naquele momento, publicação e teste Google real ainda estavam pendentes.

### Publicação v3 — 22/10/2026
Com GO do usuário, Edge Function `public-consulta-protocolo` publicada como versão 2 no projeto `bhagksfvszeogtjvjtpx`; frontend publicado no projeto Vercel `mercurio-digital`, deployment `dpl_ufnwNCKGQdwHr4TjCJNWmkpph8fW`, aliases de produção ativos. Nenhuma migration ou secret alterado; score usa padrão 0.5.
Verificações: `/protocolo` retornou HTTP 200; bundle servido contém loader da API v3, ação `consulta_protocolo` e a site key configurada (valor não registrado); Edge Function respondeu `captcha_invalid` a um token sintético inválido, antes de consultar protocolo. A submissão humana com a chave configurada ainda precisa confirmar o caminho de sucesso e score real.
