import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Plus, BookOpen, FileText, HelpCircle, Users, PlayCircle } from 'lucide-react-native'

const cursos = [
  { id: 1, titulo: 'Fundamentos do Crédito Imobiliário', cat: 'Crédito',     status: 'Publicado', aulas: 12, alunos: 142, accent: '#DC2626' },
  { id: 2, titulo: 'Vendas Consultivas',                  cat: 'Vendas',      status: 'Publicado', aulas: 8,  alunos: 98,  accent: '#DC2626' },
  { id: 3, titulo: 'Documentação para Construção',        cat: 'Operacional', status: 'Rascunho',  aulas: 5,  alunos: 0,   accent: '#DC2626' },
]

export default function Universidade() {
  const totalAulas  = cursos.reduce((s, c) => s + c.aulas, 0)
  const totalAlunos = cursos.reduce((s, c) => s + c.alunos, 0)

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
          <Text style={s.headerTitle}>Universidade Mercurio</Text>
        </View>
        <Pressable style={s.newBtn}>
          <Plus size={15} color="white" />
          <Text style={s.newBtnText}>Novo</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* KPI strip */}
        <View style={s.kpiRow}>
          <View style={[s.kpiCard, { borderTopColor: '#DC2626' }]}>
            <BookOpen size={14} color="#DC2626" style={{ marginBottom: 8 }} />
            <Text style={s.kpiValue}>{cursos.length}</Text>
            <Text style={s.kpiLabel}>Cursos</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#F59E0B' }]}>
            <PlayCircle size={14} color="#F59E0B" style={{ marginBottom: 8 }} />
            <Text style={s.kpiValue}>{totalAulas}</Text>
            <Text style={s.kpiLabel}>Aulas</Text>
          </View>
          <View style={[s.kpiCard, { borderTopColor: '#16A34A' }]}>
            <Users size={14} color="#16A34A" style={{ marginBottom: 8 }} />
            <Text style={s.kpiValue}>{totalAlunos}</Text>
            <Text style={s.kpiLabel}>Alunos</Text>
          </View>
        </View>

        {/* Course cards */}
        {cursos.map(c => {
          const published = c.status === 'Publicado'
          return (
            <Pressable key={c.id} style={[s.card, { borderTopColor: c.accent }]}>
              <View style={s.cardTop}>
                <View style={[s.iconBadge, { backgroundColor: c.accent + '22' }]}>
                  <BookOpen size={18} color={c.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.courseTitle}>{c.titulo}</Text>
                  <View style={s.tagsRow}>
                    <View style={s.catTag}>
                      <Text style={s.catText}>{c.cat}</Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: (published ? '#16A34A' : '#F59E0B') + '20' }]}>
                      <View style={[s.statusDot, { backgroundColor: published ? '#16A34A' : '#F59E0B' }]} />
                      <Text style={[s.statusText, { color: published ? '#16A34A' : '#F59E0B' }]}>{c.status}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={s.courseStats}>
                <View style={s.stat}>
                  <PlayCircle size={12} color="#525252" />
                  <Text style={s.statText}>{c.aulas} aulas</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Users size={12} color="#525252" />
                  <Text style={s.statText}>{c.alunos} alunos</Text>
                </View>
              </View>
            </Pressable>
          )
        })}

        {/* Quick links */}
        <View style={s.quickRow}>
          <Pressable style={s.quickBtn}>
            <FileText size={16} color="#e5e5e5" />
            <Text style={s.quickText}>Documentos</Text>
          </Pressable>
          <Pressable style={s.quickBtn}>
            <HelpCircle size={16} color="#e5e5e5" />
            <Text style={s.quickText}>FAQ</Text>
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
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 2 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  courseTitle: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', gap: 6 },
  catTag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 9, fontWeight: '600', color: '#737373' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },

  courseStats: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingHorizontal: 14, paddingVertical: 10 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 12, color: '#525252' },
  statDivider: { width: 1, height: 18, backgroundColor: '#2a2a2a', marginHorizontal: 8 },

  quickRow: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', paddingVertical: 14 },
  quickText: { fontSize: 13, fontWeight: '600', color: '#e5e5e5' },
})
