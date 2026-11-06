import { PROPOSTA_KANBAN_STATUS, PROPOSTA_STATUS_LABEL, toKanbanStatus } from '@/lib/propostaStatus'

export type RelatorioPreset = '12m' | 'ytd' | 'trimestre' | 'mes'
export type RelatorioRange = { inicio: string; fim: string }

export const RELATORIO_ETAPAS = [
  { status: 'simulacao', label: PROPOSTA_STATUS_LABEL.simulacao },
  ...PROPOSTA_KANBAN_STATUS.map(status => ({ status, label: PROPOSTA_STATUS_LABEL[status] ?? status })),
  { status: 'cancelado', label: PROPOSTA_STATUS_LABEL.cancelado },
] as const

const datePartsInSaoPaulo = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
    day: Number(parts.find(part => part.type === 'day')?.value),
  }
}

function dateFromParts(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12))
}

export function dateISOInSaoPaulo(date: Date): string {
  const { year, month, day } = datePartsInSaoPaulo(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function shiftISODate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = dateFromParts(year, month, day + days)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function getRelatorioRange(preset: RelatorioPreset, now = new Date()): RelatorioRange {
  const today = dateISOInSaoPaulo(now)
  const [year, month] = today.split('-').map(Number)
  if (preset === 'mes') return { inicio: `${year}-${String(month).padStart(2, '0')}-01`, fim: today }
  if (preset === 'ytd') return { inicio: `${year}-01-01`, fim: today }
  if (preset === 'trimestre') {
    const firstQuarterMonth = Math.floor((month - 1) / 3) * 3 + 1
    return { inicio: `${year}-${String(firstQuarterMonth).padStart(2, '0')}-01`, fim: today }
  }
  const firstMonth = dateFromParts(year, month - 11, 1)
  return {
    inicio: `${firstMonth.getUTCFullYear()}-${String(firstMonth.getUTCMonth() + 1).padStart(2, '0')}-01`,
    fim: today,
  }
}

export function timestampRange(range: RelatorioRange): { inicio: string; fimExclusivo: string } {
  return {
    inicio: `${range.inicio}T00:00:00-03:00`,
    fimExclusivo: `${shiftISODate(range.fim, 1)}T00:00:00-03:00`,
  }
}

export function normalizeProposalStatus(status: string | null | undefined): string {
  const normalized = (status ?? '').trim().toLocaleLowerCase('pt-BR')
  if (normalized === 'simulacao' || normalized === 'cancelado') return normalized
  return toKanbanStatus(normalized) ?? `outro:${normalized || 'sem_status'}`
}

export function countProposalStages(rows: Array<{ status: string | null }>) {
  const counts = new Map<string, number>(RELATORIO_ETAPAS.map(stage => [stage.status, 0]))
  let outros = 0
  for (const row of rows) {
    const status = normalizeProposalStatus(row.status)
    if (counts.has(status)) counts.set(status, (counts.get(status) ?? 0) + 1)
    else outros++
  }
  return [
    ...RELATORIO_ETAPAS.map(stage => ({ status: stage.status, etapa: stage.label, quantidade: counts.get(stage.status) ?? 0 })),
    ...(outros ? [{ status: 'outros', etapa: 'Outros status', quantidade: outros }] : []),
  ]
}

export type ExportCell = string | number
export type ExportSheet = { name: string; rows: ExportCell[][] }

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatExportSheetsForPrint(sheets: ExportSheet[]): Array<{ title: string; rows: ExportCell[][] }> {
  return sheets.map(sheet => ({
    title: sheet.name,
    rows: sheet.rows.map((row, rowIndex) => row.map((value, columnIndex) => {
      if (rowIndex === 0 || typeof value !== 'number') return value
      const label = String(row[0] ?? '')
      const isCurrency = sheet.name === 'Resumo' && ['Volume ganho', 'Ticket médio'].includes(label)
        || sheet.name === 'Financeiro agregado' && label !== 'Lançamentos previstos ou vencidos'
        || sheet.name === 'Parceiros' && [3, 4].includes(columnIndex)
        || sheet.name === 'Evolução mensal' && [2, 3].includes(columnIndex)
      return isCurrency ? formatCurrencyBRL(value) : value
    })),
  }))
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function htmlEscape(value: string): string {
  return xmlEscape(value)
}

export function spreadsheetXml(sheets: ExportSheet[]): string {
  const worksheets = sheets.map(sheet => {
    const name = xmlEscape(sheet.name.slice(0, 31))
    const rows = sheet.rows.map(row => `<Row>${row.map(value => {
      const isNumber = typeof value === 'number' && Number.isFinite(value)
      const type = isNumber ? 'Number' : 'String'
      const text = isNumber ? String(value) : String(value ?? '')
      return `<Cell><Data ss:Type="${type}">${xmlEscape(text)}</Data></Cell>`
    }).join('')}</Row>`).join('')
    return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">${worksheets}</Workbook>`
}

export function reportPrintHtml(
  title: string,
  period: string,
  generatedAt: string,
  sections: Array<{ title: string; rows: ExportCell[][] }>,
  logoSrc = '',
): string {
  const content = sections.map((section, sectionIndex) => {
    if (sectionIndex === 0 && section.title === 'Resumo') {
      const metrics = section.rows.slice(1).filter(row => row.length > 1 && row[0] !== 'Período')
        .map(row => `<article class="metric"><span>${htmlEscape(String(row[0] ?? ''))}</span><strong>${htmlEscape(String(row[1] ?? ''))}</strong></article>`).join('')
      return `<section class="summary"><h2>Visão executiva</h2><div class="metric-grid">${metrics}</div></section>`
    }
    const [headerRow, ...bodyRows] = section.rows
    const head = headerRow?.map(cell => `<th scope="col">${htmlEscape(String(cell ?? ''))}</th>`).join('') ?? ''
    const rows = bodyRows.map(row => `<tr>${row.map(cell => `<td>${htmlEscape(String(cell ?? ''))}</td>`).join('')}</tr>`).join('')
    return `<section><h2>${htmlEscape(section.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${rows || `<tr><td colspan="${headerRow?.length ?? 1}" class="empty">Sem dados no período.</td></tr>`}</tbody></table></section>`
  }).join('')
  const logo = logoSrc ? `<img class="brand-logo" src="${htmlEscape(logoSrc)}" alt="Mercúrio Capital">` : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><style>
    :root{color-scheme:light;--navy:#0a2b4e;--red:#c81722;--ink:#202a36;--muted:#687586;--line:#dfe4ea;--soft:#f4f6f8;--gold:#d4af37}
    *{box-sizing:border-box}html{background:#eef1f4}body{max-width:1024px;margin:28px auto;padding:42px 48px;background:#fff;color:var(--ink);font:13px/1.45 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-header{display:grid;grid-template-columns:190px 1fr;align-items:center;gap:28px;padding:0 0 24px;border-bottom:3px solid var(--red)}.brand-logo{display:block;width:178px;height:auto;max-height:76px;object-fit:contain;object-position:left center}.heading{border-left:1px solid var(--line);padding-left:26px}.eyebrow{margin:0 0 5px;color:var(--red);font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{margin:0;color:var(--navy);font-size:26px;line-height:1.15;letter-spacing:-.03em}.period{margin:8px 0 0;color:var(--muted);font-size:12px}.meta{margin:4px 0 0;color:#8993a0;font-size:10px}.notice{margin:18px 0 22px;padding:10px 13px;border:1px solid #e4eaf0;border-radius:7px;background:#f7f9fb;color:#586574;font-size:10px}
    section{margin:22px 0 0}h2{margin:0 0 10px;color:var(--navy);font-size:14px;line-height:1.25;break-after:avoid-page}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.metric{min-height:66px;padding:12px;border:1px solid var(--line);border-top:2px solid var(--red);border-radius:7px;background:#fff;break-inside:avoid}.metric span{display:block;color:var(--muted);font-size:9px;line-height:1.35}.metric strong{display:block;margin-top:7px;color:var(--navy);font-size:16px;line-height:1.2;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.summary{margin-top:19px}
    table{width:100%;border-collapse:collapse;table-layout:auto;font-size:10px}thead{display:table-header-group}th{padding:8px 9px;background:var(--navy);color:#fff;text-align:left;font-size:8px;letter-spacing:.06em;text-transform:uppercase}td{padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}tbody tr:nth-child(even){background:var(--soft)}tbody tr{break-inside:avoid}.empty{text-align:center;color:var(--muted);padding:15px}section:not(.summary){break-inside:auto}section:not(.summary) h2{break-after:avoid;page-break-after:avoid}section:not(.summary) table{break-before:avoid;page-break-before:avoid}
    @page{size:A4;margin:15mm 14mm 18mm;@bottom-left{content:"Mercúrio Capital · Relatório administrativo";color:#7a8592;font:8px Arial,Helvetica,sans-serif}@bottom-right{content:"Página " counter(page) " de " counter(pages);color:#7a8592;font:8px Arial,Helvetica,sans-serif}}
    @media print{html{background:#fff}body{max-width:none;margin:0;padding:0}.report-header{grid-template-columns:165px 1fr;gap:22px;padding-bottom:14px}.brand-logo{width:155px;max-height:62px}h1{font-size:22px}.notice{margin:12px 0 13px;padding:8px 11px}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.metric{min-height:58px;padding:9px}.metric strong{margin-top:5px;font-size:14px}section{margin-top:12px}h2{font-size:12px;margin-bottom:7px}th{padding:6px 8px;background:var(--navy)!important;color:#fff!important}td{padding:5px 8px}a{color:inherit;text-decoration:none}}
    @media screen and (max-width:700px){body{margin:0;padding:22px}.report-header{grid-template-columns:1fr;gap:14px}.heading{border-left:0;border-top:1px solid var(--line);padding:14px 0 0}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  </style></head><body><header class="report-header">${logo}<div class="heading"><p class="eyebrow">Mercúrio Capital · Relatórios</p><h1>${htmlEscape(title)}</h1><p class="period">Período: ${htmlEscape(period)}</p><p class="meta">Gerado em ${htmlEscape(generatedAt)} · Informações agregadas</p></div></header><p class="notice">Relatório consolidado do período selecionado. Valores monetários apresentados em reais (R$), com pontuação no padrão brasileiro.</p>${content}<script>window.addEventListener('load',async()=>{const image=document.querySelector('.brand-logo');try{if(image)await image.decode();if(document.fonts?.ready)await document.fonts.ready}catch{}setTimeout(()=>window.print(),250)})</script></body></html>`
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
