import { ScrollView, View, Text, Pressable, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Mail } from 'lucide-react-native'
import { useState } from 'react'

const team = [
  { name: 'Mariana Costa',   email: 'mariana@aurora.com',  role: 'Assistente', team: 'Vendas SP', count: 12, active: true },
  { name: 'Carlos Oliveira', email: 'carlos@aurora.com',   role: 'Assistente', team: 'Vendas SP', count: 8,  active: true },
  { name: 'Beatriz Lima',    email: 'beatriz@aurora.com',  role: 'Assistente', team: 'Vendas RJ', count: 5,  active: false },
]

export default function Equipe() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Minha equipe</Text>
          </View>
          <Pressable className="flex-row items-center gap-1 rounded-full bg-gold px-3 py-2 active:opacity-80">
            <Plus size={16} color="#FFF" />
            <Text className="text-xs font-bold text-white">Convidar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {team.map((m) => <Member key={m.email} {...m} />)}

        <View className="mt-3 rounded-xl border border-silver-200 bg-white p-4">
          <Text className="font-semibold text-navy">Convites pendentes</Text>
          <View className="mt-3 flex-row items-center justify-between rounded-lg bg-silver-50 px-3 py-2.5">
            <View className="flex-row items-center gap-2">
              <Mail size={14} color="#9CA3AF" />
              <Text className="text-sm text-silver-800">novo@aurora.com</Text>
            </View>
            <Text className="text-xs text-silver-500">há 2 dias</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Member({ name, email, role, team, count, active }: any) {
  const [on, setOn] = useState<boolean>(active)
  return (
    <View className="rounded-xl border border-silver-200 bg-white p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-navy">
          <Text className="text-lg font-bold text-white">{name[0]}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-silver-900">{name}</Text>
          <Text className="text-xs text-silver-500">{email}</Text>
        </View>
        <Switch value={on} onValueChange={setOn} trackColor={{ false: '#CBD5E1', true: '#16A34A' }} />
      </View>
      <View className="mt-3 flex-row gap-2">
        <View className="rounded-full bg-navy/10 px-2 py-0.5">
          <Text className="text-[11px] font-semibold text-navy">{role}</Text>
        </View>
        <View className="rounded-full bg-gold/15 px-2 py-0.5">
          <Text className="text-[11px] font-semibold text-gold">{team}</Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between border-t border-silver-100 pt-3">
        <Text className="text-sm text-silver-600">{count} propostas</Text>
        <Text className="text-sm font-semibold text-gold">Ver propostas →</Text>
      </View>
    </View>
  )
}
