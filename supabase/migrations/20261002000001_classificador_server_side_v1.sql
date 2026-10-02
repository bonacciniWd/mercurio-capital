-- Classificador server-side v1.
-- A feature flag mantém a operação manual até a homologação dos critérios.

alter table public.config_leads_operacao
  add column if not exists classificador_ativo boolean not null default false,
  add column if not exists classificador_versao text not null default 'v1',
  add column if not exists confianca_distribuicao numeric(5,4) not null default 0.8500
    check (confianca_distribuicao between 0 and 1),
  add column if not exists confianca_revisao numeric(5,4) not null default 0.6000
    check (confianca_revisao between 0 and 1),
  add column if not exists classificador_criterios jsonb not null default jsonb_build_object(
    'exigir_documentos_aprovados', true,
    'considerar_debitos_imovel', true,
    'considerar_pendencias_abertas', true,
    'revisar_sinal_juridico', true
  );

alter table public.config_leads_operacao
  add constraint config_leads_confianca_ordem_check
  check (confianca_revisao <= confianca_distribuicao);

create or replace function public.admin_config_leads_classificador_atualizar(
  p_ativo boolean default null,
  p_versao text default null,
  p_confianca_distribuicao numeric default null,
  p_confianca_revisao numeric default null,
  p_criterios jsonb default null
)
returns public.config_leads_operacao
language plpgsql
security definer
set search_path = public
as $$
declare v_cfg public.config_leads_operacao;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_confianca_distribuicao is not null and (p_confianca_distribuicao < 0 or p_confianca_distribuicao > 1) then
    raise exception 'confianca_distribuicao_invalida';
  end if;
  if p_confianca_revisao is not null and (p_confianca_revisao < 0 or p_confianca_revisao > 1) then
    raise exception 'confianca_revisao_invalida';
  end if;

  update public.config_leads_operacao
     set classificador_ativo = coalesce(p_ativo, classificador_ativo),
         classificador_versao = coalesce(nullif(trim(p_versao), ''), classificador_versao),
         confianca_distribuicao = coalesce(p_confianca_distribuicao, confianca_distribuicao),
         confianca_revisao = coalesce(p_confianca_revisao, confianca_revisao),
         classificador_criterios = coalesce(p_criterios, classificador_criterios),
         updated_at = now(), updated_by = auth.uid()
   where id = true
     and coalesce(p_confianca_revisao, confianca_revisao)
         <= coalesce(p_confianca_distribuicao, confianca_distribuicao)
   returning * into v_cfg;
  if not found then raise exception 'configuracao_classificador_invalida'; end if;

  perform public.registrar_audit(
    'configurar_classificador_leads', 'config_leads_operacao', true,
    null, to_jsonb(v_cfg)
  );
  return v_cfg;
end;
$$;

revoke all on function public.admin_config_leads_classificador_atualizar(boolean,text,numeric,numeric,jsonb) from public;
grant execute on function public.admin_config_leads_classificador_atualizar(boolean,text,numeric,numeric,jsonb) to authenticated;

create or replace function public.admin_classificar_proposta_automatico(p_proposta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposta public.propostas%rowtype;
  v_cfg public.config_leads_operacao%rowtype;
  v_cliente public.clientes%rowtype;
  v_tipo text;
  v_requisitos int := 0;
  v_documentos_aprovados int := 0;
  v_imovel_exists boolean := false;
  v_imovel_ok boolean := false;
  v_renda_ok boolean := false;
  v_documentos_ok boolean := false;
  v_pendencias_ok boolean := true;
  v_sinal_juridico boolean := false;
  v_classificacao public.lead_classificacao;
  v_confianca numeric(5,4);
  v_peso numeric(4,2);
  v_motivo text;
  v_evidencias jsonb := '[]'::jsonb;
  v_pendencias jsonb := '[]'::jsonb;
  v_distribuido jsonb;
  v_criterios jsonb;
begin
  if not public.app_is_admin_operacional() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_proposta from public.propostas where id = p_proposta_id for update;
  if not found then raise exception 'proposta_not_found' using errcode = 'P0002'; end if;
  select * into v_cfg from public.config_leads_operacao where id = true;
  if not found then raise exception 'config_leads_operacao_not_found'; end if;
  if not v_cfg.classificador_ativo then
    update public.propostas set distribuicao_motivo = 'classificador desativado; revisão manual necessária' where id = p_proposta_id;
    return jsonb_build_object('proposta_id', p_proposta_id, 'status', 'pendente', 'motivo', 'classificador_desativado', 'versao_regra', v_cfg.classificador_versao);
  end if;

  v_criterios := v_cfg.classificador_criterios;
  v_tipo := coalesce((select c.pessoa_tipo::text from public.clientes c where c.id = v_proposta.cliente_id), 'PF');
  select c.* into v_cliente from public.clientes c where c.id = v_proposta.cliente_id;

  select count(*) into v_requisitos
    from public.documento_requisitos r
   where r.obrigatorio and (r.categoria = 'imovel' or r.categoria = case when v_tipo = 'PJ' then 'pessoa_juridica' else 'pessoa_fisica' end);
  select count(*) into v_documentos_aprovados
    from public.documento_requisitos r
   where r.obrigatorio and (r.categoria = 'imovel' or r.categoria = case when v_tipo = 'PJ' then 'pessoa_juridica' else 'pessoa_fisica' end)
     and exists (select 1 from public.proposta_documentos d where d.proposta_id = p_proposta_id and d.tipo = r.tipo and d.status = 'aprovado');
  v_documentos_ok := not coalesce((v_criterios->>'exigir_documentos_aprovados')::boolean, true) or (v_requisitos > 0 and v_documentos_aprovados >= v_requisitos);

  select exists (select 1 from public.imoveis i where i.proposta_id = p_proposta_id and i.valor > 0) into v_imovel_exists;
  select exists (select 1 from public.imoveis i where i.proposta_id = p_proposta_id and i.valor > 0 and (not coalesce((v_criterios->>'considerar_debitos_imovel')::boolean, true) or not i.possui_debitos)) into v_imovel_ok;
  v_renda_ok := coalesce(v_cliente.renda_mensal, 0) > 0 or (v_tipo = 'PJ' and coalesce(v_cliente.faturamento_mensal, 0) > 0);
  v_pendencias_ok := not coalesce((v_criterios->>'considerar_pendencias_abertas')::boolean, true)
    or not exists (select 1 from public.proposta_pendencias pp where pp.proposta_id = p_proposta_id and pp.status in ('aberta','em_analise'));
  v_sinal_juridico := exists (select 1 from public.proposta_pendencias pp where pp.proposta_id = p_proposta_id and pp.status in ('aberta','em_analise') and lower(pp.descricao) ~ '(jurid|fraude|penhora|indispon|ônus|onus)');

  if v_imovel_ok then v_evidencias := v_evidencias || jsonb_build_array('garantia com valor informado e sem débito impeditivo'); end if;
  if v_renda_ok then v_evidencias := v_evidencias || jsonb_build_array('capacidade de pagamento informada'); else v_pendencias := v_pendencias || jsonb_build_array('renda ausente ou não comprovada'); end if;
  if v_documentos_ok then v_evidencias := v_evidencias || jsonb_build_array('checklist mínimo aprovado'); else v_pendencias := v_pendencias || jsonb_build_array('checklist mínimo incompleto'); end if;
  if not v_pendencias_ok then v_pendencias := v_pendencias || jsonb_build_array('há pendências operacionais abertas'); end if;
  if v_sinal_juridico then v_pendencias := v_pendencias || jsonb_build_array('sinal jurídico sensível exige revisão'); end if;

  if v_imovel_ok and v_renda_ok and v_documentos_ok and v_pendencias_ok then
    v_classificacao := 'triple_a'; v_confianca := 1.0000; v_motivo := 'garantia, capacidade e checklist mínimo atendidos';
  elsif v_imovel_ok and not v_renda_ok and v_documentos_ok and v_pendencias_ok then
    v_classificacao := 'double_aa'; v_confianca := 0.7500; v_motivo := 'garantia e checklist atendidos; renda requer estruturação';
  elsif v_imovel_exists then
    v_classificacao := 'estressado'; v_confianca := 0.5000; v_motivo := 'há potencial de operação, mas existem pendências para diligência';
  else
    v_classificacao := null; v_confianca := 0.2500; v_motivo := 'dados insuficientes para sugerir uma classe';
  end if;

  if v_sinal_juridico and coalesce((v_criterios->>'revisar_sinal_juridico')::boolean, true) then
    v_confianca := least(v_confianca, v_cfg.confianca_revisao);
  end if;
  v_peso := case v_classificacao when 'triple_a' then v_cfg.peso_triple_a when 'double_aa' then v_cfg.peso_double_aa when 'estressado' then v_cfg.peso_estressado else 0 end;

  if v_classificacao is not null and v_confianca >= v_cfg.confianca_distribuicao and not v_sinal_juridico then
    v_distribuido := public.admin_classificar_distribuir_proposta(p_proposta_id, v_classificacao, v_confianca, v_motivo, true);
    return v_distribuido || jsonb_build_object('evidencias', v_evidencias, 'pendencias', v_pendencias, 'versao_regra', v_cfg.classificador_versao, 'revisao_obrigatoria', false);
  end if;

  update public.propostas set classificacao_lead = v_classificacao, classificacao_peso = v_peso, classificacao_confianca = v_confianca,
    classificacao_motivo = v_motivo, classificado_em = now(), classificado_por = auth.uid(), distribuido_em = null,
    distribuicao_motivo = case when v_classificacao is null then 'aguardando revisão: dados insuficientes' else 'aguardando revisão humana antes da distribuição' end
    where id = p_proposta_id;
  perform public.registrar_audit('classificar_proposta_automatico', 'propostas', p_proposta_id, to_jsonb(v_proposta), jsonb_build_object('classificacao', v_classificacao, 'confianca', v_confianca, 'motivo', v_motivo, 'evidencias', v_evidencias, 'pendencias', v_pendencias, 'versao_regra', v_cfg.classificador_versao));
  return jsonb_build_object('proposta_id', p_proposta_id, 'classificacao', v_classificacao, 'peso', v_peso, 'confianca', v_confianca, 'distribuido', false, 'revisao_obrigatoria', true, 'motivo', v_motivo, 'evidencias', v_evidencias, 'pendencias', v_pendencias, 'versao_regra', v_cfg.classificador_versao);
end;
$$;

revoke all on function public.admin_classificar_proposta_automatico(uuid) from public;
grant execute on function public.admin_classificar_proposta_automatico(uuid) to authenticated;
