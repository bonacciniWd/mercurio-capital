import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, KanbanSquare, ClipboardCheck, Users, FileText, Network,
  Megaphone, Wallet, Tag, Workflow, Plug, GraduationCap, ScrollText, BarChart3, Settings,
  ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2, Activity,
  DollarSign, FileCode, Flag,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const items = [
  { href: '/(admin)/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, color: '#DC2626' },
  { href: '/(admin)/kanban',         label: 'Kanban',        icon: KanbanSquare,    color: '#B91C1C' },
  { href: '/(admin)/aprovacoes',     label: 'Aprovações',    icon: ClipboardCheck,  color: '#F59E0B' },
  { href: '/(admin)/parceiros',      label: 'Parceiros',     icon: Users,           color: '#16A34A' },
  { href: '/(admin)/propostas',      label: 'Propostas',     icon: FileText,        color: '#0F0F0F' },
  { href: '/(admin)/rede',           label: 'Rede',          icon: Network,         color: '#525252' },
  { href: '/(admin)/campanhas',      label: 'Campanhas',     icon: Megaphone,       color: '#DC2626' },
  { href: '/(admin)/carteiras',      label: 'Carteiras',     icon: Wallet,          color: '#DC2626' },
  { href: '/(admin)/financeiro',     label: 'Financeiro',    icon: DollarSign,      color: '#16A34A' },
  { href: '/(admin)/precos',         label: 'Preços',        icon: Tag,             color: '#0F0F0F' },
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
  const meta = 500_000_000_00
  const pctMeta = Math.min(100, Math.round((volumeMes / meta) * 100))

  const itemsRender = items.map(it =>
    it.href === '/(admin)/aprovacoes' && aprovCount > 0 ? { ...it, badge: aprovCount } : it
  )

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-silver-900 px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/login')} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-danger">Modo Admin</Text>
            <Text className="text-lg font-bold text-white">Mercurio · Backoffice</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="rounded-2xl bg-silver-900 p-5">
          <Text className="text-xs uppercase tracking-wider text-gold">Volume ganho · acumulado</Text>
          <Text className="mt-1 text-3xl font-bold text-white">{brl(volumeMes)}</Text>
          <View className="mt-2 flex-row items-center gap-1.5">
            <TrendingUp size={14} color="#16A34A" />
            <Text className="text-xs font-semibold text-success">{kpi?.taxa_conversao ?? 0}% conversão</Text>
            <Text className="text-xs text-silver-400">· meta {brl(meta)} ({pctMeta}%)</Text>
          </View>
          <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <View className="h-full rounded-full bg-gold" style={{ width: `${pctMeta}%` }} />
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <KPI label="Aprovações pendentes" value={String(aprovCount)}                  icon={ClipboardCheck} tone="warning" hint="parceiros aguardando" />
          <KPI label="Propostas ativas"     value={String(kpi?.ativas ?? 0)}            icon={FileText}        tone="navy"    hint={`${kpi?.propostas_mes ?? 0} no mês`} />
          <KPI label="Parceiros ativos"     value={String(kpi?.parceiros_ativos ?? 0)}  icon={Users}           tone="success" hint={`${kpi?.ganhas ?? 0} ganhas`} />
          <KPI label="Gargalos > 7 dias"    value={String(gargCount)}                   icon={AlertTriangle}   tone="danger"  hint="propostas paradas" />
        </View>

        <View className="mt-5 rounded-2xl border border-silver-200 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Activity size={16} color="#0F0F0F" />
              <Text className="font-semibold text-silver-900">Atividade recente</Text>
            </View>
            <Pressable onPress={() => router.push('/(admin)/auditoria' as any)}>
              <Text className="text-xs font-semibold text-gold">Ver tudo →</Text>
            </Pressable>
          </View>
          {activityQuery.isLoading ? (
            <ActivityIndicator color="#DC2626" />
          ) : activity.length === 0 ? (
            <Text className="py-2 text-center text-xs text-silver-500">Nenhuma atividade recente.</Text>
          ) : activity.map((a, idx) => {
            const tone = tomFromAcao(a.acao)
            const t = SEV[tone]
            const who = a.usuario?.nome_completo || a.usuario?.email || 'Sistema'
            return (
              <View
                key={a.id}
                className="flex-row items-start gap-3 border-t border-silver-100 py-3"
                style={idx === 0 ? { borderTopWidth: 0 } : undefined}
              >
                <View className="mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: t.text }} />
                <View className="flex-1">
                  <Text className="text-sm text-silver-900">
                    <Text className="font-semibold">{who}</Text>
                    <Text className="text-silver-700"> {a.acao}</Text>
                    <Text className="font-semibold" style={{ color: t.text }}> · {a.entidade}</Text>
                  </Text>
                  <Text className="mt-0.5 text-xs text-silver-500">{tempoRelativo(a.created_at)}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <View className="mt-5 rounded-2xl border border-silver-200 bg-white p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <CheckCircle2 size={16} color="#16A34A" />
            <Text className="font-semibold text-silver-900">Saúde do funil</Text>
          </View>
          {funilQuery.isLoading ? (
            <ActivityIndicator color="#DC2626" />
          ) : funil.every(f => f.count === 0) ? (
            <Text className="py-2 text-center text-xs text-silver-500">Sem propostas em andamento.</Text>
          ) : funil.map((s, idx) => (
            <View key={s.stage} className="mb-2.5" style={idx === funil.length - 1 ? { marginBottom: 0 } : undefined}>
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-xs text-silver-700">{s.stage}</Text>
                <Text className="text-xs font-semibold text-silver-900">{s.count}</Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-silver-100">
                <View className="h-full rounded-full bg-navy" style={{ width: `${(s.count / maxFunil) * 100}%` }} />
              </View>
            </View>
          ))}
        </View>

        <Text className="mb-3 mt-5 text-xs uppercase tracking-wider text-silver-500">Todas as áreas</Text>
        <View className="flex-row flex-wrap gap-3">
          {itemsRender.map((it) => (
            <Pressable
              key={it.href}
              onPress={() => router.push(it.href as any)}
              className="w-[31%] items-center rounded-xl border border-silver-200 bg-white p-3 active:opacity-70"
            >
              <View className="relative h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: it.color + '20' }}>
                <it.icon size={22} color={it.color} />
                {'badge' in it && it.badge ? (
                  <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1">
                    <Text className="text-[10px] font-bold text-white">{it.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-2 text-center text-xs font-semibold text-silver-800" numberOfLines={2}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function KPI({
  label, value, icon: Icon, tone, hint,
}: { label: string; value: string; icon: any; tone: 'navy' | 'success' | 'warning' | 'danger'; hint?: string }) {
  const palette = {
    navy:    { bg: '#0F0F0F15', icon: '#0F0F0F' },
    success: { bg: '#16A34A20', icon: '#16A34A' },
    warning: { bg: '#F59E0B22', icon: '#B45309' },
    danger:  { bg: '#DC262620', icon: '#DC2626' },
  }[tone]
  return (
    <View className="w-[48%] rounded-xl border border-silver-200 bg-white p-3" style={{ minHeight: 96 }}>
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: palette.bg }}>
          <Icon size={16} color={palette.icon} />
        </View>
        <Text className="flex-1 text-[11px] font-medium text-silver-600" numberOfLines={2}>{label}</Text>
      </View>
      <Text className="mt-2 text-2xl font-bold text-silver-900">{value}</Text>
      {hint && <Text className="text-[11px] text-silver-500">{hint}</Text>}
    </View>
  )
}
