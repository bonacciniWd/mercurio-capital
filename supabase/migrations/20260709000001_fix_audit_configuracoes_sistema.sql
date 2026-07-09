-- =============================================
-- FIX: trigger de auditoria em configuracoes_sistema
-- =============================================
-- A trigger original (`trg_audit_config`) chamava `audit_update_trigger()`,
-- que referencia `NEW.id`. Como `configuracoes_sistema` usa `chave` (text)
-- como PK, qualquer UPDATE (inclusive o UPDATE gerado por um upsert em
-- conflito) falhava com:
--
--   ERROR: record "new" has no field "id"
--
-- Substituímos por uma função dedicada que:
--   * passa NULL em p_entidade_id (audit_log.entidade_id é uuid);
--   * grava a `chave` afetada dentro do payload_depois, para rastreabilidade.

create or replace function public.audit_config_update_trigger()
  returns trigger language plpgsql security definer as $$
begin
  perform public.registrar_audit(
    'update',
    tg_table_name,
    null,
    to_jsonb(old),
    jsonb_set(to_jsonb(new), '{__chave}', to_jsonb(new.chave))
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_config on public.configuracoes_sistema;

create trigger trg_audit_config
  after update on public.configuracoes_sistema
  for each row execute function public.audit_config_update_trigger();

