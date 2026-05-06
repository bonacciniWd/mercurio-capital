import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Play, CheckCircle2, ArrowRight, Download } from 'lucide-react-native'
import { useState } from 'react'

const modules = [
  { name: 'Módulo 1 · Introdução',       lessons: ['O que é Home Equity', 'Quando usar', 'Comparativo de produtos'] },
  { name: 'Módulo 2 · Análise de risco', lessons: ['Garantia fiduciária', 'LTV e capacidade de pagamento', 'Score e bureaus'] },
  { name: 'Módulo 3 · Esteira',          lessons: ['Documentação', 'Comitê de crédito', 'Registro em cartório'] },
]

const tabs = ['Conteúdo', 'Recursos', 'Notas'] as const
type Tab = typeof tabs[number]

export default function AulaPlayer() {
  useLocalSearchParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('Conteúdo')
  const active = { mod: 1, lesson: 1 }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Universidade</Text>
            <Text className="text-base font-bold text-white" numberOfLines={1}>LTV e capacidade de pagamento</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Player */}
        <View className="aspect-video items-center justify-center bg-black">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Play size={32} color="white" fill="white" />
          </View>
        </View>

        <View className="px-4 pt-4">
          <Text className="text-xl font-bold text-navy">LTV e capacidade de pagamento</Text>
          <Text className="text-xs text-silver-500">Módulo 2 · Aula 2 · 18 min</Text>
        </View>

        {/* Tabs */}
        <View className="mt-4 flex-row border-b border-silver-200 px-2">
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} className="px-3 py-2.5">
              <Text className={`text-sm font-semibold ${tab === t ? 'text-navy' : 'text-silver-500'}`}>{t}</Text>
              {tab === t && <View className="mt-1.5 h-0.5 rounded-full bg-gold" />}
            </Pressable>
          ))}
        </View>

        <View className="px-4 pt-4">
          {tab === 'Conteúdo' && (
            <Text className="text-sm leading-relaxed text-silver-700">
              Nesta aula você vai entender como calcular o LTV (Loan to Value) e a capacidade de pagamento do
              proponente, dois fatores decisivos na aprovação de crédito imobiliário. Tópicos: ratios mínimos
              por produto, casos de exceção e fundamentos da Resolução 4.676.
            </Text>
          )}
          {tab === 'Recursos' && (
            <View className="gap-2">
              {[
                'Planilha de cálculo de LTV.xlsx',
                'Resolução 4.676 — BACEN.pdf',
              ].map((f) => (
                <Pressable key={f} className="flex-row items-center justify-between rounded-lg bg-white p-3 border border-silver-200">
                  <Text className="text-sm text-silver-800">📄 {f}</Text>
                  <Download size={16} color="#991B1B" />
                </Pressable>
              ))}
            </View>
          )}
          {tab === 'Notas' && (
            <View className="rounded-lg border border-silver-200 bg-white p-3">
              <Text className="text-sm text-silver-400">Suas anotações... (auto-salva)</Text>
            </View>
          )}
        </View>

        {/* Curso / playlist */}
        <View className="mx-4 mt-5 overflow-hidden rounded-xl border border-silver-200 bg-white">
          <View className="border-b border-silver-200 p-4">
            <Text className="text-[11px] uppercase tracking-wider text-silver-500">Curso</Text>
            <Text className="font-semibold text-navy">Fundamentos do Home Equity</Text>
            <View className="mt-2 h-1 overflow-hidden rounded-full bg-silver-200">
              <View className="h-full bg-gold" style={{ width: '40%' }} />
            </View>
            <Text className="mt-1 text-[11px] text-silver-500">8 / 18 aulas</Text>
          </View>

          {modules.map((m, i) => (
            <View key={m.name}>
              <View className="border-y border-silver-100 bg-silver-50 px-4 py-2.5">
                <Text className="text-sm font-semibold text-silver-800">{m.name}</Text>
              </View>
              {m.lessons.map((l, j) => {
                const isActive = i === active.mod && j === active.lesson
                const done = i < active.mod || (i === active.mod && j < active.lesson)
                return (
                  <View
                    key={l}
                    className={`flex-row items-center gap-2 px-4 py-2.5 ${isActive ? 'bg-gold/10' : ''}`}
                    style={isActive ? { borderLeftWidth: 2, borderLeftColor: '#DC2626' } : undefined}
                  >
                    {done
                      ? <CheckCircle2 size={16} color="#16A34A" />
                      : <Play size={16} color={isActive ? '#DC2626' : '#CBD5E1'} fill={isActive ? '#DC2626' : 'none'} />}
                    <Text className={`flex-1 text-sm ${isActive ? 'font-semibold text-navy' : 'text-silver-700'}`}>{l}</Text>
                    <Text className="text-[11px] text-silver-400">12 min</Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>

        <View className="m-4 flex-row items-center justify-between rounded-lg border border-success/30 bg-success/5 p-4">
          <Text className="flex-1 text-sm font-medium text-success">✓ Aula concluída! Próxima: Score e bureaus</Text>
          <Pressable className="flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2 active:opacity-80">
            <Text className="text-xs font-bold text-navy">Continuar</Text>
            <ArrowRight size={14} color="#0F0F0F" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
