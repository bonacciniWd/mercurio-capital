-- =============================================
-- MIGRATION — FUNDOS · RPCs (escrita via SECURITY DEFINER + auditoria)
-- =============================================
-- Guard app_is_admin() em todas. Toda escrita grava audit_log.

-- ---------------------------------------------------------------
-- admin_fundo_upsert — cria ou atualiza um fundo (nome + cor)
-- ---------------------------------------------------------------
create or replace function public.admin_fundo_upsert(
  p_id    uuid,
  p_nome  text,
  p_cor   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cor  text := btrim(coalesce(p_cor, ''));
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if length(v_nome) < 2 then
    raise exception 'nome_invalido' using errcode = '22023';
  end if;

  if v_cor !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'cor_invalida' using errcode = '22023', hint = 'use #RRGGBB';
  end if;

  begin
    if p_id is null then
      insert into public.fundos (nome, cor_hex, created_by)
      values (v_nome, v_cor, auth.uid())
      returning id into v_id;
    else
      update public.fundos
         set nome = v_nome,
             cor_hex = v_cor
       where id = p_id
      returning id into v_id;

      if v_id is null then
        raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'fundo_nome_duplicado' using errcode = '23505';
  end;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    case when p_id is null then 'fundo_criado' else 'fundo_atualizado' end,
    'fundos',
    v_id,
    jsonb_build_object('nome', v_nome, 'cor_hex', v_cor)
  );

  return v_id;
end;
$$;

revoke all on function public.admin_fundo_upsert(uuid, text, text) from public;
grant execute on function public.admin_fundo_upsert(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------
-- admin_fundo_toggle_ativo — ativa/inativa um fundo
-- ---------------------------------------------------------------
create or replace function public.admin_fundo_toggle_ativo(
  p_id     uuid,
  p_ativo  boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.fundos
     set ativo = coalesce(p_ativo, true)
   where id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (auth.uid(), 'fundo_ativo_alterado', 'fundos', v_id, jsonb_build_object('ativo', coalesce(p_ativo, true)));
end;
$$;

revoke all on function public.admin_fundo_toggle_ativo(uuid, boolean) from public;
grant execute on function public.admin_fundo_toggle_ativo(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------
-- admin_proposta_fundo_set — atribui fundo à proposta / troca status
-- ---------------------------------------------------------------
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
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.propostas p where p.id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.fundos f where f.id = p_fundo_id) then
    raise exception 'fundo_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.proposta_fundos (proposta_id, fundo_id, status_fundo, observacao, atribuido_por)
  values (p_proposta_id, p_fundo_id, coalesce(p_status, 'aguardando'), nullif(btrim(coalesce(p_obs, '')), ''), auth.uid())
  on conflict (proposta_id, fundo_id) do update
     set status_fundo = excluded.status_fundo,
         observacao   = excluded.observacao,
         atribuido_por = auth.uid();

  insert into public.audit_log (usuario_id, acao, entidade, entidade_id, payload_depois)
  values (
    auth.uid(),
    'proposta_fundo_set',
    'proposta_fundos',
    p_proposta_id,
    jsonb_build_object('fundo_id', p_fundo_id, 'status_fundo', coalesce(p_status, 'aguardando'))
  );
end;
$$;

revoke all on function public.admin_proposta_fundo_set(uuid, uuid, public.fundo_status, text) from public;
grant execute on function public.admin_proposta_fundo_set(uuid, uuid, public.fundo_status, text) to authenticated;

-- ---------------------------------------------------------------
-- admin_proposta_fundo_remove — remove a atribuição de um fundo
-- ---------------------------------------------------------------
create or replace function public.admin_proposta_fundo_remove(
  p_proposta_id  uuid,
  p_fundo_id     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
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
