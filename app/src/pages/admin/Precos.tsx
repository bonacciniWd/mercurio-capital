import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Edit2, History, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface Preco {
  id: string
  tipo: string
  preco_centavos: number
  custo_fornecedor_centavos: number
  vigente_de: string
  vigente_ate: string | null
  descricao: string | null
}

const TIPOS: { id: string; label: string; descricao: string }[] = [
  { id: 'bacen_cpf', label: 'Bacen CPF', descricao: 'Consulta de CPF no Bacen' },
  { id: 'bacen_cnpj', label: 'Bacen CNPJ', descricao: 'Consulta de CNPJ no Bacen' },
  { id: 'serasa_pf', label: 'Serasa PF', descricao: 'Score Serasa pessoa física' },
  { id: 'serasa_pj', label: 'Serasa PJ', descricao: 'Score Serasa pessoa jurídica' },
  { id: 'jusbrasil_cnpj', label: 'Jusbrasil CNPJ', descricao: 'Processos Jusbrasil' },
  { id: 'escavador_cnpj', label: 'Escavador CNPJ', descricao: 'Processos Escavador' },
  { id: 'ri_digital_matricula', label: 'RI Digital · matrícula', descricao: 'Matrícula via RI Digital' },
  { id: 'nacional_consultas_bens', label: 'Nacional · bens', descricao: 'Pesquisa de bens' },
  { id: 'nacional_consultas_certidao', label: 'Nacional · certidão', descricao: 'Certidões nacionais' },
]

export function AdminPrecos() {
  const qc = useQueryClient()
  const [editando, setEditando] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [custo, setCusto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [historicoTipo, setHistoricoTipo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const precosQuery = useQuery({
    queryKey: ['admin-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_consulta')
        .select('id, tipo, preco_centavos, custo_fornecedor_centavos, vigente_de, vigente_ate, descricao')
        .order('vigente_de', { ascending: false })
      if (error) throw error
      return (data ?? []) as Preco[]
    },
  })

  const upsertMut = useMutation({
    mutationFn: async (args: { tipo: string; preco: number; custo: number; descricao: string }) => {
      const { error } = await supabase.rpc('admin_precos_upsert', {
        p_tipo: args.tipo,
        p_preco_centavos: args.preco,
        p_custo_fornecedor_centavos: args.custo,
        p_descricao: args.descricao || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setEditando(null); setValor(''); setCusto(''); setDescricao(''); setErro(null)
      void qc.invalidateQueries({ queryKey: ['admin-precos'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'falha'),
  })

  const todos = precosQuery.data ?? []
  const vigentes = new Map<string, Preco>()
  for (const p of todos) {
    if (!p.vigente_ate && !vigentes.has(p.tipo)) vigentes.set(p.tipo, p)
  }

  function abrirEdicao(tipo: string) {
    const atual = vigentes.get(tipo)
    setEditando(tipo)
    setValor(atual ? (atual.preco_centavos / 100).toFixed(2).replace('.', ',') : '')
    setCusto(atual ? (atual.custo_fornecedor_centavos / 100).toFixed(2).replace('.', ',') : '0,00')
    setDescricao(atual?.descricao ?? TIPOS.find(t => t.id === tipo)?.descricao ?? '')
    setErro(null)
  }

  function confirmar() {
    if (!editando) return
    const preco = Math.round(Number(valor.replace(/[^\d,]/g, '').replace(',', '.')) * 100)
    const cust = Math.round(Number(custo.replace(/[^\d,]/g, '').replace(',', '.')) * 100)
    if (!Number.isFinite(preco) || preco <= 0) { setErro('Preço inválido'); return }
    upsertMut.mutate({ tipo: editando, preco, custo: Number.isFinite(cust) ? cust : 0, descricao })
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Preços de consultas</h1>
        <p className="text-sm text-silver-500">Os preços são versionados — alterações fecham o vigente anterior.</p>
      </div>

      <div className="card">
        {precosQuery.isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-silver-500" style={{ backgroundColor: '#f9f9f9' }}>
              <tr>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3 text-right">Preço atual</th>
                <th className="px-5 py-3 text-right">Custo fornecedor</th>
                <th className="px-5 py-3 text-right">Margem</th>
                <th className="px-5 py-3">Vigente desde</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {TIPOS.map(t => {
                const p = vigentes.get(t.id)
                const margem = p ? p.preco_centavos - p.custo_fornecedor_centavos : 0
                return (
                  <tr key={t.id} className="border-t border-silver-100 hover:bg-silver-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy">{t.label}</p>
                      <p className="text-xs text-silver-500">{p?.descricao ?? t.descricao}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-navy">{p ? brl(p.preco_centavos) : <span className="text-silver-400">não definido</span>}</td>
                    <td className="px-5 py-3 text-right text-silver-700">{p ? brl(p.custo_fornecedor_centavos) : '—'}</td>
                    <td className={`px-5 py-3 text-right font-medium ${margem > 0 ? 'text-success' : 'text-silver-400'}`}>
                      {p ? brl(margem) : '—'}
                    </td>
                    <td className="px-5 py-3 text-silver-700">{p ? new Date(p.vigente_de).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button className="btn-outline" onClick={() => abrirEdicao(t.id)} title="Editar">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button className="btn-outline" onClick={() => setHistoricoTipo(t.id)} title="Histórico">
                          <History className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <Modal onClose={() => setEditando(null)} title={`Atualizar preço · ${TIPOS.find(t => t.id === editando)?.label}`}>
          <p className="text-xs text-silver-500">A versão anterior será arquivada automaticamente.</p>
          <label className="mt-3 block text-xs font-medium text-silver-600">Preço (R$)</label>
          <input className="input mt-1" value={valor} onChange={e => setValor(e.target.value)} placeholder="4,90" />
          <label className="mt-3 block text-xs font-medium text-silver-600">Custo fornecedor (R$)</label>
          <input className="input mt-1" value={custo} onChange={e => setCusto(e.target.value)} placeholder="2,00" />
          <label className="mt-3 block text-xs font-medium text-silver-600">Descrição</label>
          <input className="input mt-1" value={descricao} onChange={e => setDescricao(e.target.value)} />
          {erro && <p className="mt-2 text-xs text-danger"><AlertTriangle className="mr-1 inline h-3 w-3" /> {erro}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn-gold" disabled={upsertMut.isPending} onClick={confirmar}>
              {upsertMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova versão
            </button>
          </div>
        </Modal>
      )}

      {historicoTipo && (
        <Modal onClose={() => setHistoricoTipo(null)} title={`Histórico · ${TIPOS.find(t => t.id === historicoTipo)?.label}`}>
          <ul className="max-h-80 space-y-2 overflow-auto text-sm">
            {todos.filter(p => p.tipo === historicoTipo).map(p => (
              <li key={p.id} className="rounded border border-silver-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy">{brl(p.preco_centavos)}</span>
                  {!p.vigente_ate ? (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">vigente</span>
                  ) : (
                    <span className="text-xs text-silver-500">até {new Date(p.vigente_ate).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
                <p className="text-xs text-silver-500">Desde {new Date(p.vigente_de).toLocaleDateString('pt-BR')} · custo {brl(p.custo_fornecedor_centavos)}</p>
              </li>
            ))}
          </ul>
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
