# Rollback operacional — prévia e backfill dos 138 protocolos

Preparado em 28/10/2026. Não executar como parte do deploy normal.

Deployment publicado nesta operação: `https://mercurio-digital-6no7vchk7-bonacciniwds-projects.vercel.app` (ID `dpl_FAGnmr6Td8hM1XktsLNn9n2Hy8M2`, `READY`, alias `https://www.mercuriocapitalsa.com.br`).

## Aplicação Vercel

Deployment de produção anterior à publicação: `https://mercurio-digital-7zmx0johk-bonacciniwds-projects.vercel.app`.

Para reverter somente a aplicação para esse deployment:

```sh
cd app
vercel rollback https://mercurio-digital-7zmx0johk-bonacciniwds-projects.vercel.app
```

O rollback da aplicação não altera banco nem desfaz recibos.

## Kill switch do RPC de escrita

Se houver problema após a migration, bloquear novas execuções do RPC sem apagar recibos, auditoria ou remover as funções de prévia:

```sql
begin;
revoke execute on function public.admin_proposta_consulta_aceites_atestar_retroativo_revisado() from authenticated;
commit;
```

Executar no SQL Editor do projeto correto somente se for necessário interromper novas gravações. A prévia permanece disponível para investigação; a interface poderá exibir erro ao tentar confirmar.

Após correção e revisão, a reativação controlada é:

```sql
grant execute on function public.admin_proposta_consulta_aceites_atestar_retroativo_revisado() to authenticated;
```

## Integridade dos dados

Não remover linhas de `proposta_consulta_aceites` nem eventos de `audit_log` em rollback. Os registros incluem atestados administrativos declarados pelo controlador e horário real do registro; apagar ou reescrever esses fatos destruiria a trilha. A migration não deve ser revertida com `DROP` automático após o backfill. Se algum recibo precisar de correção, usar o fluxo administrativo de revogação auditada e nova revisão, individualmente.
