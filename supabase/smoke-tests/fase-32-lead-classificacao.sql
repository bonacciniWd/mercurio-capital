-- FASE 32 — classificação e distribuição de leads
-- Read-only: valida objetos e parâmetros sem criar ou atribuir leads.
do $$
declare
  v_cfg record;
begin
  if to_regclass('public.config_leads_operacao') is null then
    raise exception 'FASE 32 FAIL: configuração de leads ausente';
  end if;
  if to_regclass('public.lead_distribuicoes') is null then
    raise exception 'FASE 32 FAIL: histórico de distribuição ausente';
  end if;

  select * into v_cfg from public.config_leads_operacao where id = true;
  if not found then raise exception 'FASE 32 FAIL: configuração singleton ausente'; end if;
  if v_cfg.limiar_bonus_leads <> 100 then raise exception 'FASE 32 FAIL: limiar de bonificação diferente de 100'; end if;
  if v_cfg.peso_triple_a <> 1.00 or v_cfg.peso_double_aa <> 1.30 or v_cfg.peso_estressado <> 1.70 then
    raise exception 'FASE 32 FAIL: pesos padrão incorretos';
  end if;
  if to_regprocedure('public.admin_classificar_distribuir_lead(uuid,public.lead_classificacao,numeric,text,boolean)') is null then
    raise exception 'FASE 32 FAIL: RPC de classificação ausente';
  end if;
  raise notice 'FASE 32 OK: configuração, pesos e RPC disponíveis';
end $$;
