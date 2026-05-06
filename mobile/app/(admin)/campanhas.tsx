import { View, Text, Pressable, Image, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Radio, PauseCircle, FileText, TrendingUp } from 'lucide-react-native'

const campanhas = [
  { id: 1, titulo: 'Black Friday Crédito', status: 'Ativa',    alcance: 1840, conv: 12.4, banner: require('../../assets/promotions/banner.jpeg') },
  { id: 2, titulo: 'Indicação Premium',    status: 'Ativa',    alcance: 980,  conv: 8.1,  banner: require('../../assets/promotions/promo.jpeg') },
  { id: 3, titulo: 'Construção Q2 2026',   status: 'Pausada',  alcance: 420,  conv: 5.2,  banner: require('../../assets/promotions/promo2.jpeg') },
  { id: 4, titulo: 'Home Equity Express',  status: 'Rascunho', alcance: 0,    conv: 0,    banner: require('../../assets/promotions/promo3.jpeg') },
]

const STATUS: Record<string, { color: string; icon: any }> = {
  Ativa:    { color: '#16A34A', icon: Radio },
  Pausada:  { color: '#F59E0B', icon: PauseCircle },
  Rascunho: { color: '#525252', icon: FileText },
}

export default function Campanhas() {
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
          <Text style={s.headerTitle}>Campanhas</Text>
        </View>
        <Pressable style={s.newBtn}>
          <Plus size={16} color="white" />
          <Text style={s.newBtnText}>Nova</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* KPI grid */}
        <View style={s.grid}>
          <StatCard accent="#16A34A" label="Ativas"      value="2"    sub="campanhas" />
          <StatCard accent="#38BDF8" label="Alcance"     value="3.240" sub="pessoas" />
          <StatCard accent="#DC2626" label="Conv. média" value="9,8%"  sub="conversão" />
        </View>

        {/* Campaign cards */}
        {campanhas.map(c => {
          const st = STATUS[c.status]
          const Icon = st.icon
          return (
            <View key={c.id} style={s.card}>
              <Image source={c.banner} style={s.banner} resizeMode="cover" />
              {/* Overlay gradient feel */}
              <View style={s.bannerOverlay} />
              {/* Status pill on top of image */}
              <View style={[s.statusPill, { backgroundColor: st.color + '22', borderColor: st.color + '60' }]}>
                <Icon size={11} color={st.color} />
                <Text style={[s.statusText, { color: st.color }]}>{c.status}</Text>
              </View>

              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{c.titulo}</Text>
                <View style={s.metricsRow}>
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>ALCANCE</Text>
                    <Text style={s.metricValue}>{c.alcance.toLocaleString('pt-BR')}</Text>
                  </View>
                  <View style={s.metricDivider} />
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>CONVERSÃO</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TrendingUp size={12} color={c.conv > 0 ? '#16A34A' : '#525252'} />
                      <Text style={[s.metricValue, { color: c.conv > 0 ? '#16A34A' : '#525252' }]}>{c.conv}%</Text>
                    </View>
                  </View>
                  <View style={s.metricDivider} />
                  <Pressable style={s.editBtn}>
                    <Text style={s.editBtnText}>Editar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ accent, label, value, sub }: { accent: string; label: string; value: string; sub?: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: accent, flex: 1 }]}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  grid: { flexDirection: 'row', gap: 10 },
  statCard: { backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: '#737373', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 10, color: '#525252', marginTop: 1 },

  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  banner: { width: '100%', height: 180 },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.35)' },
  statusPill: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginBottom: 12 },
  metricsRow: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1 },
  metricLabel: { fontSize: 9, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginTop: 2 },
  metricDivider: { width: 1, height: 28, backgroundColor: '#2a2a2a', marginHorizontal: 10 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#262626', borderRadius: 8 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: '#a3a3a3' },
})
