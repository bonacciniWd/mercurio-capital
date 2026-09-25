-- Conecta a classificação ao fluxo real de criação de propostas.

alter table public.propostas
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

alter table public.lead_distribuicoes
  alter column simulacao_id drop not null,
  add column if not exists proposta_id uuid references public.propostas(id) on delete cascade;

alter table public.lead_distribuicoes
  drop constraint if exists lead_distribuicoes_origem_check;
alter table public.lead_distribuicoes
  add constraint lead_distribuicoes_origem_check
  check ((simulacao_id is not null) or (proposta_id is not null));

create index if not exists lead_distribuicoes_proposta_idx
  on public.lead_distribuicoes (proposta_id, created_at desc);

create or replace function public.admin_classificar_distribuir_proposta(
  p_proposta_id uuid,
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
  v_proposta public.propostas%rowtype;
  v_cfg public.config_leads_operacao%rowtype;
  v_peso numeric(4,2);
  v_analista uuid;
  v_nivel text;
  v_carga numeric;
  v_capacidade numeric;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_confianca is not null and (p_confianca < 0 or p_confianca > 1) then raise exception 'confianca_invalida'; end if;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;
  if not found then raise exception 'proposta_not_found' using errcode = 'P0002'; end if;
  select * into v_cfg from public.config_leads_operacao where id = true;
  if not found then raise exception 'config_leads_operacao_not_found'; end if;

  v_peso := case p_classificacao
    when 'triple_a' then v_cfg.peso_triple_a
    when 'double_aa' then v_cfg.peso_double_aa
    when 'estressado' then v_cfg.peso_estressado
    else 0
  end;

  update public.propostas set
    classificacao_lead = p_classificacao,
    classificacao_peso = v_peso,
    classificacao_confianca = p_confianca,
    classificacao_motivo = p_motivo,
    classificado_em = now(),
    classificado_por = auth.uid(),
    distribuido_em = null,
    distribuicao_motivo = null,
    responsavel_id = case when p_classificacao = 'desqualificado' then null else responsavel_id end
  where id = p_proposta_id;

  if p_classificacao = 'desqualificado' then
    perform public.registrar_audit('classificar_proposta', 'propostas', p_proposta_id, to_jsonb(v_proposta),
      jsonb_build_object('classificacao', p_classificacao, 'peso', v_peso, 'motivo', p_motivo));
    return jsonb_build_object('proposta_id', p_proposta_id, 'classificacao', p_classificacao, 'peso', v_peso, 'distribuido', false);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('lead-distribuicao-' || date_trunc('month', now())::date::text, 0));
  select u.id, u.nivel_operacional, u.capacidade_leads_mensal,
         coalesce(sum(ld.peso) filter (where ld.periodo = date_trunc('month', now())::date), 0)
    into v_analista, v_nivel, v_capacidade, v_carga
    from public.usuarios u
    left join public.lead_distribuicoes ld on ld.analista_id = u.id
   where u.ativo and u.role = 'admin' and u.participa_distribuicao
     and u.nivel_operacional is not null and u.capacidade_leads_mensal is not null
   group by u.id, u.nivel_operacional, u.capacidade_leads_mensal
   order by
     case p_classificacao
       when 'triple_a' then case u.nivel_operacional when 'junior' then 0 when 'pleno' then 1 else 2 end
       when 'double_aa' then case u.nivel_operacional when 'pleno' then 0 when 'junior' then 1 else 2 end
       else case u.nivel_operacional when 'senior' then 0 when 'pleno' then 1 else 2 end
     end,
     coalesce(sum(ld.peso) filter (where ld.periodo = date_trunc('month', now())::date), 0) / u.capacidade_leads_mensal,
     u.nome_completo, u.id
   limit 1;

  if v_analista is null then
    update public.propostas set distribuicao_motivo = 'aguardando analista operacional configurado' where id = p_proposta_id;
    return jsonb_build_object('proposta_id', p_proposta_id, 'classificacao', p_classificacao, 'peso', v_peso, 'distribuido', false, 'motivo', 'sem_analista_configurado');
  end if;

  insert into public.lead_distribuicoes (proposta_id, analista_id, classificacao, peso, automatico, motivo, criado_por)
  values (p_proposta_id, v_analista, p_classificacao, v_peso, p_automatico, p_motivo, auth.uid());
  update public.propostas set responsavel_id = v_analista, distribuido_em = now(), distribuicao_motivo = p_motivo where id = p_proposta_id;
  perform public.registrar_audit('distribuir_proposta', 'propostas', p_proposta_id, to_jsonb(v_proposta),
    jsonb_build_object('classificacao', p_classificacao, 'peso', v_peso, 'analista_id', v_analista, 'analista_nivel', v_nivel));
  return jsonb_build_object('proposta_id', p_proposta_id, 'classificacao', p_classificacao, 'peso', v_peso,
    'distribuido', true, 'analista_id', v_analista, 'analista_nivel', v_nivel, 'carga_anterior', v_carga, 'capacidade', v_capacidade);
end;
$$;

revoke all on function public.admin_classificar_distribuir_proposta(uuid, public.lead_classificacao, numeric, text, boolean) from public;
grant execute on function public.admin_classificar_distribuir_proposta(uuid, public.lead_classificacao, numeric, text, boolean) to authenticated;
