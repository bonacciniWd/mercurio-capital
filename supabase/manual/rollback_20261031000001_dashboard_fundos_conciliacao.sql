-- Rollback referencia da migration 20261031000001_dashboard_fundos_conciliacao.sql.
-- Execute somente em resposta a falha confirmada. Restaura definicoes pre-migration
-- das duas funcoes existentes e das views, e remove apenas as duas RPCs novas.
-- Mantem anon sem EXECUTE nas funcoes administrativas.
BEGIN;

DROP FUNCTION IF EXISTS public.admin_dashboard_fundo_propostas(date,date,uuid,uuid,uuid,integer,integer);

DROP FUNCTION IF EXISTS public.admin_proposta_fundos_vencedores(uuid[]);

CREATE OR REPLACE FUNCTION public.admin_dashboard_fundos_analytics(p_inicio date, p_fim date, p_fundo uuid DEFAULT NULL::uuid, p_partner uuid DEFAULT NULL::uuid, p_equipe uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_inicio is null or p_fim is null or p_inicio > p_fim or p_fim - p_inicio > 3660 then
    raise exception 'filtro_invalido';
  end if;

  with base as (
    select p.*
      from public.propostas p
     where (p_partner is null or p.partner_id = p_partner)
       and (p_equipe is null or p.equipe_id = p_equipe)
       and (
         p_fundo is null
         or exists (
           select 1
             from public.proposta_fundos pfx
            where pfx.proposta_id = p.id
              and pfx.fundo_id = p_fundo
         )
       )
  ), periodo as (
    select *
      from base
     where created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
       and created_at < ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo')
  ), vencedores as (
    select distinct on (pf.proposta_id)
      pf.proposta_id,
      pf.fundo_id
      from public.proposta_fundos pf
      join periodo p on p.id = pf.proposta_id
     where pf.aprovado_em is not null
     order by pf.proposta_id, pf.aprovado_em asc, pf.fundo_id asc
  ), atribuicoes as (
    select
      pf.proposta_id,
      pf.fundo_id,
      f.nome,
      f.cor_hex,
      p.status,
      p.valor_solicitado,
      v.fundo_id as fundo_vencedor_id
      from public.proposta_fundos pf
      join periodo p on p.id = pf.proposta_id
      join public.fundos f on f.id = pf.fundo_id
      left join vencedores v on v.proposta_id = pf.proposta_id
     where p_fundo is null or pf.fundo_id = p_fundo
  ), por_fundo as (
    select
      a.fundo_id,
      a.nome,
      a.cor_hex,
      count(distinct a.proposta_id)::int as operacoes_representadas,
      count(distinct a.proposta_id) filter (where a.fundo_vencedor_id = a.fundo_id)::int as operacoes_unicas,
      coalesce(sum(case
        when a.fundo_vencedor_id = a.fundo_id and a.status <> 'standby'
        then a.valor_solicitado else 0 end), 0) as volume_solicitado,
      coalesce(sum(case
        when a.fundo_vencedor_id = a.fundo_id
         and a.status in ('registro_af', 'recurso_liberado', 'pagamento_comissao', 'completo')
        then a.valor_solicitado else 0 end), 0) as volume_ganho
      from atribuicoes a
     group by a.fundo_id, a.nome, a.cor_hex
  ), sem_vencedor as (
    select
      count(*) filter (where p.status <> 'standby')::int as operacoes,
      coalesce(sum(p.valor_solicitado) filter (where p.status <> 'standby'), 0) as volume_solicitado,
      coalesce(sum(p.valor_solicitado) filter (where p.status in ('registro_af', 'recurso_liberado', 'pagamento_comissao', 'completo')), 0) as volume_ganho
      from periodo p
     where not exists (
       select 1 from vencedores v where v.proposta_id = p.id
     )
  )
  select jsonb_build_object(
    'fundos', coalesce((select jsonb_agg(to_jsonb(pf) order by pf.nome) from por_fundo pf), '[]'::jsonb),
    'operacoes_sem_fundo_vencedor', (select s.operacoes from sem_vencedor s),
    'volume_solicitado_sem_fundo_vencedor', (select s.volume_solicitado from sem_vencedor s),
    'volume_ganho_sem_fundo_vencedor', (select s.volume_ganho from sem_vencedor s),
    'operacoes_unicas', (select count(*)::int from periodo where status <> 'standby'),
    'volume_solicitado_unico', (select coalesce(sum(valor_solicitado) filter (where status <> 'standby'), 0) from periodo),
    'volume_ganho_unico', (select coalesce(sum(valor_solicitado) filter (where status in ('registro_af', 'recurso_liberado', 'pagamento_comissao', 'completo')), 0) from periodo)
  ) into v_result;

  return v_result;
end;
$function$

REVOKE ALL ON FUNCTION public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_fundos_analytics(date,date,uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_analytics(p_inicio date, p_fim date, p_fundo uuid DEFAULT NULL::uuid, p_partner uuid DEFAULT NULL::uuid, p_equipe uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_result jsonb; v_granularidade text;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_inicio>p_fim or p_fim-p_inicio>3660 then raise exception 'filtro_invalido'; end if;
  v_granularidade := case when p_fim-p_inicio<=45 then 'day' when p_fim-p_inicio<=180 then 'week' else 'month' end;
  with base as (
    select p.* from public.propostas p
    where (p_partner is null or p.partner_id=p_partner) and (p_equipe is null or p.equipe_id=p_equipe)
      and (p_fundo is null or exists(select 1 from public.proposta_fundos pf where pf.proposta_id=p.id and pf.fundo_id=p_fundo))
  ), periodo as (
    select * from base where created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and created_at < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
  ), liberacoes as (
    select l.*,p.partner_id,p.status from public.liberacoes_recurso l join base p on p.id=l.proposta_id
    where l.data_liberacao between p_inicio and p_fim
  ), comissionaveis as (
    select p.id,p.partner_id,p.valor_solicitado,
      (select min(h.created_at) from public.proposta_status_historico h
       where h.proposta_id=p.id and h.status_novo='pagamento_comissao'
         and h.status_anterior is distinct from h.status_novo) entrada_comissao
    from base p where p.status in ('pagamento_comissao','completo')
  ), comissoes_periodo as (
    select * from comissionaveis
    where entrada_comissao >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and entrada_comissao < ((p_fim+1)::timestamp at time zone 'America/Sao_Paulo')
  ), serie as (
    select date_trunc(v_granularidade,created_at at time zone 'America/Sao_Paulo')::date periodo,count(*)::int propostas,
      count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      coalesce(sum(valor_solicitado) filter(where status <> 'standby'),0) volume_solicitado,
      coalesce(sum(valor_solicitado) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho
    from periodo group by 1 order by 1
  ), resumo as (
    select count(*)::int total_propostas,count(*) filter(where status not in ('cancelado','completo','standby'))::int ativas,
      count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
      count(*) filter(where status='standby')::int standby,count(*) filter(where status='cancelado')::int canceladas,count(distinct partner_id)::int parceiros_ativos
    from public.propostas
  )
  select jsonb_build_object(
    'total_propostas',count(*)::int,'ativas',count(*) filter(where status not in ('cancelado','completo','standby'))::int,
    'ganhas',count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int,
    'standby',count(*) filter(where status='standby')::int,'canceladas',count(*) filter(where status='cancelado')::int,
    'taxa_conversao',case when count(*) filter(where status <> 'standby')=0 then 0 else round(100.0*count(*) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))/(count(*) filter(where status <> 'standby')),1) end,
    'volume_solicitado',coalesce(sum(valor_solicitado) filter(where status <> 'standby'),0),
    'volume_ganho',coalesce(sum(valor_solicitado) filter(where status in ('registro_af','recurso_liberado','pagamento_comissao','completo')),0),
    'volume_liberado',coalesce((select sum(valor_solicitado) from comissoes_periodo),0),
    'liberadas_sem_data',(select count(*) from comissionaveis where entrada_comissao is null),
    'volume_liberado_sem_data',coalesce((select sum(valor_solicitado) from comissionaveis where entrada_comissao is null),0),
    'volume_operacional',coalesce((select sum(valor_liberado) from liberacoes),0),'parceiros_ativos',count(distinct partner_id)::int,
    'granularidade',v_granularidade,'resumo_global',(select to_jsonb(r) from resumo r),
    'serie',coalesce((select jsonb_agg(to_jsonb(s)) from serie s),'[]'::jsonb),
    'top_parceiros',coalesce((select jsonb_agg(to_jsonb(t)) from (
      select p.partner_id,u.nome_completo partner_nome,count(*) filter(where p.id in (select id from periodo))::int total,
        count(*) filter(where p.id in (select id from periodo) and p.status in ('registro_af','recurso_liberado','pagamento_comissao','completo'))::int ganhas,
        coalesce(sum(p.valor_solicitado) filter(where p.id in (select id from periodo) and p.status in ('registro_af','recurso_liberado','pagamento_comissao','completo')),0) volume_ganho,
        coalesce((select sum(c.valor_solicitado) from comissoes_periodo c where c.partner_id=p.partner_id),0) volume_liberado
      from (
        select * from periodo where status <> 'standby'
        union
        select b.* from base b join comissoes_periodo c on c.id=b.id
      ) p join public.partners pa on pa.id=p.partner_id join public.usuarios u on u.id=pa.usuario_id
      group by p.partner_id,u.nome_completo order by volume_ganho desc,total desc limit 10
    ) t),'[]'::jsonb)
  ) into v_result from periodo;
  return v_result;
end; $function$

REVOKE ALL ON FUNCTION public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_analytics(date,date,uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE VIEW public.v_admin_dashboard_kpis AS
 WITH base AS (
         SELECT p.id,
            p.status,
            p.partner_id,
            p.valor_solicitado,
            p.created_at,
                CASE
                    WHEN p.status = ANY (ARRAY['contrato_registrado'::proposta_status, 'recurso_liberado'::proposta_status, 'pagamento_comissao'::proposta_status, 'completo'::proposta_status]) THEN 1
                    ELSE 0
                END AS ganhou,
                CASE
                    WHEN p.status = 'cancelado'::proposta_status THEN 1
                    ELSE 0
                END AS perdeu,
                CASE
                    WHEN p.status = ANY (ARRAY['contrato_registrado'::proposta_status, 'completo'::proposta_status, 'cancelado'::proposta_status, 'standby'::proposta_status]) THEN 0
                    ELSE 1
                END AS ativa,
                CASE
                    WHEN p.created_at >= date_trunc('month'::text, now()) THEN 1
                    ELSE 0
                END AS no_mes
           FROM propostas p
          WHERE p.status <> 'standby'::proposta_status
        )
 SELECT count(*)::integer AS total_propostas,
    sum(no_mes)::integer AS propostas_mes,
    sum(ativa)::integer AS ativas,
    sum(ganhou)::integer AS ganhas,
    sum(perdeu)::integer AS canceladas,
        CASE
            WHEN count(*) > 0 THEN round(sum(ganhou)::numeric / count(*)::numeric * 100::numeric, 1)
            ELSE 0::numeric
        END AS taxa_conversao,
    COALESCE(sum(
        CASE
            WHEN ganhou = 1 THEN valor_solicitado
            ELSE NULL::numeric
        END), 0::numeric) AS volume_ganho,
    COALESCE(sum(valor_solicitado), 0::numeric) AS volume_total,
    count(DISTINCT partner_id)::integer AS parceiros_ativos
   FROM base
  WHERE app_is_admin();

CREATE OR REPLACE VIEW public.v_admin_top_partners AS
 SELECT p.partner_id,
    u.nome_completo AS partner_nome,
    count(*)::integer AS total,
    count(*) FILTER (WHERE p.status = ANY (ARRAY['contrato_registrado'::proposta_status, 'recurso_liberado'::proposta_status, 'pagamento_comissao'::proposta_status, 'completo'::proposta_status]))::integer AS ganhas,
    COALESCE(sum(p.valor_solicitado), 0::numeric) AS volume
   FROM propostas p
     JOIN partners pa ON pa.id = p.partner_id
     JOIN usuarios u ON u.id = pa.usuario_id
  WHERE app_is_admin() AND p.status <> 'standby'::proposta_status
  GROUP BY p.partner_id, u.nome_completo
  ORDER BY (COALESCE(sum(p.valor_solicitado), 0::numeric)) DESC
 LIMIT 20;

CREATE OR REPLACE VIEW public.v_partner_dashboard_kpis AS
 WITH base AS (
         SELECT p.partner_id,
            p.equipe_id,
            p.id,
            p.status,
            p.valor_solicitado,
            p.created_at,
                CASE
                    WHEN p.status = ANY (ARRAY['contrato_registrado'::proposta_status, 'recurso_liberado'::proposta_status, 'pagamento_comissao'::proposta_status, 'completo'::proposta_status]) THEN 1
                    ELSE 0
                END AS ganhou,
                CASE
                    WHEN p.status = 'cancelado'::proposta_status THEN 1
                    ELSE 0
                END AS perdeu,
                CASE
                    WHEN p.status = ANY (ARRAY['contrato_registrado'::proposta_status, 'completo'::proposta_status, 'cancelado'::proposta_status, 'standby'::proposta_status]) THEN 0
                    ELSE 1
                END AS ativa,
                CASE
                    WHEN p.created_at >= date_trunc('month'::text, now()) THEN 1
                    ELSE 0
                END AS no_mes,
                CASE
                    WHEN p.created_at >= (now() - '30 days'::interval) THEN 1
                    ELSE 0
                END AS nos_30d
           FROM propostas p
          WHERE p.status <> 'standby'::proposta_status
        )
 SELECT partner_id,
    count(*)::integer AS total_propostas,
    sum(no_mes)::integer AS propostas_mes,
    sum(nos_30d)::integer AS propostas_30d,
    sum(ativa)::integer AS ativas,
    sum(ganhou)::integer AS ganhas,
    sum(perdeu)::integer AS canceladas,
        CASE
            WHEN count(*) > 0 THEN round(sum(ganhou)::numeric / count(*)::numeric * 100::numeric, 1)
            ELSE 0::numeric
        END AS taxa_conversao,
    COALESCE(sum(
        CASE
            WHEN ganhou = 1 THEN valor_solicitado
            ELSE NULL::numeric
        END), 0::numeric) AS volume_ganho,
    COALESCE(avg(
        CASE
            WHEN ganhou = 1 THEN valor_solicitado
            ELSE NULL::numeric
        END), 0::numeric) AS ticket_medio_ganho,
    COALESCE(sum(valor_solicitado), 0::numeric) AS volume_total
   FROM base
  WHERE app_is_admin() OR partner_id = app_partner_id()
  GROUP BY partner_id;

CREATE OR REPLACE VIEW public.v_partner_propostas_por_mes AS
 SELECT partner_id,
    date_trunc('month'::text, created_at) AS mes,
    count(*)::integer AS quantidade,
    count(*) FILTER (WHERE status = ANY (ARRAY['contrato_registrado'::proposta_status, 'recurso_liberado'::proposta_status, 'pagamento_comissao'::proposta_status, 'completo'::proposta_status]))::integer AS ganhas,
    COALESCE(sum(valor_solicitado), 0::numeric) AS volume
   FROM propostas p
  WHERE status <> 'standby'::proposta_status AND created_at >= (now() - '1 year'::interval) AND (app_is_admin() OR partner_id = app_partner_id())
  GROUP BY partner_id, (date_trunc('month'::text, created_at));

COMMIT;
