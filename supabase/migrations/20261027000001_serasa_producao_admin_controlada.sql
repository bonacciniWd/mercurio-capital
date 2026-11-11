-- Permite que um administrador habilite produção deliberadamente, mantendo
-- o estado inativo como padrão e impedindo PJ sem segmentCode validado.
create or replace function public.admin_serasa_relatorio_config_atualizar(
  p_ambiente text,
  p_ativo boolean,
  p_segment_code text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ambiente not in ('uat', 'producao') then raise exception 'ambiente_invalido'; end if;
  if p_segment_code is not null and p_segment_code !~ '^[0-9]{3}$' then
    raise exception 'segment_code_pj_invalido';
  end if;
  if p_ambiente = 'uat' and p_ativo and p_segment_code is null then
    raise exception 'segment_code_pj_obrigatorio';
  end if;
  if p_ambiente = 'producao' and p_ativo and not exists (
    select 1 from public.serasa_relatorios_config c
     where c.ambiente = 'producao'
       and c.report_pf = 'RELATORIO_AVANCADO_PF'
  ) then
    raise exception 'serasa_relatorio_pf_nao_configurado';
  end if;

  update public.serasa_relatorios_config
     set ativo = p_ativo,
         parametros_pj = case
           when p_ambiente = 'producao' and p_ativo and p_segment_code is null then null
           when p_segment_code is null then parametros_pj
           else jsonb_build_object('reportParameters', jsonb_build_array(
             jsonb_build_object('name', 'segmentCode', 'value', p_segment_code)))
         end,
         atualizado_por = auth.uid(),
         atualizado_em = now()
   where ambiente = p_ambiente;
  if not found then raise exception 'configuracao_serasa_nao_encontrada'; end if;
end;
$$;

revoke all on function public.admin_serasa_relatorio_config_atualizar(text, boolean, text) from public, anon;
grant execute on function public.admin_serasa_relatorio_config_atualizar(text, boolean, text) to authenticated;
