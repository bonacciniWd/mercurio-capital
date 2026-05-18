import { useQuery } from '@tanstack/react-query'
import { Loader2, Coins, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface ComissaoRow {
  id: string
  proposta_id: string
  percentual: number
  valor: number
  status: 'prevista' | 'aprovada' | 'paga'
  paga_em: string | null
  created_at: string
  proposta: { protocolo: string | null; cliente: { nome_completo: string | null } | null } | null
}

const cents = (v: number | string) => Math.round(Number(v ?? 0) * 100)

export function PartnerComissoes() {
  const { data: comissoes, isLoading } = useQuery({
    queryKey: ['partner-comissoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('id, proposta_id, percentual, valor, status, paga_em, created_at, proposta:propostas(protocolo, cliente:clientes(nome_completo))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ComissaoRow[]
    },
  })

  const lista = comissoes ?? []
  const prev = lista.filter(c => c.status === 'prevista').reduce((a, c) => a + Number(c.valor), 0)
  const apro = lista.filter(c => c.status === 'aprovada').reduce((a, c) => a + Number(c.valor), 0)
  const paga = lista.filter(c => c.status === 'paga').reduce((a, c) => a + Number(c.valor), 0)
  const proximo = lista.filter(c => c.status === 'aprovada').sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Comissões</h1>
        <p className="text-sm text-silver-500">Histórico de comissões geradas a partir de operações liberadas.</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Clock} label="Previstas" value={brl(cents(prev))} cls="text-yellow-700" />
        <Kpi icon={TrendingUp} label="Aprovadas" value={brl(cents(apro))} cls="text-blue-700" />
        <Kpi icon={CheckCircle2} label="Pagas" value={brl(cents(paga))} cls="text-success" />
        <Kpi icon={Coins} label="Próximo recebimento" value={proximo ? brl(cents(proximo.valor)) : '—'}
          sub={proximo?.proposta?.protocolo ?? ''} />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-silver-100 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-silver-500">Histórico</h3>
        </div>
        {isLoading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gold" /></div>
        ) : lista.length === 0 ? (
          <p className="p-10 text-center text-sm text-silver-500">Nenhuma comissão ainda. Quando uma proposta tiver recurso liberado, a comissão aparecerá aqui.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link to={`/p/propostas/${c.proposta_id}`} className="text-gold-600 hover:underline">
                      {c.proposta?.protocolo ?? c.proposta_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-silver-700">{c.proposta?.cliente?.nome_completo ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{Number(c.percentual).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-bold text-navy">{brl(cents(c.valor))}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      c.status === 'paga' ? 'bg-success/15 text-success' :
                      c.status === 'aprovada' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-silver-500">
                    {c.paga_em
                      ? `Paga ${new Date(c.paga_em).toLocaleDateString('pt-BR')}`
                      : new Date(c.created_at).toLocaleDateString('pt-BR')}
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

function Kpi({ icon: Icon, label, value, sub, cls }: { icon: typeof Coins; label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-silver-500">
        <Icon className={`h-4 w-4 ${cls ?? 'text-gold'}`} />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-navy">{value}</p>
      {sub && <p className="font-mono text-xs text-silver-500">{sub}</p>}
    </div>
  )
}

