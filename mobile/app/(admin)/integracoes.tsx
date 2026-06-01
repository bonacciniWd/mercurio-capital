import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, Wifi, WifiOff, Clock, Settings, Zap } from 'lucide-react-native'

const integracoes = [
  { nome: 'Serasa Experian',   cat: 'Bureau',       status: 'Conectado', ultima: '2 min atrás' },
  { nome: 'Bacen SCR',         cat: 'Bureau',       status: 'Conectado', ultima: '5 min atrás' },
  { nome: 'Stripe',            cat: 'Pagamentos',   status: 'Conectado', ultima: 'Em tempo real' },
  { nome: 'WhatsApp Cloud API',cat: 'Comunicação',  status: 'Conectado', ultima: '1 min atrás' },
  { nome: 'D4Sign',            cat: 'Assinatura',   status: 'Conectado', ultima: '12 min atrás' },
  { nome: 'RI Digital',        cat: 'Cartórios',    status: 'Erro',      ultima: '2h atrás' },
  { nome: 'OpenAI',            cat: 'IA',           status: 'Conectado', ultima: 'Em tempo real' },
  { nome: 'Vimeo',             cat: 'Mídia',        status: 'Pendente',  ultima: '—' },
]

const STATUS: Record<string, { color: string; label: string }> = {
  Conectado: { color: '#16A34A', label: 'Conectado' },
  Erro:      { color: '#DC2626', label: 'Erro' },
  Pendente:  { color: '#F59E0B', label: 'Pendente' },
}

const CAT_ACCENT: Record<string, string> = {
  Bureau: '#38BDF8', Pagamentos: '#16A34A', Comunicação: '#A78BFA',
  Assinatura: '#F59E0B', Cartórios: '#F87171', IA: '#DC2626', Mídia: '#737373',
}

export default function Integracoes() {
  const conectados = integracoes.filter(i => i.status === 'Conectado').length
  const erros      = integracoes.filter(i => i.status === 'Erro').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Integrações</Text>
        </View>
        <View style={s.summaryRow}>
          <View style={[s.pill, { backgroundColor: '#16A34A22' }]}>
            <Wifi size={11} color="#16A34A" />
            <Text style={[s.pillText, { color: '#16A34A' }]}>{conectados} ok</Text>
          </View>
          {erros > 0 && (
            <View style={[s.pill, { backgroundColor: '#DC262622' }]}>
              <WifiOff size={11} color="#DC2626" />
              <Text style={[s.pillText, { color: '#DC2626' }]}>{erros} erro</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
        {integracoes.map(i => {
          const st = STATUS[i.status]
          const accent = CAT_ACCENT[i.cat] ?? '#737373'
          return (
            <View key={i.nome} style={[s.card, { borderTopColor: accent }]}>
              <View style={s.cardTop}>
                <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
                  <Text style={[s.iconLabel, { color: accent }]}>{i.nome.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.intName}>{i.nome}</Text>
                  <View style={s.metaRow}>
                    <View style={s.catTag}>
                      <Text style={s.catText}>{i.cat}</Text>
                    </View>
                    <Clock size={10} color="#525252" />
                    <Text style={s.ultima}>{i.ultima}</Text>
                  </View>
                </View>
                <View style={[s.statusPill, { backgroundColor: st.color + '20' }]}>
                  <View style={[s.statusDot, { backgroundColor: st.color }]} />
                  <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>

              <View style={s.actionsRow}>
                <Pressable style={s.btnOutline}>
                  <Settings size={13} color="#737373" />
                  <Text style={s.btnOutlineText}>Configurar</Text>
                </Pressable>
                <Pressable style={s.btnSolid}>
                  <Zap size={13} color="white" />
                  <Text style={s.btnSolidText}>Testar</Text>
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
  summaryRow: { flexDirection: 'row', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },

  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  intName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  catTag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  catText: { fontSize: 9, fontWeight: '600', color: '#737373' },
  ultima: { fontSize: 10, color: '#525252' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  btnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingVertical: 9 },
  btnOutlineText: { fontSize: 12, fontWeight: '600', color: '#737373' },
  btnSolid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#171717', borderRadius: 10, paddingVertical: 9 },
  btnSolidText: { fontSize: 12, fontWeight: '700', color: '#fff' },
})
