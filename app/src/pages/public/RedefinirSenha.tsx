import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'
import renewalPassword from '@/assets/renewal-password.jpg'

const SESSION_EXPIRED_MESSAGE =
  'Sessão expirada. Solicite um novo link de recuperação para continuar.'
const RECOVERY_LINK_INVALID_MESSAGE =
  'Link de recuperação inválido ou expirado. Solicite um novo link para continuar.'
const MFA_FACTOR_MISSING_MESSAGE =
  'Não encontramos um fator TOTP verificado nesta conta. Faça login novamente e conclua a configuração/validação do 2FA para redefinir a senha.'
const MFA_CODE_INVALID_MESSAGE =
  'Código 2FA inválido ou expirado. Gere um novo código no aplicativo autenticador e tente novamente.'
const MFA_STEP_UP_HINT =
  'Para concluir a redefinição, confirme seu código 2FA de 6 dígitos.'

const SESSION_MISSING_MARKERS = [
  'auth session missing',
  'session missing',
  'invalid refresh token',
  'refresh token not found',
  'refresh token is invalid',
  'jwt expired',
]

const RECOVERY_LINK_INVALID_MARKERS = [
  'invalid token',
  'token has expired',
  'otp expired',
  'otp has expired',
  'flow state not found',
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

function normalizePasswordResetError(err: unknown): string {
  const message = readErrorMessage(err)
  if (!message) return 'Falha ao atualizar senha.'
  if (includesMarker(message, SESSION_MISSING_MARKERS)) return SESSION_EXPIRED_MESSAGE
  if (includesMarker(message, RECOVERY_LINK_INVALID_MARKERS)) return RECOVERY_LINK_INVALID_MESSAGE
  return message
}

function normalizeMfaStepUpError(err: unknown): string {
  const message = readErrorMessage(err)
  if (!message) return 'Não foi possível validar o código 2FA.'
  if (includesMarker(message, SESSION_MISSING_MARKERS)) return SESSION_EXPIRED_MESSAGE
  if (includesMarker(message, MFA_CODE_INVALID_MARKERS)) return MFA_CODE_INVALID_MESSAGE
  return message
}

export function RedefinirSenha() {
  const navigate = useNavigate()
  const [hasRecovery, setHasRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsAal2StepUp, setNeedsAal2StepUp] = useState(false)
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Quando o usuário clica no link do e-mail, o Supabase coloca o token no hash da URL
    // e dispara um evento PASSWORD_RECOVERY após detectar a sessão (detectSessionInUrl=true).
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setHasRecovery(true)
    })
    // Também tenta checar imediatamente — se já existe sessão, libera o form.
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setHasRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function getVerifiedTotpFactorId(): Promise<string> {
    const { data, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr) throw new Error(normalizeMfaStepUpError(listErr))

    const factor = data?.totp?.find((f) => f.status === 'verified')
    if (!factor) throw new Error(MFA_FACTOR_MISSING_MESSAGE)
    return factor.id
  }

  async function completePasswordUpdate(): Promise<void> {
    await supabase.auth.signOut()
    setDone(true)
    window.setTimeout(() => navigate('/p/login', { replace: true }), 1500)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const erroSenha = validarSenha(password, await getSenhaMinLength())
    if (erroSenha) {
      setError(erroSenha)
      return
    }
    if (password !== confirm) {
      setError('As senhas não conferem.')
      return
    }
    setLoading(true)
    try {
      if (!needsAal2StepUp) {
        const { error: err } = await supabase.auth.updateUser({ password })
        if (!err) {
          await completePasswordUpdate()
          return
        }

        if (!isAal2RequiredForPasswordUpdate(err)) {
          throw err
        }

        const factorId = await getVerifiedTotpFactorId()
        setTotpFactorId(factorId)
        setNeedsAal2StepUp(true)
        setError(MFA_STEP_UP_HINT)
        return
      }

      if (totpCode.length !== 6) {
        setError('Informe o código 2FA de 6 dígitos.')
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

      const { error: retryErr } = await supabase.auth.updateUser({ password })
      if (retryErr) {
        if (isAal2RequiredForPasswordUpdate(retryErr)) {
          throw new Error('Não foi possível elevar a sessão para AAL2. Tente validar o código novamente.')
        }
        throw retryErr
      }

      await completePasswordUpdate()
    } catch (err) {
      if (isAal2RequiredForPasswordUpdate(err)) {
        setError(MFA_STEP_UP_HINT)
        setNeedsAal2StepUp(true)
      } else if (needsAal2StepUp) {
        setError(normalizeMfaStepUpError(err))
      } else {
        setError(normalizePasswordResetError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      <div className="col-span-2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex justify-center"><Logo /></div>
          <div className="card p-8">
            {done ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold text-navy">Senha atualizada!</h1>
                <p className="mt-2 text-sm text-silver-600">Redirecionando para o login…</p>
              </div>
            ) : !hasRecovery ? (
              <>
                <h1 className="text-2xl font-bold text-navy">Link inválido ou expirado</h1>
                <p className="mt-2 text-sm text-silver-600">
                  Solicite um novo link de recuperação em <strong>/recuperar-senha</strong>.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-navy">Defina sua nova senha</h1>
                <p className="mt-1 text-sm text-silver-600">Escolha uma senha forte e única para sua conta.</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="label">Nova senha</label>
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Confirmar nova senha</label>
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
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
                    <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="btn-gold w-full" disabled={loading}>
                    {loading
                      ? 'Atualizando...'
                      : needsAal2StepUp
                        ? 'Validar 2FA e atualizar senha'
                        : 'Atualizar senha'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative col-span-3 hidden lg:block">
        <img src={renewalPassword} alt="" className="absolute inset-0 h-full w-full object-cover" />
         <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,55,0.25),transparent_60%)]" />
      </div>
    </div>
  )
}
