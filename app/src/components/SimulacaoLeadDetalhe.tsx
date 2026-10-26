import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, Mail, MessageCircle, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateBr } from '@/lib/dateBr'
import { buildWhatsappUrl, formatLeadPhone, resolveSimulationMessage, type ConfigMensagensSimulador } from '@/lib/mensagensSimulador'
import { commercialStatusLabel, emailStatusLabel, leadCep, leadMoney, leadPercent, leadProjectStage, leadProperty, leadPropertyStatus, leadReceived, leadSystem, leadTerm, leadType, type EmailStatus, type LeadRow } from '@/lib/simulacaoLeadPresentation'

export function EmailStatusBadge({ label, status }: { label: string; status: EmailStatus }) {
  const color = status === 'enviado' ? 'bg-emerald-50 text-emerald-800'
    : status === 'erro' || status === 'sem_template' ? 'bg-red-50 text-red-800'
      : status === 'sem_destinatarios' ? 'bg-amber-50 text-amber-800' : 'bg-silver-100 text-silver-700'
  const Icon = status === 'enviado' ? Check : status === 'pendente' ? Clock3 : Mail
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${color}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{label}: {emailStatusLabel(status)}</span>
}

export function WhatsAppContact({ lead, config, compact = false }: { lead: LeadRow; config: ConfigMensagensSimulador | null | undefined; compact?: boolean }) {
  const message = lead.tipo_simulacao === 'cpc'
    ? `Olá ${lead.nome_completo.trim() || 'cliente'}, recebemos sua solicitação de análise de projeto na modalidade Crédito para Construção (CPC) da Mercúrio Capital. Gostaria de conversar sobre os próximos passos?`
    : resolveSimulationMessage(config, { nome: lead.nome_completo, tipo: lead.tipo_simulacao, valor: Number(lead.valor_credito) })
  const href = buildWhatsappUrl(lead.telefone, message)
  const label = compact ? `Preparar WhatsApp para ${lead.nome_completo}` : 'Preparar contato no WhatsApp'
  const classes = cn(buttonVariants({ variant: compact ? 'outline' : 'primary' }), 'h-11 rounded-lg', compact ? 'w-11 shrink-0 px-0' : 'w-full')
  if (!href) return <Button disabled aria-label={`WhatsApp indisponível para ${lead.nome_completo}`} title="Telefone inválido para WhatsApp" className={classes}><MessageCircle aria-hidden="true" className="h-4 w-4" />{!compact && 'WhatsApp indisponível'}</Button>
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={classes}><MessageCircle aria-hidden="true" className="h-4 w-4" />{!compact && label}</a>
}

export function SimulacaoLeadDetalhe({ lead, config, onClose }: { lead: LeadRow; config: ConfigMensagensSimulador | null | undefined; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const isAmortization = lead.tipo_simulacao === 'amortizacao'
  const isCpc = lead.tipo_simulacao === 'cpc'
  const received = leadReceived(lead.created_at)
  const comparison = lead.resultado_com_amortizacao

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    // Native modal dialogs keep the rest of the document inert, including the admin navigation.
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="lead-detail-title"
      aria-describedby="lead-detail-received"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 m-0 ml-auto h-[100dvh] max-h-none w-full max-w-[600px] overflow-hidden border-0 bg-white p-0 text-silver-900 shadow-2xl backdrop:bg-black/40 [color-scheme:light]"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-silver-200 px-5 py-6 sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-700">{leadType(lead)} · Detalhes do lead</p>
            <h2 id="lead-detail-title" className="mt-2 break-words text-2xl font-semibold leading-tight">{lead.nome_completo}</h2>
            <p id="lead-detail-received" className="mt-2 text-xs text-silver-700">Recebido em {received.date}{received.time && ` às ${received.time}`}</p>
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-lg" aria-label="Fechar detalhes" onClick={onClose}><X aria-hidden="true" className="h-5 w-5" /></Button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
          <Section title="Acompanhamento comercial">
            <Detail label="Estado comercial" value={commercialStatusLabel[lead.status_comercial ?? 'novo']} />
            <Detail label="Última alteração" value={lead.status_comercial_updated_at ? formatDateBr(lead.status_comercial_updated_at) : 'Ainda não alterado'} />
          </Section>
          {!isCpc && <dl className="grid grid-cols-1 gap-4 rounded-xl border border-red-100 bg-red-50/50 p-5 min-[400px]:grid-cols-2">
            <div><dt className="text-xs font-medium text-silver-700">Crédito simulado</dt><dd className="mt-2 break-words text-xl font-semibold tabular-nums text-red-700">{leadMoney(lead.valor_credito)}</dd></div>
            <div><dt className="text-xs font-medium text-silver-700">{isAmortization ? 'Primeira parcela' : 'Parcela estimada'}</dt><dd className="mt-2 break-words text-xl font-semibold tabular-nums">{leadMoney(isAmortization ? lead.primeira_parcela : lead.parcela_estimada)}</dd></div>
          </dl>}

          <Section title="Contato">
            <Detail label="E-mail" value={lead.email} wide />
            <Detail label="Telefone" value={formatLeadPhone(lead.telefone)} />
          </Section>
          {isCpc ? <Section title="Projeto CPC">
            <Detail label="Fase do projeto" value={leadProjectStage(lead.fase_projeto)} wide />
            <Detail label="Cidade" value={lead.cidade} />
            <Detail label="UF" value={lead.uf} />
            <Detail label="Resumo do projeto" value={lead.resumo_projeto} wide />
            <Detail label="Consentimento registrado" value={`${formatDateBr(lead.consentimento_em)} · ${lead.consentimento_versao || 'Versão não informada'}`} wide />
            <Detail label="Origem" value={lead.origem} wide />
          </Section> : <>
          <Section title="Operação">
            <Detail label="Prazo" value={leadTerm(lead)} />
            {isAmortization ? <>
              <Detail label="Sistema" value={leadSystem(lead)} />
              <Detail label="Data de início" value={formatDateBr(lead.data_inicio)} />
              <Detail label="Taxa informada" value={`${leadPercent(lead.taxa_juros_informada)}${lead.periodicidade_juros === 'anual' ? ' a.a.' : lead.periodicidade_juros === 'mensal' ? ' a.m.' : ''}`} />
              <Detail label="Última parcela" value={leadMoney(lead.ultima_parcela)} />
              <Detail label="Total pago" value={leadMoney(lead.total_pago)} />
              <Detail label="Total de juros" value={leadMoney(lead.total_juros)} />
            </> : <>
              <Detail label="Taxa mensal" value={`${leadPercent(lead.taxa_juros_mensal)} a.m.`} />
              <Detail label="Crédito / imóvel (LTV)" value={leadPercent(lead.ltv, 100)} />
            </>}
          </Section>
          <Section title="Imóvel">
            <Detail label="Tipo" value={leadProperty(lead.tipo_imovel)} />
            <Detail label="Situação" value={leadPropertyStatus(lead.situacao_imovel)} />
            <Detail label="CEP" value={leadCep(lead.cep)} />
            <Detail label="Valor do imóvel" value={leadMoney(lead.valor_imovel)} />
          </Section>
          <Section title="Perfil e intenção">
            <Detail label="Objetivo do crédito" value={lead.objetivo_credito} />
            <Detail label="Tipo de renda" value={lead.tipo_renda} />
            <Detail label="Renda mensal" value={leadMoney(lead.renda_mensal)} />
            <Detail label="Previsão de contratação" value={lead.prazo_contratacao} />
            <Detail label="Origem" value={lead.origem} wide />
          </Section>
          <section aria-labelledby="lead-emails-title">
            <h3 id="lead-emails-title" className="mb-3 text-sm font-semibold">Envio dos e-mails</h3>
            <div className="flex flex-wrap gap-2">{lead.status_email_prospect && <EmailStatusBadge label="Prospect" status={lead.status_email_prospect} />}{lead.status_email_interno && <EmailStatusBadge label="Equipe" status={lead.status_email_interno} />}</div>
          </section>

          {isAmortization && <>
            <section aria-labelledby="lead-plans-title" className="border-t border-silver-200 pt-6">
              <h3 id="lead-plans-title" className="text-sm font-semibold">Planos de amortização</h3>
              {lead.planos_amortizacao?.length ? <ol className="mt-3 space-y-3">{lead.planos_amortizacao.map((plan, index) => (
                <li key={`${index}-${plan.apos_parcela}`} className="rounded-xl border border-silver-200 p-4 text-sm">
                  <p className="font-semibold"><span className="mr-2 text-xs text-red-700">Plano {index + 1}</span> {leadMoney(plan.valor_extra)}</p>
                  <p className="mt-2 leading-relaxed text-silver-700">{plan.frequencia === 'mensal' ? 'Mensalmente' : 'Uma vez'}, após a parcela {plan.apos_parcela}, para reduzir {plan.objetivo === 'prazo' ? 'o prazo' : 'a parcela'}.</p>
                </li>
              ))}</ol> : <p className="mt-3 rounded-lg bg-silver-50 p-4 text-sm text-silver-700">Nenhum plano extra informado.</p>}
            </section>
            <section aria-labelledby="lead-comparison-title">
              <h3 id="lead-comparison-title" className="mb-3 text-sm font-semibold">Comparativo recebido</h3>
              {comparison ? <>
                <div className="overflow-x-auto rounded-xl border border-silver-200">
                  <table className="w-full min-w-[420px] text-left text-xs sm:text-sm">
                    <caption className="sr-only">Totais recebidos com e sem antecipação</caption>
                    <thead className="bg-silver-50"><tr><th scope="col" className="p-3 font-medium">Resultado</th><th scope="col" className="p-3 font-medium">Sem planos</th><th scope="col" className="p-3 font-medium">Com planos</th></tr></thead>
                    <tbody>
                      <ComparisonRow label="Total pago" before={leadMoney(comparison.sem_antecipacao?.total_pago)} after={leadMoney(comparison.com_antecipacao?.total_pago)} />
                      <ComparisonRow label="Juros" before={leadMoney(comparison.sem_antecipacao?.total_juros)} after={leadMoney(comparison.com_antecipacao?.total_juros)} />
                      <ComparisonRow label="Parcelas" before={comparison.sem_antecipacao?.quantidade_parcelas} after={comparison.com_antecipacao?.quantidade_parcelas} />
                    </tbody>
                  </table>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <Detail label="Economia em juros" value={leadMoney(comparison.economia_juros)} />
                  <Detail label="Parcelas reduzidas" value={comparison.parcelas_reduzidas?.toLocaleString('pt-BR')} />
                  <Detail label="Amortização extra total" value={leadMoney(comparison.com_antecipacao?.total_amortizado_extra)} wide />
                </dl>
              </> : <p className="rounded-lg bg-silver-50 p-4 text-sm text-silver-700">Comparativo não disponível neste registro.</p>}
            </section>
          </>}
          </>}
        </div>

        <footer className="shrink-0 border-t border-silver-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          <WhatsAppContact lead={lead} config={config} />
          <p className="mt-2 text-center text-xs text-silver-700">Revise a mensagem no WhatsApp antes de enviar.</p>
        </footer>
      </div>
    </dialog>, document.body,
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title}><h3 className="mb-3 text-sm font-semibold">{title}</h3><dl className="grid grid-cols-1 gap-x-5 gap-y-4 min-[400px]:grid-cols-2">{children}</dl></section>
}

function Detail({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return <div className={wide ? 'col-span-full' : ''}><dt className="text-xs text-silver-700">{label}</dt><dd className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">{value || 'Não informado'}</dd></div>
}

function ComparisonRow({ label, before, after }: { label: string; before: string | number | undefined; after: string | number | undefined }) {
  return <tr className="border-t border-silver-200"><th scope="row" className="p-3 font-medium">{label}</th><td className="p-3 tabular-nums">{before ?? 'Não informado'}</td><td className="p-3 tabular-nums">{after ?? 'Não informado'}</td></tr>
}
