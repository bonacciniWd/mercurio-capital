import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ChevronRight, Bell, Users, Settings, LogOut, Shield, HelpCircle } from 'lucide-react-native'
import { Badge } from '@/components/Badge'

export default function Perfil() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="items-center bg-navy-700 px-5 pb-6 pt-4">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-gold">
            <Text className="text-3xl font-bold text-navy-900">JR</Text>
          </View>
          <Text className="mt-3 text-lg font-bold text-white">João Roberto</Text>
          <Text className="text-xs text-white/70">joao@aurora.com.br</Text>
          <Badge variant="gold">Premium</Badge>
        </View>

        {/* Estatísticas / Milestones */}
        <View className="px-5 pt-4">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Meu desempenho</Text>
          <View className="mt-2 flex-row gap-3">
            <Stat label="Volume" value="R$ 4,2M" />
            <Stat label="Aprovação" value="68%" />
            <Stat label="Equipe" value="8" />
          </View>
        </View>

        {/* Menu */}
        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Conta</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={Users} label="Equipe" badge="8 membros" />
            <Item icon={Bell} label="Notificações" />
            <Item icon={Shield} label="Segurança & 2FA" />
            <Item icon={Settings} label="Configurações" />
          </View>
        </View>

        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Ajuda</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={HelpCircle} label="Central de ajuda" />
          </View>
        </View>

        <View className="px-5 pt-5">
          <Pressable
            onPress={() => router.replace('/login')}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 py-3"
          >
            <LogOut size={18} color="#D9534F" />
            <Text className="font-semibold text-danger">Sair</Text>
          </Pressable>
        </View>

        <Text className="mt-6 text-center text-xs text-silver-400">v0.0.1 · Build 1</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-xl border border-silver-200 bg-white p-3">
      <Text className="text-lg font-bold text-navy">{value}</Text>
      <Text className="text-xs text-silver-500">{label}</Text>
    </View>
  )
}

function Item({ icon: Icon, label, badge }: { icon: any; label: string; badge?: string }) {
  return (
    <Pressable className="flex-row items-center gap-3 border-b border-silver-100 px-4 py-3 last:border-b-0 active:bg-silver-50">
      <Icon size={20} color="#0A2B4E" />
      <Text className="flex-1 text-sm font-medium text-silver-900">{label}</Text>
      {badge && <Text className="text-xs text-silver-500">{badge}</Text>}
      <ChevronRight size={18} color="#9CA3AF" />
    </Pressable>
  )
}
