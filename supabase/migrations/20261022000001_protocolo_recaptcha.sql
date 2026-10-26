-- Forward-only hardening: private lookup behind verified reCAPTCHA Edge.
create or replace function public.public_protocolo_rate_consume(p_chave text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_total bigint;
begin
  if p_chave is null or p_chave !~ '^protocolo-ip::[a-f0-9]{64}$' then
    raise exception 'invalid_rate_key';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave, 0));
  delete from rate_limits where chave = p_chave and janela_inicio <= now() - interval '60 seconds';
  select coalesce(sum(contagem), 0) into v_total from rate_limits where chave = p_chave;
  if v_total >= 5 then return false; end if;
  insert into rate_limits(chave, contagem, janela_inicio) values(p_chave, 1, clock_timestamp());
  return true;
end;
$$;
revoke all on function public.public_protocolo_rate_consume(text) from public, anon, authenticated;
grant execute on function public.public_protocolo_rate_consume(text) to service_role;

-- =============================================
-- MIGRATION 017 — Consulta pública por protocolo
-- Reaproveita a tabela rate_limits existente (chave/contagem/janela_inicio).
-- =============================================

create or replace function public.public_consulta_protocolo(
  p_codigo text,
  p_captcha_token text default null
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_ip      text;
  v_key     text;
  v_total   int;
  v_janela  timestamptz;
  v_row     propostas%rowtype;
  v_pendencias jsonb;
  v_historico  jsonb;
begin
  -- CAPTCHA and atomic per-IP rate limit enforced by the service-only Edge.
  select * into v_row
    from propostas
   where protocolo = p_codigo
   limit 1;

  if v_row.id is null then
    return jsonb_build_object('encontrado', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'descricao', descricao,
           'documento_solicitado_tipo', documento_solicitado_tipo,
           'status', status,
           'prazo', prazo,
           'created_at', created_at
         )), '[]'::jsonb)
    into v_pendencias
    from proposta_pendencias
   where proposta_id = v_row.id
     and status in ('aberta','em_analise');

  select coalesce(jsonb_agg(jsonb_build_object(
           'status_novo', status_novo,
           'status_anterior', status_anterior,
           'created_at', created_at
         ) order by created_at desc), '[]'::jsonb)
    into v_historico
    from proposta_status_historico
   where proposta_id = v_row.id;

  return jsonb_build_object(
    'encontrado', true,
    'protocolo', v_row.protocolo,
    'produto', v_row.produto,
    'status', v_row.status,
    'valor_solicitado', v_row.valor_solicitado,
    'prazo_meses', v_row.prazo_meses,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'pendencias', v_pendencias,
    'historico', v_historico
  );
end;
$$;

revoke all on function public.public_consulta_protocolo(text, text) from public;
revoke all on function public.public_consulta_protocolo(text, text) from anon, authenticated;
grant execute on function public.public_consulta_protocolo(text, text) to service_role;
