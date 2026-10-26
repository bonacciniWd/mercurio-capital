import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Home,
  Info,
  LockKeyhole,
  RotateCcw,
} from 'lucide-react'
import {
  calcularSimulacao,
  type SimuladorCreditoValues,
} from '@/components/SimuladorCredito'
import { formatReais, MoneyInput, parseReaisInput } from '@/components/MoneyInput'
import { PublicAmortizationSimulator } from '@/components/PublicAmortizationSimulator'
import { PublicSimulatorModeToggle, type PublicSimulatorMode } from '@/components/PublicSimulatorModeToggle'
import { supabase } from '@/lib/supabase'

const PROPERTY_MIN = 280_000
const CREDIT_MIN = 400_000
const DEFAULT_PROPERTY_VALUE = 850_000
const DEFAULT_CREDIT_VALUE = 400_000
const DEFAULT_RATE = 1.29
const DEFAULT_TERM = 240
const DEFAULT_MAX_LTV = 0.6

const PROPERTY_TYPES = [
  { value: 'casa', label: 'Casa', maxLtv: 0.5 },
  { value: 'casa_condominio', label: 'Casa em condomínio', maxLtv: 0.5 },
  { value: 'apartamento', label: 'Apartamento', maxLtv: 0.6 },
  { value: 'comercial', label: 'Sala comercial', maxLtv: 0.4 },
  { value: 'terreno', label: 'Terreno', maxLtv: 0.3 },
  { value: 'terreno_condominio', label: 'Terreno em condomínio fechado', maxLtv: 0.3 },
  { value: 'predio', label: 'Prédio', maxLtv: 0.4 },
  { value: 'galpao', label: 'Galpão', maxLtv: 0.4 },
  { value: 'fabrica', label: 'Fábrica', maxLtv: 0.4 },
  { value: 'outros', label: 'Outros', maxLtv: 0.4 },
] as const

const OBJECTIVES = ['Quitar dívidas', 'Investir', 'Capital de giro', 'Outros'] as const
const INCOME_TYPES = ['CLT', 'Autônomo', 'Empresário', 'Aposentado'] as const
const HIRING_TIMES = ['Imediatamente', 'Em até 1 mês', 'Em até 3 meses', 'Em até 6 meses', 'Só estou simulando'] as const
const SOURCES = ['Google', 'Facebook ou Instagram', 'Indicação', 'Site da Mercúrio', 'Outro'] as const

type PropertyType = typeof PROPERTY_TYPES[number]['value']
type PropertyStatus = 'quitado' | 'financiado'
type Step = 0 | 1 | 2 | 3

interface PublicSimulatorForm {
  propertyValue: number
  creditValue: number
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

const INITIAL_FORM: PublicSimulatorForm = {
  propertyValue: DEFAULT_PROPERTY_VALUE,
  creditValue: DEFAULT_CREDIT_VALUE,
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

export function PublicSimulator({ embedded = false }: { embedded?: boolean }) {
  const [mode, setMode] = useState<PublicSimulatorMode>('home_equity')
  const [form, setForm] = useState<PublicSimulatorForm>(INITIAL_FORM)
  const [step, setStep] = useState<Step>(0)
  const [error, setError] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey())

  const maxLtv = useMemo(() => {
    if (!form.propertyType) return DEFAULT_MAX_LTV
    return PROPERTY_TYPES.find(type => type.value === form.propertyType)?.maxLtv ?? DEFAULT_MAX_LTV
  }, [form.propertyType])

  const creditMax = useMemo(
    () => Math.floor(form.propertyValue * maxLtv),
    [form.propertyValue, maxLtv],
  )

  const values = useMemo<SimuladorCreditoValues>(() => ({
    valor_solicitado: form.creditValue,
    valor_garantia: form.propertyValue,
    taxa_juros_mensal: DEFAULT_RATE,
    prazo_meses: DEFAULT_TERM,
    carencia_meses: 0,
    correcao: 'pos_fixado',
    amortizacao: 'price',
  }), [form.creditValue, form.propertyValue])

  const simulation = useMemo(() => calcularSimulacao(values), [values])

  function patchForm(patch: Partial<PublicSimulatorForm>) {
    setForm(current => ({ ...current, ...patch }))
    setError('')
  }

  function patchPropertyValue(value: number) {
    const nextMax = Math.floor(value * maxLtv)
    patchForm({
      propertyValue: value,
      creditValue: nextMax >= CREDIT_MIN ? Math.min(form.creditValue, nextMax) : CREDIT_MIN,
    })
  }

  function patchPropertyType(value: PropertyType) {
    const nextLtv = PROPERTY_TYPES.find(type => type.value === value)?.maxLtv ?? DEFAULT_MAX_LTV
    const nextMax = Math.floor(form.propertyValue * nextLtv)
    patchForm({
      propertyType: value,
      creditValue: nextMax >= CREDIT_MIN ? Math.min(form.creditValue, nextMax) : CREDIT_MIN,
    })
  }

  function patchCreditValue(value: number) {
    const maximum = Math.max(CREDIT_MIN, creditMax)
    patchForm({ creditValue: Math.min(Math.max(value, CREDIT_MIN), maximum) })
  }

  function insufficientLtvMessage() {
    const minimumPropertyValue = Math.ceil(CREDIT_MIN / maxLtv)
    return `Para simular a partir de ${formatReais(CREDIT_MIN)} com este imóvel, o valor precisa ser de pelo menos ${formatReais(minimumPropertyValue)}. O limite atual é ${formatReais(creditMax)}.`
  }

  function validateStep(currentStep: Step): string | null {
    if (currentStep === 0) {
      if (form.propertyValue < PROPERTY_MIN) return `O valor do imóvel deve ser de pelo menos ${formatReais(PROPERTY_MIN)}.`
      if (form.creditValue < CREDIT_MIN) return `O crédito mínimo é de ${formatReais(CREDIT_MIN)}.`
      if (form.propertyType && creditMax < CREDIT_MIN) return insufficientLtvMessage()
      if (form.creditValue > creditMax) return `O crédito não pode ultrapassar ${(maxLtv * 100).toFixed(0)}% do valor do imóvel.`
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
      if (creditMax < CREDIT_MIN) return insufficientLtvMessage()
    }

    if (currentStep === 3) {
      if (!form.objective || !form.incomeType || !form.hiringTime) return 'Complete as opções do seu perfil para ver a simulação.'
      if (form.propertyValue < PROPERTY_MIN) return `O valor do imóvel deve ser de pelo menos ${formatReais(PROPERTY_MIN)}.`
      if (form.creditValue < CREDIT_MIN) return `O crédito mínimo é de ${formatReais(CREDIT_MIN)}.`
      if (creditMax < CREDIT_MIN) return insufficientLtvMessage()
      if (form.creditValue > creditMax) return `O crédito solicitado ultrapassa o limite de ${(maxLtv * 100).toFixed(0)}% para este imóvel. Reduza o valor para no máximo ${formatReais(creditMax)}.`
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
      setIsSubmitting(true)
      try {
        const { data: captureData, error: captureError } = await supabase.functions.invoke('public-simulacao-lead', {
          body: {
            idempotency_key: idempotencyKey,
            nome_completo: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            telefone: form.phone,
            cep: form.cep,
            valor_imovel: form.propertyValue,
            valor_credito: form.creditValue,
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
        if (captureError || !captureData?.ok) {
          setError('Não foi possível registrar sua simulação agora. Confira sua conexão e tente novamente.')
          return
        }
        setShowResult(true)
      } catch {
        setError('Não foi possível registrar sua simulação agora. Confira sua conexão e tente novamente.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }
    setStep(current => (current + 1) as Step)
  }

  function back() {
    setError('')
    if (step === 0) return
    setStep(current => (current - 1) as Step)
  }

  function reset() {
    setForm(INITIAL_FORM)
    setStep(0)
    setError('')
    setShowResult(false)
    setIsSubmitting(false)
    setIdempotencyKey(createIdempotencyKey())
  }

  if (mode === 'amortizacao') {
    return (
      <section id={embedded ? 'simulador' : undefined} className={embedded ? 'relative overflow-hidden bg-silver-50 py-20' : 'min-h-screen bg-silver-50 py-8 sm:py-14'}>
        {!embedded && <PublicSimulatorHeader />}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <PublicSimulatorModeToggle mode={mode} onChange={setMode} />
          <PublicAmortizationSimulator />
        </div>
      </section>
    )
  }

  if (showResult) {
    return (
      <section id={embedded ? 'simulador' : undefined} className={embedded ? 'bg-silver-50 py-20' : 'min-h-screen bg-silver-50 py-8 sm:py-14'}>
        {!embedded && <PublicSimulatorHeader />}
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <PublicSimulatorModeToggle mode={mode} onChange={setMode} />
          <ResultPanel form={form} simulation={simulation} onReset={reset} />
        </div>
      </section>
    )
  }

  return (
    <section id={embedded ? 'simulador' : undefined} className={embedded ? 'relative overflow-hidden bg-silver-50 py-20' : 'min-h-screen bg-silver-50 py-8 sm:py-14'}>
      {!embedded && <PublicSimulatorHeader />}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PublicSimulatorModeToggle mode={mode} onChange={setMode} />
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
            <Home className="h-3.5 w-3.5" /> Simulador Mercúrio
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Descubra uma estimativa para o seu crédito</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-silver-600 sm:text-lg">
            Preencha os dados com calma. Em menos de três minutos você terá uma estimativa de parcela para o seu Home Equity.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-silver-200 bg-white p-5 shadow-[0_20px_60px_-32px_rgba(10,43,78,0.45)] sm:p-8 lg:p-10">
          <Progress current={step} />
          <form className="mt-8" onSubmit={event => { event.preventDefault(); void next() }} noValidate>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {step === 0 && <ValuesStep form={form} creditMax={creditMax} maxLtv={maxLtv} onPropertyValue={patchPropertyValue} onCreditValue={patchCreditValue} />}
            {step === 1 && <ContactStep form={form} onChange={patchForm} />}
            {step === 2 && <PropertyStep form={form} maxCredit={creditMax} maxLtv={maxLtv} onChange={patchForm} onPropertyType={patchPropertyType} />}
            {step === 3 && <ProfileStep form={form} onChange={patchForm} />}

            {error && (
              <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={back} disabled={step === 0} className="btn-no-liquid min-h-12 border border-silver-200 bg-white px-5 text-silver-700 hover:bg-silver-50 disabled:invisible">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-no-liquid min-h-12 w-full bg-red-600 px-7 text-base font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto">
                {isSubmitting ? 'Enviando...' : step === 3 ? 'Ver minha simulação' : 'Continuar'} {!isSubmitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>

        <div className="mx-auto mt-5 flex max-w-4xl items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50 px-5 py-4 text-sm text-navy-500">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p>Leva menos de 3 minutos. Esta é uma estimativa inicial e não representa aprovação de crédito.</p>
        </div>
      </div>
    </section>
  )
}

function PublicSimulatorHeader() {
  return (
    <header className="mx-auto mb-10 flex max-w-6xl items-center justify-between px-4 sm:px-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-silver-600 transition hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar para a Mercúrio
      </Link>
      <span className="text-sm font-bold tracking-[0.16em] text-navy">MERCÚRIO CAPITAL</span>
    </header>
  )
}

function Progress({ current }: { current: Step }) {
  return (
    <div aria-label={`Etapa ${current + 1} de ${STEP_LABELS.length}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-silver-500">
        <span className="text-red-700">Passo {current + 1} de {STEP_LABELS.length}</span>
        <span className="hidden sm:inline">{STEP_LABELS[current]}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-silver-100">
        <div className="h-full rounded-full bg-red-600 transition-all duration-300" style={{ width: `${((current + 1) / STEP_LABELS.length) * 100}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] font-medium text-silver-400 sm:text-xs">
        {STEP_LABELS.map((label, index) => <span key={label} className={index <= current ? 'text-navy' : ''}>{label}</span>)}
      </div>
    </div>
  )
}

function ValuesStep({ form, creditMax, maxLtv, onPropertyValue, onCreditValue }: {
  form: PublicSimulatorForm
  creditMax: number
  maxLtv: number
  onPropertyValue: (value: number) => void
  onCreditValue: (value: number) => void
}) {
  return (
    <div>
      <StepHeading eyebrow="Quais os valores da operação?" title="Preencha os dados para gerar sua simulação." description="Começamos pelo valor aproximado do imóvel e pelo crédito que você procura." />
      <div className="mt-8 grid gap-8">
        <MoneyInput label="Valor aproximado do imóvel" value={form.propertyValue} required onChange={onPropertyValue} hint={`O valor mínimo do imóvel é ${formatReais(PROPERTY_MIN)}.`} inputClassName="h-14 rounded-2xl px-4 text-base" />
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="public-credit-range" className="label mb-0">Valor do empréstimo</label>
            <span className="text-sm font-semibold text-navy">{formatReais(form.creditValue)}</span>
          </div>
          <input
            id="public-credit-range"
            type="range"
            min={CREDIT_MIN}
            max={Math.max(CREDIT_MIN, creditMax)}
            step={5_000}
            value={Math.min(Math.max(form.creditValue, CREDIT_MIN), Math.max(CREDIT_MIN, creditMax))}
            onChange={event => onCreditValue(Number(event.currentTarget.value))}
            disabled={creditMax < CREDIT_MIN}
            className="mt-5 h-2 w-full cursor-pointer accent-red-600"
            aria-describedby="public-credit-range-hint"
          />
          <div id="public-credit-range-hint" className="mt-2 flex items-start justify-between gap-4 text-sm text-silver-600">
            <span>Valor mínimo<br /><strong className="font-semibold text-navy">{formatReais(CREDIT_MIN)}</strong></span>
            <span className="text-right">Valor máximo ({(maxLtv * 100).toFixed(0)}% LTV)<br /><strong className="font-semibold text-navy">{formatReais(creditMax)}</strong></span>
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="public-credit-input">Ou informe o valor</label>
            <input
              id="public-credit-input"
              className="input h-14 rounded-2xl px-4 text-lg font-semibold text-navy"
              type="text"
              inputMode="numeric"
              value={form.creditValue > 0 ? formatReais(form.creditValue) : ''}
              placeholder="R$ 0,00"
              onChange={event => onCreditValue(parseReaisInput(event.currentTarget.value))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactStep({ form, onChange }: { form: PublicSimulatorForm; onChange: (patch: Partial<PublicSimulatorForm>) => void }) {
  return (
    <div>
      <StepHeading eyebrow="Seus dados de contato" title="Onde podemos enviar o resultado?" description="Usaremos estas informações apenas para esta experiência de simulação." />
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <TextField label="Nome completo" value={form.fullName} placeholder="Como você se chama" required onChange={fullName => onChange({ fullName })} className="sm:col-span-2" />
        <TextField label="Celular com DDD" value={form.phone} placeholder="(00) 00000-0000" inputMode="tel" required onChange={phone => onChange({ phone: formatPhone(phone) })} />
        <TextField label="E-mail" value={form.email} placeholder="voce@email.com" type="email" required onChange={email => onChange({ email })} />
      </div>
      <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-silver-600">
        <input type="checkbox" checked={form.consent} onChange={event => onChange({ consent: event.currentTarget.checked })} className="mt-1 h-4 w-4 rounded border-silver-300 accent-red-600" />
        <span>
          Concordo com o uso dos meus dados para gerar esta simulação e receber orientações sobre o próximo passo.{' '}
          <Link className="font-semibold text-red-700 underline underline-offset-2" to="/politica-de-privacidade">Política de Privacidade</Link>
        </span>
      </label>
    </div>
  )
}

function PropertyStep({ form, maxCredit, maxLtv, onChange, onPropertyType }: {
  form: PublicSimulatorForm
  maxCredit: number
  maxLtv: number
  onChange: (patch: Partial<PublicSimulatorForm>) => void
  onPropertyType: (value: PropertyType) => void
}) {
  return (
    <div>
      <StepHeading eyebrow="Sobre o imóvel" title="Agora nos conte sobre a garantia." description="Essas informações ajudam a indicar o limite de crédito aplicável." />
      <div className="mt-8 space-y-7">
        <ChoiceGroup label="Tipo do imóvel" options={PROPERTY_TYPES.map(type => ({ value: type.value, label: type.label }))} value={form.propertyType} onChange={value => onPropertyType(value as PropertyType)} columns="sm:grid-cols-2" />
        {form.propertyType && (
        <p className="-mt-5 text-sm text-silver-500" aria-live="polite">
          {maxCredit < CREDIT_MIN
            ? `Para o crédito mínimo de ${formatReais(CREDIT_MIN)}, este imóvel precisa valer pelo menos ${formatReais(Math.ceil(CREDIT_MIN / maxLtv))}. O limite atual é ${formatReais(maxCredit)}.`
            : `Limite para este imóvel: até ${(maxLtv * 100).toFixed(0)}% do valor, ou ${formatReais(maxCredit)} de crédito.`}
        </p>
        )}
        <ChoiceGroup label="Situação do imóvel" options={[{ value: 'quitado', label: 'Quitado' }, { value: 'financiado', label: 'Financiado' }]} value={form.propertyStatus} onChange={value => onChange({ propertyStatus: value as PropertyStatus })} columns="sm:grid-cols-2" />
        <TextField label="CEP do imóvel" value={form.cep} placeholder="00000-000" inputMode="numeric" required onChange={cep => onChange({ cep: formatCep(cep) })} />
      </div>
    </div>
  )
}

function ProfileStep({ form, onChange }: { form: PublicSimulatorForm; onChange: (patch: Partial<PublicSimulatorForm>) => void }) {
  return (
    <div>
      <StepHeading eyebrow="Seu perfil" title="Só mais algumas informações sobre você." description="Elas ajudam a contextualizar a simulação para a equipe." />
      <div className="mt-8 space-y-7">
        <MoneyInput label="Renda mensal aproximada (opcional)" value={form.income} onChange={income => onChange({ income })} hint="Você pode deixar em branco se estiver apenas simulando." inputClassName="h-14 rounded-2xl px-4 text-base" />
        <ChoiceGroup label="Qual o objetivo do seu crédito?" options={OBJECTIVES.map(value => ({ value, label: value }))} value={form.objective} onChange={value => onChange({ objective: value as PublicSimulatorForm['objective'] })} columns="sm:grid-cols-2" />
        <ChoiceGroup label="Tipo de renda" options={INCOME_TYPES.map(value => ({ value, label: value }))} value={form.incomeType} onChange={value => onChange({ incomeType: value as PublicSimulatorForm['incomeType'] })} columns="sm:grid-cols-2" />
        <ChoiceGroup label="Em quanto tempo pretende contratar?" options={HIRING_TIMES.map(value => ({ value, label: value }))} value={form.hiringTime} onChange={value => onChange({ hiringTime: value as PublicSimulatorForm['hiringTime'] })} />
        <ChoiceGroup label="Como conheceu a Mercúrio? (opcional)" options={SOURCES.map(value => ({ value, label: value }))} value={form.source} onChange={value => onChange({ source: value as PublicSimulatorForm['source'] })} columns="sm:grid-cols-2" />
      </div>
    </div>
  )
}

function ResultPanel({ form, simulation, onReset }: { form: PublicSimulatorForm; simulation: ReturnType<typeof calcularSimulacao>; onReset: () => void }) {
  const { calculo, ltv } = simulation
  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Simulação concluída</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Olá, {firstName(form.fullName)}.</h1>
        <p className="mt-2 text-lg text-silver-600">Aqui está uma estimativa para o seu Home Equity.</p>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-silver-200 bg-white shadow-[0_20px_60px_-32px_rgba(10,43,78,0.45)]">
        <div className="grid gap-6 border-b border-silver-100 p-6 sm:grid-cols-2 sm:p-8">
          <Metric label="Valor solicitado" value={formatReais(form.creditValue)} accent />
          <Metric label="Taxa estimada" value={`${DEFAULT_RATE.toFixed(2).replace('.', ',')}% a.m.`} />
        </div>
        <div className="grid gap-6 bg-silver-50 p-6 sm:grid-cols-3 sm:p-8">
          <Metric label="Parcela estimada" value={formatReais(calculo.primeiraParcela)} accent />
          <Metric label="Prazo" value={`${DEFAULT_TERM} meses`} />
          <Metric label="LTV" value={`${(ltv * 100).toFixed(1).replace('.', ',')}%`} />
        </div>
        <div className="border-t border-silver-100 p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50 p-4 text-sm leading-relaxed text-navy-500">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p>O valor é uma estimativa. IOF, tarifas bancárias, análise de crédito e condições finais não estão incluídos e podem alterar a parcela.</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onReset} className="btn-no-liquid min-h-12 flex-1 border border-silver-300 bg-white text-silver-700 hover:bg-silver-50"><RotateCcw className="h-4 w-4" /> Refazer simulação</button>
            <Link to="/p/login" className="btn-no-liquid min-h-12 flex-1 bg-red-600 text-center text-white hover:bg-red-700">Área do parceiro <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-4 text-center text-sm text-silver-500">
            Já é cliente? <Link to="/c/login" className="font-semibold text-navy underline decoration-silver-300 underline-offset-4 hover:text-red-700">Entrar no portal do cliente</Link>
          </div>
        </div>
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-silver-500"><LockKeyhole className="h-4 w-4" /> Enviamos o resultado para o e-mail informado. Esta é uma estimativa e não representa aprovação.</p>
    </div>
  )
}

function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-red-700">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h1>
      <p className="mt-2 text-base text-silver-600">{description}</p>
    </div>
  )
}

function TextField({ label, value, placeholder, type = 'text', inputMode, required, onChange, className = '' }: {
  label: string
  value: string
  placeholder: string
  type?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  required?: boolean
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={`public-${label.toLowerCase().replace(/\W+/g, '-')}`}>{label}{required ? ' *' : ''}</label>
      <input
        id={`public-${label.toLowerCase().replace(/\W+/g, '-')}`}
        className="input h-14 rounded-2xl px-4 text-base"
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={event => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

function ChoiceGroup({ label, options, value, onChange, columns = '' }: {
  label: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  columns?: string
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className={`grid gap-3 ${columns}`}>
        {options.map(option => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`btn-no-liquid min-h-14 justify-start border px-4 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 ${selected ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100' : 'border-silver-200 bg-white text-silver-700 hover:border-navy-200 hover:bg-silver-50'}`}
            >
              {selected && <Check className="h-4 w-4 shrink-0" />}
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-sm text-silver-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-red-700' : 'text-navy'}`}>{value}</p>
    </div>
  )
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || 'cliente'
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}
