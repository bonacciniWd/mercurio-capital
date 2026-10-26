import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/assets/logos/logo.svg'
import { Download, MessageCircle, FilePlus2, AlertTriangle } from 'lucide-react'
import {
  SimuladorCredito,
  calcularSimulacao,
  type SimuladorCreditoValues,
} from '@/components/SimuladorCredito'
import { SimulacaoCreditoPdf } from '@/components/SimulacaoCreditoPdf'
import { imprimirSimulacaoCreditoPdf } from '@/lib/simulacaoCreditoPdf'
import { saveSimulacaoDraft, type SimulacaoDraft } from '@/lib/simulacaoDraft'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import './simulacoes.css'

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
  const [values, setValues] = useState<SimulacaoDraft>(initialValues)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const result = useMemo(() => calcularSimulacao(values), [values])
  const dataSimulacao = new Date().toLocaleDateString('pt-BR')

  useEffect(() => {
    let mounted = true
    void supabase.rpc('simulador_parametros_publicos').then(({ data, error }) => {
      if (!mounted) return
      if (error) setSettingsError('Não foi possível confirmar o estado das premissas financeiras.')
      else {
        const payload = (data ?? {}) as { taxa_juros_mensal_default?: number | string | null }
        const rate = payload.taxa_juros_mensal_default
        if (rate !== null && rate !== undefined && Number.isFinite(Number(rate)) && Number(rate) >= 0) {
          setValues(current => ({ ...current, taxa_juros_mensal: Number(rate) }))
        }
      }
      setSettingsLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const patchFinancial = (patch: Partial<SimuladorCreditoValues>) => {
    setValues(current => ({ ...current, ...patch }))
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
      'Prévia sem IOF, TAC, registro e seguros. Esses encargos aguardam validação financeira e podem alterar parcelas e totais. Na modalidade pós-fixada, a variação futura do IPCA também não está projetada. Não representa aprovação nem condição final.',
      'Anexe manualmente o PDF desta simulação antes de enviar.',
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  function convertToProposal() {
    saveSimulacaoDraft(values)
    navigate('/p/propostas/nova')
  }

  return (
    <main className="partner-simulator">
      <header className="partner-simulator__header">
        <div>
          <p className="partner-simulator__eyebrow"><span /> Simulação comercial</p>
          <h1>Simulador</h1>
          <p>Monte uma condição comercial e converta em proposta.</p>
        </div>
        <span className="partner-simulator__status"><i /> Prévia em edição</span>
      </header>

      <section className="partner-simulator__workspace" aria-label="Simulação comercial">
        <div className="partner-simulator__form-heading">
          <span>01</span>
          <div><h2>Condições da operação</h2><p>Defina os parâmetros para calcular a proposta.</p></div>
        </div>
        <div className="partner-simulator__top-fields">
          <label className="partner-simulator__field">
            <span>Produto</span>
            <select className="input" value={values.produto} onChange={event => setValues(current => ({ ...current, produto: event.target.value as SimulacaoDraft['produto'] }))}>
              {Object.entries(PRODUTO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="partner-simulator__field">
            <span>Tipo de pessoa</span>
            <div className="partner-simulator__choice" role="group" aria-label="Tipo de pessoa">
              {(['PF', 'PJ'] as const).map(tipo => (
                <button key={tipo} type="button" aria-pressed={values.pessoa_tipo === tipo} onClick={() => setValues(current => ({ ...current, pessoa_tipo: tipo }))} className={`btn-no-liquid partner-simulator__choice-button ${values.pessoa_tipo === tipo ? 'is-active' : ''}`}>{tipo}</button>
              ))}
            </div>
          </div>
        </div>

        <SimuladorCredito
          values={values}
          onChange={patchFinancial}
          result={result}
          commercialLayout
          resultClassName="partner-simulator__result"
          resultHeader={(
            <div className="partner-simulator__result-header">
              <img src={Logo} alt="Mercurio Capital" width={120} height={32} />
              <div><p>MERCURIO CAPITAL</p><h2>{PRODUTO_LABEL[values.produto]}</h2><small>{values.pessoa_tipo} · Simulação comercial</small></div>
            </div>
          )}
          resultFooter={<p className="partner-simulator__result-footer"><strong>Atualizado agora</strong><span>Simulação em {dataSimulacao}. Condições sujeitas à análise e aprovação.</span></p>}
        />
      </section>

      <section role="status" className="partner-simulator__notice">
        <AlertTriangle aria-hidden="true" />
        <div><strong>Prévia sem encargos financeiros</strong><p>IOF, TAC, registro e seguros ainda aguardam validação financeira e podem alterar parcelas e totais. A variação futura do IPCA também não está projetada. {settingsLoading ? 'Verificando as premissas…' : settingsError || 'Esta simulação não representa uma condição final nem aprovação de crédito.'}</p></div>
      </section>

      <div className="partner-simulator__actions">
        <button type="button" className="btn-no-liquid partner-simulator__action" onClick={imprimirSimulacaoCreditoPdf}>
          <Download className="h-4 w-4" /> Salvar prévia em PDF
        </button>
        <button type="button" className="btn-no-liquid partner-simulator__action" onClick={shareWhatsApp}>
          <MessageCircle className="h-4 w-4" /> Compartilhar
        </button>
        <button type="button" className="btn-no-liquid partner-simulator__action partner-simulator__action--primary" onClick={convertToProposal}>
          <FilePlus2 className="h-4 w-4" /> Converter em proposta
        </button>
      </div>

      <SimulacaoCreditoPdf values={values} produto={PRODUTO_LABEL[values.produto]} pessoaTipo={values.pessoa_tipo} />
    </main>
  )
}
