import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import iconWingUrl from '@/assets/logos/icon-wing.svg'
import logoSvg from '@/assets/logos/logo.svg?raw'
import { supabase } from '@/lib/supabase'
import { DEFAULT_MERX_FAQ, findMerxAnswer, MERX_INTEREST_LABELS, type MerxFaqItem, type MerxInterest } from '@/lib/merxPublica'
import { isValidEmailFormat, normalizeEmail } from '@/lib/emailValidation'
import { executeRecaptchaV3, loadRecaptchaV3 } from '@/lib/recaptchaV3'

type Message = { id: number; from: 'merx' | 'visitor'; text: string }
type FlowStep = 'name' | 'intent' | 'product' | 'originator_result' | 'customer_result' | 'faq'

const merxLogoMarkup = logoSvg
  .replace('viewBox="0 0 1024 1024"', 'viewBox="280 300 465 415"')
  .replace('animation: writeEraseLoop 9.5s ease-in-out infinite;', 'animation: merxDraw 15s ease-in-out infinite;')
  .replace(/@keyframes writeEraseLoop \{[\s\S]*?\n {4}\}/, '@keyframes merxDraw {\n      0% { stroke-dashoffset: 800; fill-opacity: 0; }\n      22% { stroke-dashoffset: 0; fill-opacity: 1; }\n      96%, 100% { stroke-dashoffset: 0; fill-opacity: 1; }\n    }')
const launcherLogoMarkup = merxLogoMarkup.replace(/redStroke/g, 'merxLauncherStroke').replace(/redFill/g, 'merxLauncherFill')

export function MerxPublicChat() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [thinkingMessageId, setThinkingMessageId] = useState<number | null>(null)
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null)
  const [visibleCharacters, setVisibleCharacters] = useState(0)
  const [announcedAnswer, setAnnouncedAnswer] = useState('')
  const [greeting, setGreeting] = useState('Como posso ajudar?')
  const [fallbackMessage, setFallbackMessage] = useState('Ainda não encontrei essa informação no FAQ público.')
  const [flowStep, setFlowStep] = useState<FlowStep>('name')
  const [visitorName, setVisitorName] = useState('')
  const [contactName, setContactName] = useState('')
  const [interest, setInterest] = useState<MerxInterest>('atendimento')
  const [contactOpen, setContactOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactEmailTouched, setContactEmailTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [captureEnabled, setCaptureEnabled] = useState(false)
  const [faq, setFaq] = useState<MerxFaqItem[]>(DEFAULT_MERX_FAQ)
  const nextId = useRef(1)
  const requestInFlight = useRef(false)
  const idempotencyKey = useRef<string | null>(null)
  const closeChatRef = useRef<() => void>(() => {})
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const activeFaq = useMemo(() => faq.filter((item): item is MerxFaqItem => Boolean(item && typeof item === 'object' && typeof item.question === 'string' && item.question.trim() && typeof item.answer === 'string' && item.answer.trim() && Array.isArray(item.keywords) && item.keywords.length && item.keywords.every(keyword => typeof keyword === 'string'))), [faq])
  const suggestedFaq = useMemo(() => activeFaq.filter(item => item.id !== 'saudacao').slice(0, 3), [activeFaq])
  const configuredAnswer = (id: string, fallback: string) => activeFaq.find(item => item.id === id)?.answer ?? fallback

  useEffect(() => {
    const message = messages.find(item => item.id === thinkingMessageId)
    if (!message) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setThinkingMessageId(null)
      setTypingMessageId(message.id)
      return
    }

    const timer = window.setTimeout(() => {
      setThinkingMessageId(null)
      setTypingMessageId(message.id)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [messages, thinkingMessageId])

  useEffect(() => {
    const message = messages.find(item => item.id === typingMessageId)
    if (!message) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCharacters(message.text.length)
      setTypingMessageId(null)
      setAnnouncedAnswer(message.text)
      return
    }

    let visible = 0
    const step = Math.max(1, Math.ceil(message.text.length / 48))
    const timer = window.setInterval(() => {
      visible = Math.min(message.text.length, visible + step)
      setVisibleCharacters(visible)
      if (visible >= message.text.length) {
        window.clearInterval(timer)
        setTypingMessageId(current => current === message.id ? null : current)
        setAnnouncedAnswer(message.text)
      }
    }, 28)

    return () => window.clearInterval(timer)
  }, [messages, typingMessageId])

  useEffect(() => {
    let active = true
    const loadConfig = async () => {
      try {
        const { data } = await supabase.rpc('public_merx_config_obter')
        if (!active || !data || typeof data !== 'object') return
        const value = data as { habilitado?: boolean; captacao_habilitada?: boolean; saudacao?: string; mensagem_sem_resposta?: string; faq?: MerxFaqItem[] }
        setEnabled(value.habilitado !== false)
        setCaptureEnabled(value.captacao_habilitada === true)
        if (value.saudacao) setGreeting(value.saudacao)
        if (value.mensagem_sem_resposta) setFallbackMessage(value.mensagem_sem_resposta)
        if (Array.isArray(value.faq) && value.faq.length) setFaq(value.faq)
      } catch {
        return
      }
    }
    void loadConfig()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeChatRef.current()
    }
    window.addEventListener('keydown', handler)
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>(contactOpen ? '.merx-chat__form input:not([type=checkbox])' : '.merx-chat__input input')?.focus(), 0)
    return () => window.removeEventListener('keydown', handler)
  }, [open, contactOpen])

  const addAnswer = (question: string) => {
    const matchedAnswer = findMerxAnswer(question, activeFaq)
    const answer = matchedAnswer ?? fallbackMessage
    const answerId = nextId.current + 1
    nextId.current += 2
    setMessages(current => [...current, { id: answerId - 1, from: 'visitor', text: question }, { id: answerId, from: 'merx', text: answer }])
    setThinkingMessageId(answerId)
    setTypingMessageId(null)
    setVisibleCharacters(0)
    setAnnouncedAnswer('')
  }

  const addConversation = (visitorText: string, answer: string) => {
    const visitorId = nextId.current
    const answerId = visitorId + 1
    nextId.current += 2
    setMessages(current => [...current, { id: visitorId, from: 'visitor', text: visitorText }, { id: answerId, from: 'merx', text: answer }])
    setThinkingMessageId(answerId)
    setTypingMessageId(null)
    setVisibleCharacters(0)
    setAnnouncedAnswer('')
  }

  const clearConversation = () => {
    setMessages([])
    setInput('')
    setVisitorName('')
    setContactName('')
    setContactEmail('')
    setContactEmailTouched(false)
    setInterest('atendimento')
    setFlowStep('name')
    setContactOpen(false)
    setSent(false)
    setError('')
    setThinkingMessageId(null)
    setTypingMessageId(null)
    setVisibleCharacters(0)
    setAnnouncedAnswer('')
    idempotencyKey.current = null
  }

  const closeChat = () => {
    setOpen(false)
    clearConversation()
    buttonRef.current?.focus()
  }
  closeChatRef.current = closeChat

  const startIntent = (value: 'parceiro_originador' | 'cliente_credito') => {
    if (value === 'parceiro_originador') {
      setInterest('parceiro_originador')
      setFlowStep('originator_result')
      addConversation(
        'Quero ser parceiro ou originador',
        `${configuredAnswer('workspace-parceiro', 'O workspace Mercúrio ajuda parceiros a organizar oportunidades, criar e acompanhar propostas e acessar recursos conforme o perfil e a aprovação.')} Você pode iniciar o cadastro ou, se preferir, pedir que nossa equipe entre em contato.`,
      )
      return
    }
    setFlowStep('product')
    addConversation('Estou buscando crédito', 'Entendi. Qual opção você gostaria de conhecer? Posso apresentar informações públicas sobre cada caminho e indicar a página adequada.')
  }

  const chooseProduct = (value: MerxInterest | 'avaliando') => {
    const selectedInterest: MerxInterest = value === 'avaliando' ? 'atendimento' : value
    setInterest(selectedInterest)
    setFlowStep('customer_result')
    const answers: Record<MerxInterest, string> = {
      atendimento: 'Tudo bem. Você pode explorar as opções disponíveis e, se quiser, pedir que a equipe entenda seu cenário. As condições dependem de análise.',
      home_equity: configuredAnswer('home-equity', 'Home Equity é uma operação de crédito com imóvel em garantia. A página de simulação apresenta uma estimativa; ela não representa aprovação nem proposta final.'),
      construcao: configuredAnswer('construction', 'O Crédito para Construção é voltado a construtores e investidores que desenvolvem casas de alto padrão para venda. Estrutura e liberações dependem da análise do projeto, orçamento, cronograma, garantias e políticas aplicáveis.'),
      financiamento_imobiliario: configuredAnswer('financiamento-imobiliario', 'A Mercúrio apresenta financiamento para aquisição de imóvel residencial ou comercial pronto. As possibilidades e condições dependem da análise da operação.'),
      parceiro_originador: '',
    }
    addConversation(MERX_INTEREST_LABELS[selectedInterest], answers[selectedInterest])
  }

  const openContactForm = () => {
    setContactName(visitorName)
    setContactEmail('')
    setContactEmailTouched(false)
    setError('')
    setSent(false)
    idempotencyKey.current = null
    setContactOpen(true)
  }

  function submitQuestion(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value) return
    if (flowStep === 'name') {
      if (value.length < 3 || value.length > 160) {
        addConversation(value, 'Para eu começar, informe seu nome (pode ser o nome completo). Se preferir, você também pode continuar sem informar.')
        setInput('')
        return
      }
      const firstName = value.split(/\s+/)[0]
      setVisitorName(value)
      setFlowStep('intent')
      addConversation(value, `Prazer, ${firstName}. Você é originador/parceiro ou está buscando crédito?`)
      setInput('')
      return
    }
    addAnswer(value)
    setFlowStep('faq')
    setInput('')
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const formElement = event.currentTarget
    setContactEmailTouched(true)
    if (!formElement.reportValidity()) return
    const form = new FormData(formElement)
    const email = normalizeEmail(String(form.get('email') ?? ''))
    if (!isValidEmailFormat(email)) {
      setContactEmailTouched(true)
      setError('Informe um e-mail em formato válido.')
      return
    }
    const siteKey = (import.meta.env.VITE_RECAPTCHA_SITEKEY as string | undefined)?.trim() ?? ''
    if (!siteKey) {
      setError('A verificação de segurança está indisponível. Tente novamente mais tarde.')
      return
    }
    if (requestInFlight.current) return
    requestInFlight.current = true
    setSubmitting(true)
    idempotencyKey.current ??= crypto.randomUUID()
    try {
      await loadRecaptchaV3(siteKey)
      const recaptchaToken = await executeRecaptchaV3(siteKey, 'merx_lead_capture')
      const { data, error: captureError } = await supabase.functions.invoke('public-merx-lead', { body: {
        idempotency_key: idempotencyKey.current,
        nome_completo: form.get('nome_completo'), cidade: form.get('cidade'), email, telefone: form.get('telefone'),
        interesse: form.get('interesse'), consentimento: form.get('consentimento') === 'on', pagina_origem: window.location.pathname,
        website: form.get('website'), recaptcha_token: recaptchaToken,
      } })
      if (captureError) {
        const context = captureError.context
        const status = context instanceof Response ? context.status : 0
        const result = context instanceof Response
          ? await context.clone().json().catch(() => null) as { error?: string } | null
          : null
        if (status === 429 || result?.error === 'rate_limited') throw new Error('Muitas tentativas de envio. Aguarde um pouco e tente novamente.')
        if (result?.error === 'captcha_invalid') throw new Error('Não foi possível validar a verificação de segurança. Tente novamente.')
        throw new Error('Não foi possível registrar o contato. Confira os dados e tente novamente.')
      }
      if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error('Não foi possível registrar o contato. Confira os dados e tente novamente.')
      idempotencyKey.current = null
      setSent(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o contato.') }
    finally { requestInFlight.current = false; setSubmitting(false) }
  }

  return <>
    {enabled && open && <div className="merx-chat" ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="merx-chat-title">
      <header className="merx-chat__header">
        <div className="merx-chat__brand">
          <div className="merx-chat__brand-copy">
            <strong id="merx-chat-title"><img className="merx-chat__wing" src={iconWingUrl} alt="" aria-hidden="true" /> MERX</strong>
            <span>Assistente da Mercúrio</span>
          </div>
        </div>
        <button type="button" className="btn-no-liquid merx-chat__icon merx-chat__close" onClick={closeChat} aria-label="Fechar MERX"><X size={18} /></button>
      </header>
      <div className="merx-chat__body">
        <div className="merx-chat__messages" aria-live="off">
        {messages.length === 0 && <div className="merx-chat__welcome"><strong>{greeting}</strong><p>Sou a MERX, assistente virtual da Mercúrio Capital. Posso apresentar o workspace para parceiros e orientar quem busca crédito.</p><p>Como prefere que eu te chame?</p></div>}
        {messages.map(message => {
          if (message.id === thinkingMessageId) return null
          const isTyping = message.id === typingMessageId
          const text = isTyping ? message.text.slice(0, visibleCharacters) : message.text
          return <p key={message.id} aria-hidden={isTyping || undefined} className={`merx-chat__message merx-chat__message--${message.from}${isTyping ? ' is-typing' : ''}`}>{text}</p>
        })}
        </div>
        {thinkingMessageId !== null && <p className="merx-chat__message merx-chat__message--merx merx-chat__thinking" role="status"><span>MERX está pensando</span><span className="merx-chat__thinking-dots" aria-hidden="true"><i /><i /><i /></span></p>}
        <span className="sr-only" aria-live="polite" aria-atomic="true">{announcedAnswer}</span>
        {captureEnabled && contactOpen && !sent && <>
          <button type="button" className="btn-no-liquid merx-chat__back" onClick={() => setContactOpen(false)}>Voltar às perguntas</button>
          <form className="merx-chat__form" onSubmit={submitContact} noValidate>
            <label htmlFor="merx-contact-name">Nome completo</label>
            <input id="merx-contact-name" name="nome_completo" autoComplete="name" required minLength={3} maxLength={160} value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Como você se chama" />
            <label htmlFor="merx-contact-city">Cidade</label>
            <input id="merx-contact-city" name="cidade" autoComplete="address-level2" required minLength={2} maxLength={100} placeholder="Cidade de onde está falando" />
            <label htmlFor="merx-contact-email">E-mail</label>
            <input id="merx-contact-email" name="email" type="email" autoComplete="email" maxLength={254} required value={contactEmail} aria-invalid={Boolean(contactEmailTouched && contactEmail && !isValidEmailFormat(contactEmail)) || undefined} aria-describedby={contactEmailTouched && contactEmail && !isValidEmailFormat(contactEmail) ? 'merx-email-error' : undefined} onChange={event => { setContactEmail(event.target.value); setContactEmailTouched(true) }} placeholder="voce@exemplo.com" />
            {contactEmailTouched && contactEmail && !isValidEmailFormat(contactEmail) && <p id="merx-email-error" className="merx-chat__field-error" role="alert">Informe um e-mail em formato válido.</p>}
            <label htmlFor="merx-contact-phone">Telefone com DDD</label>
            <input id="merx-contact-phone" name="telefone" type="tel" autoComplete="tel" inputMode="tel" required minLength={10} maxLength={20} placeholder="(00) 00000-0000" />
            <label htmlFor="merx-contact-interest">Assunto</label>
            <select id="merx-contact-interest" name="interesse" value={interest} onChange={event => setInterest(event.target.value as MerxInterest)}><option value="atendimento">Atendimento geral</option><option value="home_equity">Home Equity</option><option value="construcao">Crédito para construção</option><option value="financiamento_imobiliario">Financiamento imobiliário</option><option value="parceiro_originador">Quero ser parceiro originador</option></select>
            <label className="merx-chat__consent"><input name="consentimento" type="checkbox" required /> Autorizo a Mercúrio a entrar em contato sobre esta solicitação. <a href="/politica-de-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a></label>
            <label className="merx-chat__honeypot" aria-hidden="true">Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="btn-no-liquid merx-chat__submit" disabled={submitting}><span>{submitting ? 'Enviando…' : 'Enviar solicitação'}</span><Send size={15} /></button>
          </form>
        </>}
        {sent && <p className="merx-chat__success" role="status">Contato registrado. A equipe retornará pelos dados informados.</p>}
      </div>
      {!contactOpen && <div className="merx-chat__composer" data-testid="merx-chat-composer">
        <div className="merx-chat__suggestions" aria-label="Opções de atendimento">
          {flowStep === 'name' && <button type="button" className="btn-no-liquid" onClick={() => { setFlowStep('intent'); addConversation('Prefiro continuar sem informar meu nome', 'Tudo bem. Você é originador/parceiro ou está buscando crédito?') }}>Continuar sem informar nome</button>}
          {flowStep === 'intent' && <>
            <button type="button" className="btn-no-liquid" onClick={() => startIntent('parceiro_originador')}>Sou originador / quero ser parceiro</button>
            <button type="button" className="btn-no-liquid" onClick={() => startIntent('cliente_credito')}>Busco crédito</button>
          </>}
          {flowStep === 'product' && <>
            <button type="button" className="btn-no-liquid" onClick={() => chooseProduct('home_equity')}>Home Equity</button>
            <button type="button" className="btn-no-liquid" onClick={() => chooseProduct('construcao')}>Crédito para Construção</button>
            <button type="button" className="btn-no-liquid" onClick={() => chooseProduct('financiamento_imobiliario')}>Financiamento Imobiliário</button>
            <button type="button" className="btn-no-liquid" onClick={() => chooseProduct('avaliando')}>Ainda estou avaliando</button>
          </>}
          {flowStep === 'originator_result' && <a className="btn-no-liquid merx-chat__action" href="/p/registro">Iniciar cadastro de parceiro</a>}
          {flowStep === 'customer_result' && interest === 'home_equity' && <a className="btn-no-liquid merx-chat__action" href="/simulador">Abrir simulador de Home Equity</a>}
          {flowStep === 'customer_result' && interest === 'construcao' && <a className="btn-no-liquid merx-chat__action" href="/credito-para-construcao">Conhecer Crédito para Construção</a>}
          {flowStep === 'customer_result' && interest === 'financiamento_imobiliario' && <a className="btn-no-liquid merx-chat__action" href="/#produtos">Ver produtos da Mercúrio</a>}
          {(flowStep === 'originator_result' || flowStep === 'customer_result') && suggestedFaq.map(item => <button type="button" className="btn-no-liquid" key={item.id} onClick={() => addAnswer(item.question)}>{item.question}</button>)}
        </div>
        {captureEnabled && flowStep !== 'name' && <button type="button" className="btn-no-liquid merx-chat__contact-link" onClick={openContactForm}>{interest === 'parceiro_originador' ? 'Pedir contato sobre parceria' : 'Falar com a equipe'}</button>}
        <form className="merx-chat__input" onSubmit={submitQuestion}><input value={input} onChange={event => setInput(event.target.value)} placeholder={flowStep === 'name' ? 'Digite seu nome…' : 'Digite sua pergunta…'} aria-label={flowStep === 'name' ? 'Seu nome' : 'Pergunte à MERX'} /><button type="submit" className="btn-no-liquid" aria-label={flowStep === 'name' ? 'Continuar com meu nome' : 'Enviar pergunta'}><Send size={16} /></button></form>
      </div>}
    </div>}
    {enabled && <button ref={buttonRef} type="button" className="btn-no-liquid merx-chat__launcher" onClick={() => open ? closeChat() : setOpen(true)} aria-expanded={open} aria-label={open ? 'Fechar MERX' : 'Abrir MERX'}><span aria-hidden="true" className="merx-chat__launcher-logo" dangerouslySetInnerHTML={{ __html: launcherLogoMarkup }} /></button>}
  </>
}
