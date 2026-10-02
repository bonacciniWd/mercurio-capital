# Plano — Credenciais Serasa `LOGON` e `SENHA`

## Objetivo
Aceitar os nomes de credenciais fornecidos pelo Serasa sem expor valores no frontend, no repositório ou no chat.

## Código/documentos consultados
- `supabase/functions/consulta-executar/index.ts`
- `docs/operacao/integracoes-pendentes.md`
- documentação do fluxo OAuth do Serasa já registrada no projeto

## Decisões
- `SERASA_LOGON` será tratado como alias server-side de `SERASA_CLIENT_ID`.
- `SERASA_SENHA` será tratado como alias server-side de `SERASA_CLIENT_SECRET`.
- Se ambos os padrões existirem, `SERASA_CLIENT_ID`/`SERASA_CLIENT_SECRET` têm prioridade.
- `SERASA_API_URL` continuará obrigatório para separar UAT de produção.
- Nenhum valor será adicionado a `app/.env`, `mobile/.env`, Git ou logs.

## Critérios de aceite
- A Edge Function reconhece os dois nomes de credencial.
- Sem URL ou credenciais, a consulta permanece como não configurada e não usa mock em produção.
- O procedimento documenta cadastro via `supabase secrets set` usando entrada silenciosa.
- O primeiro teste é feito em UAT; produção só será configurada após homologação.
