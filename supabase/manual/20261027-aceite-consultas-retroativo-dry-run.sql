-- SOMENTE LEITURA. Revisar o conjunto antes de qualquer chamada à RPC de escrita.
-- Não inclui nomes, CPF/CNPJ ou outros dados pessoais.

with elegiveis as (
  select p.id, p.protocolo, p.status, p.cliente_id
    from public.propostas p
    join public.clientes c on c.id = p.cliente_id
   where p.status not in ('simulacao', 'cancelado')
), existentes as (
  select distinct e.id
    from elegiveis e
    join public.proposta_consulta_aceites a
      on a.proposta_id = e.id
     and a.cliente_id = e.cliente_id
     and a.revogado_em is null
)
select
  (select count(*) from elegiveis) as propostas_elegiveis,
  (select count(*) from existentes) as ja_com_aceite_ou_atestado_ativo,
  (select count(*) from elegiveis e where not exists (
    select 1 from existentes x where x.id = e.id
  )) as candidatas_a_atestacao,
  (select count(*) from public.propostas p where p.status = 'simulacao') as excluidas_simulacao,
  (select count(*) from public.propostas p where p.status = 'cancelado') as excluidas_canceladas,
  (select count(*) from public.propostas p
    where p.status not in ('simulacao', 'cancelado') and p.cliente_id is null
  ) as sem_cliente;

-- Lista mínima para conferência operacional, sem PII.
with elegiveis as (
  select p.id, p.protocolo, p.status, p.cliente_id
    from public.propostas p
    join public.clientes c on c.id = p.cliente_id
   where p.status not in ('simulacao', 'cancelado')
)
select e.protocolo, e.status,
       case when exists (
         select 1 from public.proposta_consulta_aceites a
          where a.proposta_id = e.id and a.cliente_id = e.cliente_id
            and a.revogado_em is null
       ) then 'já possui registro ativo' else 'candidata a atestação' end as situacao
  from elegiveis e
 order by e.protocolo;
