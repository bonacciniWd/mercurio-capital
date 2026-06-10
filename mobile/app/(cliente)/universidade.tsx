import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert, Image, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { GraduationCap, Lock, Play, ArrowLeft, CheckCircle2 } from 'lucide-react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
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

export default function ClientUniversidade() {
  const assinaturaQ = useQuery({
    queryKey: ['lms-assinatura'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinaturas_universidade')
        .select('id, status, ciclo, current_period_end, valor_centavos')
        .maybeSingle()
      if (error) throw error
      return data as Assinatura | null
    },
  })

  const ativa = !!assinaturaQ.data && ['ativa', 'trialing'].includes(assinaturaQ.data.status)

  const catalogoQ = useQuery({
    enabled: ativa,
    queryKey: ['lms-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lms_catalogo')
        .select('*')
        .in('publico', ['cliente', 'ambos'])
        .order('ordem')
      if (error) throw error
      return (data ?? []) as CatalogoItem[]
    },
  })

  const assinarMut = useMutation({
    mutationFn: async (ciclo: 'mensal' | 'anual') => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) throw new Error('Sessão expirada')
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/lms-assinar`
      const res = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ciclo }),
      })
      if (!res.ok) throw new Error(await res.text())
      const j = (await res.json()) as { checkout_url: string }
      await WebBrowser.openBrowserAsync(j.checkout_url)
      await assinaturaQ.refetch()
    },
    onError: (e: unknown) => Alert.alert('Falha', e instanceof Error ? e.message : String(e)),
  })

  const capaUrl = (p: string | null) =>
    p ? supabase.storage.from('lms-capas').getPublicUrl(p).data.publicUrl : null

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Cliente</Text>
            <Text className="text-lg font-bold text-white">Universidade Mercurio</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="overflow-hidden rounded-2xl bg-navy p-5">
          <View className="flex-row items-center gap-3">
            <GraduationCap size={28} color="#DC2626" />
            <View className="flex-1">
              <Text className="text-base font-bold text-white">Educação financeira premium</Text>
              <Text className="mt-1 text-xs text-white/70">
                Conteúdo exclusivo de finanças, mercado e planejamento patrimonial.
              </Text>
            </View>
          </View>
        </View>

        {assinaturaQ.isLoading && (
          <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
            <ActivityIndicator color="#D4AF37" />
          </View>
        )}

        {!assinaturaQ.isLoading && !ativa && (
          <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-gold/15">
              <Lock size={26} color="#991B1B" />
            </View>
            <Text className="mt-3 text-xl font-bold text-navy">Acesso por assinatura</Text>
            <Text className="mt-1 text-center text-sm text-silver-600">
              Desbloqueie todos os cursos e certificados.
            </Text>
            <View className="mt-5 self-stretch gap-2">
              <Bullet text="Mais de 80 horas de conteúdo" />
              <Bullet text="Certificado digital validado" />
              <Bullet text="Atualizações semanais" />
            </View>
            {Platform.OS === 'ios' ? (
              <View className="mt-6 self-stretch rounded-lg border border-silver-200 bg-silver-50 p-4">
                <Text className="text-sm font-bold text-navy">Assinatura indisponível no app iOS</Text>
                <Text className="mt-1 text-xs text-silver-600">
                  Por exigência da Apple (compras dentro do app), a assinatura da Universidade
                  é feita pela versão web. Acesse pelo navegador para assinar e o acesso será
                  liberado automaticamente aqui.
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  disabled={assinarMut.isPending}
                  onPress={() => assinarMut.mutate('mensal')}
                  className="mt-6 self-stretch rounded-lg bg-gold py-3 active:opacity-80"
                >
                  {assinarMut.isPending
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-center text-sm font-bold text-white">Assinar por R$ 49,90/mês</Text>}
                </Pressable>
                <Pressable
                  disabled={assinarMut.isPending}
                  onPress={() => assinarMut.mutate('anual')}
                  className="mt-2 self-stretch rounded-lg border border-silver-300 py-3"
                >
                  <Text className="text-center text-sm font-bold text-navy">Anual — R$ 499,00 (2 meses grátis)</Text>
                </Pressable>
              </>
            )}
            {assinaturaQ.data?.status === 'past_due' && (
              <Text className="mt-3 text-xs text-danger">Sua assinatura está atrasada. Renove para recuperar o acesso.</Text>
            )}
          </View>
        )}

        {ativa && (
          <>
            <View className="flex-row items-center justify-between rounded-xl border border-success/30 bg-success/5 px-3 py-2">
              <View className="flex-row items-center gap-2">
                <CheckCircle2 size={16} color="#16A34A" />
                <Text className="text-xs font-semibold text-success">
                  Assinatura {assinaturaQ.data?.status === 'trialing' ? 'em trial' : 'ativa'}
                  {assinaturaQ.data?.valor_centavos
                    ? ` · ${brl(assinaturaQ.data.valor_centavos)} / ${assinaturaQ.data.ciclo === 'anual' ? 'ano' : 'mês'}`
                    : ''}
                </Text>
              </View>
              {assinaturaQ.data?.current_period_end && (
                <Text className="text-[11px] text-silver-600">
                  Renova {new Date(assinaturaQ.data.current_period_end).toLocaleDateString('pt-BR')}
                </Text>
              )}
            </View>

            {catalogoQ.isLoading && (
              <View className="items-center p-8"><ActivityIndicator color="#D4AF37" /></View>
            )}

            <View className="gap-3">
              {(catalogoQ.data ?? []).map(c => {
                const capa = capaUrl(c.capa_storage_path)
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => Alert.alert(c.titulo, c.descricao ?? 'Acesse pelo app web para iniciar a aula.')}
                    className="overflow-hidden rounded-2xl border border-silver-200 bg-white"
                  >
                    <View className="h-32 items-center justify-center bg-navy">
                      {capa
                        ? <Image source={{ uri: capa }} style={{ width: '100%', height: '100%' }} />
                        : <Play size={36} color="white" />}
                    </View>
                    <View className="p-4">
                      {c.categoria && (
                        <View className="self-start rounded-full bg-navy/10 px-2 py-0.5">
                          <Text className="text-[11px] font-bold text-navy">{c.categoria}</Text>
                        </View>
                      )}
                      <Text className="mt-2 font-semibold text-silver-900">{c.titulo}</Text>
                      <Text className="mt-0.5 text-[11px] text-silver-500">
                        {c.qtd_aulas} aulas · {Math.round(c.duracao_total_segundos / 60)} min
                      </Text>
                      {c.percentual_concluido > 0 && (
                        <>
                          <View className="mt-2 h-1 overflow-hidden rounded-full bg-silver-200">
                            <View className="h-full bg-gold" style={{ width: `${c.percentual_concluido}%` }} />
                          </View>
                          <Text className="mt-1 text-xs text-silver-500">{Math.round(c.percentual_concluido)}% concluído</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                )
              })}
              {!catalogoQ.isLoading && (catalogoQ.data ?? []).length === 0 && (
                <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
                  <Text className="text-sm text-silver-600">Nenhum curso publicado para clientes ainda.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-success">✓</Text>
      <Text className="flex-1 text-sm text-silver-700">{text}</Text>
    </View>
  )
}
