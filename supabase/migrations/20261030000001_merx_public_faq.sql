-- Admin-configurable deterministic FAQ for the public MERX widget.
-- Only the allowlisted FAQ fields are exposed to anonymous visitors.

create or replace function public.admin_merx_publica_obter()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select valor into v_config
  from public.configuracoes_sistema
  where chave = 'merx_publica';

  return coalesce(v_config, jsonb_build_object(
    'habilitado', false,
    'captacao_habilitada', false,
    'saudacao', 'Como posso ajudar?',
    'mensagem_sem_resposta', 'Ainda não encontrei essa informação no FAQ público.',
    'faq', '[]'::jsonb
  ));
end;
$$;

create or replace function public.admin_merx_publica_salvar(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_faq jsonb := '[]'::jsonb;
  v_item jsonb;
  v_keywords jsonb;
  v_id text;
  v_question text;
  v_answer text;
  v_keyword text;
  v_keyword_json jsonb;
  v_count integer := 0;
  v_keyword_count integer;
begin
  if not public.app_is_admin_full() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_config) <> 'object' then
    raise exception 'config_invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_config->'faq') is distinct from 'array' then
    raise exception 'faq_invalid' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_config->'faq') loop
    v_count := v_count + 1;
    if v_count > 20 or jsonb_typeof(v_item) <> 'object' then
      raise exception 'faq_limit_or_item_invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item->'id') is distinct from 'string'
       or jsonb_typeof(v_item->'question') is distinct from 'string'
       or jsonb_typeof(v_item->'answer') is distinct from 'string'
       or jsonb_typeof(v_item->'keywords') is distinct from 'array' then
      raise exception 'faq_item_invalid' using errcode = '22023';
    end if;

    v_id := btrim(v_item->>'id');
    v_question := btrim(v_item->>'question');
    v_answer := btrim(v_item->>'answer');
    if char_length(v_id) not between 1 and 80
       or char_length(v_question) not between 1 and 100
       or char_length(v_answer) not between 1 and 1000 then
      raise exception 'faq_text_length_invalid' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(v_faq) prior(item) where prior.item->>'id' = v_id) then
      raise exception 'faq_id_duplicate' using errcode = '22023';
    end if;

    select count(*) into v_keyword_count
    from jsonb_array_elements(v_item->'keywords');
    if v_keyword_count not between 1 and 12 then
      raise exception 'faq_keywords_count_invalid' using errcode = '22023';
    end if;

    v_keywords := '[]'::jsonb;
    for v_keyword_json in select value from jsonb_array_elements(v_item->'keywords') as keywords(value) loop
      if jsonb_typeof(v_keyword_json) is distinct from 'string' then
        raise exception 'faq_keyword_invalid' using errcode = '22023';
      end if;
      v_keyword := btrim(v_keyword_json #>> '{}');
      if char_length(v_keyword) not between 1 and 80 then
        raise exception 'faq_keyword_invalid' using errcode = '22023';
      end if;
      v_keywords := v_keywords || jsonb_build_array(v_keyword);
    end loop;

    v_faq := v_faq || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'question', v_question,
      'answer', v_answer,
      'keywords', v_keywords
    ));
  end loop;

  if v_count = 0 then
    raise exception 'faq_required' using errcode = '22023';
  end if;

  v_config := jsonb_build_object(
    'habilitado', coalesce((p_config->>'habilitado')::boolean, false),
    'captacao_habilitada', coalesce((p_config->>'captacao_habilitada')::boolean, false),
    'saudacao', left(coalesce(p_config->>'saudacao', 'Como posso ajudar?'), 180),
    'mensagem_sem_resposta', left(coalesce(p_config->>'mensagem_sem_resposta', 'Ainda não encontrei essa informação no FAQ público.'), 500),
    'faq', v_faq
  );

  insert into public.configuracoes_sistema(chave, valor, updated_by, updated_at)
  values ('merx_publica', v_config, auth.uid(), now())
  on conflict (chave) do update
    set valor = excluded.valor, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  return v_config;
end;
$$;

create or replace function public.public_merx_config_obter()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'habilitado', coalesce((valor->>'habilitado')::boolean, false),
    'captacao_habilitada', coalesce((valor->>'captacao_habilitada')::boolean, false),
    'saudacao', coalesce(valor->>'saudacao', 'Como posso ajudar?'),
    'mensagem_sem_resposta', coalesce(valor->>'mensagem_sem_resposta', 'Ainda não encontrei essa informação no FAQ público.'),
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item->>'id',
        'question', item->>'question',
        'answer', item->>'answer',
        'keywords', item->'keywords'
      ) order by ordinality)
      from jsonb_array_elements(case when jsonb_typeof(valor->'faq') = 'array' then valor->'faq' else '[]'::jsonb end)
        with ordinality as entries(item, ordinality)
      where jsonb_typeof(item) = 'object'
        and jsonb_typeof(item->'id') = 'string'
        and jsonb_typeof(item->'question') = 'string'
        and jsonb_typeof(item->'answer') = 'string'
        and jsonb_typeof(item->'keywords') = 'array'
    ), '[]'::jsonb)
  )
  from public.configuracoes_sistema
  where chave = 'merx_publica';
$$;

revoke all on function public.admin_merx_publica_obter() from public, anon, authenticated;
revoke all on function public.admin_merx_publica_salvar(jsonb) from public, anon, authenticated;
revoke all on function public.public_merx_config_obter() from public, anon, authenticated;
grant execute on function public.admin_merx_publica_obter() to authenticated;
grant execute on function public.admin_merx_publica_salvar(jsonb) to authenticated;
grant execute on function public.public_merx_config_obter() to anon, authenticated;
