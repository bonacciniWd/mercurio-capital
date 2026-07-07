import { ScrollView, View, Text, Pressable, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Plus, TrendingUp, AlertCircle } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { KPICard } from '@/components/KPICard'
import { StatusBadge } from '@/components/Badge'
import { NotificationsSheet } from '@/components/NotificationsSheet'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  usePartnerProfile,
  partnerDisplayName,
  STATUS_LABEL,
  formatRelative,
} from '@/lib/partner'

interface KpiRow {
  partner_id: string
  total_propostas: number
  propostas_mes: number
  propostas_30d: number
  ativas: number
  ganhas: number
  canceladas: number
  taxa_conversao: number
  volume_ganho: number
  ticket_medio_ganho: number
  volume_total: number
}

interface PropostaRecente {
  id: string
  protocolo: string | null
  status: string
  valor_solicitado: number
  updated_at: string
  cliente: { nome_completo: string | null } | null
}

interface WalletResumo {
  saldo_centavos: number
  bloqueada: boolean
}

export default function Dashboard() {
  const profileQ = usePartnerProfile()

  const kpiQuery = useQuery({
    queryKey: ['p-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_dashboard_kpis')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })

  const recentesQuery = useQuery({
    queryKey: ['p-propostas-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, status, valor_solicitado, updated_at, cliente:clientes(nome_completo)')
        .order('updated_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return (data ?? []) as unknown as PropostaRecente[]
    },
  })

  const walletQuery = useQuery({
    queryKey: ['wallet-resumo-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_wallet_summary')
      if (error) throw error
      const rows = (data ?? []) as WalletResumo[]
      return rows[0] ?? null
    },
  })

  const kpi = kpiQuery.data
  const saldo = walletQuery.data?.saldo_centavos ?? 0
  const nome = partnerDisplayName(profileQ.data)
  const propostas = recentesQuery.data ?? []

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-navy-700 px-5 py-4">
        <View className="flex-1 pr-3">
          <Text className="text-xs text-white/60">Olá,</Text>
          <Text className="text-lg font-bold text-white" numberOfLines={1}>
            {profileQ.isLoading ? '...' : nome}
          </Text>
        </View>
        <NotificationsSheet
          variant="dark"
          iconSize={24}
          onOpenLink={(route) => router.push(route as any)}
        />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 16, paddingBottom: 130, gap: 16 }}>
        {/* Saldo carteira */}
        <View className="rounded-xl bg-slate-950 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-white/70">Saldo na carteira</Text>
            <Pressable onPress={() => router.push('/(parceiro)/carteira')}>
              <Text className="text-xs font-medium text-white">Ver extrato →</Text>
            </Pressable>
          </View>
          <Image
            source={require('../../assets/cardwallet.png')}
            className="absolute -bottom-4 -right-2"
            style={{ width: 100, height: 100 }}
          />
          <Text className="mt-1 text-3xl font-bold text-[#FFF]">
            {walletQuery.isLoading ? '—' : brl(saldo)}
          </Text>
          <Pressable
            onPress={() => router.push('/(parceiro)/carteira')}
            className="mt-3 self-start rounded-lg bg-gold px-4 py-2"
          >
            <Text className="text-sm font-bold text-white">Recarregar</Text>
          </Pressable>
        </View>

        {/* KPIs */}
        {kpiQuery.isLoading ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <>
            <View className="flex-row gap-3">
              <KPICard label="Propostas ativas" value={String(kpi?.ativas ?? 0)} bg="bg-slate-950" />
              <KPICard label="Volume ganho" value={brl(Number(kpi?.volume_ganho ?? 0) * 100)} bg="bg-slate-950" />
            </View>
            <View className="flex-row gap-3">
              <KPICard label="Ganhas (acum.)" value={String(kpi?.ganhas ?? 0)} bg="bg-slate-950" />
              <KPICard label="Conversão" value={`${kpi?.taxa_conversao ?? 0}%`} bg="bg-slate-950" />
            </View>
          </>
        )}

        {/* CTA nova proposta */}
        <Pressable
          onPress={() => router.push('/propostas/nova')}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-gold py-4"
        >
          <Plus size={20} color="#FFF" />
          <Text className="text-base font-bold text-white">Nova proposta</Text>
        </Pressable>

        {/* Em andamento */}
        {(kpi?.ativas ?? 0) > 0 && (
          <View className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={18} color="#F59E0B" />
              <Text className="font-semibold text-warning">{kpi?.ativas} proposta(s) em andamento</Text>
            </View>
            <Text className="mt-1 text-xs text-silver-700">Acompanhe o status e mantenha o pipeline ativo.</Text>
          </View>
        )}

        {/* Lista propostas recentes */}
        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-base font-bold text-navy">Propostas recentes</Text>
            <Pressable onPress={() => router.push('/(parceiro)/propostas')}>
              <Text className="text-xs font-medium text-gold-600">Ver todas →</Text>
            </Pressable>
          </View>
          {recentesQuery.isLoading ? (
            <ActivityIndicator color="#DC2626" />
          ) : propostas.length === 0 ? (
            <View className="rounded-xl border border-silver-200 bg-white p-6">
              <Text className="text-center text-sm text-silver-500">Nenhuma proposta ainda — crie a primeira!</Text>
            </View>
          ) : (
            <View className="gap-2">
              {propostas.map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/(parceiro)/propostas/${p.id}`)}
                  className="rounded-xl border border-silver-200 bg-white p-4 active:opacity-70"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-mono text-xs text-silver-500">{p.protocolo ?? p.id.slice(0, 8)}</Text>
                    <StatusBadge status={STATUS_LABEL[p.status] ?? p.status} />
                  </View>
                  <Text className="mt-1 font-semibold text-navy">{p.cliente?.nome_completo ?? '—'}</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-gold-600">{brl(Number(p.valor_solicitado) * 100)}</Text>
                    <Text className="text-[11px] text-silver-400">{formatRelative(p.updated_at)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Volume total */}
        <View className="rounded-xl bg-gold/10 p-4">
          <View className="flex-row items-center gap-2">
            <TrendingUp size={18} color="#991B1B" />
            <Text className="font-semibold text-gold-600">Volume total</Text>
          </View>
          <Text className="mt-1 text-sm text-silver-800">
            Você já movimentou <Text className="font-bold">{brl(Number(kpi?.volume_total ?? 0) * 100)}</Text> em propostas.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
