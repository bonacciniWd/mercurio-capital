import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock } from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { FUNDO_STATUS_COLOR, type FundoStatus } from '@/lib/fundoStatus'

type Row = {
  id: string; protocolo: string | null; status: string
  valor_solicitado: number; created_at: string; updated_at: string
  cliente: { nome_completo: string } | null
}

type FundoBadge = { fundo_id: string; nome: string; cor_hex: string; status_fundo: FundoStatus }

// Agrupa status enum em colunas de kanban
const COLS_DEF: { id: string; label: string; accent: string; statuses: string[] }[] = [
  { id: 'pre',  label: 'Pré-análise', accent: '#737373', statuses: ['simulacao', 'pre_analise'] },
  { id: 'cred', label: 'Crédito',     accent: '#F59E0B', statuses: ['analise_credito', 'analise_imovel'] },
  { id: 'jur',  label: 'Jurídico',    accent: '#F87171', statuses: ['analise_juridica'] },
  { id: 'com',  label: 'Comitê',      accent: '#A78BFA', statuses: ['comite', 'proposta_cliente', 'resolucao_pendencias'] },
  { id: 'ass',  label: 'Assinatura',  accent: '#38BDF8', statuses: ['emissao_contrato', 'aguardando_assinatura', 'em_registro'] },
  { id: 'lib',  label: 'Liberado',    accent: '#16A34A', statuses: ['contrato_registrado', 'recurso_liberado'] },
]

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function Kanban() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-kanban-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, status, valor_solicitado, created_at, updated_at, cliente:clientes(nome_completo)')
        .neq('status', 'cancelado')
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data || []) as unknown as Row[]
    },
  })

  const cols = useMemo(() => {
    const list = data ?? []
    return COLS_DEF.map(c => ({
      ...c,
      items: list.filter(p => c.statuses.includes(p.status)),
    }))
  }, [data])

  const { data: fundosRows } = useQuery({
    queryKey: ['admin-kanban-mobile-fundos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_fundos')
        .select('proposta_id, status_fundo, fundos(id, nome, cor_hex)')
      if (error) throw error
      return (data ?? []) as unknown as { proposta_id: string; status_fundo: FundoStatus; fundos: { id: string; nome: string; cor_hex: string } | null }[]
    },
  })

  const fundosByProposta = useMemo(() => {
    const map = new Map<string, FundoBadge[]>()
    for (const r of fundosRows ?? []) {
      if (!r.fundos) continue
      const list = map.get(r.proposta_id) ?? (map.set(r.proposta_id, []), map.get(r.proposta_id)!)
      list.push({ fundo_id: r.fundos.id, nome: r.fundos.nome, cor_hex: r.fundos.cor_hex, status_fundo: r.status_fundo })
    }
    return map
  }, [fundosRows])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Kanban de Propostas</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, padding: 16, paddingRight: 24 }}
          style={{ flex: 1 }}
        >
          {cols.map(c => (
            <View key={c.id} style={[s.col, { borderTopColor: c.accent }]}>

              <View style={s.colHeader}>
                <View style={[s.colDot, { backgroundColor: c.accent }]} />
                <Text style={s.colLabel}>{c.label}</Text>
                <View style={[s.colBadge, { backgroundColor: c.accent + '22' }]}>

                  <Text style={[s.colBadgeText, { color: c.accent }]}>{c.items.length}</Text>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                {c.items.length === 0 ? (
                  <Text style={{ color: '#525252', fontSize: 11, paddingVertical: 12, textAlign: 'center' }}>Vazio</Text>
                ) : c.items.slice(0, 30).map(p => {
                  const dias = diasDesde(p.updated_at)
                  const overdue = dias > 7
                  return (
                    <Pressable key={p.id} style={s.card} onPress={() => router.push(`/(admin)/proposta/${p.id}` as any)}>
                      <Text style={s.cardId} numberOfLines={1}>{p.protocolo ?? p.id.slice(0, 8)}</Text>
                      <Text style={s.cardClient} numberOfLines={1}>{p.cliente?.nome_completo ?? '—'}</Text>
                      <Text style={s.cardValue}>{brl(Number(p.valor_solicitado || 0) * 100)}</Text>
                      {(fundosByProposta.get(p.id)?.length ?? 0) > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          {fundosByProposta.get(p.id)!.map(f => (
                            <View key={f.fundo_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: f.cor_hex }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: FUNDO_STATUS_COLOR[f.status_fundo], borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' }} />
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }} numberOfLines={1}>{f.nome}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={s.cardFooter}>
                        <View style={[s.stagePill, { backgroundColor: c.accent + '22' }]}>

                          <Text style={[s.stagePillText, { color: c.accent }]}>{c.label}</Text>
                        </View>
                        <View style={s.daysRow}>
                          <Clock size={10} color={overdue ? '#DC2626' : '#525252'} />
                          <Text style={[s.daysText, overdue && { color: '#DC2626', fontWeight: '700' }]}>{dias}d</Text>
                        </View>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </View>
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
  col: { width: 240, backgroundColor: '#141414', borderRadius: 16, padding: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', alignSelf: 'flex-start' },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  colDot: { width: 7, height: 7, borderRadius: 4 },
  colLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  colBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  colBadgeText: { fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#1c1c1c', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  cardId: { fontSize: 10, color: '#525252', fontFamily: 'monospace', letterSpacing: 0.5 },
  cardClient: { fontSize: 14, fontWeight: '600', color: '#e5e5e5', marginTop: 3 },
  cardValue: { fontSize: 13, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stagePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  stagePillText: { fontSize: 10, fontWeight: '600' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { fontSize: 11, color: '#525252' },
})
