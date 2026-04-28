import { View, Text, FlatList, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Search, Plus } from 'lucide-react-native'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'

const propostas = [
  { id: 'MC-2024-0042', cliente: 'João Silva', valor: 35000000, status: 'Análise de Crédito', produto: 'Home Equity', dias: 5 },
  { id: 'MC-2024-0058', cliente: 'Camila R.', valor: 28000000, status: 'Aguardando assinatura', produto: 'Home Equity', dias: 2 },
  { id: 'MC-2024-0061', cliente: 'Pedro Lima', valor: 62000000, status: 'Análise Jurídica', produto: 'Financiamento', dias: 8 },
  { id: 'MC-2024-0078', cliente: 'Ana Souza', valor: 48000000, status: 'Comitê', produto: 'Construção', dias: 4 },
  { id: 'MC-2024-0083', cliente: 'Lucas P.', valor: 22000000, status: 'Pré-análise', produto: 'Home Equity', dias: 1 },
  { id: 'MC-2024-0091', cliente: 'Fernanda T.', valor: 91000000, status: 'Recurso Liberado', produto: 'Construção', dias: 1 },
]

export default function Propostas() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-white px-5 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-navy">Propostas</Text>
          <Pressable
            onPress={() => router.push('/propostas/nova')}
            className="h-10 w-10 items-center justify-center rounded-full bg-gold"
          >
            <Plus size={20} color="#061B33" />
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center rounded-lg bg-silver-100 px-3 py-2">
          <Search size={18} color="#9CA3AF" />
          <TextInput placeholder="Buscar por nome ou protocolo" className="ml-2 flex-1 text-sm" />
        </View>
      </View>

      <FlatList
        data={propostas}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: p }) => (
          <Pressable
            onPress={() => router.push(`/(parceiro)/propostas/${p.id}`)}
            className="rounded-xl border border-silver-200 bg-white p-4 active:opacity-70"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-xs text-silver-500">{p.id}</Text>
              <StatusBadge status={p.status} />
            </View>
            <Text className="mt-1 font-semibold text-navy">{p.cliente}</Text>
            <Text className="text-xs text-silver-500">{p.produto}</Text>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-base font-bold text-gold-600">{brl(p.valor)}</Text>
              <Text className={`text-xs ${p.dias > 7 ? 'font-semibold text-danger' : 'text-silver-500'}`}>{p.dias}d na etapa</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}
