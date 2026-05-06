import { ScrollView, View, Text, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Search, ArrowRightCircle } from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { StatusBadge } from '@/components/Badge'

const sims = [
  { id: 1, data: '12/04', cliente: 'João Silva',  produto: 'Home Equity',     credito: 35000000, ltv: 41, parcela: 423000, status: 'Convertida em Proposta' },
  { id: 2, data: '11/04', cliente: 'Beatriz N.',  produto: 'Construção',      credito: 48000000, ltv: 53, parcela: 461000, status: 'Rascunho' },
  { id: 3, data: '10/04', cliente: 'Carlos M.',   produto: 'Financiamento',   credito: 62000000, ltv: 65, parcela: 558000, status: 'Rascunho' },
  { id: 4, data: '09/04', cliente: 'Renata P.',   produto: 'Home Equity',     credito: 28000000, ltv: 38, parcela: 339000, status: 'Convertida em Proposta' },
  { id: 5, data: '08/04', cliente: 'Pedro A.',    produto: 'Home Equity',     credito: 45000000, ltv: 58, parcela: 544000, status: 'Rascunho' },
]

function ltvTone(v: number) {
  if (v <= 60) return { bg: '#16A34A20', tx: '#16A34A' }
  if (v <= 70) return { bg: '#F59E0B22', tx: '#B45309' }
  return { bg: '#DC262620', tx: '#DC2626' }
}

export default function Simulacoes() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Simulações</Text>
          </View>
          <Pressable
            onPress={() => router.push('/propostas/nova' as any)}
            className="flex-row items-center gap-1 rounded-full bg-gold px-3 py-2 active:opacity-80"
          >
            <Plus size={16} color="#FFF" />
            <Text className="text-xs font-bold text-white">Nova</Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 pt-4">
        <View className="flex-row items-center rounded-xl border border-silver-200 bg-white px-3">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            placeholder="Buscar por cliente ou CPF"
            placeholderTextColor="#9CA3AF"
            className="flex-1 px-2 py-2.5 text-sm text-silver-900"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        {sims.map((s) => {
          const ltv = ltvTone(s.ltv)
          return (
            <View key={s.id} className="rounded-xl border border-silver-200 bg-white p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-silver-500">{s.data}/2026 · {s.produto}</Text>
                <StatusBadge status={s.status} />
              </View>
              <Text className="mt-1 text-base font-semibold text-silver-900">{s.cliente}</Text>

              <View className="mt-3 flex-row items-end justify-between">
                <View>
                  <Text className="text-[11px] text-silver-500">Crédito</Text>
                  <Text className="text-base font-bold text-navy">{brl(s.credito)}</Text>
                </View>
                <View>
                  <Text className="text-[11px] text-silver-500">Parcela</Text>
                  <Text className="text-sm font-semibold text-silver-800">{brl(s.parcela)}</Text>
                </View>
                <View className="items-center rounded-full px-2 py-0.5" style={{ backgroundColor: ltv.bg }}>
                  <Text className="text-[11px] font-bold" style={{ color: ltv.tx }}>LTV {s.ltv}%</Text>
                </View>
              </View>

              {s.status === 'Rascunho' && (
                <Pressable className="mt-3 flex-row items-center justify-center gap-1.5 rounded-lg border border-gold py-2 active:bg-gold/10">
                  <ArrowRightCircle size={14} color="#991B1B" />
                  <Text className="text-xs font-bold text-gold">Converter em proposta</Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
