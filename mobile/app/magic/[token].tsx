import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'

export default function MagicLink() {
  const { token } = useLocalSearchParams<{ token: string }>()

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 size={48} color="#16A34A" />
        </View>
        <Text className="mt-6 text-2xl font-bold text-navy">Link verificado!</Text>
        <Text className="mt-2 text-center text-sm text-silver-600">
          Seu acesso foi confirmado. Estamos te direcionando…
        </Text>
        <Text className="mt-2 font-mono text-xs text-silver-400">token: {token}</Text>

        <Pressable
          onPress={() => router.replace('/(cliente)')}
          className="mt-8 rounded-lg bg-navy-700 px-8 py-3"
        >
          <Text className="font-bold text-white">Continuar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
