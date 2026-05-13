-- =============================================
-- MIGRATION 007 — SEEDS INICIAIS
-- =============================================

-- =============================================
-- CONFIGURACOES_SISTEMA
-- =============================================

insert into configuracoes_sistema (chave, valor, descricao) values
  ('taxa_juros_mensal_default', '1.39',    'Taxa de juros mensal padrão (% a.m. sobre IPCA)'),
  ('indexador_default',         '"IPCA"',  'Indexador padrão das operações'),
  ('prazo_padrao_meses',        '120',     'Prazo padrão em meses (10 anos)'),
  ('prazo_minimo_meses',        '12',      'Prazo mínimo permitido em meses'),
  ('prazo_maximo_meses',        '240',     'Prazo máximo permitido em meses (20 anos)'),
  ('carencia_maxima_meses',     '3',       'Carência máxima permitida (meses)'),
  ('magic_link_ttl_min',        '30',      'TTL do magic link em minutos'),
  ('magic_link_max_emissoes',   '5',       'Máx. emissões por destinatário em 24h'),
  ('saldo_alerta_minimo',       '2000',    'Saldo mínimo (centavos) para alerta de carteira — R$ 20'),
  ('wallet_topup_minimo',       '2000',    'Recarga mínima via Stripe (centavos) — R$ 20'),
  ('sessao_idle_admin_min',     '30',      'Timeout de sessão idle para admin (minutos)'),
  ('sessao_idle_geral_min',     '480',     'Timeout de sessão idle geral (minutos — 8h)'),
  ('rate_limit_login',          '{"max":5,"janela_min":15}',    'Rate limit do endpoint /login'),
  ('rate_limit_registro',       '{"max":3,"janela_min":60}',    'Rate limit do /registro por IP'),
  ('rate_limit_protocolo',      '{"max":10,"janela_min":1}',    'Rate limit de consulta por protocolo'),
  ('versao_plataforma',         '"1.0.0"', 'Versão atual da plataforma')
on conflict (chave) do nothing;

-- =============================================
-- PRECOS_CONSULTA (tabela inicial de preços)
-- Valores em centavos (BRL). Ajuste conforme contratos com fornecedores.
-- =============================================

insert into precos_consulta
  (tipo, preco_centavos, custo_fornecedor_centavos, descricao)
values
  ('bacen_cpf',                    150,  80,  'Consulta CPF na base Bacen'),
  ('bacen_cnpj',                   200, 100,  'Consulta CNPJ na base Bacen'),
  ('serasa_pf',                    350, 200,  'Score e consulta de crédito PF — SPC/Serasa'),
  ('serasa_pj',                    450, 250,  'Score e consulta de crédito PJ — SPC/Serasa'),
  ('jusbrasil_cnpj',               500, 300,  'Consulta processos jurídicos — Jusbrasil'),
  ('escavador_cnpj',               500, 300,  'Consulta processos jurídicos — Escavador'),
  ('ri_digital_matricula',         800, 500,  'Matrícula eletrônica — RI Digital'),
  ('nacional_consultas_bens',      600, 350,  'Consulta de bens — Nacional Consultas'),
  ('nacional_consultas_certidao',  600, 350,  'Certidão — Nacional Consultas')
on conflict do nothing;

-- =============================================
-- FEATURE_FLAGS (base — todas desativas por padrão)
-- =============================================

insert into feature_flags (chave, descricao, regras, ativo) values
  (
    'universidade_paga',
    'Libera acesso a cursos pagos na Universidade Mercurio',
    '{"roles":["admin"]}',
    false
  ),
  (
    'wallet_limite_diario_parceiro',
    'Permite que o parceiro configure seu próprio limite diário de carteira',
    '{"roles":["admin"]}',
    false
  ),
  (
    'ocr_automatico',
    'Ativa pipeline OCR automático (Tesseract) em uploads de documentos',
    '{"roles":["admin","partner"]}',
    false
  ),
  (
    'magic_link_whatsapp',
    'Dispara magic links via WhatsApp (Evolution API)',
    '{"roles":["admin"]}',
    false
  ),
  (
    'consulta_juridica_partner',
    'Permite que o parceiro solicite consultas jurídicas (Jusbrasil/Escavador)',
    '{"roles":["admin"]}',
    false
  ),
  (
    'notificacoes_push_web',
    'Ativa notificações push web (FCM)',
    '{"roles":["admin"]}',
    false
  ),
  (
    'exportacao_relatorios',
    'Permite exportar relatórios em xlsx',
    '{"roles":["admin","partner"]}',
    true
  )
on conflict (chave) do nothing;

