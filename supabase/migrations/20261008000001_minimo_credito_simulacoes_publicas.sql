-- Impede novas simulacoes publicas abaixo de R$ 400.000, sem alterar historico.
create or replace function public.simulacao_leads_publicos_validar_credito_minimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.valor_credito is null or new.valor_credito < 400000)
    and not exists (
      select 1
      from public.simulacao_leads_publicos existing
      where existing.idempotency_key = new.idempotency_key
    ) then
    raise exception 'valor_credito_minimo_400000' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.simulacao_leads_publicos_validar_credito_minimo() from public, anon, authenticated;

drop trigger if exists trg_simulacao_leads_publicos_credito_minimo on public.simulacao_leads_publicos;
create trigger trg_simulacao_leads_publicos_credito_minimo
  before insert on public.simulacao_leads_publicos
  for each row
  execute function public.simulacao_leads_publicos_validar_credito_minimo();
