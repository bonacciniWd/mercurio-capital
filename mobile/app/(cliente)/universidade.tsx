import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { GraduationCap, Lock, Play, ArrowLeft } from 'lucide-react-native'

export default function ClientUniversidade() {
  const subscribed = false
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Cliente</Text>
            <Text className="text-lg font-bold text-white">Universidade Mercurio</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="overflow-hidden rounded-2xl bg-navy p-5">
          <View className="flex-row items-center gap-3">
            <GraduationCap size={28} color="#DC2626" />
            <View className="flex-1">
              <Text className="text-base font-bold text-white">Educação financeira premium</Text>
              <Text className="mt-1 text-xs text-white/70">
                Conteúdo exclusivo de finanças, mercado e planejamento patrimonial.
              </Text>
            </View>
          </View>
        </View>

        {!subscribed ? (
          <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-gold/15">
              <Lock size={26} color="#991B1B" />
            </View>
            <Text className="mt-3 text-xl font-bold text-navy">Acesso por assinatura</Text>
            <Text className="mt-1 text-center text-sm text-silver-600">
              Desbloqueie todos os cursos e certificados.
            </Text>
            <View className="mt-5 self-stretch gap-2">
              <Bullet text="Mais de 80 horas de conteúdo" />
              <Bullet text="Certificado digital validado" />
              <Bullet text="Atualizações semanais" />
            </View>
            <Pressable className="mt-6 self-stretch rounded-lg bg-gold py-3 active:opacity-80">
              <Text className="text-center text-sm font-bold text-white">Assinar por R$ 49,90/mês</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <View key={i} className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
                <View className="h-32 items-center justify-center bg-navy">
                  <Play size={36} color="white" />
                </View>
                <View className="p-4">
                  <View className="self-start rounded-full bg-navy/10 px-2 py-0.5">
                    <Text className="text-[11px] font-bold text-navy">Crédito</Text>
                  </View>
                  <Text className="mt-2 font-semibold text-silver-900">Fundamentos do Home Equity</Text>
                  <View className="mt-2 h-1 overflow-hidden rounded-full bg-silver-200">
                    <View className="h-full bg-gold" style={{ width: '40%' }} />
                  </View>
                  <Text className="mt-1 text-xs text-silver-500">40% concluído</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-success">✓</Text>
      <Text className="flex-1 text-sm text-silver-700">{text}</Text>
    </View>
  )
}
