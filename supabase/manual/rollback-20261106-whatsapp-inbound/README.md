# Rollback — WhatsApp inbound

Este rollback remove somente os objetos criados pela migration `20261106000001_whatsapp_inbound.sql`. A remoção da tabela elimina os registros inbound recebidos por esta versão. Não afeta a fila/outbox `whatsapp_mensagens`, templates, secrets, configuração da Meta ou histórico outbound.

Execute apenas se o recurso precisar ser revertido e após confirmar que a perda dos registros inbound desta tabela é aceitável.

```sql
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'whatsapp-inbound-expurgo-diario'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$$;

drop function if exists public.whatsapp_mensagens_recebidas_expurgar_vencidas();
drop table if exists public.whatsapp_mensagens_recebidas;
```

Este arquivo documenta a reversão. Nenhum rollback foi executado.
