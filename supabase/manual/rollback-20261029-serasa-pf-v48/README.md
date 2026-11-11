# Rollback operacional — Serasa PF

Backup do código remoto `consulta-executar` v48, capturado antes da publicação v49 em 29/10/2026.

SHA-256:

- `consulta-executar.index.ts`: `02ed1c3fee9cccf59328a16319c2fede8ae34d989d4fae4753c7414f8f4d75aa`
- `serasa-reports.ts`: `3081a68bc62ecb5a426e541a76a34e5b5552da5b89de75597c7aa49e9f500aa7`
- `cors.ts`: `1f943fd079c9462a9d20f51df7ea71c6e54a53b115b27ce5f5b106af3e2aab7f`

Para restaurar a Edge Function v48, a partir da raiz do repositório:

```sh
cp supabase/manual/rollback-20261029-serasa-pf-v48/consulta-executar.index.ts supabase/functions/consulta-executar/index.ts
cp supabase/manual/rollback-20261029-serasa-pf-v48/serasa-reports.ts supabase/functions/_shared/serasa-reports.ts
cp supabase/manual/rollback-20261029-serasa-pf-v48/cors.ts supabase/functions/_shared/cors.ts
npx supabase functions deploy consulta-executar --project-ref bhagksfvszeogtjvjtpx --use-api
```

Para restaurar o frontend, retornar o deployment atual de produção no início deste rollout: `dpl_9PJQaHnv9BU5qTCdMYnCaf6EFzyN`.

Não remover a migration aditiva, relatórios, consultas ou eventos de auditoria no rollback.
