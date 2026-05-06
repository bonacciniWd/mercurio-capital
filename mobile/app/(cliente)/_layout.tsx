import { Stack } from 'expo-router'

export default function ClienteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="documentos" />
      <Stack.Screen name="universidade" />
    </Stack>
  )
}
