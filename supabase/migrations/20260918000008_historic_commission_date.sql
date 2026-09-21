-- Allows an authorized admin to correct the historical commission-entry date
-- without changing the proposal's current status or updated_at.
create or replace function public.admin_corrigir_entrada_pagamento_comissao(
  p_proposta_id uuid,
  p_data date,
  p_motivo text
)
returns void language plpgsql security definer set search_path=public as $$
declare v_proposta public.propostas%rowtype; v_anterior jsonb;
begin
  if not public.app_is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_data is null or p_data > current_date then raise exception 'data_invalida'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 5 then raise exception 'motivo_obrigatorio'; end if;
  select * into v_proposta from public.propostas where id=p_proposta_id for update;
  if not found then raise exception 'proposta_nao_encontrada'; end if;
  if v_proposta.status not in ('pagamento_comissao','completo') then raise exception 'status_incompativel'; end if;
  if p_data < (v_proposta.created_at at time zone 'America/Sao_Paulo')::date then raise exception 'data_anterior_a_criacao'; end if;
  select to_jsonb(h) into v_anterior from public.proposta_status_historico h
    where h.proposta_id=p_proposta_id and h.metadata->>'correcao_historica'='true'
    order by h.created_at desc limit 1;
  delete from public.proposta_status_historico
    where proposta_id=p_proposta_id and metadata->>'correcao_historica'='true';
  insert into public.proposta_status_historico(proposta_id,status_anterior,status_novo,alterado_por,motivo,metadata,created_at)
    values(p_proposta_id,null,'pagamento_comissao',auth.uid(),btrim(p_motivo),
      jsonb_build_object('correcao_historica',true,'data_corrigida',p_data),p_data::timestamp at time zone 'America/Sao_Paulo');
  perform public.registrar_audit('corrigir_entrada_pagamento_comissao','proposta_status_historico',p_proposta_id,
    v_anterior,jsonb_build_object('data',p_data,'motivo',btrim(p_motivo)));
end; $$;
revoke all on function public.admin_corrigir_entrada_pagamento_comissao(uuid,date,text) from public;
grant execute on function public.admin_corrigir_entrada_pagamento_comissao(uuid,date,text) to authenticated;
