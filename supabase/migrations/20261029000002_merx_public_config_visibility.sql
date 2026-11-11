create or replace function public.public_merx_config_obter()
returns jsonb language sql security definer set search_path = public
as $$
  select (
    select jsonb_build_object(
      'habilitado', coalesce((valor->>'habilitado')::boolean, false),
      'captacao_habilitada', coalesce((valor->>'captacao_habilitada')::boolean, false),
      'saudacao', coalesce(valor->>'saudacao', 'Como posso ajudar?'),
      'mensagem_sem_resposta', coalesce(valor->>'mensagem_sem_resposta', 'Ainda não encontrei essa informação no FAQ público.')
    )
    from public.configuracoes_sistema
    where chave = 'merx_publica'
  );
$$;

revoke all on function public.public_merx_config_obter() from public, anon, authenticated;
grant execute on function public.public_merx_config_obter() to anon, authenticated;