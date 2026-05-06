import { ScrollView, View, Text, Pressable, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ChevronRight, Bell, Users, Settings, LogOut, Shield, HelpCircle, ShieldCheck, Calculator, BarChart3, GraduationCap } from 'lucide-react-native'
import { Badge } from '@/components/Badge'

export default function Perfil() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="items-center bg-navy-700 px-5 py-6 pt-4">
          <Image source={require('../../assets/general/profile.jpg')} className="h-24 w-24 mt-4 rounded-full" />
          <Text className="mt-3 text-lg font-bold text-white">João Roberto</Text>
          <Text className="text-xs text-white/70">joao@aurora.com.br</Text>
          <Badge variant="blue">Premium</Badge>
        </View>
        <View className="h-8 bg-gold flex-row items-center justify-center gap-6 px-5">
          <Text className="mx-auto font-extralight text-white text-lg">Mercurio Capital</Text>
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

        {/* Operação */}
        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Operação</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={Calculator} label="Simulações"   onPress={() => router.push('/(parceiro)/simulacoes' as any)} />
            <Item icon={Users}      label="Equipe"        badge="8 membros" onPress={() => router.push('/(parceiro)/equipe' as any)} />
            <Item icon={BarChart3}  label="Relatórios"    onPress={() => router.push('/(parceiro)/relatorios' as any)} />
            <Item icon={GraduationCap} label="Universidade" onPress={() => router.push('/(parceiro)/universidade' as any)} />
          </View>
        </View>

        {/* Conta */}
        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Conta</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={Bell} label="Notificações" />
            <Item icon={Shield} label="Segurança & 2FA" />
            <Item icon={Settings} label="Configurações" onPress={() => router.push('/(parceiro)/configuracoes' as any)} />
          </View>
        </View>

        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Ajuda</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={HelpCircle} label="Central de ajuda" />
          </View>
        </View>

        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-danger">Modo Admin</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-danger/30 bg-danger/5">
            <Pressable
              onPress={() => router.push('/(admin)/' as any)}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-danger/10"
            >
              <ShieldCheck size={20} color="#DC2626" />
              <Text className="flex-1 text-sm font-semibold text-danger">Acessar backoffice</Text>
              <ChevronRight size={18} color="#DC2626" />
            </Pressable>
          </View>
        </View>

        <View className="px-5 py-12">
          <Pressable
            onPress={() => router.replace('/login')}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 py-3"
          >
            <LogOut size={18} color="#DC2626" />
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

function Item({ icon: Icon, label, badge, onPress }: { icon: any; label: string; badge?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 border-b border-silver-100 px-4 py-3 last:border-b-0 active:bg-silver-50">
      <Icon size={20} color="#0F0F0F" />
      <Text className="flex-1 text-sm font-medium text-silver-900">{label}</Text>
      {badge && <Text className="text-xs text-silver-500">{badge}</Text>}
      <ChevronRight size={18} color="#9CA3AF" />
    </Pressable>
  )
}
