-- Branding dos e-mails de resultado enviados aos clientes pelos simuladores.
-- Mantém códigos, contratos de variáveis e fluxo outbox existentes.

begin;

insert into public.templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo)
values (
  'simulacao_publica_resultado_v1',
  'email',
  'Resultado do simulador público',
  'Sua simulação de crédito foi recebida',
  $html$
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#171717;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:0;"><img src="https://www.mercuriocapitalsa.com.br/assets/call-to-DyM9aWlp.png" alt="Mercúrio Capital" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
      <tr><td style="padding:34px 30px 28px;">
        <p style="display:inline-block;margin:0 0 18px;padding:9px 14px;border-radius:999px;background-color:#fef2f2;color:#b91c1c;font-size:14px;font-weight:bold;">Sua solicitação foi recebida</p>
        <h1 style="margin:0 0 12px;color:#171717;font-size:26px;line-height:1.25;">Olá, {{nome}}!</h1>
        <p style="margin:0 0 22px;color:#4b5563;font-size:16px;line-height:1.6;">Recebemos sua simulação de crédito com garantia de imóvel. Confira o resumo estimado:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background-color:#991b1b;border-radius:10px;">
          <tr><td style="padding:22px 24px;color:#ffffff;">
            <p style="margin:0 0 6px;color:#fee2e2;font-size:13px;letter-spacing:1px;">VALOR DO CRÉDITO</p>
            <p style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;line-height:1.25;">{{valor_credito}}</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:10px;">
          <tr>
            <td width="50%" style="padding:16px;border-right:1px solid #e5e7eb;vertical-align:top;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:12px;letter-spacing:.7px;">VALOR DA PARCELA</p>
              <p style="margin:0;color:#171717;font-size:18px;font-weight:bold;">{{parcela_estimada}}</p>
            </td>
            <td width="50%" style="padding:16px;vertical-align:top;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:12px;letter-spacing:.7px;">TOTAL DE MESES</p>
              <p style="margin:0;color:#171717;font-size:18px;font-weight:bold;">{{prazo_meses}} meses</p>
            </td>
          </tr>
        </table>
        <p style="margin:22px 0;color:#4b5563;font-size:15px;line-height:1.6;">Nossa equipe poderá entrar em contato para entender sua necessidade e orientar os próximos passos.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;">
          <tr><td align="center" bgcolor="#dc2626" style="border-radius:999px;"><a href="{{contato_url}}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">FALAR COM A EQUIPE</a></td></tr>
        </table>
        <p style="margin:0;padding:14px 16px;border-left:4px solid #dc2626;border-radius:4px;background-color:#f9fafb;color:#4b5563;font-size:13px;line-height:1.6;">Esta simulação não representa aprovação imediata. IOF, tarifas, análise de crédito e condições finais podem alterar os valores.</p>
        <p style="margin:24px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">Atenciosamente,<br><strong style="color:#171717;">Equipe Mercúrio Capital</strong></p>
      </td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid #e5e7eb;background-color:#fafafa;text-align:center;">
        <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.7;">Mercúrio Capital · Crédito estruturado com clareza e responsabilidade.<br>
          <a href="https://www.mercuriocapitalsa.com.br/politica-de-privacidade" style="color:#b91c1c;text-decoration:underline;">Política de Privacidade</a> ·
          <a href="mailto:contato@mercuriocapitalsa.com" style="color:#b91c1c;text-decoration:underline;">Contato</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
$html$,
  array['nome', 'valor_credito', 'parcela_estimada', 'prazo_meses', 'contato_url']::text[],
  true
)
on conflict (codigo) do update
set canal = excluded.canal,
    nome = excluded.nome,
    assunto = excluded.assunto,
    corpo = excluded.corpo,
    variaveis = excluded.variaveis,
    ativo = true,
    updated_at = now();

insert into public.templates_mensagem (codigo, canal, nome, assunto, corpo, variaveis, ativo)
values (
  'simulacao_publica_amortizacao_resultado_v1',
  'email',
  'Resultado do simulador de amortização',
  'Sua simulação de amortização foi recebida',
  $html$
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#171717;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:0;"><img src="https://www.mercuriocapitalsa.com.br/assets/call-to-DyM9aWlp.png" alt="Mercúrio Capital" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
      <tr><td style="padding:34px 30px 28px;">
        <p style="display:inline-block;margin:0 0 18px;padding:9px 14px;border-radius:999px;background-color:#fef2f2;color:#b91c1c;font-size:14px;font-weight:bold;">Sua solicitação foi recebida</p>
        <h1 style="margin:0 0 12px;color:#171717;font-size:26px;line-height:1.25;">Olá, {{nome}}!</h1>
        <p style="margin:0 0 22px;color:#4b5563;font-size:16px;line-height:1.6;">Recebemos sua simulação de amortização. Confira os valores estimados:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background-color:#991b1b;border-radius:10px;">
          <tr><td style="padding:22px 24px;color:#ffffff;">
            <p style="margin:0 0 6px;color:#fee2e2;font-size:13px;letter-spacing:1px;">VALOR DO EMPRÉSTIMO</p>
            <p style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;line-height:1.25;">{{valor_credito}}</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:10px;">
          <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Sistema de amortização</td><td align="right" style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#171717;font-size:14px;font-weight:bold;">{{sistema_amortizacao}}</td></tr>
          <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Primeira parcela</td><td align="right" style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#171717;font-size:14px;font-weight:bold;">{{primeira_parcela}}</td></tr>
          <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Total de juros</td><td align="right" style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#171717;font-size:14px;font-weight:bold;">{{total_juros}}</td></tr>
          <tr><td style="padding:14px 16px;color:#6b7280;font-size:14px;">Prazo</td><td align="right" style="padding:14px 16px;color:#171717;font-size:14px;font-weight:bold;">{{quantidade_parcelas}} parcelas</td></tr>
        </table>
        <p style="margin:22px 0;color:#4b5563;font-size:15px;line-height:1.6;">Nossa equipe poderá entrar em contato para entender sua necessidade e orientar os próximos passos.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;">
          <tr><td align="center" bgcolor="#dc2626" style="border-radius:999px;"><a href="{{contato_url}}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">FALAR COM A EQUIPE</a></td></tr>
        </table>
        <p style="margin:0;padding:14px 16px;border-left:4px solid #dc2626;border-radius:4px;background-color:#f9fafb;color:#4b5563;font-size:13px;line-height:1.6;">Esta simulação não representa aprovação imediata. IOF, tarifas, análise de crédito e condições finais podem alterar os valores.</p>
      </td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid #e5e7eb;background-color:#fafafa;text-align:center;">
        <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.7;">Mercúrio Capital · Crédito estruturado com clareza e responsabilidade.<br>
          <a href="https://www.mercuriocapitalsa.com.br/politica-de-privacidade" style="color:#b91c1c;text-decoration:underline;">Política de Privacidade</a> ·
          <a href="mailto:contato@mercuriocapitalsa.com" style="color:#b91c1c;text-decoration:underline;">Contato</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
$html$,
  array['nome', 'valor_credito', 'sistema_amortizacao', 'primeira_parcela', 'total_juros', 'quantidade_parcelas', 'contato_url']::text[],
  true
)
on conflict (codigo) do update
set canal = excluded.canal,
    nome = excluded.nome,
    assunto = excluded.assunto,
    corpo = excluded.corpo,
    variaveis = excluded.variaveis,
    ativo = true,
    updated_at = now();

commit;
