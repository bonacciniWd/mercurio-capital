import { useEffect, useState } from 'react'
import { View, Pressable, Text, TouchableWithoutFeedback, StyleSheet, ActivityIndicator } from 'react-native'
import { Tabs, router, useSegments } from 'expo-router'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  LayoutDashboard, FileText, Sparkles, Wallet, User,
  SquareArrowUpLeft, X, Calculator, UserPlus,
} from 'lucide-react-native'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { canManagePartner, isPartnerPrimaryRoute } from '@/lib/partnerAccess'

export const unstable_settings = { anchor: 'dashboard' }

// ─── Tab definitions ────────────────────────────────────────────────────────
const TABS = [
  { name: 'dashboard',  title: 'Início',    Icon: LayoutDashboard },
  { name: 'propostas',  title: 'Propostas', Icon: FileText },
  { name: 'promocoes',  title: 'Promoções', Icon: Sparkles },
  { name: 'carteira',   title: 'Carteira',  Icon: Wallet },
  { name: 'perfil',     title: 'Perfil',    Icon: User },
]

// ─── Liquid Glass Tab Bar ────────────────────────────────────────────────────
function LiquidGlassTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const bottomOffset = Math.max(insets.bottom, TAB_BAR_BOTTOM_MIN)
  if (!TABS.some((tab) => tab.name === state.routes[state.index]?.name)) return null
  return (
    <View style={[styles.tabBarWrapper, { bottom: bottomOffset }]}>
      {/* Shadow frame (outside overflow:hidden) */}
      <View style={styles.tabBarShadow} />

      {/* Blurred glass pill */}
      <View style={styles.tabBarBlur}>
        {/* Glass border ring */}
        <View style={styles.tabBarBorder} pointerEvents="none" />

        {TABS.map(({ name, title, Icon }) => {
          const routeIndex = state.routes.findIndex((r: any) => r.name === name)
          if (routeIndex < 0) return null
          const isFocused = state.index === routeIndex

          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityLabel={title}
              accessibilityState={{ selected: isFocused }}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: state.routes[routeIndex]?.key,
                  canPreventDefault: true,
                })
                if (!isFocused && !event.defaultPrevented) {
                  navigateToTab(state.routes[routeIndex].key)
                }
              }}
              style={styles.tabItem}
            >
              <Icon
                size={22}
                color={isFocused ? '#DC2626' : 'rgba(255,255,255,0.45)'}
              />
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {title}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ─── Speed Dial FAB ──────────────────────────────────────────────────────────
const DIAL_ACTIONS = [
  { icon: UserPlus,   label: 'Convidar membro',  route: '/(parceiro)/equipe' },
  { icon: Calculator, label: 'Simulação rápida',  route: '/(parceiro)/simulacoes' },
  { icon: FileText,   label: 'Nova proposta',     route: '/propostas/nova' },
]

function SpeedDial() {
  const { session } = useAuth()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const bottomOffset = Math.max(insets.bottom, TAB_BAR_BOTTOM_MIN)
  const fabBottom = bottomOffset + TAB_BAR_HEIGHT + 14
  return (
    <>
      {open && (
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      {open && (
        <View style={[styles.chipStack, { bottom: fabBottom + 58 }]}>
          {DIAL_ACTIONS.filter((action) => action.icon !== UserPlus || canManagePartner(session?.role)).map(({ icon: Icon, label, route }) => (
            <Pressable
              key={label}
              onPress={() => { setOpen(false); router.push(route as any) }}
              style={styles.chip}
            >
              <Text style={styles.chipLabel}>{label}</Text>
              <View style={styles.chipIcon}>
                <Icon size={14} color="white" />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Fechar ações rápidas' : 'Abrir ações rápidas'} accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)} style={[styles.fab, { bottom: fabBottom }]}>
        {open ? <X size={22} color="white" /> : <SquareArrowUpLeft size={22} color="white" />}
      </Pressable>
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const TAB_BAR_BOTTOM_MIN = 16
const TAB_BAR_HEIGHT = 60
const TAB_BAR_H_MARGIN = 16

const styles = StyleSheet.create({
  // Tab bar
  tabBarWrapper: {
    position: 'absolute',
    left: TAB_BAR_H_MARGIN,
    right: TAB_BAR_H_MARGIN,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  tabBarShadow: {
    ...StyleSheet.absoluteFill,
    borderRadius: TAB_BAR_HEIGHT / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
    backgroundColor: 'transparent',
  },
  tabBarBlur: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(23,23,23,0.92)',
  },
  tabBarBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 0.75,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  // Tab items
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  // FAB & Speed Dial
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chipStack: {
    position: 'absolute',
    right: TAB_BAR_H_MARGIN,
    gap: 10,
    alignItems: 'flex-end',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 24,
    paddingVertical: 9, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 6,
  },
  chipLabel: { fontSize: 13, fontWeight: '600', color: '#0F0F0F' },
  chipIcon: { backgroundColor: '#DC2626', borderRadius: 16, padding: 7 },
  fab: {
    position: 'absolute',
    right: TAB_BAR_H_MARGIN,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
})

// ─── Layout ──────────────────────────────────────────────────────────────────
export default function ParceiroLayout() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const [allowed, setAllowed] = useState(false)

  // Redireciona se não-parceiro tentar acessar
  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace('/login')
      return
    }
    const role = session.role
    if (role === 'admin') router.replace('/acesso-indisponivel')
    else if (role === 'client') router.replace('/(cliente)' as any)
    else if (role !== 'partner' && role !== 'team_member') router.replace('/acesso-indisponivel')
  }, [loading, session])

  useEffect(() => {
    let cancelled = false
    setAllowed(false)
    if (session?.role !== 'partner' && session?.role !== 'team_member') return
    void (async () => {
      const { data, error } = await supabase.rpc('me')
      if (cancelled) return
      const me = data as { approved?: boolean } | null
      if (error || me?.approved !== true) router.replace('/acesso-pendente')
      else setAllowed(true)
    })()
    return () => { cancelled = true }
  }, [session?.userId, session?.role])

  if (loading || !session) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator color="#DC2626" />
      </View>
    )
  }

  // Para roles erradas, mostra spinner enquanto o efeito redireciona
  if ((session.role !== 'partner' && session.role !== 'team_member') || !allowed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator color="#DC2626" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <LiquidGlassTabBar {...props} />}
        backBehavior="initialRoute"
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="dashboard"  />
        <Tabs.Screen name="propostas"  />
        <Tabs.Protected guard={canManagePartner(session.role)}>
          <Tabs.Screen name="promocoes" />
          <Tabs.Screen name="equipe" />
          <Tabs.Screen name="relatorios" />
          <Tabs.Screen name="comissoes" />
          <Tabs.Screen name="contrato" />
        </Tabs.Protected>
        <Tabs.Screen name="carteira"   />
        <Tabs.Screen name="perfil"     />

        <Tabs.Screen name="universidade" />
        <Tabs.Screen name="simulacoes" />
        <Tabs.Screen name="configuracoes" />
        <Tabs.Screen name="propostas/[id]" />
        <Tabs.Screen name="aula/[id]" />
      </Tabs>

      {isPartnerPrimaryRoute(segments) ? <SpeedDial /> : null}
    </View>
  )
}

