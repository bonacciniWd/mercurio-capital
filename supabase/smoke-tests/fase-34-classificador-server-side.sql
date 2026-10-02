-- FASE 34 — configuração e classificador server-side v1

do $$
begin
  if to_regprocedure('public.admin_classificar_proposta_automatico(uuid)') is null then
    raise exception 'FASE 34 FAIL: classificador ausente';
  end if;
  if to_regprocedure('public.admin_config_leads_classificador_atualizar(boolean,text,numeric,numeric,jsonb)') is null then
    raise exception 'FASE 34 FAIL: configuração do classificador ausente';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='config_leads_operacao' and column_name='classificador_ativo') then
    raise exception 'FASE 34 FAIL: feature flag ausente';
  end if;
end;
$$;

select 'FASE 34 SMOKE: OK' as resultado;
