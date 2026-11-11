// Seção "Notificações push neste navegador" (issue #14, especificação UX aprovada).
// Compartilhada entre admin e parceiro (topo da aba Notificações). Estados:
// B1 ativo · B2 desligado neste navegador · B3 nunca perguntado · B4 negado pelo
// navegador (sem CTA) · B5/B6/flag-off → não renderiza (degradê total).
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { usePushOptOut } from '@/hooks/usePushOptOut'
import {
  initPushWeb,
  isPushDeviceOff,
  pushWebConfigurado,
  pushWebSuportado,
  requestPushPermission,
  revokePushWeb,
  setPushDeviceOff,
} from '@/lib/pushWeb'

type Estado = 'ativo' | 'desligado' | 'nunca_perguntado' | 'negado'

export function PushBrowserSection() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const flagOn = useFeatureFlag('push_web')
  const userId = session?.userId
  const optOutQ = usePushOptOut(userId)

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    pushWebSuportado() ? Notification.permission : 'denied',
  )
  const [deviceOff, setDeviceOff] = useState(() => (userId ? isPushDeviceOff(userId) : false))
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const feedbackRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus()
  }, [feedback])

  const mestreMut = useMutation({
    mutationFn: async (optOut: boolean) => {
      const { error } = await supabase.rpc('push_preferencia_set', { p_opt_out: optOut })
      if (error) throw error
    },
    onSuccess: (_d, optOut) => {
      qc.setQueryData(['push', 'pref', userId], optOut)
      setFeedback({ kind: 'ok', msg: optOut ? 'Push geral desligado.' : 'Push geral ativado.' })
    },
    onError: () => setFeedback({ kind: 'err', msg: 'Não foi possível salvar. Tente novamente.' }),
  })

  if (!flagOn || !pushWebSuportado() || !pushWebConfigurado()) return null

  const optOut = optOutQ.data === true
  const estado: Estado =
    permission === 'denied' ? 'negado'
    : permission === 'default' ? 'nunca_perguntado'
    : optOut || deviceOff ? 'desligado'
    : 'ativo'

  async function handleAtivar() {
    if (!userId) return
    setBusy(true)
    setFeedback(null)
    try {
      const result = await requestPushPermission()
      setPermission(result)
      if (result === 'granted') {
        if (optOutQ.data === true) {
          // reativa o mestre junto; onSuccess por chamada preserva a mensagem do gesto
          mestreMut.mutate(false, {
            onSuccess: () => setFeedback({ kind: 'ok', msg: 'Notificações ativadas neste navegador.' }),
          })
        }
        setFeedback({ kind: 'ok', msg: 'Notificações ativadas neste navegador.' })
      }
    } catch {
      setFeedback({ kind: 'err', msg: 'Não foi possível concluir agora. Tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDesativarNesteNavegador() {
    if (!userId) return
    setBusy(true)
    await revokePushWeb()
    setPushDeviceOff(userId, true)
    setDeviceOff(true)
    setBusy(false)
    setFeedback({ kind: 'ok', msg: 'Notificações desativadas neste navegador.' })
  }

  async function handleReativar() {
    if (!userId) return
    setBusy(true)
    setPushDeviceOff(userId, false)
    setDeviceOff(false)
    if (optOutQ.data === true) mestreMut.mutate(false)
    await initPushWeb()
    setBusy(false)
    setFeedback({ kind: 'ok', msg: 'Notificações reativadas neste navegador.' })
  }

  return (
    <section aria-label="Notificações push neste navegador" className="mb-6 border-b border-silver-200 pb-6">
      <h3 className="text-sm font-semibold text-navy">Notificações push neste navegador</h3>
      <p className="mt-1 text-sm text-silver-500">
        Push é um canal complementar: e-mail e avisos dentro da plataforma continuam funcionando.
      </p>

      <div aria-live="polite" className="mt-3">
        {estado === 'ativo' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              <span className="font-medium text-navy">Ativadas</span>
              <span className="text-silver-600">Este navegador recebe notificações push.</span>
            </p>
            <button className="btn-no-liquid btn-outline" onClick={handleDesativarNesteNavegador} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Desativar neste navegador
            </button>
          </div>
        )}

        {estado === 'desligado' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium text-navy">
                {optOut && !deviceOff ? 'Desativadas em todos os seus dispositivos. ' : 'Desativadas neste navegador. '}
              </span>
              <span className="text-silver-600">
                {optOut && !deviceOff
                  ? 'A preferência geral está desligada; reative para voltar a receber neste navegador.'
                  : 'A permissão do navegador continua concedida; reative para voltar a receber.'}
              </span>
            </p>
            <button className="btn-no-liquid btn-gold" onClick={handleReativar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Reativar notificações
            </button>
          </div>
        )}

        {estado === 'nunca_perguntado' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium text-navy">Não ativadas. </span>
              <span className="text-silver-600">Ative para receber alertas de propostas e documentos neste navegador.</span>
            </p>
            <button className="btn-no-liquid btn-gold" onClick={handleAtivar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Ativar notificações
            </button>
          </div>
        )}

        {estado === 'negado' && (
          <div>
            <p className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-danger" aria-hidden />
              <span className="font-medium text-navy">Bloqueadas pelo navegador</span>
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-silver-600">
              <li><b>Chrome/Edge:</b> clique no cadeado na barra de endereço → Configurações do site → Notificações → Permitir. Depois, recarregue a página.</li>
              <li><b>Firefox:</b> cadeado na barra de endereço → Conexão segura → Mais informações → Permissões → Notificações.</li>
              <li><b>Safari 16.4+ (macOS):</b> menu Safari → Ajustes → Sites → Notificações → permitir este site.</li>
              <li><b>iPhone/iPad:</b> disponível apenas com o site instalado na tela de início (não coberto nesta versão).</li>
            </ul>
          </div>
        )}

        {feedback && (
          <p ref={feedbackRef} role={feedback.kind === 'err' ? 'alert' : 'status'} tabIndex={-1}
            className={`mt-3 text-sm ${feedback.kind === 'ok' ? 'text-success' : 'text-danger'}`}>
            {feedback.msg}
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-silver-100 pt-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-gold"
            checked={!optOut}
            disabled={optOutQ.isLoading || mestreMut.isPending}
            onChange={(e) => mestreMut.mutate(!e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-silver-800">Receber notificações push em todos os meus dispositivos</span>
            <span className="block text-xs text-silver-500">
              Quando desligado, nenhum evento envia push — mesmo com as caixas "Push" da tabela abaixo marcadas.
            </span>
            {!optOut && permission === 'default' && (
              <span className="mt-1 block text-xs text-silver-500">Ative também neste navegador, acima.</span>
            )}
          </span>
        </label>
      </div>
    </section>
  )
}
