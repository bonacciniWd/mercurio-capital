import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, TrendingUp, Users, AlertTriangle } from 'lucide-react-native'
import { KPICard } from '@/components/KPICard'
import { brl } from '@/lib/utils'

export default function AdminDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-silver-900 px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-danger">Modo Admin</Text>
            <Text className="text-lg font-bold text-white">Dashboard</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* KPIs */}
        <View className="flex-row gap-3">
          <KPICard label="Parceiros" value="47" intent="success" />
          <KPICard label="Propostas" value="312" />
        </View>
        <View className="flex-row gap-3">
          <KPICard label="Em análise" value={brl(8700000000)} intent="gold" />
          <KPICard label="Pendências" value="41" intent="warning" />
        </View>
        <View className="flex-row gap-3">
          <KPICard label="Contratos/mês" value="23" intent="success" />
          <KPICard label="Saldo carteiras" value={brl(1850000)} />
        </View>

        {/* Insights */}
        <View className="rounded-xl border border-silver-200 bg-white p-4">
          <View className="flex-row items-center gap-2">
            <TrendingUp size={20} color="#2C9A4C" />
            <Text className="font-semibold text-navy">Tendência mensal</Text>
          </View>
          <Text className="mt-1 text-sm text-silver-600">+18% vs mês anterior</Text>
          {/* Mini chart placeholder */}
          <View className="mt-3 flex-row items-end gap-1.5 h-24">
            {[40, 55, 48, 70, 65, 82, 75, 90, 88, 95, 100, 110].map((h, i) => (
              <View key={i} className="flex-1 rounded-t-sm bg-gold" style={{ height: `${h * 0.85}%` }} />
            ))}
          </View>
        </View>

        {/* Aprovações pendentes */}
        <View className="rounded-xl border border-silver-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Users size={20} color="#0A2B4E" />
              <Text className="font-semibold text-navy">Aprovações pendentes</Text>
            </View>
            <View className="rounded-full bg-warning/15 px-2 py-0.5">
              <Text className="text-xs font-bold text-warning">8</Text>
            </View>
          </View>
          {['Construtora Aurora', 'Imobiliária Vista Sul', 'Capital + Crédito'].map(p => (
            <View key={p} className="flex-row items-center justify-between border-t border-silver-100 py-2.5">
              <Text className="text-sm text-silver-800">{p}</Text>
              <Text className="text-xs font-medium text-gold-600">Revisar</Text>
            </View>
          ))}
        </View>

        {/* Gargalos */}
        <View className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={20} color="#F0AD4E" />
            <Text className="font-semibold text-warning">Gargalo: Análise Jurídica</Text>
          </View>
          <Text className="mt-1 text-sm text-silver-700">32 propostas paradas há mais de 7 dias</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
