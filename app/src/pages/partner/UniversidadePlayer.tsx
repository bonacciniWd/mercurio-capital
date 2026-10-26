import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, CheckCircle2, ArrowRight, Loader2, FileText, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import './universidade.css'

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

const EMPTY_ESTRUTURA: EstruturaRow[] = []

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

  const rows = estruturaQuery.data ?? EMPTY_ESTRUTURA
  const aulas: AulaFlat[] = useMemo(() =>
    rows.map((r, i) => ({ ...r, globalIndex: i })), [rows])

  const activeAula: AulaFlat | null = useMemo(() => {
    if (aulas.length === 0) return null
    if (aulaIdParam === 'primeira') return aulas[0]
    return aulas.find(a => a.aula_id === aulaIdParam) ?? aulas[0]
  }, [aulas, aulaIdParam])

  const activeVimeoId = useMemo(() => normalizeVimeoId(activeAula?.vimeo_id), [activeAula?.vimeo_id])
  const activeModuloId = activeAula?.modulo_id
  const activeAulaId = activeAula?.aula_id
  const activeAulaTipo = activeAula?.aula_tipo
  const activePosition = activeAula?.posicao_segundos

  const proxima: AulaFlat | null = useMemo(() => {
    if (!activeAula) return null
    return aulas[activeAula.globalIndex + 1] ?? null
  }, [aulas, activeAula])

  // Auto-expand active modulo
  useEffect(() => {
    if (activeModuloId) setOpenModulos(prev => new Set(prev).add(activeModuloId))
  }, [activeModuloId])

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
  const marcarAulaMutation = marcarAula.mutate

  useEffect(() => {
    if (!activeAulaId || activeAulaTipo !== 'video' || !activeVimeoId) return
    let cleanup = () => {}
    let cancelled = false
    void loadVimeoSDK().then((Vimeo) => {
      if (cancelled || !playerRef.current || !Vimeo) return
      // @ts-expect-error - dynamic Vimeo SDK
      const player = new Vimeo.Player(playerRef.current)
      // Restaura posição
      if (activePosition && activePosition > 5) {
        player.setCurrentTime(activePosition).catch(() => {})
      }
      const onTime = (data: { seconds: number }) => {
        const s = Math.floor(data.seconds)
        if (s - lastSavedRef.current >= 5) {
          lastSavedRef.current = s
          marcarAulaMutation({ aula_id: activeAulaId, posicao: s })
        }
      }
      const onEnded = () => {
        marcarAulaMutation({ aula_id: activeAulaId, concluida: true })
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
  }, [activeAulaId, activeAulaTipo, activePosition, activeVimeoId, marcarAulaMutation])

  // ---------- Curso aggregate ----------
  const curso = rows[0]
  const totalAulas = aulas.length
  const concluidas = aulas.filter(a => a.concluida).length
  const pct = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0

  // ---------- Recursos ----------
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfStoragePath = activeAula?.pdf_storage_path
  useEffect(() => {
    let cancelled = false
    setPdfUrl(null)
    if (pdfStoragePath) {
      supabase.storage.from('lms-recursos')
        .createSignedUrl(pdfStoragePath, 60 * 60)
        .then(({ data }) => { if (!cancelled) setPdfUrl(data?.signedUrl ?? null) })
    }
    return () => { cancelled = true }
  }, [pdfStoragePath])

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
    return (
      <div className="partner-university uni-empty-player" role="status">
        <Loader2 className="uni-spin" aria-hidden="true" /> Carregando aula…
      </div>
    )
  }
  if (estruturaQuery.isError) {
    return (
      <div className="partner-university uni-empty-player" role="alert">
        <FileText aria-hidden="true" />
        <strong>Não foi possível abrir este curso.</strong>
        <span>Tente novamente em instantes.</span>
        <button className="uni-button btn-no-liquid" type="button" onClick={() => void estruturaQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }
  if (!activeAula) {
    return (
      <div className="partner-university uni-empty-player">
        <BookOpen aria-hidden="true" />
        <strong>Este curso ainda não tem aulas disponíveis.</strong>
        <Link className="uni-button" to={basePath}>Voltar ao catálogo</Link>
      </div>
    )
  }

  const tabs = [
    { id: 'conteudo', label: 'Conteúdo' },
    { id: 'recursos', label: 'Recursos' },
    { id: 'notas', label: 'Notas' },
  ] as const

  return (
    <div className="partner-university university-player">
      <Link to={basePath} className="uni-back-link"><ArrowLeft aria-hidden="true" size={17} /> Voltar ao catálogo</Link>

      <div className="uni-player-layout">
        <section className="uni-lesson-main" aria-labelledby="uni-lesson-title">
          <div className="uni-lesson-heading">
            <div>
              <span className="uni-lesson-kicker">{curso?.curso_titulo ?? 'Universidade Mercúrio'}</span>
              <h1 id="uni-lesson-title">{activeAula.aula_titulo}</h1>
            </div>
            <span className="uni-lesson-index">
              Aula {activeAula.aula_ordem + 1} de {totalAulas}
              {activeAula.duracao_segundos ? ` · ${Math.round(activeAula.duracao_segundos / 60)} min` : ''}
            </span>
          </div>

          <div className="uni-media-stage">
            {activeAula.aula_tipo === 'video' && activeVimeoId ? (
              <iframe
                ref={playerRef}
                key={activeAula.aula_id}
                src={`https://player.vimeo.com/video/${activeVimeoId}?title=0&byline=0&portrait=0`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={activeAula.aula_titulo}
              />
            ) : (
              <div className="uni-media-empty">
                <span>{activeAula.aula_tipo === 'pdf' ? <FileText aria-hidden="true" size={25} /> : <Play aria-hidden="true" size={25} />}</span>
                <strong>{activeAula.aula_tipo === 'video' ? 'Vídeo não configurado para esta aula' : activeAula.aula_tipo === 'pdf' ? 'Material de apoio da aula' : 'Conteúdo da aula'}</strong>
                <small>{activeAula.aula_descricao || 'Consulte a descrição e os recursos desta aula nas abas abaixo.'}</small>
              </div>
            )}
          </div>

          <div className="uni-lesson-tabs" role="group" aria-label="Seções da aula">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                className={`uni-tab btn-no-liquid${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="uni-lesson-content">
            {tab === 'conteudo' && (
              <div>
                <h2>Sobre esta aula</h2>
                {activeAula.aula_descricao && <p>{activeAula.aula_descricao}</p>}
                {activeAula.conteudo_md && <div className="uni-markdown-content">{activeAula.conteudo_md}</div>}
                {!activeAula.aula_descricao && !activeAula.conteudo_md && <p>Sem descrição para esta aula.</p>}
              </div>
            )}
            {tab === 'recursos' && (
              <div>
                <h2>Materiais da aula</h2>
                {pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="uni-resource-link">
                    <span><FileText aria-hidden="true" size={18} /> Material da aula (PDF)</span>
                    <span>Abrir <ArrowRight aria-hidden="true" size={15} /></span>
                  </a>
                ) : (
                  <p>Nenhum recurso anexado a esta aula.</p>
                )}
              </div>
            )}
            {tab === 'notas' && (
              <div>
                <h2>Suas notas</h2>
                <label className="sr-only" htmlFor="uni-lesson-notes">Anotações desta aula</label>
                <textarea id="uni-lesson-notes" placeholder="Suas anotações ficam disponíveis apenas nesta sessão." />
              </div>
            )}
          </div>

          <div className="uni-lesson-actions">
            {activeAula.concluida ? (
              <div className="uni-complete-banner">
                <span><CheckCircle2 aria-hidden="true" size={17} /> Aula concluída{proxima ? ` · Próxima: ${proxima.aula_titulo}` : ''}</span>
                {proxima && (
                  <button className="uni-button btn-no-liquid" type="button" onClick={() => navigate(`${basePath}/${cursoId}/aula/${proxima.aula_id}`)}>
                    Continuar <ArrowRight aria-hidden="true" size={15} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  className="uni-button btn-no-liquid"
                  type="button"
                  onClick={() => marcarAula.mutate({ aula_id: activeAula.aula_id, concluida: true })}
                  disabled={marcarAula.isPending}
                >
                  {marcarAula.isPending ? <Loader2 className="uni-spin" aria-hidden="true" size={15} /> : <CheckCircle2 aria-hidden="true" size={16} />}
                  Marcar como concluída
                </button>
                {proxima && (
                  <button className="uni-button btn-no-liquid" type="button" onClick={() => navigate(`${basePath}/${cursoId}/aula/${proxima.aula_id}`)}>
                    Próxima <ArrowRight aria-hidden="true" size={15} />
                  </button>
                )}
              </>
            )}
            {marcarAula.isError && <p className="uni-inline-error" role="alert">Não foi possível salvar o progresso. Tente novamente.</p>}
          </div>
        </section>

        <aside className="uni-course-sidebar" aria-label="Conteúdo do curso">
          <div className="uni-sidebar-summary">
            <span className="uni-section-kicker">Seu progresso</span>
            <div className="uni-sidebar-progress-heading"><strong>{pct}%</strong><span>{concluidas} de {totalAulas} aulas</span></div>
            <div className="uni-progress-track" role="progressbar" aria-label="Progresso neste curso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="uni-curriculum-heading">
            <strong>Conteúdo do curso</strong>
            <span>{totalAulas} {totalAulas === 1 ? 'aula' : 'aulas'} · {formatDuration(aulas.reduce((sum, aula) => sum + (aula.duracao_segundos ?? 0), 0))}</span>
          </div>
          <div className="uni-module-list">
            {modulos.map((modulo) => (
              <details
                key={modulo.id}
                open={openModulos.has(modulo.id)}
                className="uni-module"
                onToggle={(event) => {
                  const next = new Set(openModulos)
                  if ((event.target as HTMLDetailsElement).open) next.add(modulo.id)
                  else next.delete(modulo.id)
                  setOpenModulos(next)
                }}
              >
                <summary>{modulo.titulo}</summary>
                <ul className="uni-lesson-list">
                  {modulo.aulas.map((aula) => {
                    const isActive = aula.aula_id === activeAula.aula_id
                    return (
                      <li key={aula.aula_id}>
                        <button
                          type="button"
                          aria-current={isActive ? 'step' : undefined}
                          onClick={() => navigate(`${basePath}/${cursoId}/aula/${aula.aula_id}`)}
                          className={`uni-lesson-item btn-no-liquid${isActive ? ' is-active' : ''}`}
                        >
                          {aula.concluida ? <CheckCircle2 aria-hidden="true" size={15} /> : isActive ? <Play aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
                          <span><strong>{aula.aula_titulo}</strong><small>{aula.concluida ? 'Concluída' : aula.aula_tipo}</small></span>
                          {aula.duracao_segundos ? <span className="uni-lesson-duration">{Math.round(aula.duracao_segundos / 60)} min</span> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </details>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function formatDuration(segundos: number): string {
  if (!segundos) return 'Duração não informada'
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`
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

