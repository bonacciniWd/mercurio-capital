-- Fase 15.4 — Seed de templates WhatsApp (Cloud API) prontos para uso.
-- O dono só precisa criar/aprovar na Meta um template com o MESMO nome (wa_template_nome)
-- e a MESMA quantidade/ordem de parâmetros {{1}},{{2}}... descrita em cada `corpo`.
-- A ordem das `variaveis` define o mapeamento posicional (var[1] -> {{1}}, etc.).
--
-- Idempotente: não sobrescreve templates já existentes (on conflict do nothing).

insert into public.templates_mensagem
  (codigo, canal, nome, assunto, corpo, variaveis, ativo, wa_template_nome, wa_idioma)
values
  -- Magic link / acesso (categoria Authentication na Meta)
  ('wa_magic_link_v1', 'whatsapp', 'WhatsApp · Link de acesso', null,
   E'Olá {{nome}}, aqui está seu link de acesso à Mercurio Capital: {{link}}\nVálido por tempo limitado.',
   '{nome,link}', true, 'magic_link', 'pt_BR'),

  -- Proposta criada / enviada ao cliente (Utility)
  ('wa_proposta_criada_v1', 'whatsapp', 'WhatsApp · Proposta criada', null,
   E'Olá {{nome}}, sua proposta {{protocolo}} foi registrada na Mercurio Capital. Acompanhe pelo link: {{link}}',
   '{nome,protocolo,link}', true, 'proposta_criada', 'pt_BR'),

  -- Mudança de status da proposta (Utility)
  ('wa_status_proposta_v1', 'whatsapp', 'WhatsApp · Status da proposta', null,
   E'Olá {{nome}}, sua proposta {{protocolo}} mudou para: {{status}}.',
   '{nome,protocolo,status}', true, 'status_proposta', 'pt_BR'),

  -- Pendência de documento (Utility)
  ('wa_pendencia_doc_v1', 'whatsapp', 'WhatsApp · Pendência de documento', null,
   E'Olá {{nome}}, a proposta {{protocolo}} precisa do documento: {{nome_doc}}. Envie pelo link: {{link}}',
   '{nome,protocolo,nome_doc,link}', true, 'pendencia_documento', 'pt_BR'),

  -- Contrato pronto para assinatura (Utility)
  ('wa_contrato_assinatura_v1', 'whatsapp', 'WhatsApp · Contrato para assinatura', null,
   E'Olá {{nome}}, o contrato da proposta {{protocolo}} está pronto para assinatura: {{link}}',
   '{nome,protocolo,link}', true, 'contrato_assinatura', 'pt_BR'),

  -- Recurso liberado (Utility)
  ('wa_recurso_liberado_v1', 'whatsapp', 'WhatsApp · Recurso liberado', null,
   E'Parabéns {{nome}}! O recurso da proposta {{protocolo}} no valor de {{valor}} foi liberado.',
   '{nome,protocolo,valor}', true, 'recurso_liberado', 'pt_BR'),

  -- Parceiro aprovado (Utility)
  ('wa_partner_aprovado_v1', 'whatsapp', 'WhatsApp · Parceiro aprovado', null,
   E'Olá {{nome}}, seu cadastro de parceiro na Mercurio Capital foi aprovado! Acesse: {{link}}',
   '{nome,link}', true, 'partner_aprovado', 'pt_BR')
on conflict (codigo) do nothing;
