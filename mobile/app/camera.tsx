import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { X, Camera as CameraIcon, Image, Zap } from 'lucide-react-native'

export default function CameraScreen() {
  // Placeholder — substituir por <CameraView /> de expo-camera
  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()} className="rounded-full bg-white/15 p-2">
          <X size={22} color="white" />
        </Pressable>
        <Text className="font-bold text-white">Capturar documento</Text>
        <Pressable className="rounded-full bg-white/15 p-2">
          <Zap size={20} color="white" />
        </Pressable>
      </View>

      {/* Viewfinder placeholder */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-gold">
          <View className="flex-1 items-center justify-center">
            <CameraIcon size={48} color="#DC2626" />
            <Text className="mt-3 text-center text-sm text-white/70">
              Posicione o documento dentro do quadro
            </Text>
            <Text className="mt-1 text-xs text-white/50">Detecção automática de bordas</Text>
          </View>
        </View>
      </View>

      {/* Tipo de documento */}
      <View className="flex-row gap-2 px-5 pb-3">
        {['RG', 'CPF', 'Comprovante', 'Matrícula'].map((t, i) => (
          <Pressable key={t} className={`flex-1 items-center rounded-full py-2 ${i === 0 ? 'bg-gold' : 'bg-white/10'}`}>
            <Text className={`text-xs font-semibold ${i === 0 ? 'text-navy-900' : 'text-white'}`}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {/* Controles */}
      <View className="flex-row items-center justify-around px-5 pb-6">
        <Pressable className="rounded-full bg-white/10 p-3">
          <Image size={24} color="white" />
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white"
        >
          <View className="h-16 w-16 rounded-full bg-white" />
        </Pressable>
        <View className="w-12" />
      </View>
    </SafeAreaView>
  )
}
