import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Wallet, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'

interface TopupRow {
  id: string
  valor_centavos: number
  status: 'processing' | 'succeeded' | 'failed' | 'canceled' | string
  provider_intent_id: string | null
  created_at: string
  confirmado_em: string | null
  metadata: Record<string, unknown> | null
}

interface Resumo {
  saldo_centavos: number
  moeda: string
}

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 60_000

/**
 * Página de retorno do Stripe Checkout.
 * - status=success  → polla wallet_topups até webhook confirmar (max 60s)
 * - status=cancel   → mostra mensagem de cancelamento
 * - sem status      → redireciona para /p/carteira
 */
export function PartnerCarteiraRecarga() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const status = params.get('status')
  const sessionId = params.get('session_id')
  const [elapsedMs, setElapsedMs] = useState(0)

  // Localiza o topup: por session_id (preferencial) ou pelo mais recente do parceiro.
  const topupQuery = useQuery({
    queryKey: ['wallet-topup-resultado', sessionId],
    enabled: status === 'success',
    refetchInterval: (q) => {
      const data = q.state.data as TopupRow | null
      if (!data) return POLL_INTERVAL_MS
      if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled') return false
      return elapsedMs < POLL_TIMEOUT_MS ? POLL_INTERVAL_MS : false
    },
    queryFn: async () => {
      // 1) tenta por session_id na metadata
      if (sessionId) {
        const { data } = await supabase
          .from('wallet_topups')
          .select('id, valor_centavos, status, provider_intent_id, created_at, confirmado_em, metadata')
          .contains('metadata', { session_id: sessionId })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data) return data as TopupRow
      }
      // 2) fallback: topup mais recente do parceiro (últimos 30 min)
      const since = new Date(Date.now() - 30 * 60_000).toISOString()
      const { data } = await supabase
        .from('wallet_topups')
        .select('id, valor_centavos, status, provider_intent_id, created_at, confirmado_em, metadata')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data ?? null) as TopupRow | null
    },
  })

  const resumoQuery = useQuery({
    queryKey: ['wallet-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('partner_wallet_summary')
      if (error) throw error
      return (((data ?? []) as Resumo[])[0] ?? null)
    },
    enabled: status === 'success',
  })

  // Cronômetro de polling
  useEffect(() => {
    if (status !== 'success') return
    const t = setInterval(() => setElapsedMs((v) => v + 1000), 1_000)
    return () => clearInterval(t)
  }, [status])

  // Quando confirmar, invalida caches para o Carteira.tsx mostrar dados frescos
  useEffect(() => {
    if (topupQuery.data?.status === 'succeeded') {
      void qc.invalidateQueries({ queryKey: ['wallet-resumo'] })
      void qc.invalidateQueries({ queryKey: ['wallet-extrato'] })
      void resumoQuery.refetch()
    }
  }, [topupQuery.data?.status, qc, resumoQuery])

  const topup = topupQuery.data
  const phase = useMemo<'pending' | 'success' | 'failed' | 'timeout' | 'cancel' | 'unknown'>(() => {
    if (status === 'cancel') return 'cancel'
    if (status !== 'success') return 'unknown'
    if (!topup) return elapsedMs > 8_000 ? 'pending' : 'pending'
    if (topup.status === 'succeeded') return 'success'
    if (topup.status === 'failed' || topup.status === 'canceled') return 'failed'
    if (elapsedMs > POLL_TIMEOUT_MS) return 'timeout'
    return 'pending'
  }, [status, topup, elapsedMs])

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/p/carteira" className="mb-4 inline-flex items-center gap-1 text-sm text-silver-600 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar para carteira
      </Link>

      <div className="card p-6 text-center">
        {phase === 'pending' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-red-700" />
            <h1 className="mt-4 text-xl font-bold text-navy">Confirmando seu pagamento…</h1>
            <p className="mt-2 text-sm text-silver-600">
              Aguardando confirmação do Stripe. Isso costuma levar de 2 a 10 segundos.
            </p>
            {topup && (
              <p className="mt-3 text-xs text-silver-500">
                Recarga de <strong className="text-navy">{brl(topup.valor_centavos)}</strong> — protocolo{' '}
                <code className="text-[11px]">{topup.id.slice(0, 8)}</code>
              </p>
            )}
            <p className="mt-4 text-[11px] uppercase tracking-wider text-silver-400">
              Tempo: {Math.floor(elapsedMs / 1000)}s
            </p>
          </>
        )}

        {phase === 'success' && topup && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="mt-4 text-2xl font-bold text-navy">Pagamento confirmado!</h1>
            <p className="mt-2 text-sm text-silver-600">
              Sua carteira foi creditada em <strong className="text-success">+ {brl(topup.valor_centavos)}</strong>.
            </p>
            {resumoQuery.data && (
              <div className="mt-5 rounded-lg border border-silver-200 bg-silver-50 p-4">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-silver-500">
                  <Wallet className="h-3.5 w-3.5" /> Novo saldo
                </div>
                <p className="mt-1 text-3xl font-bold text-navy">{brl(resumoQuery.data.saldo_centavos)}</p>
              </div>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/p/carteira" className="btn-gold">Ver extrato</Link>
              <Link to="/p/propostas" className="btn-outline">Voltar às propostas</Link>
            </div>
          </>
        )}

        {phase === 'failed' && (
          <>
            <XCircle className="mx-auto h-14 w-14 text-danger" />
            <h1 className="mt-4 text-xl font-bold text-navy">Pagamento recusado</h1>
            <p className="mt-2 text-sm text-silver-600">
              Não foi possível concluir a cobrança. Nenhum valor foi debitado.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/p/carteira" className="btn-gold">Tentar nova recarga</Link>
            </div>
          </>
        )}

        {phase === 'cancel' && (
          <>
            <AlertTriangle className="mx-auto h-14 w-14 text-red-700" />
            <h1 className="mt-4 text-xl font-bold text-navy">Recarga cancelada</h1>
            <p className="mt-2 text-sm text-silver-600">
              Você cancelou o pagamento. Nenhum valor foi debitado.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/p/carteira" className="btn-gold">Voltar à carteira</Link>
            </div>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <AlertTriangle className="mx-auto h-14 w-14 text-red-700" />
            <h1 className="mt-4 text-xl font-bold text-navy">Confirmação demorando…</h1>
            <p className="mt-2 text-sm text-silver-600">
              O pagamento foi enviado ao Stripe mas ainda não recebemos a confirmação do webhook.
              O crédito aparecerá em até alguns minutos — pode acompanhar pelo extrato.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/p/carteira" className="btn-gold">Ir para o extrato</Link>
            </div>
          </>
        )}

        {phase === 'unknown' && (
          <>
            <Wallet className="mx-auto h-14 w-14 text-silver-400" />
            <h1 className="mt-4 text-xl font-bold text-navy">Sem recarga em andamento</h1>
            <p className="mt-2 text-sm text-silver-600">
              Use a tela da carteira para iniciar uma nova recarga.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/p/carteira" className="btn-gold">Ir para a carteira</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

