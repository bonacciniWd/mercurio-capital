import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ShieldCheck, AlertTriangle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

/**
 * Tela de challenge TOTP exibida após signInWithPassword quando o usuário
 * possui um fator TOTP verificado (AAL1 → AAL2).
 */
export default function TwoFactorChallenge() {
  const { signOut, refresh } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (code.length !== 6) {
      setError('Informe o código de 6 dígitos.')
      return
    }
    setLoading(true)
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors()
      if (listErr) throw new Error(listErr.message)
      const factor = factors?.totp?.find(f => f.status === 'verified')
      if (!factor) throw new Error('Nenhum fator TOTP verificado. Cadastre o 2FA em /2fa/setup.')

      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (chErr || !challenge) throw new Error(chErr?.message ?? 'Não foi possível iniciar o desafio.')

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: factor.id, challengeId: challenge.id, code,
      })
      if (verErr) throw new Error(verErr.message)

      await refresh()

      // Roteia baseado no role
      const { data: prof } = await supabase.auth.getUser()
      const userId = prof.user?.id
      if (!userId) throw new Error('Sessão inválida.')
      const { data: u } = await supabase.from('usuarios').select('role').eq('id', userId).maybeSingle()
      const role = u?.role as string | undefined
      if (role === 'admin') router.replace('/(admin)' as any)
      else if (role === 'client') router.replace('/(cliente)' as any)
      else router.replace('/(parceiro)/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar 2FA.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    await signOut()
    router.replace('/login')
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-md rounded-2xl border border-silver-200 bg-white p-8">
            <View className="items-center pb-2">
              <Image
                source={require('../../assets/logos/logowide.png')}
                style={{ width: 200, height: 60 }}
                resizeMode="contain"
              />
            </View>
            <View className="mt-4 flex-row items-center gap-2">
              <ShieldCheck size={18} color="#B45309" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-gold-600">
                Segurança adicional
              </Text>
            </View>
            <Text className="mt-1 text-2xl font-bold text-navy">Verificação em duas etapas</Text>
            <Text className="mt-2 text-sm text-silver-600">
              Informe o código TOTP do seu autenticador (Google Authenticator, 1Password, Authy etc.) para
              concluir o acesso.
            </Text>

            <View className="mt-6 gap-4">
              <View>
                <Text className="mb-1.5 text-xs font-medium text-silver-700">Código 2FA</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  className="rounded-lg border border-silver-300 px-3 py-3 text-center text-2xl font-bold tracking-[8px] text-navy"
                />
              </View>

              {error && (
                <View className="flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
                  <AlertTriangle size={14} color="#DC2626" />
                  <Text className="flex-1 text-xs text-danger">{error}</Text>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className="items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-base font-bold text-white">Validar e entrar</Text>}
              </Pressable>

              <Pressable
                onPress={handleCancel}
                disabled={loading}
                className="items-center rounded-lg border border-silver-300 py-3 active:bg-silver-50"
              >
                <Text className="text-sm font-semibold text-navy">Cancelar e sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

