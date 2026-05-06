import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import {
  LayoutDashboard, KanbanSquare, ClipboardCheck, Users, FileText, Network,
  Megaphone, Wallet, Tag, Workflow, Plug, GraduationCap, ScrollText, BarChart3, Settings,
  ArrowLeft, TrendingUp, AlertTriangle, CheckCircle2, Activity,
} from 'lucide-react-native'
import { brl } from '@/lib/utils'

const items = [
  { href: '/(admin)/dashboard',     label: 'Dashboard',      icon: LayoutDashboard, color: '#DC2626' },
  { href: '/(admin)/kanban',        label: 'Kanban',         icon: KanbanSquare,    color: '#B91C1C' },
  { href: '/(admin)/aprovacoes',    label: 'Aprovações',     icon: ClipboardCheck,  color: '#F59E0B', badge: 8 },
  { href: '/(admin)/parceiros',     label: 'Parceiros',      icon: Users,           color: '#16A34A' },
  { href: '/(admin)/propostas',     label: 'Propostas',      icon: FileText,        color: '#0F0F0F' },
  { href: '/(admin)/rede',          label: 'Rede',           icon: Network,         color: '#525252' },
  { href: '/(admin)/campanhas',     label: 'Campanhas',      icon: Megaphone,       color: '#DC2626' },
  { href: '/(admin)/carteiras',     label: 'Carteiras',      icon: Wallet,          color: '#DC2626' },
  { href: '/(admin)/precos',        label: 'Preços',         icon: Tag,             color: '#0F0F0F' },
  { href: '/(admin)/fluxos',        label: 'Fluxos',         icon: Workflow,        color: '#525252' },
  { href: '/(admin)/integracoes',   label: 'Integrações',    icon: Plug,            color: '#B91C1C' },
  { href: '/(admin)/universidade',  label: 'Universidade',   icon: GraduationCap,   color: '#DC2626' },
  { href: '/(admin)/auditoria',     label: 'Auditoria',      icon: ScrollText,      color: '#DC2626' },
  { href: '/(admin)/relatorios',    label: 'Relatórios',     icon: BarChart3,       color: '#16A34A' },
  { href: '/(admin)/configuracoes', label: 'Configurações',  icon: Settings,        color: '#9CA3AF' },
] as const

const recentActivity = [
  { id: 1, who: 'Aurora Construções', action: 'enviou nova proposta', amount: 4_200_000_00, at: 'há 4 min', tone: 'gold' as const },
  { id: 2, who: 'Vista Sul Imóveis', action: 'aguarda aprovação de cadastro', at: 'há 12 min', tone: 'warning' as const },
  { id: 3, who: 'Comitê de Crédito', action: 'aprovou proposta MC-0042', amount: 3_500_000_00, at: 'há 1h', tone: 'success' as const },
  { id: 4, who: 'Capital+', action: 'recarregou carteira', amount: 50_000_00, at: 'há 2h', tone: 'gold' as const },
  { id: 5, who: 'Auditoria', action: 'detectou tentativa de login suspeita', at: 'há 3h', tone: 'danger' as const },
]

const toneMap = {
  gold:    { bg: '#DC262622', text: '#991B1B' },
  success: { bg: '#16A34A22', text: '#16A34A' },
  warning: { bg: '#F59E0B22', text: '#B45309' },
  danger:  { bg: '#DC262622', text: '#DC2626' },
}

export default function AdminHome() {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
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
        {/* Volume + alerta */}
        <View className="rounded-2xl bg-silver-900 p-5">
          <Text className="text-xs uppercase tracking-wider text-gold">Volume liberado · Abr/2026</Text>
          <Text className="mt-1 text-3xl font-bold text-white">{brl(412_000_000_00)}</Text>
          <View className="mt-2 flex-row items-center gap-1.5">
            <TrendingUp size={14} color="#16A34A" />
            <Text className="text-xs font-semibold text-success">+18,4% vs Mar</Text>
            <Text className="text-xs text-silver-400">· meta {brl(500_000_000_00)} (82%)</Text>
          </View>
          <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <View className="h-full rounded-full bg-gold" style={{ width: '82%' }} />
          </View>
        </View>

        {/* KPIs */}
        <View className="mt-4 flex-row flex-wrap gap-3">
          <KPI label="Aprovações pendentes" value="8" icon={ClipboardCheck} tone="warning" hint="3 parceiros · 5 propostas" />
          <KPI label="Propostas ativas"     value="142" icon={FileText}        tone="navy"    hint="32 em comitê" />
          <KPI label="Parceiros ativos"     value="58"  icon={Users}           tone="success" hint="+4 no mês" />
          <KPI label="Alertas auditoria"    value="3"   icon={AlertTriangle}   tone="danger"  hint="últimas 24h" />
        </View>

        {/* Atividade recente */}
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
          {recentActivity.map((a) => {
            const t = toneMap[a.tone]
            return (
              <View key={a.id} className="flex-row items-start gap-3 border-t border-silver-100 py-3 first:border-t-0">
                <View className="mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: t.text }} />
                <View className="flex-1">
                  <Text className="text-sm text-silver-900">
                    <Text className="font-semibold">{a.who}</Text>
                    <Text className="text-silver-700"> {a.action}</Text>
                    {a.amount ? <Text className="font-semibold" style={{ color: t.text }}> · {brl(a.amount)}</Text> : null}
                  </Text>
                  <Text className="mt-0.5 text-xs text-silver-500">{a.at}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* Saúde do funil */}
        <View className="mt-5 rounded-2xl border border-silver-200 bg-white p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <CheckCircle2 size={16} color="#16A34A" />
            <Text className="font-semibold text-silver-900">Saúde do funil</Text>
          </View>
          {[
            { stage: 'Pré-análise', count: 56, pct: 100 },
            { stage: 'Análise de Crédito', count: 32, pct: 57 },
            { stage: 'Comitê', count: 18, pct: 32 },
            { stage: 'Contrato', count: 9, pct: 16 },
            { stage: 'Liberado', count: 6, pct: 11 },
          ].map((s) => (
            <View key={s.stage} className="mb-2.5 last:mb-0">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-xs text-silver-700">{s.stage}</Text>
                <Text className="text-xs font-semibold text-silver-900">{s.count}</Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-silver-100">
                <View className="h-full rounded-full bg-navy" style={{ width: `${s.pct}%` }} />
              </View>
            </View>
          ))}
        </View>

        {/* Grid de áreas */}
        <Text className="mb-3 mt-5 text-xs uppercase tracking-wider text-silver-500">Todas as áreas</Text>
        <View className="flex-row flex-wrap gap-3">
          {items.map((it) => (
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
    <View className="w-[48%] rounded-xl border border-silver-200 bg-white p-3">
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
