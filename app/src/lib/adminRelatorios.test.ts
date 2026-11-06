import { describe, expect, it } from 'vitest'
import {
  countProposalStages, formatCurrencyBRL, formatExportSheetsForPrint, getRelatorioRange, normalizeProposalStatus, reportPrintHtml,
  spreadsheetXml, timestampRange,
} from './adminRelatorios'

describe('períodos de relatório', () => {
  const now = new Date('2026-11-05T02:00:00.000Z') // ainda é 04/11 em São Paulo

  it('calcula mês atual pelo calendário de São Paulo', () => {
    expect(getRelatorioRange('mes', now)).toEqual({ inicio: '2026-11-01', fim: '2026-11-04' })
  })

  it('calcula início do trimestre e dos últimos doze meses', () => {
    expect(getRelatorioRange('trimestre', now).inicio).toBe('2026-10-01')
    expect(getRelatorioRange('12m', now).inicio).toBe('2025-12-01')
  })

  it('usa o início do dia seguinte como limite superior exclusivo', () => {
    expect(timestampRange({ inicio: '2026-10-01', fim: '2026-10-31' })).toEqual({
      inicio: '2026-10-01T00:00:00-03:00',
      fimExclusivo: '2026-11-01T00:00:00-03:00',
    })
  })
})

describe('etapas do relatório', () => {
  it('normaliza status legados para uma etapa canônica', () => {
    expect(normalizeProposalStatus('resolucao_pendencias')).toBe('diligencia_juridica')
    expect(normalizeProposalStatus('contrato_registrado')).toBe('registro_af')
  })

  it('conta cada proposta uma vez e separa rascunho/cancelamento', () => {
    const result = countProposalStages([
      { status: 'pre_analise' },
      { status: 'resolucao_pendencias' },
      { status: 'simulacao' },
      { status: 'cancelado' },
      { status: 'status_desconhecido' },
    ])
    expect(result.find(row => row.status === 'pre_analise')?.quantidade).toBe(1)
    expect(result.find(row => row.status === 'diligencia_juridica')?.quantidade).toBe(1)
    expect(result.find(row => row.status === 'simulacao')?.quantidade).toBe(1)
    expect(result.find(row => row.status === 'cancelado')?.quantidade).toBe(1)
    expect(result.find(row => row.status === 'outros')?.quantidade).toBe(1)
  })
})

describe('exportação do relatório', () => {
  it('serializa conteúdo de planilha como texto tipado e escapa XML', () => {
    const xml = spreadsheetXml([{ name: 'Resumo', rows: [['=1+1 & <tag>'], [42]] }])
    expect(xml).toContain('ss:Type="String">=1+1 &amp; &lt;tag&gt;')
    expect(xml).toContain('ss:Type="Number">42')
    expect(xml).not.toContain('<Cell ss:Formula')
  })

  it('formata valores monetários com símbolo e pontuação brasileira', () => {
    expect(formatCurrencyBRL(1234567.89)).toBe('R$ 1.234.567,89')
    expect(formatCurrencyBRL(0)).toBe('R$ 0,00')
  })

  it('formata apenas colunas monetárias no PDF e preserva contagens', () => {
    const result = formatExportSheetsForPrint([
      { name: 'Financeiro agregado', rows: [['Indicador', 'Valor'], ['Entradas realizadas', 1234.5], ['Lançamentos previstos ou vencidos', 12]] },
      { name: 'Parceiros', rows: [['Parceiro', 'Propostas', 'Ganhas', 'Volume ganho (R$)'], ['Mercúrio', 10, 3, 9876.54]] },
    ])
    expect(result[0].rows[1][1]).toBe('R$ 1.234,50')
    expect(result[0].rows[2][1]).toBe(12)
    expect(result[1].rows[1][1]).toBe(10)
    expect(result[1].rows[1][3]).toBe('R$ 9.876,54')
  })

  it('escapa conteúdo HTML do relatório impresso', () => {
    const html = reportPrintHtml('Relatório', '01/11 a 04/11', 'agora', [
      { title: '<script>alert(1)</script>', rows: [['<img src=x>']] },
    ])
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x&gt;')
  })

  it('inclui a logo local, cabeçalho editorial, cabeçalho de tabela e paginação', () => {
    const html = reportPrintHtml('Relatório administrativo', '01/11 a 04/11', 'agora', [
      { title: 'Resumo', rows: [['Indicador', 'Valor'], ['Volume ganho', 'R$ 1.234.567,89']] },
      { title: 'Evolução mensal', rows: [['Competência', 'Propostas'], ['novembro de 2026', 12]] },
    ], '/assets/logowide.png')
    expect(html).toContain('src="/assets/logowide.png"')
    expect(html).toContain('Mercúrio Capital · Relatórios')
    expect(html).toContain('<thead><tr><th scope="col">Competência</th>')
    expect(html).toContain('counter(page)')
    expect(html).toContain('Visão executiva')
  })
})
