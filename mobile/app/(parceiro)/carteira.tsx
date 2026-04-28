import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowDown, ArrowUp, RotateCcw, Plus } from 'lucide-react-native'
import { Badge } from '@/components/Badge'
import { brl } from '@/lib/utils'

const extrato = [
  { id: 1, type: 'in', desc: 'Recarga Stripe', date: '12/04 14:32', amount: 50000 },
  { id: 2, type: 'out', desc: 'Consulta Serasa PF · MC-2024-0042', date: '12/04 14:28', amount: 490 },
  { id: 3, type: 'out', desc: 'Consulta Bacen · MC-2024-0042', date: '12/04 14:27', amount: 250 },
  { id: 4, type: 'refund', desc: 'Estorno consulta falhada', date: '11/04 09:15', amount: 490 },
  { id: 5, type: 'in', desc: 'Recarga Stripe', date: '08/04 11:00', amount: 100000 },
] as const

export default function Carteira() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Saldo card gradiente navy */}
        <View className="bg-navy-700 px-5 pb-6 pt-4">
          <Text className="text-xs text-white/70">Saldo disponível</Text>
          <Text className="mt-1 text-4xl font-bold text-gold">R$ 1.250,00</Text>
          <Text className="mt-1 text-xs text-white/60">Atualizado agora há pouco</Text>

          <View className="mt-4 flex-row gap-2">
            <Pressable className="flex-1 items-center rounded-lg bg-gold py-3">
              <Text className="font-bold text-navy-900">Recarregar</Text>
            </Pressable>
            <Pressable className="flex-1 items-center rounded-lg border border-white/30 py-3">
              <Text className="font-semibold text-white">Histórico</Text>
            </Pressable>
          </View>
        </View>

        {/* Recarga rápida */}
        <View className="px-5 py-4">
          <Text className="text-base font-bold text-navy">Recarga rápida</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {[5000, 10000, 25000, 50000, 100000].map(v => (
              <Pressable key={v} className="rounded-full border border-silver-300 bg-white px-4 py-2">
                <Text className="text-sm font-semibold text-navy">{brl(v)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Preços */}
        <View className="px-5">
          <Text className="text-base font-bold text-navy">Preços de consulta</Text>
          <View className="mt-2 rounded-xl border border-silver-200 bg-white">
            {[
              ['Serasa PF', 490], ['Serasa PJ', 790], ['Bacen', 250], ['Jusbrasil', 500], ['RI Digital', 990],
            ].map(([t, p]) => (
              <View key={t as string} className="flex-row justify-between border-b border-silver-100 px-4 py-3 last:border-b-0">
                <Text className="text-sm text-silver-700">{t}</Text>
                <Text className="text-sm font-semibold text-navy">{brl(p as number)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Extrato */}
        <View className="px-5 pt-4">
          <Text className="text-base font-bold text-navy">Extrato</Text>
          <View className="mt-2 gap-2">
            {extrato.map(e => (
              <View key={e.id} className="flex-row items-center gap-3 rounded-xl border border-silver-200 bg-white p-3">
                <View className={`h-9 w-9 items-center justify-center rounded-full ${
                  e.type === 'in' ? 'bg-success/15' : e.type === 'refund' ? 'bg-warning/15' : 'bg-silver-100'
                }`}>
                  {e.type === 'in' && <ArrowDown size={18} color="#2C9A4C" />}
                  {e.type === 'out' && <ArrowUp size={18} color="#495057" />}
                  {e.type === 'refund' && <RotateCcw size={18} color="#F0AD4E" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-silver-900">{e.desc}</Text>
                  <Text className="text-xs text-silver-500">{e.date}</Text>
                </View>
                <Text className={`font-bold ${e.type === 'out' ? 'text-silver-700' : 'text-success'}`}>
                  {e.type === 'out' ? '-' : '+'}{brl(e.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
