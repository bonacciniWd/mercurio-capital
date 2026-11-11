-- Read-only contract checks after 20261028000002. No provider call or wallet movement.
do $$
declare
  v_start text := pg_get_functiondef('public.consulta_iniciar_serasa(uuid,public.tipo_consulta,uuid,uuid,text)'::regprocedure);
  v_refund text := pg_get_functiondef('public.consulta_estornar(uuid,text)'::regprocedure);
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'logs_consultas'
       and column_name = 'cobranca_modalidade' and is_nullable = 'NO'
  ) then raise exception 'missing consultation charging mode'; end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.logs_consultas'::regclass
       and conname = 'logs_consultas_operacao_interna_sem_ledger_check'
  ) then raise exception 'internal consultation may create wallet ledger entry'; end if;
  if not exists (
    select 1 from public.configuracoes_sistema
     where chave = 'serasa_admin_limite_diario'
       and jsonb_typeof(valor) = 'number' and valor::text ~ '^[0-9]+$'
       and (valor::text)::numeric >= 1
  ) then
    raise exception 'Admin Serasa quota is missing or invalid';
  end if;
  if position('pg_advisory_xact_lock' in v_start) = 0
     or position('serasa_admin_cota_diaria_excedida' in v_start) = 0
     or position('America/Sao_Paulo' in v_start) = 0 then
    raise exception 'Admin quota enforcement is incomplete';
  end if;
  if position('cobranca_modalidade' in v_refund) = 0
     or position('consulta_paga_sem_debito' in v_refund) = 0 then
    raise exception 'consultation failure could credit a wallet without debit';
  end if;
  if has_function_privilege('authenticated', 'public.consulta_estornar(uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.consulta_estornar(uuid,text)', 'execute') then
    raise exception 'consultation finalizer grants are incorrect';
  end if;
end;
$$;
