import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Workflow as WfIcon, Plus, ChevronRight, Clock, Layers } from 'lucide-react-native'

const fluxos = [
  { id: 1, nome: 'Home Equity Padrão',   etapas: 6, slaTotal: '14 dias', status: 'Ativo',    accent: '#16A34A' },
  { id: 2, nome: 'Construção (B2B)',       etapas: 8, slaTotal: '21 dias', status: 'Ativo',    accent: '#38BDF8' },
  { id: 3, nome: 'Financiamento Express', etapas: 5, slaTotal: '7 dias',  status: 'Rascunho', accent: '#737373' },
]

export default function Fluxos() {
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
          <Text style={s.headerTitle}>Fluxos de Aprovação</Text>
        </View>
        <Pressable style={s.newBtn}>
          <Plus size={15} color="white" />
          <Text style={s.newBtnText}>Novo</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        {fluxos.map(f => (
          <Pressable key={f.id} style={[s.card, { borderTopColor: f.accent }]}>
            {/* Icon + name */}
            <View style={s.cardTop}>
              <View style={[s.iconBadge, { backgroundColor: f.accent + '22' }]}>
                <WfIcon size={18} color={f.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fluxName}>{f.nome}</Text>
                <View style={[s.statusPill, { backgroundColor: f.accent + '20' }]}>
                  <View style={[s.statusDot, { backgroundColor: f.accent }]} />
                  <Text style={[s.statusText, { color: f.accent }]}>{f.status}</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#404040" />
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Layers size={12} color="#525252" />
                <Text style={s.statText}>{f.etapas} etapas</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Clock size={12} color="#525252" />
                <Text style={s.statText}>SLA {f.slaTotal}</Text>
              </View>
            </View>
          </Pressable>
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
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  card: { backgroundColor: '#141414', borderRadius: 16, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  iconBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fluxName: { fontSize: 15, fontWeight: '700', color: '#e5e5e5', marginBottom: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingHorizontal: 16, paddingVertical: 12 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statText: { fontSize: 12, color: '#737373', fontWeight: '500' },
  statDivider: { width: 1, height: 20, backgroundColor: '#2a2a2a', marginHorizontal: 8 },
})
