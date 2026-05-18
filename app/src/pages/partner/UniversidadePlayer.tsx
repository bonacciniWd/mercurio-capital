import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, CheckCircle2, ArrowRight, Loader2, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type AulaTipo = 'video' | 'pdf' | 'quiz' | 'texto'

interface EstruturaRow {
  curso_id: string
  curso_titulo: string
  gratuito: boolean
  modulo_id: string
  modulo_titulo: string
  modulo_ordem: number
  aula_id: string
  aula_titulo: string
  aula_descricao: string | null
  aula_tipo: AulaTipo
  vimeo_id: string | null
  pdf_storage_path: string | null
  conteudo_md: string | null
  duracao_segundos: number | null
  gratuita: boolean
  aula_ordem: number
  posicao_segundos: number | null
  concluida: boolean | null
  concluida_em: string | null
}

interface AulaFlat extends EstruturaRow {
  globalIndex: number
}

// Carrega o Vimeo Player SDK via CDN apenas uma vez
let vimeoLoader: Promise<unknown> | null = null
function loadVimeoSDK(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  // @ts-expect-error global
  if (window.Vimeo) return Promise.resolve(window.Vimeo)
  if (vimeoLoader) return vimeoLoader
  vimeoLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://player.vimeo.com/api/player.js'
    s.async = true
    s.onload = () => {
      // @ts-expect-error global
      resolve(window.Vimeo)
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
  return vimeoLoader
}

export function UniversidadePlayer() {
  const params = useParams<{ cursoId: string; aulaId: string }>()
  const cursoId = params.cursoId!
  const aulaIdParam = params.aulaId!
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const basePath = location.pathname.startsWith('/c/') ? '/c/universidade' : '/p/universidade'
  const [tab, setTab] = useState<'conteudo' | 'recursos' | 'notas'>('conteudo')
  const [openModulos, setOpenModulos] = useState<Set<string>>(new Set())

  const estruturaQuery = useQuery({
    queryKey: ['lms-curso-estrutura', cursoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_curso_estrutura')
        .select('*')
        .eq('curso_id', cursoId)
        .order('modulo_ordem')
        .order('aula_ordem')
      if (error) throw error
      return (data ?? []) as EstruturaRow[]
    },
  })

  const rows = estruturaQuery.data ?? []
  const aulas: AulaFlat[] = useMemo(() =>
    rows.map((r, i) => ({ ...r, globalIndex: i })), [rows])

  const activeAula: AulaFlat | null = useMemo(() => {
    if (aulas.length === 0) return null
    if (aulaIdParam === 'primeira') return aulas[0]
    return aulas.find(a => a.aula_id === aulaIdParam) ?? aulas[0]
  }, [aulas, aulaIdParam])

  const proxima: AulaFlat | null = useMemo(() => {
    if (!activeAula) return null
    return aulas[activeAula.globalIndex + 1] ?? null
  }, [aulas, activeAula])

  // Auto-expand active modulo
  useEffect(() => {
    if (activeAula) setOpenModulos(prev => new Set(prev).add(activeAula.modulo_id))
  }, [activeAula?.modulo_id])

  // ---------- mutation: marcar aula ----------
  const marcarAula = useMutation({
    mutationFn: async (args: { aula_id: string; posicao?: number; concluida?: boolean }) => {
      const { error } = await supabase.rpc('lms_marcar_aula', {
        p_aula_id: args.aula_id,
        p_posicao_segundos: args.posicao ?? null,
        p_concluida: args.concluida ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lms-curso-estrutura', cursoId] })
      void qc.invalidateQueries({ queryKey: ['lms-catalogo-partner'] })
      void qc.invalidateQueries({ queryKey: ['lms-meus-certificados'] })
    },
  })

  // ---------- Vimeo tracking ----------
  const playerRef = useRef<HTMLIFrameElement | null>(null)
  const lastSavedRef = useRef<number>(0)

  useEffect(() => {
    if (!activeAula || activeAula.aula_tipo !== 'video' || !activeAula.vimeo_id) return
    let cleanup = () => {}
    let cancelled = false
    void loadVimeoSDK().then((Vimeo) => {
      if (cancelled || !playerRef.current || !Vimeo) return
      // @ts-expect-error - dynamic Vimeo SDK
      const player = new Vimeo.Player(playerRef.current)
      // Restaura posição
      if (activeAula.posicao_segundos && activeAula.posicao_segundos > 5) {
        player.setCurrentTime(activeAula.posicao_segundos).catch(() => {})
      }
      const onTime = (data: { seconds: number }) => {
        const s = Math.floor(data.seconds)
        if (s - lastSavedRef.current >= 5) {
          lastSavedRef.current = s
          marcarAula.mutate({ aula_id: activeAula.aula_id, posicao: s })
        }
      }
      const onEnded = () => {
        marcarAula.mutate({ aula_id: activeAula.aula_id, concluida: true })
      }
      player.on('timeupdate', onTime)
      player.on('ended', onEnded)
      cleanup = () => {
        player.off('timeupdate', onTime)
        player.off('ended', onEnded)
      }
    }).catch(() => { /* ignore */ })
    lastSavedRef.current = 0
    return () => { cancelled = true; cleanup() }
  }, [activeAula?.aula_id, activeAula?.vimeo_id])

  // ---------- Curso aggregate ----------
  const curso = rows[0]
  const totalAulas = aulas.length
  const concluidas = aulas.filter(a => a.concluida).length
  const pct = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0

  // ---------- Recursos ----------
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  useEffect(() => {
    setPdfUrl(null)
    if (activeAula?.pdf_storage_path) {
      supabase.storage.from('lms-recursos')
        .createSignedUrl(activeAula.pdf_storage_path, 60 * 60)
        .then(({ data }) => setPdfUrl(data?.signedUrl ?? null))
    }
  }, [activeAula?.pdf_storage_path])

  // ---------- Modulos agrupados ----------
  const modulos = useMemo(() => {
    const map = new Map<string, { id: string; titulo: string; aulas: AulaFlat[] }>()
    for (const a of aulas) {
      if (!map.has(a.modulo_id)) map.set(a.modulo_id, { id: a.modulo_id, titulo: a.modulo_titulo, aulas: [] })
      map.get(a.modulo_id)!.aulas.push(a)
    }
    return [...map.values()]
  }, [aulas])

  if (estruturaQuery.isLoading) {
    return <div className="card p-10 text-center text-silver-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /> Carregando…</div>
  }
  if (!activeAula) {
    return (
      <div className="card p-10 text-center text-silver-500">
        Curso sem aulas disponíveis.
        <div className="mt-4"><Link to={basePath} className="btn-outline">Voltar</Link></div>
      </div>
    )
  }

  return (
    <>
      <Link to={basePath} className="mb-4 inline-flex items-center gap-1 text-sm text-silver-600 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            {activeAula.aula_tipo === 'video' && activeAula.vimeo_id ? (
              <iframe
                ref={playerRef}
                key={activeAula.aula_id}
                src={`https://player.vimeo.com/video/${activeAula.vimeo_id}?title=0&byline=0&portrait=0`}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={activeAula.aula_titulo}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-navy to-black text-white">
                <Play className="h-16 w-16 opacity-70" />
              </div>
            )}
          </div>

          <h1 className="mt-5 text-xl font-bold text-navy">{activeAula.aula_titulo}</h1>
          <p className="text-sm text-silver-500">
            {activeAula.modulo_titulo} · Aula {activeAula.aula_ordem + 1}
            {activeAula.duracao_segundos ? ` · ${Math.round(activeAula.duracao_segundos / 60)}min` : ''}
          </p>

          <div className="mt-5 flex gap-1 border-b border-silver-200">
            {([
              { id: 'conteudo', label: 'Conteúdo' },
              { id: 'recursos', label: 'Recursos' },
              { id: 'notas', label: 'Notas' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.id ? 'border-gold text-navy' : 'border-transparent text-silver-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm text-silver-700">
            {tab === 'conteudo' && (
              <div className="prose-sm max-w-none">
                {activeAula.aula_descricao && <p>{activeAula.aula_descricao}</p>}
                {activeAula.conteudo_md && <pre className="whitespace-pre-wrap font-sans">{activeAula.conteudo_md}</pre>}
                {!activeAula.aula_descricao && !activeAula.conteudo_md && (
                  <p className="text-silver-500">Sem descrição para esta aula.</p>
                )}
              </div>
            )}
            {tab === 'recursos' && (
              <div>
                {pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between rounded-md bg-silver-50 p-3 hover:bg-silver-100">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Material da aula (PDF)</span>
                    <span className="text-gold-700 hover:underline">Abrir</span>
                  </a>
                ) : (
                  <p className="text-silver-500">Nenhum recurso anexado a esta aula.</p>
                )}
              </div>
            )}
            {tab === 'notas' && (
              <textarea className="input min-h-[160px] w-full" placeholder="Suas anotações (não persistidas)..." />
            )}
          </div>
        </div>

        <aside className="card h-fit overflow-hidden">
          <div className="border-b border-silver-200 p-4">
            <p className="text-xs uppercase tracking-wide text-silver-500">Curso</p>
            <h3 className="font-semibold text-navy">{curso?.curso_titulo}</h3>
            <div className="mt-2 h-1 rounded-full bg-silver-200">
              <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-silver-500">{concluidas} / {totalAulas} aulas · {pct}%</p>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {modulos.map((m) => {
              const open = openModulos.has(m.id)
              return (
                <details key={m.id} open={open} className="border-b border-silver-100"
                  onToggle={(e) => {
                    const next = new Set(openModulos)
                    if ((e.target as HTMLDetailsElement).open) next.add(m.id); else next.delete(m.id)
                    setOpenModulos(next)
                  }}>
                  <summary className="cursor-pointer bg-silver-50 px-4 py-2.5 text-sm font-semibold text-silver-800">{m.titulo}</summary>
                  <ul>
                    {m.aulas.map((a) => {
                      const isActive = a.aula_id === activeAula.aula_id
                      const done = !!a.concluida
                      return (
                        <li key={a.aula_id}>
                          <button onClick={() => navigate(`${basePath}/${cursoId}/aula/${a.aula_id}`)}
                            className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${isActive ? 'bg-gold/10 text-navy font-medium border-l-2 border-gold' : 'text-silver-700 hover:bg-silver-50'}`}>
                            {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                              isActive ? <Play className="h-4 w-4 text-gold" /> :
                              <Play className="h-4 w-4 text-silver-300" />}
                            <span className="flex-1 truncate">{a.aula_titulo}</span>
                            <span className="text-xs text-silver-400 whitespace-nowrap">
                              {a.duracao_segundos ? `${Math.round(a.duracao_segundos / 60)}min` : ''}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )
            })}
          </div>
        </aside>
      </div>

      {activeAula.concluida && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <span className="font-medium text-green-700">✓ Aula concluída{proxima ? ` — Próxima: ${proxima.aula_titulo}` : ''}</span>
          {proxima && (
            <button className="btn-gold"
              onClick={() => navigate(`${basePath}/${cursoId}/aula/${proxima.aula_id}`)}>
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {!activeAula.concluida && (
        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="btn-outline"
            onClick={() => marcarAula.mutate({ aula_id: activeAula.aula_id, concluida: true })}
            disabled={marcarAula.isPending}>
            {marcarAula.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Marcar como concluída
          </button>
          {proxima && (
            <button className="btn-gold"
              onClick={() => navigate(`${basePath}/${cursoId}/aula/${proxima.aula_id}`)}>
              Próxima <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </>
  )
}

