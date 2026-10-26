import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CheckCircle2, FileDown, Info, LockKeyhole, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MoneyInput, formatReais } from '@/components/MoneyInput'
import logoWide from '@/assets/logos/logowide.png'
import { calcularComparativoAmortizacao, validarPlanosAmortizacao, type ParcelaComAmortizacaoExtra, type PlanoAmortizacaoExtra } from '@/lib/amortizacaoPlanos'
import { addMonthsToDateInput, formatDateInput, type PublicAmortizationScheduleRow } from '@/lib/amortizacaoPublica'
import type { CalcResult } from '@/lib/credito'
import type { AmortizationForm } from '@/components/PublicAmortizationSimulator'

type Scenario = 'base' | 'extra'
type ExtraRow = ParcelaComAmortizacaoExtra & { data: string }

export function PublicAmortizationResult({
  form, calculation, schedule, onReset, onSave, isSaving, saved, error,
}: {
  form: AmortizationForm
  calculation: CalcResult
  schedule: PublicAmortizationScheduleRow[]
  onReset: () => void
  onSave: (plans: PlanoAmortizacaoExtra[]) => Promise<boolean>
  isSaving: boolean
  saved: boolean
  error: string
}) {
  const [plans, setPlans] = useState<PlanoAmortizacaoExtra[]>([])
  const [draft, setDraft] = useState<PlanoAmortizacaoExtra | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [planError, setPlanError] = useState('')
  const [scenario, setScenario] = useState<Scenario>('base')
  const [page, setPage] = useState(1)
  const pageSize = 12
  // The first monthly interest exactly identifies the effective monthly rate, including annual input conversion.
  const monthlyRate = calculation.parcelas.length ? calculation.parcelas[0].juros / form.principal : 0
  const comparison = useMemo(() => calcularComparativoAmortizacao({
    valor: form.principal, prazoMeses: form.terms, taxaMensal: monthlyRate, amortizacao: form.system,
  }, plans), [form.principal, form.terms, monthlyRate, form.system, plans])
  const baseRows = schedule
  const extraRows: ExtraRow[] = comparison.comAntecipacao.parcelas.map(row => ({ ...row, data: addMonthsToDateInput(form.startDate, row.mes) }))
  const selectedRows = scenario === 'base' ? baseRows : extraRows
  const totalPages = Math.max(1, Math.ceil(selectedRows.length / pageSize))
  const visibleRows = selectedRows.slice((page - 1) * pageSize, page * pageSize)
  const chartData = Array.from({ length: Math.max(baseRows.length, extraRows.length) }, (_, index) => ({
    parcela: index + 1,
    base: baseRows[index]?.parcela ?? null,
    extra: extraRows[index]?.pagamentoTotal ? extraRows[index].pagamentoTotal : null,
    amortizacaoExtra: extraRows[index]?.amortizacaoExtra ? extraRows[index].amortizacaoExtra : null,
  }))
  const baseResult = comparison.semAntecipacao
  const extraResult = comparison.comAntecipacao

  function openNewPlan() {
    setEditingId(null)
    setPlanError('')
    setDraft({ id: createPlanId(), valorExtra: 0, objetivo: 'prazo', frequencia: 'unica', aposParcela: 1 })
  }

  function openEditPlan(plan: PlanoAmortizacaoExtra) {
    setEditingId(plan.id)
    setPlanError('')
    setDraft({ ...plan })
  }

  function savePlan() {
    if (!draft) return
    const validation = validarPlanosAmortizacao([draft], form.principal, form.terms)
    if (validation) {
      setPlanError(validation)
      return
    }
    setPlans(current => editingId ? current.map(item => item.id === editingId ? draft : item) : [...current, draft])
    setScenario('extra')
    setPage(1)
    setDraft(null)
    setPlanError('')
  }

  function removePlan(id: string) {
    setPlans(current => current.filter(plan => plan.id !== id))
    setPage(1)
  }

  async function saveLead() {
    const validation = validarPlanosAmortizacao(plans, form.principal, form.terms)
    if (validation) {
      setPlanError(validation)
      return
    }
    setPlanError('')
    await onSave(plans)
  }

  function printPdf() {
    if (plans.length === 0) return
    const originalTitle = document.title
    const name = form.fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'
    document.title = `Mercurio-Capital-Simulacao-Amortizacao-${name}`
    const restoreTitle = () => {
      document.title = originalTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle, { once: true })
    window.print()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="no-print text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Simulação pronta para revisar</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Olá, {firstName(form.fullName)}.</h1>
        <p className="mt-2 text-lg text-silver-600">Adicione planos para comparar o efeito da amortização extra.</p>
      </div>

      <section className="no-print mt-8 rounded-3xl border border-silver-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold text-navy">Planos de amortização extra</h2><p className="mt-1 text-sm text-silver-500">Defina valores únicos ou mensais e veja o comparativo mudar na hora.</p></div>
          <button type="button" onClick={openNewPlan} disabled={saved || plans.length >= 10} className="btn-no-liquid min-h-11 bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Adicionar plano</button>
        </div>
        {plans.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-silver-300 bg-silver-50 p-5 text-sm text-silver-600">Nenhum plano adicional. O comparativo está mostrando o financiamento original.</div> : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {plans.map((plan, index) => <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-silver-200 p-4">
              <div><p className="font-semibold text-navy">Plano {index + 1} · {formatReais(plan.valorExtra)} {plan.frequencia === 'mensal' ? 'por mês' : 'uma vez'}</p><p className="mt-1 text-xs text-silver-500">Após a parcela {plan.aposParcela} · reduz {plan.objetivo === 'prazo' ? 'prazo' : 'valor das parcelas'}</p></div>
              {!saved && <div className="flex gap-2"><button type="button" onClick={() => openEditPlan(plan)} className="btn-outline min-h-9 px-3 text-xs"><Pencil className="h-3.5 w-3.5" /> Editar</button><button type="button" aria-label={`Remover plano ${index + 1}`} onClick={() => removePlan(plan.id)} className="btn-outline min-h-9 px-3 text-xs text-red-700"><Trash2 className="h-3.5 w-3.5" /> Remover</button></div>}
            </div>)}
          </div>
        )}
        {plans.length >= 10 && <p className="mt-3 text-xs text-silver-500">Limite de 10 planos por simulação.</p>}
      </section>

      <section className="no-print mt-5 rounded-3xl border border-silver-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold text-navy">Resumo do resultado</h2>
        {plans.length > 0 && <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900">
          Com os planos configurados, você amortizará um total extra de <strong>{formatReais(extraResult.totalAmortizacaoExtra)}</strong>.
          {' '}O prazo estimado será de <strong>{extraResult.parcelas.length} {extraResult.parcelas.length === 1 ? 'mês' : 'meses'}</strong>
          {comparison.parcelasReduzidas > 0
            ? <>, com redução de <strong>{comparison.parcelasReduzidas} {comparison.parcelasReduzidas === 1 ? 'mês' : 'meses'}</strong></>
            : ', mantendo o prazo original'}.
          {' '}A economia estimada em juros será de <strong>{formatReais(Math.max(0, comparison.economiaJuros))}</strong>.
        </p>}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ScenarioSummary title="Sem antecipação de pagamento" principal={form.principal} totalPago={baseResult.totalPago} totalAmortizado={0} totalJuros={baseResult.totalJuros} rate={form.rate} period={form.ratePeriod} count={baseResult.parcelas.length} first={baseResult.primeiraParcela} last={baseResult.ultimaParcela} payoff={schedule[schedule.length - 1]?.data ?? ''} system={form.system} />
          <ScenarioSummary title="Com antecipação de pagamento" principal={form.principal} totalPago={extraResult.totalPago} totalAmortizado={extraResult.totalAmortizacaoExtra} totalJuros={extraResult.totalJuros} rate={form.rate} period={form.ratePeriod} count={extraResult.parcelas.length} first={extraResult.primeiraParcela} last={extraResult.ultimaParcela} payoff={extraRows[extraRows.length - 1]?.data ?? ''} system={form.system} />
        </div>
        <div className="mt-6 rounded-2xl border border-silver-200 p-4 sm:p-5">
          <h3 className="font-bold text-navy">Comparativo das parcelas</h3>
          <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}><CartesianGrid stroke="#E9ECEF" vertical={false} /><XAxis dataKey="parcela" tickLine={false} axisLine={false} fontSize={11} /><YAxis tickLine={false} axisLine={false} width={76} fontSize={11} tickFormatter={value => `R$ ${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value: number | string, name: string) => [formatReais(Number(value)), name === 'base' ? 'Sem amortização' : name === 'extra' ? 'Com amortização' : 'Amortização extra']} /><Legend formatter={value => value === 'base' ? 'Sem amortização' : value === 'extra' ? 'Com amortização' : 'Amortização extra'} /><Line type="monotone" dataKey="base" name="base" stroke="#0B2B4E" strokeWidth={2.5} dot={false} connectNulls={false} /><Line type="monotone" dataKey="extra" name="extra" stroke="#D62828" strokeWidth={2.5} dot={false} connectNulls={false} /><Line type="monotone" dataKey="amortizacaoExtra" name="amortizacaoExtra" stroke="#D79B27" strokeWidth={1.5} dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div>
        </div>
      </section>

      <section className="no-print mt-5 rounded-3xl border border-silver-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-navy">Cronograma detalhado</h2><p className="mt-1 text-sm text-silver-500">{plans.length > 0 ? 'Visualize 12 parcelas por página. O documento inclui o cronograma completo.' : 'Adicione e salve um plano extra para habilitar o PDF completo.'}</p></div>{plans.length > 0 && <button type="button" onClick={printPdf} className="btn-outline min-h-10 px-4 text-sm"><FileDown className="h-4 w-4" /> Salvar como PDF</button>}</div>
        <div className="mt-5 inline-flex rounded-xl border border-silver-200 bg-silver-50 p-1" role="tablist" aria-label="Cenário do cronograma">
          <button type="button" role="tab" aria-selected={scenario === 'base'} onClick={() => { setScenario('base'); setPage(1) }} className={`btn-no-liquid min-h-10 rounded-lg px-4 text-sm font-semibold ${scenario === 'base' ? 'bg-red-600 text-white' : 'text-silver-600 hover:bg-white'}`}>Sem amortização</button>
          <button type="button" role="tab" aria-selected={scenario === 'extra'} onClick={() => { setScenario('extra'); setPage(1) }} className={`btn-no-liquid min-h-10 rounded-lg px-4 text-sm font-semibold ${scenario === 'extra' ? 'bg-red-600 text-white' : 'text-silver-600 hover:bg-white'}`}>Com amortização</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-silver-200"><table className="w-full min-w-[900px] text-sm"><ScheduleHeader /><tbody>{visibleRows.map(row => <ScheduleRow key={row.mes} row={row} extra={scenario === 'extra'} />)}</tbody></table></div>
        <div className="mt-4 flex items-center justify-between text-sm text-silver-600"><span>Parcelas {(page - 1) * pageSize + (selectedRows.length ? 1 : 0)}–{Math.min(page * pageSize, selectedRows.length)} de {selectedRows.length}</span><div className="flex gap-2"><button type="button" className="btn-outline min-h-9 px-3 text-xs" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Anterior</button><button type="button" className="btn-outline min-h-9 px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Próxima</button></div></div>
      </section>

      <section className="no-print mt-5 rounded-3xl border border-silver-200 bg-white p-5 shadow-sm sm:p-7">
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        {planError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{planError}</p>}
        <div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onReset} className="btn-no-liquid min-h-12 flex-1 border border-silver-300 bg-white text-silver-700 hover:bg-silver-50"><RotateCcw className="h-4 w-4" /> Refazer simulação</button><button type="button" onClick={() => void saveLead()} disabled={isSaving || saved} className="btn-no-liquid min-h-12 flex-1 bg-red-600 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">{saved ? <><CheckCircle2 className="h-4 w-4" /> Simulação salva e enviada</> : isSaving ? 'Enviando...' : <>Salvar simulação e receber resultado <ArrowRight className="h-4 w-4" /></>}</button></div>
        {saved ? <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Resultado enviado para o e-mail informado.</p> : <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-silver-500"><LockKeyhole className="h-4 w-4" /> Seus dados só serão registrados quando você salvar a simulação.</p>}
        <p className="mt-5 flex items-start gap-2 rounded-xl border border-navy-100 bg-navy-50 p-4 text-xs leading-relaxed text-navy-500"><Info className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> IOF, tarifas bancárias, análise de crédito e condições finais não estão incluídos e podem alterar os valores. Esta estimativa não representa aprovação de crédito.</p>
      </section>

      {draft && <PlanEditor draft={draft} isEditing={Boolean(editingId)} principal={form.principal} terms={form.terms} error={planError} onChange={setDraft} onClose={() => { setDraft(null); setPlanError('') }} onSave={savePlan} />}
      {plans.length > 0 && <PrintDocument form={form} principal={form.principal} base={baseResult} extra={extraResult} baseRows={baseRows} extraRows={extraRows} plans={plans} monthlyRate={monthlyRate} chartData={chartData} />}
    </div>
  )
}

function ScenarioSummary({ title, principal, totalPago, totalAmortizado, totalJuros, rate, period, count, first, last, payoff, system }: { title: string; principal: number; totalPago: number; totalAmortizado: number; totalJuros: number; rate: number; period: string; count: number; first: number; last: number; payoff: string; system: string }) {
  const rows = [
    ['Valor emprestado', formatReais(principal)], ['Total a ser pago', formatReais(totalPago)], ['Total amortizado extra', formatReais(totalAmortizado)], ['Total de juros', formatReais(Math.max(0, totalJuros))], ['Taxa de juros', `${rate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% ${period === 'mensal' ? 'a.m.' : 'a.a.'}`], ['Quantidade de parcelas', String(count)], ['Valor da primeira parcela', formatReais(first)], ['Valor da última parcela', formatReais(last)], ['Data da última parcela', payoff ? formatDateInput(payoff) : '—'], ['Sistema de amortização', system === 'sac' ? 'Tabela SAC' : 'Tabela Price'],
  ]
  return <div className="overflow-hidden rounded-2xl border border-silver-200"><h3 className="border-b border-silver-200 bg-silver-50 px-4 py-3 font-bold text-navy">{title}</h3>{rows.map(([label, value], index) => <div key={label} className={`flex items-start justify-between gap-3 px-4 py-2.5 text-sm ${index % 2 ? 'bg-navy-50/70' : 'bg-white'}`}><span className="text-silver-600">{label}</span><strong className="text-right text-silver-900">{value}</strong></div>)}</div>
}

function ScheduleHeader() {
  return <thead className="bg-silver-50 text-left text-xs uppercase tracking-wide text-silver-500"><tr><th className="px-3 py-3">Parcela</th><th className="px-3 py-3">Data</th><th className="px-3 py-3 text-right">Dívida</th><th className="px-3 py-3 text-right">Juros</th><th className="px-3 py-3 text-right">Amortização</th><th className="px-3 py-3 text-right">Extra</th><th className="px-3 py-3 text-right">Pagamento total</th><th className="px-3 py-3 text-right">Saldo</th></tr></thead>
}

function ScheduleRow({ row, extra }: { row: PublicAmortizationScheduleRow | ExtraRow; extra: boolean }) {
  const withExtra = row as ExtraRow
  return <tr className="border-t border-silver-100"><td className="px-3 py-3 text-silver-600">{row.mes}</td><td className="whitespace-nowrap px-3 py-3 text-silver-600">{formatDateInput(row.data)}</td><td className="px-3 py-3 text-right text-silver-600">{formatReais(row.saldo + row.amortizacao + (extra ? withExtra.amortizacaoExtra : 0))}</td><td className="px-3 py-3 text-right text-silver-600">{formatReais(row.juros)}</td><td className="px-3 py-3 text-right text-silver-600">{formatReais(row.amortizacao)}</td><td className="px-3 py-3 text-right text-silver-600">{formatReais(extra ? withExtra.amortizacaoExtra : 0)}</td><td className="px-3 py-3 text-right font-semibold text-navy">{formatReais(extra ? withExtra.pagamentoTotal : row.parcela)}</td><td className="px-3 py-3 text-right text-silver-600">{formatReais(row.saldo)}</td></tr>
}

function PlanEditor({ draft, isEditing, principal, terms, error, onChange, onClose, onSave }: { draft: PlanoAmortizacaoExtra; isEditing: boolean; principal: number; terms: number; error: string; onChange: (next: PlanoAmortizacaoExtra) => void; onClose: () => void; onSave: () => void }) {
  const toggleClass = (active: boolean) => `btn-no-liquid min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold transition ${active ? 'border-red-600 bg-red-600 text-white' : 'border-silver-200 bg-white text-silver-600 hover:bg-silver-50'}`
  return <div className="no-print fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-navy-950/45 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="amortization-plan-title" className="my-6 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><h2 id="amortization-plan-title" className="text-2xl font-bold text-navy">{isEditing ? 'Editar plano de amortização' : 'Novo plano de amortização'}</h2><p className="mt-1 text-sm text-silver-500">O valor extra será aplicado depois da parcela escolhida.</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="btn-outline min-h-9 px-3">×</button></div>
    <div className="mt-6 space-y-5"><MoneyInput label="Valor da amortização" required value={draft.valorExtra} onChange={valorExtra => onChange({ ...draft, valorExtra })} inputClassName="h-14 rounded-xl px-4 text-base" /><div><p className="label">Quer amortizar no prazo ou na parcela?</p><div className="mt-2 flex gap-2"><button type="button" aria-pressed={draft.objetivo === 'prazo'} className={toggleClass(draft.objetivo === 'prazo')} onClick={() => onChange({ ...draft, objetivo: 'prazo' })}>Reduzir prazo</button><button type="button" aria-pressed={draft.objetivo === 'parcela'} className={toggleClass(draft.objetivo === 'parcela')} onClick={() => onChange({ ...draft, objetivo: 'parcela' })}>Reduzir parcela</button></div></div><div><p className="label">Frequência da amortização</p><div className="mt-2 flex gap-2"><button type="button" aria-pressed={draft.frequencia === 'unica'} className={toggleClass(draft.frequencia === 'unica')} onClick={() => onChange({ ...draft, frequencia: 'unica' })}>Uma vez</button><button type="button" aria-pressed={draft.frequencia === 'mensal'} className={toggleClass(draft.frequencia === 'mensal')} onClick={() => onChange({ ...draft, frequencia: 'mensal' })}>Mensal</button></div>{draft.frequencia === 'mensal' && <p className="mt-2 text-xs text-silver-500">O mesmo valor será amortizado mensalmente, a partir da parcela escolhida, até a quitação.</p>}</div><div><label htmlFor="amortization-plan-after" className="label">Após a parcela *</label><input id="amortization-plan-after" className="input mt-1 h-14 px-4 text-base" type="number" min="1" max={terms} step="1" value={draft.aposParcela} onChange={event => onChange({ ...draft, aposParcela: Number(event.currentTarget.value) })} /><p className="mt-1 text-xs text-silver-500">Escolha uma parcela entre 1 e {terms}.</p></div>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3 border-t border-silver-100 pt-5"><button type="button" onClick={onClose} className="btn-outline min-h-11 px-5">Cancelar</button><button type="button" onClick={onSave} className="btn-no-liquid min-h-11 bg-red-600 px-5 font-bold text-white hover:bg-red-700">Salvar plano</button></div><p className="text-xs text-silver-400">Valor principal: {formatReais(principal)}</p></div></section></div>
}

type ComparisonPoint = { parcela: number; base: number | null; extra: number | null; amortizacaoExtra: number | null }

function PrintDocument({ form, principal, base, extra, baseRows, extraRows, plans, monthlyRate, chartData }: { form: AmortizationForm; principal: number; base: { totalPago: number; totalJuros: number }; extra: { totalPago: number; totalJuros: number; totalAmortizacaoExtra: number; parcelas: Array<{ mes: number; juros: number; amortizacao: number; parcela: number; pagamentoTotal: number; amortizacaoExtra: number; saldo: number }> }; baseRows: PublicAmortizationScheduleRow[]; extraRows: ExtraRow[]; plans: PlanoAmortizacaoExtra[]; monthlyRate: number; chartData: ComparisonPoint[] }) {
  return createPortal(<article className="print-document">
    <header className="mb-6 flex items-center justify-between border-b border-silver-200 pb-4"><img src={logoWide} alt="Mercúrio Capital" className="h-12 w-auto object-contain" /><div className="text-right"><h1 className="text-xl font-bold text-navy">Simulação de amortização</h1><p className="text-sm text-silver-500">{form.fullName} · {new Date().toLocaleDateString('pt-BR')}</p></div></header>
    <p className="mb-4 text-sm text-silver-700">Crédito {formatReais(principal)} · {form.system === 'sac' ? 'Tabela SAC' : 'Tabela Price'} · Taxa {form.rate.toLocaleString('pt-BR')}% {form.ratePeriod === 'mensal' ? 'a.m.' : 'a.a.'} (equivalente mensal {(monthlyRate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%) · Prazo original {form.terms} meses.</p>
    <div className="mb-5 grid grid-cols-2 gap-4"><PrintSummary title="Sem antecipação" principal={principal} totalPago={base.totalPago} totalExtra={0} juros={base.totalJuros} count={baseRows.length} /><PrintSummary title="Com antecipação" principal={principal} totalPago={extra.totalPago} totalExtra={extra.totalAmortizacaoExtra} juros={extra.totalJuros} count={extraRows.length} /></div>
    <section className="mb-5 rounded-lg border border-silver-200 p-3"><h2 className="mb-2 font-bold text-navy">Comparativo das parcelas</h2><PrintComparisonChart data={chartData} /></section>
    {plans.length > 0 && <div className="mb-5"><h2 className="mb-2 font-bold text-navy">Planos cadastrados</h2>{plans.map((plan, index) => <p key={plan.id} className="text-sm text-silver-700">{index + 1}. {formatReais(plan.valorExtra)} {plan.frequencia === 'mensal' ? 'mensais' : 'uma vez'}, após a parcela {plan.aposParcela}, reduzindo {plan.objetivo === 'prazo' ? 'o prazo' : 'o valor das parcelas'}.</p>)}</div>}
    <PrintSchedule title="Cronograma sem antecipação" rows={baseRows.map(row => ({ ...row, amortizacaoExtra: 0, pagamentoTotal: row.parcela }))} />
    <PrintSchedule title="Cronograma com antecipação" rows={extraRows} />
    <footer className="mt-6 border-t border-silver-200 pt-3 text-xs leading-relaxed text-silver-500">Estimativa para fins informativos. IOF, tarifas bancárias, seguros, análise de crédito e condições finais podem alterar os valores. Este documento não é uma aprovação de crédito nem uma proposta vinculante. Mercúrio Capital · mercuriocapitalsa.com.br</footer>
    <style>{`@media screen { .print-document { display:none; } } @media print { @page { size:A4; margin:14mm; } html, body { margin:0 !important; padding:0 !important; background:#fff !important; } body > * { display:none !important; } body > .print-document { display:block !important; } .print-document { position:static !important; inset:auto !important; width:182mm !important; max-width:100% !important; box-sizing:border-box !important; margin:0 !important; padding:0 !important; background:#fff; color:#172b45; font:9pt Arial,sans-serif; } .print-document table { width:100%; table-layout:fixed; border-collapse:collapse; font-size:7.5pt; } .print-document thead { display:table-header-group; } .print-document tr { break-inside:avoid; page-break-inside:avoid; } .print-document th,.print-document td { padding:4px 5px; border:1px solid #d6dbe2; } .print-document th { background:#eef2f7 !important; text-align:left; print-color-adjust:exact; -webkit-print-color-adjust:exact; } .print-document .print-page-break { break-before:page; page-break-before:always; } }`}</style>
  </article>, document.body)
}

function PrintComparisonChart({ data }: { data: ComparisonPoint[] }) {
  const width = 760
  const height = 220
  const left = 74
  const right = 14
  const top = 12
  const bottom = 36
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const values = data.flatMap(point => [point.base, point.extra, point.amortizacaoExtra]).filter((value): value is number => value !== null)
  const maximum = Math.max(...values, 1)
  const yMaximum = maximum * 1.08
  const x = (index: number) => left + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotWidth)
  const y = (value: number) => top + plotHeight - (value / yMaximum) * plotHeight
  const series = [
    { key: 'base' as const, label: 'Sem amortização', color: '#0B2B4E' },
    { key: 'extra' as const, label: 'Com amortização', color: '#D62828' },
    { key: 'amortizacaoExtra' as const, label: 'Amortização extra', color: '#D79B27' },
  ]
  const linePaths = (key: typeof series[number]['key']) => {
    const segments: string[] = []
    let current: string[] = []
    data.forEach((point, index) => {
      const value = point[key]
      if (value === null) {
        if (current.length) segments.push(current.join(' '))
        current = []
      } else {
        current.push(`${current.length ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
      }
    })
    if (current.length) segments.push(current.join(' '))
    return segments
  }
  const compactMoney = (value: number) => value >= 1000 ? `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : formatReais(value)

  return <svg role="img" aria-label="Gráfico comparativo das parcelas sem e com amortização extra" viewBox={`0 0 ${width} ${height}`} width="100%" height="220" preserveAspectRatio="xMinYMin meet" style={{ fontFamily: 'Arial, sans-serif' }}>
    {Array.from({ length: 5 }, (_, index) => {
      const value = (yMaximum * index) / 4
      const lineY = y(value)
      return <g key={index}><line x1={left} x2={width - right} y1={lineY} y2={lineY} stroke="#E9ECEF" strokeWidth="1" /><text x={left - 8} y={lineY + 3} fill="#667085" fontSize="10" textAnchor="end">{compactMoney(value)}</text></g>
    })}
    <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} stroke="#98A2B3" strokeWidth="1" />
    <text x={left} y={height - 20} fill="#667085" fontSize="10">Parcela 1</text>
    <text x={width - right} y={height - 20} fill="#667085" fontSize="10" textAnchor="end">Parcela {data.length}</text>
    {series.map(item => linePaths(item.key).map((path, index) => <path key={`${item.key}-${index}`} d={path} fill="none" stroke={item.color} strokeWidth={item.key === 'amortizacaoExtra' ? 1.8 : 2.5} strokeLinejoin="round" strokeLinecap="round" />))}
    {series.map((item, index) => <g key={item.key} transform={`translate(${left + index * 205}, ${height - 3})`}><line x1="0" x2="18" y1="0" y2="0" stroke={item.color} strokeWidth="2.5" /><text x="24" y="3" fill="#344054" fontSize="10">{item.label}</text></g>)}
  </svg>
}

function PrintSummary({ title, principal, totalPago, totalExtra, juros, count }: { title: string; principal: number; totalPago: number; totalExtra: number; juros: number; count: number }) {
  return <div className="rounded-lg border border-silver-200 p-3"><h2 className="mb-2 font-bold text-navy">{title}</h2><p>Valor emprestado: <strong>{formatReais(principal)}</strong></p><p>Total a pagar: <strong>{formatReais(totalPago)}</strong></p><p>Amortizado extra: <strong>{formatReais(totalExtra)}</strong></p><p>Total de juros: <strong>{formatReais(juros)}</strong></p><p>Parcelas: <strong>{count}</strong></p></div>
}

function PrintSchedule({ title, rows }: { title: string; rows: Array<PublicAmortizationScheduleRow & { amortizacaoExtra: number; pagamentoTotal: number }> }) {
  return <section className="mb-5"><h2 className="mb-2 text-base font-bold text-navy">{title}</h2><table><thead><tr><th>Parcela</th><th>Data</th><th>Juros</th><th>Amortização</th><th>Extra</th><th>Pagamento</th><th>Saldo</th></tr></thead><tbody>{rows.map(row => <tr key={row.mes}><td>{row.mes}</td><td>{formatDateInput(row.data)}</td><td>{formatReais(row.juros)}</td><td>{formatReais(row.amortizacao)}</td><td>{formatReais(row.amortizacaoExtra)}</td><td>{formatReais(row.pagamentoTotal)}</td><td>{formatReais(row.saldo)}</td></tr>)}</tbody></table></section>
}

function firstName(value: string) { return value.trim().split(/\s+/)[0] || 'cliente' }
function createPlanId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `plano-${Date.now()}-${Math.random().toString(16).slice(2)}` }
