# Plano — Integração Serasa Verify ID PF/PJ

## Objetivo

Substituir a chamada genérica atual da Serasa pela integração oficial do produto Verify ID, usando OAuth 2.0 com `clientId`/`clientSecret`, consultas PF e PJ e os pacotes `VERIFY` habilitados na conta.

## Documentação e contexto lidos

- `docs/README.md` e documentação operacional do projeto.
- `supabase/functions/consulta-executar/index.ts`.
- `app/src/components/PropostaConsultas.tsx`.
- Documentação Serasa Data Verification PF/PJ: https://developer.serasaexperian.com.br/api/data-verification-for-pf--pj
- Material de integração fornecido pelo usuário.

## Código inspecionado

- A Edge Function atualmente autentica em `/security/iam/v1/client-identities/connect/token`.
- A consulta atual usa `/queries/v1/pf/{documento}/data-return` e `/queries/v1/pj/{documento}/data-return`.
- O frontend já oferece os tipos `serasa_pf` e `serasa_pj` e chama a Edge Function com payload da proposta.
- O mock de Serasa está desativado por padrão.

## Decisões e suposições

- Usar o login OAuth documentado em `/security/iam/v1/client-identities/login` com Basic Auth `clientId:clientSecret`.
- Usar homologação ou produção conforme `SERASA_API_URL`, sem alterar o padrão seguro atual.
- Consultar PF em `/id-fraud/verify-id/v1/people` e PJ em `/id-fraud/verify-id/v1/business`.
- Enviar `scoreParameters: ["VERIFY"]` inicialmente.
- Reaproveitar o cache em memória do token até próximo da expiração, com margem de segurança.
- Retornar ao sistema apenas resumo normalizado e preservar o log/auditoria existente.
- Não transformar `verificationScore` em decisão automática de aprovação ou reprovação.

## Arquivos esperados

- `supabase/functions/consulta-executar/index.ts`: autenticação e chamadas PF/PJ.
- Possível ajuste em `app/src/components/PropostaConsultas.tsx`: exibição dos campos normalizados, se necessário.
- Possível teste/smoke test da Edge Function, sem credenciais reais versionadas.

## Critérios de aceite

- Sem credenciais, a função continua retornando `serasa_nao_configurado` e estornando a consulta.
- Com credenciais válidas de homologação, PF retorna `verificationScore`, `verificationRisk` e `validationGroups`.
- Com credenciais válidas de homologação, PJ retorna os mesmos campos para `/business`.
- CPF/CNPJ ausente ou inválido falha antes da chamada externa.
- Token não aparece em logs, respostas ao navegador ou arquivos versionados.
- Erros HTTP da Serasa são convertidos em erro controlado e mantêm o estorno.
- O mock continua desabilitado em produção.

## Segurança e LGPD

- `SERASA_CLIENT_ID`, `SERASA_CLIENT_SECRET` e `SERASA_API_URL` ficam somente nos secrets da Edge Function.
- Nenhuma credencial será enviada pelo chat, frontend, Electron ou Vercel.
- O LLM receberá somente dados normalizados, nunca o relatório bruto completo.
- A classificação operacional continuará sujeita a revisão humana e às regras de consentimento/auditoria.

## Testes

- Typecheck e build do frontend.
- Lint/testes disponíveis no projeto.
- Smoke test sem credenciais para confirmar `serasa_nao_configurado`.
- Teste autenticado de homologação com CPF/CNPJ fictício fornecido pela Serasa, após cadastramento dos secrets.
- Verificação dos casos de erro documentados, incluindo payload inválido e logon não autorizado.
