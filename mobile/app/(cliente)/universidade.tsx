import { useState } from 'react'
import { Alert, Image, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { GraduationCap } from 'lucide-react-native'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Action, Body, Card, ClientScreen, Feedback, Label, SectionTitle } from '@/components/cliente/ClienteUI'
import { dataBR } from '@/lib/clientePresentation'

type Course = { id: string; titulo: string; descricao: string | null; categoria: string | null; capa_storage_path: string | null; qtd_aulas: number; duracao_total_segundos: number; percentual_concluido: number }
export default function ClientUniversidade() {
  const { session } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const assinatura = useQuery({ queryKey: ['client', session?.userId, 'subscription'], enabled: !!session?.userId, queryFn: async () => {
    const { data, error } = await supabase.from('assinaturas_universidade').select('id,status,ciclo,current_period_end').maybeSingle()
    if (error) throw error
    return data
  } })
  const ativa = !!assinatura.data && ['ativa', 'trialing'].includes(assinatura.data.status)
  const catalogo = useQuery({ queryKey: ['client', session?.userId, 'courses'], enabled: ativa, queryFn: async () => {
    const { data, error } = await supabase.from('v_lms_catalogo').select('id,titulo,descricao,categoria,capa_storage_path,qtd_aulas,duracao_total_segundos,percentual_concluido').in('publico', ['cliente', 'ambos']).order('ordem')
    if (error) throw error
    return (data ?? []) as Course[]
  } })
  async function refresh() { setRefreshing(true); try { const result = await assinatura.refetch(); if (result.data && ['ativa', 'trialing'].includes(result.data.status)) await catalogo.refetch() } finally { setRefreshing(false) } }
  async function abrirCurso(id: string) {
    try {
      const base = process.env.EXPO_PUBLIC_APP_URL
      if (!base || new URL(base).protocol !== 'https:') throw new Error('url')
      await WebBrowser.openBrowserAsync(`${base.replace(/\/$/, '')}/c/universidade/${encodeURIComponent(id)}/aula/primeira`)
    } catch { Alert.alert('Curso indisponível', 'Não foi possível abrir a Universidade. Tente novamente em instantes.') }
  }
  return <ClientScreen title="Universidade Mercúrio" subtitle="Conhecimento para ir além" refreshing={refreshing} onRefresh={refresh}>
    <Card accent><View className="gap-4"><GraduationCap size={32} color="#F87171" /><Label>Seu próximo aprendizado</Label><Text className="text-3xl font-bold text-white">Mais clareza para suas decisões.</Text><Body>Explore os conteúdos disponíveis para você e acompanhe sua evolução.</Body></View></Card>
    {assinatura.isPending ? <Feedback loading title="Conferindo seu acesso" /> : assinatura.isError ? <Feedback title="Não foi possível verificar seu acesso" retry={() => void assinatura.refetch()} /> : !ativa ? <Feedback title="Seu acesso ainda não está ativo" text={assinatura.data?.status === 'past_due' ? 'Há uma pendência na assinatura. Confira sua conta na Universidade para regularizar o acesso.' : 'Os conteúdos serão exibidos quando houver uma assinatura ativa vinculada à sua conta.'} /> : <>
      <View className="gap-2"><Label>{assinatura.data?.status === 'trialing' ? 'Período de experiência ativo' : 'Assinatura ativa'}</Label>{assinatura.data?.current_period_end ? <Body>Período atual até {dataBR(assinatura.data.current_period_end)}.</Body> : null}</View>
      <SectionTitle>Explore os conteúdos</SectionTitle>
      {catalogo.isPending ? <Feedback loading title="Carregando conteúdos" /> : catalogo.isError ? <Feedback title="Catálogo indisponível" retry={() => void catalogo.refetch()} /> : !catalogo.data?.length ? <Feedback title="Novos conteúdos a caminho" text="Os cursos publicados para clientes aparecerão aqui." /> : catalogo.data.map(c => {
        const progress = Math.max(0, Math.min(100, Number(c.percentual_concluido) || 0))
        return <Card key={c.id}><View className="gap-4">{c.capa_storage_path ? <Image source={{ uri: supabase.storage.from('lms-capas').getPublicUrl(c.capa_storage_path).data.publicUrl }} resizeMode="cover" accessibilityLabel={`Capa: ${c.titulo}`} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} /> : <View className="h-32 items-center justify-center rounded-2xl bg-[#26262C]"><GraduationCap size={40} color="#F87171" /></View>}{c.categoria ? <Label>{c.categoria}</Label> : null}<SectionTitle>{c.titulo}</SectionTitle>{c.descricao ? <Body>{c.descricao}</Body> : null}<Body>{c.qtd_aulas} aulas · {Math.round(c.duracao_total_segundos / 60)} min</Body><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }} className="h-1.5 overflow-hidden rounded-full bg-[#414148]"><View style={{ width: `${progress}%`, height: '100%', backgroundColor: '#EF4444' }} /></View><Body>{Math.round(progress)}% concluído</Body><Action label={progress > 0 ? 'Continuar no navegador' : 'Abrir curso no navegador'} onPress={() => void abrirCurso(c.id)} /><Body>Você poderá precisar entrar na sua conta no navegador.</Body></View></Card>
      })}
    </>}
  </ClientScreen>
}
