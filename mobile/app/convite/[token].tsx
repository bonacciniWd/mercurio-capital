import { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { LogIn, CheckCircle2, AlertTriangle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function ConviteMembro() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { session, refresh, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<'idle' | 'aceitando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Token não informado.')
      return
    }
    if (authLoading) return
    if (!session) return // aguarda login

    setStatus('aceitando')
    void (async () => {
      try {
        const { error: rpcErr } = await supabase.rpc('membro_accept_convite', { p_token: token })
        if (rpcErr) throw new Error(rpcErr.message)
        await refresh()
        setStatus('ok')
        setTimeout(() => router.replace('/(parceiro)/dashboard'), 800)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Falha ao aceitar convite.')
      }
    })()
  }, [token, session, authLoading, refresh])

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md rounded-2xl border border-silver-200 bg-white p-8">
          <View className="items-center pb-4">
            <Image
              source={require('../../assets/logos/logowide.png')}
              style={{ width: 200, height: 60 }}
              resizeMode="contain"
            />
          </View>

          {!session ? (
            <View className="items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-gold/15">
                <LogIn size={28} color="#B45309" />
              </View>
              <Text className="text-center text-xl font-bold text-navy">Faça login para aceitar</Text>
              <Text className="mt-2 text-center text-sm text-silver-600">
                Use o mesmo e-mail que recebeu o convite. Após autenticar, você será automaticamente vinculado à equipe.
              </Text>
              <Pressable
                onPress={() => router.push(`/login?next=/convite/${token}` as any)}
                className="mt-6 w-full items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Entrar</Text>
              </Pressable>
            </View>
          ) : status === 'aceitando' ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#D4AF37" size="large" />
              <Text className="mt-4 text-sm text-silver-600">Validando convite…</Text>
            </View>
          ) : status === 'ok' ? (
            <View className="items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 size={28} color="#16A34A" />
              </View>
              <Text className="text-center text-xl font-bold text-navy">Convite aceito!</Text>
              <Text className="mt-2 text-center text-sm text-silver-600">Redirecionando…</Text>
            </View>
          ) : status === 'error' ? (
            <View className="items-center">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle size={28} color="#DC2626" />
              </View>
              <Text className="text-center text-xl font-bold text-navy">Não foi possível aceitar</Text>
              <Text className="mt-2 text-center text-sm text-danger">{error}</Text>
              <Pressable
                onPress={() => router.replace('/(parceiro)/dashboard')}
                className="mt-6 w-full items-center rounded-lg border border-silver-300 py-3 active:bg-silver-50"
              >
                <Text className="text-sm font-semibold text-navy">Ir para o painel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  )
}

