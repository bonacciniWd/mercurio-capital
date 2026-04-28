import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Bell, Plus, TrendingUp, AlertCircle } from 'lucide-react-native'
import { KPICard } from '@/components/KPICard'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'

const propostas = [
  { id: 'MC-2024-0042', cliente: 'João Silva', valor: 35000000, status: 'Análise de Crédito' },
  { id: 'MC-2024-0083', cliente: 'Lucas P.', valor: 22000000, status: 'Pré-análise' },
  { id: 'MC-2024-0078', cliente: 'Ana Souza', valor: 48000000, status: 'Comitê' },
]

export default function Dashboard() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-navy-700 px-5 py-4">
        <View>
          <Text className="text-xs text-white/60">Olá,</Text>
          <Text className="text-lg font-bold text-white">João Roberto</Text>
        </View>
        <Pressable className="relative">
          <Bell size={24} color="white" />
          <View className="absolute right-0 top-0 h-2 w-2 rounded-full bg-danger" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
        {/* Saldo carteira */}
        <View className="rounded-xl bg-navy-700 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-white/70">Saldo na carteira</Text>
            <Pressable onPress={() => router.push('/(parceiro)/carteira')}>
              <Text className="text-xs font-medium text-gold">Ver extrato →</Text>
            </Pressable>
          </View>
          <Text className="mt-1 text-3xl font-bold text-gold">R$ 1.250,00</Text>
          <Pressable className="mt-3 self-start rounded-lg bg-gold px-4 py-2">
            <Text className="text-sm font-bold text-navy-900">Recarregar</Text>
          </Pressable>
        </View>

        {/* KPIs */}
        <View className="flex-row gap-3">
          <KPICard label="Propostas ativas" value="12" />
          <KPICard label="Em análise" value={brl(3500000000)} intent="gold" />
        </View>
        <View className="flex-row gap-3">
          <KPICard label="Aprovadas/mês" value="3" intent="success" />
          <KPICard label="Pendências" value="4" intent="warning" />
        </View>

        {/* CTA nova proposta */}
        <Pressable
          onPress={() => router.push('/propostas/nova')}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-gold py-4"
        >
          <Plus size={20} color="#061B33" />
          <Text className="text-base font-bold text-navy-900">Nova proposta</Text>
        </Pressable>

        {/* Pendências */}
        <View className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <View className="flex-row items-center gap-2">
            <AlertCircle size={18} color="#F0AD4E" />
            <Text className="font-semibold text-warning">3 pendências precisam de ação</Text>
          </View>
          <Text className="mt-1 text-xs text-silver-700">Documentos faltando em propostas ativas.</Text>
        </View>

        {/* Lista propostas recentes */}
        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-bold text-navy">Propostas recentes</Text>
            <Pressable onPress={() => router.push('/(parceiro)/propostas')}>
              <Text className="text-xs font-medium text-gold-600">Ver todas →</Text>
            </Pressable>
          </View>
          <View className="gap-2">
            {propostas.map(p => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/(parceiro)/propostas/${p.id}`)}
                className="rounded-xl border border-silver-200 bg-white p-4 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-xs text-silver-500">{p.id}</Text>
                  <StatusBadge status={p.status} />
                </View>
                <Text className="mt-1 font-semibold text-navy">{p.cliente}</Text>
                <Text className="text-sm font-bold text-gold-600">{brl(p.valor)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Marco / Milestone */}
        <View className="rounded-xl bg-gold/10 p-4">
          <View className="flex-row items-center gap-2">
            <TrendingUp size={18} color="#B8962B" />
            <Text className="font-semibold text-gold-600">Marco do mês</Text>
          </View>
          <Text className="mt-1 text-sm text-silver-800">Faltam <Text className="font-bold">R$ 250.000</Text> em volume para atingir a meta de abril.</Text>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-silver-200">
            <View className="h-full w-3/4 rounded-full bg-gold" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
