// Cartão de push do cliente na Home /c (issue #14, especificação UX aprovada).
// Um único controle = preferência global (push_opt_out). Sem banner contextual.
// Renderiza só com flag on + suportado + configurado; negado → só orientação.
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { usePushOptOut } from '@/hooks/usePushOptOut'
import {
  initPushWeb,
  pushWebConfigurado,
  pushWebSuportado,
  requestPushPermission,
  revokePushWeb,
} from '@/lib/pushWeb'

export function PushClientCard() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const flagOn = useFeatureFlag('push_web')
  const userId = session?.userId
  const optOutQ = usePushOptOut(userId)
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    pushWebSuportado() ? Notification.permission : 'denied',
  )
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus()
  }, [feedback])

  const mestreMut = useMutation({
    mutationFn: async (optOut: boolean) => {
      const { error } = await supabase.rpc('push_preferencia_set', { p_opt_out: optOut })
      if (error) throw error
    },
    onSuccess: (_d, optOut) => qc.setQueryData(['push', 'pref', userId], optOut),
  })

  if (!flagOn || !pushWebSuportado() || !pushWebConfigurado()) return null

  const optOut = optOutQ.data === true

  async function handleAtivar() {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await requestPushPermission()
      setPermission(result)
      if (result === 'granted') {
        await mestreMut.mutateAsync(false) // garante o mestre ligado junto
        setFeedback({ kind: 'ok', msg: 'Notificações ativadas neste navegador.' })
      }
    } catch {
      setFeedback({ kind: 'err', msg: 'Não foi possível concluir agora. Tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDesativar() {
    setBusy(true)
    setFeedback(null)
    try {
      await mestreMut.mutateAsync(true) // só confirma após gravar o opt-out no servidor
      await revokePushWeb()
      setFeedback({ kind: 'ok', msg: 'Notificações desativadas em todos os seus dispositivos.' })
    } catch {
      setFeedback({ kind: 'err', msg: 'Não foi possível salvar. Tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleReativar() {
    setBusy(true)
    setFeedback(null)
    try {
      await mestreMut.mutateAsync(false)
      if (permission === 'granted') await initPushWeb()
      setFeedback({ kind: 'ok', msg: 'Notificações reativadas.' })
    } catch {
      setFeedback({ kind: 'err', msg: 'Não foi possível salvar. Tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  let linha: string
  let acao: React.ReactNode = null
  if (permission === 'denied') {
    linha = 'Bloqueadas pelo navegador. Para reverter, ajuste as notificações nas configurações deste site no navegador.'
  } else if (permission === 'default') {
    linha = 'Receba avisos de status de proposta e documentos neste navegador.'
    acao = (
      <button className="btn-no-liquid btn-gold w-full sm:w-auto" onClick={handleAtivar} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Ativar
      </button>
    )
  } else if (optOut) {
    linha = 'Desativadas em todos os seus dispositivos.'
    acao = (
      <button className="btn-no-liquid btn-gold w-full sm:w-auto" onClick={handleReativar} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Reativar
      </button>
    )
  } else {
    linha = 'Ativadas. Você recebe avisos deste navegador.'
    acao = (
      <button className="btn-no-liquid btn-outline w-full sm:w-auto" onClick={handleDesativar} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Desativar
      </button>
    )
  }

  return (
    <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-navy/5 p-2.5"><Bell className="h-5 w-5 text-navy" aria-hidden /></div>
        <div>
          <p className="font-semibold text-navy">Notificações push</p>
          <p className="text-sm text-silver-600">{linha}</p>
          {feedback && (
            <p
              ref={feedbackRef}
              role={feedback.kind === 'err' ? 'alert' : 'status'}
              tabIndex={-1}
              className={`mt-1 text-sm ${feedback.kind === 'ok' ? 'text-success' : 'text-danger'}`}
            >
              {feedback.msg}
            </p>
          )}
        </div>
      </div>
      {acao}
    </div>
  )
}
