import { useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, TrendingUp, BarChart3, FileText, Banknote, Target, Percent,
  Download, FileSpreadsheet, AlertTriangle,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface KpiRow {
  total_propostas: number; propostas_mes: number; ativas: number
  ganhas: number; canceladas: number; taxa_conversao: number
  volume_ganho: number; volume_total: number; parceiros_ativos: number
}
interface TopRow { partner_id: string; partner_nome: string; total: number; ganhas: number; volume: number }
interface FunilRow { partner_id: string; status: string; quantidade: number; volume: number }
interface MesRow { partner_id: string; mes: string; quantidade: number; ganhas: number; volume: number }

const FUNIL_STAGES: { label: string; matches: string[]; color: string }[] = [
  { label: 'Pré-análise', matches: ['pre_analise'], color: '#737373' },
  { label: 'Crédito', matches: ['analise_credito'], color: '#F87171' },
  { label: 'Jurídica', matches: ['analise_juridica'], color: '#F59E0B' },
  { label: 'Comitê', matches: ['comite'], color: '#A78BFA' },
  { label: 'Assinatura', matches: ['aguardando_assinatura', 'em_registro'], color: '#38BDF8' },
  { label: 'Liberada', matches: ['contrato_registrado', 'recurso_liberado'], color: '#16A34A' },
]

type Periodo = '12m' | 'ytd' | 'trimestre'

export default function Relatorios() {
  const [periodo, setPeriodo] = useState<Periodo>('12m')
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const [exportErr, setExportErr] = useState<string | null>(null)

  async function exportar(formato: 'xlsx' | 'pdf') {
    setExportErr(null)
    setExporting(formato)
    try {
      const { data, error } = await supabase.functions.invoke('relatorios-exportar', {
        body: { formato, periodo },
      })
      if (error) throw new Error(error.message)

      // A edge function pode retornar { url } (signed URL pública) ou
      // { storage_path, bucket } para gerarmos a URL no client.
      let signedUrl: string | null = (data && (data as { url?: string }).url) || null
      const sp = data && (data as { storage_path?: string }).storage_path
      const bk = data && (data as { bucket?: string }).bucket
      if (!signedUrl && sp) {
        const { data: u, error: e2 } = await supabase.storage
          .from(bk || 'relatorios')
          .createSignedUrl(sp, 60 * 10)
        if (e2 || !u?.signedUrl) throw new Error(e2?.message ?? 'Falha ao gerar URL.')
        signedUrl = u.signedUrl
      }
      if (!signedUrl) throw new Error('Resposta inválida da função de exportação.')

      // Baixa para cache local e abre o sheet de compartilhar (permite salvar/abrir)
      const ext = formato === 'xlsx' ? 'xlsx' : 'pdf'
      const localUri = FileSystem.cacheDirectory + `relatorio-${periodo}-${Date.now()}.${ext}`
      const dl = await FileSystem.downloadAsync(signedUrl, localUri)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: formato === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
          dialogTitle: `Relatório · ${periodo}`,
          UTI: formato === 'xlsx' ? 'com.microsoft.excel.xlsx' : 'com.adobe.pdf',
        })
      } else {
        await Linking.openURL(signedUrl)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao exportar.'
      setExportErr(msg)
      Alert.alert('Exportação', msg)
    } finally {
      setExporting(null)
    }
  }

  const kpiQuery = useQuery({
    queryKey: ['admin-rel-kpis-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_dashboard_kpis').select('*').maybeSingle()
      if (error) throw error
      return data as KpiRow | null
    },
  })
  const topQuery = useQuery({
    queryKey: ['admin-rel-top-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_top_partners').select('partner_id, partner_nome, total, ganhas, volume')
      if (error) throw error
      return (data ?? []) as TopRow[]
    },
  })
  const funilQuery = useQuery({
    queryKey: ['admin-rel-funil-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_funil_status').select('partner_id, status, quantidade, volume')
      if (error) throw error
      return (data ?? []) as FunilRow[]
    },
  })
  const mesQuery = useQuery({
    queryKey: ['admin-rel-mes-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_propostas_por_mes')
        .select('partner_id, mes, quantidade, ganhas, volume').order('mes')
      if (error) throw error
      return (data ?? []) as MesRow[]
    },
  })

  const kpi = kpiQuery.data
  const ticketMedio = kpi && kpi.ganhas > 0 ? Number(kpi.volume_ganho) / kpi.ganhas : 0

  const monthly = useMemo(() => {
    const rows = mesQuery.data ?? []
    const now = new Date()
    const start = (() => {
      if (periodo === 'ytd') return new Date(now.getFullYear(), 0, 1)
      if (periodo === 'trimestre') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d }
      const d = new Date(now); d.setMonth(d.getMonth() - 12); return d
    })()
    const map = new Map<string, { volume: number; propostas: number }>()
    rows.forEach(r => {
      const d = new Date(r.mes)
      if (d < start) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = map.get(key) ?? { volume: 0, propostas: 0 }
      cur.volume += Number(r.volume) || 0
      cur.propostas += r.quantidade
      map.set(key, cur)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const [yy, mm] = k.split('-')
      const d = new Date(Number(yy), Number(mm) - 1, 1)
      return {
        m: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        volume: v.volume, propostas: v.propostas,
      }
    })
  }, [mesQuery.data, periodo])
  const maxVol = Math.max(1, ...monthly.map(m => m.volume))

  const ranking = useMemo(() => {
    return (topQuery.data ?? []).slice(0, 5).map(t => ({
      nome: t.partner_nome, total: t.total, ganhas: t.ganhas, volume: Number(t.volume),
    }))
  }, [topQuery.data])
  const maxRank = Math.max(1, ...ranking.map(r => r.volume))

  const funil = useMemo(() => {
    const rows = funilQuery.data ?? []
    return FUNIL_STAGES.map(s => ({
      etapa: s.label, color: s.color,
      q: rows.filter(r => s.matches.includes(r.status)).reduce((a, b) => a + b.quantidade, 0),
    }))
  }, [funilQuery.data])
  const maxFunil = Math.max(1, ...funil.map(f => f.q))

  const loading = kpiQuery.isLoading || topQuery.isLoading || funilQuery.isLoading || mesQuery.isLoading

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Relatórios</Text>
        </View>
      </View>

      <View style={s.periodRow}>
        {(['12m', 'ytd', 'trimestre'] as Periodo[]).map(p => {
          const on = periodo === p
          return (
            <Pressable key={p} onPress={() => setPeriodo(p)} style={[s.periodPill, on && s.periodPillActive]}>
              <Text style={[s.periodText, on && { color: '#fff' }]}>

                {p === '12m' ? '12 meses' : p === 'ytd' ? 'YTD' : 'Trimestre'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
          {/* KPIs */}
          <View style={s.grid}>
            <Kpi accent="#DC2626" Icon={Banknote} label="Volume ganho" value={brl(Number(kpi?.volume_ganho ?? 0) * 100)} />
            <Kpi accent="#16A34A" Icon={FileText} label="Propostas/mês" value={String(kpi?.propostas_mes ?? 0)} />
            <Kpi accent="#F59E0B" Icon={Target}   label="Ticket médio" value={brl(ticketMedio * 100)} />
            <Kpi accent="#38BDF8" Icon={Percent}  label="Conversão" value={`${kpi?.taxa_conversao ?? 0}%`} />
          </View>

          {/* Volume mensal */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <TrendingUp size={14} color="#DC2626" />
              <Text style={s.cardTitle}>Volume mensal</Text>
            </View>
            {monthly.length === 0 ? (
              <Text style={s.empty}>Sem dados no período.</Text>
            ) : (
              <View style={s.chartArea}>
                {monthly.map((m, i) => (
                  <View key={i} style={s.barCol}>
                    <View style={[s.bar, { height: `${(m.volume / maxVol) * 100}%` as any }]} />
                    <Text style={s.barLabel}>{m.m}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Top parceiros */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <BarChart3 size={14} color="#DC2626" />
              <Text style={s.cardTitle}>Top 5 parceiros</Text>
            </View>
            {ranking.length === 0 ? (
              <Text style={s.empty}>Sem dados.</Text>
            ) : ranking.map(r => (
              <View key={r.nome} style={{ marginBottom: 10 }}>
                <View style={s.rowBetween}>
                  <Text style={s.parceiroNome} numberOfLines={1}>{r.nome}</Text>
                  <Text style={s.parceiroVol}>{brl(r.volume * 100)}</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${(r.volume / maxRank) * 100}%` as any, backgroundColor: '#DC2626' }]} />
                </View>
                <Text style={s.parceiroSub}>{r.total} propostas · {r.ganhas} ganhas</Text>
              </View>
            ))}
          </View>

          {/* Funil */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <BarChart3 size={14} color="#DC2626" />
              <Text style={s.cardTitle}>Funil de conversão</Text>
            </View>
            {funil.every(f => f.q === 0) ? (
              <Text style={s.empty}>Sem dados.</Text>
            ) : funil.map(f => (
              <View key={f.etapa} style={{ marginBottom: 8 }}>
                <View style={s.rowBetween}>
                  <Text style={s.parceiroNome}>{f.etapa}</Text>
                  <Text style={[s.parceiroVol, { color: f.color }]}>{f.q}</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${(f.q / maxFunil) * 100}%` as any, backgroundColor: f.color }]} />
                </View>
              </View>
            ))}
          </View>

          <Text style={s.exportHint}>Exporte os dados consolidados do período.</Text>
          <View style={s.exportRow}>
            <Pressable
              onPress={() => exportar('xlsx')}
              disabled={!!exporting}
              style={[s.exportBtn, exporting === 'xlsx' && { opacity: 0.6 }]}
            >
              {exporting === 'xlsx'
                ? <ActivityIndicator color="#16A34A" size="small" />
                : <FileSpreadsheet size={14} color="#16A34A" />}
              <Text style={[s.exportBtnText, { color: '#16A34A' }]}>Excel (.xlsx)</Text>
            </Pressable>
            <Pressable
              onPress={() => exportar('pdf')}
              disabled={!!exporting}
              style={[s.exportBtn, exporting === 'pdf' && { opacity: 0.6 }]}
            >
              {exporting === 'pdf'
                ? <ActivityIndicator color="#DC2626" size="small" />
                : <Download size={14} color="#DC2626" />}
              <Text style={[s.exportBtnText, { color: '#DC2626' }]}>PDF</Text>
            </Pressable>
          </View>
          {exportErr && (
            <View style={s.exportErr}>
              <AlertTriangle size={12} color="#DC2626" />
              <Text style={s.exportErrText}>{exportErr}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Kpi({ accent, Icon, label, value }: { accent: string; Icon: any; label: string; value: string }) {
  return (
    <View style={[s.kpiCard, { borderTopColor: accent }]}>
      <View style={[s.iconBadge, { backgroundColor: accent + '22' }]}>
        <Icon size={14} color={accent} />
      </View>
      <View>
        <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
        <Text style={s.kpiLabel}>{label}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },

  periodRow: { flexDirection: 'row', gap: 6, padding: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  periodPill: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#141414', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  periodPillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  periodText: { fontSize: 11, fontWeight: '600', color: '#737373' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 100, backgroundColor: '#141414', borderRadius: 12, padding: 12, borderTopWidth: 2, borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'space-between' },
  iconBadge: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: '#737373', marginTop: 2 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#e5e5e5' },
  empty: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 16 },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 3, backgroundColor: '#DC2626', opacity: 0.9, minHeight: 4 },
  barLabel: { fontSize: 7, color: '#525252', marginTop: 4 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  parceiroNome: { fontSize: 12, color: '#e5e5e5', fontWeight: '600', flex: 1 },
  parceiroVol: { fontSize: 12, fontWeight: '700', color: '#e5e5e5' },
  parceiroSub: { fontSize: 10, color: '#525252', marginTop: 3 },

  track: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },

  exportHint: { fontSize: 11, color: '#525252', textAlign: 'center', marginTop: 6 },
  exportRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingVertical: 11,
  },
  exportBtnText: { fontSize: 12, fontWeight: '700' },
  exportErr: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#DC262615', borderRadius: 8, padding: 8, marginTop: 8,
  },
  exportErrText: { color: '#DC2626', fontSize: 11, flex: 1 },
})
