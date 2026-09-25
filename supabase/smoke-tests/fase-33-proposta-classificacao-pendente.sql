-- FASE 33 — proposta nova com classificação pendente
-- Executar em sessão autenticada de teste após a migration.

do $$
begin
  if to_regprocedure('public.marcar_proposta_classificacao_pendente()') is null then
    raise exception 'FASE 33 FAIL: função de classificação pendente ausente';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'trg_propostas_classificacao_pendente'
       and tgrelid = 'public.propostas'::regclass
       and tgenabled <> 'D'
  ) then
    raise exception 'FASE 33 FAIL: trigger de classificação pendente ausente';
  end if;
end;
$$;

select 'FASE 33 SMOKE: OK' as resultado;
