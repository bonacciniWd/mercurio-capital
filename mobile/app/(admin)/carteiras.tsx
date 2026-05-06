import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Wallet, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const carteiras = [
  { parceiro: 'Aurora',       saldo: 580_000, gasto: 2_400_000, recargas: 5,  accent: '#38BDF8' },
  { parceiro: 'Vista Sul',    saldo: 120_000, gasto: 980_000,   recargas: 3,  accent: '#A78BFA' },
  { parceiro: 'Capital +',    saldo: 950_000, gasto: 4_200_000, recargas: 8,  accent: '#16A34A' },
  { parceiro: 'Norte Crédito', saldo: 45_000,  gasto: 320_000,  recargas: 2,  accent: '#F59E0B' },
]

export default function Carteiras() {
  const total = carteiras.reduce((s, c) => s + c.saldo, 0)
  const totalGasto = carteiras.reduce((s, c) => s + c.gasto, 0)

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
          <Text style={s.headerTitle}>Carteiras</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* KPI grid */}
        <View style={s.grid}>
          <View style={[s.kpiCard, { borderTopColor: '#DC2626' }]}>
            <View style={[s.iconBadge, { backgroundColor: '#DC262622' }]}>
              <Wallet size={14} color="#DC2626" />
            </View>
            <Text style={s.kpiValue}>{brl(total)}</Text>
            <Text style={s.kpiLabel}>Saldo agregado</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#F59E0B' }]}>
            <View style={[s.iconBadge, { backgroundColor: '#F59E0B22' }]}>
              <TrendingUp size={14} color="#F59E0B" />
            </View>
            <Text style={s.kpiValue}>{brl(totalGasto)}</Text>
            <Text style={s.kpiLabel}>Gasto total/mês</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#16A34A' }]}>
            <View style={[s.iconBadge, { backgroundColor: '#16A34A22' }]}>
              <RefreshCw size={14} color="#16A34A" />
            </View>
            <Text style={s.kpiValue}>18</Text>
            <Text style={s.kpiLabel}>Recargas/mês</Text>
          </View>
        </View>

        {/* Wallet cards */}
        {carteiras.map(c => {
          const lowBalance = c.saldo < 100_000
          const pct = Math.min(100, Math.round((c.saldo / (c.saldo + c.gasto)) * 100))
          return (
            <View key={c.parceiro} style={[s.card, { borderTopColor: c.accent }]}>
              <View style={s.cardTop}>
                <View style={[s.avatarBadge, { backgroundColor: c.accent + '22' }]}>
                  <Wallet size={18} color={c.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{c.parceiro}</Text>
                  <Text style={s.recargas}>{c.recargas} recargas este mês</Text>
                </View>
                {lowBalance && (
                  <View style={s.alertBadge}>
                    <AlertTriangle size={11} color="#DC2626" />
                    <Text style={s.alertText}>Baixo</Text>
                  </View>
                )}
              </View>

              {/* Balance bar */}
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: lowBalance ? '#DC2626' : c.accent }]} />
              </View>

              {/* Stats */}
              <View style={s.statsRow}>
                <StatCell label="Saldo"     value={brl(c.saldo)}  alert={lowBalance} />
                <View style={s.divider} />
                <StatCell label="Gasto/mês" value={brl(c.gasto)} />
                <View style={s.divider} />
                <StatCell label="Uso"        value={`${pct}%`} />
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCell({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={[s.cellValue, alert && { color: '#DC2626' }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  grid: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  iconBadge: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  kpiLabel: { fontSize: 9, color: '#737373', marginTop: 2 },

  card: { backgroundColor: '#141414', borderRadius: 16, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatarBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  recargas: { fontSize: 11, color: '#525252', marginTop: 1 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC262618', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  alertText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },

  barTrack: { height: 3, backgroundColor: '#2a2a2a', marginHorizontal: 14, borderRadius: 2 },
  barFill: { height: 3, borderRadius: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1f1f1f', marginTop: 12 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  cellLabel: { fontSize: 9, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  cellValue: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
})
