import { View, Text } from 'react-native'

export function KPICard({ label, value, hint, intent = 'default' }: {
  label: string
  value: string
  hint?: string
  intent?: 'default' | 'success' | 'warning' | 'danger' | 'gold'
}) {
  const colors = {
    default: 'text-navy',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    gold: 'text-gold-600',
  }[intent]
  return (
    <View className="flex-1 rounded-xl border border-silver-200 bg-white p-4">
      <Text className="text-xs uppercase text-silver-500">{label}</Text>
      <Text className={`mt-1 text-2xl font-bold ${colors}`}>{value}</Text>
      {hint && <Text className="mt-1 text-xs text-silver-500">{hint}</Text>}
    </View>
  )
}
