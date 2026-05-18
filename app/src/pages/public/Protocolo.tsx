import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { StatusBadge } from '@/components/Badge'
import { Search, AlertCircle, Loader2, ShieldAlert } from 'lucide-react'
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

const SITEKEY = (import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined) || ''

export function Protocolo() {
  const { codigo: codigoParam } = useParams()
  const [codigo, setCodigo] = useState(codigoParam ?? '')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function consultar(cod: string) {
    setLoading(true)
    setErro(null)
    setResultado(null)
    try {
      if (SITEKEY && !captchaToken) {
        throw new Error('Conclua a verificação anti-bot antes de consultar.')
      }
      const { data, error } = await supabase.rpc('public_consulta_protocolo', {
        p_codigo: cod.trim(),
        p_captcha_token: captchaToken,
      })
      if (error) {
        if (error.message?.includes('rate_limited')) {
          throw new Error('Muitas consultas seguidas. Aguarde alguns segundos.')
        }
        throw new Error(error.message)
      }
      setResultado(data as Resultado)
    } catch (err: any) {
      setErro(err?.message ?? 'Falha ao consultar protocolo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (codigoParam) {
      void consultar(codigoParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoParam])

  const currentStepIdx = resultado?.status
    ? STEPS.reduce((acc, s, idx) => (statusReachesStep(resultado.status!, s.key) ? idx : acc), -1)
    : -1

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-navy">Acompanhe sua proposta</h1>
          <p className="mt-1 text-sm text-silver-600">Sem necessidade de cadastro. Informe o número do protocolo.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => { e.preventDefault(); void consultar(codigo) }}
          >
            <div>
              <label className="label">Número do protocolo</label>
              <input
                className="input font-mono"
                placeholder="MC-2024-XXXXXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </div>

            {SITEKEY ? (
              <div className="rounded-lg border border-silver-200 bg-silver-50 p-3 text-center text-xs text-silver-500">
                {/* TODO: integrar @hcaptcha/react-hcaptcha quando dependência for adicionada */}
                Captcha habilitado (sitekey configurada). Token enviado: {captchaToken ? 'OK' : '—'}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setCaptchaToken('dev-token')}
                >
                  Simular verificação
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-silver-200 bg-silver-50 p-3 text-center text-xs text-silver-500">
                Verificação anti-bot desabilitada (defina <code>VITE_HCAPTCHA_SITEKEY</code>).
              </div>
            )}

            <button type="submit" className="btn-gold w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Consultar
            </button>
          </form>

          {erro && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {resultado && !resultado.encontrado && (
            <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
              Nenhuma proposta encontrada para este protocolo.
            </div>
          )}

          {resultado?.encontrado && (
            <div className="mt-8 border-t border-silver-200 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-silver-500">Protocolo</p>
                  <p className="font-mono font-semibold text-navy">{resultado.protocolo}</p>
                  <p className="mt-1 text-xs text-silver-500">
                    {PRODUTO_LABEL[resultado.produto!] ?? resultado.produto}
                    {resultado.valor_solicitado != null && (
                      <> · {brl(resultado.valor_solicitado * 100)}</>
                    )}
                  </p>
                </div>
                <StatusBadge status={STATUS_LABEL[resultado.status!] ?? resultado.status ?? '—'} />
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-silver-700">Andamento</p>
                <div className="flex items-center gap-2">
                  {STEPS.map((s, i) => (
                    <div key={s.key} className="flex-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          i < currentStepIdx
                            ? 'bg-success'
                            : i === currentStepIdx
                            ? 'bg-gold'
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
                    </div>
                  ))}
                </div>
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
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-silver-500">
          Dúvidas? Entre em contato com seu parceiro.
        </p>
      </div>
    </div>
  )
}

// Mapeia status atual da proposta para o índice do passo "atingido" na timeline simplificada
function statusReachesStep(currentStatus: string, stepKey: string): boolean {
  const order = [
    'simulacao',
    'pre_analise',
    'analise_credito',
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
