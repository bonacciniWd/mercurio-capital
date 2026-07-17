import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { getSenhaMinLength, validarSenha } from '@/lib/securityConfig'

export function RedefinirSenha() {
  const navigate = useNavigate()
  const [hasRecovery, setHasRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw new Error(err.message)
      await supabase.auth.signOut()
      setDone(true)
      window.setTimeout(() => navigate('/p/login', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar senha.')
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

                  {error && (
                    <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="btn-gold w-full" disabled={loading}>
                    {loading ? 'Atualizando...' : 'Atualizar senha'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative col-span-3 hidden lg:block">
        <img src="/renewal-password.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
         <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,55,0.25),transparent_60%)]" />
      </div>
    </div>
  )
}
