import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Edit2, TrendingUp } from 'lucide-react-native'
import { brl } from '@/lib/utils'

const consultas = [
  { id: 'serasa-pf', nome: 'Serasa PF',            preco: 490,  custo: 320, accent: '#DC2626' },
  { id: 'serasa-pj', nome: 'Serasa PJ',            preco: 790,  custo: 540, accent: '#DC2626' },
  { id: 'bacen',     nome: 'Bacen SCR',            preco: 250,  custo: 90,  accent: '#DC2626' },
  { id: 'jus',       nome: 'Jusbrasil',            preco: 500,  custo: 280, accent: '#DC2626' },
  { id: 'ri',        nome: 'RI Digital',           preco: 990,  custo: 650, accent: '#DC2626' },
  { id: 'av',        nome: 'Avaliação automática',  preco: 1500, custo: 900, accent: '#DC2626' },
]

const markup = 52

export default function Precos() {
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
          <Text style={s.headerTitle}>Preços de Consultas</Text>
        </View>
        <View style={s.markupPill}>
          <TrendingUp size={12} color="#16A34A" />
          <Text style={s.markupText}>Markup {markup}%</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
        {consultas.map(c => {
          const margem = ((c.preco - c.custo) / c.preco * 100).toFixed(0)
          const margemNum = Number(margem)
          const margemColor = margemNum >= 40 ? '#16A34A' : margemNum >= 25 ? '#F59E0B' : '#DC2626'
          return (
            <View key={c.id} style={[s.card, { borderTopColor: c.accent }]}>
              {/* Name + edit */}
              <View style={s.cardTop}>
                <View style={[s.iconBadge, { backgroundColor: c.accent + '22' }]}>
                  <Text style={[s.iconLabel, { color: c.accent }]}>{c.nome.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={s.consultaName}>{c.nome}</Text>
                <Pressable style={s.editBtn}>
                  <Edit2 size={13} color="#737373" />
                </Pressable>
              </View>

              {/* Stats */}
              <View style={s.statsRow}>
                <StatCell label="Custo"  value={brl(c.custo)} />
                <View style={s.divider} />
                <StatCell label="Preço"  value={brl(c.preco)} highlight />
                <View style={s.divider} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={s.cellLabel}>Margem</Text>
                  <View style={[s.margemBadge, { backgroundColor: margemColor + '20' }]}>
                    <Text style={[s.margemText, { color: margemColor }]}>{margem}%</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={[s.cellValue, highlight && { color: '#DC2626' }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  markupPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#16A34A22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  markupText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  consultaName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingVertical: 12 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  cellLabel: { fontSize: 9, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  cellValue: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
  margemBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 3 },
  margemText: { fontSize: 12, fontWeight: '700' },
})
