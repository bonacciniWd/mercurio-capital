import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Download, FileText } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const monthly = [14, 18, 22, 19, 24, 28, 30, 26, 32, 35, 38, 41]
const months = ['J','F','M','A','M','J','J','A','S','O','N','D']
const max = Math.max(...monthly)

const products = [
  { name: 'Home Equity',    pct: 48, color: '#0F0F0F' },
  { name: 'Construção',     pct: 27, color: '#DC2626' },
  { name: 'Financiamento',  pct: 25, color: '#B91C1C' },
]

const funnel = [
  { stage: 'Simulações',  count: 87 },
  { stage: 'Pré-análise', count: 56 },
  { stage: 'Análise',     count: 32 },
  { stage: 'Comitê',      count: 14 },
  { stage: 'Contrato',    count: 8 },
]
const funnelMax = funnel[0].count

const team = [
  { name: 'Mariana', count: 22 },
  { name: 'Carlos',  count: 14 },
  { name: 'Beatriz', count: 9 },
]
const teamMax = team[0].count

const tableRows: [string, number, number, number][] = [
  ['Pré-análise',       8, 32_000_000, 4_000_000],
  ['Análise',           5, 24_500_000, 4_900_000],
  ['Comitê',            3, 18_000_000, 6_000_000],
  ['Recurso liberado',  2,  9_100_000, 4_550_000],
]

export default function Relatorios() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Relatórios</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="flex-row gap-2">
          <ExportBtn icon={Download} label="Excel" />
          <ExportBtn icon={FileText} label="PDF" />
        </View>

        <Card title="Volume mensal (propostas)">
          <View className="mt-2 h-32 flex-row items-end gap-1.5">
            {monthly.map((v, i) => (
              <View key={i} className="flex-1 items-center">
                <View className="w-full rounded-t bg-gold" style={{ height: `${(v / max) * 100}%`, minHeight: 4 }} />
                <Text className="mt-1 text-[10px] text-silver-500">{months[i]}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card title="Funil de conversão">
          {funnel.map((f) => (
            <View key={f.stage} className="mb-2.5">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-xs text-silver-700">{f.stage}</Text>
                <Text className="text-xs font-semibold text-silver-900">{f.count}</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-silver-100">
                <View className="h-full rounded-full bg-navy" style={{ width: `${(f.count / funnelMax) * 100}%` }} />
              </View>
            </View>
          ))}
        </Card>

        <Card title="Por produto">
          {products.map((p) => (
            <View key={p.name} className="mb-2.5">
              <View className="mb-1 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <Text className="text-xs text-silver-700">{p.name}</Text>
                </View>
                <Text className="text-xs font-semibold text-silver-900">{p.pct}%</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-silver-100">
                <View className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
              </View>
            </View>
          ))}
        </Card>

        <Card title="Performance da equipe">
          {team.map((t) => (
            <View key={t.name} className="mb-2.5">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-xs text-silver-700">{t.name}</Text>
                <Text className="text-xs font-semibold text-silver-900">{t.count}</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-silver-100">
                <View className="h-full rounded-full bg-gold" style={{ width: `${(t.count / teamMax) * 100}%` }} />
              </View>
            </View>
          ))}
        </Card>

        <View className="rounded-xl border border-silver-200 bg-white">
          <View className="flex-row border-b border-silver-200 bg-silver-50 px-3 py-2">
            <Text className="flex-[1.4] text-[10px] font-bold uppercase text-silver-500">Status</Text>
            <Text className="flex-1 text-[10px] font-bold uppercase text-silver-500">Qtd</Text>
            <Text className="flex-1 text-[10px] font-bold uppercase text-silver-500">Volume</Text>
            <Text className="flex-1 text-[10px] font-bold uppercase text-silver-500">Ticket</Text>
          </View>
          {tableRows.map(([s, q, v, t]) => (
            <View key={s} className="flex-row border-t border-silver-100 px-3 py-3">
              <Text className="flex-[1.4] text-xs text-silver-800">{s}</Text>
              <Text className="flex-1 text-xs text-silver-700">{q}</Text>
              <Text className="flex-1 text-xs font-semibold text-silver-900">{brl(v)}</Text>
              <Text className="flex-1 text-xs text-silver-700">{brl(t)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <View className="rounded-xl border border-silver-200 bg-white p-4">
      <Text className="font-semibold text-silver-900">{title}</Text>
      <View className="mt-2">{children}</View>
    </View>
  )
}

function ExportBtn({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <Pressable className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-silver-300 bg-white py-2.5 active:bg-silver-100">
      <Icon size={14} color="#0F0F0F" />
      <Text className="text-xs font-bold text-navy">{label}</Text>
    </Pressable>
  )
}
