import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Clock, CheckCircle2, TrendingUp, Coins, AlertTriangle,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface ComissaoRow {
  id: string
  proposta_id: string
  percentual: number
  valor: number
  status: 'prevista' | 'aprovada' | 'paga'
  paga_em: string | null
  created_at: string
  proposta: {
    protocolo: string | null
    cliente: { nome_completo: string | null } | null
  } | null
}

type Filtro = 'todas' | 'prevista' | 'aprovada' | 'paga'

const cents = (v: number | string) => Math.round(Number(v ?? 0) * 100)

const STATUS_COLOR: Record<string, string> = {
  prevista: '#F59E0B',
  aprovada: '#38BDF8',
  paga:     '#16A34A',
}

export default function PartnerComissoes() {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [refreshing, setRefreshing] = useState(false)

  const comQ = useQuery({
    queryKey: ['p-comissoes-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('id, proposta_id, percentual, valor, status, paga_em, created_at, proposta:propostas(protocolo, cliente:clientes(nome_completo))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ComissaoRow[]
    },
  })

  const lista = comQ.data ?? []
  const totais = useMemo(() => {
    const prev = lista.filter(c => c.status === 'prevista').reduce((a, c) => a + Number(c.valor), 0)
    const apro = lista.filter(c => c.status === 'aprovada').reduce((a, c) => a + Number(c.valor), 0)
    const paga = lista.filter(c => c.status === 'paga').reduce((a, c) => a + Number(c.valor), 0)
    const proximo = lista
      .filter(c => c.status === 'aprovada')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
    return { prev, apro, paga, proximo }
  }, [lista])

  const filtradas = filtro === 'todas' ? lista : lista.filter(c => c.status === filtro)

  async function onRefresh() {
    setRefreshing(true)
    await comQ.refetch()
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(parceiro)/dashboard')}
          style={s.backBtn}
        >
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>PARCEIRO</Text>
          <Text style={s.headerTitle}>Comissões</Text>
        </View>
      </View>

      {comQ.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : comQ.error ? (
        <View style={s.errBox}>
          <AlertTriangle size={14} color="#DC2626" />
          <Text style={s.errText}>{(comQ.error as Error).message}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />}
        >
          {/* KPIs */}
          <View style={s.grid}>
            <Kpi Icon={Clock}         accent="#F59E0B" label="Previstas" value={brl(cents(totais.prev))} />
            <Kpi Icon={TrendingUp}    accent="#38BDF8" label="Aprovadas" value={brl(cents(totais.apro))} />
            <Kpi Icon={CheckCircle2}  accent="#16A34A" label="Pagas"     value={brl(cents(totais.paga))} />
            <Kpi Icon={Coins}         accent="#DC2626" label="Próximo recebimento"
                 value={totais.proximo ? brl(cents(totais.proximo.valor)) : '—'}
                 sub={totais.proximo?.proposta?.protocolo ?? ''} />
          </View>

          {/* Filtros */}
          <View style={s.filterRow}>
            {(['todas', 'prevista', 'aprovada', 'paga'] as Filtro[]).map(f => {
              const active = filtro === f
              return (
                <Pressable
                  key={f}
                  onPress={() => setFiltro(f)}
                  style={[s.filterPill, active && s.filterPillActive]}
                >
                  <Text style={[s.filterText, active && { color: '#fff' }]}>{f}</Text>
                </Pressable>
              )
            })}
          </View>

          {/* Lista */}
          {filtradas.length === 0 ? (
            <View style={s.card}>
              <Text style={s.empty}>
                {lista.length === 0
                  ? 'Nenhuma comissão ainda. Quando uma proposta tiver recurso liberado, a comissão aparecerá aqui.'
                  : `Nenhuma comissão ${filtro}.`}
              </Text>
            </View>
          ) : (
            filtradas.map(c => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(parceiro)/propostas/${c.proposta_id}` as any)}
                style={[s.card, { borderTopWidth: 2, borderTopColor: STATUS_COLOR[c.status] }]}
              >
                {/* Header da linha */}
                <View style={s.rowHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.proto}>{c.proposta?.protocolo ?? c.proposta_id.slice(0, 8)}</Text>
                    <Text style={s.cliente} numberOfLines={1}>
                      {c.proposta?.cliente?.nome_completo ?? '—'}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[c.status] + '22' }]}>
                    <Text style={[s.statusText, { color: STATUS_COLOR[c.status] }]}>{c.status}</Text>
                  </View>
                </View>

                {/* Stats */}
                <View style={s.statsRow}>
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>%</Text>
                    <Text style={s.statVal}>{Number(c.percentual).toFixed(2)}%</Text>
                  </View>
                  <View style={s.divider} />
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>Valor</Text>
                    <Text style={[s.statVal, { color: '#DC2626' }]}>{brl(cents(c.valor))}</Text>
                  </View>
                  <View style={s.divider} />
                  <View style={s.statCol}>
                    <Text style={s.statLabel}>{c.paga_em ? 'Paga em' : 'Criada'}</Text>
                    <Text style={[s.statVal, { fontSize: 12 }]}>
                      {new Date(c.paga_em ?? c.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Kpi({
  Icon, accent, label, value, sub,
}: { Icon: any; accent: string; label: string; value: string; sub?: string }) {
  return (
    <View style={[s.kpiCard, { borderTopColor: accent }]}>
      <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
        <Icon size={14} color={accent} />
      </View>
      <View>
        <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
        <Text style={s.kpiLabel}>{label}</Text>
        {sub ? <Text style={s.kpiSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: '#DC262615', borderWidth: 1, borderColor: '#DC262640', borderRadius: 10, padding: 12 },
  errText: { color: '#DC2626', fontSize: 12, flex: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 112, backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'space-between' },
  iconBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 3 },
  kpiSub: { fontSize: 9, color: '#525252', marginTop: 1, fontFamily: 'Courier' },

  filterRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  filterPill: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  filterPillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  filterText: { fontSize: 11, fontWeight: '600', color: '#737373', textTransform: 'capitalize' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  empty: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 16 },

  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  proto: { fontFamily: 'Courier', fontSize: 12, color: '#a3a3a3' },
  cliente: { fontSize: 13, fontWeight: '600', color: '#e5e5e5', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  statsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  statCol: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#525252', textTransform: 'uppercase', fontWeight: '600' },
  statVal: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
})

