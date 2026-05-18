import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Award, Filter, Loader2, Download, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

export function UniversidadeLista() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('todos')
  const [catFiltro, setCatFiltro] = useState<string | null>(null)

  const catalogoQuery = useQuery({
    queryKey: ['lms-catalogo-partner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_catalogo').select('*')
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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['lms-catalogo-partner'] }) },
  })

  const baixarCert = useMutation({
    mutationFn: async (cert: Certificado) => {
      let path = cert.pdf_storage_path
      if (!path) {
        // gera via edge function
        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificado-gerar`
        const res = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ certificado_id: cert.id }),
        })
        if (!res.ok) throw new Error(await res.text())
        const j = await res.json()
        path = j.storage_path as string
      }
      const { data, error } = await supabase.storage.from('lms-recursos')
        .createSignedUrl(path!, 60 * 60)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    },
  })

  const items = catalogoQuery.data ?? []

  const filtrados = useMemo(() => {
    let xs = items
    if (catFiltro) xs = xs.filter(c => c.categoria === catFiltro)
    if (tab === 'andamento')   xs = xs.filter(c => c.inscricao_id && c.percentual_concluido > 0 && c.percentual_concluido < 100)
    if (tab === 'concluidos')  xs = xs.filter(c => c.percentual_concluido >= 100)
    if (tab === 'certificados') xs = xs.filter(c => c.certificado_id)
    return xs
  }, [items, tab, catFiltro])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    items.forEach(i => i.categoria && set.add(i.categoria))
    return [...set]
  }, [items])

  const capaUrl = (p: string | null) =>
    p ? supabase.storage.from('lms-capas').getPublicUrl(p).data.publicUrl : null

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-lg bg-gradient-to-br from-navy via-navy-600 to-navy-700 p-8 text-white">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold">Universidade Mercurio</h1>
            <p className="text-sm text-white/80">Capacitação para parceiros de excelência.</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1">
        {([
          { id: 'todos', label: 'Todos' },
          { id: 'andamento', label: 'Em andamento' },
          { id: 'concluidos', label: 'Concluídos' },
          { id: 'certificados', label: 'Certificados' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-navy text-white' : 'text-silver-600 hover:bg-silver-100'}`}>
            {t.label}
          </button>
        ))}
        {categorias.length > 0 && (
          <select className="ml-auto rounded-md border border-silver-200 px-3 py-1.5 text-sm bg-white"
            value={catFiltro ?? ''} onChange={(e) => setCatFiltro(e.target.value || null)}>
            <option value="">Todas as categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {!categorias.length && (
          <button className="ml-auto btn-outline opacity-50 cursor-not-allowed" disabled>
            <Filter className="h-4 w-4" /> Categoria
          </button>
        )}
      </div>

      {catalogoQuery.isLoading && (
        <div className="card p-8 text-center text-silver-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Carregando…
        </div>
      )}

      {!catalogoQuery.isLoading && filtrados.length === 0 && (
        <div className="card p-12 text-center text-silver-500">
          <BookOpen className="mx-auto mb-2 h-8 w-8" />
          Nenhum curso disponível {tab !== 'todos' ? 'nesta visão' : 'no momento'}.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtrados.map(c => {
          const inscrito = !!c.inscricao_id
          const concluido = c.percentual_concluido >= 100
          const capa = capaUrl(c.capa_storage_path)
          return (
            <div key={c.id} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              <Link to={`/p/universidade/${c.id}/aula/primeira`}
                className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-navy to-navy-700 text-white">
                {capa
                  ? <img src={capa} alt={c.titulo} className="absolute inset-0 h-full w-full object-cover" />
                  : <Play className="h-10 w-10 opacity-80 group-hover:scale-110 transition" />}
                {c.categoria && <span className="absolute left-3 top-3 badge bg-gold text-navy">{c.categoria}</span>}
                <span className="absolute right-3 top-3 badge bg-white/20 text-white capitalize">{c.nivel}</span>
              </Link>
              <div className="p-4">
                <h3 className="font-semibold text-silver-900 line-clamp-2">{c.titulo}</h3>
                <p className="mt-1 text-xs text-silver-500">
                  {c.qtd_aulas} aulas · {formatDuracao(c.duracao_total_segundos)}
                </p>
                {inscrito && c.percentual_concluido > 0 && (
                  <>
                    <div className="mt-3 h-1.5 rounded-full bg-silver-200">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${c.percentual_concluido}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-silver-500">{Math.round(c.percentual_concluido)}% concluído</p>
                  </>
                )}
                <div className="mt-3 flex gap-2">
                  {!inscrito ? (
                    <button className="btn-gold w-full text-sm" disabled={inscrever.isPending}
                      onClick={() => inscrever.mutate(c.id)}>
                      {inscrever.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Inscrever-se
                    </button>
                  ) : (
                    <Link to={`/p/universidade/${c.id}/aula/primeira`} className="btn-outline w-full text-sm">
                      {concluido ? 'Revisar' : 'Continuar'}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Meus certificados</h2>
        {certificadosQuery.isLoading && (
          <div className="card p-4 text-sm text-silver-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
        )}
        {!certificadosQuery.isLoading && (certificadosQuery.data ?? []).length === 0 && (
          <div className="card p-5 text-sm text-silver-500">Nenhum certificado ainda. Conclua um curso para receber o seu.</div>
        )}
        {(certificadosQuery.data ?? []).map(cert => (
          <div key={cert.id} className="card flex items-center justify-between p-5 mb-2">
            <div className="flex items-center gap-3">
              <Award className="h-7 w-7 text-gold" />
              <div>
                <p className="font-semibold text-navy">{cert.curso?.titulo ?? 'Curso'}</p>
                <p className="text-xs text-silver-500">
                  Emitido em {new Date(cert.emitido_em).toLocaleDateString('pt-BR')} · Código {cert.codigo}
                </p>
              </div>
            </div>
            <button className="btn-outline" disabled={baixarCert.isPending} onClick={() => baixarCert.mutate(cert)}>
              {baixarCert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function formatDuracao(s: number): string {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

