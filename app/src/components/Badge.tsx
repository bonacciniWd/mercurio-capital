import { cn } from '@/lib/utils'

const VARIANTS: Record<string, string> = {
  gray:    'bg-silver-100 text-silver-700',
  blue:    'bg-blue-100 text-blue-700',
  green:   'bg-green-100 text-green-700',
  yellow:  'bg-yellow-100 text-yellow-800',
  red:     'bg-red-100 text-red-700',
  purple:  'bg-purple-100 text-purple-700',
  amber:   'bg-amber-100 text-amber-800',
  navy:    'bg-navy-100 text-navy-600',
  gold:    'bg-gold-100 text-gold-700',
}

export function Badge({
  children,
  variant = 'gray',
  className,
}: {
  children: React.ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}) {
  return <span className={cn('badge', VARIANTS[variant], className)}>{children}</span>
}

const STATUS_MAP: Record<string, keyof typeof VARIANTS> = {
  Rascunho: 'gray',
  'Pré-análise': 'yellow',
  'Análise de Crédito': 'blue',
  'Análise de Imóvel': 'blue',
  'Análise Jurídica': 'blue',
  Comitê: 'purple',
  'Proposta ao Cliente': 'amber',
  'Emissão de Contrato': 'amber',
  'Aguardando Assinatura': 'amber',
  'Em Registro': 'amber',
  'Contrato Registrado': 'green',
  'Recurso Liberado': 'green',
  'Convertida em Proposta': 'green',
  Cancelado: 'red',
  Pendente: 'yellow',
  Aprovado: 'green',
  Suspenso: 'red',
  Conectado: 'green',
  Desconectado: 'gray',
  Erro: 'red',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_MAP[status] ?? 'gray'}>{status}</Badge>
}
