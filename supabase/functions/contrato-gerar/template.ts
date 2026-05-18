// supabase/functions/contrato-gerar/template.ts
// Renderiza HTML do contrato de crédito a partir dos dados da proposta.
// Pode ser usado tanto pelo upload no Clicksign quanto pela impressão no front.

export interface ContratoDados {
  protocolo: string | null
  produto: string
  valor_solicitado: number | string
  valor_imoveis_total: number | string
  taxa_juros_mensal: number | string
  amortizacao: string
  prazo_meses: number
  carencia_meses: number
  indexador: string
  partner_nome: string | null
  cliente: {
    nome_completo: string | null
    cpf: string | null
    email: string | null
    telefone: string | null
  } | null
  proponentes: Array<{
    nome: string
    cpf_cnpj: string | null
    papel: string
  }>
  imoveis: Array<{
    tipo: string
    cidade: string | null
    estado: string | null
    logradouro: string | null
    numero: string | null
    bairro: string | null
    valor: number | string
  }>
  versao: number
}

const PRODUTO: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito para Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

function brl(v: number | string): string {
  const n = typeof v === 'string' ? Number(v) : v
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0)
}

function esc(v: string | null | undefined): string {
  return (v ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))
}

export function renderContratoHtml(d: ContratoDados): string {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const prod = PRODUTO[d.produto] ?? d.produto
  const proponentesHtml = (d.proponentes ?? []).map(p =>
    `<li><b>${esc(p.nome)}</b>${p.cpf_cnpj ? ' — CPF/CNPJ ' + esc(p.cpf_cnpj) : ''} <i>(${esc(p.papel)})</i></li>`
  ).join('')
  const imoveisHtml = (d.imoveis ?? []).map(i =>
    `<li>${esc(i.tipo)} — ${esc([i.logradouro, i.numero, i.bairro].filter(Boolean).join(', '))} · ${esc([i.cidade, i.estado].filter(Boolean).join('/'))} · <b>${brl(i.valor)}</b></li>`
  ).join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Contrato ${esc(d.protocolo ?? '')}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color:#111; margin:40px; line-height:1.55; font-size:12pt; }
  h1 { font-size:20pt; margin:0 0 4px; color:#0c1428; }
  h2 { font-size:13pt; margin-top:18px; text-transform:uppercase; letter-spacing:.5px; color:#0c1428; }
  .header { border-bottom:2px solid #D4AF37; padding-bottom:14px; margin-bottom:18px; }
  .meta { font-size:9pt; color:#666; }
  .box  { background:#f8f8f8; border:1px solid #e3e3e3; border-radius:6px; padding:12px 16px; }
  table { width:100%; font-size:10pt; border-collapse:collapse; }
  td { padding:4px 6px; border-bottom:1px solid #eee; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .sig { margin-top:48px; display:grid; grid-template-columns:1fr 1fr; gap:60px; }
  .line { border-top:1px solid #888; padding-top:6px; text-align:center; font-size:9pt; }
  ol li { margin-bottom:8px; text-align:justify; }
</style></head><body>
<div class="header">
  <p class="meta">MERCURIO CAPITAL · Crédito Imobiliário</p>
  <h1>INSTRUMENTO PARTICULAR DE CONTRATO DE CRÉDITO</h1>
  <p class="meta">Protocolo ${esc(d.protocolo ?? '—')} · Versão ${d.versao} · ${hoje}</p>
</div>

<div class="box">
  <div class="grid">
    <div>
      <b>CREDOR / INTERMEDIADOR</b><br/>
      Mercurio Capital Ltda. — CNPJ 12.345.678/0001-90<br/>
      Av. Paulista, 1.000, 15º andar — São Paulo/SP — CEP 01310-100
    </div>
    <div>
      <b>TOMADOR(ES)</b><br/>
      ${esc(d.cliente?.nome_completo ?? '—')}<br/>
      CPF/CNPJ: ${esc(d.cliente?.cpf ?? '—')}<br/>
      E-mail: ${esc(d.cliente?.email ?? '—')} — Tel: ${esc(d.cliente?.telefone ?? '—')}
    </div>
  </div>
  ${d.partner_nome ? `<p class="meta" style="margin-top:8px">Operação intermediada pelo parceiro credenciado: <b>${esc(d.partner_nome)}</b></p>` : ''}
</div>

<h2>1. Do Objeto</h2>
<p>O presente Contrato tem por objeto a operação de crédito na modalidade <b>${esc(prod)}</b>,
no valor total de <b>${brl(d.valor_solicitado)}</b>, com prazo de <b>${d.prazo_meses} meses</b>
${d.carencia_meses > 0 ? `e carência de <b>${d.carencia_meses} meses</b>` : ''},
garantido por imóvel(is) avaliados em <b>${brl(d.valor_imoveis_total)}</b>.</p>

<h2>2. Condições Financeiras</h2>
<table>
  <tr><td>Sistema de Amortização</td><td><b>${esc(d.amortizacao.toUpperCase())}</b></td></tr>
  <tr><td>Indexador</td><td>${esc(d.indexador)}</td></tr>
  <tr><td>Taxa de Juros Mensal</td><td>${Number(d.taxa_juros_mensal).toFixed(2)}% a.m.</td></tr>
  <tr><td>Prazo Total</td><td>${d.prazo_meses} meses</td></tr>
</table>

<h2>3. Proponentes</h2>
<ul>${proponentesHtml || '<li>Nenhum proponente cadastrado.</li>'}</ul>

<h2>4. Garantia(s) — Imóvel(is)</h2>
<ul>${imoveisHtml || '<li>Sem garantia cadastrada.</li>'}</ul>

<h2>5. Obrigações do Tomador</h2>
<ol>
  <li>Quitar todas as parcelas nas datas pactuadas, sob pena de incidência de juros moratórios de 1% a.m. e multa contratual de 2%.</li>
  <li>Manter o(s) imóvel(is) dado(s) em garantia em bom estado de conservação, com tributos quitados.</li>
  <li>Comunicar imediatamente qualquer alteração cadastral relevante (endereço, estado civil, renda).</li>
  <li>Não alienar, ceder ou onerar o(s) imóvel(is) garantidor(es) sem prévia anuência por escrito do CREDOR.</li>
</ol>

<h2>6. Garantia Hipotecária / Alienação Fiduciária</h2>
<p>O(s) imóvel(is) descrito(s) na cláusula 4 fica(m) gravado(s) com <b>alienação fiduciária</b> em favor do CREDOR,
nos termos da Lei 9.514/1997, até a quitação integral da operação.</p>

<h2>7. LGPD</h2>
<p>As partes comprometem-se a tratar os dados pessoais em estrita conformidade com a Lei 13.709/2018 (LGPD).
O encarregado de proteção de dados da Mercurio Capital é dpo@mercuriocapital.com.br.</p>

<h2>8. Foro</h2>
<p>Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>

<p style="margin-top:30px">São Paulo, ${hoje}.</p>

<div class="sig">
  <div class="line">Mercurio Capital Ltda.<br/>CNPJ 12.345.678/0001-90</div>
  <div class="line">${esc(d.cliente?.nome_completo ?? 'Tomador')}<br/>${esc(d.cliente?.cpf ?? '')}</div>
</div>
<div class="sig" style="margin-top:32px">
  <div class="line">Testemunha 1 · CPF</div>
  <div class="line">Testemunha 2 · CPF</div>
</div>
</body></html>`
}

