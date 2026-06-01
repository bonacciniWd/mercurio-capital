import { useEffect, useState } from 'react'
import { View, Pressable, Text, TouchableWithoutFeedback, StyleSheet, ActivityIndicator } from 'react-native'
import { Tabs, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  LayoutDashboard, FileText, Sparkles, Wallet, User,
  SquareArrowUpLeft, X, Calculator, UserPlus,
} from 'lucide-react-native'
import { useAuth } from '@/lib/auth'

// ─── Tab definitions ────────────────────────────────────────────────────────
const TABS = [
  { name: 'dashboard',  title: 'Início',    Icon: LayoutDashboard },
  { name: 'propostas',  title: 'Propostas', Icon: FileText },
  { name: 'promocoes',  title: 'Promoções', Icon: Sparkles },
  { name: 'carteira',   title: 'Carteira',  Icon: Wallet },
  { name: 'perfil',     title: 'Perfil',    Icon: User },
]

// ─── Liquid Glass Tab Bar ────────────────────────────────────────────────────
function LiquidGlassTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets()
  const bottomOffset = Math.max(insets.bottom, TAB_BAR_BOTTOM_MIN)
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
          const isFocused = state.index === routeIndex

          return (
            <Pressable
              key={name}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: state.routes[routeIndex]?.key,
                  canPreventDefault: true,
                })
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(name)
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
  { icon: FileText,   label: 'Nova proposta',     route: '/(parceiro)/propostas' },
]

function SpeedDial() {
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
          {DIAL_ACTIONS.map(({ icon: Icon, label, route }) => (
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

      <Pressable onPress={() => setOpen(v => !v)} style={[styles.fab, { bottom: fabBottom }]}>
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
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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

  // Redireciona se não-parceiro tentar acessar
  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace('/login')
      return
    }
    const role = session.role
    if (role === 'admin') router.replace('/(admin)' as any)
    else if (role === 'client') router.replace('/(cliente)' as any)
  }, [loading, session])

  if (loading || !session) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator color="#DC2626" />
      </View>
    )
  }

  // Para roles erradas, mostra spinner enquanto o efeito redireciona
  if (session.role && session.role !== 'partner' && session.role !== 'team_member') {
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
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="dashboard"  />
        <Tabs.Screen name="propostas"  />
        <Tabs.Screen name="promocoes"  />
        <Tabs.Screen name="carteira"   />
        <Tabs.Screen name="perfil"     />

        <Tabs.Screen name="universidade"   options={{ href: null }} />
        <Tabs.Screen name="simulacoes"     options={{ href: null }} />
        <Tabs.Screen name="equipe"         options={{ href: null }} />
        <Tabs.Screen name="relatorios"     options={{ href: null }} />
        <Tabs.Screen name="comissoes"      options={{ href: null }} />
        <Tabs.Screen name="contrato"       options={{ href: null }} />
        <Tabs.Screen name="configuracoes"  options={{ href: null }} />
        <Tabs.Screen name="propostas/[id]" options={{ href: null }} />
        <Tabs.Screen name="aula/[id]"      options={{ href: null }} />
      </Tabs>

      <SpeedDial />
    </View>
  )
}

