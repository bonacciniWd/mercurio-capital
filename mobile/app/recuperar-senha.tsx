import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Mail, MailCheck, ArrowLeft, AlertTriangle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Informe seu e-mail.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const redirectTo = Linking.createURL('/redefinir-senha')
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (err) throw new Error(err.message)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar e-mail.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 pt-4">
          <Pressable onPress={() => router.back()} className="-ml-2 self-start p-2">
            <ArrowLeft size={22} color="#0F0F0F" />
          </Pressable>

          <View className="items-center py-8">
            <Image
              source={require('../assets/logos/logowide.png')}
              style={{ width: 240, height: 70 }}
              resizeMode="contain"
            />
          </View>

          {sent ? (
            <View className="rounded-2xl border border-silver-200 bg-white p-6">
              <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <MailCheck size={26} color="#16A34A" />
              </View>
              <Text className="text-2xl font-bold text-navy">Verifique seu e-mail</Text>
              <Text className="mt-2 text-sm text-silver-600">
                Se houver uma conta vinculada a <Text className="font-semibold">{email}</Text>, enviamos um link
                para você redefinir a senha. O link expira em 1 hora.
              </Text>
              <Pressable
                onPress={() => router.replace('/login')}
                className="mt-6 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Voltar ao login</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text className="text-2xl font-bold text-navy">Recuperar acesso</Text>
              <Text className="mt-1 text-sm text-silver-600">
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </Text>

              <View className="mt-6 gap-4">
                <View>
                  <Text className="mb-1.5 text-xs font-medium text-silver-700">E-mail</Text>
                  <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                    <Mail size={18} color="#9CA3AF" />
                    <TextInput
                      value={email} onChangeText={setEmail}
                      placeholder="voce@empresa.com"
                      autoCapitalize="none" keyboardType="email-address"
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
                    <Text className="text-base font-bold text-white">Enviar link de recuperação</Text>
                  )}
                </Pressable>

                <Pressable onPress={() => router.replace('/login')} className="items-center pt-2">
                  <Text className="text-sm font-medium text-navy underline">Voltar ao login</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

