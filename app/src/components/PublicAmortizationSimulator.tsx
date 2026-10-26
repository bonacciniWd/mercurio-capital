import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3 } from 'lucide-react'
import { calcularFinanciamento, type AmortizacaoTipo, type CalcResult } from '@/lib/credito'
import { formatReais, MoneyInput } from '@/components/MoneyInput'
import { supabase } from '@/lib/supabase'
import { plansToApi, validarPlanosAmortizacao, type PlanoAmortizacaoExtra } from '@/lib/amortizacaoPlanos'
import { PublicAmortizationResult as AmortizationResult } from '@/components/PublicAmortizationResult'
import {
  addMonthsToDateInput,
  taxaMensalFromInput,
  todayDateInput,
  type PeriodicidadeJuros,
  type PublicAmortizationScheduleRow,
} from '@/lib/amortizacaoPublica'

const DEFAULT_PRINCIPAL = 1_000_000
const MIN_PRINCIPAL = 400_000
const DEFAULT_RATE = 1.29
const DEFAULT_TERM = 240
const MAX_TERM = 320

const PROPERTY_TYPES = [
  { value: 'casa', label: 'Casa' },
  { value: 'casa_condominio', label: 'Casa em condomínio' },
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'comercial', label: 'Sala comercial' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'terreno_condominio', label: 'Terreno em condomínio fechado' },
  { value: 'predio', label: 'Prédio' },
  { value: 'galpao', label: 'Galpão' },
  { value: 'fabrica', label: 'Fábrica' },
  { value: 'outros', label: 'Outros' },
] as const
const OBJECTIVES = ['Quitar dívidas', 'Investir', 'Capital de giro', 'Outros'] as const
const INCOME_TYPES = ['CLT', 'Autônomo', 'Empresário', 'Aposentado'] as const
const HIRING_TIMES = ['Imediatamente', 'Em até 1 mês', 'Em até 3 meses', 'Em até 6 meses', 'Só estou simulando'] as const
const SOURCES = ['Google', 'Facebook ou Instagram', 'Indicação', 'Site da Mercúrio', 'Outro'] as const

type PropertyType = typeof PROPERTY_TYPES[number]['value']
type PropertyStatus = 'quitado' | 'financiado'
type Step = 0 | 1 | 2 | 3

export interface AmortizationForm {
  principal: number
  startDate: string
  rate: number
  ratePeriod: PeriodicidadeJuros
  system: AmortizacaoTipo
  terms: number
  fullName: string
  phone: string
  email: string
  consent: boolean
  propertyType: PropertyType | ''
  propertyStatus: PropertyStatus | ''
  cep: string
  income: number
  objective: typeof OBJECTIVES[number] | ''
  incomeType: typeof INCOME_TYPES[number] | ''
  hiringTime: typeof HIRING_TIMES[number] | ''
  source: typeof SOURCES[number] | ''
}

const INITIAL_FORM: AmortizationForm = {
  principal: DEFAULT_PRINCIPAL,
  startDate: todayDateInput(),
  rate: DEFAULT_RATE,
  ratePeriod: 'mensal',
  system: 'price',
  terms: DEFAULT_TERM,
  fullName: '',
  phone: '',
  email: '',
  consent: false,
  propertyType: '',
  propertyStatus: '',
  cep: '',
  income: 0,
  objective: '',
  incomeType: '',
  hiringTime: '',
  source: '',
}

const STEP_LABELS = ['Valores', 'Contato', 'Imóvel', 'Perfil']

export function PublicAmortizationSimulator() {
  const [form, setForm] = useState<AmortizationForm>(INITIAL_FORM)
  const [step, setStep] = useState<Step>(0)
  const [error, setError] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey())

  const monthlyRate = useMemo(() => taxaMensalFromInput(form.rate, form.ratePeriod), [form.rate, form.ratePeriod])
  const calculation = useMemo<CalcResult>(() => calcularFinanciamento({
    valor: form.principal,
    prazoMeses: form.terms,
    taxaMensal: monthlyRate,
    amortizacao: form.system,
  }), [form.principal, form.system, form.terms, monthlyRate])
  const schedule = useMemo<PublicAmortizationScheduleRow[]>(() => calculation.parcelas.map(row => ({
    ...row,
    data: addMonthsToDateInput(form.startDate, row.mes),
  })), [calculation.parcelas, form.startDate])

  function patchForm(patch: Partial<AmortizationForm>) {
    setForm(current => ({ ...current, ...patch }))
    setError('')
  }

  function validateStep(currentStep: Step): string | null {
    if (currentStep === 0) {
      if (!Number.isFinite(form.principal) || form.principal < MIN_PRINCIPAL) return `O valor mínimo do empréstimo é ${formatReais(MIN_PRINCIPAL)}.`
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) return 'Informe a data de início.'
      if (!Number.isFinite(form.rate) || form.rate < 0 || form.rate > 100) return 'Informe uma taxa entre 0% e 100%.'
      if (!Number.isInteger(form.terms) || form.terms < 1 || form.terms > MAX_TERM) return `Informe entre 1 e ${MAX_TERM} parcelas.`
    }
    if (currentStep === 1) {
      if (form.fullName.trim().length < 3) return 'Informe seu nome completo.'
      const phoneDigits = form.phone.replace(/\D/g, '')
      if (phoneDigits.length < 10 || phoneDigits.length > 11) return 'Informe um celular válido com DDD.'
      if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Informe um e-mail válido.'
      if (!form.consent) return 'Aceite o uso dos dados para continuar a simulação.'
    }
    if (currentStep === 2) {
      if (!form.propertyType) return 'Selecione o tipo do imóvel.'
      if (!form.propertyStatus) return 'Selecione a situação do imóvel.'
      if (form.cep.replace(/\D/g, '').length !== 8) return 'Informe um CEP válido com oito dígitos.'
    }
    if (currentStep === 3 && (!form.objective || !form.incomeType || !form.hiringTime)) {
      return 'Complete as opções do seu perfil para ver a simulação.'
    }
    return null
  }

  async function next() {
    const validationError = validateStep(step)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    if (step === 3) {
      setShowResult(true)
      return
    }
    setStep(current => (current + 1) as Step)
  }

  function back() {
    setError('')
    if (step > 0) setStep(current => (current - 1) as Step)
  }

  function reset() {
    setForm({ ...INITIAL_FORM, startDate: todayDateInput() })
    setStep(0)
    setError('')
    setShowResult(false)
    setIsSubmitting(false)
    setSaved(false)
    setIdempotencyKey(createIdempotencyKey())
  }

  async function saveSimulation(planos: PlanoAmortizacaoExtra[]): Promise<boolean> {
    if (saved || isSubmitting) return saved
    if (!Number.isFinite(form.principal) || form.principal < MIN_PRINCIPAL) {
      setError(`O valor mínimo do empréstimo é ${formatReais(MIN_PRINCIPAL)}.`)
      return false
    }
    const planError = validarPlanosAmortizacao(planos, form.principal, form.terms)
    if (planError) {
      setError(planError)
      return false
    }
    setIsSubmitting(true)
    setError('')
    try {
      const { data, error: captureError } = await supabase.functions.invoke('public-simulacao-lead', {
        body: {
          tipo_simulacao: 'amortizacao',
          idempotency_key: idempotencyKey,
          nome_completo: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          telefone: form.phone,
          cep: form.cep,
          valor_credito: form.principal,
          prazo_meses: form.terms,
          data_inicio: form.startDate,
          taxa_juros_informada: form.rate,
          periodicidade_juros: form.ratePeriod,
          sistema_amortizacao: form.system,
          quantidade_parcelas: form.terms,
          taxa_juros_mensal: monthlyRate * 100,
          primeira_parcela: calculation.primeiraParcela,
          ultima_parcela: calculation.ultimaParcela,
          total_pago: calculation.totalPago,
          total_juros: Math.max(0, calculation.totalJuros),
          planos_amortizacao: plansToApi(planos),
          tipo_imovel: form.propertyType,
          situacao_imovel: form.propertyStatus,
          renda_mensal: form.income || null,
          objetivo_credito: form.objective,
          tipo_renda: form.incomeType,
          prazo_contratacao: form.hiringTime,
          origem: form.source || null,
          consentimento: form.consent,
          website: '',
        },
      })
      if (captureError || !data?.ok) {
        setError('Não foi possível registrar sua simulação agora. Confira sua conexão e tente novamente.')
        return false
      }
      setSaved(true)
      return true
    } catch {
      setError('Não foi possível registrar sua simulação agora. Confira sua conexão e tente novamente.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showResult) {
    return <AmortizationResult form={form} calculation={calculation} schedule={schedule} onReset={reset} onSave={saveSimulation} isSaving={isSubmitting} saved={saved} error={error} />
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Simulador Mercúrio</span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Simulador de amortização</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-silver-600 sm:text-lg">Compare parcelas fixas e decrescentes com um cronograma detalhado.</p>
      </div>

      <div className="mx-auto mt-10 max-w-5xl rounded-3xl border border-silver-200 bg-white p-5 shadow-[0_20px_60px_-32px_rgba(10,43,78,0.45)] sm:p-8 lg:p-10">
        <Progress current={step} />
        <form className="mt-8" onSubmit={event => { event.preventDefault(); void next() }} noValidate>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          {step === 0 && <ValuesStep form={form} onChange={patchForm} />}
          {step === 1 && <ContactStep form={form} onChange={patchForm} />}
          {step === 2 && <PropertyStep form={form} onChange={patchForm} />}
          {step === 3 && <ProfileStep form={form} onChange={patchForm} />}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={back} disabled={step === 0} className="btn-no-liquid min-h-12 border border-silver-200 bg-white px-5 text-silver-700 hover:bg-silver-50 disabled:invisible"><ArrowLeft className="h-4 w-4" /> Voltar</button>
            <button type="submit" disabled={isSubmitting} className="btn-no-liquid min-h-12 w-full bg-red-600 px-7 text-base font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto">{isSubmitting ? 'Enviando...' : step === 3 ? 'Ver minha simulação' : 'Continuar'} {!isSubmitting && <ArrowRight className="h-4 w-4" />}</button>
          </div>
        </form>
      </div>
      <div className="mx-auto mt-5 flex max-w-5xl items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50 px-5 py-4 text-sm text-navy-500"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><p>Leva menos de 3 minutos. O resultado é uma estimativa e não representa aprovação de crédito.</p></div>
    </div>
  )
}

function ValuesStep({ form, onChange }: { form: AmortizationForm; onChange: (patch: Partial<AmortizationForm>) => void }) {
  return (
    <div>
      <StepHeading eyebrow="Quais os dados da operação?" title="Preencha os dados para gerar sua simulação." description="Escolha entre parcelas fixas (Price) e parcelas decrescentes (SAC)." />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <MoneyInput label="Valor do empréstimo" value={form.principal} required onChange={principal => onChange({ principal })} hint={`Valor mínimo da simulação: ${formatReais(MIN_PRINCIPAL)}.`} inputClassName="h-14 rounded-2xl px-4 text-base" />
        <div><label className="label" htmlFor="amortization-start-date">Data de início *</label><input id="amortization-start-date" className="input h-14 rounded-2xl px-4 text-base" type="date" value={form.startDate} onChange={event => onChange({ startDate: event.currentTarget.value })} /></div>
        <div><label className="label" htmlFor="amortization-system">Sistema de amortização *</label><div className="relative"><select id="amortization-system" className="input h-14 appearance-none rounded-2xl px-4 pr-12 text-base" value={form.system} onChange={event => onChange({ system: event.currentTarget.value as AmortizacaoTipo })}><option value="price">Tabela Price — parcelas fixas</option><option value="sac">Tabela SAC — parcelas decrescentes</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-500" /></div></div>
        <div><label className="label" htmlFor="amortization-rate">Taxa de juros (%) *</label><input id="amortization-rate" className="input h-14 rounded-2xl px-4 text-base" type="number" min="0" max="100" step="0.01" value={form.rate} onChange={event => onChange({ rate: Number(event.currentTarget.value) })} /></div>
        <div><label className="label" htmlFor="amortization-rate-period">Periodicidade da taxa *</label><div className="relative"><select id="amortization-rate-period" className="input h-14 appearance-none rounded-2xl px-4 pr-12 text-base" value={form.ratePeriod} onChange={event => onChange({ ratePeriod: event.currentTarget.value as PeriodicidadeJuros })}><option value="mensal">Mensal (a.m.)</option><option value="anual">Anual (a.a.)</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-500" /></div></div>
        <div><label className="label" htmlFor="amortization-terms">Quantidade de parcelas *</label><input id="amortization-terms" className="input h-14 rounded-2xl px-4 text-base" type="number" min="1" max={MAX_TERM} step="1" value={form.terms} onChange={event => onChange({ terms: Number(event.currentTarget.value) })} /><p className="mt-1 text-xs text-silver-500">Até {MAX_TERM} parcelas.</p></div>
      </div>
    </div>
  )
}

function ContactStep({ form, onChange }: { form: AmortizationForm; onChange: (patch: Partial<AmortizationForm>) => void }) {
  return <div><StepHeading eyebrow="Seus dados de contato" title="Onde podemos enviar o resultado?" description="Usaremos estas informações para esta simulação e para orientar o próximo passo." /><div className="mt-8 grid gap-5 sm:grid-cols-2"><TextField label="Nome completo" value={form.fullName} placeholder="Como você se chama" required onChange={fullName => onChange({ fullName })} className="sm:col-span-2" /><TextField label="Celular com DDD" value={form.phone} placeholder="(00) 00000-0000" inputMode="tel" required onChange={phone => onChange({ phone: formatPhone(phone) })} /><TextField label="E-mail" value={form.email} placeholder="voce@email.com" type="email" required onChange={email => onChange({ email })} /></div><label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-silver-600"><input type="checkbox" checked={form.consent} onChange={event => onChange({ consent: event.currentTarget.checked })} className="mt-1 h-4 w-4 rounded border-silver-300 accent-red-600" /><span>Concordo com o uso dos meus dados para gerar esta simulação e receber orientações sobre o próximo passo.{' '}<Link className="font-semibold text-red-700 underline underline-offset-2" to="/politica-de-privacidade">Política de Privacidade</Link></span></label></div>
}

function PropertyStep({ form, onChange }: { form: AmortizationForm; onChange: (patch: Partial<AmortizationForm>) => void }) {
  return <div><StepHeading eyebrow="Sobre o imóvel" title="Agora nos conte sobre a garantia." description="Essas informações ajudam a equipe a contextualizar a simulação." /><div className="mt-8 space-y-7"><ChoiceGroup label="Tipo do imóvel" options={PROPERTY_TYPES.map(type => ({ value: type.value, label: type.label }))} value={form.propertyType} onChange={value => onChange({ propertyType: value as PropertyType })} columns="sm:grid-cols-2" /><ChoiceGroup label="Situação do imóvel" options={[{ value: 'quitado', label: 'Quitado' }, { value: 'financiado', label: 'Financiado' }]} value={form.propertyStatus} onChange={value => onChange({ propertyStatus: value as PropertyStatus })} columns="sm:grid-cols-2" /><TextField label="CEP do imóvel" value={form.cep} placeholder="00000-000" inputMode="numeric" required onChange={cep => onChange({ cep: formatCep(cep) })} /></div></div>
}

function ProfileStep({ form, onChange }: { form: AmortizationForm; onChange: (patch: Partial<AmortizationForm>) => void }) {
  return <div><StepHeading eyebrow="Seu perfil" title="Só mais algumas informações sobre você." description="Elas ajudam a equipe a contextualizar a simulação." /><div className="mt-8 space-y-7"><MoneyInput label="Renda mensal aproximada (opcional)" value={form.income} onChange={income => onChange({ income })} hint="Você pode deixar em branco se estiver apenas simulando." inputClassName="h-14 rounded-2xl px-4 text-base" /><ChoiceGroup label="Qual o objetivo do seu crédito?" options={OBJECTIVES.map(value => ({ value, label: value }))} value={form.objective} onChange={value => onChange({ objective: value as AmortizationForm['objective'] })} columns="sm:grid-cols-2" /><ChoiceGroup label="Tipo de renda" options={INCOME_TYPES.map(value => ({ value, label: value }))} value={form.incomeType} onChange={value => onChange({ incomeType: value as AmortizationForm['incomeType'] })} columns="sm:grid-cols-2" /><ChoiceGroup label="Em quanto tempo pretende contratar?" options={HIRING_TIMES.map(value => ({ value, label: value }))} value={form.hiringTime} onChange={value => onChange({ hiringTime: value as AmortizationForm['hiringTime'] })} /><ChoiceGroup label="Como conheceu a Mercúrio? (opcional)" options={SOURCES.map(value => ({ value, label: value }))} value={form.source} onChange={value => onChange({ source: value as AmortizationForm['source'] })} columns="sm:grid-cols-2" /></div></div>
}


function Progress({ current }: { current: Step }) { return <div aria-label={`Etapa ${current + 1} de ${STEP_LABELS.length}`}><div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-silver-500"><span className="text-red-700">Passo {current + 1} de {STEP_LABELS.length}</span><span className="hidden sm:inline">{STEP_LABELS[current]}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-silver-100"><div className="h-full rounded-full bg-red-600 transition-all duration-300" style={{ width: `${((current + 1) / STEP_LABELS.length) * 100}%` }} /></div><div className="mt-2 grid grid-cols-4 gap-2 text-[10px] font-medium text-silver-400 sm:text-xs">{STEP_LABELS.map((label, index) => <span key={label} className={index <= current ? 'text-navy' : ''}>{label}</span>)}</div></div> }
function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><p className="text-sm font-bold uppercase tracking-[0.12em] text-red-700">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h1><p className="mt-2 text-base text-silver-600">{description}</p></div> }
function TextField({ label, value, placeholder, type = 'text', inputMode, required, onChange, className = '' }: { label: string; value: string; placeholder: string; type?: string; inputMode?: 'text' | 'numeric' | 'tel' | 'email'; required?: boolean; onChange: (value: string) => void; className?: string }) { const id = `amortization-${label.toLowerCase().replace(/\W+/g, '-')}`; return <div className={className}><label className="label" htmlFor={id}>{label}{required ? ' *' : ''}</label><input id={id} className="input h-14 rounded-2xl px-4 text-base" type={type} inputMode={inputMode} value={value} placeholder={placeholder} required={required} onChange={event => onChange(event.currentTarget.value)} /></div> }
function ChoiceGroup({ label, options, value, onChange, columns = '' }: { label: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void; columns?: string }) { return <fieldset><legend className="label">{label}</legend><div className={`grid gap-3 ${columns}`}>{options.map(option => { const selected = option.value === value; return <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(option.value)} className={`btn-no-liquid min-h-14 justify-start border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 ${selected ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100' : 'border-silver-200 bg-white text-silver-700 hover:border-navy-200 hover:bg-silver-50'}`}>{selected && <Check className="h-4 w-4 shrink-0" />}{option.label}</button> })}</div></fieldset> }
function formatPhone(value: string) { const digits = value.replace(/\D/g, '').slice(0, 11); if (digits.length <= 2) return digits.length ? `(${digits}` : ''; if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`; if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`; return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` }
function formatCep(value: string) { const digits = value.replace(/\D/g, '').slice(0, 8); return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits }
function createIdempotencyKey() { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const random = Math.random() * 16 | 0; const value = char === 'x' ? random : (random & 0x3) | 0x8; return value.toString(16) }) }
