import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock, Unlock, Plus, Minus, Search, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface WalletRow {
  id: string
  partner_id: string
  partner_nome: string
  partner_email: string | null
  saldo_centavos: number
  bloqueada: boolean
  motivo_bloqueio: string | null
  ultima_movimentacao: string | null
}

type AjusteState = { partner_id: string; partner_nome: string; tipo: 'ajuste_credito' | 'ajuste_debito' } | null

export function AdminCarteiras() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [ajuste, setAjuste] = useState<AjusteState>(null)
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteDesc, setAjusteDesc] = useState('')
  const [bloqueio, setBloqueio] = useState<{ partner_id: string; partner_nome: string } | null>(null)
  const [bloqueioMotivo, setBloqueioMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const walletsQuery = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_wallets')
        .select('id, partner_id, partner_nome, partner_email, saldo_centavos, bloqueada, motivo_bloqueio, ultima_movimentacao')
        .order('saldo_centavos', { ascending: false })
      if (error) throw error
      return (data ?? []) as WalletRow[]
    },
  })

  const ajusteMut = useMutation({
    mutationFn: async (args: { partner_id: string; tipo: 'ajuste_credito' | 'ajuste_debito'; centavos: number; descricao: string }) => {
      const { error } = await supabase.rpc('admin_wallet_ajuste', {
        p_partner: args.partner_id, p_tipo: args.tipo, p_valor: args.centavos, p_descricao: args.descricao || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setAjuste(null); setAjusteValor(''); setAjusteDesc(''); setErro(null)
      void qc.invalidateQueries({ queryKey: ['admin-wallets'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const bloqueioMut = useMutation({
    mutationFn: async (args: { partner_id: string; bloqueada: boolean; motivo: string }) => {
      const { error } = await supabase.rpc('admin_wallet_set_bloqueio', {
        p_partner: args.partner_id, p_bloqueada: args.bloqueada, p_motivo: args.motivo || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setBloqueio(null); setBloqueioMotivo(''); setErro(null)
      void qc.invalidateQueries({ queryKey: ['admin-wallets'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  function confirmarAjuste() {
    if (!ajuste) return
    const num = Math.round(Number(ajusteValor.replace(/[^\d,]/g, '').replace(',', '.')) * 100)
    if (!Number.isFinite(num) || num <= 0) {
      setErro('Informe um valor válido')
      return
    }
    ajusteMut.mutate({ partner_id: ajuste.partner_id, tipo: ajuste.tipo, centavos: num, descricao: ajusteDesc })
  }

  const rows = (walletsQuery.data ?? []).filter(w =>
    !busca || w.partner_nome.toLowerCase().includes(busca.toLowerCase()) ||
    (w.partner_email ?? '').toLowerCase().includes(busca.toLowerCase()))

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Carteiras de parceiros</h1>
        <p className="text-sm text-silver-500">Saldos, ajustes manuais e bloqueio/desbloqueio.</p>
      </div>

      <div className="card mb-4 flex items-center gap-3 p-3">
        <Search className="h-4 w-4 text-silver-400" />
        <input className="input flex-1 border-0 shadow-none" placeholder="Buscar parceiro..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="card">
        {walletsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-silver-400">Nenhum parceiro encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-5 py-3">Parceiro</th>
                <th className="px-5 py-3 text-right">Saldo</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Última mov.</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(w => (
                <tr key={w.id} className="border-t border-silver-100 hover:bg-silver-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy">{w.partner_nome}</p>
                    <p className="text-xs text-silver-500">{w.partner_email}</p>
                  </td>
                  <td className={`px-5 py-3 text-right font-bold ${w.saldo_centavos < 5000 ? 'text-danger' : 'text-navy'}`}>
                    {brl(w.saldo_centavos)}
                  </td>
                  <td className="px-5 py-3">
                    {w.bloqueada ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                        <Lock className="h-3 w-3" /> Bloqueada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                        Ativa
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-silver-700">{w.ultima_movimentacao ? new Date(w.ultima_movimentacao).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button className="btn-outline" title="Crédito" onClick={() => { setAjuste({ partner_id: w.partner_id, partner_nome: w.partner_nome, tipo: 'ajuste_credito' }); setErro(null) }}>
                        <Plus className="h-3 w-3" />
                      </button>
                      <button className="btn-outline" title="Débito" onClick={() => { setAjuste({ partner_id: w.partner_id, partner_nome: w.partner_nome, tipo: 'ajuste_debito' }); setErro(null) }}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <button className="btn-outline" title={w.bloqueada ? 'Desbloquear' : 'Bloquear'}
                        onClick={() => {
                          if (w.bloqueada) bloqueioMut.mutate({ partner_id: w.partner_id, bloqueada: false, motivo: '' })
                          else { setBloqueio({ partner_id: w.partner_id, partner_nome: w.partner_nome }); setBloqueioMotivo(''); setErro(null) }
                        }}>
                        {w.bloqueada ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ajuste && (
        <Modal onClose={() => setAjuste(null)} title={`${ajuste.tipo === 'ajuste_credito' ? 'Creditar' : 'Debitar'} carteira`}>
          <p className="text-sm text-silver-600">Parceiro: <strong className="text-navy">{ajuste.partner_nome}</strong></p>
          <label className="mt-3 block text-xs font-medium text-silver-600">Valor (R$)</label>
          <input className="input mt-1" value={ajusteValor} onChange={e => setAjusteValor(e.target.value)} placeholder="100,00" />
          <label className="mt-3 block text-xs font-medium text-silver-600">Descrição (opcional)</label>
          <input className="input mt-1" value={ajusteDesc} onChange={e => setAjusteDesc(e.target.value)} placeholder="Ex: ajuste comercial" />
          {erro && <p className="mt-2 text-xs text-danger"><AlertTriangle className="mr-1 inline h-3 w-3" /> {erro}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setAjuste(null)}>Cancelar</button>
            <button className="btn-gold" disabled={ajusteMut.isPending} onClick={confirmarAjuste}>
              {ajusteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
            </button>
          </div>
        </Modal>
      )}

      {bloqueio && (
        <Modal onClose={() => setBloqueio(null)} title="Bloquear carteira">
          <p className="text-sm text-silver-600">Parceiro: <strong className="text-navy">{bloqueio.partner_nome}</strong></p>
          <label className="mt-3 block text-xs font-medium text-silver-600">Motivo</label>
          <textarea className="input mt-1" rows={3} value={bloqueioMotivo} onChange={e => setBloqueioMotivo(e.target.value)} placeholder="Inadimplência, fraude suspeita..." />
          {erro && <p className="mt-2 text-xs text-danger"><AlertTriangle className="mr-1 inline h-3 w-3" /> {erro}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setBloqueio(null)}>Cancelar</button>
            <button className="btn-gold" disabled={bloqueioMut.isPending}
              onClick={() => bloqueioMut.mutate({ partner_id: bloqueio.partner_id, bloqueada: true, motivo: bloqueioMotivo })}>
              {bloqueioMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Bloquear
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-bold text-navy">{title}</h3>
        {children}
      </div>
    </div>
  )
}
