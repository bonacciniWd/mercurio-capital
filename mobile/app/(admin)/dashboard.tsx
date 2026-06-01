import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, TrendingUp, TrendingDown, Users, AlertTriangle,
  Building2, FileStack, BarChart3, Clock, Banknote, BadgeCheck,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type KpiRow = {
  total_propostas: number; propostas_mes: number; ativas: number
  ganhas: number; canceladas: number; taxa_conversao: number
  volume_ganho: number; volume_total: number; parceiros_ativos: number
}
type TopRow = { partner_id: string; partner_nome: string; total: number; ganhas: number; volume: number }
type AprovacaoRow = { partner_id: string; nome: string; status: string; created_at: string; docs_count: number }
type GargaloRow = { id: string; status: string; dias_parada: number; cliente_nome: string | null }

type Trend = 'up' | 'down' | 'neutral'
function StatCard({
  icon: Icon, iconColor, accent, label, value, sub, trend, trendValue,
}: {
  icon: any; iconColor: string; accent: string
  label: string; value: string; sub?: string
  trend?: Trend; trendValue?: string
}) {
  const trendColor = trend === 'up' ? '#16A34A' : trend === 'down' ? '#DC2626' : '#737373'
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown
  return (
    <View style={[s.statCard, { borderTopColor: accent }]}>
      <View style={s.statHeader}>
        <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
          <Icon size={16} color={iconColor} />
        </View>
        {trend && trendValue ? (
          <View style={[s.trendPill, { backgroundColor: trendColor + '18' }]}>
            <TrendIcon size={11} color={trendColor} />
            <Text style={[s.trendText, { color: trendColor }]}>{trendValue}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  )
}

export default function AdminDashboard() {
  const kpiQuery = useQuery({
    queryKey: ['admin-mobile-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_dashboard_kpis').select('*').maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })

  const topQuery = useQuery({
    queryKey: ['admin-mobile-top-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_top_partners')
        .select('partner_id, partner_nome, total, ganhas, volume')
        .limit(5)
      if (error) throw error
      return (data ?? []) as TopRow[]
    },
  })

  const aprovQuery = useQuery({
    queryKey: ['admin-mobile-aprov-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partner_aprovacoes')
        .select('partner_id, nome, status, created_at, docs_count')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return (data ?? []) as AprovacaoRow[]
    },
  })

  const gargaloQuery = useQuery({
    queryKey: ['admin-mobile-gargalos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_gargalos')
        .select('id, status, dias_parada, cliente_nome')
        .order('dias_parada', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as GargaloRow[]
    },
  })

  const kpi = kpiQuery.data
  const top = Array.isArray(topQuery.data) ? topQuery.data : []
  const aprov = Array.isArray(aprovQuery.data) ? aprovQuery.data : []
  const gargalos = Array.isArray(gargaloQuery.data) ? gargaloQuery.data : []
  const loading = kpiQuery.isLoading || topQuery.isLoading

  const volumeEmAnalise = Math.max(0, Number(kpi?.volume_total ?? 0) - Number(kpi?.volume_ganho ?? 0)) * 100
  const maxVol = Math.max(1, ...top.map(t => Number(t.volume) || 0))

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Dashboard</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          <View style={s.heroCard}>
            <View style={s.heroLeft}>
              <Text style={s.heroLabel}>VOLUME EM ANÁLISE</Text>
              <Text style={s.heroValue}>{brl(volumeEmAnalise)}</Text>
              <View style={s.heroBadge}>
                <TrendingUp size={13} color="#16A34A" />
                <Text style={s.heroBadgeText}>{kpi?.taxa_conversao ?? 0}% conversão</Text>
              </View>
            </View>
            <View style={s.heroBar}>
              {top.slice(0, 8).map((t, i) => (
                <View key={t.partner_id} style={[s.bar, { height: `${Math.max(15, (Number(t.volume) / maxVol) * 100) * 0.85}%` as any, opacity: 0.4 + i * 0.07 }]} />
              ))}
            </View>
          </View>

          <View style={s.grid}>
            <StatCard icon={Users} iconColor="#16A34A" accent="#16A34A"
              label="Parceiros ativos" value={String(kpi?.parceiros_ativos ?? 0)} />
            <StatCard icon={FileStack} iconColor="#DC2626" accent="#DC2626"
              label="Propostas no mês" value={String(kpi?.propostas_mes ?? 0)} sub={`${kpi?.total_propostas ?? 0} no total`} />
            <StatCard icon={Clock} iconColor="#F59E0B" accent="#F59E0B"
              label="Ativas" value={String(kpi?.ativas ?? 0)} sub="em andamento" />
            <StatCard icon={BadgeCheck} iconColor="#16A34A" accent="#16A34A"
              label="Ganhas" value={String(kpi?.ganhas ?? 0)} sub="contratos" />
            <StatCard icon={Banknote} iconColor="#A3A3A3" accent="#A3A3A3"
              label="Volume ganho" value={brl(Number(kpi?.volume_ganho ?? 0) * 100)} />
            <StatCard icon={BarChart3} iconColor="#F87171" accent="#F87171"
              label="Conversão" value={`${kpi?.taxa_conversao ?? 0}%`} sub={`${kpi?.canceladas ?? 0} canceladas`} />
          </View>

          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardHeaderLeft}>
                <BarChart3 size={18} color="#DC2626" />
                <Text style={s.cardTitle}>Top parceiros · volume</Text>
              </View>
              <Pressable onPress={() => router.push('/(admin)/parceiros' as any)}>
                <Text style={s.listAction}>Ver →</Text>
              </Pressable>
            </View>
            {top.length === 0 ? (
              <Text style={s.empty}>Sem dados.</Text>
            ) : top.map(t => (
              <View key={t.partner_id} style={s.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listName} numberOfLines={1}>{t.partner_nome}</Text>
                  <Text style={s.listSub}>{t.total} propostas · {t.ganhas} ganhas</Text>
                </View>
                <Text style={[s.listName, { color: '#DC2626' }]}>{brl(Number(t.volume) * 100)}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={() => router.push('/(admin)/aprovacoes' as any)} style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardHeaderLeft}>
                <Building2 size={18} color="#F59E0B" />
                <Text style={s.cardTitle}>Aprovações pendentes</Text>
              </View>
              <View style={s.badge}>
                <Text style={s.badgeText}>{aprov.length}</Text>
              </View>
            </View>
            {aprov.length === 0 ? (
              <Text style={s.empty}>Nenhuma aprovação pendente.</Text>
            ) : aprov.map(p => (
              <View key={p.partner_id} style={s.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listName}>{p.nome}</Text>
                  <Text style={s.listSub}>{p.docs_count} doc(s) anexado(s)</Text>
                </View>
                <Text style={s.listAction}>Revisar</Text>
              </View>
            ))}
          </Pressable>

          {gargalos.length > 0 ? (
            <View style={s.alertCard}>
              <AlertTriangle size={18} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>{gargalos.length} propostas paradas há mais de 7 dias</Text>
                <Text style={s.alertSub}>Maior tempo: {gargalos[0]?.dias_parada} dias · {gargalos[0]?.cliente_nome ?? '—'}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  heroCard: { backgroundColor: '#141414', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  heroLeft: { flex: 1 },
  heroLabel: { fontSize: 10, letterSpacing: 1.2, color: '#737373', fontWeight: '600' },
  heroValue: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.5 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: '#16A34A18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  heroBadgeText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  heroBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 60, width: 80 },
  bar: { flex: 1, borderRadius: 3, backgroundColor: '#DC2626' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 124, backgroundColor: '#141414', borderRadius: 14, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  trendText: { fontSize: 10, fontWeight: '700' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: '#737373', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 10, color: '#525252', marginTop: 2 },
  card: { backgroundColor: '#141414', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badge: { backgroundColor: '#F59E0B22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1f1f1f', gap: 10 },
  listName: { fontSize: 13, color: '#e5e5e5', fontWeight: '600' },
  listSub: { fontSize: 11, color: '#525252', marginTop: 1 },
  listAction: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  empty: { padding: 16, textAlign: 'center', color: '#525252', fontSize: 12 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F59E0B0D', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F59E0B30' },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  alertSub: { fontSize: 12, color: '#737373', marginTop: 2 },
})
