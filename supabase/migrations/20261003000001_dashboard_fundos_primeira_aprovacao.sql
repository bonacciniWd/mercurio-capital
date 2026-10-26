-- Dashboard por fundos: representação múltipla e atribuição financeira única.
-- Uma proposta pode ser representada em vários fundos, mas seus valores só
-- pertencem ao primeiro fundo que a aprovou.

alter table public.proposta_fundos
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid;

create index if not exists proposta_fundos_aprovado_idx
  on public.proposta_fundos (proposta_id, aprovado_em, fundo_id);

-- Recupera a primeira aprovação conhecida no audit_log. O fallback para
-- updated_at cobre registros legados que já estão aprovados, mas não possuem
-- evento histórico de aprovação disponível.
with primeira_aprovacao as (
  select distinct on (a.entidade_id, a.payload_depois ->> 'fundo_id')
    a.entidade_id as proposta_id,
    a.payload_depois ->> 'fundo_id' as fundo_id,
    a.created_at,
    a.usuario_id
  from public.audit_log a
  where a.entidade = 'proposta_fundos'
    and a.acao = 'proposta_fundo_set'
    and a.payload_depois ->> 'status_fundo' = 'aprovado'
  order by a.entidade_id, a.payload_depois ->> 'fundo_id', a.created_at asc, a.id asc
)
update public.proposta_fundos pf
   set aprovado_em = pa.created_at,
       aprovado_por = pa.usuario_id
  from primeira_aprovacao pa
 where pa.proposta_id = pf.proposta_id
   and pa.fundo_id = pf.fundo_id::text
   and pf.aprovado_em is null;

update public.proposta_fundos
   set aprovado_em = updated_at
 where status_fundo = 'aprovado'
   and aprovado_em is null;

create or replace function public.preserve_proposta_fundo_primeira_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status_fundo = 'aprovado' and new.aprovado_em is null then
    new.aprovado_em := now();
    new.aprovado_por := coalesce(new.aprovado_por, auth.uid());
  elsif tg_op = 'UPDATE' and old.aprovado_em is not null then
    new.aprovado_em := old.aprovado_em;
    new.aprovado_por := old.aprovado_por;
  elsif tg_op = 'UPDATE' and new.status_fundo = 'aprovado' and new.aprovado_em is null then
    new.aprovado_em := now();
    new.aprovado_por := coalesce(new.aprovado_por, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preserve_proposta_fundo_primeira_aprovacao on public.proposta_fundos;
create trigger trg_preserve_proposta_fundo_primeira_aprovacao
  before insert or update on public.proposta_fundos
  for each row execute function public.preserve_proposta_fundo_primeira_aprovacao();

-- A primeira aprovação é preservada mesmo que o status seja alterado depois.
create or replace function public.admin_proposta_fundo_set(
  p_proposta_id  uuid,
  p_fundo_id     uuid,
  p_status       public.fundo_status default 'aguardando',
  p_obs          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.fundo_status := coalesce(p_status, 'aguardando');
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.propostas p where p.id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.fundos f where f.id = p_fundo_id) then
    raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.proposta_fundos as target (
    proposta_id, fundo_id, status_fundo, observacao, atribuido_por,
    aprovado_em, aprovado_por
  )
  values (
    p_proposta_id, p_fundo_id, v_status,
    nullif(btrim(coalesce(p_obs, '')), ''), auth.uid(),
    case when v_status = 'aprovado' then now() end,
    case when v_status = 'aprovado' then auth.uid() end
  )
  on conflict (proposta_id, fundo_id) do update
     set status_fundo = excluded.status_fundo,
         observacao = excluded.observacao,
         atribuido_por = auth.uid(),
         aprovado_em = coalesce(target.aprovado_em, excluded.aprovado_em),
         aprovado_por = coalesce(target.aprovado_por, excluded.aprovado_por);

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    'proposta_fundo_set',
    'proposta_fundos',
    p_proposta_id,
    jsonb_build_object(
      'fundo_id', p_fundo_id,
      'status_fundo', v_status,
      'primeira_aprovacao_preservada', true
    )
  );
end;
$$;

revoke all on function public.admin_proposta_fundo_set(uuid, uuid, public.fundo_status, text) from public;
grant execute on function public.admin_proposta_fundo_set(uuid, uuid, public.fundo_status, text) to authenticated;

-- Não permite apagar uma atribuição que já aprovou a proposta. O vínculo
-- permanece como evidência do primeiro vencedor; o status pode ser alterado e
-- a correção fica auditada sem transferir o volume para outro fundo.
create or replace function public.admin_proposta_fundo_remove(
  p_proposta_id uuid,
  p_fundo_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.proposta_fundos
     where proposta_id = p_proposta_id
       and fundo_id = p_fundo_id
       and aprovado_em is not null
  ) then
    raise exception 'fundo_aprovado_nao_pode_ser_removido';
  end if;

  delete from public.proposta_fundos
   where proposta_id = p_proposta_id
     and fundo_id = p_fundo_id;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'atribuicao_nao_encontrada' using errcode = 'P0002';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes)
  values (
    auth.uid(),
    'proposta_fundo_removido',
    'proposta_fundos',
    p_proposta_id,
    jsonb_build_object('fundo_id', p_fundo_id)
  );
end;
$$;

revoke all on function public.admin_proposta_fundo_remove(uuid, uuid) from public;
grant execute on function public.admin_proposta_fundo_remove(uuid, uuid) to authenticated;

-- Resumo usado pelo Dashboard Global. A RPC não altera o contrato da RPC
-- admin_dashboard_analytics existente, reduzindo o risco de regressão.
create or replace function public.admin_dashboard_fundos_analytics(
  p_inicio date,
  p_fim date,
  p_fundo uuid default null,
  p_partner uuid default null,
  p_equipe uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.admin_dashboard_fundos_analytics(date, date, uuid, uuid, uuid) from public;
grant execute on function public.admin_dashboard_fundos_analytics(date, date, uuid, uuid, uuid) to authenticated;
