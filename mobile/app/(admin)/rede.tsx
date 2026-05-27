import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Network as NetIcon, ChevronRight, Users, GitBranch, CheckCircle2, UserCheck, Send } from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type FunilRow = {
  convidados: number; ativaram: number; enviaram_docs: number
  aprovados: number; com_proposta: number; com_comissao_paga: number
}

type TopRow = {
  partner_id: string; nome: string; equipes_count: number; membros_count: number
  propostas_total: number; volume_solicitado: number
}

export default function Rede() {
  const funilQ = useQuery({
    queryKey: ['admin-funil-parceiros-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_funil_parceiros')
        .select('convidados, ativaram, enviaram_docs, aprovados, com_proposta, com_comissao_paga')
        .maybeSingle()
      if (error) throw error
      return data as FunilRow | null
    },
  })

  const topQ = useQuery({
    queryKey: ['admin-rede-top-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('partner_id, nome, equipes_count, membros_count, propostas_total, volume_solicitado')
        .eq('status', 'approved')
        .order('volume_solicitado', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as TopRow[]
    },
  })

  const f = funilQ.data
  const top = topQ.data ?? []
  const loading = funilQ.isLoading || topQ.isLoading

  const STAGES = [
    { label: 'Convidados',       value: f?.convidados ?? 0,         icon: Send,        color: '#737373' },
    { label: 'Ativaram',         value: f?.ativaram ?? 0,           icon: UserCheck,   color: '#38BDF8' },
    { label: 'Enviaram docs',    value: f?.enviaram_docs ?? 0,      icon: Users,       color: '#A78BFA' },
    { label: 'Aprovados',        value: f?.aprovados ?? 0,          icon: CheckCircle2,color: '#16A34A' },
    { label: 'Com proposta',     value: f?.com_proposta ?? 0,       icon: GitBranch,   color: '#F59E0B' },
    { label: 'Com comissão paga',value: f?.com_comissao_paga ?? 0,  icon: NetIcon,     color: '#DC2626' },
  ]
  const maxV = Math.max(1, ...STAGES.map(s2 => s2.value))

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Rede de Parceiros</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#DC2626" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Funil de aquisição</Text>
            <View style={{ gap: 10, marginTop: 14 }}>
              {STAGES.map(st => (
                <View key={st.label}>
                  <View style={s.funilRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <st.icon size={13} color={st.color} />
                      <Text style={s.funilLabel}>{st.label}</Text>
                    </View>
                    <Text style={[s.funilCount, { color: st.color }]}>{st.value}</Text>
                  </View>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${(st.value / maxV) * 100}%` as any, backgroundColor: st.color }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text style={s.sectionLabel}>TOP PARCEIROS · VOLUME</Text>

          {top.length === 0 ? (
            <Text style={{ color: '#737373', textAlign: 'center', padding: 16 }}>Sem parceiros aprovados.</Text>
          ) : top.map(t => (
            <Pressable key={t.partner_id} style={s.partnerCard} onPress={() => router.push('/(admin)/parceiros' as any)}>
              <View style={[s.avatarBadge, { backgroundColor: '#DC262622' }]}>
                <NetIcon size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.masterName} numberOfLines={1}>{t.nome}</Text>
                <View style={s.tagsRow}>
                  <View style={s.tag}><Text style={s.tagText}>{t.equipes_count} equipe(s)</Text></View>
                  <View style={s.tag}><Text style={s.tagText}>{t.membros_count} membros</Text></View>
                  <View style={s.tag}><Text style={s.tagText}>{t.propostas_total} propostas</Text></View>
                </View>
                <Text style={s.empresa}>{brl(Number(t.volume_solicitado) * 100)} em volume</Text>
              </View>
              <ChevronRight size={18} color="#404040" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  sectionLabel: { fontSize: 10, letterSpacing: 1.2, color: '#525252', fontWeight: '700' },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  funilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  funilLabel: { fontSize: 12, color: '#a3a3a3' },
  funilCount: { fontSize: 13, fontWeight: '700' },
  barTrack: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#141414', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  avatarBadge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  masterName: { fontSize: 14, fontWeight: '700', color: '#e5e5e5' },
  empresa: { fontSize: 11, color: '#DC2626', marginTop: 6, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  tag: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },
})
