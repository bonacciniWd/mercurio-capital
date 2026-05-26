import { useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable, Image, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Award, PlayCircle, Lock, Download } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { Badge } from '@/components/Badge'
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

const NIVEL_LABEL: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

export default function Universidade() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('todos')

  const catalogoQ = useQuery({
    queryKey: ['p-lms-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_catalogo').select('*')
        .in('publico', ['parceiro', 'ambos'])
        .order('ordem')
      if (error) throw error
      return (data ?? []) as CatalogoItem[]
    },
  })

  const certificadosQ = useQuery({
    queryKey: ['p-lms-certificados'],
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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['p-lms-catalogo'] }) },
    onError: (e: unknown) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)),
  })

  const baixarCert = useMutation({
    mutationFn: async (cert: Certificado) => {
      let path = cert.pdf_storage_path
      if (!path) {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/certificado-gerar`, {
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
      await WebBrowser.openBrowserAsync(data.signedUrl)
    },
    onError: (e: unknown) => Alert.alert('Erro', e instanceof Error ? e.message : String(e)),
  })

  const items = catalogoQ.data ?? []

  const filtrados = useMemo(() => {
    if (tab === 'andamento')   return items.filter(c => c.inscricao_id && c.percentual_concluido > 0 && c.percentual_concluido < 100)
    if (tab === 'concluidos')  return items.filter(c => c.percentual_concluido >= 100)
    if (tab === 'certificados') return items.filter(c => c.certificado_id)
    return items
  }, [items, tab])

  const totEmAndamento = items.filter(c => c.inscricao_id && c.percentual_concluido < 100).length
  const totConcluidos = items.filter(c => c.percentual_concluido >= 100).length
  const totCertificados = (certificadosQ.data ?? []).length

  const capaUrl = (p: string | null) =>
    p ? supabase.storage.from('lms-capas').getPublicUrl(p).data.publicUrl : null

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Hero */}
        <View className="bg-navy-700 px-5 pb-6 pt-4">
          <Text className="text-xs uppercase tracking-wider text-gold">Universidade Mercurio</Text>
          <Text className="mt-1 text-2xl font-bold text-white">Aprenda no seu ritmo</Text>
          <Image source={require('../../assets/general/university.png')} className=" absolute right-5 -top-2 h-36 w-36 flex-1 rounded-lg" resizeMode="cover" />
          <Text className="mt-1 text-sm text-white/70">
            {items.length} curso{items.length === 1 ? '' : 's'} · {totCertificados} certificado{totCertificados === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Stats */}
        <View className="-mt-4 flex-row gap-3 px-5">
          <View className="flex-1 rounded-xl bg-white p-3 shadow-sm">
            <Text className="text-xs text-silver-500">Em andamento</Text>
            <Text className="text-2xl font-bold text-navy">{totEmAndamento}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-white p-3 shadow-sm">
            <Text className="text-xs text-silver-500">Concluídos</Text>
            <Text className="text-2xl font-bold text-success">{totConcluidos}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-gold p-3">
            <Text className="text-xs text-white">Certificados</Text>
            <Text className="text-2xl font-bold text-white">{totCertificados}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="px-5 pt-5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'andamento', label: 'Em andamento' },
              { id: 'concluidos', label: 'Concluídos' },
              { id: 'certificados', label: 'Certificados' },
            ] as const).map(t => (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 ${tab === t.id ? 'bg-navy' : 'bg-white border border-silver-200'}`}
              >
                <Text className={`text-xs font-semibold ${tab === t.id ? 'text-white' : 'text-silver-700'}`}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Loading / vazio */}
        {catalogoQ.isLoading && (
          <View className="px-5 pt-6"><ActivityIndicator color="#DC2626" /></View>
        )}
        {!catalogoQ.isLoading && filtrados.length === 0 && (
          <View className="mx-5 mt-4 items-center rounded-xl border border-silver-200 bg-white p-8">
            <Text className="text-sm text-silver-500">Nenhum curso {tab !== 'todos' ? 'nesta visão' : 'disponível'}.</Text>
          </View>
        )}

        {/* Lista cursos */}
        <View className="px-5 pt-4">
          <View className="gap-3">
            {filtrados.map(c => {
              const capa = capaUrl(c.capa_storage_path)
              const inscrito = !!c.inscricao_id
              const concluido = c.percentual_concluido >= 100
              const locked = !inscrito && !c.gratuito
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    if (!inscrito) {
                      if (inscrever.isPending) return
                      inscrever.mutate(c.id, {
                        onSuccess: () => router.push(`/(parceiro)/aula/${c.id}` as any),
                      })
                    } else {
                      router.push(`/(parceiro)/aula/${c.id}` as any)
                    }
                  }}
                  className="overflow-hidden rounded-xl border border-silver-200 bg-white active:opacity-70"
                >
                  <View className="h-52 overflow-hidden bg-navy">
                    {capa
                      ? <Image source={{ uri: capa }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      : null}
                    <View
                      className="absolute inset-0 items-center justify-center"
                      style={{ backgroundColor: locked ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)' }}
                    >
                      {locked
                        ? <Lock size={32} color="white" />
                        : <View className="h-12 w-12 items-center justify-center rounded-full bg-gold/90">
                            <PlayCircle size={28} color="white" />
                          </View>}
                    </View>
                    {concluido && (
                      <View className="absolute right-3 top-3 rounded-full bg-success px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-white">CONCLUÍDO</Text>
                      </View>
                    )}
                  </View>
                  <View className="p-4">
                    <View className="flex-row items-center gap-2">
                      {c.categoria && <Badge variant="gray">{c.categoria}</Badge>}
                      <Badge variant={c.nivel === 'avancado' ? 'red' : c.nivel === 'intermediario' ? 'amber' : 'green'}>
                        {NIVEL_LABEL[c.nivel] ?? c.nivel}
                      </Badge>
                    </View>
                    <Text className="mt-2 font-semibold text-navy">{c.titulo}</Text>
                    <Text className="mt-0.5 text-[11px] text-silver-500">
                      {c.qtd_aulas} aulas · {formatDuracao(c.duracao_total_segundos)}
                    </Text>
                    {inscrito && c.percentual_concluido > 0 && (
                      <View className="mt-3">
                        <View className="h-1.5 overflow-hidden rounded-full bg-silver-200">
                          <View className="h-full rounded-full bg-gold" style={{ width: `${c.percentual_concluido}%` }} />
                        </View>
                        <Text className="mt-1 text-xs text-silver-500">{Math.round(c.percentual_concluido)}% concluído</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Certificados */}
        <View className="px-5 pt-5">
          <Text className="text-base font-bold text-navy">Meus certificados</Text>
          {certificadosQ.isLoading && (
            <View className="mt-2 rounded-xl border border-silver-200 bg-white p-4">
              <ActivityIndicator color="#DC2626" />
            </View>
          )}
          {!certificadosQ.isLoading && (certificadosQ.data ?? []).length === 0 && (
            <View className="mt-2 flex-row items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
              <Award size={28} color="#DC2626" />
              <Text className="flex-1 text-xs text-silver-600">
                Nenhum certificado ainda. Conclua um curso para receber o seu.
              </Text>
            </View>
          )}
          {(certificadosQ.data ?? []).map(cert => (
            <Pressable
              key={cert.id}
              disabled={baixarCert.isPending}
              onPress={() => baixarCert.mutate(cert)}
              className="mt-2 flex-row items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4 active:opacity-70"
            >
              <Award size={28} color="#DC2626" />
              <View className="flex-1">
                <Text className="font-semibold text-navy">{cert.curso?.titulo ?? 'Curso'}</Text>
                <Text className="text-[11px] text-silver-600">
                  {new Date(cert.emitido_em).toLocaleDateString('pt-BR')} · {cert.codigo}
                </Text>
              </View>
              {baixarCert.isPending ? <ActivityIndicator color="#DC2626" /> : <Download size={18} color="#0F0F0F" />}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function formatDuracao(s: number): string {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

