import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Lock, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Phase = 'loading' | 'set_password' | 'redirecting' | 'error'

export default function PartnerBootstrap() {
  const { refresh } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  // Aguarda o Supabase materializar a sessão a partir do deep link
  // (mercurio://partner-bootstrap?...) — pode demorar ~250-500ms.
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    async function waitForSession() {
      while (!cancelled && attempts < 30) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setEmail(data.session.user.email ?? null)
          await supabase.auth.refreshSession().catch(() => null)
          await refresh()
          if (!cancelled) setPhase('set_password')
          return
        }
        attempts += 1
        await new Promise((r) => setTimeout(r, 250))
      }
      if (!cancelled) {
        setPhase('error')
        setError('Não foi possível validar o convite. O link pode estar expirado.')
      }
    }
    void waitForSession()
    return () => { cancelled = true }
  }, [refresh])

  async function finishRedirect() {
    setPhase('redirecting')
    try {
      const { data, error: meErr } = await supabase.rpc('me')
      if (meErr) throw new Error(meErr.message)
      const m = (data ?? {}) as { role?: string; partner_status?: string; approved?: boolean }
      if (m.role === 'partner') {
        if (m.partner_status === 'approved') router.replace('/(parceiro)/dashboard')
        else router.replace('/acesso-pendente' as any)
      } else if (m.role === 'admin') {
        router.replace('/(admin)' as any)
      } else {
        router.replace('/acesso-pendente' as any)
      }
    } catch (e) {
      setPhase('error')
      setError((e as Error).message)
    }
  }

  async function onSubmit() {
    setError(null)
    if (pwd.length < 8) return setError('A senha precisa ter ao menos 8 caracteres.')
    if (pwd !== pwd2) return setError('As senhas não conferem.')

    setSubmitting(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password: pwd })
      if (upErr) throw new Error(upErr.message)
      await finishRedirect()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  async function onSkip() {
    setSubmitting(true)
    await finishRedirect()
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-md rounded-2xl border border-silver-200 bg-white p-8">
            <View className="items-center pb-2">
              <Image
                source={require('../assets/logos/logowide.png')}
                style={{ width: 200, height: 60 }}
                resizeMode="contain"
              />
            </View>
            <Text className="mt-2 text-xs font-semibold uppercase tracking-wider text-gold-600">
              Convite de parceiro
            </Text>
            <Text className="mt-2 text-2xl font-bold text-navy">Ativar acesso</Text>

            {phase === 'loading' && (
              <View className="mt-6 flex-row items-center gap-2">
                <ActivityIndicator color="#737373" />
                <Text className="text-sm text-silver-600">Validando o convite…</Text>
              </View>
            )}

            {phase === 'set_password' && (
              <>
                <Text className="mt-3 text-sm text-silver-600">
                  Bem-vindo{email ? `, ${email}` : ''}! Defina uma senha para acessar pelo login tradicional.
                  Você também poderá entrar via magic-link a qualquer momento.
                </Text>

                <View className="mt-5 gap-3">
                  <View>
                    <Text className="mb-1.5 text-xs font-medium text-silver-700">Nova senha</Text>
                    <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                      <Lock size={18} color="#9CA3AF" />
                      <TextInput
                        value={pwd} onChangeText={setPwd}
                        placeholder="Mínimo 8 caracteres"
                        secureTextEntry autoCapitalize="none" autoFocus
                        className="ml-2 flex-1 py-3 text-sm text-silver-900"
                      />
                    </View>
                  </View>
                  <View>
                    <Text className="mb-1.5 text-xs font-medium text-silver-700">Confirmar senha</Text>
                    <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                      <Lock size={18} color="#9CA3AF" />
                      <TextInput
                        value={pwd2} onChangeText={setPwd2}
                        placeholder="Repita a senha"
                        secureTextEntry autoCapitalize="none"
                        className="ml-2 flex-1 py-3 text-sm text-silver-900"
                      />
                    </View>
                  </View>

                  {error && (
                    <View className="flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                      <AlertTriangle size={14} color="#DC2626" />
                      <Text className="flex-1 text-xs text-danger">{error}</Text>
                    </View>
                  )}

                  <View className="flex-row gap-2 pt-1">
                    <Pressable
                      onPress={onSkip}
                      disabled={submitting}
                      className="flex-1 items-center rounded-lg border border-silver-300 py-3 active:bg-silver-50"
                    >
                      <Text className="text-sm font-semibold text-silver-700">Pular por agora</Text>
                    </Pressable>
                    <Pressable
                      onPress={onSubmit}
                      disabled={submitting}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-gold py-3 active:opacity-80"
                    >
                      {submitting
                        ? <ActivityIndicator color="white" />
                        : <>
                            <KeyRound size={16} color="white" />
                            <Text className="text-sm font-bold text-white">Definir senha</Text>
                          </>}
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {phase === 'redirecting' && (
              <View className="mt-6 flex-row items-center gap-2">
                <CheckCircle2 size={18} color="#16A34A" />
                <Text className="text-sm text-success">Tudo certo! Redirecionando…</Text>
              </View>
            )}

            {phase === 'error' && (
              <View className="mt-6 gap-3">
                <View className="flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                  <AlertTriangle size={14} color="#DC2626" />
                  <Text className="flex-1 text-xs text-danger">{error}</Text>
                </View>
                <Pressable
                  onPress={() => router.replace('/login')}
                  className="items-center rounded-lg bg-gold py-3.5 active:opacity-80"
                >
                  <Text className="text-base font-bold text-white">Ir para o login</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

