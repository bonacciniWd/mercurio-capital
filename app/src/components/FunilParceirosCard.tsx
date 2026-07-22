import { useQuery } from '@tanstack/react-query'
import { Mail, LogIn, FileCheck2, ShieldCheck, FileSignature, Banknote, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type FunilRow = {
  convidados: number
  ativaram: number
  enviaram_docs: number
  aprovados: number
  com_proposta: number
  com_comissao_paga: number
}

const STEPS = [
  { key: 'convidados',        label: 'Convidados',        icon: Mail,          accent: '#0F172A' },
  { key: 'ativaram',          label: 'Ativaram conta',    icon: LogIn,         accent: '#0EA5E9' },
  { key: 'enviaram_docs',     label: 'Enviaram docs',     icon: FileCheck2,    accent: '#6366F1' },
  { key: 'aprovados',         label: 'Aprovados',         icon: ShieldCheck,   accent: '#16A34A' },
  { key: 'com_proposta',      label: '1ª proposta',       icon: FileSignature, accent: '#F59E0B' },
  { key: 'com_comissao_paga', label: 'Comissão paga',     icon: Banknote,      accent: '#DC2626' },
] as const

function pct(curr: number, base: number) {
  if (!base || base <= 0) return 0
  return Math.round((curr / base) * 100)
}

export function FunilParceirosCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-funil-parceiros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_funil_parceiros')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as FunilRow | null
    },
  })

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-navy">Funil de parceiros</h2>
          <p className="text-xs text-silver-500">Do convite à primeira comissão paga.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : error ? (
        <p className="py-6 text-center text-sm text-danger">Erro ao carregar funil.</p>
      ) : !data ? (
        <p className="py-6 text-center text-sm text-silver-400">Sem dados.</p>
      ) : (
        <div className="-mx-1 flex items-stretch gap-1 overflow-x-auto pb-1">
          {STEPS.map((step, i) => {
            const value = (data[step.key] ?? 0) as number
            const prev  = i === 0 ? null : ((data[STEPS[i - 1].key] ?? 0) as number)
            const conv  = prev === null ? null : pct(value, prev)
            const total = (data[STEPS[0].key] ?? 0) as number
            const fromStart = i === 0 ? null : pct(value, total)
            const Icon = step.icon
            return (
              <div key={step.key} className="flex flex-1 min-w-[140px] items-center gap-1">
                <div
                  className="flex flex-1 flex-col gap-1 rounded-lg border border-silver-200 bg-white px-3 py-3"
                  style={{ borderTopWidth: 3, borderTopColor: step.accent }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-silver-500">
                    <Icon className="h-3.5 w-3.5" />
                    {step.label}
                  </div>
                  <div className="text-2xl font-bold text-navy tabular-nums">{value}</div>
                  {conv !== null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-silver-500">vs etapa anterior</span>
                      <span className={`font-semibold ${conv >= 70 ? 'text-success' : conv >= 40 ? 'text-red-600' : 'text-danger'}`}>
                        {conv}%
                      </span>
                    </div>
                  )}
                  {fromStart !== null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-silver-500">vs convidados</span>
                      <span className="font-semibold text-navy">{fromStart}%</span>
                    </div>
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-silver-300" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
