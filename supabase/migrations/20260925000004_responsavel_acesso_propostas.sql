-- Um analista pode acessar diretamente as propostas atribuídas a ele.

drop policy if exists team_le_propostas_responsavel on public.propostas;
create policy team_le_propostas_responsavel on public.propostas
  for select using (responsavel_id = auth.uid() and public.app_user_role() = 'team_member');

drop policy if exists team_le_proponentes_responsavel on public.proponentes;
create policy team_le_proponentes_responsavel on public.proponentes
  for select using (
    public.app_user_role() = 'team_member'
    and exists (select 1 from public.propostas p where p.id = proposta_id and p.responsavel_id = auth.uid())
  );

drop policy if exists team_le_imoveis_responsavel on public.imoveis;
create policy team_le_imoveis_responsavel on public.imoveis
  for select using (
    public.app_user_role() = 'team_member'
    and exists (select 1 from public.propostas p where p.id = proposta_id and p.responsavel_id = auth.uid())
  );

drop policy if exists team_le_docs_responsavel on public.proposta_documentos;
create policy team_le_docs_responsavel on public.proposta_documentos
  for select using (
    public.app_user_role() = 'team_member'
    and exists (select 1 from public.propostas p where p.id = proposta_id and p.responsavel_id = auth.uid())
  );

drop policy if exists team_le_pendencias_responsavel on public.proposta_pendencias;
create policy team_le_pendencias_responsavel on public.proposta_pendencias
  for select using (
    public.app_user_role() = 'team_member'
    and exists (select 1 from public.propostas p where p.id = proposta_id and p.responsavel_id = auth.uid())
  );

drop policy if exists team_le_historico_responsavel on public.proposta_status_historico;
create policy team_le_historico_responsavel on public.proposta_status_historico
  for select using (
    public.app_user_role() = 'team_member'
    and exists (select 1 from public.propostas p where p.id = proposta_id and p.responsavel_id = auth.uid())
  );

-- O kanban de team_member deve incluir a carteira atribuída diretamente.
create or replace function public.partner_list_kanban_propostas(p_limit int default 500)
returns table (
  id uuid, protocolo text, produto public.produto_tipo, status public.proposta_status,
  valor_solicitado numeric, valor_imoveis_total numeric, created_at timestamptz, updated_at timestamptz,
  partner_id uuid, partner_nome text, responsavel_id uuid, responsavel_nome text,
  cliente_id uuid, cliente_nome text
)
language plpgsql security definer stable set search_path = public
as $$
declare v_role text := public.app_user_role();
begin
  if auth.uid() is null or v_role not in ('partner', 'team_member') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.app_is_approved() then raise exception 'partner_not_approved' using errcode = '42501'; end if;
  return query
  select p.id, p.protocolo, p.produto, p.status, p.valor_solicitado, p.valor_imoveis_total,
         p.created_at, p.updated_at, p.partner_id, pu.nome_completo, p.responsavel_id,
         ru.nome_completo, p.cliente_id, c.nome_completo
    from public.propostas p
    join public.partners pt on pt.id = p.partner_id and pt.status = 'approved'
    join public.usuarios pu on pu.id = pt.usuario_id
    left join public.usuarios ru on ru.id = p.responsavel_id
    left join public.clientes c on c.id = p.cliente_id
   where (v_role = 'partner' and p.partner_id = public.app_partner_id())
      or (v_role = 'team_member' and (p.equipe_id = public.app_equipe_id() or p.responsavel_id = auth.uid()))
   order by p.updated_at desc limit least(1000, greatest(1, coalesce(p_limit, 500)));
end;
$$;

revoke all on function public.partner_list_kanban_propostas(int) from public;
grant execute on function public.partner_list_kanban_propostas(int) to authenticated;

-- A distribuição automática também pode usar analistas team_member.
create or replace function public.admin_set_responsavel(p_proposta_id uuid, p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_before uuid; v_role user_role;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode = '42501'; end if;
  select responsavel_id into v_before from propostas where id = p_proposta_id for update;
  if not found then raise exception 'proposta_not_found' using errcode = 'P0002'; end if;
  if p_usuario_id is not null then
    select role into v_role from usuarios where id = p_usuario_id and ativo;
    if v_role is null then raise exception 'usuario_not_found'; end if;
    if v_role not in ('admin', 'team_member') then raise exception 'usuario_alvo_nao_e_analista'; end if;
  end if;
  update propostas set responsavel_id = p_usuario_id, updated_at = now() where id = p_proposta_id;
  perform public.registrar_audit('admin_set_responsavel', 'propostas', p_proposta_id,
    jsonb_build_object('responsavel_id', v_before), jsonb_build_object('responsavel_id', p_usuario_id));
end;
$$;
revoke all on function public.admin_set_responsavel(uuid, uuid) from public;
grant execute on function public.admin_set_responsavel(uuid, uuid) to authenticated;

-- Mantém a mesma regra de roteamento para admins e analistas team_member.
create or replace function public.admin_classificar_distribuir_proposta(
  p_proposta_id uuid, p_classificacao public.lead_classificacao, p_confianca numeric default null,
  p_motivo text default null, p_automatico boolean default true
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_proposta public.propostas%rowtype; v_cfg public.config_leads_operacao%rowtype;
  v_peso numeric(4,2); v_analista uuid; v_nivel text; v_carga numeric; v_capacidade numeric;
begin
  if not public.app_is_admin_operacional() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_confianca is not null and (p_confianca < 0 or p_confianca > 1) then raise exception 'confianca_invalida'; end if;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;
  if not found then raise exception 'proposta_not_found' using errcode = 'P0002'; end if;
  select * into v_cfg from public.config_leads_operacao where id = true;
  v_peso := case p_classificacao when 'triple_a' then v_cfg.peso_triple_a when 'double_aa' then v_cfg.peso_double_aa when 'estressado' then v_cfg.peso_estressado else 0 end;
  update propostas set classificacao_lead=p_classificacao, classificacao_peso=v_peso, classificacao_confianca=p_confianca,
    classificacao_motivo=p_motivo, classificado_em=now(), classificado_por=auth.uid(), distribuido_em=null, distribuicao_motivo=null,
    responsavel_id=case when p_classificacao='desqualificado' then null else responsavel_id end where id=p_proposta_id;
  if p_classificacao='desqualificado' then
    perform registrar_audit('classificar_proposta','propostas',p_proposta_id,to_jsonb(v_proposta),jsonb_build_object('classificacao',p_classificacao,'peso',v_peso,'motivo',p_motivo));
    return jsonb_build_object('proposta_id',p_proposta_id,'classificacao',p_classificacao,'peso',v_peso,'distribuido',false);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('lead-distribuicao-'||date_trunc('month',now())::date::text,0));
  select u.id,u.nivel_operacional,u.capacidade_leads_mensal,coalesce(sum(ld.peso) filter(where ld.periodo=date_trunc('month',now())::date),0)
    into v_analista,v_nivel,v_capacidade,v_carga from usuarios u left join lead_distribuicoes ld on ld.analista_id=u.id
   where u.ativo and u.role in ('admin','team_member') and u.participa_distribuicao and u.nivel_operacional is not null and u.capacidade_leads_mensal is not null
   group by u.id,u.nivel_operacional,u.capacidade_leads_mensal
   order by case p_classificacao when 'triple_a' then case u.nivel_operacional when 'junior' then 0 when 'pleno' then 1 else 2 end
     when 'double_aa' then case u.nivel_operacional when 'pleno' then 0 when 'junior' then 1 else 2 end
     else case u.nivel_operacional when 'senior' then 0 when 'pleno' then 1 else 2 end end,
     coalesce(sum(ld.peso) filter(where ld.periodo=date_trunc('month',now())::date),0)/u.capacidade_leads_mensal,u.nome_completo,u.id limit 1;
  if v_analista is null then
    update propostas set distribuicao_motivo='aguardando analista operacional configurado' where id=p_proposta_id;
    return jsonb_build_object('proposta_id',p_proposta_id,'classificacao',p_classificacao,'peso',v_peso,'distribuido',false,'motivo','sem_analista_configurado');
  end if;
  insert into lead_distribuicoes(proposta_id,analista_id,classificacao,peso,automatico,motivo,criado_por) values(p_proposta_id,v_analista,p_classificacao,v_peso,p_automatico,p_motivo,auth.uid());
  update propostas set responsavel_id=v_analista,distribuido_em=now(),distribuicao_motivo=p_motivo where id=p_proposta_id;
  perform registrar_audit('distribuir_proposta','propostas',p_proposta_id,to_jsonb(v_proposta),jsonb_build_object('classificacao',p_classificacao,'peso',v_peso,'analista_id',v_analista,'analista_nivel',v_nivel));
  return jsonb_build_object('proposta_id',p_proposta_id,'classificacao',p_classificacao,'peso',v_peso,'distribuido',true,'analista_id',v_analista,'analista_nivel',v_nivel,'carga_anterior',v_carga,'capacidade',v_capacidade);
end; $$;
revoke all on function public.admin_classificar_distribuir_proposta(uuid,public.lead_classificacao,numeric,text,boolean) from public;
grant execute on function public.admin_classificar_distribuir_proposta(uuid,public.lead_classificacao,numeric,text,boolean) to authenticated;
