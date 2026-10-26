import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  GraduationCap,
  Loader2,
  Play,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import './universidade.css'

type Tab = 'todos' | 'andamento' | 'concluidos' | 'certificados'

interface CatalogoItem {
  id: string
  titulo: string
  descricao: string | null
  categoria: string | null
  nivel: string
  publico: string
  capa_storage_path: string | null
  gratuito: boolean
  qtd_modulos: number
  qtd_aulas: number
  duracao_total_segundos: number
  inscricao_id: string | null
  percentual_concluido: number
  iniciado_em: string | null
  concluido_em: string | null
  certificado_id: string | null
  certificado_codigo: string | null
}

interface Certificado {
  id: string
  codigo: string
  emitido_em: string
  pdf_storage_path: string | null
  curso: { titulo: string } | null
}

const EMPTY_CATALOGO: CatalogoItem[] = []

const tabs: { id: Tab; label: string }[] = [
  { id: 'todos', label: 'Todos os cursos' },
  { id: 'andamento', label: 'Em andamento' },
  { id: 'concluidos', label: 'Concluídos' },
  { id: 'certificados', label: 'Certificados' },
]

export function UniversidadeLista() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('todos')
  const [catFiltro, setCatFiltro] = useState('')
  const [busca, setBusca] = useState('')

  const catalogoQuery = useQuery({
    queryKey: ['lms-catalogo-partner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_catalogo')
        .select('*')
        .in('publico', ['parceiro', 'ambos'])
        .order('ordem')
      if (error) throw error
      return (data ?? []) as CatalogoItem[]
    },
  })

  const certificadosQuery = useQuery({
    queryKey: ['lms-meus-certificados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certificados')
        .select('id, codigo, emitido_em, pdf_storage_path, curso:cursos(titulo)')
        .order('emitido_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Certificado[]
    },
  })

  const inscrever = useMutation({
    mutationFn: async (cursoId: string) => {
      const { error } = await supabase.rpc('lms_inscrever', { p_curso_id: cursoId })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lms-catalogo-partner'] })
    },
  })

  const baixarCert = useMutation({
    mutationFn: async (cert: Certificado) => {
      let path = cert.pdf_storage_path
      if (!path) {
        const { data, error } = await supabase.functions.invoke('certificado-gerar', {
          body: { certificado_id: cert.id },
        })

        if (error) {
          let message = error.message || 'Falha ao gerar certificado.'
          try {
            const ctx = (error as { context?: Response }).context
            if (ctx && typeof ctx.text === 'function') {
              const responseText = await ctx.text()
              if (responseText) message = responseText
            }
          } catch {
            // A mensagem genérica continua sendo suficiente para a interface.
          }
          throw new Error(message)
        }

        const payload = data as { storage_path?: string }
        path = payload.storage_path ?? null
      }

      if (!path) throw new Error('Não foi possível localizar o arquivo do certificado.')

      const { data, error } = await supabase.storage
        .from('lms-recursos')
        .createSignedUrl(path, 60 * 60)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    },
  })

  const items = catalogoQuery.data ?? EMPTY_CATALOGO
  const certificados = certificadosQuery.data ?? []
  const categorias = useMemo(
    () => [...new Set(items.map((item) => item.categoria).filter((value): value is string => !!value))],
    [items],
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return items.filter((curso) => {
      const statusMatches =
        tab === 'todos' ||
        (tab === 'andamento' && !!curso.inscricao_id && curso.percentual_concluido > 0 && curso.percentual_concluido < 100) ||
        (tab === 'concluidos' && curso.percentual_concluido >= 100) ||
        (tab === 'certificados' && !!curso.certificado_id)
      const categoryMatches = !catFiltro || curso.categoria === catFiltro
      const searchMatches = !termo ||
        `${curso.titulo} ${curso.descricao ?? ''} ${curso.categoria ?? ''}`
          .toLocaleLowerCase('pt-BR')
          .includes(termo)
      return statusMatches && categoryMatches && searchMatches
    })
  }, [items, tab, catFiltro, busca])

  const emAndamento = items.filter(
    (curso) => !!curso.inscricao_id && curso.percentual_concluido > 0 && curso.percentual_concluido < 100,
  )
  const matriculados = items.filter((curso) => !!curso.inscricao_id)
  const progressoGeral = matriculados.length
    ? Math.round(matriculados.reduce((total, curso) => total + curso.percentual_concluido, 0) / matriculados.length)
    : 0
  const cursoRetomada = emAndamento[0]
  const capaUrl = (path: string | null) =>
    path ? supabase.storage.from('lms-capas').getPublicUrl(path).data.publicUrl : null

  return (
    <div className="partner-university university-catalog">
      <section className="uni-hero" aria-labelledby="uni-page-title">
        <div className="uni-hero-copy">
          <span className="uni-eyebrow"><Sparkles aria-hidden="true" size={15} /> Sua área de aprendizagem</span>
          <h1 id="uni-page-title">Conhecimento para ir mais longe.</h1>
          <p>Conteúdos para fortalecer sua atuação e apoiar cada etapa da jornada de crédito.</p>
          {cursoRetomada ? (
            <Link className="uni-resume" to={`/p/universidade/${cursoRetomada.id}/aula/primeira`}>
              <span className="uni-resume-icon"><Play aria-hidden="true" size={17} fill="currentColor" /></span>
              <span className="uni-resume-copy">
                <small>Continue de onde parou</small>
                <strong>{cursoRetomada.titulo}</strong>
              </span>
              <span className="uni-resume-action">Retomar aula <span aria-hidden="true">→</span></span>
            </Link>
          ) : (
            <a className="uni-resume uni-resume-link" href="#partner-course-catalog">
              <span className="uni-resume-icon"><BookOpen aria-hidden="true" size={18} /></span>
              <span className="uni-resume-copy">
                <small>Próximo passo</small>
                <strong>{matriculados.length ? 'Explore os cursos disponíveis' : 'Escolha um curso para começar'}</strong>
              </span>
              <span className="uni-resume-action">Ver cursos <span aria-hidden="true">→</span></span>
            </a>
          )}
        </div>

        <div className="uni-hero-stats" aria-label="Seu progresso na Universidade">
          <article className="uni-stat">
            <span className="uni-stat-icon"><BookOpen aria-hidden="true" size={17} /></span>
            <span><strong>{String(emAndamento.length).padStart(2, '0')}</strong><small>Cursos em andamento</small></span>
          </article>
          <article className="uni-stat">
            <span className="uni-stat-icon"><Trophy aria-hidden="true" size={17} /></span>
            <span><strong>{String(certificados.length).padStart(2, '0')}</strong><small>Certificados conquistados</small></span>
          </article>
          <div className="uni-overall-progress">
            <div className="uni-progress-label">
              <span><strong>Progresso geral</strong><small>{matriculados.length ? 'Continue no seu ritmo' : 'Seu progresso aparece após a primeira inscrição'}</small></span>
              <b>{progressoGeral}%</b>
            </div>
            <div className="uni-progress-track" role="progressbar" aria-label="Progresso geral nos cursos matriculados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressoGeral}>
              <span style={{ width: `${progressoGeral}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="uni-catalog-section" id="partner-course-catalog" aria-labelledby="uni-catalog-title">
        <div className="uni-section-heading">
          <div><span className="uni-section-kicker">Biblioteca</span><h2 id="uni-catalog-title">Meus cursos</h2></div>
          <span className="uni-course-count">{filtrados.length} {filtrados.length === 1 ? 'curso' : 'cursos'}</span>
        </div>

        <div className="uni-toolbar">
          <div className="uni-filters" role="group" aria-label="Filtrar cursos por andamento">
            {tabs.map((item) => (
              <button
                className={`uni-filter btn-no-liquid${tab === item.id ? ' is-active' : ''}`}
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="uni-toolbar-fields">
            <label className="uni-search">
              <Search aria-hidden="true" size={17} />
              <span className="sr-only">Buscar curso</span>
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar curso" type="search" />
            </label>
            <label className="uni-category-select">
              <GraduationCap aria-hidden="true" size={17} />
              <span className="sr-only">Filtrar por categoria</span>
              <select value={catFiltro} onChange={(event) => setCatFiltro(event.target.value)}>
                <option value="">Todas as categorias</option>
                {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
            </label>
          </div>
        </div>

        {catalogoQuery.isLoading && (
          <div className="uni-state-card" role="status"><Loader2 className="uni-spin" aria-hidden="true" /><span>Carregando cursos…</span></div>
        )}

        {catalogoQuery.isError && (
          <div className="uni-state-card uni-state-error" role="alert">
            <BookOpen aria-hidden="true" />
            <strong>Não foi possível carregar os cursos.</strong>
            <span>Tente novamente em instantes.</span>
            <button className="uni-button btn-no-liquid" type="button" onClick={() => void catalogoQuery.refetch()}>Tentar novamente</button>
          </div>
        )}

        {!catalogoQuery.isLoading && !catalogoQuery.isError && filtrados.length > 0 && (
          <div className="uni-course-grid">
            {filtrados.map((curso, index) => {
              const inscrito = !!curso.inscricao_id
              const concluido = curso.percentual_concluido >= 100
              const capa = capaUrl(curso.capa_storage_path)
              const destino = `/p/universidade/${curso.id}/aula/primeira`
              return (
                <article className="uni-course-card" key={curso.id}>
                  <Link className={`uni-course-cover uni-cover-${index % 4}`} to={destino} aria-label={`Abrir curso ${curso.titulo}`}>
                    {capa ? <img src={capa} alt="" loading="lazy" /> : <BookOpen aria-hidden="true" size={34} />}
                    <span className="uni-cover-mark" aria-hidden="true">UM</span>
                    {curso.categoria && <span className="uni-cover-category">{curso.categoria}</span>}
                    <span className="uni-cover-level">{curso.nivel}</span>
                  </Link>

                  <div className="uni-course-body">
                    <span className={`uni-course-status${concluido ? ' is-complete' : inscrito ? ' is-progress' : ''}`}>
                      {concluido ? <CheckCircle2 aria-hidden="true" size={13} /> : inscrito ? <Play aria-hidden="true" size={12} /> : <BookOpen aria-hidden="true" size={13} />}
                      {concluido ? 'Concluído' : inscrito ? 'Em andamento' : 'Disponível'}
                    </span>
                    <h3><Link to={destino}>{curso.titulo}</Link></h3>
                    {curso.descricao && <p className="uni-course-description">{curso.descricao}</p>}
                    <div className="uni-course-meta">
                      <span><BookOpen aria-hidden="true" size={14} /> {curso.qtd_aulas} {curso.qtd_aulas === 1 ? 'aula' : 'aulas'}</span>
                      <span><Clock3 aria-hidden="true" size={14} /> {formatDuracao(curso.duracao_total_segundos)}</span>
                    </div>

                    {inscrito && (
                      <div className="uni-card-progress">
                        <div><span>{concluido ? 'Curso concluído' : 'Seu progresso'}</span><strong>{Math.round(curso.percentual_concluido)}%</strong></div>
                        <div className="uni-progress-track" role="progressbar" aria-label={`Progresso em ${curso.titulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(curso.percentual_concluido)}>
                          <span style={{ width: `${Math.max(0, Math.min(100, curso.percentual_concluido))}%` }} />
                        </div>
                      </div>
                    )}

                    {inscrever.isError && inscrever.variables === curso.id && (
                      <p className="uni-inline-error" role="alert">Não foi possível concluir a inscrição. Tente novamente.</p>
                    )}
                    {inscrito ? (
                      <Link className="uni-course-action" to={destino}>{concluido ? 'Revisar curso' : 'Continuar curso'} <span aria-hidden="true">→</span></Link>
                    ) : (
                      <button
                        className="uni-course-action btn-no-liquid"
                        type="button"
                        disabled={inscrever.isPending}
                        onClick={() => inscrever.mutate(curso.id)}
                      >
                        {inscrever.isPending && inscrever.variables === curso.id ? <Loader2 className="uni-spin" aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={14} />}
                        Inscrever-se
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {!catalogoQuery.isLoading && !catalogoQuery.isError && filtrados.length === 0 && (
          <div className="uni-state-card">
            <BookOpen aria-hidden="true" />
            <strong>{items.length ? 'Nenhum curso corresponde aos filtros.' : 'Nenhum curso disponível no momento.'}</strong>
            <span>{items.length ? 'Ajuste a busca, categoria ou andamento selecionado.' : 'Quando houver novos conteúdos para parceiros, eles aparecerão aqui.'}</span>
            {items.length > 0 && (busca || catFiltro || tab !== 'todos') && (
              <button className="uni-button btn-no-liquid" type="button" onClick={() => { setBusca(''); setCatFiltro(''); setTab('todos') }}>Limpar filtros</button>
            )}
          </div>
        )}
      </section>

      <section className="uni-certificate-section" aria-labelledby="uni-certificates-title">
        <div className="uni-section-heading">
          <div><span className="uni-section-kicker">Conquistas</span><h2 id="uni-certificates-title">Meus certificados</h2></div>
          <Award aria-hidden="true" size={22} />
        </div>
        {certificadosQuery.isLoading && <div className="uni-certificate-empty" role="status"><Loader2 className="uni-spin" aria-hidden="true" /> Carregando certificados…</div>}
        {certificadosQuery.isError && <div className="uni-certificate-empty uni-state-error" role="alert">Não foi possível carregar seus certificados.</div>}
        {!certificadosQuery.isLoading && !certificadosQuery.isError && certificados.length === 0 && (
          <div className="uni-certificate-empty">Conclua um curso para que seus certificados emitidos apareçam aqui.</div>
        )}
        {certificados.length > 0 && (
          <div className="uni-certificates-list">
            {certificados.map((certificado) => (
              <article className="uni-certificate-card" key={certificado.id}>
                <span className="uni-certificate-icon"><Award aria-hidden="true" size={22} /></span>
                <div className="uni-certificate-copy">
                  <strong>{certificado.curso?.titulo ?? 'Certificado de conclusão'}</strong>
                  <span>Emitido em {new Date(certificado.emitido_em).toLocaleDateString('pt-BR')} · Código {certificado.codigo}</span>
                </div>
                <button className="uni-button uni-certificate-download btn-no-liquid" type="button" disabled={baixarCert.isPending} onClick={() => baixarCert.mutate(certificado)}>
                  {baixarCert.isPending && baixarCert.variables?.id === certificado.id ? <Loader2 className="uni-spin" aria-hidden="true" size={15} /> : <Download aria-hidden="true" size={16} />}
                  Baixar certificado
                </button>
              </article>
            ))}
          </div>
        )}
        {baixarCert.isError && <p className="uni-inline-error" role="alert">Não foi possível abrir o certificado. Tente novamente.</p>}
      </section>
    </div>
  )
}

function formatDuracao(segundos: number): string {
  if (!segundos) return 'Duração não informada'
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  if (horas > 0) return `${horas}h ${minutos}min`
  return `${minutos}min`
}
