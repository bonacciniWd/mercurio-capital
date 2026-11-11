import type { ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft, ArrowUpRight, AlertCircle } from 'lucide-react-native'
import { statusLabel } from '@/lib/clientePresentation'

export function ClientScreen({ title, subtitle, back = true, children, refreshing = false, onRefresh }: {
  title: string; subtitle?: string; back?: boolean; children: ReactNode; refreshing?: boolean; onRefresh?: () => void
}) {
  return <SafeAreaView className="flex-1 bg-[#111216]" edges={['top']}>
    <StatusBar style="light" />
    <View className="flex-row items-center gap-3 border-b border-[#27272A] px-5 py-4">
      {back ? <Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(cliente)')} className="h-11 w-11 items-center justify-center rounded-full bg-[#18181B]"><ArrowLeft size={21} color="white" /></Pressable>
        : <Image source={require('../../assets/logos/logo-square.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />}
      <View className="flex-1"><Text className="text-lg font-semibold text-white">{title}</Text>{subtitle ? <Text className="mt-1 text-xs text-[#A1A1AA]">{subtitle}</Text> : null}</View>
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F87171" /> : undefined}>
      {children}
    </ScrollView>
  </SafeAreaView>
}
export function Card({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <View className={`rounded-3xl border p-5 ${accent ? 'border-[#713035] bg-[#211417]' : 'border-[#2D2D32] bg-[#151518]'}`}>{children}</View>
}
export function SectionTitle({ children }: { children: ReactNode }) { return <Text className="text-lg font-semibold text-white">{children}</Text> }
export function Label({ children }: { children: ReactNode }) { return <Text className="text-xs font-semibold uppercase tracking-widest text-[#B0B0B8]">{children}</Text> }
export function Body({ children }: { children: ReactNode }) { return <Text className="text-sm leading-6 text-[#B8B8C2]">{children}</Text> }
export function Action({ label, onPress, secondary = false, busy = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${secondary ? 'border border-[#414148] bg-[#202024]' : 'bg-[#DC2626]'} ${disabled || busy ? 'opacity-50' : 'active:opacity-80'}`}>
    {busy ? <ActivityIndicator color="white" /> : null}<Text className="text-center text-sm font-semibold text-white">{label}</Text>
  </Pressable>
}
export function LinkCard({ title, description, onPress, icon }: { title: string; description: string; onPress: () => void; icon: ReactNode }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center gap-4 rounded-3xl border border-[#2D2D32] bg-[#151518] p-5 active:opacity-80">
    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#30191D]">{icon}</View>
    <View className="flex-1"><Text className="text-base font-semibold text-white">{title}</Text><Text className="mt-1 text-sm leading-5 text-[#B8B8C2]">{description}</Text></View><ArrowUpRight size={18} color="#F87171" />
  </Pressable>
}
export function Status({ value }: { value: string }) {
  return <View className="self-start rounded-full border border-[#45454D] bg-[#26262C] px-3 py-2"><Text className="text-xs font-semibold text-white">{statusLabel(value)}</Text></View>
}
export function Feedback({ title, text, retry, loading = false }: { title: string; text?: string; retry?: () => void; loading?: boolean }) {
  return <Card><View className="gap-3">{loading ? <ActivityIndicator color="#F87171" /> : retry ? <AlertCircle color="#F87171" size={24} /> : null}<SectionTitle>{title}</SectionTitle>{text ? <Body>{text}</Body> : null}{retry ? <Action secondary label="Tentar novamente" onPress={retry} /> : null}</View></Card>
}
export function DetailRow({ label, value }: { label: string; value: string }) {
  return <View className="gap-1 border-b border-[#2D2D32] py-3"><Text className="text-xs text-[#A1A1AA]">{label}</Text><Text className="text-base font-medium text-white" selectable>{value}</Text></View>
}
