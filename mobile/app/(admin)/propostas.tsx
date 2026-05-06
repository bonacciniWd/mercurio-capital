import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Clock, TrendingUp } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const propostas = [
  { id: 'MC-2024-0042', cliente: 'João Silva',  parceiro: 'Aurora',    valor: 35_000_000, ltv: 48, status: 'Análise de Crédito',        dias: 5, accent: '#F59E0B' },
  { id: 'MC-2024-0058', cliente: 'Camila R.',   parceiro: 'Vista Sul', valor: 28_000_000, ltv: 55, status: 'Aguardando assinatura',    dias: 2, accent: '#38BDF8' },
  { id: 'MC-2024-0061', cliente: 'Pedro Lima',  parceiro: 'Capital +', valor: 62_000_000, ltv: 72, status: 'Análise Jurídica',          dias: 8, accent: '#F87171' },
  { id: 'MC-2024-0078', cliente: 'Ana Souza',   parceiro: 'Aurora',    valor: 48_000_000, ltv: 61, status: 'Comitê',                    dias: 4, accent: '#A78BFA' },
  { id: 'MC-2024-0083', cliente: 'Lucas P.',    parceiro: 'Norte',     valor: 22_000_000, ltv: 45, status: 'Pré-análise',               dias: 1, accent: '#737373' },
  { id: 'MC-2024-0091', cliente: 'Fernanda T.', parceiro: 'Premium',   valor: 91_000_000, ltv: 58, status: 'Recurso Liberado',         dias: 1, accent: '#16A34A' },
]

const total = propostas.reduce((s, p) => s + p.valor, 0)

export default function Propostas() {
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
          <Text style={s.headerTitle}>Propostas</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countText}>{propostas.length} ativas</Text>
        </View>
      </View>

      {/* KPI strip */}
      <View style={s.kpiStrip}>
        <View style={[s.kpiItem, { borderTopColor: '#F59E0B' }]}>
          <Text style={s.kpiValue}>{propostas.length}</Text>
          <Text style={s.kpiLabel}>Total</Text>
        </View>
        <View style={[s.kpiItem, { borderTopColor: '#DC2626' }]}>
          <Text style={s.kpiValue}>{brl(total)}</Text>
          <Text style={s.kpiLabel}>Volume</Text>
        </View>
        <View style={[s.kpiItem, { borderTopColor: '#16A34A' }]}>
          <Text style={s.kpiValue}>1</Text>
          <Text style={s.kpiLabel}>Liberados</Text>
        </View>
      </View>

      <FlatList
        data={propostas}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}
        renderItem={({ item: p }) => {
          const overdue = p.dias > 7
          const ltvHigh = p.ltv > 60
          return (
            <Pressable style={[s.card, { borderTopColor: p.accent }]}>
              {/* ID + status */}
              <View style={s.cardTop}>
                <Text style={s.cardId}>{p.id}</Text>
                <View style={[s.statusPill, { backgroundColor: p.accent + '22' }]}>
                  <View style={[s.statusDot, { backgroundColor: p.accent }]} />
                  <Text style={[s.statusText, { color: p.accent }]}>{p.status}</Text>
                </View>
              </View>

              {/* Client */}
              <Text style={s.clientName}>{p.cliente}</Text>
              <Text style={s.parceiro}>via {p.parceiro}</Text>

              {/* Footer metrics */}
              <View style={s.cardFooter}>
                <Text style={s.valor}>{brl(p.valor)}</Text>
                <View style={s.badges}>
                  <View style={[s.ltvBadge, { backgroundColor: ltvHigh ? '#F59E0B18' : '#16A34A18' }]}>
                    <TrendingUp size={10} color={ltvHigh ? '#F59E0B' : '#16A34A'} />
                    <Text style={[s.ltvText, { color: ltvHigh ? '#F59E0B' : '#16A34A' }]}>LTV {p.ltv}%</Text>
                  </View>
                  <View style={s.daysRow}>
                    <Clock size={11} color={overdue ? '#DC2626' : '#525252'} />
                    <Text style={[s.daysText, overdue && { color: '#DC2626', fontWeight: '700' }]}>{p.dias}d</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )
        }}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  countPill: { backgroundColor: '#16A34A22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  kpiStrip: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  kpiItem: { flex: 1, backgroundColor: '#141414', borderRadius: 12, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  kpiValue: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 2 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardId: { fontSize: 10, color: '#525252', fontFamily: 'monospace', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#e5e5e5' },
  parceiro: { fontSize: 11, color: '#525252', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  valor: { fontSize: 16, fontWeight: '800', color: '#DC2626', letterSpacing: -0.3 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ltvBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  ltvText: { fontSize: 10, fontWeight: '700' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { fontSize: 11, color: '#525252' },
})
