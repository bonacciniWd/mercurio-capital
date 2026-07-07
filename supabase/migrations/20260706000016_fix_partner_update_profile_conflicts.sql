-- =============================================
-- FIX — partner_update_profile (normalização + conflitos)
-- Data: 2026-07-06
-- =============================================

create or replace function public.partner_update_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_cpf text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_pid from public.partners where usuario_id = v_uid;
  if v_pid is null then
    raise exception 'partner_not_found';
  end if;

  v_cpf := case
    when p_payload ? 'cpf' then nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '\\D', '', 'g'), '')
    else null
  end;

  update public.usuarios
     set nome_completo = coalesce(nullif(btrim(p_payload->>'nome'), ''), nome_completo),
         telefone      = case
                           when p_payload ? 'telefone' then nullif(btrim(p_payload->>'telefone'), '')
                           else telefone
                         end,
         telefone_ddi  = coalesce(nullif(btrim(p_payload->>'telefone_ddi'), ''), telefone_ddi),
         avatar_url    = case
                           when p_payload ? 'avatar_url' then nullif(btrim(p_payload->>'avatar_url'), '')
                           else avatar_url
                         end
   where id = v_uid;

  update public.partners
     set razao_social         = coalesce(nullif(btrim(p_payload->>'razao_social'), ''), razao_social),
         cpf                  = case when p_payload ? 'cpf' then v_cpf else cpf end,
         website              = case
                                  when p_payload ? 'website' then nullif(btrim(p_payload->>'website'), '')
                                  else website
                                end,
         endereco_cep         = case
                                  when p_payload ? 'endereco_cep' then nullif(btrim(p_payload->>'endereco_cep'), '')
                                  else endereco_cep
                                end,
         endereco_logradouro  = case
                                  when p_payload ? 'endereco_logradouro' then nullif(btrim(p_payload->>'endereco_logradouro'), '')
                                  else endereco_logradouro
                                end,
         endereco_numero      = case
                                  when p_payload ? 'endereco_numero' then nullif(btrim(p_payload->>'endereco_numero'), '')
                                  else endereco_numero
                                end,
         endereco_complemento = case
                                  when p_payload ? 'endereco_complemento' then nullif(btrim(p_payload->>'endereco_complemento'), '')
                                  else endereco_complemento
                                end,
         endereco_bairro      = case
                                  when p_payload ? 'endereco_bairro' then nullif(btrim(p_payload->>'endereco_bairro'), '')
                                  else endereco_bairro
                                end,
         endereco_cidade      = case
                                  when p_payload ? 'endereco_cidade' then nullif(btrim(p_payload->>'endereco_cidade'), '')
                                  else endereco_cidade
                                end,
         endereco_estado      = case
                                  when p_payload ? 'endereco_estado' then nullif(upper(btrim(p_payload->>'endereco_estado')), '')
                                  else endereco_estado
                                end
   where id = v_pid;

  return public.partner_get_profile();

exception
  when unique_violation then
    if position('partners_cpf_key' in coalesce(SQLERRM, '')) > 0 then
      raise exception using
        errcode = '23505',
        message = 'CPF/CNPJ já está vinculado a outro parceiro.';
    end if;
    raise;
end;
$$;

revoke all on function public.partner_update_profile(jsonb) from public;
grant execute on function public.partner_update_profile(jsonb) to authenticated;
