import { View, Text } from 'react-native'

const VARIANTS = {
  gray: 'bg-silver-100 text-silver-700',
  green: 'bg-success/15 text-success',
  red: 'bg-danger/15 text-danger',
  amber: 'bg-warning/15 text-warning',
  blue: 'bg-navy-50 text-navy-700',
  gold: 'bg-gold/15 text-gold-600',
  navy: 'bg-navy text-white',
} as const

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: keyof typeof VARIANTS }) {
  const [bg, fg] = VARIANTS[variant].split(' ')
  return (
    <View className={`self-start rounded-md px-2 py-0.5 ${bg}`}>
      <Text className={`text-xs font-medium ${fg}`}>{children}</Text>
    </View>
  )
}

const STATUS_MAP: Record<string, keyof typeof VARIANTS> = {
  Rascunho: 'gray',
  'Pré-análise': 'amber',
  'Análise de Crédito': 'blue',
  'Análise Jurídica': 'blue',
  Comitê: 'amber',
  'Aguardando assinatura': 'amber',
  'Recurso Liberado': 'green',
  Aprovado: 'green',
  Recusado: 'red',
  Bloqueado: 'red',
  Ativo: 'green',
  Pendente: 'amber',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_MAP[status] ?? 'gray'}>{status}</Badge>
}
