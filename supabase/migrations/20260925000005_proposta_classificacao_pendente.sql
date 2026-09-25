-- Marca a proposta nova como aguardando classificação sem atribuir uma classe
-- inventada. A classificação e a distribuição continuam sendo decisões
-- explícitas pela RPC admin_classificar_distribuir_proposta.

create or replace function public.marcar_proposta_classificacao_pendente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.classificacao_lead is null and new.distribuicao_motivo is null then
    new.distribuicao_motivo := 'aguardando classificação operacional';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propostas_classificacao_pendente on public.propostas;
create trigger trg_propostas_classificacao_pendente
  before insert on public.propostas
  for each row execute function public.marcar_proposta_classificacao_pendente();

create index if not exists propostas_classificacao_pendente_idx
  on public.propostas (created_at desc)
  where classificacao_lead is null and status <> 'cancelado';

revoke all on function public.marcar_proposta_classificacao_pendente() from public;
