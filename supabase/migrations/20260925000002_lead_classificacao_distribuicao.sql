-- Classificação operacional e distribuição ponderada de leads.
-- O limiar de 100 leads é exclusivo da bonificação; não limita a fila.

do $$ begin
  create type public.lead_classificacao as enum ('triple_a', 'double_aa', 'estressado', 'desqualificado');
exception when duplicate_object then null; end $$;

alter table public.usuarios
  add column if not exists nivel_operacional text
    check (nivel_operacional in ('junior', 'pleno', 'senior')),
  add column if not exists capacidade_leads_mensal numeric(10,2)
    check (capacidade_leads_mensal is null or capacidade_leads_mensal > 0),
  add column if not exists participa_distribuicao boolean not null default false;

alter table public.simulacoes
  add column if not exists classificacao_lead public.lead_classificacao,
  add column if not exists classificacao_peso numeric(4,2)
    check (classificacao_peso is null or classificacao_peso >= 0),
  add column if not exists classificacao_confianca numeric(5,4)
    check (classificacao_confianca is null or classificacao_confianca between 0 and 1),
  add column if not exists classificacao_motivo text,
  add column if not exists classificado_em timestamptz,
  add column if not exists classificado_por uuid references public.usuarios(id) on delete set null,
  add column if not exists distribuido_em timestamptz,
  add column if not exists distribuicao_motivo text;

create table if not exists public.config_leads_operacao (
  id boolean primary key default true check (id),
  limiar_bonus_leads numeric(10,2) not null default 100 check (limiar_bonus_leads >= 0),
  peso_triple_a numeric(4,2) not null default 1.00 check (peso_triple_a > 0),
  peso_double_aa numeric(4,2) not null default 1.30 check (peso_double_aa > 0),
  peso_estressado numeric(4,2) not null default 1.70 check (peso_estressado > 0),
  capacidade_junior numeric(10,2) not null default 4 check (capacidade_junior > 0),
  capacidade_pleno numeric(10,2) not null default 8 check (capacidade_pleno > 0),
  capacidade_senior numeric(10,2) not null default 9 check (capacidade_senior > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios(id) on delete set null
);

insert into public.config_leads_operacao (id)
values (true)
on conflict (id) do nothing;

alter table public.config_leads_operacao enable row level security;
drop policy if exists config_leads_operacao_read on public.config_leads_operacao;
create policy config_leads_operacao_read on public.config_leads_operacao
  for select using (public.app_is_admin());
drop policy if exists config_leads_operacao_write on public.config_leads_operacao;
create policy config_leads_operacao_write on public.config_leads_operacao
  for all using (public.app_is_admin_operacional())
  with check (public.app_is_admin_operacional());

create table if not exists public.lead_distribuicoes (
  id uuid primary key default gen_random_uuid(),
  simulacao_id uuid not null references public.simulacoes(id) on delete cascade,
  analista_id uuid not null references public.usuarios(id) on delete restrict,
  classificacao public.lead_classificacao not null,
  peso numeric(4,2) not null check (peso >= 0),
  periodo date not null default date_trunc('month', now())::date,
  automatico boolean not null default true,
  motivo text,
  criado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_distribuicoes_analista_periodo_idx
  on public.lead_distribuicoes (analista_id, periodo, created_at desc);
create index if not exists lead_distribuicoes_simulacao_idx
  on public.lead_distribuicoes (simulacao_id, created_at desc);

alter table public.lead_distribuicoes enable row level security;
drop policy if exists lead_distribuicoes_read on public.lead_distribuicoes;
create policy lead_distribuicoes_read on public.lead_distribuicoes
  for select using (public.app_is_admin());

create or replace function public.admin_classificar_distribuir_lead(
  p_simulacao_id uuid,
  p_classificacao public.lead_classificacao,
  p_confianca numeric default null,
  p_motivo text default null,
  p_automatico boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sim public.simulacoes%rowtype;
  v_cfg public.config_leads_operacao%rowtype;
  v_peso numeric(4,2);
  v_analista uuid;
  v_nivel text;
  v_carga numeric;
  v_capacidade numeric;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_confianca is not null and (p_confianca < 0 or p_confianca > 1) then
    raise exception 'confianca_invalida';
  end if;

  select * into v_sim from public.simulacoes where id = p_simulacao_id for update;
  if not found then raise exception 'simulacao_not_found' using errcode = 'P0002'; end if;
  select * into v_cfg from public.config_leads_operacao where id = true;
  if not found then raise exception 'config_leads_operacao_not_found'; end if;

  v_peso := case p_classificacao
    when 'triple_a' then v_cfg.peso_triple_a
    when 'double_aa' then v_cfg.peso_double_aa
    when 'estressado' then v_cfg.peso_estressado
    else 0
  end;

  update public.simulacoes set
    classificacao_lead = p_classificacao,
    classificacao_peso = v_peso,
    classificacao_confianca = p_confianca,
    classificacao_motivo = p_motivo,
    classificado_em = now(),
    classificado_por = auth.uid(),
    distribuido_em = null,
    distribuicao_motivo = null,
    responsavel_id = case when p_classificacao = 'desqualificado' then null else responsavel_id end
  where id = p_simulacao_id;

  if p_classificacao = 'desqualificado' then
    perform public.registrar_audit('classificar_lead', 'simulacoes', p_simulacao_id,
      to_jsonb(v_sim), jsonb_build_object('classificacao', p_classificacao, 'peso', v_peso, 'motivo', p_motivo));
    return jsonb_build_object('simulacao_id', p_simulacao_id, 'classificacao', p_classificacao, 'peso', v_peso, 'distribuido', false);
  end if;

  -- Serializa a escolha por mês para evitar duas distribuições simultâneas
  -- escolherem a mesma menor carga.
  perform pg_advisory_xact_lock(hashtextextended('lead-distribuicao-' || date_trunc('month', now())::date::text, 0));

  select u.id, u.nivel_operacional, u.capacidade_leads_mensal,
         coalesce(sum(ld.peso) filter (where ld.periodo = date_trunc('month', now())::date), 0)
    into v_analista, v_nivel, v_capacidade, v_carga
    from public.usuarios u
    left join public.lead_distribuicoes ld on ld.analista_id = u.id
   where u.ativo
     and u.role = 'admin'
     and u.participa_distribuicao
     and u.nivel_operacional is not null
     and u.capacidade_leads_mensal is not null
   group by u.id, u.nivel_operacional, u.capacidade_leads_mensal
   order by
     case p_classificacao
       when 'triple_a' then case u.nivel_operacional when 'junior' then 0 when 'pleno' then 1 else 2 end
       when 'double_aa' then case u.nivel_operacional when 'pleno' then 0 when 'junior' then 1 else 2 end
       else case u.nivel_operacional when 'senior' then 0 when 'pleno' then 1 else 2 end
     end,
     coalesce(sum(ld.peso) filter (where ld.periodo = date_trunc('month', now())::date), 0) / u.capacidade_leads_mensal,
     u.nome_completo,
     u.id
   limit 1;

  if v_analista is null then
    update public.simulacoes set distribuicao_motivo = 'aguardando analista operacional configurado' where id = p_simulacao_id;
    return jsonb_build_object('simulacao_id', p_simulacao_id, 'classificacao', p_classificacao, 'peso', v_peso, 'distribuido', false, 'motivo', 'sem_analista_configurado');
  end if;

  insert into public.lead_distribuicoes (simulacao_id, analista_id, classificacao, peso, automatico, motivo, criado_por)
  values (p_simulacao_id, v_analista, p_classificacao, v_peso, p_automatico, p_motivo, auth.uid());

  update public.simulacoes set responsavel_id = v_analista, distribuido_em = now(), distribuicao_motivo = p_motivo where id = p_simulacao_id;
  perform public.registrar_audit('distribuir_lead', 'simulacoes', p_simulacao_id, to_jsonb(v_sim),
    jsonb_build_object('classificacao', p_classificacao, 'peso', v_peso, 'analista_id', v_analista, 'analista_nivel', v_nivel));

  return jsonb_build_object('simulacao_id', p_simulacao_id, 'classificacao', p_classificacao, 'peso', v_peso,
    'distribuido', true, 'analista_id', v_analista, 'analista_nivel', v_nivel, 'carga_anterior', v_carga, 'capacidade', v_capacidade);
end;
$$;

revoke all on function public.admin_classificar_distribuir_lead(uuid, public.lead_classificacao, numeric, text, boolean) from public;
grant execute on function public.admin_classificar_distribuir_lead(uuid, public.lead_classificacao, numeric, text, boolean) to authenticated;
