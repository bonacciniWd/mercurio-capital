import { useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { createCpcIdempotencyKey, submitPublicCpcLead, type CpcProjectStage, type PublicCpcLeadResult } from '@/lib/cpcLead'

type FormValues = {
  nome_completo: string
  email: string
  telefone: string
  cidade: string
  uf: string
  fase_projeto: CpcProjectStage | ''
  resumo_projeto: string
  consentimento: boolean
  website: string
}

const initialValues: FormValues = {
  nome_completo: '',
  email: '',
  telefone: '',
  cidade: '',
  uf: '',
  fase_projeto: '',
  resumo_projeto: '',
  consentimento: false,
  website: '',
}

const stages: Array<{ value: CpcProjectStage; label: string }> = [
  { value: 'terreno_definido', label: 'Terreno definido' },
  { value: 'projeto_aprovado', label: 'Projeto aprovado' },
  { value: 'orcamento_cronograma', label: 'Orçamento e cronograma disponíveis' },
  { value: 'obra_iniciada', label: 'Obra iniciada' },
  { value: 'outro', label: 'Outro' },
]

function phoneDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function phoneDisplay(value: string) {
  const digits = phoneDigits(value)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function CpcLeadForm() {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const idempotencyKey = useRef<string | null>(null)

  function patch<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
    setMessage(null)
  }

  function validate() {
    const next: typeof errors = {}
    const phone = phoneDigits(values.telefone)
    if (values.nome_completo.trim().length < 3) next.nome_completo = 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Informe um e-mail válido.'
    if (phone.length < 10 || phone.length > 11) next.telefone = 'Informe um telefone com DDD.'
    if (values.uf && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(values.uf.toUpperCase())) next.uf = 'Informe uma UF brasileira válida.'
    if (!values.fase_projeto) next.fase_projeto = 'Selecione a fase atual do projeto.'
    if (values.resumo_projeto.trim().length > 2000) next.resumo_projeto = 'Use até 2.000 caracteres.'
    if (!values.consentimento) next.consentimento = 'O consentimento é obrigatório para enviar seus dados.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !validate()) return
    setBusy(true)
    setMessage(null)
    idempotencyKey.current ??= createCpcIdempotencyKey()

    let result: PublicCpcLeadResult
    try {
      result = await submitPublicCpcLead({
        idempotency_key: idempotencyKey.current,
        nome_completo: values.nome_completo.trim(),
        email: values.email.trim().toLowerCase(),
        telefone: phoneDigits(values.telefone),
        cidade: values.cidade.trim() || null,
        uf: values.uf.trim().toUpperCase() || null,
        fase_projeto: values.fase_projeto as CpcProjectStage,
        resumo_projeto: values.resumo_projeto.trim() || null,
        consentimento: true,
        website: values.website,
      })
    } catch {
      result = { ok: false, error: 'lead_capture_failed' }
    }

    setBusy(false)
    if (!result.ok) {
      setMessage({
        kind: 'error',
        text: result.error === 'capture_disabled'
          ? 'O recebimento deste formulário está temporariamente indisponível.'
          : 'Não foi possível enviar agora. Seus dados continuam neste formulário; tente novamente em instantes.',
      })
      return
    }

    setMessage({ kind: 'success', text: 'Recebemos seu contato sobre o projeto CPC. A equipe poderá falar com você pelos dados informados.' })
  }

  if (message?.kind === 'success') {
    return <div className="cpc-form-success" role="status">
      <CheckCircle2 aria-hidden="true" />
      <div><h3>Solicitação recebida</h3><p>{message.text}</p></div>
    </div>
  }

  const inputClass = 'cpc-form-control'
  return (
    <form className="cpc-lead-form" onSubmit={submit} noValidate>
      <div className="cpc-form-heading">
        <h3>Conte sobre o seu projeto</h3>
        <p>Os campos com * são obrigatórios. Não envie documentos nem informações financeiras sensíveis.</p>
      </div>

      <div className="cpc-form-grid">
        <label className="cpc-form-field cpc-form-field-wide">
          <span>Nome completo *</span>
          <input className={inputClass} autoComplete="name" maxLength={160} value={values.nome_completo} onChange={event => patch('nome_completo', event.target.value)} aria-invalid={Boolean(errors.nome_completo)} aria-describedby={errors.nome_completo ? 'cpc-name-error' : undefined} />
          {errors.nome_completo && <small id="cpc-name-error" className="cpc-form-error">{errors.nome_completo}</small>}
        </label>
        <label className="cpc-form-field">
          <span>E-mail *</span>
          <input className={inputClass} type="email" autoComplete="email" maxLength={254} value={values.email} onChange={event => patch('email', event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'cpc-email-error' : undefined} />
          {errors.email && <small id="cpc-email-error" className="cpc-form-error">{errors.email}</small>}
        </label>
        <label className="cpc-form-field">
          <span>Telefone com DDD *</span>
          <input className={inputClass} type="tel" autoComplete="tel" inputMode="tel" maxLength={16} placeholder="(00) 00000-0000" value={phoneDisplay(values.telefone)} onChange={event => patch('telefone', phoneDigits(event.target.value))} aria-invalid={Boolean(errors.telefone)} aria-describedby={errors.telefone ? 'cpc-phone-error' : undefined} />
          {errors.telefone && <small id="cpc-phone-error" className="cpc-form-error">{errors.telefone}</small>}
        </label>
        <label className="cpc-form-field cpc-form-field-wide">
          <span>Fase atual do projeto *</span>
          <select className={inputClass} value={values.fase_projeto} onChange={event => patch('fase_projeto', event.target.value as CpcProjectStage | '')} aria-invalid={Boolean(errors.fase_projeto)} aria-describedby={errors.fase_projeto ? 'cpc-stage-error' : undefined}>
            <option value="">Selecione uma opção</option>
            {stages.map(stage => <option value={stage.value} key={stage.value}>{stage.label}</option>)}
          </select>
          {errors.fase_projeto && <small id="cpc-stage-error" className="cpc-form-error">{errors.fase_projeto}</small>}
        </label>
        <label className="cpc-form-field">
          <span>Cidade do projeto</span>
          <input className={inputClass} autoComplete="address-level2" maxLength={100} value={values.cidade} onChange={event => patch('cidade', event.target.value)} />
        </label>
        <label className="cpc-form-field">
          <span>UF</span>
          <input className={inputClass} autoComplete="address-level1" maxLength={2} placeholder="SC" value={values.uf} onChange={event => patch('uf', event.target.value.replace(/[^a-z]/gi, '').slice(0, 2))} aria-invalid={Boolean(errors.uf)} aria-describedby={errors.uf ? 'cpc-uf-error' : undefined} />
          {errors.uf && <small id="cpc-uf-error" className="cpc-form-error">{errors.uf}</small>}
        </label>
        <label className="cpc-form-field cpc-form-field-wide">
          <span>Resumo do projeto (opcional)</span>
          <textarea className={`${inputClass} cpc-form-textarea`} maxLength={2000} value={values.resumo_projeto} onChange={event => patch('resumo_projeto', event.target.value)} aria-invalid={Boolean(errors.resumo_projeto)} aria-describedby={errors.resumo_projeto ? 'cpc-summary-error' : undefined} />
          {errors.resumo_projeto && <small id="cpc-summary-error" className="cpc-form-error">{errors.resumo_projeto}</small>}
          <small className="cpc-form-hint">Até 2.000 caracteres. Não inclua dados pessoais de terceiros.</small>
        </label>
      </div>

      <div className="cpc-honeypot" aria-hidden="true">
        <label htmlFor="cpc-website">Deixe este campo vazio</label>
        <input id="cpc-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={event => patch('website', event.target.value)} />
      </div>

      <label className="cpc-consent">
        <input type="checkbox" checked={values.consentimento} onChange={event => patch('consentimento', event.target.checked)} aria-invalid={Boolean(errors.consentimento)} aria-describedby={errors.consentimento ? 'cpc-consent-error' : undefined} />
        <span>Autorizo a Mercúrio Capital a entrar em contato sobre meu projeto CPC. <a href="/politica-de-privacidade">Política de Privacidade <ArrowUpRight aria-hidden="true" /></a></span>
      </label>
      {errors.consentimento && <small id="cpc-consent-error" className="cpc-form-error cpc-consent-error">{errors.consentimento}</small>}

      {message?.kind === 'error' && <p role="alert" className="cpc-form-error-message">{message.text}</p>}
      <button className="btn-no-liquid cpc-button cpc-form-submit" type="submit" disabled={busy}>
        {busy ? <>Enviando <LoaderCircle className="cpc-form-spinner" aria-hidden="true" /></> : <>Enviar solicitação <ArrowUpRight aria-hidden="true" /></>}
      </button>
    </form>
  )
}
