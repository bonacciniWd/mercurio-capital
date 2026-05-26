import { useState } from 'react'
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Search, Plus } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { STATUS_LABEL, PRODUTO_LABEL, diasParado } from '@/lib/partner'

interface PropostaRow {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  updated_at: string
  cliente: { nome_completo: string | null; cpf: string | null } | null
}

export default function Propostas() {
  const [busca, setBusca] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['partner-propostas-list'],
    queryFn: async (): Promise<PropostaRow[]> => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, updated_at, cliente:clientes(nome_completo, cpf)')
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as PropostaRow[]
    },
  })

  const rows = (data ?? []).filter(p => {
    if (!busca) return true
    const q = busca.toLowerCase()
    const nome = p.cliente?.nome_completo?.toLowerCase() ?? ''
    const cpf = p.cliente?.cpf ?? ''
    const prot = (p.protocolo ?? '').toLowerCase()
    return nome.includes(q) || cpf.includes(busca) || prot.includes(q)
  })

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <View className="bg-navy-700 px-5 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Propostas</Text>
          <Pressable
            onPress={() => router.push('/propostas/nova')}
            className="h-10 w-10 items-center justify-center rounded-full bg-gold"
          >
            <Plus size={20} color="#FFF" />
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center rounded-lg bg-silver-100 px-3 py-2">
          <Search size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Buscar por nome, CPF ou protocolo"
            value={busca}
            onChangeText={setBusca}
            className="ml-2 flex-1 text-sm"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-danger">
            Erro ao carregar: {(error as Error).message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 130 }}
          ListEmptyComponent={
            <View className="rounded-xl border border-silver-200 bg-white p-8">
              <Text className="text-center text-sm text-silver-500">
                {(data?.length ?? 0) === 0
                  ? 'Nenhuma proposta ainda — crie a primeira!'
                  : 'Nenhum resultado para a busca.'}
              </Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const dias = diasParado(p.updated_at)
            return (
              <Pressable
                onPress={() => router.push(`/(parceiro)/propostas/${p.id}`)}
                className="rounded-xl border border-silver-200 bg-white p-4 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-xs text-silver-500">
                    {p.protocolo ?? p.id.slice(0, 8)}
                  </Text>
                  <StatusBadge status={STATUS_LABEL[p.status] ?? p.status} />
                </View>
                <Text className="mt-1 font-semibold text-navy">
                  {p.cliente?.nome_completo ?? '—'}
                </Text>
                <Text className="text-xs text-silver-500">
                  {PRODUTO_LABEL[p.produto] ?? p.produto}
                </Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-base font-bold text-gold-600">
                    {brl(Number(p.valor_solicitado) * 100)}
                  </Text>
                  <Text className={`text-xs ${dias > 7 ? 'font-semibold text-danger' : 'text-silver-500'}`}>
                    {dias}d na etapa
                  </Text>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}
