import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import {
  ArrowLeft, TrendingUp, TrendingDown, Users, AlertTriangle,
  Building2, FileStack, BarChart3, Clock, Banknote, BadgeCheck,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'

// ─── Inline KPI card for admin (dark theme) ──────────────────────────────────
type Trend = 'up' | 'down' | 'neutral'
function StatCard({
  icon: Icon, iconColor, accent,
  label, value, sub, trend, trendValue,
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
        {trend && trendValue && (
          <View style={[s.trendPill, { backgroundColor: trendColor + '18' }]}>
            <TrendIcon size={11} color={trendColor} />
            <Text style={[s.trendText, { color: trendColor }]}>{trendValue}</Text>
          </View>
        )}
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
    </View>
  )
}

export default function AdminDashboard() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Dashboard</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* Hero metric */}
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroLabel}>VOLUME EM ANÁLISE</Text>
            <Text style={s.heroValue}>{brl(8_700_000_000)}</Text>
            <View style={s.heroBadge}>
              <TrendingUp size={13} color="#16A34A" />
              <Text style={s.heroBadgeText}>+18% vs mês anterior</Text>
            </View>
          </View>
          <View style={s.heroBar}>
            {[40, 55, 48, 70, 65, 82, 75, 90, 88, 95, 100, 110].map((h, i) => (
              <View key={i} style={[s.bar, { height: `${h * 0.75}%` as any }]} />
            ))}
          </View>
        </View>

        {/* KPI grid */}
        <View style={s.grid}>
          <StatCard
            icon={Users} iconColor="#16A34A" accent="#16A34A"
            label="Parceiros ativos" value="47" sub="+ 3 este mês"
            trend="up" trendValue="+6,8%"
          />
          <StatCard
            icon={FileStack} iconColor="#DC2626" accent="#DC2626"
            label="Propostas" value="312" sub="em carteira"
            trend="up" trendValue="+12%"
          />
          <StatCard
            icon={Clock} iconColor="#F59E0B" accent="#F59E0B"
            label="Pendências" value="41" sub="aguardando ação"
            trend="down" trendValue="-5"
          />
          <StatCard
            icon={BadgeCheck} iconColor="#16A34A" accent="#16A34A"
            label="Contratos/mês" value="23" sub="fechamentos"
            trend="up" trendValue="+4,5%"
          />
          <StatCard
            icon={Banknote} iconColor="#A3A3A3" accent="#A3A3A3"
            label="Saldo carteiras" value={brl(1_850_000)} sub="liberado"
          />
          <StatCard
            icon={BarChart3} iconColor="#F87171" accent="#F87171"
            label="Ticket médio" value={brl(427_000)} sub="por proposta"
            trend="up" trendValue="+2,1%"
          />
        </View>

        {/* Aprovações pendentes */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardHeaderLeft}>
              <Building2 size={18} color="#DC2626" />
              <Text style={s.cardTitle}>Aprovações pendentes</Text>
            </View>
            <View style={s.badge}>
              <Text style={s.badgeText}>8</Text>
            </View>
          </View>
          {[
            { name: 'Construtora Aurora', sub: 'Aguarda doc. jurídica' },
            { name: 'Imobiliária Vista Sul', sub: 'Análise de crédito' },
            { name: 'Capital + Crédito', sub: 'Vistoria pendente' },
          ].map(p => (
            <View key={p.name} style={s.listRow}>
              <View>
                <Text style={s.listName}>{p.name}</Text>
                <Text style={s.listSub}>{p.sub}</Text>
              </View>
              <Text style={s.listAction}>Revisar</Text>
            </View>
          ))}
        </View>

        {/* Gargalo */}
        <View style={s.alertCard}>
          <AlertTriangle size={18} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={s.alertTitle}>Gargalo: Análise Jurídica</Text>
            <Text style={s.alertSub}>32 propostas paradas há mais de 7 dias</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  // Hero
  heroCard: { backgroundColor: '#141414', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  heroLeft: { flex: 1 },
  heroLabel: { fontSize: 10, letterSpacing: 1.2, color: '#737373', fontWeight: '600' },
  heroValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.5 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: '#16A34A18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  heroBadgeText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  heroBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 60, width: 80 },
  bar: { flex: 1, borderRadius: 3, backgroundColor: '#DC2626', opacity: 0.7 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: '#141414', borderRadius: 14, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  trendText: { fontSize: 10, fontWeight: '700' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: '#737373', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 10, color: '#525252', marginTop: 2 },

  // Card
  card: { backgroundColor: '#141414', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  badge: { backgroundColor: '#F59E0B22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  listName: { fontSize: 13, color: '#e5e5e5', fontWeight: '500' },
  listSub: { fontSize: 11, color: '#525252', marginTop: 1 },
  listAction: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  // Alert
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F59E0B0D', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F59E0B30' },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  alertSub: { fontSize: 12, color: '#737373', marginTop: 2 },
})
