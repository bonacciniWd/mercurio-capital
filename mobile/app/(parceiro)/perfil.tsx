import { ScrollView, View, Text, Pressable, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ChevronRight, Bell, Users, Settings, LogOut, Shield, HelpCircle, ShieldCheck, Calculator, BarChart3, GraduationCap, Coins, FileText } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { usePartnerProfile, partnerDisplayName } from '@/lib/partner'

interface KpiRow {
  ativas: number
  ganhas: number
  taxa_conversao: number
  volume_total: number
}

export default function Perfil() {
  const { signOut } = useAuth()
  const profileQ = usePartnerProfile()

  const kpiQ = useQuery({
    queryKey: ['p-kpis-perfil'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_dashboard_kpis')
        .select('ativas, ganhas, taxa_conversao, volume_total')
        .maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })

  const equipeQ = useQuery({
    queryKey: ['p-equipe-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_equipe_membros_detalhe')
        .select('usuario_id')
      if (error) throw error
      return (data ?? []).length
    },
  })

  const profile = profileQ.data
  const nome = partnerDisplayName(profile)
  const kpi = kpiQ.data
  const totalMembros = equipeQ.data ?? 0

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/login')
        },
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Header */}
        <View className="items-center bg-navy-700 px-5 py-6 pt-4">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="mt-4 h-24 w-24 rounded-full" />
          ) : (
            <Image source={require('../../assets/general/profile.jpg')} className="mt-4 h-24 w-24 rounded-full" />
          )}
          <Text className="mt-3 text-lg font-bold text-white" numberOfLines={1}>{nome}</Text>
          <Text className="text-xs text-white/70">{profile?.email ?? '—'}</Text>
          <Badge variant="blue">
            {profile?.partner_status === 'approved' ? 'Aprovado' : profile?.partner_status ?? 'Parceiro'}
          </Badge>
        </View>
        <View className="h-8 flex-row items-center justify-center gap-6 bg-gold px-5">
          <Text className="mx-auto text-lg font-extralight text-white">Mercurio Capital</Text>
        </View>

        {/* Estatísticas */}
        <View className="px-5 pt-4">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Meu desempenho</Text>
          <View className="mt-2 flex-row gap-3">
            <Stat label="Volume" value={brl(Number(kpi?.volume_total ?? 0) * 100)} />
            <Stat label="Conversão" value={`${kpi?.taxa_conversao ?? 0}%`} />
            <Stat label="Equipe" value={String(totalMembros)} />
          </View>
        </View>

        {/* Operação */}
        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Operação</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={Calculator} label="Simulações" onPress={() => router.push('/(parceiro)/simulacoes' as any)} />
            <Item icon={Coins} label="Comissões" onPress={() => router.push('/(parceiro)/comissoes' as any)} />
            <Item icon={Users} label="Equipe" badge={`${totalMembros} membros`} onPress={() => router.push('/(parceiro)/equipe' as any)} />
            <Item icon={BarChart3} label="Relatórios" onPress={() => router.push('/(parceiro)/relatorios' as any)} />
            <Item icon={GraduationCap} label="Universidade" onPress={() => router.push('/(parceiro)/universidade' as any)} />
            <Item icon={FileText} label="Contrato de parceria" onPress={() => router.push('/(parceiro)/contrato' as any)} />
          </View>
        </View>

        {/* Conta */}
        <View className="px-5 pt-5">
          <Text className="text-xs uppercase tracking-wider text-silver-500">Conta</Text>
          <View className="mt-2 overflow-hidden rounded-xl border border-silver-200 bg-white">
            <Item icon={Bell} label="Notificações" onPress={() => router.push('/(parceiro)/configuracoes' as any)} />
            <Item icon={Shield} label="Segurança & 2FA" onPress={() => router.push('/(parceiro)/configuracoes' as any)} />
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
            onPress={handleLogout}
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
      <Text className="text-base font-bold text-navy" numberOfLines={1}>{value}</Text>
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
