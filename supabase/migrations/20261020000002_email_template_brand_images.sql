-- Atualiza somente a imagem principal dos templates transacionais existentes.
-- Mantém assunto, placeholders, status e fluxo de entrega sem alterações.
begin;

with image_templates (codigo, image_url) as (
  values
    ('simulacao_publica_resultado_v1', 'https://www.mercuriocapitalsa.com.br/03.png'),
    ('simulacao_publica_amortizacao_resultado_v1', 'https://www.mercuriocapitalsa.com.br/03.png'),
    ('proposta_cliente_magic_link_v1', 'https://www.mercuriocapitalsa.com.br/03.png'),
    ('proposta_status_changed_v1', 'https://www.mercuriocapitalsa.com.br/03.png'),
    ('simulacao_publica_novo_lead_interno_v1', 'https://www.mercuriocapitalsa.com.br/02.png'),
    ('simulacao_publica_amortizacao_novo_lead_interno_v1', 'https://www.mercuriocapitalsa.com.br/02.png'),
    ('convite_equipe_v1', 'https://www.mercuriocapitalsa.com.br/02.png')
)
update public.templates_mensagem as template
set corpo = case
      when position('<img' in lower(template.corpo)) > 0 then
        regexp_replace(
          template.corpo,
          'src="[^"]+"',
          'src="' || image_templates.image_url || '"',
          'i'
        )
      when position('<div' in lower(template.corpo)) > 0 then
        regexp_replace(
          template.corpo,
          '(<div[^>]*>)',
          E'\\1' || '<img src="' || image_templates.image_url || '" alt="Mercúrio Capital" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0 0 24px;">',
          'i'
        )
      else
        '<img src="' || image_templates.image_url || '" alt="Mercúrio Capital" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0 0 24px;">' || template.corpo
    end,
    updated_at = now()
from image_templates
where template.codigo = image_templates.codigo
  and template.canal = 'email';

commit;
