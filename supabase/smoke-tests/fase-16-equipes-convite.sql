-- =============================================
-- FASE 16 SMOKE — Convites de Equipe (search_path + digest + enqueue email)
-- =============================================
-- Roda em transação reversível: nenhum dado fica persistido.

begin;

do $$
declare
  v_invite_cfg text;
  v_accept_cfg text;
  v_peek_cfg text;
begin
  select coalesce(array_to_string(proconfig, ','), '')
    into v_invite_cfg
    from pg_proc
   where oid = 'public.partner_invite_membro(uuid,text,text,text,jsonb)'::regprocedure;

  select coalesce(array_to_string(proconfig, ','), '')
    into v_accept_cfg
    from pg_proc
   where oid = 'public.membro_accept_convite(text)'::regprocedure;

  select coalesce(array_to_string(proconfig, ','), '')
    into v_peek_cfg
    from pg_proc
   where oid = 'public.membro_peek_convite(text)'::regprocedure;

  if position('search_path=public, extensions' in v_invite_cfg) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: partner_invite_membro sem search_path com extensions';
  end if;

  if position('search_path=public, extensions' in v_accept_cfg) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: membro_accept_convite sem search_path com extensions';
  end if;

  if position('search_path=public, extensions' in v_peek_cfg) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: membro_peek_convite sem search_path com extensions';
  end if;

  perform encode(digest('mercurio-smoke', 'sha256'), 'hex');
end
$$;

do $$
declare
  v_partner_user uuid;
  v_partner_id uuid;
  v_equipe_id uuid;
  v_equipe_nome text := 'Smoke convite auto-email';
  v_invite jsonb;
  v_token text;
  v_email text;
  v_email_status text;
  v_email_erro text;
  v_magic_link_id uuid;
  v_outbox_id uuid;
  v_outbox_corpo text;
  v_outbox_assunto text;
  v_outbox_partner text;
begin
  select p.usuario_id, p.id
    into v_partner_user, v_partner_id
    from public.partners p
   where p.status in ('approved', 'pending')
   order by case when p.status = 'approved' then 0 else 1 end, p.created_at
   limit 1;

  if v_partner_user is null then
    raise exception 'FASE 16 SMOKE FAIL: sem parceiro para validar convite com email';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_partner_user::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('role', 'partner', 'approved', true, 'partner_id', v_partner_id::text)
    )::text,
    true
  );

  v_equipe_id := public.partner_create_equipe(v_equipe_nome, false);
  v_email := 'smoke-convite-' || replace(gen_random_uuid()::text, '-', '') || '@mercurio.test';

  v_invite := public.partner_invite_membro(
    p_equipe_id := v_equipe_id,
    p_email := v_email,
    p_nome := 'Smoke Convidado',
    p_papel_equipe := 'membro',
    p_permissoes := '{}'::jsonb
  );

  v_token := v_invite->>'convite_token';
  v_email_status := v_invite->>'email_status';
  v_email_erro := v_invite->>'email_erro';

  if v_token is null or length(v_token) < 20 then
    raise exception 'FASE 16 SMOKE FAIL: convite_token invalido no retorno';
  end if;

  if v_email_status <> 'enfileirado' then
    raise exception 'FASE 16 SMOKE FAIL: email_status inesperado (%), detalhe: %', coalesce(v_email_status, 'null'), coalesce(v_email_erro, 'sem detalhe');
  end if;

  select ml.id
    into v_magic_link_id
    from public.magic_links ml
   where ml.token_hash = encode(digest(v_token, 'sha256'), 'hex')
     and ml.finalidade = 'membro_convite'
     and ml.used_at is null
   order by ml.created_at desc
   limit 1;

  if v_magic_link_id is null then
    raise exception 'FASE 16 SMOKE FAIL: magic_link do convite nao encontrada';
  end if;

  select eo.id
    into v_outbox_id
    from public.email_outbox eo
   where lower(eo.destinatario) = lower(v_email)
     and eo.referencia_id = v_magic_link_id
     and eo.origem = 'transacional'
     and eo.metadata->>'evento' = 'convite_equipe'
   order by eo.created_at desc
   limit 1;

  if v_outbox_id is null then
    raise exception 'FASE 16 SMOKE FAIL: convite sem item correspondente no email_outbox';
  end if;

  select eo.corpo, eo.assunto, eo.metadata->>'parceiro_exibicao'
    into v_outbox_corpo, v_outbox_assunto, v_outbox_partner
    from public.email_outbox eo
   where eo.id = v_outbox_id;

  if position(v_equipe_id::text in coalesce(v_outbox_assunto, '')) > 0 then
    raise exception 'FASE 16 SMOKE FAIL: assunto do e-mail não deveria expor UUID da equipe';
  end if;

  if position('/convite/' || v_token in coalesce(v_outbox_corpo, '')) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: corpo do e-mail sem link válido de convite';
  end if;

  if position(v_equipe_nome in coalesce(v_outbox_corpo, '')) = 0
     and position(v_equipe_nome in coalesce(v_outbox_assunto, '')) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: e-mail sem equipe_nome';
  end if;

  if length(coalesce(trim(v_outbox_partner), '')) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: metadata do outbox sem parceiro_exibicao';
  end if;

  if position(v_outbox_partner in coalesce(v_outbox_corpo, '')) = 0 then
    raise exception 'FASE 16 SMOKE FAIL: corpo do e-mail sem parceiro_exibicao';
  end if;

  raise notice 'FASE 16 SMOKE: convite + enqueue OK (outbox_id=%)', v_outbox_id;
end
$$;

rollback;
