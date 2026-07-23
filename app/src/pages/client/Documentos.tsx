import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PropostaDocsUploader } from '@/components/PropostaDocsUploader'
import {
  buildChecklist,
  CATEGORIA_LABEL,
  DOC_STATUS_LABEL,
  TIPO_LABEL,
  type ChecklistItem,
  type DocCategoria,
  type DocRowLite,
  type DocStatus,
  type RequisitoRow,
} from '@/lib/documentos'

type Aba = 'Pendentes' | 'Enviados' | 'Aprovados'

const STATUS_STYLE: Record<DocStatus, string> = {
  pendente: 'bg-warning/10 text-warning',
  enviado: 'bg-navy/10 text-navy',
  aprovado: 'bg-success/10 text-success',
  rejeitado: 'bg-danger/10 text-danger',
}

const CATEGORIA_ORDER: DocCategoria[] = ['pessoa_fisica', 'pessoa_juridica', 'imovel']

export function ClientDocs() {
  const qc = useQueryClient()
  const [propostaSel, setPropostaSel] = useState('')
  const [aba, setAba] = useState<Aba>('Pendentes')

  const { data: propostas } = useQuery({
    queryKey: ['client-docs-propostas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const activeId = propostaSel || propostas?.[0]?.id || ''

  const { data: requisitos = [] } = useQuery({
    queryKey: ['doc-requisitos'],
    queryFn: async (): Promise<RequisitoRow[]> => {
      const { data, error } = await supabase
        .from('documento_requisitos')
        .select('categoria, tipo, obrigatorio, ordem')
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as RequisitoRow[]
    },
  })

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['client-docs', activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<DocRowLite[]> => {
      // Garante placeholders pendentes (idempotente).
      await supabase.rpc('proposta_documentos_seed', { p_proposta_id: activeId })
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('proposta_id, categoria, tipo, storage_path, status, validado')
        .eq('proposta_id', activeId)
      if (error) throw error
      return (data ?? []) as DocRowLite[]
    },
  })

  const checklist = useMemo(() => buildChecklist(docs, requisitos), [docs, requisitos])

  const contagens = useMemo(() => ({
    Pendentes: checklist.filter((i) => i.status === 'pendente' || i.status === 'rejeitado').length,
    Enviados: checklist.filter((i) => i.status === 'enviado').length,
    Aprovados: checklist.filter((i) => i.status === 'aprovado').length,
  }), [checklist])

  const visiveis = useMemo(() => checklist.filter((i) => {
    if (aba === 'Pendentes') return i.status === 'pendente' || i.status === 'rejeitado'
    if (aba === 'Enviados') return i.status === 'enviado'
    return i.status === 'aprovado'
  }), [checklist, aba])

  const porCategoria = useMemo(() => {
    const map = new Map<DocCategoria, ChecklistItem[]>()
    for (const item of visiveis) {
      const list = map.get(item.categoria) ?? (map.set(item.categoria, []), map.get(item.categoria)!)
      list.push(item)
    }
    return CATEGORIA_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const)
  }, [visiveis])

  const propostaAtiva = propostas?.find((p) => p.id === activeId)

  const abas: Aba[] = ['Pendentes', 'Enviados', 'Aprovados']

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Documentos solicitados</h1>
          {propostaAtiva && (
            <p className="text-sm text-silver-600">Proposta <span className="font-mono">{propostaAtiva.protocolo ?? propostaAtiva.id.slice(0, 8)}</span></p>
          )}
        </div>
        {(propostas?.length ?? 0) > 1 && (
          <select
            className="input h-9 w-auto py-0 text-sm"
            value={activeId}
            onChange={(e) => setPropostaSel(e.target.value)}
          >
            {propostas!.map((p) => (
              <option key={p.id} value={p.id}>{p.protocolo ?? p.id.slice(0, 8)}</option>
            ))}
          </select>
        )}
      </div>

      {!activeId ? (
        <div className="card p-10 text-center text-sm text-silver-600">
          Nenhuma proposta encontrada. Se você recebeu um link de acesso do seu parceiro, abra-o para conectar à sua conta.
        </div>
      ) : (
        <>
          <div className="mb-6 inline-flex rounded-lg bg-silver-100 p-1">
            {abas.map((t) => (
              <button
                key={t}
                onClick={() => setAba(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${aba === t ? 'bg-white text-navy shadow-sm' : 'text-silver-600 hover:text-navy'}`}
              >
                {t} ({contagens[t]})
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="card flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-red-700" /></div>
          ) : porCategoria.length === 0 ? (
            <div className="card p-8 text-center text-sm text-silver-500">Nenhum documento nesta aba.</div>
          ) : (
            <div className="space-y-6">
              {porCategoria.map(([categoria, items]) => (
                <div key={categoria}>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-silver-500">{CATEGORIA_LABEL[categoria]}</h2>
                  <ul className="divide-y divide-silver-100 overflow-hidden rounded-lg border border-silver-200 bg-white">
                    {items.map((item) => (
                      <li key={`${item.categoria}-${item.tipo}`} className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-navy" />
                          <div>
                            <p className="font-medium text-navy">{TIPO_LABEL[item.tipo] ?? item.tipo}</p>
                            {item.obrigatorio && <span className="text-xs font-medium text-danger">Obrigatório</span>}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}>
                          {item.status === 'aprovado' ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === 'pendente' || item.status === 'rejeitado' ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {DOC_STATUS_LABEL[item.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Enviar documento</h2>
            <PropostaDocsUploader
              propostaId={activeId}
              origem="cliente"
              onChange={() => qc.invalidateQueries({ queryKey: ['client-docs', activeId] })}
            />
          </div>
        </>
      )}
    </>
  )
}
