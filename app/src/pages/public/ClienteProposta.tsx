import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Loader2, AlertTriangle, FileText, ArrowRight } from 'lucide-react'
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
  proposta_cliente: 'Aguardando sua resposta',
  resolucao_pendencias: 'Pendências em aberto',
  emissao_contrato: 'Emissão de contrato',
  aguardando_assinatura: 'Aguardando assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Contrato registrado',
  recurso_liberado: 'Recurso liberado',
  cancelado: 'Proposta cancelada',
}

interface Peek {
  proposta_id: string
  protocolo: string
  produto: string
  status: string
  valor_solicitado: number
  prazo_meses: number
  cliente_nome: string
  cliente_email: string | null
  expires_at: string
}

export function ClienteProposta() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [peek, setPeek] = useState<Peek | null>(null)

  useEffect(() => {
    let mounted = true
    if (!token) {
      setError('Token não informado.')
      setLoading(false)
      return
    }
    void (async () => {
      const { data, error } = await supabase.rpc('cliente_peek_proposta', { p_token: token })
      if (!mounted) return
      if (error || !data) {
        setError(error?.message || 'Link inválido ou expirado.')
      } else {
        setPeek(data as Peek)
      }
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [token])

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:col-span-3 lg:flex">
        <Logo variant="light" />
        <div>
          <h2 className="text-4xl font-bold leading-tight">
            Sua proposta de crédito<br />está pronta.
          </h2>
          <p className="mt-4 max-w-md text-white/70">
            Acompanhe o andamento, responda pendências e envie documentos com segurança no portal do cliente.
          </p>
        </div>
        <p className="text-xs text-white/40">© Mercurio Capital</p>
      </div>

      <div className="flex items-center justify-center p-8 lg:col-span-2">
        <div className="w-full max-w-md">
          {loading ? (
            <div className="card flex flex-col items-center p-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="mt-4 text-sm text-silver-600">Validando link…</p>
            </div>
          ) : error ? (
            <div className="card p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle className="h-7 w-7 text-danger" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-navy">Link inválido</h1>
              <p className="mt-2 text-sm text-danger">{error}</p>
              <Link to="/c/login" className="btn-gold mt-6 inline-flex w-full justify-center">
                Ir para login
              </Link>
            </div>
          ) : peek ? (
            <div className="card p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-silver-500">Protocolo</p>
                  <p className="font-mono text-sm font-semibold text-navy">{peek.protocolo}</p>
                </div>
              </div>

              <h1 className="mt-6 text-xl font-bold text-navy">Olá, {peek.cliente_nome.split(' ')[0]}!</h1>
              <p className="mt-2 text-sm text-silver-600">
                Seu parceiro criou uma proposta para você. Confira os detalhes abaixo.
              </p>

              <dl className="mt-6 space-y-3 rounded-lg border border-silver-200 bg-silver-50 p-4 text-sm">
                <Row k="Produto" v={PRODUTO_LABEL[peek.produto] || peek.produto} />
                <Row k="Valor solicitado" v={brl(Number(peek.valor_solicitado) * 100)} />
                <Row k="Prazo" v={`${peek.prazo_meses} meses`} />
                <Row k="Status atual" v={STATUS_LABEL[peek.status] || peek.status} />
              </dl>

              <p className="mt-6 text-xs text-silver-500">
                Para acompanhar e enviar documentos, crie sua conta com este e-mail:
                <br /><b className="text-navy">{peek.cliente_email || 'fornecido pelo parceiro'}</b>
              </p>

              <Link
                to={`/c/login?token=${encodeURIComponent(token!)}`}
                className="btn-gold mt-6 inline-flex w-full items-center justify-center gap-2"
              >
                Acessar portal do cliente <ArrowRight className="h-4 w-4" />
              </Link>

              <p className="mt-4 text-center text-xs text-silver-400">
                Link válido até {new Date(peek.expires_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-silver-200 pb-2 last:border-0">
      <dt className="text-silver-600">{k}</dt>
      <dd className="font-medium text-silver-900">{v}</dd>
    </div>
  )
}
