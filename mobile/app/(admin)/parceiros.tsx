import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import {
  ArrowLeft, Search, Eye, Lock, Building2, FileStack,
  Banknote, Users, TrendingUp,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'

const parceiros = [
  { id: 1, nome: 'Construtora Aurora',    tipo: 'Construtora',    volume: 4_200_000_000, propostas: 12, saldo: 580_000, status: 'Ativo' },
  { id: 2, nome: 'Imobiliária Vista Sul', tipo: 'Imobiliária',    volume: 2_100_000_000, propostas: 7,  saldo: 120_000, status: 'Ativo' },
  { id: 3, nome: 'Capital + Crédito',     tipo: 'Correspondente', volume: 6_800_000_000, propostas: 21, saldo: 950_000, status: 'Ativo' },
  { id: 4, nome: 'Valor Imobiliário',     tipo: 'Imobiliária',    volume: 1_800_000_000, propostas: 5,  saldo: 30_000,  status: 'Bloqueado' },
  { id: 5, nome: 'Norte Crédito',         tipo: 'Correspondente', volume: 950_000_000,   propostas: 3,  saldo: 45_000,  status: 'Inativo' },
]

const STATUS_COLOR: Record<string, string> = {
  Ativo: '#16A34A',
  Bloqueado: '#DC2626',
  Inativo: '#737373',
}

export default function Parceiros() {
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
          <Text style={s.headerTitle}>Parceiros</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>

        {/* KPI grid */}
        <View style={s.grid}>
          <StatCard icon={Users}     accent="#16A34A" label="Ativos"       value="42"                sub="parceiros"       />
          <StatCard icon={Lock}      accent="#DC2626" label="Bloqueados"   value="2"                 sub="em revisão"      />
          <StatCard icon={Banknote}  accent="#F87171" label="Volume total" value={brl(15_850_000_000)} sub="em carteira"  />
          <StatCard icon={FileStack} accent="#F59E0B" label="Propostas"    value="48"                sub="ativas"          />
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Search size={16} color="#525252" />
          <TextInput
            placeholder="Buscar por nome ou CNPJ"
            placeholderTextColor="#525252"
            style={s.searchInput}
          />
        </View>

        {/* Partner cards */}
        {parceiros.map(p => {
          const color = STATUS_COLOR[p.status]
          const blocked = p.status === 'Bloqueado'
          return (
            <View key={p.id} style={[s.card, blocked && { borderColor: '#DC262630' }]}>
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={[s.avatarBadge, { backgroundColor: color + '22' }]}>
                  <Building2 size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{p.nome}</Text>
                  <Text style={s.partnerType}>{p.tipo}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: color + '20' }]}>
                  <View style={[s.statusDot, { backgroundColor: color }]} />
                  <Text style={[s.statusText, { color }]}>{p.status}</Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={s.statsRow}>
                <Stat label="Volume"    value={brl(p.volume)}      />
                <View style={s.divider} />
                <Stat label="Propostas" value={String(p.propostas)} />
                <View style={s.divider} />
                <Stat label="Saldo"     value={brl(p.saldo)}       alert={p.saldo < 200_000} />
              </View>

              {/* Actions */}
              <View style={s.actionsRow}>
                <Pressable style={s.btnOutline}>
                  <Eye size={14} color="#e5e5e5" />
                  <Text style={s.btnOutlineText}>Ver detalhes</Text>
                </Pressable>
                <Pressable style={[s.btnOutline, { borderColor: color + '60' }]}>
                  <Lock size={14} color={color} />
                  <Text style={[s.btnOutlineText, { color }]}>
                    {blocked ? 'Desbloquear' : 'Bloquear'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        })}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, accent, label, value, sub }: {
  icon: any; accent: string; label: string; value: string; sub?: string
}) {
  return (
    <View style={[s.statCard, { borderTopColor: accent }]}>
      <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
        <Icon size={15} color={accent} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
    </View>
  )
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.inlineStatLabel}>{label}</Text>
      <Text style={[s.inlineStatValue, alert && { color: '#DC2626' }]}>{value}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  // KPI grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: '#141414', borderRadius: 14, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  iconBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: '#737373', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 10, color: '#525252', marginTop: 1 },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, fontSize: 14, color: '#e5e5e5' },

  // Partner card
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatarBadge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  partnerType: { fontSize: 11, color: '#525252', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1f1f1f', paddingVertical: 12 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  inlineStatLabel: { fontSize: 10, color: '#525252', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  inlineStatValue: { fontSize: 13, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  btnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingVertical: 9 },
  btnOutlineText: { fontSize: 12, fontWeight: '600', color: '#e5e5e5' },
})
