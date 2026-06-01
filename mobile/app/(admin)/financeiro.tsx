import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, DollarSign, TrendingUp, CheckCircle2, BadgeCheck, AlertTriangle,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface FinSummary {
  volume_mes: number | string; volume_total: number | string; ticket_medio: number | string
  liberacoes_total: number
  comissoes_previstas: number | string; comissoes_aprovadas: number | string; comissoes_pagas: number | string
  comissoes_qtd_prevista: number
  historico_mensal: Array<{ mes: string; qtd: number; volume: number }> | null
}

interface ComissaoRow {
  id: string; proposta_id: string; partner_id: string; percentual: number; valor: number
  status: 'prevista' | 'aprovada' | 'paga'
  paga_em: string | null; aprovada_em: string | null; created_at: string; observacao: string | null
  partner_nome: string | null; partner_email: string | null; protocolo: string | null
}

type Filtro = 'prevista' | 'aprovada' | 'paga' | 'todas'

const cents = (v: number | string) => Math.round(Number(v ?? 0) * 100)

export default function Financeiro() {
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('prevista')
  const [erro, setErro] = useState<string | null>(null)

  const sumQuery = useQuery({
    queryKey: ['admin-fin-sum-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_financeiro_admin').select('*').single()
      if (error) throw error
      return data as FinSummary
    },
  })

  const comQuery = useQuery({
    queryKey: ['admin-fin-com-mobile', filtro],
    queryFn: async () => {
      let q = supabase.from('v_comissoes_admin')
        .select('id, proposta_id, partner_id, percentual, valor, status, paga_em, aprovada_em, created_at, observacao, partner_nome, partner_email, protocolo')
        .order('created_at', { ascending: false })
        .limit(100)
      if (filtro !== 'todas') q = q.eq('status', filtro)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ComissaoRow[]
    },
  })

  const aprovarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('comissao_aprovar', { p_comissao_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fin-com-mobile'] })
      qc.invalidateQueries({ queryKey: ['admin-fin-sum-mobile'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  const pagarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('comissao_marcar_paga', { p_comissao_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fin-com-mobile'] })
      qc.invalidateQueries({ queryKey: ['admin-fin-sum-mobile'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  const sum = sumQuery.data
  const com = comQuery.data ?? []
  const loading = sumQuery.isLoading || comQuery.isLoading
  const refreshing = sumQuery.isFetching || comQuery.isFetching

  function onRefresh() {
    sumQuery.refetch()
    comQuery.refetch()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Financeiro</Text>
        </View>
      </View>

      {loading && !sum ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />}
        >
          {erro && (
            <View style={s.errBox}>
              <AlertTriangle size={14} color="#DC2626" />
              <Text style={s.errText}>{erro}</Text>
            </View>
          )}

          {/* KPIs */}
          <View style={s.grid}>
            <Kpi Icon={DollarSign}  accent="#DC2626" label="Volume mês"
                 value={sum ? brl(cents(sum.volume_mes)) : '—'} />
            <Kpi Icon={TrendingUp}  accent="#F59E0B" label="Ticket médio"
                 value={sum ? brl(cents(sum.ticket_medio)) : '—'} />
            <Kpi Icon={CheckCircle2} accent="#16A34A" label="Comissões pagas"
                 value={sum ? brl(cents(sum.comissoes_pagas)) : '—'} />
            <Kpi Icon={BadgeCheck}  accent="#38BDF8" label="Previstas"
                 value={sum ? brl(cents(sum.comissoes_previstas)) : '—'}
                 sub={sum ? `${sum.comissoes_qtd_prevista} pendente${sum.comissoes_qtd_prevista !== 1 ? 's' : ''}` : ''} />
          </View>

          {/* Histórico mensal */}
          {sum?.historico_mensal && sum.historico_mensal.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Liberações por mês</Text>
              <View style={{ marginTop: 6 }}>
                {sum.historico_mensal.map((m, i) => (
                  <View key={m.mes} style={[s.histRow, i > 0 && s.histRowDivider]}>
                    <Text style={s.histMes}>
                      {new Date(m.mes).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                    </Text>
                    <Text style={s.histQtd}>{m.qtd}</Text>
                    <Text style={s.histVol}>{brl(cents(m.volume))}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Filtros */}
          <View style={s.filterRow}>
            {(['prevista', 'aprovada', 'paga', 'todas'] as Filtro[]).map(f => {
              const active = filtro === f
              return (
                <Pressable key={f} onPress={() => setFiltro(f)} style={[s.filterPill, active && s.filterPillActive]}>
                  <Text style={[s.filterText, active && { color: '#fff' }]}>{f}</Text>
                </Pressable>
              )
            })}
          </View>

          {/* Comissões */}
          {com.length === 0 ? (
            <View style={s.card}>
              <Text style={s.empty}>Nenhuma comissão {filtro !== 'todas' ? filtro : ''}.</Text>
            </View>
          ) : (
            com.map(c => (
              <View key={c.id} style={[s.card, { borderTopWidth: 2, borderTopColor: STATUS_COLOR[c.status] }]}>
                <View style={s.comHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.comNome} numberOfLines={1}>{c.partner_nome ?? '—'}</Text>
                    <Text style={s.comProto}>{c.protocolo ?? '—'} · {new Date(c.created_at).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[c.status] + '22' }]}>
                    <Text style={[s.statusText, { color: STATUS_COLOR[c.status] }]}>{c.status}</Text>
                  </View>
                </View>
                <View style={s.comBody}>
                  <View style={s.comStat}>
                    <Text style={s.comStatLabel}>%</Text>
                    <Text style={s.comStatVal}>{Number(c.percentual).toFixed(2)}%</Text>
                  </View>
                  <View style={s.comDivider} />
                  <View style={s.comStat}>
                    <Text style={s.comStatLabel}>Valor</Text>
                    <Text style={[s.comStatVal, { color: '#DC2626' }]}>{brl(cents(c.valor))}</Text>
                  </View>
                </View>
                {(c.status === 'prevista' || c.status === 'aprovada') && (
                  <View style={s.comActions}>
                    {c.status === 'prevista' && (
                      <Pressable
                        onPress={() => aprovarMut.mutate(c.id)}
                        disabled={aprovarMut.isPending}
                        style={[s.actionBtn, { backgroundColor: '#1f1f1f' }]}>
                        <Text style={s.actionText}>Aprovar</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => pagarMut.mutate(c.id)}
                      disabled={pagarMut.isPending}
                      style={[s.actionBtn, { backgroundColor: '#DC2626' }]}>
                      <Text style={[s.actionText, { color: '#fff' }]}>Marcar paga</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const STATUS_COLOR: Record<string, string> = {
  prevista: '#F59E0B', aprovada: '#38BDF8', paga: '#16A34A',
}

function Kpi({ Icon, accent, label, value, sub }: { Icon: any; accent: string; label: string; value: string; sub?: string }) {
  return (
    <View style={[s.kpiCard, { borderTopColor: accent }]}>
      <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
        <Icon size={14} color={accent} />
      </View>
      <View>
        <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
        <Text style={s.kpiLabel}>{label}</Text>
        {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  errBox: { flexDirection: 'row', gap: 8, backgroundColor: '#DC262615', borderWidth: 1, borderColor: '#DC262640', borderRadius: 10, padding: 10 },
  errText: { color: '#DC2626', fontSize: 12, flex: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 112, backgroundColor: '#141414', borderRadius: 14, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'space-between' },
  iconBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 3 },
  kpiSub: { fontSize: 9, color: '#525252', marginTop: 1 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#737373', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 12 },

  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  histRowDivider: { borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  histMes: { flex: 1, fontSize: 12, color: '#a3a3a3', textTransform: 'capitalize' },
  histQtd: { width: 38, fontSize: 12, color: '#737373', textAlign: 'right' },
  histVol: { width: 110, fontSize: 13, color: '#e5e5e5', fontWeight: '700', textAlign: 'right' },

  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  filterPillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  filterText: { fontSize: 11, fontWeight: '600', color: '#737373', textTransform: 'capitalize' },

  comHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  comNome: { fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  comProto: { fontSize: 11, color: '#525252', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  comBody: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  comStat: { flex: 1, alignItems: 'center' },
  comStatLabel: { fontSize: 9, color: '#525252', textTransform: 'uppercase', fontWeight: '600' },
  comStatVal: { fontSize: 14, fontWeight: '700', color: '#e5e5e5', marginTop: 3 },
  comDivider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },

  comActions: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  actionText: { fontSize: 12, fontWeight: '700', color: '#a3a3a3' },
})

