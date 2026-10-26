import { AlertTriangle, BarChart3, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { sumFundWinnerTotals, type FundWinnerTotalsRow } from '@/lib/fundosDashboard'

interface FundoDistribuicaoRow extends FundWinnerTotalsRow {
  fundo_id: string
  nome: string
  cor_hex: string
  operacoes_representadas: number
}

interface FundoDistribuicaoData {
  fundos: FundoDistribuicaoRow[]
  operacoes_sem_fundo_vencedor: number
  volume_solicitado_sem_fundo_vencedor: number
  volume_ganho_sem_fundo_vencedor: number
  operacoes_unicas: number
  volume_solicitado_unico: number
  volume_ganho_unico: number
}

interface Props {
  inicio: string
  fim: string
  fundo: string
  partner: string
}

const money = (value: number | string | undefined) => brl(Math.round(Number(value ?? 0) * 100))

export function FundoDistribuicaoCard({ inicio, fim, fundo, partner }: Props) {
  const query = useQuery({
    queryKey: ['admin-dashboard-fundos', inicio, fim, fundo, partner],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard_fundos_analytics', {
        p_inicio: inicio,
        p_fim: fim,
        p_fundo: fundo || null,
        p_partner: partner || null,
        p_equipe: null,
      })
      if (error) throw error
      return data as FundoDistribuicaoData
    },
  })

  const data = query.data
  const rows = data?.fundos ?? []
  const maxAssignments = Math.max(...rows.map(row => Number(row.operacoes_representadas)), 0)
  const totals = sumFundWinnerTotals(rows)

  return (
    <section className="card p-5" aria-label="Distribuição de operações por fundo">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-navy" />
            <h2 className="font-semibold text-navy">Distribuição por fundos</h2>
          </div>
          <p className="mt-0.5 text-xs text-silver-500">
            Atribuições mostram vínculos por fundo; valores ficam no primeiro fundo aprovado.
          </p>
        </div>
        {query.isFetching && <Loader2 className="h-4 w-4 animate-spin text-silver-400" />}
      </div>

      {query.isError ? (
        <p className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          Não foi possível carregar a distribuição por fundos.
        </p>
      ) : query.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-silver-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-silver-400">
          Nenhuma operação atribuída a fundo neste período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-silver-200 text-left text-[11px] uppercase tracking-wide text-silver-500">
              <tr>
                <th scope="col" className="pb-3 pr-4 font-semibold">Fundo</th>
                <th scope="col" className="pb-3 px-3 text-right font-semibold">Atribuições</th>
                <th scope="col" className="pb-3 px-3 text-right font-semibold">Operações únicas</th>
                <th scope="col" className="pb-3 px-3 text-right font-semibold">Volume solicitado</th>
                <th scope="col" className="pb-3 pl-3 text-right font-semibold">Volume ganho</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.fundo_id} className="border-b border-silver-100 transition-colors hover:bg-silver-50/70">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: row.cor_hex }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-silver-800">{row.nome}</span>
                    </div>
                    <div className="mt-2 h-7 w-full min-w-[180px] max-w-[320px] overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full rounded-r-md bg-[#D9534F] transition-[width] duration-300"
                        style={{
                          width: maxAssignments > 0 && Number(row.operacoes_representadas) > 0
                            ? `${Math.max(2, (Number(row.operacoes_representadas) / maxAssignments) * 100)}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span className="sr-only">{row.operacoes_representadas} atribuições</span>
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums text-silver-700">{row.operacoes_representadas}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-navy">{row.operacoes_unicas}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-silver-700">{money(row.volume_solicitado)}</td>
                  <td className="py-3 pl-3 text-right font-semibold tabular-nums whitespace-nowrap text-navy">{money(row.volume_ganho)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-silver-200 bg-silver-50/70 font-semibold text-navy">
                <th scope="row" className="py-3 pr-4 text-left">Total atribuído ao fundo vencedor</th>
                <td className="px-3 py-3 text-right text-silver-400">—</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.operacoes_unicas}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{money(totals.volume_solicitado)}</td>
                <td className="py-3 pl-3 text-right tabular-nums whitespace-nowrap">{money(totals.volume_ganho)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && data.operacoes_sem_fundo_vencedor > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-silver-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {data.operacoes_sem_fundo_vencedor} operação(ões), com {money(data.volume_solicitado_sem_fundo_vencedor)} solicitados, ainda não possuem fundo vencedor. Os valores não entram no total por fundo até a primeira aprovação.
          </span>
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-silver-500">
        A mesma proposta pode aparecer em mais de um fundo nas atribuições. O total financeiro conta cada operação uma vez, no primeiro fundo aprovado; o traço no total de atribuições indica que vínculos podem se repetir entre fundos.
      </p>
    </section>
  )
}
