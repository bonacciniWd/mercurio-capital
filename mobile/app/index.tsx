import { useEffect } from 'react'
import { View, Image, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'

export default function Splash() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/login'), 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <View className="flex-1 items-center justify-center bg-navy-700">
      <Image
        source={require('../assets/logos/logo-square.png')}
        style={{ width: 220, height: 220 }}
        resizeMode="contain"
      />

      <View className="absolute bottom-16 items-center">
        <ActivityIndicator style={{ width: 66, height: 66 }} color="#DC2626" />
      </View>
    </View>
  )
}
