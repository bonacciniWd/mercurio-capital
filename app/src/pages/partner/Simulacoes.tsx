import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Loader2, ArrowRightCircle, FileText } from 'lucide-react'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise crédito',
}

interface SimRow {
  id: string
  protocolo: string
  produto: string
  status: string
  valor_solicitado: number
  prazo_meses: number
  created_at: string
  cliente: { nome_completo: string; cpf: string | null } | null
}

// Status que ainda são "simulação" (não convertidas em proposta avançada)
const STATUS_SIMULACAO = ['simulacao', 'pre_analise', 'analise_credito']

export function PartnerSimulacoes() {
  const [busca, setBusca] = useState('')
  const [produtoFiltro, setProdutoFiltro] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-simulacoes'],
    queryFn: async (): Promise<SimRow[]> => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, prazo_meses, created_at, cliente:clientes(nome_completo, cpf)')
        .in('status', STATUS_SIMULACAO)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data || []) as unknown as SimRow[]
    },
  })

  const rows = (data || []).filter(p => {
    if (produtoFiltro && p.produto !== produtoFiltro) return false
    if (busca) {
      const q = busca.toLowerCase()
      const nome = p.cliente?.nome_completo?.toLowerCase() ?? ''
      const cpf = p.cliente?.cpf ?? ''
      const prot = (p.protocolo ?? '').toLowerCase()
      if (!nome.includes(q) && !cpf.includes(busca) && !prot.includes(q)) return false
    }
    return true
  })

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Simulações</h1>
          <p className="text-sm text-silver-600">Propostas em rascunho e pré-análise.</p>
        </div>
        <Link to="/p/propostas/nova" className="btn-gold inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Nova proposta
        </Link>
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por cliente, CPF ou protocolo"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={produtoFiltro}
          onChange={e => setProdutoFiltro(e.target.value)}
        >
          <option value="">Todos os produtos</option>
          <option value="home_equity">Home Equity</option>
          <option value="credito_construcao">Construção</option>
          <option value="financiamento_imobiliario">Financiamento</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-silver-400" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-danger">Erro ao carregar simulações.</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-silver-400">
            <FileText className="h-10 w-10" />
            <p className="text-sm">Nenhuma simulação encontrada.</p>
            <Link to="/p/propostas/nova" className="btn-gold mt-2 inline-flex items-center gap-1 text-sm">
              <Plus className="h-4 w-4" /> Criar primeira proposta
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
              <tr>
                {['Protocolo', 'Cliente', 'Produto', 'Crédito', 'Prazo', 'Status', 'Data', 'Ações'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-4 py-3 font-mono text-xs text-silver-500">{s.protocolo}</td>
                  <td className="px-4 py-3 font-medium text-navy">{s.cliente?.nome_completo ?? '—'}</td>
                  <td className="px-4 py-3 text-silver-700">{PRODUTO_LABEL[s.produto] ?? s.produto}</td>
                  <td className="px-4 py-3 font-medium">{brl(s.valor_solicitado * 100)}</td>
                  <td className="px-4 py-3 text-silver-600">{s.prazo_meses}m</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-silver-100 px-2.5 py-0.5 text-xs font-medium text-silver-600">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-silver-500">
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/p/propostas/${s.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
                    >
                      <ArrowRightCircle className="h-3.5 w-3.5" /> Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
