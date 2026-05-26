import { useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Search } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { StatusBadge } from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import { STATUS_LABEL, PRODUTO_LABEL } from '@/lib/partner'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'

interface SimRow {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  amortizacao: 'price' | 'sac'
  created_at: string
  cliente: { nome_completo: string | null; cpf: string | null } | null
}

function ltvTone(v: number) {
  if (v <= 60) return { bg: '#16A34A20', tx: '#16A34A' }
  if (v <= 70) return { bg: '#F59E0B22', tx: '#B45309' }
  return { bg: '#DC262620', tx: '#DC2626' }
}

export default function Simulacoes() {
  const [busca, setBusca] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['p-simulacoes'],
    queryFn: async (): Promise<SimRow[]> => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, carencia_meses, taxa_juros_mensal, amortizacao, created_at, cliente:clientes(nome_completo, cpf)')
        .in('status', ['simulacao', 'pre_analise', 'analise_credito'])
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as SimRow[]
    },
  })

  const sims = (data ?? []).filter(s => {
    if (!busca) return true
    const q = busca.toLowerCase()
    const nome = s.cliente?.nome_completo?.toLowerCase() ?? ''
    return nome.includes(q) || (s.cliente?.cpf ?? '').includes(busca)
  })

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
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
            value={busca}
            onChangeText={setBusca}
            className="flex-1 px-2 py-2.5 text-sm text-silver-900"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        {isLoading ? (
          <ActivityIndicator color="#DC2626" />
        ) : sims.length === 0 ? (
          <View className="rounded-xl border border-silver-200 bg-white p-8">
            <Text className="text-center text-sm text-silver-500">Nenhuma simulação encontrada.</Text>
          </View>
        ) : sims.map(s => {
          const valor = Number(s.valor_solicitado)
          const valorImovel = Number(s.valor_imoveis_total)
          const ltvFrac = calcularLTV(valor, valorImovel)
          const ltv = Math.round(ltvFrac * 100)
          const calc = calcularFinanciamento({
            valor,
            prazoMeses: s.prazo_meses,
            taxaMensal: Number(s.taxa_juros_mensal) / 100,
            amortizacao: s.amortizacao,
            carenciaMeses: s.carencia_meses,
          })
          const ltvCol = ltvTone(ltv)
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/(parceiro)/propostas/${s.id}` as any)}
              className="rounded-xl border border-silver-200 bg-white p-4 active:opacity-70"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-silver-500">
                  {new Date(s.created_at).toLocaleDateString('pt-BR')} · {PRODUTO_LABEL[s.produto] ?? s.produto}
                </Text>
                <StatusBadge status={STATUS_LABEL[s.status] ?? s.status} />
              </View>
              <Text className="mt-1 text-base font-semibold text-silver-900">
                {s.cliente?.nome_completo ?? '—'}
              </Text>

              <View className="mt-3 flex-row items-end justify-between">
                <View>
                  <Text className="text-[11px] text-silver-500">Crédito</Text>
                  <Text className="text-base font-bold text-navy">{brl(valor * 100)}</Text>
                </View>
                <View>
                  <Text className="text-[11px] text-silver-500">Parcela</Text>
                  <Text className="text-sm font-semibold text-silver-800">
                    {brl(calc.primeiraParcela * 100)}
                  </Text>
                </View>
                <View className="items-center rounded-full px-2 py-0.5" style={{ backgroundColor: ltvCol.bg }}>
                  <Text className="text-[11px] font-bold" style={{ color: ltvCol.tx }}>LTV {ltv}%</Text>
                </View>
              </View>
            </Pressable>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
