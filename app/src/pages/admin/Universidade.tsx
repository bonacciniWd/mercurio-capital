import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Video, FileText, ChevronRight, ChevronDown, Eye, Upload, Search, Loader2, X, GripVertical } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'

type CursoNivel = 'iniciante' | 'intermediario' | 'avancado'
type CursoPublico = 'cliente' | 'parceiro' | 'ambos'
type CursoStatus = 'rascunho' | 'publicado' | 'arquivado'
type AulaTipo = 'video' | 'pdf' | 'quiz' | 'texto'

interface Curso {
  id: string
  titulo: string
  slug: string | null
  descricao: string | null
  categoria: string | null
  nivel: CursoNivel
  publico: CursoPublico
  status: CursoStatus
  capa_storage_path: string | null
  ordem: number
  gratuito: boolean
  preco_centavos: number | null
}

interface Modulo {
  id: string
  curso_id: string
  titulo: string
  ordem: number
}

interface Aula {
  id: string
  modulo_id: string
  titulo: string
  descricao: string | null
  ordem: number
  tipo: AulaTipo
  vimeo_id: string | null
  pdf_storage_path: string | null
  conteudo_md: string | null
  duracao_segundos: number | null
  gratuita: boolean
}

interface VimeoUploadInitResponse {
  vimeo_id?: string
  uri?: string
  upload_link?: string
  warnings?: string[]
  error?: string
  detail?: string
  status?: number
}

const MAX_VIMEO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024

const STATUS_VAR: Record<CursoStatus, 'green' | 'amber' | 'gray'> = {
  publicado: 'green', rascunho: 'amber', arquivado: 'gray',
}
const STATUS_LBL: Record<CursoStatus, string> = {
  publicado: 'Publicado', rascunho: 'Rascunho', arquivado: 'Arquivado',
}

export function AdminUniversidade() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openModulos, setOpenModulos] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [editAula, setEditAula] = useState<Aula | null>(null)
  const [editModulo, setEditModulo] = useState<Modulo | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const [videoUploading, setVideoUploading] = useState(false)
  const [videoUploadInfo, setVideoUploadInfo] = useState<string | null>(null)

  // ---------- Queries ----------
  const cursosQuery = useQuery({
    queryKey: ['admin-cursos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cursos').select('*').order('ordem').order('created_at')
      if (error) throw error
      return (data ?? []) as Curso[]
    },
  })
  const cursos = cursosQuery.data ?? []
  const selected = selectedId ? cursos.find(c => c.id === selectedId) ?? null : (cursos[0] ?? null)
  const effectiveId = selected?.id ?? null

  const modulosQuery = useQuery({
    enabled: !!effectiveId,
    queryKey: ['admin-modulos', effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos').select('*').eq('curso_id', effectiveId!).order('ordem')
      if (error) throw error
      return (data ?? []) as Modulo[]
    },
  })
  const modulos = modulosQuery.data ?? []

  const aulasQuery = useQuery({
    enabled: modulos.length > 0,
    queryKey: ['admin-aulas', effectiveId, modulos.map(m => m.id).join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas').select('*').in('modulo_id', modulos.map(m => m.id)).order('ordem')
      if (error) throw error
      return (data ?? []) as Aula[]
    },
  })
  const aulas = aulasQuery.data ?? []

  // ---------- Mutations ----------
  const criarCurso = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('cursos').insert({
        titulo: 'Novo curso', nivel: 'iniciante', publico: 'ambos', status: 'rascunho',
      }).select().single()
      if (error) throw error
      return data as Curso
    },
    onSuccess: (c) => { setSelectedId(c.id); void qc.invalidateQueries({ queryKey: ['admin-cursos'] }) },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const salvarCurso = useMutation({
    mutationFn: async (patch: Partial<Curso>) => {
      if (!selected) return
      const { error } = await supabase.from('cursos').update(patch).eq('id', selected.id)
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-cursos'] }) },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const publicar = useMutation({
    mutationFn: async (status: CursoStatus) => {
      if (!selected) return
      const { error } = await supabase.rpc('admin_curso_publicar', {
        p_curso_id: selected.id, p_status: status,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-cursos'] }); setErro(null) },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const criarModulo = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const { error } = await supabase.from('modulos').insert({
        curso_id: selected.id, titulo: 'Novo módulo', ordem: modulos.length,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-modulos', effectiveId] }) },
  })

  const salvarModulo = useMutation({
    mutationFn: async (m: Modulo) => {
      const { error } = await supabase.from('modulos')
        .update({ titulo: m.titulo, ordem: m.ordem }).eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => { setEditModulo(null); void qc.invalidateQueries({ queryKey: ['admin-modulos', effectiveId] }) },
  })

  const excluirModulo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('modulos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-modulos', effectiveId] })
      void qc.invalidateQueries({ queryKey: ['admin-aulas', effectiveId] })
    },
  })

  const salvarAula = useMutation({
    mutationFn: async (a: Aula) => {
      const payload = {
        modulo_id: a.modulo_id, titulo: a.titulo, descricao: a.descricao,
        ordem: a.ordem, tipo: a.tipo, vimeo_id: a.vimeo_id || null,
        pdf_storage_path: a.pdf_storage_path || null, conteudo_md: a.conteudo_md || null,
        duracao_segundos: a.duracao_segundos, gratuita: a.gratuita,
      }
      if (a.id.startsWith('new-')) {
        const { error } = await supabase.from('aulas').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('aulas').update(payload).eq('id', a.id)
        if (error) throw error
      }
    },
    onSuccess: () => { setEditAula(null); void qc.invalidateQueries({ queryKey: ['admin-aulas', effectiveId] }) },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const excluirAula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('aulas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-aulas', effectiveId] }) },
  })

  const uploadCapa = useMutation({
    mutationFn: async (file: File) => {
      if (!selected) return
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${selected.id}/capa.${ext}`
      const { error: upErr } = await supabase.storage.from('lms-capas').upload(path, file, {
        upsert: true, contentType: file.type,
      })
      if (upErr) throw upErr
      await supabase.from('cursos').update({ capa_storage_path: path }).eq('id', selected.id)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-cursos'] }) },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  useEffect(() => {
    setVideoFile(null)
    setVideoUploadProgress(0)
    setVideoUploading(false)
    setVideoUploadInfo(null)
  }, [editAula?.id, editAula?.tipo])

  async function uploadVideoParaVimeo() {
    if (!selected || !editAula || !videoFile) return

    if (!videoFile.type.startsWith('video/')) {
      setErro('Arquivo invalido. Selecione um arquivo de video (MP4, MOV ou WEBM).')
      return
    }
    if (videoFile.size <= 0 || videoFile.size > MAX_VIMEO_UPLOAD_BYTES) {
      setErro(`Tamanho invalido. Limite atual: ${formatBytes(MAX_VIMEO_UPLOAD_BYTES)}.`)
      return
    }

    setErro(null)
    setVideoUploading(true)
    setVideoUploadProgress(0)
    setVideoUploadInfo('Preparando upload no Vimeo...')

    try {
      const { data, error } = await supabase.functions.invoke('vimeo-upload-init', {
        body: {
          filename: videoFile.name,
          size: videoFile.size,
          content_type: videoFile.type,
          aula_titulo: editAula.titulo || null,
          curso_id: selected.id,
          modulo_id: editAula.modulo_id,
          aula_id: editAula.id.startsWith('new-') ? null : editAula.id,
        },
      })
      if (error) throw await buildVimeoInitError(error, data)

      const payload = (data ?? {}) as VimeoUploadInitResponse
      if (payload.error) throw await buildVimeoInitError(error, payload)
      const uploadLink = payload.upload_link
      const vimeoId = normalizeVimeoId(payload.vimeo_id ?? payload.uri ?? null)
      if (!uploadLink || !vimeoId) {
        throw new Error('Resposta invalida da edge Vimeo: upload_link ou vimeo_id ausente.')
      }

      setVideoUploadInfo('Enviando arquivo para o Vimeo...')
      await uploadFileToTus(uploadLink, videoFile, (pct) => setVideoUploadProgress(pct))

      setEditAula((prev) => (prev ? { ...prev, vimeo_id: vimeoId } : prev))
      setVideoFile(null)
      setVideoUploadProgress(100)

      const warnings = payload.warnings?.length ? ` Avisos: ${payload.warnings.join(' | ')}` : ''
      setVideoUploadInfo(`Upload concluido. Vimeo ID preenchido automaticamente (${vimeoId}).${warnings}`)
    } catch (e) {
      setErro(String(e instanceof Error ? e.message : e))
      setVideoUploadInfo(null)
    } finally {
      setVideoUploading(false)
    }
  }

  // ---------- Helpers ----------
  const toggleModulo = (id: string) => {
    const next = new Set(openModulos)
    if (next.has(id)) next.delete(id); else next.add(id)
    setOpenModulos(next)
  }

  const aulasDoModulo = (mid: string) => aulas.filter(a => a.modulo_id === mid)
  const filtrados = cursos.filter(c =>
    !busca || c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    (c.categoria ?? '').toLowerCase().includes(busca.toLowerCase()))

  function capaUrl(p: string | null): string | null {
    if (!p) return null
    const { data } = supabase.storage.from('lms-capas').getPublicUrl(p)
    return data.publicUrl
  }

  // ---------- Render ----------
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Universidade Mercurio</h1>
          <p className="text-sm text-silver-600">Gerencie cursos, módulos e episódios.</p>
        </div>
        <button className="btn-gold" disabled={criarCurso.isPending} onClick={() => criarCurso.mutate()}>
          {criarCurso.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Novo curso
        </button>
      </div>

      {erro && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-3">
          <div className="card flex items-center gap-2 p-3">
            <Search className="h-4 w-4 text-silver-400" />
            <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Buscar curso..."
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {cursosQuery.isLoading && (
            <div className="card p-4 text-sm text-silver-500">
              <Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}
          {filtrados.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`btn-no-liquid !block w-full min-h-[110px] rounded-lg border border-silver-200 bg-white p-4 text-left text-silver-900 shadow-none transition-all ${selected?.id === c.id ? 'border-l-4 border-gold bg-gradient-to-r from-gold/10 to-white shadow-sm' : 'hover:bg-silver-50'}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <h3 className="min-w-0 break-words text-base font-semibold leading-tight text-silver-900">{c.titulo}</h3>
                <Badge variant={STATUS_VAR[c.status]}>{STATUS_LBL[c.status]}</Badge>
              </div>
              <div className="mt-2 text-xs text-silver-700">
                {c.categoria ?? 'sem categoria'} · {c.nivel} · {c.publico}
              </div>
              <div className="mt-2 text-xs text-silver-500">
                {c.gratuito ? 'Gratuito' : 'Por assinatura'}
              </div>
            </button>
          ))}
          {filtrados.length === 0 && !cursosQuery.isLoading && (
            <div className="card p-4 text-center text-sm text-silver-500">Nenhum curso ainda.</div>
          )}
        </aside>

        <section className="card p-6">
          {!selected ? (
            <p className="text-center text-silver-500">Selecione ou crie um curso à esquerda</p>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <input
                    className="w-full text-xl font-bold text-navy bg-transparent outline-none border-b border-transparent hover:border-silver-200 focus:border-gold py-1"
                    defaultValue={selected.titulo}
                    onBlur={(e) => e.target.value !== selected.titulo && salvarCurso.mutate({ titulo: e.target.value })}
                  />
                  <textarea
                    className="mt-2 w-full text-sm text-silver-600 bg-transparent outline-none resize-none"
                    rows={2} placeholder="Descrição..."
                    defaultValue={selected.descricao ?? ''}
                    onBlur={(e) => e.target.value !== (selected.descricao ?? '') && salvarCurso.mutate({ descricao: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  {selected.status === 'publicado'
                    ? <button className="btn-outline" onClick={() => publicar.mutate('rascunho')}>Despublicar</button>
                    : <button className="btn-gold" onClick={() => publicar.mutate('publicado')}>
                        <Eye className="h-4 w-4" /> Publicar
                      </button>}
                </div>
              </div>

              <div className="mb-6 grid gap-4 rounded-lg bg-silver-50 p-4 md:grid-cols-4">
                <div>
                  <label className="label">Categoria</label>
                  <input className="input" defaultValue={selected.categoria ?? ''} placeholder="Crédito / Vendas..."
                    onBlur={(e) => e.target.value !== (selected.categoria ?? '') && salvarCurso.mutate({ categoria: e.target.value })} />
                </div>
                <div>
                  <label className="label">Nível</label>
                  <select className="input" value={selected.nivel}
                    onChange={(e) => salvarCurso.mutate({ nivel: e.target.value as CursoNivel })}>
                    <option value="iniciante">Iniciante</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="avancado">Avançado</option>
                  </select>
                </div>
                <div>
                  <label className="label">Público</label>
                  <select className="input" value={selected.publico}
                    onChange={(e) => salvarCurso.mutate({ publico: e.target.value as CursoPublico })}>
                    <option value="cliente">Cliente</option>
                    <option value="parceiro">Parceiro</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="label">Acesso</label>
                  <select className="input" value={selected.gratuito ? 'gratuito' : 'assinatura'}
                    onChange={(e) => salvarCurso.mutate({ gratuito: e.target.value === 'gratuito' })}>
                    <option value="gratuito">Gratuito</option>
                    <option value="assinatura">Por assinatura</option>
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="label">Capa do curso</label>
                  <label className="block rounded-lg border-2 border-dashed border-silver-300 p-4 text-center text-xs text-silver-500 hover:border-gold cursor-pointer">
                    {capaUrl(selected.capa_storage_path) ? (
                      <img src={capaUrl(selected.capa_storage_path)!} alt="Capa" className="mx-auto max-h-32 rounded" />
                    ) : (
                      <><Upload className="mx-auto mb-1 h-6 w-6" /> Enviar imagem (1280×720)</>
                    )}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCapa.mutate(f) }} />
                  </label>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-navy">Módulos & episódios</h2>
                <button className="btn-outline text-sm" onClick={() => criarModulo.mutate()}>
                  <Plus className="h-4 w-4" /> Novo módulo
                </button>
              </div>

              <div className="space-y-2">
                {modulos.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-silver-300 p-8 text-center text-sm text-silver-500">
                    Nenhum módulo ainda. Adicione o primeiro para começar.
                  </div>
                )}
                {modulos.map((m, idx) => {
                  const open = openModulos.has(m.id)
                  const aulasM = aulasDoModulo(m.id)
                  return (
                    <div key={m.id} className="rounded-lg border border-silver-200 bg-white">
                      <div className="flex w-full items-center gap-3 p-3 text-left hover:bg-silver-50">
                        <button onClick={() => toggleModulo(m.id)} className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-silver-400" />
                          {open ? <ChevronDown className="h-4 w-4 text-silver-500" /> : <ChevronRight className="h-4 w-4 text-silver-500" />}
                        </button>
                        <span className="text-xs font-mono text-silver-400">M{idx + 1}</span>
                        {editModulo?.id === m.id ? (
                          <input autoFocus className="input flex-1 py-1" value={editModulo.titulo}
                            onChange={(e) => setEditModulo({ ...editModulo, titulo: e.target.value })}
                            onBlur={() => salvarModulo.mutate(editModulo)}
                            onKeyDown={(e) => e.key === 'Enter' && salvarModulo.mutate(editModulo)} />
                        ) : (
                          <span className="flex-1 font-semibold text-silver-900">{m.titulo}</span>
                        )}
                        <span className="text-xs text-silver-500">{aulasM.length} aulas</span>
                        <button className="rounded-md p-1.5 hover:bg-silver-100" onClick={() => setEditModulo(m)}>
                          <Edit2 className="h-3.5 w-3.5 text-silver-500" />
                        </button>
                        <button className="rounded-md p-1.5 hover:bg-red-100"
                          onClick={() => confirm('Remover módulo e todas as aulas?') && excluirModulo.mutate(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </button>
                      </div>
                      {open && (
                        <div className="border-t border-silver-100 bg-silver-50/50 p-3">
                          <div className="space-y-1.5">
                            {aulasM.map((a, i) => (
                              <div key={a.id} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm border border-silver-100">
                                <span className="font-mono text-xs text-silver-400 w-10">{idx + 1}.{i + 1}</span>
                                {a.tipo === 'video' && <Video className="h-4 w-4 text-blue-600" />}
                                {a.tipo === 'pdf' && <FileText className="h-4 w-4 text-red-600" />}
                                {a.tipo === 'quiz' && <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-gold text-[10px] font-bold text-white">Q</span>}
                                {a.tipo === 'texto' && <FileText className="h-4 w-4 text-silver-500" />}
                                <span className="flex-1 text-silver-800">{a.titulo || '(sem título)'}</span>
                                {a.vimeo_id && <code className="text-xs text-silver-500">vimeo:{a.vimeo_id}</code>}
                                {a.gratuita && <Badge variant="green">Preview</Badge>}
                                <span className="text-xs text-silver-500 w-14 text-right">
                                  {a.duracao_segundos ? formatDur(a.duracao_segundos) : '—'}
                                </span>
                                <button className="rounded-md p-1 hover:bg-silver-100" onClick={() => setEditAula(a)}>
                                  <Edit2 className="h-3.5 w-3.5 text-silver-500" />
                                </button>
                                <button className="rounded-md p-1 hover:bg-red-100"
                                  onClick={() => confirm('Remover aula?') && excluirAula.mutate(a.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                </button>
                              </div>
                            ))}
                            <button
                              className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-silver-300 py-2 text-xs font-medium text-silver-600 hover:border-gold hover:text-gold-700"
                              onClick={() => setEditAula({
                                id: `new-${crypto.randomUUID()}`, modulo_id: m.id, titulo: '',
                                descricao: '', ordem: aulasM.length, tipo: 'video',
                                vimeo_id: '', pdf_storage_path: '', conteudo_md: '',
                                duracao_segundos: null, gratuita: false,
                              })}>
                              <Plus className="h-3.5 w-3.5" /> Adicionar episódio
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {editAula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditAula(null)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">{editAula.id.startsWith('new-') ? 'Nova aula' : 'Editar aula'}</h3>
              <button onClick={() => setEditAula(null)}><X className="h-5 w-5 text-silver-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Título</label>
                <input className="input" value={editAula.titulo}
                  onChange={(e) => setEditAula({ ...editAula, titulo: e.target.value })} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={editAula.tipo}
                  onChange={(e) => setEditAula({ ...editAula, tipo: e.target.value as AulaTipo })}>
                  <option value="video">Vídeo (Vimeo)</option>
                  <option value="pdf">PDF</option>
                  <option value="texto">Texto / Markdown</option>
                  <option value="quiz">Quiz</option>
                </select>
              </div>
              {editAula.tipo === 'video' && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Upload de video no Vimeo</label>
                    <label className="block cursor-pointer rounded-lg border-2 border-dashed border-silver-300 p-3 text-center text-xs text-silver-600 hover:border-gold disabled:opacity-50">
                      <Upload className="mx-auto mb-1 h-5 w-5" />
                      {videoFile
                        ? `${videoFile.name} (${formatBytes(videoFile.size)})`
                        : 'Selecionar arquivo de video (MP4, MOV ou WEBM)'}
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                        className="hidden"
                        disabled={videoUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          setVideoFile(f)
                          setVideoUploadProgress(0)
                          setVideoUploadInfo(null)
                        }}
                      />
                    </label>
                    <p className="mt-1 text-xs text-silver-500">
                      O upload e iniciado no painel e enviado direto para o Vimeo via TUS, sem expor token no client.
                    </p>
                  </div>

                  {videoFile && (
                    <div className="rounded-md border border-silver-200 bg-silver-50 p-3">
                      <p className="text-xs text-silver-600">Arquivo pronto: {videoFile.name}</p>
                      <button
                        type="button"
                        className="btn-no-liquid mt-2 inline-flex items-center gap-2 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-700 disabled:opacity-60"
                        onClick={() => void uploadVideoParaVimeo()}
                        disabled={videoUploading}
                      >
                        {videoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {videoUploading ? 'Enviando...' : 'Enviar para Vimeo'}
                      </button>
                    </div>
                  )}

                  {videoUploading && (
                    <div className="rounded-md border border-gold/30 bg-gold/5 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-silver-700">
                        <span>Progresso do upload</span>
                        <span>{videoUploadProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-silver-200">
                        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${videoUploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {videoUploadInfo && (
                    <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{videoUploadInfo}</p>
                  )}

                  <div>
                    <label className="label">ID do video no Vimeo</label>
                    <input
                      className="input"
                      placeholder="ex: 824612345"
                      value={editAula.vimeo_id ?? ''}
                      onChange={(e) => setEditAula({ ...editAula, vimeo_id: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-silver-500">
                      Campo preenchido automaticamente apos upload. Edicao manual continua disponivel para ajustes.
                    </p>
                  </div>
                </div>
              )}
              {editAula.tipo === 'pdf' && (
                <div>
                  <label className="label">PDF (upload)</label>
                  <input type="file" accept="application/pdf" className="input"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f || !selected) return
                      const path = `${selected.id}/${editAula.modulo_id}/${crypto.randomUUID()}.pdf`
                      const { error } = await supabase.storage.from('lms-recursos').upload(path, f, {
                        upsert: true, contentType: 'application/pdf',
                      })
                      if (error) { setErro(error.message); return }
                      setEditAula({ ...editAula, pdf_storage_path: path })
                    }} />
                  {editAula.pdf_storage_path && <p className="mt-1 text-xs text-silver-500 truncate">{editAula.pdf_storage_path}</p>}
                </div>
              )}
              {(editAula.tipo === 'texto' || editAula.tipo === 'quiz') && (
                <div>
                  <label className="label">Conteúdo (Markdown)</label>
                  <textarea className="input min-h-[140px]" value={editAula.conteudo_md ?? ''}
                    onChange={(e) => setEditAula({ ...editAula, conteudo_md: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Duração (segundos)</label>
                  <input type="number" className="input" value={editAula.duracao_segundos ?? ''}
                    onChange={(e) => setEditAula({ ...editAula, duracao_segundos: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editAula.gratuita}
                      onChange={(e) => setEditAula({ ...editAula, gratuita: e.target.checked })} />
                    Preview gratuito
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setEditAula(null)}>Cancelar</button>
              <button className="btn-gold" disabled={salvarAula.isPending || videoUploading}
                onClick={() => editAula && salvarAula.mutate(editAula)}>
                {salvarAula.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatDur(s: number): string {
  const m = Math.floor(s / 60), r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(value >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

async function readFunctionError(error: unknown): Promise<VimeoUploadInitResponse | null> {
  try {
    const context = error && typeof error === 'object' && 'context' in error
      ? (error as { context?: Response }).context
      : null
    if (context && typeof context.json === 'function') {
      return await context.json() as VimeoUploadInitResponse
    }
  } catch {
    return null
  }
  return null
}

async function buildVimeoInitError(error: unknown, data: unknown): Promise<Error> {
  const payload = ((data ?? await readFunctionError(error)) ?? {}) as VimeoUploadInitResponse
  const status = payload.status ? `status ${payload.status}` : 'status desconhecido'
  const detail = payload.detail || payload.error || (error instanceof Error ? error.message : String(error))

  if (payload.error === 'vimeo_create_fail') {
    return new Error(`Vimeo recusou criação do upload (${status}): ${detail}`)
  }

  if (payload.error === 'vimeo_payload_invalido') {
    return new Error(`Vimeo respondeu sem upload_link ou vimeo_id (${status}): ${detail}`)
  }

  return new Error(detail || 'Falha ao iniciar upload no Vimeo.')
}

function normalizeVimeoId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = String(raw).trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return v
  const uriMatch = v.match(/\/videos\/(\d+)/)
  if (uriMatch) return uriMatch[1]
  const urlMatch = v.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (urlMatch) return urlMatch[1]
  return null
}

async function readTusOffset(uploadLink: string): Promise<number> {
  try {
    const res = await fetch(uploadLink, {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0' },
    })
    if (!res.ok) return 0
    const h = res.headers.get('Upload-Offset') ?? res.headers.get('upload-offset')
    const offset = Number(h ?? 0)
    return Number.isFinite(offset) && offset > 0 ? offset : 0
  } catch {
    return 0
  }
}

async function uploadFileToTus(uploadLink: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  const startOffset = await readTusOffset(uploadLink)
  const blob = startOffset > 0 ? file.slice(startOffset) : file

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PATCH', uploadLink)
    xhr.setRequestHeader('Tus-Resumable', '1.0.0')
    xhr.setRequestHeader('Upload-Offset', String(startOffset))
    xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream')

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      const sent = startOffset + e.loaded
      const pct = Math.min(100, Math.round((sent / file.size) * 100))
      onProgress(pct)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`Falha no upload Vimeo (status ${xhr.status}).`))
      }
    }
    xhr.onerror = () => reject(new Error('Falha de rede no upload para Vimeo.'))
    xhr.onabort = () => reject(new Error('Upload cancelado.'))

    xhr.send(blob)
  })
}

