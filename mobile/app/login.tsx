import { useState } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Mail, Lock, Fingerprint } from 'lucide-react-native'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 pt-12">
          {/* Logo */}
          <View className="mb-10 items-center">
            <View className="h-16 w-16 items-center justify-center rounded-xl bg-navy-700">
              <Text className="text-3xl font-black text-gold">M</Text>
            </View>
            <Text className="mt-3 text-lg font-bold text-navy">Mercurio Capital</Text>
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
            onPress={() => router.replace('/(parceiro)/dashboard')}
            className="mt-6 items-center rounded-lg bg-gold py-3.5 active:opacity-80"
          >
            <Text className="text-base font-bold text-navy-900">Entrar</Text>
          </Pressable>

          {/* Biometria */}
          <Pressable className="mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-3 active:bg-silver-50">
            <Fingerprint size={18} color="#0A2B4E" />
            <Text className="text-sm font-medium text-navy">Entrar com biometria</Text>
          </Pressable>

          {/* Magic link */}
          <Pressable onPress={() => router.push('/magic/abc123')} className="mt-4 items-center">
            <Text className="text-sm text-silver-600">Receber link mágico por e-mail →</Text>
          </Pressable>

          <View className="mt-auto items-center pb-4">
            <Text className="text-xs text-silver-500">v0.0.1 · Ambiente: staging</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
