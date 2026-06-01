import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/lib/auth'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="recuperar-senha" />
        <Stack.Screen name="redefinir-senha" />
        <Stack.Screen name="acesso-pendente" />
        <Stack.Screen name="partner-bootstrap" />
        <Stack.Screen name="magic/[token]" />
        <Stack.Screen name="convite/[token]" />
        <Stack.Screen name="2fa/challenge" />
        <Stack.Screen name="2fa/setup" />
        <Stack.Screen name="protocolo" />
        <Stack.Screen name="(parceiro)" />
        <Stack.Screen name="(cliente)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="camera" options={{ presentation: 'modal' }} />
        <Stack.Screen name="propostas/nova" options={{ presentation: 'modal' }} />
      </Stack>
        </AuthProvider>
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
