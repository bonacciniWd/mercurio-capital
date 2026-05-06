import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Search, AlertTriangle, AlertCircle, User, LogIn, ArrowRightLeft, DollarSign, Settings } from 'lucide-react-native'
import { Pressable } from 'react-native'

const logs = [
  { id: 1, user: 'admin@mercurio',     action: 'Aprovou parceiro',    target: 'Aurora',                    ip: '177.45.x', time: '10:32', sev: null    },
  { id: 2, user: 'analista@mercurio', action: 'Movimentou proposta',  target: 'MC-2024-0042 → Crédito',    ip: '177.45.x', time: '10:28', sev: null    },
  { id: 3, user: 'admin@mercurio',    action: 'Atualizou preço',      target: 'Serasa PF: R$490',          ip: '177.45.x', time: '09:55', sev: null    },
  { id: 4, user: 'comite@mercurio',   action: 'Aprovou crédito',      target: 'MC-2024-0078 · R$ 480k',   ip: '177.45.x', time: '09:40', sev: 'high'  },
  { id: 5, user: 'system',            action: 'Falha integração',     target: 'RI Digital · timeout',      ip: '—',        time: '08:12', sev: 'error' },
  { id: 6, user: 'parceiro@aurora',   action: 'Login',                target: 'iPhone 15 · iOS 18',        ip: '189.20.x', time: '08:00', sev: null    },
]

const ACTION_ICON: Record<string, any> = {
  'Aprovou parceiro': User,
  'Movimentou proposta': ArrowRightLeft,
  'Atualizou preço': DollarSign,
  'Aprovou crédito': DollarSign,
  'Falha integração': AlertCircle,
  'Login': LogIn,
}

export default function Auditoria() {
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
          <Text style={s.headerTitle}>Auditoria</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countText}>{logs.length} eventos</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Search size={16} color="#525252" />
        <TextInput
          placeholder="Buscar por usuário, ação ou IP"
          placeholderTextColor="#525252"
          style={s.searchInput}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
        {logs.map(l => {
          const Icon = ACTION_ICON[l.action] ?? Settings
          const isError = l.sev === 'error'
          const isHigh  = l.sev === 'high'
          const accent  = isError ? '#DC2626' : isHigh ? '#F59E0B' : '#2a2a2a'
          const accentText = isError ? '#DC2626' : isHigh ? '#F59E0B' : '#525252'
          return (
            <View key={l.id} style={[s.card, { borderTopColor: accent }]}>
              <View style={s.cardTop}>
                <View style={[s.iconBadge, { backgroundColor: accent === '#2a2a2a' ? '#262626' : accent + '22' }]}>
                  <Icon size={14} color={accent === '#2a2a2a' ? '#737373' : accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.action}>{l.action}</Text>
                  <Text style={s.target}>{l.target}</Text>
                </View>
                <Text style={s.time}>{l.time}</Text>
              </View>
              <View style={s.cardFooter}>
                <Text style={s.user}>{l.user}</Text>
                <Text style={s.ip}>IP: {l.ip}</Text>
                {(isError || isHigh) && (
                  <View style={[s.sevPill, { backgroundColor: accentText + '20' }]}>
                    <AlertTriangle size={10} color={accentText} />
                    <Text style={[s.sevText, { color: accentText }]}>{isError ? 'Erro' : 'Alta criticidade'}</Text>
                  </View>
                )}
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
  countPill: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '600', color: '#737373' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0, backgroundColor: '#141414', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, fontSize: 14, color: '#e5e5e5' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  iconBadge: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  action: { fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  target: { fontSize: 11, color: '#525252', marginTop: 2 },
  time: { fontSize: 11, color: '#404040', fontWeight: '600' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10, flexWrap: 'wrap' },
  user: { fontSize: 10, color: '#404040', fontFamily: 'monospace', flex: 1 },
  ip: { fontSize: 10, color: '#404040' },
  sevPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  sevText: { fontSize: 10, fontWeight: '700' },
})
