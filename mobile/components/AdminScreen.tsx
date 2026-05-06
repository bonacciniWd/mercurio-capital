import { ScrollView, View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { ReactNode } from 'react'

export function AdminHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="bg-silver-900 px-5 py-4">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="-ml-2 p-2">
          <ArrowLeft size={22} color="white" />
        </Pressable>
        <View className="flex-1">
          {subtitle && <Text className="text-xs uppercase tracking-wider text-danger">{subtitle}</Text>}
          <Text className="text-lg font-bold text-white">{title}</Text>
        </View>
      </View>
    </View>
  )
}

export function AdminScreen({ title, subtitle = 'Modo Admin', children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top']}>
      <AdminHeader title={title} subtitle={subtitle} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
