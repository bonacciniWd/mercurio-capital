import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { publicAppUrl } from '@/lib/publicUrl'
import renewalPassword from '@/assets/renewal-password.jpg'

export function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const redirectTo = publicAppUrl('/redefinir-senha')
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (err) throw new Error(err.message)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar e-mail.')
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
            {sent ? (
              <>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <MailCheck className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold text-navy">Verifique seu e-mail</h1>
                <p className="mt-2 text-sm text-silver-600">
                  Se houver uma conta vinculada a <strong>{email}</strong>, enviamos um link para você redefinir a
                  senha. O link expira em 1 hora.
                </p>
                <Link to="/p/login" className="btn-gold mt-6 inline-flex w-full justify-center">Voltar ao login</Link>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-navy">Recuperar acesso</h1>
                <p className="mt-1 text-sm text-silver-600">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="label">E-mail</label>
                    <input
                      className="input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@empresa.com"
                      required
                    />
                  </div>

                  {error && (
                    <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="btn-gold w-full" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                  </button>

                  <p className="text-center text-sm text-silver-600">
                    <Link to="/p/login" className="font-medium text-navy underline">Voltar ao login</Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>


      <div className="relative col-span-3 hidden bg-black lg:block">
        <img src={renewalPassword} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative flex h-full flex-col justify-end p-16 text-white">
          <h2 className="max-w-xl text-4xl font-bold leading-tight">
            Esqueceu a senha? <span className="text-red-600">Sem stress.</span>
          </h2>
          <p className="mt-4 max-w-lg text-white/80">
            Vamos enviar um link seguro pro seu e-mail. O link é único, expira em 1h e só funciona uma vez.
          </p>
        </div>
      </div>
    </div>
  )
}
