import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { StatusBadge } from '@/components/Badge'
import { KPICard } from '@/components/KPICard'
import { Plus, Search } from 'lucide-react'
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

const STATUS_FINAIS = new Set(['contrato_registrado', 'recurso_liberado', 'cancelado'])
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

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Propostas</h1>
        <Link to="/p/propostas/nova" className="btn-gold inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Nova proposta
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <KPICard label="Total" value={String(total)} />
        <KPICard label="Em andamento" value={String(emAndamento)} intent="warning" />
        <KPICard label="Aguardando cliente" value={String(aguardandoCliente)} />
        <KPICard label="Finalizadas" value={String(finalizadas)} intent="success" />
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por protocolo, cliente ou CPF"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={produtoFiltro} onChange={e => setProdutoFiltro(e.target.value)}>
          <option value="">Todos os produtos</option>
          {Object.entries(PRODUTO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="input w-auto" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-danger">Erro ao carregar propostas: {(error as Error).message}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-silver-500">
            {total === 0 ? 'Nenhuma proposta ainda — crie a primeira!' : 'Nenhum resultado para os filtros aplicados.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                {['Protocolo', 'Cliente', 'Produto', 'Valor', 'Status', 'Atualização'].map(h => (
                  <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-4 py-3">
                    <Link to={`/p/propostas/${p.id}`} className="font-mono text-navy hover:underline">
                      {p.protocolo || p.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-silver-900">{p.cliente?.nome_completo || '—'}</td>
                  <td className="px-4 py-3 text-silver-700">{PRODUTO_LABEL[p.produto] || p.produto}</td>
                  <td className="px-4 py-3 font-medium">{brl(Number(p.valor_solicitado) * 100)}</td>
                  <td className="px-4 py-3"><StatusBadge status={STATUS_LABEL[p.status] || p.status} /></td>
                  <td className="px-4 py-3 text-xs text-silver-500">{formatRelative(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
