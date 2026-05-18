// supabase/functions/certificado-gerar/template.ts
// HTML template do certificado de conclusão da Universidade Mercurio.

export interface CertificadoDados {
  codigo: string
  aluno_nome: string
  curso_titulo: string
  emitido_em: string // ISO
  duracao_horas?: number
}

const escapeHtml = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function renderCertificadoHtml(d: CertificadoDados): string {
  const data = new Date(d.emitido_em)
  const dataFmt = data.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const horas = d.duracao_horas ? `${d.duracao_horas} horas de conteúdo` : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Certificado ${escapeHtml(d.codigo)} — Mercurio Capital</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: 'Georgia', 'Times New Roman', serif;
    background: #f4f1ea;
    color: #0b1f3a;
  }
  .page {
    width: 297mm; height: 210mm;
    margin: 0 auto;
    padding: 30mm 28mm;
    background:
      linear-gradient(135deg, #fff 0%, #faf8f2 100%);
    border: 14px double #c2a14a;
    position: relative;
  }
  .corner {
    position: absolute; width: 60px; height: 60px;
    border: 3px solid #c2a14a;
  }
  .corner.tl { top: 18px; left: 18px; border-right: 0; border-bottom: 0; }
  .corner.tr { top: 18px; right: 18px; border-left: 0; border-bottom: 0; }
  .corner.bl { bottom: 18px; left: 18px; border-right: 0; border-top: 0; }
  .corner.br { bottom: 18px; right: 18px; border-left: 0; border-top: 0; }
  .brand {
    text-align: center;
    font-size: 14px; letter-spacing: 8px;
    color: #c2a14a; text-transform: uppercase;
    font-weight: bold; margin-bottom: 8px;
  }
  h1 {
    font-size: 42px; text-align: center;
    margin: 0 0 6mm; font-weight: normal;
    letter-spacing: 4px;
  }
  .sub {
    text-align: center; font-style: italic;
    color: #555; margin-bottom: 14mm; font-size: 16px;
  }
  .aluno {
    text-align: center;
    font-size: 36px; font-weight: bold;
    border-bottom: 1px solid #c2a14a;
    padding-bottom: 6mm; margin: 0 30mm 8mm;
    color: #0b1f3a;
  }
  .descricao {
    text-align: center; font-size: 16px; line-height: 1.6;
    color: #333; margin-bottom: 10mm;
  }
  .curso {
    font-weight: bold; color: #0b1f3a; font-size: 18px;
  }
  .footer {
    position: absolute; bottom: 22mm; left: 28mm; right: 28mm;
    display: flex; justify-content: space-between; align-items: flex-end;
    font-size: 12px; color: #444;
  }
  .footer .col { width: 32%; text-align: center; }
  .assinatura { border-top: 1px solid #333; padding-top: 4px; margin-top: 40px; }
  .codigo {
    position: absolute; bottom: 8mm; right: 12mm;
    font-family: 'Courier New', monospace; font-size: 11px;
    color: #888; letter-spacing: 2px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>

    <div class="brand">Mercurio Capital · Universidade</div>
    <h1>Certificado</h1>
    <p class="sub">de conclusão de curso</p>

    <p class="descricao">Certificamos que</p>
    <div class="aluno">${escapeHtml(d.aluno_nome)}</div>
    <p class="descricao">
      concluiu com aproveitamento o curso<br/>
      <span class="curso">${escapeHtml(d.curso_titulo)}</span><br/>
      ${horas ? `<span style="font-size:14px;color:#666;">${escapeHtml(horas)}</span>` : ''}
    </p>

    <div class="footer">
      <div class="col">
        <div class="assinatura">Coordenação Acadêmica</div>
      </div>
      <div class="col">
        Emitido em ${escapeHtml(dataFmt)}
      </div>
      <div class="col">
        <div class="assinatura">Mercurio Capital</div>
      </div>
    </div>

    <div class="codigo">Verificação: ${escapeHtml(d.codigo)}</div>
  </div>
</body>
</html>`
}

