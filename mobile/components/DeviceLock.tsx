import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, Image, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as LocalAuthentication from 'expo-local-authentication'
import { LockKeyhole } from 'lucide-react-native'

interface Props {
  autoPrompt: boolean
  onUnlock: () => void
  onSignOut: () => Promise<void>
  onPromptChange: (active: boolean) => void
}

export function DeviceLock({ autoPrompt, onUnlock, onSignOut, onPromptChange }: Props) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function unlock() {
    if (pending) return
    setPending(true)
    setMessage(null)
    onPromptChange(true)
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Mercúrio Capital',
        promptDescription: 'Confirme sua identidade para continuar a sessão neste aparelho.',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código do aparelho',
        disableDeviceFallback: false,
      })
      if (result.success) onUnlock()
      else setMessage('Não foi possível desbloquear. Tente novamente ou entre com sua conta.')
    } catch {
      setMessage('Desbloqueio indisponível neste aparelho. Entre com sua conta.')
    } finally {
      onPromptChange(false)
      setPending(false)
    }
  }

  useEffect(() => {
    if (!autoPrompt || AppState.currentState !== 'active') return
    const timer = setTimeout(() => { void unlock() }, 350)
    return () => clearTimeout(timer)
    // Run only on each new lock screen mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-[#09090B] px-7" edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center">
        <Image source={require('../assets/logos/logo-dark.png')} resizeMode="contain" style={{ width: 235, height: 75 }} />
        <View className="mt-14 h-20 w-20 items-center justify-center rounded-3xl border border-[#333337] bg-[#171719]">
          <LockKeyhole size={32} color="#DC2626" />
        </View>
        <Text className="mt-7 text-center text-2xl font-bold text-white">Sessão protegida</Text>
        <Text className="mt-3 text-center text-base leading-6 text-[#A3A3AA]">
          Desbloqueie o aparelho para continuar no app Mercúrio Capital.
        </Text>
        {message ? <Text accessibilityRole="alert" className="mt-5 text-center text-sm text-[#F87171]">{message}</Text> : null}
      </View>
      <View className="gap-3 pb-6">
        <Pressable
          accessibilityRole="button"
          onPress={() => { void unlock() }}
          disabled={pending}
          className="min-h-14 items-center justify-center rounded-xl bg-[#DC2626] disabled:opacity-60"
        >
          {pending ? <ActivityIndicator color="white" /> : <Text className="text-base font-bold text-white">Desbloquear</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { void onSignOut() }} className="min-h-12 items-center justify-center">
          <Text className="text-sm font-semibold text-[#B5B5BC]">Sair e entrar novamente</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
