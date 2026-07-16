import { calcularFinanciamento, calcularLTV, type CalcResult } from '@/lib/credito'
import { brl } from '@/lib/utils'
import { parseRangeInteger } from '@/lib/range'
import { MoneyInput } from '@/components/MoneyInput'
import type { ReactNode, Ref } from 'react'

export const PRAZO_MIN_MESES = 12
export const PRAZO_MAX_MESES = 240
export const CARENCIA_MIN_MESES = 0
export const CARENCIA_MAX_MESES = 3

export interface SimuladorCreditoValues {
  valor_solicitado: number
  valor_garantia: number
  taxa_juros_mensal: number
  prazo_meses: number
  carencia_meses: number
  correcao: 'pos_fixado' | 'pre_fixado'
  amortizacao: 'price' | 'sac'
}

export interface SimuladorCreditoResult {
  calculo: CalcResult
  ltv: number
}

export function calcularSimulacao(values: SimuladorCreditoValues): SimuladorCreditoResult {
  return {
    calculo: calcularFinanciamento({
      valor: values.valor_solicitado,
      prazoMeses: values.prazo_meses,
      taxaMensal: values.taxa_juros_mensal / 100,
      amortizacao: values.amortizacao,
      carenciaMeses: values.carencia_meses,
    }),
    ltv: calcularLTV(values.valor_solicitado, values.valor_garantia),
  }
}

export function SimuladorCredito({
  values,
  onChange,
  garantiaEditavel = true,
  garantiaHint,
  result,
  resultClassName = '',
  resultRef,
  resultHeader,
  resultFooter,
}: {
  values: SimuladorCreditoValues
  onChange: (patch: Partial<SimuladorCreditoValues>) => void
  garantiaEditavel?: boolean
  garantiaHint?: string
  result?: SimuladorCreditoResult
  resultClassName?: string
  resultRef?: Ref<HTMLDivElement>
  resultHeader?: ReactNode
  resultFooter?: ReactNode
}) {
  const simulation = result ?? calcularSimulacao(values)
  const { calculo, ltv } = simulation
  const updatePrazo = (raw: string) => onChange({
    prazo_meses: parseRangeInteger(raw, values.prazo_meses, PRAZO_MIN_MESES, PRAZO_MAX_MESES),
  })
  const updateCarencia = (raw: string) => onChange({
    carencia_meses: parseRangeInteger(raw, values.carencia_meses, CARENCIA_MIN_MESES, CARENCIA_MAX_MESES),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <MoneyInput label="Crédito desejado" value={values.valor_solicitado} onChange={value => onChange({ valor_solicitado: value })} />
        <MoneyInput label="Valor da garantia" value={values.valor_garantia} disabled={!garantiaEditavel} hint={garantiaHint} onChange={value => onChange({ valor_garantia: value })} />
        <div>
          <label className="label">Taxa de juros mensal (%)</label>
          <input className="input" type="number" min={0} step={0.01} value={values.taxa_juros_mensal} onChange={event => onChange({ taxa_juros_mensal: Number(event.target.value) })} />
        </div>
        <Segmented label="Correção" value={values.correcao} options={[['pos_fixado', 'Pós (IPCA)'], ['pre_fixado', 'Pré-fixado']]} onChange={value => onChange({ correcao: value as SimuladorCreditoValues['correcao'] })} />
        <Segmented label="Amortização" value={values.amortizacao} options={[['price', 'PRICE'], ['sac', 'SAC']]} onChange={value => onChange({ amortizacao: value as SimuladorCreditoValues['amortizacao'] })} />
        <Range label={`Prazo: ${values.prazo_meses} meses`} min={PRAZO_MIN_MESES} max={PRAZO_MAX_MESES} value={values.prazo_meses} onChange={updatePrazo} />
        <Range label={`Carência: ${values.carencia_meses} meses`} min={CARENCIA_MIN_MESES} max={CARENCIA_MAX_MESES} value={values.carencia_meses} onChange={updateCarencia} />
      </div>
      <div ref={resultRef} className={`rounded-md border border-red-600/30 bg-white p-5 ${resultClassName}`}>
        {resultHeader}
        <p className="text-xs font-semibold uppercase text-red-600">Resultado</p>
        <dl className="mt-4 space-y-3 text-sm">
          <ResultRow label="Crédito desejado" value={brl(values.valor_solicitado * 100)} strong />
          <ResultRow label="Valor da garantia" value={brl(values.valor_garantia * 100)} />
          <ResultRow label="LTV" value={`${(ltv * 100).toFixed(1)}%`} strong />
          <ResultRow label="Condição" value={`${values.taxa_juros_mensal.toFixed(2).replace('.', ',')}% a.m. · ${values.prazo_meses} meses`} />
          <ResultRow label="Amortização" value={`${values.amortizacao.toUpperCase()} · ${values.correcao === 'pos_fixado' ? 'IPCA' : 'Pré-fixado'}`} />
          <ResultRow label="1ª parcela" value={brl(calculo.primeiraParcela * 100)} strong />
          <ResultRow label="Última parcela" value={brl(calculo.ultimaParcela * 100)} strong />
          <ResultRow label="Total a pagar" value={brl(calculo.totalPago * 100)} />
          <ResultRow label="Total de juros" value={brl(calculo.totalJuros * 100)} />
          <ResultRow label="Renda mínima" value={`${brl(calculo.rendaMinima * 100)}/mês`} strong />
        </dl>
        {resultFooter}
      </div>
    </div>
  )
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div><label className="label">{label}</label><div className="inline-flex gap-2">{options.map(([key, text]) => <button key={key} type="button" onClick={() => onChange(key)} className={`btn-no-liquid rounded-md border px-4 py-1.5 text-sm font-medium ${value === key ? 'border-red-600 bg-red-600 text-white' : 'border-silver-300 bg-silver-100 text-silver-600'}`}>{text}</button>)}</div></div>
}

function Range({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (raw: string) => void }) {
  return <div><label className="label">{label}</label><input type="range" min={min} max={max} step={1} value={value} onChange={event => onChange(event.currentTarget.value)} onInput={event => onChange(event.currentTarget.value)} className="w-full accent-red-600" /></div>
}

function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-silver-600">{label}</dt><dd className={strong ? 'font-semibold text-navy' : 'text-silver-800'}>{value}</dd></div>
}