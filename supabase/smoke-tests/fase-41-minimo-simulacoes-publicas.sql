-- Smoke estrutural somente leitura; nao cria lead nem aciona e-mail.
do $$
declare
  v_function oid := to_regprocedure('public.simulacao_leads_publicos_validar_credito_minimo()');
begin
  if v_function is null then
    raise exception 'Funcao de validacao do piso minimo ausente';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.simulacao_leads_publicos'::regclass
      and tgname = 'trg_simulacao_leads_publicos_credito_minimo'
      and not tgisinternal
      and tgenabled <> 'D'
  ) then
    raise exception 'Trigger ativo de piso minimo ausente';
  end if;

  if position('400000' in pg_get_functiondef(v_function)) = 0 then
    raise exception 'Funcao nao contempla o piso de R$ 400.000';
  end if;
end;
$$;

select
  tgname as trigger_ativo,
  pg_get_triggerdef(oid) as definicao
from pg_trigger
where tgrelid = 'public.simulacao_leads_publicos'::regclass
  and tgname = 'trg_simulacao_leads_publicos_credito_minimo'
  and not tgisinternal;
