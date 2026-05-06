import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Building2, Check, X, Star } from 'lucide-react-native'

const pendentes = [
  { id: 1, nome: 'Construtora Aurora',    tipo: 'Construtora',    cnpj: '12.345.678/0001-90', score: 87 },
  { id: 2, nome: 'Imobiliária Vista Sul', tipo: 'Imobiliária',    cnpj: '98.765.432/0001-10', score: 72 },
  { id: 3, nome: 'Capital + Crédito',     tipo: 'Correspondente', cnpj: '11.222.333/0001-44', score: 91 },
  { id: 4, nome: 'Valor Imobiliário',     tipo: 'Imobiliária',    cnpj: '55.666.777/0001-88', score: 65 },
]

function scoreColor(s: number) {
  if (s >= 80) return '#16A34A'
  if (s >= 70) return '#F59E0B'
  return '#DC2626'
}

export default function Aprovacoes() {
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
          <Text style={s.headerTitle}>Aprovações de Parceiros</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countText}>{pendentes.length} pendentes</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        {pendentes.map(p => {
          const sc = scoreColor(p.score)
          return (
            <View key={p.id} style={s.card}>
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={s.avatarBadge}>
                  <Building2 size={20} color="#e5e5e5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{p.nome}</Text>
                  <Text style={s.cnpj}>{p.cnpj}</Text>
                  <View style={s.tagsRow}>
                    <View style={s.typeTag}>
                      <Text style={s.typeTagText}>{p.tipo}</Text>
                    </View>
                    <View style={[s.scoreTag, { backgroundColor: sc + '20' }]}>
                      <Star size={10} color={sc} />
                      <Text style={[s.scoreTagText, { color: sc }]}>Score {p.score}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Score bar */}
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${p.score}%` as any, backgroundColor: sc }]} />
              </View>

              {/* Actions */}
              <View style={s.actionsRow}>
                <Pressable style={s.btnReject}>
                  <X size={15} color="#DC2626" />
                  <Text style={s.btnRejectText}>Recusar</Text>
                </Pressable>
                <Pressable style={s.btnApprove}>
                  <Check size={15} color="white" />
                  <Text style={s.btnApproveText}>Aprovar</Text>
                </Pressable>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  countPill: { backgroundColor: '#F59E0B22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },

  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  avatarBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  cnpj: { fontSize: 11, color: '#525252', marginTop: 2, fontFamily: 'monospace' },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  typeTag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  typeTagText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },
  scoreTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  scoreTagText: { fontSize: 10, fontWeight: '700' },

  barTrack: { height: 3, backgroundColor: '#2a2a2a', marginHorizontal: 14, borderRadius: 2, marginBottom: 14 },
  barFill: { height: 3, borderRadius: 2 },

  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  btnReject: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#DC262640', borderRadius: 10, paddingVertical: 10 },
  btnRejectText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  btnApprove: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 10 },
  btnApproveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
})
