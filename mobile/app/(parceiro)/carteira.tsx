import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, Image, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Resumo {
  wallet_id: string
  partner_id: string
  saldo_centavos: number
  moeda: string
  bloqueada: boolean
  motivo_bloqueio: string | null
  limite_diario_centavos: number | null
  creditos_30d: number
  debitos_30d: number
  ultima_movimentacao: string | null
}

interface Extrato {
  id: string
  tipo: string
  valor_centavos: number
  saldo_depois: number
  descricao: string | null
  criado_por_nome: string | null
  created_at: string
}

interface Preco {
  id: string
  tipo: string
  preco_centavos: number
  descricao: string | null
}

const TIPO_META: Record<string, { tone: 'in' | 'out' | 'refund' }> = {
  recarga:         { tone: 'in' },
  estorno:         { tone: 'refund' },
  ajuste_credito:  { tone: 'in' },
  debito_consulta: { tone: 'out' },
  ajuste_debito:   { tone: 'out' },
  tarifa:          { tone: 'out' },
}

const PRECO_LABEL: Record<string, string> = {
  bacen_cpf: 'Bacen CPF',
  bacen_cnpj: 'Bacen CNPJ',
  serasa_pf: 'Serasa PF',
  serasa_pj: 'Serasa PJ',
  jusbrasil_cnpj: 'Jusbrasil CNPJ',
  escavador_cnpj: 'Escavador CNPJ',
  ri_digital_matricula: 'RI Digital · matrícula',
  nacional_consultas_bens: 'Nacional · bens',
  nacional_consultas_certidao: 'Nacional · certidão',
}

const QUICK_VALUES = [2500, 5000, 7500, 10000, 25000, 50000, 100000]

export default function Carteira() {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const resumoQuery = useQuery({
    queryKey: ['wallet-resumo-carteira'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_wallet_summary')
      if (error) throw error
      const rows = (data ?? []) as Resumo[]
      return rows[0] ?? null
    },
  })

  const extratoQuery = useQuery({
    queryKey: ['wallet-extrato'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_wallet_extrato')
        .select('id, tipo, valor_centavos, saldo_depois, descricao, criado_por_nome, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Extrato[]
    },
  })

  const precosQuery = useQuery({
    queryKey: ['wallet-precos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_consulta')
        .select('id, tipo, preco_centavos, descricao')
        .is('vigente_ate', null)
        .order('tipo')
      if (error) throw error
      return (data ?? []) as Preco[]
    },
  })

  const recarregar = useMutation({
    mutationFn: async (centavos: number) => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) throw new Error('Sessão expirada')
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      const res = await fetch(`${baseUrl}/functions/v1/wallet-topup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ valor_centavos: centavos }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'falha_topup')
      return json as { checkout_url: string; dev_mode?: boolean }
    },
    onSuccess: async (data) => {
      if (data.dev_mode) {
        setErro('Stripe não configurado. Solicite ao admin um crédito manual.')
        await qc.invalidateQueries({ queryKey: ['wallet-extrato'] })
        return
      }
      await WebBrowser.openBrowserAsync(data.checkout_url)
      await qc.invalidateQueries({ queryKey: ['wallet-resumo-carteira'] })
      await qc.invalidateQueries({ queryKey: ['wallet-extrato'] })
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'erro'),
  })

  function onRecarregar(centavos: number) {
    setErro(null)
    if (centavos < 2000) {
      Alert.alert('Valor mínimo', 'Recarga mínima: R$ 20,00')
      return
    }
    recarregar.mutate(centavos)
  }

  const resumo = resumoQuery.data
  const saldo = resumo?.saldo_centavos ?? 0
  const bloqueada = resumo?.bloqueada ?? false
  const extrato = extratoQuery.data ?? []
  const precos = precosQuery.data ?? []

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Saldo card */}
        <View className="bg-navy-700 px-5 pb-6 pt-4">
          <Text className="text-xs text-white/70">Saldo disponível</Text>
          <Text className="mt-1 text-4xl font-bold text-[#FFD700]">
            {resumoQuery.isLoading ? '—' : brl(saldo)}
          </Text>
          <Text className="mt-1 text-xs text-white/60">
            {resumo?.ultima_movimentacao
              ? `Última: ${new Date(resumo.ultima_movimentacao).toLocaleString('pt-BR')}`
              : 'Sem movimentações'}
          </Text>
          <Image
            source={require('../../assets/cardwallet.png')}
            className="absolute right-10 top-4 h-28 w-28 flex-1 rounded-lg"
            resizeMode="cover"
          />
          {bloqueada && (
            <View className="mt-3 rounded-lg bg-danger/20 p-2">
              <Text className="text-xs font-semibold text-white">
                Carteira bloqueada: {resumo?.motivo_bloqueio ?? 'procure o admin.'}
              </Text>
            </View>
          )}
          <View className="mt-4 flex-row gap-3 border-t border-white/10 pt-4">
            <View className="flex-1">
              <Text className="text-[11px] text-white/60">Créditos (30d)</Text>
              <Text className="font-bold text-success">+ {brl(Number(resumo?.creditos_30d ?? 0))}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-white/60">Débitos (30d)</Text>
              <Text className="font-bold text-danger">- {brl(Number(resumo?.debitos_30d ?? 0))}</Text>
            </View>
          </View>
        </View>

        {/* Recarga rápida */}
        <View className="px-5 py-4">
          <Text className="text-base font-bold text-navy">Recarga rápida</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {QUICK_VALUES.map(v => (
              <Pressable
                key={v}
                onPress={() => onRecarregar(v)}
                disabled={bloqueada || recarregar.isPending}
                className="rounded-full border border-silver-300 bg-white px-4 py-2 active:opacity-70"
                style={{ opacity: bloqueada ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-navy">{brl(v)}</Text>
              </Pressable>
            ))}
          </View>
          {recarregar.isPending && (
            <View className="mt-2 flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#DC2626" />
              <Text className="text-xs text-silver-600">Gerando checkout…</Text>
            </View>
          )}
          {erro && <Text className="mt-2 text-xs text-danger">{erro}</Text>}
        </View>

        {/* Preços */}
        <View className="px-5">
          <Text className="text-base font-bold text-navy">Preços de consulta</Text>
          <View className="mt-2 rounded-xl border border-silver-200 bg-white">
            {precosQuery.isLoading ? (
              <ActivityIndicator color="#DC2626" style={{ padding: 16 }} />
            ) : precos.length === 0 ? (
              <Text className="p-4 text-center text-sm text-silver-500">Sem preços cadastrados.</Text>
            ) : (
              precos.map(p => (
                <View key={p.id} className="flex-row justify-between border-b border-silver-100 px-4 py-3 last:border-b-0">
                  <Text className="text-sm text-silver-700">{PRECO_LABEL[p.tipo] ?? p.tipo}</Text>
                  <Text className="text-sm font-semibold text-navy">{brl(p.preco_centavos)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Extrato */}
        <View className="px-5 pt-4">
          <Text className="text-base font-bold text-navy">Extrato</Text>
          <View className="mt-2 gap-2">
            {extratoQuery.isLoading ? (
              <ActivityIndicator color="#DC2626" />
            ) : extrato.length === 0 ? (
              <View className="rounded-xl border border-silver-200 bg-white p-6">
                <Text className="text-center text-sm text-silver-500">Nenhuma movimentação ainda.</Text>
              </View>
            ) : extrato.map(e => {
              const tone = TIPO_META[e.tipo]?.tone ?? 'out'
              return (
                <View key={e.id} className="flex-row items-center gap-3 rounded-xl border border-silver-200 bg-white p-3">
                  <View className={`h-9 w-9 items-center justify-center rounded-full ${
                    tone === 'in' ? 'bg-success/15' : tone === 'refund' ? 'bg-warning/15' : 'bg-silver-100'
                  }`}>
                    {tone === 'in' && <ArrowDown size={18} color="#16A34A" />}
                    {tone === 'out' && <ArrowUp size={18} color="#495057" />}
                    {tone === 'refund' && <RotateCcw size={18} color="#F59E0B" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-silver-900" numberOfLines={1}>
                      {e.descricao ?? e.tipo}
                    </Text>
                    <Text className="text-xs text-silver-500">
                      {new Date(e.created_at).toLocaleString('pt-BR')}
                    </Text>
                  </View>
                  <Text className={`font-bold ${tone === 'out' ? 'text-silver-700' : 'text-success'}`}>
                    {tone === 'out' ? '-' : '+'}{brl(e.valor_centavos)}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
