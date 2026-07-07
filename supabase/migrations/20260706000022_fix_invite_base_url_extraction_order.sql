-- =============================================
-- HARDENING: corrige ordem interna de extracao de URL por chave
-- Data: 2026-07-06
-- =============================================

create or replace function public.partner_invite_membro(
  p_equipe_id uuid,
  p_email text,
  p_nome text,
  p_papel_equipe text default 'membro',
  p_permissoes jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role                  text := public.app_user_role();
  v_partner_id            uuid := public.app_partner_id();
  v_token                 text;
  v_hash                  text;
  v_ttl_min               int;
  v_payload               jsonb;
  v_magic_link_id         uuid;
  v_equipe_nome           text;
  v_partner_razao_social  text;
  v_partner_nome          text;
  v_partner_exibicao      text;
  v_base_url              text := 'https://mercuriocapitalsa.com.br';
  v_convite_link          text;
  v_template_codigo       text := 'convite_equipe_v1_fallback';
  v_template_assunto      text;
  v_template_corpo        text;
  v_template_vars         jsonb;
  v_assunto               text;
  v_corpo                 text;
  v_email_status          text := 'nao_enfileirado';
  v_email_erro            text;
begin
  if p_papel_equipe not in ('admin_equipe', 'membro') then
    raise exception 'papel invalido';
  end if;

  if length(coalesce(trim(p_email), '')) < 5 then
    raise exception 'email invalido';
  end if;

  if not (v_role = 'admin' or (v_role = 'partner' and exists (
    select 1 from public.equipes where id = p_equipe_id and partner_id = v_partner_id
  ))) then
    raise exception 'sem permissao para convidar nesta equipe';
  end if;

  select
    e.nome,
    p.razao_social,
    u.nome_completo
  into
    v_equipe_nome,
    v_partner_razao_social,
    v_partner_nome
  from public.equipes e
  join public.partners p on p.id = e.partner_id
  join public.usuarios u on u.id = p.usuario_id
  where e.id = p_equipe_id
  limit 1;

  if v_equipe_nome is null then
    raise exception 'equipe nao encontrada';
  end if;

  -- invalida convites pendentes anteriores para o mesmo email/equipe
  update public.magic_links
     set used_at = now()
   where finalidade = 'membro_convite'
     and used_at is null
     and (payload->>'equipe_id')::uuid = p_equipe_id
     and lower(payload->>'email') = lower(trim(p_email));

  select coalesce((valor)::int, 30) into v_ttl_min
    from public.configuracoes_sistema
   where chave = 'magic_link_ttl_min';

  v_token := public.gen_magic_token(40);
  v_hash  := encode(digest(v_token, 'sha256'), 'hex');

  v_payload := jsonb_build_object(
    'equipe_id',    p_equipe_id,
    'email',        lower(trim(p_email)),
    'nome',         coalesce(nullif(trim(p_nome), ''), split_part(p_email, '@', 1)),
    'papel_equipe', p_papel_equipe,
    'permissoes',   p_permissoes
  );

  insert into public.magic_links (token_hash, finalidade, payload, expires_at, created_by)
  values (
    v_hash,
    'membro_convite',
    v_payload,
    now() + make_interval(mins => least(v_ttl_min, 30)),
    auth.uid()
  )
  returning id into v_magic_link_id;

  begin
    select x.url
      into v_base_url
      from (
        select
          1 as prioridade,
          coalesce(
            nullif(trim(c.valor->>'url'), ''),
            nullif(trim(c.valor->>'app_url'), ''),
            nullif(trim(c.valor #>> '{}'), '')
          ) as url
        from public.configuracoes_sistema c
        where c.chave = 'app_url'

        union all

        select
          2 as prioridade,
          coalesce(
            nullif(trim(c.valor->>'url'), ''),
            nullif(trim(c.valor->>'app_url'), ''),
            nullif(trim(c.valor #>> '{}'), '')
          ) as url
        from public.configuracoes_sistema c
        where c.chave = 'site_url'

        union all

        select
          3 as prioridade,
          coalesce(
            nullif(trim(c.valor->>'url'), ''),
            nullif(trim(c.valor->>'app_url'), ''),
            nullif(trim(c.valor #>> '{}'), '')
          ) as url
        from public.configuracoes_sistema c
        where c.chave = 'frontend_url'
      ) as x
     where x.url is not null
     order by x.prioridade
     limit 1;
  exception when others then
    v_base_url := 'https://mercuriocapitalsa.com.br';
  end;

  v_base_url := coalesce(
    nullif(regexp_replace(coalesce(v_base_url, ''), '/+$', ''), ''),
    'https://mercuriocapitalsa.com.br'
  );

  v_partner_exibicao := coalesce(
    nullif(trim(v_partner_razao_social), ''),
    nullif(trim(v_partner_nome), ''),
    'Mercurio Capital'
  );

  v_convite_link := v_base_url || '/convite/' || v_token;

  v_template_vars := jsonb_build_object(
    'nome', coalesce(v_payload->>'nome', split_part(v_payload->>'email', '@', 1)),
    'email', v_payload->>'email',
    'parceiro_exibicao', v_partner_exibicao,
    'equipe_nome', v_equipe_nome,
    'convite_link', v_convite_link,
    'expires_in_min', least(v_ttl_min, 30)
  );

  -- Template dinamico com fallback textual para nao bloquear o convite.
  begin
    select t.codigo, t.assunto, t.corpo
      into v_template_codigo, v_template_assunto, v_template_corpo
      from public.templates_mensagem t
     where t.codigo = 'convite_equipe_v1'
       and t.canal = 'email'
       and t.ativo
     limit 1;

    if found then
      v_assunto := coalesce(public.render_template(v_template_assunto, v_template_vars), '');
      v_corpo := coalesce(public.render_template(v_template_corpo, v_template_vars), '');
    end if;
  exception when others then
    v_assunto := '';
    v_corpo := '';
  end;

  if length(coalesce(trim(v_assunto), '')) = 0 then
    v_assunto := public.render_template(
      'Você foi convidado para o time {{equipe_nome}}',
      v_template_vars
    );
  end if;

  if length(coalesce(trim(v_corpo), '')) = 0 then
    v_corpo := public.render_template(
      E'<p>Olá {{nome}},</p>\n<p>Você foi convidado por <b>{{parceiro_exibicao}}</b> para se juntar ao time <b>{{equipe_nome}}</b>.</p>\n<p>Acesse o link de convite e crie sua conta (se não possuir).</p>\n<p><a href="{{convite_link}}">Aceitar convite</a></p>\n<p>Bem-vindo à Mercúrio Capital.</p>',
      v_template_vars
    );
  end if;

  begin
    insert into public.email_outbox (
      destinatario,
      usuario_id,
      assunto,
      corpo,
      origem,
      referencia_id,
      metadata
    )
    values (
      v_payload->>'email',
      null,
      v_assunto,
      v_corpo,
      'transacional',
      v_magic_link_id,
      jsonb_build_object(
        'evento', 'convite_equipe',
        'template', v_template_codigo,
        'equipe_id', p_equipe_id,
        'parceiro_exibicao', v_partner_exibicao
      )
    );

    v_email_status := 'enfileirado';
  exception when others then
    v_email_status := 'falha_enqueue';
    v_email_erro := left(sqlerrm, 300);
  end;

  return jsonb_build_object(
    'convite_token', v_token,
    'equipe_id', p_equipe_id,
    'email', v_payload->>'email',
    'expires_in_min', least(v_ttl_min, 30),
    'email_status', v_email_status
  ) || case
    when v_email_erro is not null then jsonb_build_object('email_erro', v_email_erro)
    else '{}'::jsonb
  end;
end;
$$;

revoke all on function public.partner_invite_membro(uuid, text, text, text, jsonb) from public;
grant execute on function public.partner_invite_membro(uuid, text, text, text, jsonb) to authenticated;