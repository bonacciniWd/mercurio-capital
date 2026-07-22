import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  FUNDO_COR_PADRAO,
  FUNDO_STATUS,
  FUNDO_STATUS_LABEL,
  type FundoStatus,
} from '@/lib/fundoStatus'

interface FundoCatalogo {
  id: string
  nome: string
  cor_hex: string
}

interface AtribuicaoRow {
  fundo_id: string
  status_fundo: FundoStatus
  observacao: string | null
  fundos: { id: string; nome: string; cor_hex: string; ativo: boolean } | null
}

export function PropostaFundos({ propostaId }: { propostaId: string }) {
  const qc = useQueryClient()
  const [fundoSelecionado, setFundoSelecionado] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(FUNDO_COR_PADRAO)
  const [erro, setErro] = useState<string | null>(null)

  const atribuidosKey = ['admin-proposta-fundos', propostaId]
  const catalogoKey = ['admin-fundos-catalogo']

  const { data: atribuidos = [], isLoading } = useQuery({
    queryKey: atribuidosKey,
    queryFn: async (): Promise<AtribuicaoRow[]> => {
      const { data, error } = await supabase
        .from('proposta_fundos')
        .select('fundo_id, status_fundo, observacao, fundos(id, nome, cor_hex, ativo)')
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as AtribuicaoRow[]
    },
    enabled: !!propostaId,
  })

  const { data: catalogo = [] } = useQuery({
    queryKey: catalogoKey,
    queryFn: async (): Promise<FundoCatalogo[]> => {
      const { data, error } = await supabase
        .from('fundos')
        .select('id, nome, cor_hex')
        .eq('ativo', true)
        .order('nome', { ascending: true })
      if (error) throw error
      return (data ?? []) as FundoCatalogo[]
    },
  })

  const disponiveis = useMemo(() => {
    const usados = new Set(atribuidos.map((a) => a.fundo_id))
    return catalogo.filter((f) => !usados.has(f.id))
  }, [atribuidos, catalogo])

  function invalidar() {
    void qc.invalidateQueries({ queryKey: atribuidosKey })
    void qc.invalidateQueries({ queryKey: catalogoKey })
    void qc.invalidateQueries({ queryKey: ['admin-kanban-fundos'] })
  }

  const atribuirMut = useMutation({
    mutationFn: async (fundoId: string) => {
      const { error } = await supabase.rpc('admin_proposta_fundo_set', {
        p_proposta_id: propostaId,
        p_fundo_id: fundoId,
        p_status: 'aguardando',
        p_obs: null,
      })
      if (error) throw error
    },
    onSuccess: () => { setFundoSelecionado(''); setErro(null); invalidar() },
    onError: (e) => setErro((e as Error).message),
  })

  const criarMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_fundo_upsert', {
        p_id: null,
        p_nome: novoNome,
        p_cor: novaCor,
      })
      if (error) throw error
      const fundoId = data as string
      const { error: setErr } = await supabase.rpc('admin_proposta_fundo_set', {
        p_proposta_id: propostaId,
        p_fundo_id: fundoId,
        p_status: 'aguardando',
        p_obs: null,
      })
      if (setErr) throw setErr
    },
    onSuccess: () => { setNovoNome(''); setNovaCor(FUNDO_COR_PADRAO); setErro(null); invalidar() },
    onError: (e) => setErro((e as Error).message),
  })

  const statusMut = useMutation({
    mutationFn: async (vars: { fundoId: string; status: FundoStatus }) => {
      const { error } = await supabase.rpc('admin_proposta_fundo_set', {
        p_proposta_id: propostaId,
        p_fundo_id: vars.fundoId,
        p_status: vars.status,
        p_obs: null,
      })
      if (error) throw error
    },
    onSuccess: () => { setErro(null); invalidar() },
    onError: (e) => setErro((e as Error).message),
  })

  const removerMut = useMutation({
    mutationFn: async (fundoId: string) => {
      const { error } = await supabase.rpc('admin_proposta_fundo_remove', {
        p_proposta_id: propostaId,
        p_fundo_id: fundoId,
      })
      if (error) throw error
    },
    onSuccess: () => { setErro(null); invalidar() },
    onError: (e) => setErro((e as Error).message),
  })

  return (
    <div className="card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-silver-500">Fundos</p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-silver-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : atribuidos.length === 0 ? (
        <p className="text-sm text-silver-500">Nenhum fundo atribuído.</p>
      ) : (
        <ul className="space-y-2">
          {atribuidos.map((a) => (
            <li key={a.fundo_id} className="flex items-center justify-between gap-2 rounded-lg border border-silver-200 p-2">
              <span
                className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: a.fundos?.cor_hex ?? '#64748b' }}
              >
                {a.fundos?.nome ?? 'Fundo'}
              </span>
              <div className="flex items-center gap-2">
                <select
                  className="input h-8 w-auto py-0 text-xs"
                  value={a.status_fundo}
                  disabled={statusMut.isPending}
                  onChange={(e) => statusMut.mutate({ fundoId: a.fundo_id, status: e.target.value as FundoStatus })}
                >
                  {FUNDO_STATUS.map((s) => (
                    <option key={s} value={s}>{FUNDO_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remover fundo ${a.fundos?.nome ?? ''}`}
                  className="rounded p-1 text-silver-400 hover:bg-silver-100 hover:text-danger"
                  disabled={removerMut.isPending}
                  onClick={() => removerMut.mutate(a.fundo_id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3 border-t border-silver-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input h-9 w-auto py-0 text-sm"
            value={fundoSelecionado}
            onChange={(e) => setFundoSelecionado(e.target.value)}
          >
            <option value="">Atribuir fundo existente…</option>
            {disponiveis.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={!fundoSelecionado || atribuirMut.isPending}
            onClick={() => atribuirMut.mutate(fundoSelecionado)}
          >
            Atribuir
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input h-9 w-40 py-0 text-sm"
            placeholder="Novo fundo (nome)"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <input
            type="color"
            aria-label="Cor do novo fundo"
            className="h-9 w-10 cursor-pointer rounded border border-silver-200"
            value={novaCor}
            onChange={(e) => setNovaCor(e.target.value)}
          />
          <button
            type="button"
            className="btn-gold inline-flex items-center gap-1 text-sm"
            disabled={novoNome.trim().length < 2 || criarMut.isPending}
            onClick={() => criarMut.mutate()}
          >
            <Plus className="h-4 w-4" /> Criar e atribuir
          </button>
        </div>

        {erro && <p className="text-xs text-danger">{erro}</p>}
      </div>
    </div>
  )
}
