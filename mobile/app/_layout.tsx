import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="magic/[token]" />
        <Stack.Screen name="(parceiro)" />
        <Stack.Screen name="(cliente)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="camera" options={{ presentation: 'modal' }} />
        <Stack.Screen name="propostas/nova" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  )
}
