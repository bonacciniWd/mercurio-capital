import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, Loader2, Plus, Send, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type DocumentoTipo =
  | 'rg' | 'cpf' | 'cnh' | 'contrato_social' | 'comprovante_residencia'
  | 'comprovante_renda' | 'matricula_imovel' | 'iptu' | 'certidao_casamento' | 'outros'

type PendenciaStatus = 'aberta' | 'em_analise' | 'resolvida' | 'rejeitada'

const TIPO_LABEL: Record<DocumentoTipo, string> = {
  rg: 'RG',
  cpf: 'CPF',
  cnh: 'CNH',
  contrato_social: 'Contrato Social',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_renda: 'Comprovante de Renda',
  matricula_imovel: 'Matrícula do Imóvel',
  iptu: 'IPTU',
  certidao_casamento: 'Certidão de Casamento',
  outros: 'Outros',
}

const STATUS_BADGE: Record<PendenciaStatus, { label: string; cls: string }> = {
  aberta: { label: 'Aberta', cls: 'bg-warning/15 text-warning' },
  em_analise: { label: 'Em análise', cls: 'bg-blue-100 text-blue-700' },
  resolvida: { label: 'Resolvida', cls: 'bg-success/15 text-success' },
  rejeitada: { label: 'Rejeitada', cls: 'bg-danger/15 text-danger' },
}

interface PendenciaRow {
  id: string
  descricao: string
  documento_solicitado_tipo: DocumentoTipo | null
  status: PendenciaStatus
  prazo: string | null
  resolvida_em: string | null
  created_at: string
}

interface Props {
  propostaId: string
  role: 'admin' | 'parceiro' | 'cliente'
  className?: string
}

export function PropostaPendencias({ propostaId, role, className }: Props) {
  const qc = useQueryClient()
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<DocumentoTipo | ''>('')
  const [prazo, setPrazo] = useState<string>('')

  const podeCriar = role === 'admin' || role === 'parceiro'
  const podeResolver = role === 'admin' || role === 'parceiro'

  const { data: pendencias, isLoading } = useQuery({
    queryKey: ['proposta-pendencias', propostaId],
    queryFn: async (): Promise<PendenciaRow[]> => {
      const { data, error } = await supabase
        .from('proposta_pendencias')
        .select('id, descricao, documento_solicitado_tipo, status, prazo, resolvida_em, created_at')
        .eq('proposta_id', propostaId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const criarMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        proposta_id: propostaId,
        descricao: descricao.trim(),
        solicitado_por: (await supabase.auth.getUser()).data.user?.id,
        status: 'aberta',
      }
      if (tipo) payload.documento_solicitado_tipo = tipo
      if (prazo) payload.prazo = new Date(prazo).toISOString()
      const { error } = await supabase.from('proposta_pendencias').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setDescricao('')
      setTipo('')
      setPrazo('')
      qc.invalidateQueries({ queryKey: ['proposta-pendencias', propostaId] })
    },
  })

  const resolverMut = useMutation({
    mutationFn: async (vars: { id: string; status: 'resolvida' | 'rejeitada' }) => {
      const { error } = await supabase.rpc('pendencia_resolver', {
        p_id: vars.id,
        p_status: vars.status,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposta-pendencias', propostaId] }),
  })

  const responderMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cliente_responder_pendencia', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposta-pendencias', propostaId] }),
  })

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {podeCriar && (
        <div className="card p-5">
          <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-silver-500">
            <Plus className="h-4 w-4" /> Abrir pendência
          </h3>
          <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
            <input
              className="input"
              placeholder="Descrição da pendência (ex: enviar IPTU 2025)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <select
              className="input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as DocumentoTipo | '')}
            >
              <option value="">Tipo de documento (opcional)</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="date"
              className="input"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
            <button
              className="btn-gold inline-flex items-center gap-1"
              disabled={!descricao.trim() || criarMut.isPending}
              onClick={() => criarMut.mutate()}
            >
              {criarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </button>
          </div>
          {criarMut.error && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3" /> {(criarMut.error as Error).message}
            </p>
          )}
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">
          Pendências {pendencias?.length ? `(${pendencias.length})` : ''}
        </h3>

        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gold" /></div>
        ) : !pendencias?.length ? (
          <p className="p-6 text-center text-sm text-silver-500">Sem pendências.</p>
        ) : (
          <ul className="space-y-3">
            {pendencias.map((p) => {
              const badge = STATUS_BADGE[p.status]
              const ativa = p.status === 'aberta' || p.status === 'em_analise'
              return (
                <li key={p.id} className="rounded-lg border border-silver-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-silver-900">{p.descricao}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-silver-500">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                        {p.documento_solicitado_tipo && (
                          <span>· Doc: {TIPO_LABEL[p.documento_solicitado_tipo]}</span>
                        )}
                        {p.prazo && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Prazo {new Date(p.prazo).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        <span>· Aberta em {new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    {ativa && (
                      <div className="flex flex-wrap gap-2">
                        {role === 'cliente' && p.status === 'aberta' && (
                          <button
                            className="btn-gold inline-flex items-center gap-1"
                            disabled={responderMut.isPending}
                            onClick={() => responderMut.mutate(p.id)}
                          >
                            <Send className="h-4 w-4" /> Marcar como respondida
                          </button>
                        )}
                        {podeResolver && (
                          <>
                            <button
                              className="btn-gold inline-flex items-center gap-1"
                              disabled={resolverMut.isPending}
                              onClick={() => resolverMut.mutate({ id: p.id, status: 'resolvida' })}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Resolver
                            </button>
                            <button
                              className="btn-outline inline-flex items-center gap-1"
                              disabled={resolverMut.isPending}
                              onClick={() => resolverMut.mutate({ id: p.id, status: 'rejeitada' })}
                            >
                              <XCircle className="h-4 w-4" /> Rejeitar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {(resolverMut.error || responderMut.error) && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-danger">
            <AlertTriangle className="h-3 w-3" />
            {(resolverMut.error as Error | undefined)?.message || (responderMut.error as Error | undefined)?.message}
          </p>
        )}
      </div>
    </div>
  )
}
