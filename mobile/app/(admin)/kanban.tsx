import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Clock } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const COLS = [
  { id: 'pre',  label: 'Pré-análise', accent: '#737373', items: [
    { id: 'MC-0083', cliente: 'Lucas P.',    valor: 22_000_000, dias: 1 },
    { id: 'MC-0091', cliente: 'Fernanda T.', valor: 91_000_000, dias: 1 },
  ]},
  { id: 'cred', label: 'Crédito',     accent: '#F59E0B', items: [
    { id: 'MC-0042', cliente: 'João Silva',  valor: 35_000_000, dias: 5 },
  ]},
  { id: 'jur',  label: 'Jurídico',    accent: '#F87171', items: [
    { id: 'MC-0061', cliente: 'Pedro Lima',  valor: 62_000_000, dias: 8 },
  ]},
  { id: 'com',  label: 'Comitê',      accent: '#A78BFA', items: [
    { id: 'MC-0078', cliente: 'Ana Souza',   valor: 48_000_000, dias: 4 },
  ]},
  { id: 'ass',  label: 'Assinatura',  accent: '#38BDF8', items: [
    { id: 'MC-0058', cliente: 'Camila R.',   valor: 28_000_000, dias: 2 },
  ]},
  { id: 'lib',  label: 'Liberado',    accent: '#16A34A', items: [
    { id: 'MC-0091', cliente: 'Fernanda T.', valor: 91_000_000, dias: 0 },
  ]},
]

export default function Kanban() {
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
          <Text style={s.headerTitle}>Kanban de Propostas</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, padding: 16, paddingRight: 24 }}
        style={{ flex: 1 }}
      >
        {COLS.map(c => (
          <View key={c.id} style={[s.col, { borderTopColor: c.accent }]}>
            {/* Column header */}
            <View style={s.colHeader}>
              <View style={[s.colDot, { backgroundColor: c.accent }]} />
              <Text style={s.colLabel}>{c.label}</Text>
              <View style={[s.colBadge, { backgroundColor: c.accent + '22' }]}>
                <Text style={[s.colBadgeText, { color: c.accent }]}>{c.items.length}</Text>
              </View>
            </View>

            {/* Cards */}
            <View style={{ gap: 10 }}>
              {c.items.map(p => {
                const overdue = p.dias > 7
                return (
                  <Pressable key={p.id} style={s.card}>
                    <Text style={s.cardId}>{p.id}</Text>
                    <Text style={s.cardClient}>{p.cliente}</Text>
                    <Text style={s.cardValue}>{brl(p.valor)}</Text>
                    <View style={s.cardFooter}>
                      <View style={[s.stagePill, { backgroundColor: c.accent + '22' }]}>
                        <Text style={[s.stagePillText, { color: c.accent }]}>{c.label}</Text>
                      </View>
                      <View style={s.daysRow}>
                        <Clock size={10} color={overdue ? '#DC2626' : '#525252'} />
                        <Text style={[s.daysText, overdue && { color: '#DC2626', fontWeight: '700' }]}>
                          {p.dias}d
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  col: { width: 240, backgroundColor: '#141414', borderRadius: 16, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', alignSelf: 'flex-start' },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  colDot: { width: 7, height: 7, borderRadius: 4 },
  colLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  colBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  colBadgeText: { fontSize: 11, fontWeight: '700' },

  card: { backgroundColor: '#1c1c1c', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  cardId: { fontSize: 10, color: '#525252', fontFamily: 'monospace', letterSpacing: 0.5 },
  cardClient: { fontSize: 14, fontWeight: '600', color: '#e5e5e5', marginTop: 3 },
  cardValue: { fontSize: 13, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stagePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  stagePillText: { fontSize: 10, fontWeight: '600' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { fontSize: 11, color: '#525252' },
})
