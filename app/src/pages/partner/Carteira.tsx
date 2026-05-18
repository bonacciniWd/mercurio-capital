import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, ArrowDown, ArrowUp, RotateCcw, Loader2, AlertTriangle, Plus, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface Resumo {
  wallet_id: string
  partner_id: string
  saldo_centavos: number
  moeda: string
  bloqueada: boolean
  motivo_bloqueio: string | null
  limite_diario_centavos: number | null
  creditos_30d: number
  debitos_30d: number
  ultima_movimentacao: string | null
}

interface Extrato {
  id: string
  tipo: string
  valor_centavos: number
  saldo_antes: number
  saldo_depois: number
  referencia_tipo: string | null
  descricao: string | null
  criado_por_nome: string | null
  created_at: string
}

interface Preco {
  id: string
  tipo: string
  preco_centavos: number
  descricao: string | null
}

const TIPO_LABEL: Record<string, { label: string; cor: string; sinal: 1 | -1 }> = {
  recarga:         { label: 'Recarga',          cor: 'text-success', sinal: 1 },
  estorno:         { label: 'Estorno',          cor: 'text-success', sinal: 1 },
  ajuste_credito:  { label: 'Ajuste (crédito)', cor: 'text-success', sinal: 1 },
  debito_consulta: { label: 'Consulta',         cor: 'text-danger',  sinal: -1 },
  ajuste_debito:   { label: 'Ajuste (débito)',  cor: 'text-danger',  sinal: -1 },
  tarifa:          { label: 'Tarifa',           cor: 'text-danger',  sinal: -1 },
}

const PRECO_LABEL: Record<string, string> = {
  bacen_cpf: 'Bacen CPF',
  bacen_cnpj: 'Bacen CNPJ',
  serasa_pf: 'Serasa PF',
  serasa_pj: 'Serasa PJ',
  jusbrasil_cnpj: 'Jusbrasil CNPJ',
  escavador_cnpj: 'Escavador CNPJ',
  ri_digital_matricula: 'RI Digital · matrícula',
  nacional_consultas_bens: 'Nacional · bens',
  nacional_consultas_certidao: 'Nacional · certidão',
}

export function PartnerCarteira() {
  const qc = useQueryClient()
  const [valorRecarga, setValorRecarga] = useState('200,00')
  const [erro, setErro] = useState<string | null>(null)

  const resumoQuery = useQuery({
    queryKey: ['wallet-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_wallet_summary')
      if (error) throw error
      const rows = (data ?? []) as Resumo[]
      return rows[0] ?? null
    },
  })

  const extratoQuery = useQuery({
    queryKey: ['wallet-extrato'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_wallet_extrato')
        .select('id, tipo, valor_centavos, saldo_antes, saldo_depois, referencia_tipo, descricao, criado_por_nome, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Extrato[]
    },
  })

  const precosQuery = useQuery({
    queryKey: ['wallet-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_consulta')
        .select('id, tipo, preco_centavos, descricao')
        .is('vigente_ate', null)
        .order('tipo')
      if (error) throw error
      return (data ?? []) as Preco[]
    },
  })

  const recarregar = useMutation({
    mutationFn: async (centavos: number) => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) throw new Error('Sessão expirada')
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-topup`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ valor_centavos: centavos }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'falha_topup')
      return json as { checkout_url: string; dev_mode?: boolean }
    },
    onSuccess: (data) => {
      if (data.dev_mode) {
        setErro('Stripe não configurado. Solicite ao admin um crédito manual ou configure STRIPE_SECRET_KEY.')
        void qc.invalidateQueries({ queryKey: ['wallet-extrato'] })
        return
      }
      window.location.href = data.checkout_url
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'erro'),
  })

  const resumo = resumoQuery.data
  const saldo = resumo?.saldo_centavos ?? 0
  const bloqueada = resumo?.bloqueada ?? false

  function onRecarregar() {
    setErro(null)
    const cleaned = valorRecarga.replace(/[^\d,]/g, '').replace(',', '.')
    const num = Math.round(Number(cleaned) * 100)
    if (!Number.isFinite(num) || num < 2000) {
      setErro('Valor mínimo: R$ 20,00')
      return
    }
    recarregar.mutate(num)
  }

  if (resumoQuery.isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
  }

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Carteira</h1>
          <p className="text-sm text-silver-500">Saldo, recargas e extrato de consultas.</p>
        </div>
      </div>

      {bloqueada && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Carteira bloqueada</p>
            <p className="text-xs">{resumo?.motivo_bloqueio ?? 'Procure o administrador.'}</p>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2" style={{ borderTopWidth: 2, borderTopColor: '#DC2626' }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-silver-500">
            <Wallet className="h-4 w-4" /> Saldo disponível
          </div>
          <p className="mt-2 text-4xl font-bold text-navy">{brl(saldo)}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-silver-100 pt-4 text-sm">
            <div>
              <p className="text-xs text-silver-500">Créditos (30d)</p>
              <p className="font-bold text-success">+ {brl(Number(resumo?.creditos_30d ?? 0))}</p>
            </div>
            <div>
              <p className="text-xs text-silver-500">Débitos (30d)</p>
              <p className="font-bold text-danger">- {brl(Number(resumo?.debitos_30d ?? 0))}</p>
            </div>
          </div>
        </div>

        <div className="card p-5" style={{ borderTopWidth: 2, borderTopColor: '#16A34A' }}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy">
            <Plus className="h-4 w-4" /> Nova recarga
          </h2>
          <label className="block text-xs font-medium text-silver-600">Valor (R$)</label>
          <input
            className="input mt-1"
            value={valorRecarga}
            onChange={(e) => setValorRecarga(e.target.value)}
            placeholder="200,00"
            disabled={bloqueada || recarregar.isPending}
          />
          <p className="mt-1 text-xs text-silver-500">Mínimo R$ 20,00. Pagamento via Stripe.</p>
          <button
            className="btn-gold mt-3 w-full"
            disabled={bloqueada || recarregar.isPending}
            onClick={onRecarregar}
          >
            {recarregar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Recarregar
          </button>
          {erro && <p className="mt-2 text-xs text-danger">{erro}</p>}
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy">
            <Settings2 className="h-4 w-4" /> Tabela de preços
          </h2>
          <ul className="space-y-2 text-sm">
            {(precosQuery.data ?? []).map(p => (
              <li key={p.id} className="flex items-center justify-between border-b border-silver-100 pb-2 last:border-0">
                <span className="text-silver-700">{PRECO_LABEL[p.tipo] ?? p.tipo}</span>
                <span className="font-bold text-navy">{brl(p.preco_centavos)}</span>
              </li>
            ))}
            {(precosQuery.data ?? []).length === 0 && <li className="text-silver-400">Sem preços cadastrados.</li>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-navy">Resumo</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-silver-600">Última movimentação</span><span className="font-medium text-navy">{resumo?.ultima_movimentacao ? new Date(resumo.ultima_movimentacao).toLocaleString('pt-BR') : '—'}</span></li>
            <li className="flex justify-between"><span className="text-silver-600">Moeda</span><span className="font-medium text-navy">{resumo?.moeda ?? 'BRL'}</span></li>
            <li className="flex justify-between"><span className="text-silver-600">Limite diário</span><span className="font-medium text-navy">{resumo?.limite_diario_centavos ? brl(resumo.limite_diario_centavos) : 'Sem limite'}</span></li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-silver-200 p-5">
          <h2 className="font-semibold text-navy">Extrato (últimas 50 movimentações)</h2>
        </div>
        {extratoQuery.isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
        ) : (extratoQuery.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-silver-400">Nenhuma movimentação ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {(extratoQuery.data ?? []).map(m => {
                const meta = TIPO_LABEL[m.tipo] ?? { label: m.tipo, cor: 'text-silver-700', sinal: 1 as const }
                const Icon = meta.sinal === 1 ? ArrowDown : ArrowUp
                return (
                  <tr key={m.id} className="border-t border-silver-100">
                    <td className="px-5 py-3 text-silver-700">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 font-medium ${meta.cor}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-silver-700">{m.descricao ?? '—'}{m.criado_por_nome ? ` · ${m.criado_por_nome}` : ''}</td>
                    <td className={`px-5 py-3 text-right font-bold ${meta.cor}`}>{meta.sinal === 1 ? '+' : '-'} {brl(m.valor_centavos)}</td>
                    <td className="px-5 py-3 text-right font-medium text-navy">{brl(m.saldo_depois)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
