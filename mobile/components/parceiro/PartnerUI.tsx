import type { ReactNode } from 'react'
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { NotificationsSheet } from '@/components/NotificationsSheet'
import { router } from 'expo-router'
import { ArrowLeft, AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react-native'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- React Native bundles static image assets through require.
const partnerLogo = require('../../assets/logos/logo-square.png')

export function PartnerScreen({ title, subtitle, back = true, tabbed = false, children, refreshing = false, onRefresh }: {
  title: string; subtitle?: string; back?: boolean; tabbed?: boolean; children: ReactNode; refreshing?: boolean; onRefresh?: () => void
}) {
  const insets = useSafeAreaInsets()
  return <SafeAreaView className="flex-1 bg-[#111216]" edges={['top']}>
    <StatusBar style="light" />
    <View className="flex-row items-center gap-3 border-b border-[#27272A] px-2 py-4">
      {back ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.canGoBack() ? router.back() : router.replace('/(parceiro)/perfil')} className="h-11 w-11 items-center justify-center rounded-full bg-[#18181B]"><ArrowLeft size={21} color="white" /></Pressable>
        : <Image source={partnerLogo} style={{ width: 54, height: 54 }} resizeMode="contain" />}
      <View className="flex-1"><Text className="text-lg font-semibold text-white">{title}</Text>{subtitle ? <Text className="mt-1 text-xs text-[#A1A1AA]">{subtitle}</Text> : null}</View>
    <NotificationsSheet
          variant="dark"
          iconSize={20}
          onOpenLink={(route) => router.push(route as any)}
    />
    </View>
    
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: (tabbed ? 150 : 24) + insets.bottom, gap: 20 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F87171" /> : undefined}>{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

export function PartnerCard({ children }: { children: ReactNode }) { return <View className="gap-4 rounded-3xl border border-[#2D2D32] bg-[#151518] p-5">{children}</View> }
export function PartnerTitle({ children }: { children: ReactNode }) { return <Text className="text-lg font-semibold text-white">{children}</Text> }
export function PartnerBody({ children }: { children: ReactNode }) { return <Text className="text-sm leading-6 text-[#B8B8C2]">{children}</Text> }
export function PartnerAction({ label, onPress, busy = false, disabled = false, secondary = false, danger = false }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; danger?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${secondary ? 'border border-[#414148] bg-[#202024]' : danger ? 'border border-[#713035] bg-[#2A1519]' : 'bg-[#DC2626]'} ${disabled || busy ? 'opacity-50' : 'active:opacity-80'}`}>
    {busy ? <ActivityIndicator color="white" /> : null}<Text className={`text-center text-sm font-semibold ${danger ? 'text-[#FCA5A5]' : 'text-white'}`}>{label}</Text>
  </Pressable>
}
export function PartnerFeedback({ title, text, retry, loading = false }: { title: string; text?: string; retry?: () => void; loading?: boolean }) {
  return <PartnerCard>{loading ? <ActivityIndicator color="#F87171" /> : retry ? <AlertCircle size={24} color="#F87171" /> : null}<PartnerTitle>{title}</PartnerTitle>{text ? <PartnerBody>{text}</PartnerBody> : null}{retry ? <PartnerAction secondary label="Tentar novamente" onPress={retry} /> : null}</PartnerCard>
}
export function PartnerMenuItem({ icon: Icon, label, hint, badge, onPress, disabled = false }: { icon: LucideIcon; label: string; hint?: string; badge?: string; onPress?: () => void; disabled?: boolean }) {
  const content = <><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#28171B]"><Icon size={20} color="#F87171" /></View><View className="flex-1"><Text className="text-sm font-semibold text-white">{label}</Text>{hint ? <Text className="mt-1 text-xs leading-5 text-[#A1A1AA]">{hint}</Text> : null}</View>{badge ? <Text className="text-xs text-[#D4D4D8]">{badge}</Text> : null}{onPress && !disabled ? <ChevronRight size={18} color="#A1A1AA" /> : null}</>
  return onPress ? <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} className={`min-h-16 flex-row items-center gap-3 py-3 ${disabled ? 'opacity-50' : 'active:opacity-70'}`}>{content}</Pressable>
    : <View className="min-h-16 flex-row items-center gap-3 py-3">{content}</View>
}
