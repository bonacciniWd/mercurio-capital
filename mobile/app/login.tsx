import { useState } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Mail, Lock, Fingerprint } from 'lucide-react-native'
import AntDesign from '@expo/vector-icons/AntDesign'
import { supabase } from '@/lib/supabase'

function MicrosoftIcon() {
  // 2×2 colored squares
  return (
    <View style={{ width: 16, height: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 }}>
      <View style={{ width: 7, height: 7, backgroundColor: '#F25022' }} />
      <View style={{ width: 7, height: 7, backgroundColor: '#7FBA00' }} />
      <View style={{ width: 7, height: 7, backgroundColor: '#00A4EF' }} />
      <View style={{ width: 7, height: 7, backgroundColor: '#FFB900' }} />
    </View>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !pwd) return Alert.alert('Atenção', 'Informe e-mail e senha.')
    setLoading(true)
    try {
      const { data: signin, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd })
      if (error) throw error
      const userId = signin.user?.id
      if (!userId) throw new Error('Sessão inválida.')
      const { data: prof } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      const role = prof?.role as string | undefined
      if (role === 'admin') router.replace('/(admin)' as any)
      else if (role === 'client') router.replace('/(cliente)' as any)
      else router.replace('/(parceiro)/dashboard')
    } catch (e) {
      Alert.alert('Falha no login', e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 pt-12">
          {/* Logo */}
          <View className="py-10 items-center">
            <Image
              source={require('../assets/logos/logowide.png')}
              style={{ width: 300, height: 90 }}
              resizeMode="contain"
            />
            
          </View>

          <Text className="text-3xl font-bold text-navy">Bem-vindo</Text>
          <Text className="mt-1 text-sm text-silver-600">Entre com sua conta</Text>

          <View className="mt-8 gap-4">
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

            <View>
              <Text className="mb-1.5 text-xs font-medium text-silver-700">Senha</Text>
              <View className="flex-row items-center rounded-lg border border-silver-300 px-3">
                <Lock size={18} color="#9CA3AF" />
                <TextInput
                  value={pwd} onChangeText={setPwd}
                  secureTextEntry placeholder="••••••••"
                  className="ml-2 flex-1 py-3 text-sm text-silver-900"
                />
              </View>
            </View>

            <Pressable className="self-end">
              <Text className="text-sm font-medium text-gold-600">Esqueci minha senha</Text>
            </Pressable>
          </View>

          {/* Botão Entrar */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="mt-6 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text className="text-base font-bold text-white">Entrar</Text>}
          </Pressable>

          {/* Acesso rápido por perfil (mock / dev) */}
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => router.replace('/(cliente)' as any)}
              className="flex-1 items-center rounded-lg border border-silver-300 py-2.5 active:bg-silver-50"
            >
              <Text className="text-xs font-semibold text-navy">Cliente</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/(admin)' as any)}
              className="flex-1 items-center rounded-lg border border-silver-300 py-2.5 active:bg-silver-50"
            >
              <Text className="text-xs font-semibold text-navy">Admin</Text>
            </Pressable>
          </View>

          {/* Biometria */}
          <Pressable className="mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-3 active:bg-silver-50">
            <Fingerprint size={18} color="#0F0F0F" />
            <Text className="text-sm font-medium text-navy">Entrar com biometria</Text>
          </Pressable>

          {/* Divisor */}
          <View className="mt-4 flex-row items-center gap-3">
            <View className="flex-1 h-px bg-silver-200" />
            <Text className="text-xs text-silver-400">ou continue com</Text>
            <View className="flex-1 h-px bg-silver-200" />
          </View>

          {/* Social login */}
          <View className="mt-3 flex-row gap-3">
            <Pressable
              onPress={() => router.replace('/(parceiro)/dashboard')}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-3 active:bg-silver-50"
            >
              <AntDesign name="apple" size={18} color="#0F0F0F" />
              <Text className="text-sm font-semibold text-navy">Apple</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/(parceiro)/dashboard')}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-3 active:bg-silver-50"
            >
              <MicrosoftIcon />
              <Text className="text-sm font-semibold text-navy">Outlook</Text>
            </Pressable>
          </View>

          {/* Magic link */}
          <Pressable onPress={() => router.push('/magic/abc123')} className="mt-4 items-center">
            <Text className="text-sm text-silver-600">Receber link mágico por e-mail →</Text>
          </Pressable>

          {/* Protocolo público */}
          <Pressable onPress={() => router.push('/protocolo' as any)} className="mt-2 items-center">
            <Text className="text-sm font-medium text-gold-600">Acompanhar proposta sem cadastro →</Text>
          </Pressable>

          {/* Cadastro de parceiro */}
          <Pressable onPress={() => router.push('/cadastro' as any)} className="mt-3 items-center">
            <Text className="text-sm text-silver-600">
              Não tem conta? <Text className="font-semibold text-navy underline">Cadastre-se como parceiro</Text>
            </Text>
          </Pressable>

          <View className="mt-auto items-center pb-4">
            <Text className="text-xs text-silver-500">v0.0.1 · Ambiente: staging</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
