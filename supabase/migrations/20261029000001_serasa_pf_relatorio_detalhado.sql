-- Persist the allowlisted PF report privately and provide proposal-scoped reads.
-- Existing response JSON remains untouched; historical v1/v2 summaries stay partial.

alter table public.serasa_relatorios_config
  add column if not exists features_pf text[] not null default '{}',
  add column if not exists parametros_pf jsonb;

create or replace function public.admin_serasa_pf_features_atualizar(
  p_ambiente text,
  p_features text[],
  p_parametros jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_features text[] := coalesce(p_features, '{}');
  v_param jsonb;
  v_name text;
  v_value text;
  v_allowed text[];
begin
  if auth.uid() is null or not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_ambiente not in ('uat', 'producao') then raise exception 'ambiente_invalido'; end if;
  if cardinality(v_features) > 2
     or exists (select 1 from unnest(v_features) as items(feature) where feature not in ('SCORE', 'RENDA_MAIS'))
     or cardinality(v_features) <> (select count(distinct feature) from unnest(v_features) as items(feature)) then
    raise exception 'serasa_features_pf_invalidas';
  end if;
  if p_parametros is not null then
    if jsonb_typeof(p_parametros) <> 'object'
       or (select count(*) from jsonb_object_keys(p_parametros)) <> 1
       or jsonb_typeof(p_parametros->'reportParameters') <> 'array'
       or jsonb_array_length(p_parametros->'reportParameters') <> cardinality(v_features)
       or (select count(distinct item->>'name') from jsonb_array_elements(p_parametros->'reportParameters') as params(item)) <> cardinality(v_features) then
      raise exception 'serasa_parametros_pf_invalidos';
    end if;
    for v_param in select value from jsonb_array_elements(p_parametros->'reportParameters') loop
      v_name := v_param->>'name';
      v_value := v_param->>'value';
      if v_name = 'SCORE' then
        v_allowed := array['HSPN', 'HSV4', 'HRLD', 'HRLN', 'HRLB'];
      elsif v_name = 'RENDA_MAIS' then
        v_allowed := array['HRM5'];
      else
        raise exception 'serasa_parametros_pf_invalidos';
      end if;
      if not (v_name = any(v_features)) or not (v_value = any(v_allowed)) then
        raise exception 'serasa_parametros_pf_invalidos';
      end if;
    end loop;
  elsif cardinality(v_features) > 0 then
    raise exception 'serasa_parametros_pf_invalidos';
  end if;

  select jsonb_build_object('features_pf', features_pf, 'parametros_pf', parametros_pf)
    into v_before from public.serasa_relatorios_config where ambiente = p_ambiente for update;
  if not found then raise exception 'configuracao_serasa_nao_encontrada'; end if;
  update public.serasa_relatorios_config
     set features_pf = v_features,
         parametros_pf = p_parametros,
         atualizado_por = auth.uid(),
         atualizado_em = now()
   where ambiente = p_ambiente;
  v_after := jsonb_build_object('features_pf', v_features, 'parametros_pf', p_parametros);
  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois)
  values (auth.uid(), 'serasa_pf_features_atualizadas', 'serasa_relatorios_config', null,
          v_before, v_after);
end;
$$;

revoke all on function public.admin_serasa_pf_features_atualizar(text, text[], jsonb) from public, anon;
grant execute on function public.admin_serasa_pf_features_atualizar(text, text[], jsonb) to authenticated;

create or replace function public.consulta_relatorio_obter(p_log_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_role text := public.app_user_role();
  v_response jsonb;
begin
  if auth.uid() is null
     or v_role not in ('admin', 'partner', 'team_member')
     or not exists (select 1 from public.usuarios u where u.id = auth.uid() and u.ativo) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_role <> 'admin' and not public.app_is_approved() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select l.response into v_response
    from public.logs_consultas l
    join public.propostas p on p.id = l.proposta_id
    join public.proponentes pr on pr.id = l.proponente_id and pr.proposta_id = l.proposta_id
   where l.id = p_log_id
     and l.tipo = 'serasa_pf'
     and l.status = 'concluida'
     and (public.app_is_admin()
       or (v_role = 'partner' and p.partner_id = public.app_partner_id())
       or (v_role = 'team_member' and p.equipe_id = public.app_equipe_id()));
  if not found then raise exception 'relatorio_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;

  if v_response->>'source' is distinct from 'serasa_experian'
     or v_response->>'normalizerVersion' is distinct from '3' then
    return jsonb_build_object('legacy', true);
  end if;
  return v_response;
end;
$$;

revoke all on function public.consulta_relatorio_obter(uuid) from public, anon;
grant execute on function public.consulta_relatorio_obter(uuid) to authenticated;

comment on function public.consulta_relatorio_obter(uuid) is
  'Returns an allowlisted normalized Serasa PF report only to active admins or approved users with access to the report proposal; clients and direct response-column reads remain denied.';
