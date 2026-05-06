import { View, Text } from 'react-native'

export function KPICard({ label, value, hint, intent = 'default', bg = 'bg-white' }: {
  label: string
  value: string
  hint?: string
  intent?: 'default' | 'success' | 'warning' | 'danger' | 'gold'
  bg?: string
}) {
  const colors = {
    default: 'text-white',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    gold: 'text-gold-400',
  }[intent]
  return (
    <View className={`flex-1 rounded-xl border border-silver-200 ${bg} p-4`}>
      <Text className="text-xs uppercase text-white/50">{label}</Text>
      <Text className={`mt-1 text-2xl font-bold ${colors}`}>{value}</Text>
      {hint && <Text className="mt-1 text-xs text-white/50">{hint}</Text>}
    </View>
  )
}
