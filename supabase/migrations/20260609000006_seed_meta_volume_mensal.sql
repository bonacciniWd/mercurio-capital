-- Seed: meta de volume mensal para o dashboard admin
-- Valor padrão: R$ 500.000.000 (500 milhões) = 50.000.000.000 centavos

insert into configuracoes_sistema (chave, valor, descricao)
values (
  'meta_volume_mensal',
  '{"centavos": 50000000000}',
  'Meta de volume ganho acumulado exibida no dashboard admin (em centavos). Editável em Configurações > Metas.'
)
on conflict (chave) do nothing;
