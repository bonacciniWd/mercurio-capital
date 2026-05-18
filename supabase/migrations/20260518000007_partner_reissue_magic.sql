-- =============================================
-- MIGRATION 019 — reemissão de magic-link de proposta
-- =============================================

create or replace function public.partner_reissue_magic_link(p_proposta_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_role        text := public.app_user_role();
  v_partner_id  uuid := public.app_partner_id();
  v_equipe_id   uuid := public.app_equipe_id();
  v_proposta    propostas%rowtype;
  v_cliente_id  uuid;
  v_token       text;
  v_hash        text;
  v_ttl_min     int;
begin
  -- precisa ser parceiro/admin/team_member e dono da proposta
  if v_role not in ('admin','partner','team_member') then
    raise exception 'sem permissao';
  end if;

  select * into v_proposta from propostas where id = p_proposta_id;
  if v_proposta.id is null then
    raise exception 'proposta nao encontrada';
  end if;

  if v_role <> 'admin'
     and v_proposta.partner_id <> v_partner_id
     and v_proposta.equipe_id is distinct from v_equipe_id then
    raise exception 'proposta nao pertence ao parceiro';
  end if;

  v_cliente_id := v_proposta.cliente_id;
  if v_cliente_id is null then
    raise exception 'proposta nao possui cliente vinculado';
  end if;

  -- invalida tokens anteriores não usados da mesma proposta
  update magic_links
     set used_at = now()
   where finalidade = 'cliente_ativacao'
     and used_at is null
     and (payload->>'proposta_id')::uuid = p_proposta_id;

  -- TTL via configuracoes_sistema (fallback 30 min)
  select coalesce((valor)::int, 30) into v_ttl_min
    from configuracoes_sistema
   where chave = 'magic_link_ttl_min';

  v_token := public.gen_magic_token(40);
  v_hash  := encode(digest(v_token, 'sha256'), 'hex');

  insert into magic_links (token_hash, finalidade, payload, expires_at, created_by)
  values (
    v_hash,
    'cliente_ativacao',
    jsonb_build_object('proposta_id', p_proposta_id, 'cliente_id', v_cliente_id),
    now() + make_interval(mins => least(v_ttl_min, 30)),
    auth.uid()
  );

  return jsonb_build_object(
    'magic_token', v_token,
    'proposta_id', p_proposta_id,
    'protocolo',   v_proposta.protocolo,
    'expires_in_min', least(v_ttl_min, 30)
  );
end;
$$;

revoke all on function public.partner_reissue_magic_link(uuid) from public;
grant execute on function public.partner_reissue_magic_link(uuid) to authenticated;
