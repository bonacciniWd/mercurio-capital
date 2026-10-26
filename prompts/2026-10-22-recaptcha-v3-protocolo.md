# Adaptar a consulta de protocolo ao reCAPTCHA v3

## Objetivo
Corrigir erro `tipo de chave inválido` no reCAPTCHA de `/protocolo`, mantendo a validação obrigatória no servidor e usando o tipo v3 que o proprietário confirmou estar configurado no Google.

## Documentos lidos
- `docs/operacao/change-management.md` e `docs/operacao/recaptcha-protocolo.md`.
- Documentação Google: https://developers.google.com/recaptcha/docs/versions/ e https://developers.google.com/recaptcha/docs/v3.

## Código inspecionado
- `app/src/pages/public/Protocolo.tsx`: atualmente monta checkbox `react-google-recaptcha` v2.
- `app/src/lib/publicProtocolHandler.ts`: verifica `success` e hostname, mas não valida `action` nem score v3.
- `supabase/functions/public-consulta-protocolo/index.ts`: fornece secret/hosts e RPC ao handler.
- `app/src/test/protocoloCaptcha.test.ts`, `app/src/test/protocoloCaptchaUI.test.tsx` e `docs/operacao/recaptcha-protocolo.md`.

## Decisões propostas
- Usar a API JavaScript v3 via script oficial Google, carregada uma vez com a site key pública; executar ação estável `consulta_protocolo` somente quando o usuário enviar o formulário.
- Remover o checkbox v2. Exibir mensagem de verificação automática; criar token novo por consulta e manter bloqueio quando script/configuração falhar.
- No servidor exigir `success`, hostname permitido, `action === consulta_protocolo` e score mínimo configurável no Edge secret `RECAPTCHA_MIN_SCORE`, com faixa válida 0–1 e default conservador 0.5. Config ausente/inválida deve falhar fechado. Não registrar token.
- Manter rate limiting, timeout Google, ACL da RPC e payload da consulta. Sem nova migration/tabela.
- A chave pública Vercel e o secret Supabase precisam ser o par v3 correspondente. Configuração manual permanece no painel; nenhuma credencial será exibida.

## Arquivos esperados
- `app/src/pages/public/Protocolo.tsx` e eventual helper v3 em `app/src/lib/`.
- `app/src/lib/publicProtocolHandler.ts` e testes de handler/UI.
- `docs/operacao/recaptcha-protocolo.md` e este plano com resultado.
- Não editar migration/ACL nem os fluxos de autenticação do Supabase.

## Critérios de aceite
- Widget não exibe erro de tipo; token v3 criado no submit com ação correta.
- Backend rejeita token inválido/expirado/reutilizado, hostname/ação errada, score abaixo do limite, serviço indisponível ou configuração ausente.
- Token válido com score suficiente mantém o contrato JSON atual e segue rate limit.
- Nenhum secret ou token no cliente/logs; segredo somente em Supabase.

## Testes
- Testes handler: casos v3 de ação/score, validade, hostname, timeout, limite e configuração.
- Testes UI: carregamento do script, execute no submit, bloqueio sem script/token, erro recuperável, não execução automática em carregamento da rota.
- `npm run lint`, `npm run typecheck`, `npm run build`.
- Navegador local e smoke em produção com token humano depois de configuração v3 confirmada; não automatizar desafios.

## Publicação e segurança
A correção requer atualizar a Edge Function e o frontend de produção em coordenação; nenhuma migration. O secret v3 configurado no Supabase e site key v3 na Vercel devem ser correspondentes. Implementação local e publicação são etapas distintas. Não fazer deploy antes de verificar testes e configuração efetiva; não expor chaves durante diagnóstico.

## Execução aprovada
- Plano aprovado pelo usuário em 22/10/2026.
- Implementado carregamento v3 no formulário, ação `consulta_protocolo`, token gerado somente no submit e validação de `success`, hostname, action e score no Edge Function.
- `RECAPTCHA_MIN_SCORE` assume 0.5; configuração inválida falha fechado. Rate limit e RPC protegida foram preservados.
- Testes direcionados: 16 passaram. `npm run typecheck`, `npm run lint` e `npm run build` concluíram; lint reportou warnings preexistentes em outros arquivos, sem erros. Build mantém aviso de chunk acima de 500 kB.
- Publicado com GO do usuário: Edge Function `public-consulta-protocolo` versão 2 e frontend Vercel `mercurio-digital`, deployment `dpl_ufnwNCKGQdwHr4TjCJNWmkpph8fW`, aliases de produção ativos. Sem migration ou alteração de secrets.
- Smoke de produção: `/protocolo` HTTP 200; bundle contém loader/action v3 e site key configurada; token sintético inválido foi rejeitado com `captcha_invalid` pela Edge Function. Submissão por usuário humano continua necessária para confirmar resposta do Google e score real.
