import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'

type Phase = 'loading' | 'set_password' | 'redirecting' | 'error'

export function PartnerBootstrap() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
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
      const { error: upErr } = await supabase.auth.updateUser({ password: pwd })
      if (upErr) throw new Error(upErr.message)
      await finishRedirect()
    } catch (e) {
      setError((e as Error).message)
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
                  Definir senha
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

