-- =============================================
-- FIX/FEATURE: Peek público de convite de membro
-- Data: 2026-07-06
-- =============================================

create or replace function public.membro_peek_convite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_link magic_links;
begin
  if length(coalesce(p_token, '')) < 20 then
    raise exception 'convite invalido ou expirado' using errcode = 'P0001';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select *
    into v_link
    from magic_links
   where token_hash = v_hash
     and used_at is null
     and expires_at > now()
     and finalidade = 'membro_convite'
   limit 1;

  if v_link.id is null then
    raise exception 'convite invalido ou expirado' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'email', lower(v_link.payload->>'email'),
    'nome', v_link.payload->>'nome',
    'equipe_id', v_link.payload->>'equipe_id',
    'expires_at', v_link.expires_at
  );
end;
$$;

revoke all on function public.membro_peek_convite(text) from public;
grant execute on function public.membro_peek_convite(text) to anon, authenticated;
