-- Altera somente defaults futuros. Propostas/simulações existentes preservam a taxa contratada.
alter table public.simulacoes
  alter column taxa_juros_mensal set default 1.29;

alter table public.propostas
  alter column taxa_juros_mensal set default 1.29;

insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'taxa_juros_mensal_default',
  '1.29'::jsonb,
  'Taxa de juros mensal padrão (% a.m. sobre IPCA)'
)
on conflict (chave) do update
set valor = excluded.valor,
    descricao = excluded.descricao,
    updated_at = now();

-- Mantém as definições vigentes das RPCs e troca apenas o fallback numérico.
do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.partner_create_proposta(jsonb)'::regprocedure,
    'public.admin_create_proposta(uuid,jsonb)'::regprocedure
  ] loop
    select pg_get_functiondef(v_function) into v_definition;
    if position('1.39' in v_definition) = 0 then
      raise exception 'fallback 1.39 não encontrado em %', v_function;
    end if;
    execute replace(v_definition, '1.39', '1.29');
  end loop;
end
$$;