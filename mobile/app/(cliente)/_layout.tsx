import { Stack, Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '@/lib/auth'

export default function ClienteLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#D4AF37" />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="documentos" />
      <Stack.Screen name="universidade" />
      <Stack.Screen name="propostas/[id]" />
    </Stack>
  )
}
