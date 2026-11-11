import { useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Mail, Lock } from 'lucide-react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null)
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null)

  async function handleLogin() {
    if (!email || !pwd) return Alert.alert('Atenção', 'Informe e-mail e senha.')
    setLoading(true)
    try {
      // Login via edge `auth-login` (rate limit server-side por e-mail + IP).
      const { data: result, error: fnError } = await supabase.functions.invoke('auth-login', {
        body: { email: email.trim(), password: pwd },
      })
      if (fnError) {
        let parsed: { error?: string; retry_after_min?: number } | null = null
        try {
          const ctx = (fnError as { context?: Response }).context
          if (ctx && typeof ctx.json === 'function') parsed = await ctx.json()
        } catch { /* ignore */ }
        if (parsed?.error === 'rate_limited') {
          throw new Error(`Muitas tentativas de login. Tente novamente em ${parsed.retry_after_min ?? 15} minutos.`)
        }
        if (parsed?.error === 'credenciais_invalidas') {
          throw new Error('E-mail ou senha inválidos.')
        }
        throw new Error('Falha ao autenticar.')
      }
      const tokens = result as { access_token?: string; refresh_token?: string } | null
      if (!tokens?.access_token || !tokens?.refresh_token) throw new Error('Falha ao autenticar.')

      const { data: signin, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })
      if (error) throw error
      const userId = signin.user?.id
      if (!userId) throw new Error('Sessão inválida.')

      // 1) Verifica nível de garantia (AAL) — se houver fator TOTP verificado e AAL < 2,
      //    redireciona para challenge 2FA.
      try {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
          return router.replace('/2fa/challenge' as any)
        }
      } catch { /* MFA opcional: prossegue se a checagem falhar */ }

      // 2) Verifica perfil/role + status do parceiro
      const { data: prof } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      const role = prof?.role as string | undefined

      if (role === 'admin') return router.replace('/acesso-indisponivel')
      if (role === 'client') return router.replace('/(cliente)' as any)

      if (role !== 'partner' && role !== 'team_member') return router.replace('/acesso-indisponivel')
      // partner | team_member: checa se está aprovado
      const { data: meData } = await supabase.rpc('me')
      const me = (meData ?? {}) as { partner_status?: string; approved?: boolean }
      if (role === 'partner' && (me.partner_status !== 'approved' || !me.approved)) {
        return router.replace('/acesso-pendente' as any)
      }
      router.replace('/(parceiro)/dashboard')
    } catch (e) {
      Alert.alert('Falha no login', e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }

  }

  return (
    <SafeAreaView className="flex-1 bg-[#111216]" edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pb-8 pt-5">
            <View className="mb-10 items-start">
              <Image
                accessibilityLabel="Mercúrio Capital"
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require('../assets/logos/logo-dark.png')}
                style={{ width: 206, height: 64 }}
                resizeMode="contain"
              />
            </View>

            <View>
              <Text className="text-3xl font-bold tracking-tight text-white">Acesse sua conta</Text>
              <Text className="mt-2 text-base leading-6 text-[#A3A3AA]">
                Entre para acompanhar suas oportunidades na Mercúrio Capital.
              </Text>
            </View>

            <View className="mt-9 gap-5">
              <View>
                <Text className="mb-2 text-sm font-semibold text-[#D4D4D8]">E-mail</Text>
                <View className={`min-h-14 flex-row items-center rounded-xl border bg-[#151518] px-4 ${focusedField === 'email' ? 'border-[#DC2626]' : 'border-[#36363B]'}`}>
                  <Mail size={19} color="#A3A3AA" />
                  <TextInput
                    accessibilityLabel="E-mail"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField((current) => current === 'email' ? null : current)}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    placeholder="voce@empresa.com.br"
                    placeholderTextColor="#77777F"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    returnKeyType="next"
                    selectionColor="#EF4444"
                    className="ml-3 min-h-14 flex-1 py-3 text-base text-white"
                  />
                </View>
              </View>

              <View>
                <Text className="mb-2 text-sm font-semibold text-[#D4D4D8]">Senha</Text>
                <View className={`min-h-14 flex-row items-center rounded-xl border bg-[#151518] px-4 ${focusedField === 'password' ? 'border-[#DC2626]' : 'border-[#36363B]'}`}>
                  <Lock size={19} color="#A3A3AA" />
                  <TextInput
                    ref={passwordRef}
                    accessibilityLabel="Senha"
                    value={pwd}
                    onChangeText={setPwd}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField((current) => current === 'password' ? null : current)}
                    onSubmitEditing={() => { void handleLogin() }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    placeholder="Digite sua senha"
                    placeholderTextColor="#77777F"
                    selectionColor="#EF4444"
                    className="ml-3 min-h-14 flex-1 py-3 text-base text-white"
                  />
                </View>
              </View>

              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/recuperar-senha' as any)}
                className="min-h-11 self-end justify-center"
              >
                <Text className="text-sm font-semibold text-[#F87171]">Esqueci minha senha</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              onPress={() => { void handleLogin() }}
              disabled={loading}
              className="mt-5 min-h-14 items-center justify-center rounded-xl bg-[#DC2626] active:bg-[#B91C1C] disabled:opacity-60"
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text className="text-base font-bold text-white">Entrar</Text>}
            </Pressable>

            <View className="mt-auto pt-8">
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/protocolo' as any)}
                className="min-h-12 items-center justify-center rounded-xl border border-[#36363B] bg-[#111113] px-4"
              >
                <Text className="text-center text-sm font-semibold text-[#E4E4E7]">
                  Acompanhar proposta sem cadastro <Text className="text-[#F87171">→</Text>
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/onboarding?profile=partner')}
                className="mt-4 min-h-12 flex-row flex-wrap items-center justify-center px-2"
              >
                <Text className="text-sm text-[#A3A3AA]">Ainda não tem conta? </Text>
                <Text className="text-sm font-semibold text-white underline">Cadastre-se como parceiro</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
