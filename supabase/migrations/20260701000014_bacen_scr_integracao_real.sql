-- Onda 1 (Bacen SCR): integração real via provedor homologado configurável.
-- Atualiza o catálogo de integrações para refletir a secret obrigatória de
-- endpoint do SCR. As demais secrets (client id/secret ou bearer) são opcionais
-- conforme o modo de autenticação e não bloqueiam o health por si só.

update public.integracoes_config
   set descricao = 'Consulta SCR (relacionamentos e endividamento) via provedor homologado. Integração real configurável por ambiente na edge consulta-executar.',
       secrets_requeridas = array['BACEN_SCR_API_URL'],
       ultimo_status = case when ativo then 'pendente' else 'desconectado' end,
       ultima_checagem = null,
       ultimo_erro = null,
       latencia_ms = null,
       updated_at = now()
 where chave = 'bacen';

-- Garante a entrada caso o ambiente não tenha o seed original.
insert into public.integracoes_config
  (chave, nome, categoria, descricao, provider, secrets_requeridas, docs_url, restricao_plataforma, ordem)
values
  ('bacen', 'Bacen SCR', 'Bureau',
   'Consulta SCR (relacionamentos e endividamento) via provedor homologado. Integração real configurável por ambiente na edge consulta-executar.',
   'Banco Central (SCR via provedor homologado)',
   array['BACEN_SCR_API_URL'],
   'https://www.bcb.gov.br/estabilidadefinanceira/scr', null, 60)
on conflict (chave) do nothing;
