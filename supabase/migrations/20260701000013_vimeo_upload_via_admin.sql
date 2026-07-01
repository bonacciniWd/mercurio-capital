-- Fase Vimeo reconexao: upload via painel admin + health real com token.
-- Atualiza catalogo para exigir secret de acesso da API Vimeo.

insert into public.integracoes_config
  (chave, nome, categoria, descricao, provider, secrets_requeridas, docs_url, restricao_plataforma, ordem)
values
  (
    'vimeo',
    'Vimeo Pro',
    'Mídia',
    'Upload de aulas da Universidade via painel admin/universidade (edge vimeo-upload-init + TUS direto no Vimeo).',
    'Vimeo',
    array['VIMEO_ACCESS_TOKEN'],
    'https://developer.vimeo.com',
    null,
    110
  )
on conflict (chave) do update
set
  nome = excluded.nome,
  categoria = excluded.categoria,
  descricao = excluded.descricao,
  provider = excluded.provider,
  secrets_requeridas = excluded.secrets_requeridas,
  docs_url = excluded.docs_url,
  ordem = excluded.ordem,
  ultimo_status = case when public.integracoes_config.ativo then 'pendente' else 'desconectado' end,
  ultima_checagem = null,
  ultimo_erro = null,
  latencia_ms = null,
  updated_at = now();
