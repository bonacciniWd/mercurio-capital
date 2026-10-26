-- =============================================
-- FASE 37 — Reemissão de magic link por e-mail
-- =============================================
-- A RPC de reemissão gera o token customizado. Esta função apenas monta o
-- e-mail transacional enquanto o token plaintext ainda está disponível na Edge
-- Function e enfileira o envio no dispatcher/Resend.

create or replace function public.enqueue_proposta_magic_link_reissue_email(
  p_proposta_id uuid,
  p_magic_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row      record;
  v_template public.templates_mensagem%rowtype;
  v_vars     jsonb;
  v_link     text;
  v_assunto  text;
  v_corpo    text;
begin
  if length(coalesce(trim(p_magic_token), '')) = 0 then
    return jsonb_build_object(
      'email_status', 'falha_enqueue',
      'email_erro', 'magic_token_ausente'
    );
  end if;

  select
    p.id,
    p.protocolo,
    p.produto::text as produto,
    p.valor_solicitado,
    c.usuario_id,
    c.nome_completo as cliente_nome,
    nullif(trim(c.email), '') as cliente_email
  into v_row
  from public.propostas p
  join public.clientes c on c.id = p.cliente_id
  where p.id = p_proposta_id;

  if not found then
    return jsonb_build_object(
      'email_status', 'falha_enqueue',
      'email_erro', 'proposta_nao_encontrada'
    );
  end if;

  if v_row.cliente_email is null then
    return jsonb_build_object(
      'email_status', 'nao_enfileirado',
      'email_motivo', 'cliente_sem_email'
    );
  end if;

  select * into v_template
    from public.templates_mensagem
   where codigo = 'proposta_cliente_magic_link_v1'
     and canal = 'email'
     and ativo
   limit 1;

  if not found then
    return jsonb_build_object(
      'email_status', 'falha_enqueue',
      'email_erro', 'template_inativo_ou_ausente'
    );
  end if;

  v_link := public.public_app_base_url() || '/c/proposta/' || p_magic_token;
  v_vars := jsonb_build_object(
    'cliente_nome', v_row.cliente_nome,
    'protocolo', v_row.protocolo,
    'produto', v_row.produto,
    'valor_solicitado', 'R$ ' || trim(to_char(v_row.valor_solicitado, 'FM999G999G999G990D00')),
    'magic_link', v_link,
    'expires_in_min', 30
  );
  v_assunto := public.render_template(v_template.assunto, v_vars);
  v_corpo := public.render_template(v_template.corpo, v_vars);

  insert into public.email_outbox (
    destinatario,
    usuario_id,
    assunto,
    corpo,
    origem,
    referencia_id,
    metadata
  ) values (
    v_row.cliente_email,
    v_row.usuario_id,
    v_assunto,
    v_corpo,
    'transacional',
    p_proposta_id,
    jsonb_build_object(
      'evento', 'proposta_magic_link_reissue',
      'proposta_id', p_proposta_id,
      'protocolo', v_row.protocolo,
      'template', v_template.codigo
    )
  );

  return jsonb_build_object('email_status', 'enfileirado');
exception when others then
  return jsonb_build_object(
    'email_status', 'falha_enqueue',
    'email_erro', left(sqlerrm, 300)
  );
end;
$$;

revoke all on function public.enqueue_proposta_magic_link_reissue_email(uuid, text) from public;
grant execute on function public.enqueue_proposta_magic_link_reissue_email(uuid, text) to service_role;
