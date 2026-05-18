import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Lock, GraduationCap, Play, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface Assinatura {
  id: string
  status: 'trialing' | 'ativa' | 'past_due' | 'cancelada' | 'expirada'
  ciclo: 'mensal' | 'anual'
  current_period_end: string | null
  valor_centavos: number | null
}

interface CatalogoItem {
  id: string
  titulo: string
  descricao: string | null
  categoria: string | null
  capa_storage_path: string | null
  qtd_aulas: number
  duracao_total_segundos: number
  inscricao_id: string | null
  percentual_concluido: number
}

export function ClientUniversidade() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [erro, setErro] = useState<string | null>(null)

  const assinaturaQuery = useQuery({
    queryKey: ['lms-assinatura'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinaturas_universidade').select('*').maybeSingle()
      if (error) throw error
      return data as Assinatura | null
    },
  })

  // Refresh ao voltar do Stripe
  useEffect(() => {
    if (searchParams.get('subscribed') === '1') {
      void qc.invalidateQueries({ queryKey: ['lms-assinatura'] })
      const t = setTimeout(() => setSearchParams({}), 2000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  const ativa = assinaturaQuery.data && ['ativa', 'trialing'].includes(assinaturaQuery.data.status)

  const catalogoQuery = useQuery({
    enabled: !!ativa,
    queryKey: ['lms-catalogo-cliente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_catalogo').select('*')
        .in('publico', ['cliente', 'ambos']).order('ordem')
      if (error) throw error
      return (data ?? []) as CatalogoItem[]
    },
  })

  const assinar = useMutation({
    mutationFn: async (ciclo: 'mensal' | 'anual') => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lms-assinar`
      const res = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ciclo }),
      })
      if (!res.ok) throw new Error(await res.text())
      const j = await res.json() as { checkout_url: string }
      window.location.href = j.checkout_url
    },
    onError: (e) => setErro(String(e instanceof Error ? e.message : e)),
  })

  const capaUrl = (p: string | null) =>
    p ? supabase.storage.from('lms-capas').getPublicUrl(p).data.publicUrl : null

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-lg bg-gradient-to-r from-navy to-navy-600 p-8 text-white">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold">Universidade Mercurio</h1>
            <p className="text-sm text-white/80">Conteúdo exclusivo de finanças, mercado e planejamento patrimonial.</p>
          </div>
        </div>
      </div>

      {searchParams.get('subscribed') === '1' && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-5 w-5" /> Assinatura ativada! Aproveite os cursos.
        </div>
      )}

      {erro && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
      )}

      {assinaturaQuery.isLoading && (
        <div className="card p-8 text-center text-silver-500">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      )}

      {!assinaturaQuery.isLoading && !ativa && (
        <div className="card relative p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
            <Lock className="h-7 w-7 text-gold-600" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-navy">Acesso por assinatura</h2>
          <p className="mt-1 text-sm text-silver-600">Desbloqueie todos os cursos e certificados.</p>
          <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-silver-700">
            <li>✓ Mais de 80 horas de conteúdo</li>
            <li>✓ Certificado digital validado</li>
            <li>✓ Atualizações semanais</li>
          </ul>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button className="btn-gold" disabled={assinar.isPending} onClick={() => assinar.mutate('mensal')}>
              {assinar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Assinar por R$ 49,90/mês
            </button>
            <button className="btn-outline" disabled={assinar.isPending} onClick={() => assinar.mutate('anual')}>
              Anual — R$ 499,00 (2 meses grátis)
            </button>
          </div>
          {assinaturaQuery.data?.status === 'past_due' && (
            <p className="mt-4 text-xs text-red-600">Sua assinatura está atrasada. Renove para recuperar o acesso.</p>
          )}
        </div>
      )}

      {ativa && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
            <span className="text-green-700">
              Assinatura {assinaturaQuery.data?.status === 'trialing' ? 'em trial' : 'ativa'}
              {assinaturaQuery.data?.valor_centavos
                ? ` · ${brl(assinaturaQuery.data.valor_centavos)} / ${assinaturaQuery.data.ciclo === 'anual' ? 'ano' : 'mês'}`
                : ''}
            </span>
            {assinaturaQuery.data?.current_period_end && (
              <span className="text-silver-600 text-xs">
                Renova em {new Date(assinaturaQuery.data.current_period_end).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {catalogoQuery.isLoading && (
            <div className="card p-8 text-center text-silver-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {(catalogoQuery.data ?? []).map(c => {
              const capa = capaUrl(c.capa_storage_path)
              return (
                <Link key={c.id} to={`/p/universidade/${c.id}/aula/primeira`} className="card overflow-hidden group">
                  <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-navy to-navy-700 text-white">
                    {capa
                      ? <img src={capa} alt={c.titulo} className="absolute inset-0 h-full w-full object-cover" />
                      : <Play className="h-10 w-10" />}
                  </div>
                  <div className="p-4">
                    {c.categoria && <span className="badge bg-navy-100 text-navy-600">{c.categoria}</span>}
                    <h3 className="mt-2 font-semibold text-silver-900">{c.titulo}</h3>
                    {c.percentual_concluido > 0 && (
                      <>
                        <div className="mt-3 h-1 rounded-full bg-silver-200">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${c.percentual_concluido}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-silver-500">{Math.round(c.percentual_concluido)}% concluído</p>
                      </>
                    )}
                  </div>
                </Link>
              )
            })}
            {(catalogoQuery.data ?? []).length === 0 && !catalogoQuery.isLoading && (
              <div className="md:col-span-3 card p-8 text-center text-silver-500">
                Nenhum curso publicado para clientes ainda.
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

