import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'

export function MagicLink() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { consumeMagicLink } = useAuth()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function run() {
      if (!token) {
        setStatus('error')
        setError('Token não informado.')
        return
      }

      try {
        const redirectTo = await consumeMagicLink(token)
        if (!mounted) return

        setStatus('ok')
        window.setTimeout(() => {
          navigate(redirectTo, { replace: true })
        }, 700)
      } catch (err) {
        if (!mounted) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Falha ao consumir magic link.')
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [consumeMagicLink, navigate, token])

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo variant="light" />
        <div>
          <h2 className="text-4xl font-bold">Sua proposta está esperando por você.</h2>
          <p className="mt-3 text-white/70">Verificando seu acesso seguro...</p>
        </div>
        <p className="text-xs text-white/40">© Mercurio Capital</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="card w-full max-w-md p-10 text-center">
          {status !== 'error' ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-navy">Identidade confirmada!</h1>
              <p className="mt-2 text-sm text-silver-600">Estamos redirecionando para seu ambiente…</p>
              <p className="mt-6 inline-flex items-center gap-2 text-xs text-silver-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> token validado · sessão iniciada
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle className="h-8 w-8 text-danger" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-navy">Link inválido</h1>
              <p className="mt-2 text-sm text-danger">{error}</p>
              <button className="btn-gold mt-6 w-full" onClick={() => navigate('/login', { replace: true })}>
                Ir para login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
