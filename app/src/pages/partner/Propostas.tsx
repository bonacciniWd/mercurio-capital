import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { StatusBadge } from '@/components/Badge'
import { KPICard } from '@/components/KPICard'
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  FilterX,
  ListFilter,
  Plus,
  Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de Crédito',
  analise_imovel: 'Análise de Imóvel',
  analise_juridica: 'Análise Jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente',
  resolucao_pendencias: 'Pré-análise',
  emissao_contrato: 'Emissão de Contrato',
  aguardando_assinatura: 'Aguardando Assinatura',
  em_registro: 'Em Registro',
  contrato_registrado: 'Contrato Registrado',
  recurso_liberado: 'Recurso Liberado',
  cancelado: 'Cancelado',
}

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const STATUS_FINAIS = new Set(['contrato_registrado', 'completo', 'cancelado'])
const STATUS_AGUARDANDO_CLIENTE = new Set(['proposta_cliente', 'resolucao_pendencias', 'aguardando_assinatura'])

interface PropostaRow {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  updated_at: string
  cliente: { nome_completo: string; cpf: string | null } | null
}

export function PartnerPropostas() {
  const [busca, setBusca] = useState('')
  const [produtoFiltro, setProdutoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-propostas'],
    queryFn: async (): Promise<PropostaRow[]> => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, updated_at, cliente:clientes(nome_completo, cpf)')
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data || []) as unknown as PropostaRow[]
    },
  })

  const rows = (data || []).filter(p => {
    if (produtoFiltro && p.produto !== produtoFiltro) return false
    if (statusFiltro && p.status !== statusFiltro) return false
    if (busca) {
      const q = busca.toLowerCase()
      const nome = p.cliente?.nome_completo?.toLowerCase() || ''
      const cpf = p.cliente?.cpf || ''
      const prot = (p.protocolo || '').toLowerCase()
      if (!nome.includes(q) && !cpf.includes(busca) && !prot.includes(q)) return false
    }
    return true
  })

  const total = data?.length ?? 0
  const finalizadas = data?.filter(p => STATUS_FINAIS.has(p.status)).length ?? 0
  const aguardandoCliente = data?.filter(p => STATUS_AGUARDANDO_CLIENTE.has(p.status)).length ?? 0
  const emAndamento = total - finalizadas - aguardandoCliente
  const filtrosAtivos = Boolean(busca || produtoFiltro || statusFiltro)
  const ultimaAtualizacao = data?.[0]?.updated_at ?? null

  function limparFiltros() {
    setBusca('')
    setProdutoFiltro('')
    setStatusFiltro('')
  }

  return (
    <>
      <section className="mb-6 rounded-2xl border border-silver-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-silver-500">Operação comercial</p>
            <h1 className="mt-1 text-2xl font-bold text-navy">Propostas</h1>
            <p className="mt-1 text-sm text-silver-500">Acompanhe seu pipeline, filtre por etapa e aja rápido nos gargalos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filtrosAtivos && (
              <button type="button" className="btn-no-liquid btn-outline" onClick={limparFiltros}>
                <FilterX className="h-4 w-4" /> Limpar filtros
              </button>
            )}
            <Link to="/p/propostas/nova" className="btn-gold inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nova proposta
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-silver-500">
          <span className="inline-flex items-center rounded-full border border-silver-200 bg-silver-50 px-2.5 py-1 font-medium text-silver-700">
            {rows.length} em exibição
          </span>
          {ultimaAtualizacao && (
            <span>Atualizado {formatRelative(ultimaAtualizacao)}</span>
          )}
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard
          label="Total"
          value={String(total)}
          hint="Propostas na carteira"
          icon={<FileText className="h-4 w-4" />}
        />
        <KPICard
          label="Em andamento"
          value={String(emAndamento)}
          intent="warning"
          hint="Esteira ativa"
          icon={<CircleDashed className="h-4 w-4" />}
        />
        <KPICard
          label="Aguardando cliente"
          value={String(aguardandoCliente)}
          hint="Pendência externa"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <KPICard
          label="Finalizadas"
          value={String(finalizadas)}
          intent="success"
          hint="Ciclo concluído"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <div className="card mb-4 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
            <ListFilter className="h-4 w-4" /> Filtros
          </p>
          <span className="text-xs text-silver-500">{rows.length} resultado(s)</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)]">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por protocolo, cliente ou CPF"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <select className="input" value={produtoFiltro} onChange={e => setProdutoFiltro(e.target.value)}>
            <option value="">Todos os produtos</option>
            {Object.entries(PRODUTO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select className="input" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-danger">Erro ao carregar propostas: {(error as Error).message}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-silver-500">
            {total === 0 ? 'Nenhuma proposta ainda — crie a primeira!' : 'Nenhum resultado para os filtros aplicados.'}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {rows.map(p => (
                <article key={p.id} className="rounded-xl border border-silver-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/p/propostas/${p.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                        {p.protocolo || p.id.slice(0, 8)}
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-silver-900">{p.cliente?.nome_completo || '—'}</p>
                    </div>
                    <StatusBadge status={STATUS_LABEL[p.status] || p.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-silver-500">Produto</p>
                      <p className="mt-0.5 font-medium text-silver-700">{PRODUTO_LABEL[p.produto] || p.produto}</p>
                    </div>
                    <div>
                      <p className="text-silver-500">Atualização</p>
                      <p className="mt-0.5 font-medium text-silver-700">{formatRelative(p.updated_at)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-silver-500">Valor</p>
                      <p className="mt-0.5 text-sm font-semibold text-navy">{brl(Number(p.valor_solicitado) * 100)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Link to={`/p/propostas/${p.id}`} className="btn-no-liquid btn-outline text-xs">
                      Abrir <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                  <tr>
                    {['Protocolo', 'Cliente', 'Produto', 'Valor', 'Status', 'Atualização', 'Ação'].map(h => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(p => (
                    <tr key={p.id} className="border-t border-silver-100 transition-colors hover:bg-silver-50/80">
                      <td className="px-4 py-3">
                        <Link to={`/p/propostas/${p.id}`} className="font-mono text-navy hover:underline">
                          {p.protocolo || p.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-silver-900">{p.cliente?.nome_completo || '—'}</td>
                      <td className="px-4 py-3 text-silver-700">{PRODUTO_LABEL[p.produto] || p.produto}</td>
                      <td className="px-4 py-3 font-medium text-navy">{brl(Number(p.valor_solicitado) * 100)}</td>
                      <td className="px-4 py-3"><StatusBadge status={STATUS_LABEL[p.status] || p.status} /></td>
                      <td className="px-4 py-3 text-xs text-silver-500">{formatRelative(p.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/p/propostas/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-silver-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition hover:border-gold-400 hover:text-gold-700"
                        >
                          Abrir <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias < 30) return `há ${dias}d`
  return d.toLocaleDateString('pt-BR')
}
