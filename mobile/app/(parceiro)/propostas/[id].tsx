import { useState } from 'react'
import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { ArrowLeft, FileText, Users, Home, Clock, MessageSquare } from 'lucide-react-native'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: FileText },
  { id: 'proponentes', label: 'Proponentes', icon: Users },
  { id: 'imoveis', label: 'Imóveis', icon: Home },
  { id: 'docs', label: 'Documentos', icon: FileText },
  { id: 'historico', label: 'Histórico', icon: Clock },
] as const

export default function PropostaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [tab, setTab] = useState<typeof TABS[number]['id']>('resumo')

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-white px-5 pb-3 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="#0A2B4E" />
          </Pressable>
          <View className="flex-1">
            <Text className="font-mono text-xs text-silver-500">{id}</Text>
            <Text className="text-lg font-bold text-navy">João Silva</Text>
          </View>
          <StatusBadge status="Análise de Crédito" />
        </View>
      </View>

      {/* Tabs scrolláveis */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-white border-b border-silver-200">
        <View className="flex-row px-3">
          {TABS.map(t => (
            <Pressable key={t.id} onPress={() => setTab(t.id)}
              className={`flex-row items-center gap-1.5 border-b-2 px-4 py-3 ${tab === t.id ? 'border-gold' : 'border-transparent'}`}>
              <t.icon size={16} color={tab === t.id ? '#D4AF37' : '#9CA3AF'} />
              <Text className={tab === t.id ? 'text-sm font-semibold text-gold-600' : 'text-sm text-silver-500'}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === 'resumo' && <Resumo />}
        {tab === 'proponentes' && <Placeholder label="Proponentes" />}
        {tab === 'imoveis' && <Placeholder label="Imóveis" />}
        {tab === 'docs' && <Placeholder label="Documentos" />}
        {tab === 'historico' && <Placeholder label="Histórico" />}
      </ScrollView>

      {/* Bottom action */}
      <View className="flex-row gap-2 border-t border-silver-200 bg-white px-4 py-3">
        <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-3">
          <MessageSquare size={18} color="#0A2B4E" />
          <Text className="font-semibold text-navy">Mensagem</Text>
        </Pressable>
        <Pressable className="flex-1 items-center rounded-lg bg-gold py-3">
          <Text className="font-bold text-navy-900">Avançar etapa</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function Resumo() {
  return (
    <>
      <Card title="Crédito">
        <Row label="Valor solicitado" value={brl(35000000)} />
        <Row label="Prazo" value="180 meses" />
        <Row label="Taxa" value="1,15% a.m." />
        <Row label="LTV" value="48%" />
      </Card>
      <Card title="Imóvel garantia">
        <Row label="Endereço" value="Av. Paulista, 1234 — SP" />
        <Row label="Valor avaliação" value={brl(72500000)} />
      </Card>
      <Card title="Proponente">
        <Row label="Nome" value="João Silva" />
        <Row label="CPF" value="123.456.789-00" />
        <Row label="Renda" value={brl(2500000)} />
      </Card>
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-silver-200 bg-white p-4">
      <Text className="mb-3 text-xs uppercase tracking-wider text-silver-500">{title}</Text>
      {children}
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between border-t border-silver-100 py-2 first:border-t-0">
      <Text className="text-sm text-silver-600">{label}</Text>
      <Text className="text-sm font-semibold text-silver-900">{value}</Text>
    </View>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <View className="items-center rounded-xl border border-dashed border-silver-300 bg-white p-12">
      <Text className="text-sm text-silver-500">{label} — em desenvolvimento</Text>
    </View>
  )
}
