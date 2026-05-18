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
  -- IP via header forwarded
  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
      'unknown'
    );
  exception when others then
    v_ip := 'unknown';
  end;

  v_key := 'consulta_protocolo::' || v_ip || '::' || coalesce(p_codigo, '');

  -- Rate-limit: máximo 5 chamadas / 60s
  select coalesce(sum(contagem), 0)::int into v_total
    from rate_limits
   where chave = v_key
     and janela_inicio > now() - interval '60 seconds';

  if v_total >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Janela arredondada para 10s para agrupar inserções
  v_janela := to_timestamp(floor(extract(epoch from now()) / 10) * 10);

  insert into rate_limits(chave, contagem, janela_inicio)
       values (v_key, 1, v_janela)
  on conflict (chave, janela_inicio)
    do update set contagem = rate_limits.contagem + 1;

  -- Captcha (placeholder; verificação real via Edge Function futura)
  if p_captcha_token is not null then
    null;
  end if;

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
grant execute on function public.public_consulta_protocolo(text, text) to anon, authenticated;
