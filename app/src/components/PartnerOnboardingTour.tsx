import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import Merx from '@/assets/logos/logo.svg'

const STEPS = [
  { label: 'Comece por aqui', title: 'Seu caminho como parceiro', body: 'Use este guia para entender da simulação ao acompanhamento da proposta.', points: ['Confira condições antes de conversar com o cliente.', 'Separe dados do cliente, proponentes e imóvel.', 'Você pode interromper o guia e retomá-lo pelo Dashboard.'], link: null },
  { label: 'Simulações', title: 'Simule antes de propor', body: 'Compare cenários com o cliente. A simulação é uma estimativa e não representa aprovação de crédito.', points: ['Confira valor solicitado e prazo.', 'Verifique a garantia informada.', 'Revise as condições antes de criar a proposta.'], link: { to: '/p/simulacoes', text: 'Abrir Simulações' } },
  { label: 'Nova proposta', title: 'Cadastre em cinco etapas', body: 'O formulário segue Produto, Cliente, Imóveis, Valores e Revisão. Os proponentes são informados na etapa Cliente.', points: ['Confira CPF ou CNPJ e contato do cliente.', 'Informe os imóveis e seus valores.', 'Leia a revisão antes de enviar e guarde o protocolo.'], link: { to: '/p/propostas/nova', text: 'Criar proposta' } },
  { label: 'Acompanhamento', title: 'Acompanhe documentos e pendências', body: 'Na lista de Propostas, abra o detalhe para acompanhar a operação.', points: ['Consulte as abas Documentos e Pendências.', 'Confira histórico e consultas disponíveis.', 'Use o protocolo para localizar a proposta.'], link: { to: '/p/propostas', text: 'Ver propostas' } },
  { label: 'Seu painel', title: 'Carteira, comissões e capacitação', body: 'A Carteira mostra saldo e movimentações. Comissões e conteúdos de capacitação ficam nas áreas próprias do painel.', points: ['Confira a carteira antes de ações que possam ter custo.', 'Acompanhe comissões quando houver operações liberadas.', 'Consulte a Universidade para conhecer os produtos.'], link: { to: '/p/carteira', text: 'Abrir Carteira' } },
  { label: 'MERX', title: 'O futuro da MERX', body: 'A MERX está sendo preparada para organizar informações da proposta e apontar pendências, com revisão humana.', points: ['Hoje, a classificação disponível usa regras operacionais.', 'Um assistente por usuário e proposta está planejado para uma próxima etapa.', 'Esse acesso ficará limitado às propostas permitidas ao parceiro e à sua equipe.'], link: null },
] as const

function read(key: string) { try { return localStorage.getItem(key) } catch { return null } }
function save(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* Guia continua utilizável. */ } }

export function PartnerOnboardingTour() {
  const { session } = useAuth()
  const key = `mercurio:partner_tour_v2:${session?.userId ?? 'unknown'}`
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!session?.userId) return
    const stored = read(key)
    if (stored === 'completed') { setOpen(false); return }
    const previous = Number(stored)
    setStep(stored !== null && Number.isInteger(previous) && previous >= 0 && previous < STEPS.length ? previous : 0)
    setOpen(true)
  }, [key, session?.userId])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current
    dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => dialog.querySelector<HTMLButtonElement>('[data-close]')?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      if (dialog.open) dialog.close()
      document.body.style.overflow = overflow
      if (openerRef.current?.isConnected) openerRef.current.focus()
    }
  }, [open])

  const pause = () => { save(key, String(step)); setOpen(false) }
  const finish = () => { save(key, 'completed'); setOpen(false) }
  const goTo = (index: number) => { setStep(index); save(key, String(index)) }
  const current = STEPS[step]

  return <>
    <button ref={triggerRef} type="button" onClick={() => { setStep(0); setOpen(true) }} className="btn-no-liquid rounded-lg border border-silver-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-silver-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">Rever guia do parceiro</button>
    {open && <dialog ref={dialogRef} aria-labelledby="partner-tour-title" aria-describedby="partner-tour-description" onCancel={event => { event.preventDefault(); pause() }} onClick={event => { if (event.target === dialogRef.current) pause() }} className="m-auto max-h-[min(90dvh,760px)] w-[min(92vw,820px)] max-w-none overflow-y-auto overscroll-contain rounded-2xl border border-silver-200 bg-white p-0 text-navy shadow-2xl backdrop:bg-black/65">
      <div className="flex items-center justify-between gap-3 border-b border-silver-200 px-5 py-4 sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-red-700">Guia do parceiro</p>
          <p className="mt-1 text-sm text-silver-600">Etapa {step + 1} de {STEPS.length}</p>
        </div>

        <button data-close type="button" onClick={pause} aria-label="Fechar e continuar depois" className="btn-no-liquid grid h-10 w-10 place-items-center rounded-lg hover:bg-silver-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">
          <X size={20} aria-hidden="true" />
        </button></div>
      <div className="grid sm:grid-cols-[190px_minmax(0,1fr)]">

        <nav aria-label="Etapas do guia" className="flex gap-2 overflow-x-auto border-b border-silver-200 bg-silver-50 p-4 sm:flex-col sm:border-b-0 sm:border-r">{STEPS.map((item, index) =>
          <button key={item.label} type="button" aria-current={index === step ? 'step' : undefined} onClick={() => goTo(index)} className={`btn-no-liquid min-h-10 shrink-0 rounded-lg px-3 py-2  text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 sm:w-full ${index === step ? 'bg-red-600 text-white' : 'text-silver-700 hover:bg-white'}`}>{index + 1}. {item.label}</button>)}
        </nav>

        <div className="min-w-0 p-2 sm:p-8">
          <img src={Merx} alt="Logo do parceiro" className="h-36 justify-center -mt-6 mx-auto w-36" />
          <h2 id="partner-tour-title" className="text-balance text-2xl font-bold leading-tight">{current.title}</h2>
          <p id="partner-tour-description" className="mt-3 max-w-prose text-sm leading-relaxed text-silver-700">{current.body}</p>
          <ul className="mt-6 space-y-3">{current.points.map(point => <li key={point} className="flex gap-3 text-sm leading-relaxed text-silver-700"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />{point}</li>)}</ul>
          {current.link && <Link to={current.link.to} onClick={pause} className="mt-7 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">{current.link.text}<ArrowRight size={16} aria-hidden="true" /></Link>}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-silver-200 pt-5">
            <button type="button" onClick={pause} className="btn-no-liquid min-h-10 px-2 text-sm font-semibold text-silver-700 hover:text-navy">Continuar depois
            </button>
            <div className="flex gap-2">
              <button type="button" disabled={step === 0} onClick={() => goTo(Math.max(0, step - 1))} className="btn-no-liquid inline-flex min-h-10 items-center gap-1 rounded-lg border border-silver-300 px-3 text-sm font-semibold disabled:opacity-40">
                <ArrowLeft size={16} aria-hidden="true" /> Voltar</button>{step === STEPS.length - 1 ?
                  <button type="button" onClick={finish} className="btn-no-liquid min-h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">Concluir guia</button> : <button type="button" onClick={() => goTo(step + 1)} className="btn-no-liquid inline-flex min-h-10 items-center gap-1 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">Próxima etapa <ArrowRight size={16} aria-hidden="true" /></button>}</div></div>
        </div></div>
    </dialog>}
  </>
}
