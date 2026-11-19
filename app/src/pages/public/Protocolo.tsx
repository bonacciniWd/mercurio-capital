import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { executeRecaptchaV3, loadRecaptchaV3, PROTOCOL_RECAPTCHA_ACTION } from '@/lib/recaptchaV3'
import logo from '@/assets/logos/logo.svg'
import { Search, AlertCircle, Loader2, ShieldAlert, ShieldCheck, ArrowRight, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Em rascunho',
  pre_analise: 'Em pré-análise',
  analise_credito: 'Em análise de crédito',
  pre_aprovado: 'Pré-aprovado',
  analise_imovel: 'Em análise do imóvel',
  analise_juridica: 'Em análise jurídica',
  comite: 'Em comitê',
  proposta_cliente: 'Aguardando resposta do cliente',
  resolucao_pendencias: 'Pendências em aberto',
  emissao_contrato: 'Emissão de contrato',
  aguardando_assinatura: 'Aguardando assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Contrato registrado',
  recurso_liberado: 'Recurso liberado',
  cancelado: 'Proposta cancelada',
}

// Linha do tempo simplificada para o público
const STEPS: { key: string; label: string }[] = [
  { key: 'pre_analise', label: 'Recebida' },
  { key: 'analise_credito', label: 'Análise de crédito' },
  { key: 'pre_aprovado', label: 'Pré-aprovado' },
  { key: 'comite', label: 'Comitê' },
  { key: 'emissao_contrato', label: 'Contrato' },
  { key: 'recurso_liberado', label: 'Recurso liberado' },
]

interface Pendencia {
  id: string
  descricao: string
  documento_solicitado_tipo: string | null
  status: string
  prazo: string | null
  created_at: string
}

interface Resultado {
  encontrado: boolean
  protocolo?: string
  produto?: string
  status?: string
  valor_solicitado?: number
  prazo_meses?: number | null
  created_at?: string
  updated_at?: string
  pendencias?: Pendencia[]
  historico?: { status_novo: string; status_anterior: string | null; created_at: string }[]
}

function ArchitectureArtwork() {
  return (
    <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[55%] w-full opacity-90" viewBox="0 0 700 430" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="protocol-city" x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="#284e73" /><stop offset="1" stopColor="#071728" />
        </linearGradient>
        <linearGradient id="protocol-glow" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#eb343b" stopOpacity=".8" /><stop offset="1" stopColor="#eb343b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-40 430V242L102 179v251Zm117 0V119l160-68v379Zm165 0V202l118-51v279Zm129 0V92l198-73v411Zm173 0V235l142-55v250Z" fill="url(#protocol-city)" />
      <g fill="none" stroke="#9eb3c6" strokeOpacity=".16">
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M0 ${255 + i * 23}h700`} />)}
        {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${30 + i * 54} 80v350`} />)}
      </g>
      <path d="m86 430 371-330 201 176" stroke="url(#protocol-glow)" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function Protocolo() {
  const recaptchaSiteKey =
    (import.meta.env.VITE_RECAPTCHA_SITEKEY as string | undefined) || ''
  const { codigo: codigoParam } = useParams()
  const [codigo, setCodigo] = useState(codigoParam ?? '')
  const [captchaReady, setCaptchaReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const requestVersion = useRef(0)

  const captchaEnabled = recaptchaSiteKey.trim().length > 0

  useEffect(() => {
    if (!captchaEnabled) return
    let active = true
    void loadRecaptchaV3(recaptchaSiteKey).then(() => { if (active) setCaptchaReady(true) }).catch(() => {
      if (active) setErro('Verificação de segurança indisponível. Tente novamente mais tarde.')
    })
    return () => { active = false }
  }, [captchaEnabled, recaptchaSiteKey])

  async function consultar(cod: string) {
    const version = ++requestVersion.current
    setLoading(true)
    setErro(null)
    setResultado(null)
    try {
      if (!captchaEnabled) throw new Error('Verificação anti-bot indisponível. Tente novamente mais tarde.')
      if (!captchaReady) throw new Error('Verificação de segurança ainda está carregando.')
      const captchaToken = await executeRecaptchaV3(recaptchaSiteKey, PROTOCOL_RECAPTCHA_ACTION)
      const { data, error } = await supabase.functions.invoke('public-consulta-protocolo', {
        body: { codigo: cod.trim(), captcha_token: captchaToken },
      })
      if (error || data?.error) {
        let code = data?.error
        if (error && 'context' in error && error.context instanceof Response) {
          try { code = (await error.context.json()).error } catch { /* generic message below */ }
        }
        const messages: Record<string, string> = {
          rate_limited: 'Muitas consultas seguidas. Aguarde um minuto.',
          captcha_invalid: 'Não foi possível validar a segurança. Tente novamente.',
          captcha_required: 'Verificação de segurança necessária para consultar.',
          invalid_codigo: 'Informe um protocolo válido.',
        }
        throw new Error(messages[code] ?? 'Consulta indisponível. Tente novamente mais tarde.')
      }
      if (version === requestVersion.current) setResultado(data as Resultado)
    } catch (err: unknown) {
      if (version === requestVersion.current) setErro((err instanceof Error ? err.message : null) ?? 'Falha ao consultar protocolo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    requestVersion.current += 1
    setCodigo(codigoParam ?? '')
    setResultado(null)
  }, [codigoParam])

  const currentStepIdx = resultado?.status
    ? STEPS.reduce((acc, s, idx) => (statusReachesStep(resultado.status!, s.key) ? idx : acc), -1)
    : -1

  return (
    <main className="min-h-dvh [color-scheme:light] bg-[#f3f5f7] text-[#102c4c] lg:grid lg:grid-cols-[minmax(360px,0.88fr)_minmax(520px,1.12fr)]">
      <section className="relative flex min-h-[270px] overflow-hidden bg-[#040b12eb] px-6 py-7 text-white sm:px-10 lg:min-h-dvh lg:px-[clamp(40px,6vw,96px)] lg:py-12">
        <div className="relative z-10 flex w-full flex-col">
          <div className="flex items-center gap-3" aria-label="Mercúrio Capital">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden"><img src={logo} alt="" className="h-12 w-12 scale-[2.35] object-contain" /></span>
            <div className="leading-none"><strong className="block text-[17px] font-bold tracking-[-0.03em]">MERCÚRIO</strong><span className="mt-1 block text-[10px] font-bold tracking-[0.19em] text-[#e42931]">CAPITAL</span></div>
          </div>
          <div className="mt-auto max-w-lg pb-4 pt-16 lg:pb-[clamp(70px,13vh,150px)]">
            <div className="mb-6 h-px w-14 bg-[#e42931]" />
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c4d0dc]">Acompanhe sua jornada</p>
            <h1 className="mt-4 text-[clamp(32px,4vw,58px)] font-semibold leading-[1.04] tracking-[-0.045em]">Seu próximo passo, com <span className="text-[#f04a50]">transparência.</span></h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#b8c6d3]">Consulte o status da sua proposta de forma simples, segura e rápida.</p>
          </div>
        </div>
        <ArchitectureArtwork />
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
      </section>
      <section className="flex min-w-0 min-h-[calc(100dvh-270px)] items-center justify-center px-4 py-10 sm:px-8 lg:min-h-dvh lg:px-[clamp(48px,8vw,130px)]">
      <div className="w-full max-w-[620px]">
        <header className="mb-8">
          <p className="mb-3 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.17em] text-[#d92830]"><span className="h-px w-8 bg-current" />Consulta de proposta</p>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-[#0b2847] sm:text-[42px]">Acompanhe sua proposta</h2>
          <p className="mt-3 text-[15px] leading-6 text-[#637284]">Sem necessidade de cadastro. Informe o número do protocolo.</p>
        </header>
        <div className="rounded-2xl border border-[#dbe1e7] bg-white p-5 shadow-[0_22px_60px_rgba(14,38,64,0.08)] sm:p-8">

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); void consultar(codigo) }}
          >
            <div>
              <label htmlFor="protocol" className="mb-2 block text-sm font-semibold text-[#17334f]">Número do protocolo</label>
              <div className="relative">
              <input
                id="protocol"
                aria-describedby="security-message"
                className="h-14 w-full rounded-lg border border-[#bfcbd6] bg-white px-4 pr-12 font-mono text-sm tracking-[0.02em] text-[#1b3248] outline-none transition focus:border-[#17466d] focus:ring-4 focus:ring-[#17466d]/10"
                maxLength={80}
                placeholder="MERC-AAAA-000000"
                value={codigo}
                onChange={(e) => {
                  requestVersion.current += 1
                  setCodigo(e.target.value)
                  setResultado(null)
                  if (erro) setErro(null)
                }}
                required
              />
              {resultado?.encontrado && <Check aria-hidden="true" className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#17835f]" />}
              </div>
            </div>

            {captchaEnabled ? (
              <div id="security-message" role="status" className="flex min-h-12 items-center gap-3 rounded-lg bg-[#f1f7f5] px-4 py-3 text-sm text-[#356455]">
                <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-[#17835f]" />
                {captchaReady
                  ? 'Verificação automática de segurança ativa.'
                  : 'Carregando verificação de segurança...'}
              </div>
            ) : (
              <div id="security-message" role="status" className="rounded-lg border border-silver-200 bg-silver-50 p-3 text-sm text-silver-600">
                Verificação anti-bot indisponível. Tente novamente mais tarde.
              </div>
            )}

            <button
              type="submit"
              className="btn-no-liquid flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#d92730] px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(217,39,48,0.24)] transition hover:bg-[#ba2028] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d92730]/30 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !captchaEnabled || !captchaReady}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? 'Consultando...' : 'Consultar proposta'}
              {!loading && <ArrowRight aria-hidden="true" className="ml-1 h-[18px] w-[18px]" />}
            </button>
          </form>

          {erro && (
            <div role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {resultado && !resultado.encontrado && (
            <div role="status" className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-[#805b16]">
              Nenhuma proposta encontrada para este protocolo.
            </div>
          )}

          {resultado?.encontrado && (
            <section aria-live="polite" aria-label="Resultado da consulta" className="mt-7 border-t border-[#e1e6eb] pt-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-silver-500">Protocolo</p>
                  <p className="break-all font-mono text-base font-bold text-[#0b3157]">{resultado.protocolo}</p>
                  <p className="mt-1 text-xs text-silver-500">
                    {PRODUTO_LABEL[resultado.produto!] ?? resultado.produto}
                    {resultado.valor_solicitado != null && (
                      <> · {brl(resultado.valor_solicitado * 100)}</>
                    )}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${resultado.status === 'cancelado' ? 'border-[#f2b7ba] bg-[#fff1f1] text-[#a8242b]' : 'border-[#dbe1e7] bg-[#f3f5f7] text-[#17334f]'}`}>{STATUS_LABEL[resultado.status!] ?? resultado.status ?? '—'}</span>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-silver-700">Andamento</p>
                <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                  {STEPS.map((s, i) => (
                    <li key={s.key}>
                      <div
                        className={`h-1.5 rounded-full ${
                          i < currentStepIdx
                            ? 'bg-[#d92730]'
                            : i === currentStepIdx
                            ? 'bg-[#d92730]'
                            : 'bg-silver-200'
                        }`}
                      />
                      <p
                        className={`mt-2 text-[11px] ${
                          i <= currentStepIdx ? 'text-silver-900' : 'text-silver-400'
                        }`}
                      >
                        {s.label}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              {!!resultado.pendencias?.length && (
                <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-silver-900">
                        {resultado.pendencias.length}{' '}
                        {resultado.pendencias.length === 1 ? 'pendência aberta' : 'pendências abertas'}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {resultado.pendencias.map((p) => (
                          <li
                            key={p.id}
                            className="rounded-md border border-silver-200 bg-white p-2.5 text-sm text-silver-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{p.descricao}</span>
                              {p.prazo && (
                                <span className="text-[11px] text-silver-500">
                                  prazo: {new Date(p.prazo).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-silver-500">
                        Para enviar documentos, acesse a área do cliente com seu link de acesso.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          {!resultado && !erro && <div role="status" className="mt-6 flex items-start gap-3 border-t border-[#e1e6eb] pt-5 text-sm leading-5 text-[#647485]"><ShieldCheck aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />Muitas consultas seguidas? Aguarde um minuto antes de tentar novamente.</div>}
        </div>
        <p className="mt-6 text-center text-sm text-[#788796]">
          Dúvidas? Entre em contato com seu parceiro.
        </p>
      </div>
      </section>
    </main>
  )
}

// Mapeia status atual da proposta para o índice do passo "atingido" na timeline simplificada
function statusReachesStep(currentStatus: string, stepKey: string): boolean {
  const order = [
    'simulacao',
    'pre_analise',
    'analise_credito',
    'pre_aprovado',
    'analise_imovel',
    'analise_juridica',
    'comite',
    'proposta_cliente',
    'resolucao_pendencias',
    'emissao_contrato',
    'aguardando_assinatura',
    'em_registro',
    'contrato_registrado',
    'recurso_liberado',
  ]
  const cur = order.indexOf(currentStatus)
  const step = order.indexOf(stepKey)
  if (cur < 0 || step < 0) return false
  return cur >= step
}
