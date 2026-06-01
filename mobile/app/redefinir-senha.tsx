import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

export default function RedefinirSenha() {
  const [hasRecovery, setHasRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // O Supabase materializa a sessão automaticamente via deep link (mercurio://redefinir-senha?...)
    // e dispara PASSWORD_RECOVERY. Como o callback de onAuthStateChange tem lock interno,
    // deferimos qualquer trabalho com setTimeout(0).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => setHasRecovery(true), 0)
      }
    })
    // Checagem inicial: se já existe sessão ao montar, libera o form.
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setHasRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit() {
    setError(null)
    if (password.length < 8) return setError('A senha deve ter ao menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw new Error(err.message)
      await supabase.auth.signOut()
      setDone(true)
      setTimeout(() => router.replace('/login'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 pt-8">
          <View className="items-center py-8">
            <Image
              source={require('../assets/logos/logowide.png')}
              style={{ width: 240, height: 70 }}
              resizeMode="contain"
            />
          </View>

          {done ? (
            <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 size={26} color="#16A34A" />
              </View>
              <Text className="text-2xl font-bold text-navy">Senha atualizada!</Text>
              <Text className="mt-2 text-center text-sm text-silver-600">Redirecionando para o login…</Text>
              <ActivityIndicator color="#D4AF37" className="mt-4" />
            </View>
          ) : !hasRecovery ? (
            <View className="rounded-2xl border border-danger/30 bg-danger/5 p-6">
              <View className="mb-3 flex-row items-center gap-2">
                <AlertTriangle size={18} color="#DC2626" />
                <Text className="text-lg font-bold text-danger">Link inválido ou expirado</Text>
              </View>
              <Text className="text-sm text-silver-700">
                Solicite um novo link de recuperação.
              </Text>
              <Pressable
                onPress={() => router.replace('/recuperar-senha' as any)}
                className="mt-5 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Recuperar senha</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text className="text-2xl font-bold text-navy">Defina sua nova senha</Text>
              <Text className="mt-1 text-sm text-silver-600">Escolha uma senha forte e única para sua conta.</Text>

              <View className="mt-6 gap-4">
                <View>
                  <Text className="mb-1.5 text-xs font-medium text-silver-700">Nova senha</Text>
                  <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                    <Lock size={18} color="#9CA3AF" />
                    <TextInput
                      value={password} onChangeText={setPassword}
                      placeholder="Mínimo 8 caracteres"
                      secureTextEntry autoCapitalize="none"
                      className="ml-2 flex-1 py-3 text-sm text-silver-900"
                    />
                  </View>
                </View>

                <View>
                  <Text className="mb-1.5 text-xs font-medium text-silver-700">Confirmar nova senha</Text>
                  <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                    <Lock size={18} color="#9CA3AF" />
                    <TextInput
                      value={confirm} onChangeText={setConfirm}
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

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  className="items-center rounded-lg bg-gold py-3.5 active:opacity-80"
                >
                  {loading ? <ActivityIndicator color="white" /> : (
                    <Text className="text-base font-bold text-white">Atualizar senha</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

