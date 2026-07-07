import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, KanbanSquare, ClipboardCheck, Users, FileText, Network,
  Megaphone, Wallet, Tag, Workflow, Plug, GraduationCap, ScrollText, BarChart3, Settings,
  LogOut, TrendingUp, AlertTriangle, CheckCircle2, Activity,
  DollarSign, FileCode, Flag,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { NotificationsSheet } from '@/components/NotificationsSheet'

const items = [
  { href: '/(admin)/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, color: '#DC2626' },
  { href: '/(admin)/kanban',         label: 'Kanban',        icon: KanbanSquare,    color: '#B91C1C' },
  { href: '/(admin)/aprovacoes',     label: 'Aprovações',    icon: ClipboardCheck,  color: '#F59E0B' },
  { href: '/(admin)/parceiros',      label: 'Parceiros',     icon: Users,           color: '#16A34A' },
  { href: '/(admin)/propostas',      label: 'Propostas',     icon: FileText,        color: '#525252' },
  { href: '/(admin)/rede',           label: 'Rede',          icon: Network,         color: '#525252' },
  { href: '/(admin)/campanhas',      label: 'Campanhas',     icon: Megaphone,       color: '#DC2626' },
  { href: '/(admin)/carteiras',      label: 'Carteiras',     icon: Wallet,          color: '#DC2626' },
  { href: '/(admin)/financeiro',     label: 'Financeiro',    icon: DollarSign,      color: '#16A34A' },
  { href: '/(admin)/precos',         label: 'Preços',        icon: Tag,             color: '#A78BFA' },
  { href: '/(admin)/fluxos',         label: 'Fluxos',        icon: Workflow,        color: '#525252' },
  { href: '/(admin)/templates',      label: 'Templates',     icon: FileCode,        color: '#A78BFA' },
  { href: '/(admin)/integracoes',    label: 'Integrações',   icon: Plug,            color: '#B91C1C' },
  { href: '/(admin)/universidade',   label: 'Universidade',  icon: GraduationCap,   color: '#DC2626' },
  { href: '/(admin)/auditoria',      label: 'Auditoria',     icon: ScrollText,      color: '#DC2626' },
  { href: '/(admin)/relatorios',     label: 'Relatórios',    icon: BarChart3,       color: '#16A34A' },
  { href: '/(admin)/feature-flags',  label: 'Feature Flags', icon: Flag,            color: '#38BDF8' },
  { href: '/(admin)/configuracoes',  label: 'Configurações', icon: Settings,        color: '#9CA3AF' },
] as const

const FUNIL_STAGES: { label: string; matches: string[] }[] = [
  { label: 'Pré-análise',  matches: ['pre_analise'] },
  { label: 'Crédito',      matches: ['analise_credito'] },
  { label: 'Comitê',       matches: ['comite'] },
  { label: 'Assinatura',   matches: ['aguardando_assinatura', 'em_registro'] },
  { label: 'Liberada',     matches: ['contrato_registrado', 'recurso_liberado'] },
]

const SEV: Record<string, { bg: string; text: string }> = {
  danger:  { bg: '#DC262622', text: '#DC2626' },
  warning: { bg: '#F59E0B22', text: '#B45309' },
  success: { bg: '#16A34A22', text: '#16A34A' },
  info:    { bg: '#38BDF822', text: '#0369A1' },
}

function tomFromAcao(acao: string): keyof typeof SEV {
  const a = acao.toLowerCase()
  if (/delete|reject|suspend|error|falha|bloqueio/.test(a)) return 'danger'
  if (/pending|aguardando|warning|aprovar|review/.test(a)) return 'warning'
  if (/approve|aprovad|create|insert|liberado|paga/.test(a)) return 'success'
  return 'info'
}

function tempoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

export default function AdminHome() {
  const { signOut } = useAuth()

  const kpiQuery = useQuery({
    queryKey: ['admin-mobile-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_admin_dashboard_kpis').select('*').maybeSingle()
      if (error) throw error
      return data as {
        total_propostas: number; propostas_mes: number; ativas: number; ganhas: number
        canceladas: number; taxa_conversao: number; volume_ganho: number; volume_total: number
        parceiros_ativos: number
      } | null
    },
  })

  const aprovQuery = useQuery({
    queryKey: ['admin-home-aprov-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('v_admin_partner_aprovacoes')
        .select('partner_id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
  })

  const gargaloQuery = useQuery({
    queryKey: ['admin-home-gargalos-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('v_partner_gargalos')
        .select('id', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
  })

  const activityQuery = useQuery({
    queryKey: ['admin-mobile-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, acao, entidade, created_at, usuario:usuarios(nome_completo, email)')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as unknown as Array<{
        id: string; acao: string; entidade: string; created_at: string
        usuario: { nome_completo: string | null; email: string | null } | null
      }>
    },
  })

  const funilQuery = useQuery({
    queryKey: ['admin-mobile-funil-home'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_funil_status')
        .select('status, quantidade')
      if (error) throw error
      return (data ?? []) as Array<{ status: string; quantidade: number }>
    },
  })

  const metaQuery = useQuery({
    queryKey: ['admin-meta-volume'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_sistema')
        .select('valor')
        .eq('chave', 'meta_volume_mensal')
        .maybeSingle()
      if (error) throw error
      return (data?.valor as { centavos: number } | null)?.centavos ?? 50_000_000_000
    },
  })

  const kpi = kpiQuery.data
  const aprovCount = aprovQuery.data ?? 0
  const gargCount = gargaloQuery.data ?? 0
  const activity = activityQuery.data ?? []
  const funilRows = funilQuery.data ?? []

  const funil = FUNIL_STAGES.map(s => ({
    stage: s.label,
    count: funilRows.filter(r => s.matches.includes(r.status)).reduce((a, b) => a + Number(b.quantidade || 0), 0),
  }))
  const maxFunil = Math.max(1, ...funil.map(f => f.count))

  const volumeMes = Number(kpi?.volume_ganho ?? 0) * 100
  const meta = metaQuery.data ?? 50_000_000_000
  const pctMeta = Math.min(100, Math.round((volumeMes / meta) * 100))

  const itemsRender = items.map(it =>
    it.href === '/(admin)/aprovacoes' && aprovCount > 0 ? { ...it, badge: aprovCount } : it
  )

  function handleLogout() {
    Alert.alert('Sair do modo admin', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/login')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN</Text>
          <Text style={s.headerTitle}>Mercurio · Backoffice</Text>
        </View>
        <View style={s.headerActions}>
          <NotificationsSheet
            variant="dark"
            onOpenLink={(route) => router.push(route as any)}
          />
          <Pressable onPress={handleLogout} style={s.logoutBtn}>
            <LogOut size={16} color="#DC2626" />
            <Text style={s.logoutText}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero — volume acumulado */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>VOLUME GANHO · ACUMULADO</Text>
          <Text style={s.heroValue}>{brl(volumeMes)}</Text>
          <View style={s.heroMetaRow}>
            <View style={s.heroBadge}>
              <TrendingUp size={13} color="#16A34A" />
              <Text style={s.heroBadgeText}>{kpi?.taxa_conversao ?? 0}% conversão</Text>
            </View>
            <Text style={s.heroMetaText}>meta {brl(meta)} · {pctMeta}%</Text>
          </View>
          <View style={s.heroTrack}>
            <View style={[s.heroFill, { width: `${pctMeta}%` }]} />
          </View>
        </View>

        {/* KPIs */}
        <View style={s.kpiGrid}>
          <KPI label="Aprovações pendentes" value={String(aprovCount)}                 icon={ClipboardCheck} tone="warning" hint="parceiros aguardando" />
          <KPI label="Propostas ativas"     value={String(kpi?.ativas ?? 0)}           icon={FileText}       tone="info"    hint={`${kpi?.propostas_mes ?? 0} no mês`} />
          <KPI label="Parceiros ativos"     value={String(kpi?.parceiros_ativos ?? 0)} icon={Users}          tone="success" hint={`${kpi?.ganhas ?? 0} ganhas`} />
          <KPI label="Gargalos > 7 dias"    value={String(gargCount)}                  icon={AlertTriangle}  tone="danger"  hint="propostas paradas" />
        </View>

        {/* Atividade recente */}
        <View style={[s.card, { marginTop: 16 }]}>
          <View style={s.cardHeader}>
            <View style={s.cardHeaderLeft}>
              <Activity size={16} color="#A3A3A3" />
              <Text style={s.cardTitle}>Atividade recente</Text>
            </View>
            <Pressable onPress={() => router.push('/(admin)/auditoria' as any)}>
              <Text style={s.cardAction}>Ver tudo →</Text>
            </Pressable>
          </View>
          <View style={s.cardBody}>
            {activityQuery.isLoading ? (
              <ActivityIndicator color="#DC2626" />
            ) : activity.length === 0 ? (
              <Text style={s.empty}>Nenhuma atividade recente.</Text>
            ) : activity.map((a, idx) => {
              const tone = tomFromAcao(a.acao)
              const t = SEV[tone]
              const who = a.usuario?.nome_completo || a.usuario?.email || 'Sistema'
              return (
                <View
                  key={a.id}
                  style={[s.activityRow, idx > 0 && { borderTopWidth: 1, borderTopColor: '#1f1f1f' }]}
                >
                  <View style={[s.dot, { backgroundColor: t.text }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.activityText}>
                      <Text style={s.activityWho}>{who}</Text>
                      <Text style={s.activityAcao}> {a.acao}</Text>
                      <Text style={{ color: t.text, fontWeight: '600' }}> · {a.entidade}</Text>
                    </Text>
                    <Text style={s.activityTime}>{tempoRelativo(a.created_at)}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Saúde do funil */}
        <View style={[s.card, { marginTop: 14 }]}>
          <View style={s.cardHeader}>
            <View style={s.cardHeaderLeft}>
              <CheckCircle2 size={16} color="#16A34A" />
              <Text style={s.cardTitle}>Saúde do funil</Text>
            </View>
          </View>
          <View style={s.cardBody}>
            {funilQuery.isLoading ? (
              <ActivityIndicator color="#DC2626" />
            ) : funil.every(f => f.count === 0) ? (
              <Text style={s.empty}>Sem propostas em andamento.</Text>
            ) : funil.map((stage, idx) => (
              <View key={stage.stage} style={idx === funil.length - 1 ? undefined : { marginBottom: 12 }}>
                <View style={s.funilTop}>
                  <Text style={s.funilLabel}>{stage.stage}</Text>
                  <Text style={s.funilCount}>{stage.count}</Text>
                </View>
                <View style={s.funilTrack}>
                  <View style={[s.funilFill, { width: `${(stage.count / maxFunil) * 100}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Todas as áreas */}
        <Text style={s.sectionLabel}>TODAS AS ÁREAS</Text>
        <View style={s.areaGrid}>
          {itemsRender.map((it) => (
            <Pressable
              key={it.href}
              onPress={() => router.push(it.href as any)}
              style={s.areaTile}
            >
              <View style={[s.areaIcon, { backgroundColor: it.color + '22' }]}>
                <it.icon size={20} color={it.color} />
                {'badge' in it && it.badge ? (
                  <View style={s.areaBadge}>
                    <Text style={s.areaBadgeText}>{it.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.areaLabel} numberOfLines={2}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const TONE: Record<'info' | 'success' | 'warning' | 'danger', { bg: string; icon: string }> = {
  info:    { bg: '#38BDF822', icon: '#38BDF8' },
  success: { bg: '#16A34A22', icon: '#16A34A' },
  warning: { bg: '#F59E0B22', icon: '#F59E0B' },
  danger:  { bg: '#DC262622', icon: '#DC2626' },
}

function KPI({
  label, value, icon: Icon, tone, hint,
}: { label: string; value: string; icon: any; tone: 'info' | 'success' | 'warning' | 'danger'; hint?: string }) {
  const palette = TONE[tone]
  return (
    <View style={s.kpiCard}>
      <View style={s.kpiHeader}>
        <View style={[s.kpiIcon, { backgroundColor: palette.bg }]}>
          <Icon size={15} color={palette.icon} />
        </View>
        <Text style={s.kpiLabel} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={s.kpiValue}>{value}</Text>
      {hint ? <Text style={s.kpiHint}>{hint}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DC262615', borderWidth: 1, borderColor: '#DC262640', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  hero: { backgroundColor: '#141414', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  heroLabel: { fontSize: 10, letterSpacing: 1.2, color: '#737373', fontWeight: '600' },
  heroValue: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.5 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#16A34A18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroBadgeText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  heroMetaText: { fontSize: 12, color: '#737373' },
  heroTrack: { marginTop: 14, height: 6, borderRadius: 999, backgroundColor: '#ffffff14', overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 999, backgroundColor: '#DC2626' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  kpiCard: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 100, backgroundColor: '#141414', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpiIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { flex: 1, fontSize: 11, color: '#737373', fontWeight: '500' },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 10, letterSpacing: -0.3 },
  kpiHint: { fontSize: 11, color: '#525252', marginTop: 2 },

  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cardAction: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  cardBody: { padding: 14 },
  empty: { paddingVertical: 8, textAlign: 'center', color: '#525252', fontSize: 12 },

  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  activityText: { fontSize: 13, color: '#e5e5e5', lineHeight: 18 },
  activityWho: { fontWeight: '700', color: '#fff' },
  activityAcao: { color: '#a3a3a3' },
  activityTime: { fontSize: 11, color: '#525252', marginTop: 2 },

  funilTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  funilLabel: { fontSize: 12, color: '#a3a3a3' },
  funilCount: { fontSize: 12, fontWeight: '700', color: '#fff' },
  funilTrack: { height: 6, borderRadius: 999, backgroundColor: '#ffffff10', overflow: 'hidden' },
  funilFill: { height: '100%', borderRadius: 999, backgroundColor: '#DC2626' },

  sectionLabel: { fontSize: 11, letterSpacing: 1.2, color: '#525252', fontWeight: '700', marginTop: 22, marginBottom: 12 },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  areaTile: { flexBasis: '30.7%', flexGrow: 1, alignItems: 'center', backgroundColor: '#141414', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: '#2a2a2a' },
  areaIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  areaBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#141414' },
  areaBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  areaLabel: { marginTop: 8, fontSize: 11, fontWeight: '600', color: '#d4d4d4', textAlign: 'center' },
})
