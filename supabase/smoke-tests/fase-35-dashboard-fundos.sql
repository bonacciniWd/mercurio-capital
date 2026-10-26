-- FASE 35 — distribuição por fundos e primeira aprovação
-- Read-only: valida objetos e contratos, sem alterar propostas ou atribuições.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proposta_fundos'
       and column_name = 'aprovado_em'
  ) then
    raise exception 'FASE 35 FAIL: data da primeira aprovação ausente';
  end if;

  if to_regprocedure('public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid)') is null then
    raise exception 'FASE 35 FAIL: RPC de distribuição por fundos ausente';
  end if;

  if to_regprocedure('public.admin_proposta_fundo_set(uuid,uuid,public.fundo_status,text)') is null then
    raise exception 'FASE 35 FAIL: RPC de atribuição de fundo ausente';
  end if;
end;
$$;

select 'FASE 35 SMOKE: OK' as resultado;
