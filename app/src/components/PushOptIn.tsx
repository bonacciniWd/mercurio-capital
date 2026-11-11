// Banner contextual de opt-in de push (issue #14, especificação UX aprovada).
// Regras: staff apenas · flag push_web · suportado+configurado · permission default ·
// a partir da 2ª sessão (janela 12h) · "Agora não" esconde por 14d, máx. 3× ·
// aceitar/negar no prompt nativo encerra definitivamente (never).
import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import {
  pushWebConfigurado,
  pushWebSuportado,
  requestPushPermission,
} from '@/lib/pushWeb'
import { deveExibirPrompt, marcarPrompt, readJson, PROMPT_PREFIX, type PromptState } from '@/lib/pushOptInRules'

type Fase = 'pergunta' | 'sucesso' | 'negado' | 'erro'

export function PushOptIn() {
  const { session } = useAuth()
  const flagOn = useFeatureFlag('push_web')
  const [visivel, setVisivel] = useState(false)
  const [fase, setFase] = useState<Fase>('pergunta')
  const [busy, setBusy] = useState(false)

  const roleElegivel = session?.role === 'admin' || session?.role === 'partner' || session?.role === 'team_member'
  const userId = session?.userId

  useEffect(() => {
    if (!userId || !roleElegivel || !flagOn) return
    if (!pushWebSuportado() || !pushWebConfigurado()) return
    if (Notification.permission !== 'default') return
    setVisivel(deveExibirPrompt(userId))
  }, [userId, roleElegivel, flagOn])

  // sucesso/negado desmontam sozinhos após o feedback
  useEffect(() => {
    if (fase !== 'sucesso' && fase !== 'negado') return
    const t = setTimeout(() => setVisivel(false), fase === 'sucesso' ? 4000 : 6000)
    return () => clearTimeout(t)
  }, [fase])

  const feedbackRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (fase !== 'pergunta') feedbackRef.current?.focus()
  }, [fase])

  if (!visivel) return null

  async function handleAtivar() {
    if (!userId) return
    setBusy(true)
    try {
      const result = await requestPushPermission()
      if (result === 'granted') {
        marcarPrompt(userId, { never: true })
        setFase('sucesso')
      } else {
        marcarPrompt(userId, { never: true })
        setFase('negado')
      }
    } catch {
      setFase('erro') // falha técnica: pode reexibir (não grava never)
    } finally {
      setBusy(false)
    }
  }

  function handleAgoraNao() {
    if (!userId) return
    const prev = readJson<PromptState>(PROMPT_PREFIX + userId)
    marcarPrompt(userId, { dismisses: (prev?.dismisses ?? 0) + 1, last: new Date().toISOString() })
    setVisivel(false)
  }

  if (fase === 'sucesso' || fase === 'negado' || fase === 'erro') {
    return (
      <section role="region" aria-label="Notificações push" className="card mb-6 p-4">
        <p
          ref={feedbackRef}
          role={fase === 'erro' ? 'alert' : 'status'}
          tabIndex={-1}
          className={`flex items-center gap-2 text-sm font-medium ${fase === 'sucesso' ? 'text-success' : 'text-danger'}`}
        >
          {fase === 'sucesso' && <><CheckCircle2 className="h-4 w-4" aria-hidden /> Notificações ativadas neste navegador.</>}
          {fase === 'negado' && 'O navegador bloqueou as notificações. Para reverter, use Configurações → Notificações.'}
          {fase === 'erro' && 'Não foi possível concluir agora. Tente novamente em Configurações → Notificações.'}
        </p>
      </section>
    )
  }

  return (
    <section
      role="region"
      aria-label="Notificações push"
      className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-navy/5 p-2.5"><Bell className="h-5 w-5 text-navy" aria-hidden /></div>
        <div>
          <p className="font-semibold text-navy">Receba alertas mesmo com a aba fechada</p>
          <p className="text-sm text-silver-600">
            Ative notificações push neste navegador para acompanhar propostas, pendências e documentos em tempo real.
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <button className="btn-no-liquid btn-gold w-full sm:w-auto" onClick={handleAtivar} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Ativar notificações
        </button>
        <button className="btn-no-liquid w-full text-silver-600 hover:text-navy sm:w-auto" onClick={handleAgoraNao} disabled={busy}>
          Agora não
        </button>
      </div>
    </section>
  )
}
