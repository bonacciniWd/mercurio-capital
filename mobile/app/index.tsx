import { useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'

export default function Splash() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/login'), 1600)
    return () => clearTimeout(t)
  }, [])

  return (
    <View className="flex-1 items-center justify-center bg-navy-700">
      {/* Logo placeholder — substituir por <Image source={require('../assets/logo.png')} /> */}
      <View className="h-24 w-24 items-center justify-center rounded-2xl border-2 border-gold">
        <Text className="text-5xl font-black text-gold">M</Text>
      </View>
      <Text className="mt-6 text-2xl font-bold tracking-wider text-white">MERCURIO</Text>
      <Text className="text-sm tracking-[0.4em] text-gold">CAPITAL</Text>

      <View className="absolute bottom-16 items-center">
        <ActivityIndicator color="#D4AF37" />
        <Text className="mt-3 text-xs text-silver-400">Carregando...</Text>
      </View>
    </View>
  )
}
