import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { ReactNode } from 'react'

export function AdminHeader({ title, subtitle = 'MODO ADMIN' }: { title: string; subtitle?: string }) {
  return (
    <View style={s.header}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)' as any))}
        style={s.backBtn}
      >
        <ArrowLeft size={20} color="white" />
      </Pressable>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={s.eyebrow}>{subtitle.toUpperCase()}</Text> : null}
        <Text style={s.title}>{title}</Text>
      </View>
    </View>
  )
}

export function AdminScreen({
  title,
  subtitle = 'ADMIN',
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <AdminHeader title={title} subtitle={subtitle} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  backBtn: { padding: 8, marginLeft: -8 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
})
