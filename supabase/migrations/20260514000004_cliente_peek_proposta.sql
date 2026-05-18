-- =============================================
-- MIGRATION 013 — cliente_peek_proposta (preview público via magic token)
-- =============================================
-- Permite ao cliente visualizar dados básicos da proposta SEM consumir o token.
-- O `cliente_consume_magic` continua sendo chamado quando o cliente autentica.

create or replace function public.cliente_peek_proposta(p_token text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_hash         text;
  v_link         magic_links;
  v_proposta_id  uuid;
  v_result       jsonb;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_link from magic_links
    where token_hash = v_hash
      and used_at is null
      and expires_at > now()
      and finalidade = 'cliente_ativacao'
    limit 1;

  if v_link.id is null then
    raise exception 'token inválido ou expirado' using errcode = 'P0001';
  end if;

  v_proposta_id := (v_link.payload->>'proposta_id')::uuid;

  select jsonb_build_object(
    'proposta_id', p.id,
    'protocolo', p.protocolo,
    'produto', p.produto,
    'status', p.status,
    'valor_solicitado', p.valor_solicitado,
    'prazo_meses', p.prazo_meses,
    'cliente_nome', c.nome_completo,
    'cliente_email', c.email,
    'expires_at', v_link.expires_at,
    'partner_id', p.partner_id
  ) into v_result
  from propostas p
  left join clientes c on c.id = p.cliente_id
  where p.id = v_proposta_id;

  return v_result;
end;
$$;

revoke all on function public.cliente_peek_proposta(text) from public;
grant execute on function public.cliente_peek_proposta(text) to authenticated, anon;
