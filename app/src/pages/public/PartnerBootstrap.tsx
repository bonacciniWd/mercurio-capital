import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'

const INVITE_SESSION_EXPIRED_MESSAGE =
  'Sessão expirada. Abra novamente o link do convite para continuar.'
const MFA_FACTOR_MISSING_MESSAGE =
  'Não encontramos um fator TOTP verificado nesta conta. Faça login novamente e conclua a configuração/validação do 2FA para definir a senha.'
const MFA_CODE_INVALID_MESSAGE =
  'Código 2FA inválido ou expirado. Gere um novo código no aplicativo autenticador e tente novamente.'
const MFA_STEP_UP_HINT =
  'Para concluir a definição de senha, confirme seu código 2FA de 6 dígitos.'

const SESSION_MISSING_MARKERS = [
  'auth session missing',
  'session missing',
  'invalid refresh token',
  'refresh token not found',
  'refresh token is invalid',
  'jwt expired',
]

const MFA_CODE_INVALID_MARKERS = [
  'invalid otp',
  'invalid code',
  'verification failed',
  'challenge not found',
  'expired',
]

function readErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return ''
}

function includesMarker(message: string, markers: string[]): boolean {
  const normalized = message.toLowerCase()
  return markers.some((marker) => normalized.includes(marker))
}

function isAal2RequiredForPasswordUpdate(err: unknown): boolean {
  const message = readErrorMessage(err).toLowerCase()
  return message.includes('aal2 session is required')
    && (message.includes('update email or password') || message.includes('update password'))
}

function normalizeInviteError(err: unknown): string {
  const message = readErrorMessage(err)
  if (!message) return 'Não foi possível definir a senha no momento.'
  if (includesMarker(message, SESSION_MISSING_MARKERS)) return INVITE_SESSION_EXPIRED_MESSAGE
  return message
}

function normalizeMfaStepUpError(err: unknown): string {
  const message = readErrorMessage(err)
  if (!message) return 'Não foi possível validar o código 2FA.'
  if (includesMarker(message, SESSION_MISSING_MARKERS)) return INVITE_SESSION_EXPIRED_MESSAGE
  if (includesMarker(message, MFA_CODE_INVALID_MARKERS)) return MFA_CODE_INVALID_MESSAGE
  return message
}

type Phase = 'loading' | 'set_password' | 'redirecting' | 'error'

export function PartnerBootstrap() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsAal2StepUp, setNeedsAal2StepUp] = useState(false)
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  // Aguarda o Supabase materializar a sessão a partir do hash (#access_token=...)
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    async function waitForSession() {
      while (!cancelled && attempts < 30) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setEmail(data.session.user.email ?? null)
          // força refresh do JWT para puxar app_metadata atualizada (role='partner')
          await supabase.auth.refreshSession().catch(() => null)
          await refresh()
          setPhase('set_password')
          return
        }
        attempts += 1
        await new Promise((r) => setTimeout(r, 250))
      }
      if (!cancelled) {
        setPhase('error')
        setError('Não foi possível validar o convite. O link pode estar expirado.')
      }
    }

    void waitForSession()
    return () => { cancelled = true }
  }, [refresh])

  async function getVerifiedTotpFactorId(): Promise<string> {
    const { data, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr) throw new Error(normalizeMfaStepUpError(listErr))

    const factor = data?.totp?.find((f) => f.status === 'verified')
    if (!factor) throw new Error(MFA_FACTOR_MISSING_MESSAGE)
    return factor.id
  }

  async function finishRedirect() {
    setPhase('redirecting')
    try {
      const { data, error: meErr } = await supabase.rpc('me')
      if (meErr) throw new Error(meErr.message)
      const m = (data ?? {}) as { role?: string; partner_status?: string; approved?: boolean }
      if (m.role === 'partner') {
        if (m.partner_status === 'approved') navigate('/p', { replace: true })
        else navigate('/acesso-pendente', { replace: true })
      } else if (m.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/acesso-pendente', { replace: true })
      }
    } catch (e) {
      setPhase('error')
      setError((e as Error).message)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const erroSenha = validarSenha(pwd, await getSenhaMinLength())
    if (erroSenha) { setError(erroSenha); return }
    if (pwd !== pwd2) { setError('As senhas não conferem.'); return }

    setSubmitting(true)
    try {
      if (!needsAal2StepUp) {
        const { error: upErr } = await supabase.auth.updateUser({ password: pwd })
        if (!upErr) {
          await finishRedirect()
          return
        }

        if (!isAal2RequiredForPasswordUpdate(upErr)) {
          throw upErr
        }

        const factorId = await getVerifiedTotpFactorId()
        setTotpFactorId(factorId)
        setNeedsAal2StepUp(true)
        setError(MFA_STEP_UP_HINT)
        setSubmitting(false)
        return
      }

      if (totpCode.length !== 6) {
        setError('Informe o código 2FA de 6 dígitos.')
        setSubmitting(false)
        return
      }

      const factorId = totpFactorId ?? await getVerifiedTotpFactorId()
      if (!totpFactorId) {
        setTotpFactorId(factorId)
      }

      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr || !challenge) {
        throw challengeErr ?? new Error('Não foi possível iniciar o desafio 2FA.')
      }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode,
      })
      if (verifyErr) throw verifyErr

      const { error: retryErr } = await supabase.auth.updateUser({ password: pwd })
      if (retryErr) {
        if (isAal2RequiredForPasswordUpdate(retryErr)) {
          throw new Error('Não foi possível elevar a sessão para AAL2. Tente validar o código novamente.')
        }
        throw retryErr
      }

      await finishRedirect()
    } catch (e) {
      if (isAal2RequiredForPasswordUpdate(e)) {
        setNeedsAal2StepUp(true)
        setError(MFA_STEP_UP_HINT)
      } else if (needsAal2StepUp) {
        setError(normalizeMfaStepUpError(e))
      } else {
        setError(normalizeInviteError(e))
      }
      setSubmitting(false)
    }
  }

  async function onSkip() {
    setSubmitting(true)
    await finishRedirect()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <div className="card w-full p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Convite de parceiro</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">Ativar acesso</h1>

        {phase === 'loading' && (
          <div className="mt-6 flex items-center gap-2 text-sm text-silver-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando o convite...
          </div>
        )}

        {phase === 'set_password' && (
          <>
            <p className="mt-3 text-sm text-silver-600">
              Bem-vindo{email ? `, ${email}` : ''}! Defina uma senha para acessar o portal pelo login tradicional.
              {' '}Você também poderá entrar via magic-link a qualquer momento.
            </p>

            <form className="mt-5 space-y-3" onSubmit={onSubmit}>
              <div>
                <label className="label">Nova senha</label>
                <input
                  className="input"
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Confirmar senha</label>
                <input
                  className="input"
                  type="password"
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  minLength={8}
                />
              </div>

              {needsAal2StepUp && (
                <div>
                  <label className="label">Código 2FA</label>
                  <input
                    className="input text-center text-lg tracking-[0.35em]"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                  />
                  <p className="mt-1 text-xs text-silver-600">
                    Abra seu app autenticador e informe o código atual de 6 dígitos.
                  </p>
                </div>
              )}

              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={submitting}
                  className="flex-1 rounded-md border border-silver-300 px-3 py-2 text-sm text-silver-700 hover:bg-silver-50 disabled:opacity-50"
                >
                  Pular por agora
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold flex-1 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {needsAal2StepUp ? 'Validar 2FA e definir senha' : 'Definir senha'}
                </button>
              </div>
            </form>
          </>
        )}

        {phase === 'redirecting' && (
          <div className="mt-6 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Tudo certo! Redirecionando...
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-6 space-y-3">
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              {error}
            </p>
            <a href="/p/login" className="btn-gold inline-flex w-full justify-center">
              Ir para o login
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

