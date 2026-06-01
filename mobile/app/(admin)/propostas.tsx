import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, TrendingUp, Search } from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { calcularLTV } from '@/lib/credito'
import { supabase } from '@/lib/supabase'

type Row = {
  id: string; protocolo: string | null; produto: string; status: string
  valor_solicitado: number; valor_imoveis_total: number; prazo_meses: number
  created_at: string; updated_at: string
  partner: { usuario: { nome_completo: string | null } | null } | null
  cliente: { nome_completo: string; cpf: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho', pre_analise: 'Pré-análise', analise_credito: 'Análise Crédito',
  analise_imovel: 'Análise Imóvel', analise_juridica: 'Análise Jurídica', comite: 'Comitê',
  proposta_cliente: 'Proposta', resolucao_pendencias: 'Pendências',
  emissao_contrato: 'Emissão', aguardando_assinatura: 'Assinatura',
  em_registro: 'Registro', contrato_registrado: 'Registrado',
  recurso_liberado: 'Liberado', cancelado: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  simulacao: '#737373', pre_analise: '#737373', analise_credito: '#F59E0B',
  analise_imovel: '#F59E0B', analise_juridica: '#F87171', comite: '#A78BFA',
  proposta_cliente: '#38BDF8', resolucao_pendencias: '#F59E0B',
  emissao_contrato: '#38BDF8', aguardando_assinatura: '#38BDF8',
  em_registro: '#A78BFA', contrato_registrado: '#16A34A',
  recurso_liberado: '#16A34A', cancelado: '#DC2626',
}
const STATUS_FINAIS = new Set(['contrato_registrado', 'recurso_liberado', 'cancelado'])

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function Propostas() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['admin-propostas-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, created_at, updated_at, partner:partners(usuario:usuarios(nome_completo)), cliente:clientes(nome_completo, cpf)')
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data || []) as unknown as Row[]
    },
  })

  const list = data ?? []
  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter(p =>
      [p.protocolo, p.cliente?.nome_completo, p.cliente?.cpf, p.partner?.usuario?.nome_completo]
        .filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [list, q])

  const ativas = useMemo(() => list.filter(p => !STATUS_FINAIS.has(p.status)), [list])
  const volume = ativas.reduce((s, p) => s + Number(p.valor_solicitado || 0), 0) * 100
  const liberadas = list.filter(p => p.status === 'recurso_liberado' || p.status === 'contrato_registrado').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Propostas</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countText}>{ativas.length} ativas</Text>
        </View>
      </View>

      <View style={s.kpiStrip}>
        <View style={[s.kpiItem, { borderTopColor: '#F59E0B' }]}>
          <Text style={s.kpiValue}>{ativas.length}</Text>
          <Text style={s.kpiLabel}>Ativas</Text>
        </View>
        <View style={[s.kpiItem, { borderTopColor: '#DC2626' }]}>
          <Text style={s.kpiValue} numberOfLines={1}>{brl(volume)}</Text>
          <Text style={s.kpiLabel}>Volume</Text>
        </View>
        <View style={[s.kpiItem, { borderTopColor: '#16A34A' }]}>
          <Text style={s.kpiValue}>{liberadas}</Text>
          <Text style={s.kpiLabel}>Liberados</Text>
        </View>
      </View>

      <View style={s.searchRow}>
        <Search size={16} color="#525252" />
        <TextInput
          placeholder="Protocolo, cliente ou parceiro"
          placeholderTextColor="#525252"
          style={s.searchInput}
          value={q}
          onChangeText={setQ}
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}
          ListEmptyComponent={<Text style={{ color: '#737373', textAlign: 'center', padding: 32 }}>Nenhuma proposta.</Text>}
          renderItem={({ item: p }) => {
            const dias = diasDesde(p.created_at)
            const overdue = dias > 7
            const ltvPct = Math.round(calcularLTV(Number(p.valor_solicitado || 0), Number(p.valor_imoveis_total || 0)) * 100)
            const ltvHigh = ltvPct > 60
            const color = STATUS_COLOR[p.status] ?? '#737373'
            return (
              <Pressable
                onPress={() => router.push(`/(admin)/proposta/${p.id}` as any)}
                style={[s.card, { borderTopColor: color }]}>
                <View style={s.cardTop}>
                  <Text style={s.cardId} numberOfLines={1}>{p.protocolo ?? p.id.slice(0, 8)}</Text>
                  <View style={[s.statusPill, { backgroundColor: color + '22' }]}>
                    <View style={[s.statusDot, { backgroundColor: color }]} />
                    <Text style={[s.statusText, { color }]}>{STATUS_LABEL[p.status] ?? p.status}</Text>
                  </View>
                </View>
                <Text style={s.clientName} numberOfLines={1}>{p.cliente?.nome_completo ?? '—'}</Text>
                <Text style={s.parceiro} numberOfLines={1}>via {p.partner?.usuario?.nome_completo ?? '—'}</Text>
                <View style={s.cardFooter}>
                  <Text style={s.valor}>{brl(Number(p.valor_solicitado || 0) * 100)}</Text>
                  <View style={s.badges}>
                    {ltvPct > 0 ? (
                      <View style={[s.ltvBadge, { backgroundColor: ltvHigh ? '#F59E0B18' : '#16A34A18' }]}>
                        <TrendingUp size={10} color={ltvHigh ? '#F59E0B' : '#16A34A'} />
                        <Text style={[s.ltvText, { color: ltvHigh ? '#F59E0B' : '#16A34A' }]}>LTV {ltvPct}%</Text>
                      </View>
                    ) : null}
                    <View style={s.daysRow}>
                      <Clock size={11} color={overdue ? '#DC2626' : '#525252'} />
                      <Text style={[s.daysText, overdue && { color: '#DC2626', fontWeight: '700' }]}>{dias}d</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  countPill: { backgroundColor: '#16A34A22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  kpiStrip: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  kpiItem: { flex: 1, backgroundColor: '#141414', borderRadius: 12, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a' },
  kpiValue: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', borderRadius: 12, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, fontSize: 13, color: '#e5e5e5' },
  card: { backgroundColor: '#141414', borderRadius: 14, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  cardId: { fontSize: 10, color: '#525252', fontFamily: 'monospace', letterSpacing: 0.5, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#e5e5e5' },
  parceiro: { fontSize: 11, color: '#525252', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  valor: { fontSize: 16, fontWeight: '800', color: '#DC2626', letterSpacing: -0.3 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ltvBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  ltvText: { fontSize: 10, fontWeight: '700' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { fontSize: 11, color: '#525252' },
})
