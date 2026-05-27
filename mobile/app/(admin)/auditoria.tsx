import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, AlertTriangle, AlertCircle, Settings } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'

type AuditRow = {
  id: string
  usuario_id: string | null
  acao: string
  entidade: string
  entidade_id: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
  payload_depois: any
  usuario: { nome_completo: string | null; email: string | null } | null
}

const SEV_ACTIONS = new Set(['delete', 'reject', 'suspend', 'error', 'falha'])

export default function Auditoria() {
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-auditoria-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, usuario_id, acao, entidade, entidade_id, ip, user_agent, created_at, payload_depois, usuario:usuarios(nome_completo, email)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as AuditRow[]
    },
  })

  const logs = data ?? []
  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return logs
    return logs.filter(l =>
      [l.acao, l.entidade, l.usuario?.email, l.usuario?.nome_completo, l.ip].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [logs, q])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
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

      <View style={s.searchBar}>
        <Search size={16} color="#525252" />
        <TextInput
          placeholder="Buscar por usuário, ação ou entidade"
          placeholderTextColor="#525252"
          style={s.searchInput}
          value={q}
          onChangeText={setQ}
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#DC2626" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
          {filtrados.length === 0 ? (
            <Text style={{ color: '#737373', textAlign: 'center', padding: 32 }}>Nenhum evento.</Text>
          ) : filtrados.map(l => {
            const isHigh = SEV_ACTIONS.has(l.acao.toLowerCase()) || /erro|falha|reject|delete/i.test(l.acao)
            const accent = isHigh ? '#F59E0B' : '#2a2a2a'
            const accentText = isHigh ? '#F59E0B' : '#525252'
            const date = new Date(l.created_at)
            const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            return (
              <View key={l.id} style={[s.card, { borderTopColor: accent }]}>

                <View style={s.cardTop}>
                  <View style={[s.iconBadge, { backgroundColor: accent === '#2a2a2a' ? '#262626' : accent + '22' }]}>

                    {isHigh ? <AlertCircle size={14} color={accentText} /> : <Settings size={14} color="#737373" />}

                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.action}>{l.acao}</Text>
                    <Text style={s.target} numberOfLines={1}>{l.entidade}{l.entidade_id ? ` · ${l.entidade_id.slice(0, 8)}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.time}>{time}</Text>
                    <Text style={s.day}>{day}</Text>
                  </View>
                </View>

                <View style={s.cardFooter}>
                  <Text style={s.user} numberOfLines={1}>{l.usuario?.email ?? l.usuario?.nome_completo ?? 'sistema'}</Text>
                  {l.ip ? <Text style={s.ip}>IP: {l.ip}</Text> : null}
                  {isHigh ? (
                    <View style={[s.sevPill, { backgroundColor: accentText + '20' }]}>

                      <AlertTriangle size={10} color={accentText} />
                      <Text style={[s.sevText, { color: accentText }]}>Atenção</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )
          })}
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
  countPill: { backgroundColor: '#262626', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '600', color: '#737373' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0, backgroundColor: '#141414', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, fontSize: 14, color: '#e5e5e5' },
  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  iconBadge: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  action: { fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  target: { fontSize: 11, color: '#525252', marginTop: 2 },
  time: { fontSize: 11, color: '#a3a3a3', fontWeight: '700' },
  day: { fontSize: 10, color: '#404040', marginTop: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10, flexWrap: 'wrap' },
  user: { fontSize: 10, color: '#525252', fontFamily: 'monospace', flex: 1 },
  ip: { fontSize: 10, color: '#404040' },
  sevPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  sevText: { fontSize: 10, fontWeight: '700' },
})
