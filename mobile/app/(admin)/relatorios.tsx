import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, FileSpreadsheet, FileText, TrendingUp } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const BARS = [60, 70, 55, 80, 75, 88, 82, 95, 90, 100, 110, 120]
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MAX_BAR = Math.max(...BARS)

const FUNIL = [
  { label: 'Pré-análise', count: 312, color: '#737373' },
  { label: 'Crédito',     count: 245, color: '#F87171' },
  { label: 'Jurídico',    count: 198, color: '#F59E0B' },
  { label: 'Comitê',      count: 156, color: '#A78BFA' },
  { label: 'Assinatura',  count: 132, color: '#38BDF8' },
  { label: 'Liberado',    count: 124, color: '#16A34A' },
]

export default function Relatorios() {
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
          <Text style={s.headerTitle}>Relatórios</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* KPI grid */}
        <View style={s.grid}>
          <View style={[s.kpiCard, { borderTopColor: '#DC2626' }]}>
            <Text style={s.kpiValue}>{brl(15_850_000_000)}</Text>
            <Text style={s.kpiLabel}>Volume YTD</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#737373' }]}>
            <Text style={s.kpiValue}>312</Text>
            <Text style={s.kpiLabel}>Propostas</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#16A34A' }]}>
            <Text style={s.kpiValue}>64%</Text>
            <Text style={s.kpiLabel}>Aprovação</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#F59E0B' }]}>
            <Text style={s.kpiValue}>{brl(48_700_000)}</Text>
            <Text style={s.kpiLabel}>Ticket médio</Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <TrendingUp size={16} color="#DC2626" />
            <Text style={s.cardTitle}>Volume mensal</Text>
          </View>
          <View style={s.chartArea}>
            {BARS.map((h, i) => (
              <View key={i} style={s.barCol}>
                <View style={[s.bar, { height: `${(h / MAX_BAR) * 100}%` as any }]} />
                <Text style={s.barLabel}>{MONTHS[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Funil */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Funil de propostas</Text>
          <View style={{ gap: 10, marginTop: 14 }}>
            {FUNIL.map(f => (
              <View key={f.label}>
                <View style={s.funilRow}>
                  <Text style={s.funilLabel}>{f.label}</Text>
                  <Text style={[s.funilCount, { color: f.color }]}>{f.count}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(f.count / 312) * 100}%` as any, backgroundColor: f.color }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Export */}
        <View style={s.exportRow}>
          <Pressable style={[s.exportBtn, { backgroundColor: '#16A34A' }]}>
            <FileSpreadsheet size={16} color="white" />
            <Text style={s.exportText}>Excel</Text>
          </Pressable>
          <Pressable style={[s.exportBtn, { backgroundColor: '#DC2626' }]}>
            <FileText size={16} color="white" />
            <Text style={s.exportText}>PDF</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '47.5%', backgroundColor: '#141414', borderRadius: 14, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  kpiValue: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 3 },

  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 100 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 3, backgroundColor: '#DC2626', opacity: 0.85 },
  barLabel: { fontSize: 7, color: '#525252', marginTop: 4, textAlign: 'center' },

  funilRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  funilLabel: { fontSize: 12, color: '#737373' },
  funilCount: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },

  exportRow: { flexDirection: 'row', gap: 10 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  exportText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
