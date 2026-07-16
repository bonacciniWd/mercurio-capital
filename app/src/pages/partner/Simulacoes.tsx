import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { Download, MessageCircle, FilePlus2, Loader2 } from 'lucide-react'
import {
  SimuladorCredito,
  calcularSimulacao,
  type SimuladorCreditoValues,
} from '@/components/SimuladorCredito'
import { saveSimulacaoDraft, type SimulacaoDraft } from '@/lib/simulacaoDraft'
import { brl } from '@/lib/utils'

const PRODUTO_LABEL: Record<SimulacaoDraft['produto'], string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const initialValues: SimulacaoDraft = {
  produto: 'home_equity',
  pessoa_tipo: 'PF',
  valor_solicitado: 350_000,
  valor_garantia: 850_000,
  taxa_juros_mensal: 1.29,
  prazo_meses: 120,
  carencia_meses: 0,
  correcao: 'pos_fixado',
  amortizacao: 'price',
}

export function PartnerSimulacoes() {
  const navigate = useNavigate()
  const resultRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<SimulacaoDraft>(initialValues)
  const [exporting, setExporting] = useState(false)
  const result = useMemo(() => calcularSimulacao(values), [values])
  const dataSimulacao = new Date().toLocaleDateString('pt-BR')

  const patchFinancial = (patch: Partial<SimuladorCreditoValues>) => {
    setValues(current => ({ ...current, ...patch }))
  }

  async function exportImage() {
    if (!resultRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(resultRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `simulacao-mercurio-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setExporting(false)
    }
  }

  function shareWhatsApp() {
    const { calculo, ltv } = result
    const text = [
      'Simulação Mercurio Capital',
      `Produto: ${PRODUTO_LABEL[values.produto]} (${values.pessoa_tipo})`,
      `Crédito: ${brl(values.valor_solicitado * 100)}`,
      `Garantia: ${brl(values.valor_garantia * 100)}`,
      `LTV: ${(ltv * 100).toFixed(1)}%`,
      `Prazo: ${values.prazo_meses} meses`,
      `Taxa: ${values.taxa_juros_mensal.toFixed(2).replace('.', ',')}% a.m.`,
      `1ª parcela: ${brl(calculo.primeiraParcela * 100)}`,
      `Última parcela: ${brl(calculo.ultimaParcela * 100)}`,
      `Renda mínima: ${brl(calculo.rendaMinima * 100)}/mês`,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  function convertToProposal() {
    saveSimulacaoDraft(values)
    navigate('/p/propostas/nova')
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Simulador</h1>
        <p className="text-sm text-silver-600">Monte uma condição comercial e converta em proposta.</p>
      </div>

      <div className="card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Produto</label>
            <select className="input" value={values.produto} onChange={event => setValues(current => ({ ...current, produto: event.target.value as SimulacaoDraft['produto'] }))}>
              {Object.entries(PRODUTO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo de pessoa</label>
            <div className="inline-flex rounded-md border border-silver-200 p-1">
              {(['PF', 'PJ'] as const).map(tipo => (
                <button key={tipo} type="button" onClick={() => setValues(current => ({ ...current, pessoa_tipo: tipo }))} className={`rounded btn-no-liquid px-5 py-2 text-sm font-medium ${values.pessoa_tipo === tipo ? 'bg-red-600 text-white' : 'text-silver-600 hover:bg-silver-50'}`}>{tipo}</button>
              ))}
            </div>
          </div>
        </div>

        <SimuladorCredito
          values={values}
          onChange={patchFinancial}
          result={result}
          resultRef={resultRef}
          resultClassName="shadow-sm"
          resultHeader={(
            <div className="mb-5 border-b border-silver-200 pb-4">
              <p className="text-sm font-bold text-navy">MERCURIO CAPITAL</p>
              <p className="mt-1 text-lg font-semibold text-silver-900">{PRODUTO_LABEL[values.produto]}</p>
              <p className="text-xs text-silver-500">{values.pessoa_tipo} · Simulação comercial</p>
            </div>
          )}
          resultFooter={<p className="mt-5 border-t border-silver-200 pt-3 text-[11px] text-silver-500">Simulação em {dataSimulacao}. Condições sujeitas à análise e aprovação.</p>}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-outline" onClick={() => void exportImage()} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Exportando…' : 'Exportar imagem'}
        </button>
        <button type="button" className="btn-outline" onClick={shareWhatsApp}>
          <MessageCircle className="h-4 w-4" /> Compartilhar no WhatsApp
        </button>
        <button type="button" className="btn-gold" onClick={convertToProposal}>
          <FilePlus2 className="h-4 w-4" /> Converter em proposta
        </button>
      </div>
    </>
  )
}
