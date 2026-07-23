import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileText, Clock, Loader2, FileWarning } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { brl } from '@/lib/utils'
import { buildChecklist, countObrigatoriosPendentes, type DocRowLite, type RequisitoRow } from '@/lib/documentos'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Em rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de crédito',
  analise_imovel: 'Análise do imóvel',
  analise_juridica: 'Análise jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Aguardando sua resposta',
  resolucao_pendencias: 'Pendências em aberto',
  emissao_contrato: 'Emissão de contrato',
  aguardando_assinatura: 'Aguardando assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Contrato registrado',
  recurso_liberado: 'Recurso liberado',
  cancelado: 'Cancelada',
}

const STEP_ORDER: string[] = [
  'simulacao', 'pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica',
  'comite', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado',
]

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000
  if (diff < 60) return `há ${Math.max(1, Math.floor(diff))}min`
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`
  return `há ${Math.floor(diff / 1440)}d`
}

export function ClientHome() {
  const { session } = useAuth()
  const nome = session?.nome?.split(' ')[0] || 'Cliente'

  const { data: propostas, isLoading } = useQuery({
    queryKey: ['client-propostas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, prazo_meses, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const pendentesCount = propostas?.filter((p) => p.status === 'resolucao_pendencias' || p.status === 'proposta_cliente').length || 0

  const { data: docsAll = [] } = useQuery({
    queryKey: ['client-docs-all'],
    queryFn: async (): Promise<DocRowLite[]> => {
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('proposta_id, categoria, tipo, storage_path, status, validado')
      if (error) throw error
      return (data ?? []) as DocRowLite[]
    },
  })

  const { data: requisitos = [] } = useQuery({
    queryKey: ['doc-requisitos'],
    queryFn: async (): Promise<RequisitoRow[]> => {
      const { data, error } = await supabase
        .from('documento_requisitos')
        .select('categoria, tipo, obrigatorio, ordem')
      if (error) throw error
      return (data ?? []) as RequisitoRow[]
    },
  })

  const docsObrigatoriosPendentes = countObrigatoriosPendentes(buildChecklist(docsAll, requisitos))

  return (
    <>
      <div className=" -mb-2 rounded-lg bg-gradient-to-r from-slate-800 z-10 to-slate-950  text-white">
        <img src="/src/assets/fundo-login.jpg" alt="Mercúrio Capital" className="h-56 rounded-t-xl w-full bg-" />
      </div>
      <div className="mb-6 rounded-lg bg-gradient-to-r from-slate-800 z-40 to-slate-950 p-6 text-white">
        <h1 className="text-2xl font-bold">Olá, {nome} 👋</h1>
        <p className="mt-1 text-white/80">Acompanhe o andamento das suas propostas.</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card label="Propostas" value={propostas?.length.toString() || '0'} />
        <Card label="Aguardando você" value={pendentesCount.toString()} tone={pendentesCount > 0 ? 'danger' : undefined} />
        <Card label="Status" value={propostas?.[0] ? STATUS_LABEL[propostas[0].status] || propostas[0].status : '—'} small />
      </div>

      {docsObrigatoriosPendentes > 0 && (
        <Link
          to="/c/documentos"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-danger/20 bg-danger/5 p-4 transition hover:shadow-card"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-danger/10 p-2.5"><FileWarning className="h-5 w-5 text-danger" /></div>
            <div>
              <p className="font-semibold text-navy">Documentos obrigatórios pendentes</p>
              <p className="text-sm text-silver-600">
                Você tem <b>{docsObrigatoriosPendentes}</b> {docsObrigatoriosPendentes === 1 ? 'documento obrigatório pendente' : 'documentos obrigatórios pendentes'}.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-danger">
            Enviar agora <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Suas propostas</h2>

      {isLoading ? (
        <div className="card flex items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-red-700" />
        </div>
      ) : !propostas?.length ? (
        <div className="card p-10 text-center text-sm text-silver-600">
          Nenhuma proposta encontrada. Se você recebeu um link de acesso do seu parceiro, abra-o para conectar à sua conta.
        </div>
      ) : (
        <div className="space-y-4">
          {propostas.map((p) => {
            const stepIdx = STEP_ORDER.indexOf(p.status)
            const totalSteps = STEP_ORDER.length
            return (
              <Link to={`/c/propostas/${p.id}`} key={p.id} className="card block p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-navy/5 p-2.5"><FileText className="h-5 w-5 text-navy" /></div>
                    <div>
                      <p className="font-mono text-xs text-silver-500">{p.protocolo}</p>
                      <p className="text-base font-semibold text-navy">{PRODUTO_LABEL[p.produto] || p.produto}</p>
                      <p className="text-sm text-silver-600">
                        Valor: <b>{brl(Number(p.valor_solicitado) * 100)}</b> · {p.prazo_meses} meses
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-silver-100 px-2.5 py-1 text-xs font-medium text-silver-700">
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-1">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < stepIdx ? 'bg-success' : i === stepIdx ? 'bg-gold' : 'bg-silver-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-silver-500">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Atualizado {formatRelative(p.updated_at)}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-red-600">
                    Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

function Card({ label, value, tone, small }: { label: string; value: string; tone?: 'danger'; small?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-silver-500">{label}</p>
      <p className={`mt-2 font-bold ${small ? 'text-lg' : 'text-3xl'} ${tone === 'danger' ? 'text-danger' : 'text-navy'}`}>{value}</p>
    </div>
  )
}
