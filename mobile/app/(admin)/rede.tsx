import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Network as NetIcon, ChevronRight, Users, GitBranch, Layers } from 'lucide-react-native'

const equipes = [
  { master: 'João Roberto', empresa: 'Aurora',     sub: 8,  volume: 'R$ 4,2M', accent: '#38BDF8' },
  { master: 'Marina S.',    empresa: 'Capital +',  sub: 12, volume: 'R$ 6,8M', accent: '#A78BFA' },
  { master: 'Carlos M.',    empresa: 'Vista Sul',  sub: 5,  volume: 'R$ 2,1M', accent: '#16A34A' },
]

const comissoes = [
  { label: 'Master',           value: '0,8% sobre volume' },
  { label: 'Sub-parceiro',     value: '0,5% sobre volume' },
  { label: 'Override do master', value: '0,3% adicional' },
]

export default function Rede() {
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
          <Text style={s.headerTitle}>Rede de Parceiros</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* KPI grid */}
        <View style={s.grid}>
          <StatCard icon={Users}      accent="#38BDF8" label="Masters"       value="14" sub="parceiros" />
          <StatCard icon={GitBranch}  accent="#16A34A" label="Sub-parceiros" value="63" sub="ativos" />
          <StatCard icon={Layers}     accent="#A78BFA" label="Profundidade"  value="3"  sub="níveis" />
        </View>

        {/* Section label */}
        <Text style={s.sectionLabel}>TOP HIERARQUIAS</Text>

        {/* Team cards */}
        {equipes.map((e, i) => (
          <Pressable key={i} style={s.card}>
            <View style={[s.avatarBadge, { backgroundColor: e.accent + '22' }]}>
              <NetIcon size={18} color={e.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.masterName}>{e.master}</Text>
              <Text style={s.empresa}>{e.empresa}</Text>
              <View style={s.tagsRow}>
                <View style={[s.tag, { backgroundColor: e.accent + '18' }]}>
                  <Text style={[s.tagText, { color: e.accent }]}>{e.sub} sub-parceiros</Text>
                </View>
                <View style={s.tag}>
                  <Text style={s.tagText}>{e.volume}</Text>
                </View>
              </View>
            </View>
            <ChevronRight size={18} color="#404040" />
          </Pressable>
        ))}

        {/* Commission table */}
        <View style={s.commCard}>
          <Text style={s.commTitle}>Estrutura de comissões</Text>
          {comissoes.map((r, i) => (
            <View key={i} style={[s.commRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#1f1f1f' }]}>
              <Text style={s.commLabel}>{r.label}</Text>
              <Text style={s.commValue}>{r.value}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ icon: Icon, accent, label, value, sub }: { icon: any; accent: string; label: string; value: string; sub?: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: accent }]}>
      <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
        <Icon size={14} color={accent} />
      </View>
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

  grid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  iconBadge: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: '#737373', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 10, color: '#525252', marginTop: 1 },

  sectionLabel: { fontSize: 10, letterSpacing: 1.2, color: '#525252', fontWeight: '700' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#141414', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  avatarBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  masterName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  empresa: { fontSize: 11, color: '#525252', marginTop: 1 },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  tag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },

  commCard: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  commTitle: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  commRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  commLabel: { fontSize: 13, color: '#737373' },
  commValue: { fontSize: 13, fontWeight: '600', color: '#e5e5e5' },
})
