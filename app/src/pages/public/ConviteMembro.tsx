import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Loader2, CheckCircle2, AlertTriangle, LogIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'

export function ConviteMembro() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, refresh } = useAuth()
  const [status, setStatus] = useState<'idle' | 'aceitando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Token não informado.')
      return
    }
    if (!isAuthenticated) return
    setStatus('aceitando')
    void (async () => {
      try {
        const { error: rpcErr } = await supabase.rpc('membro_accept_convite', { p_token: token })
        if (rpcErr) throw new Error(rpcErr.message)
        await refresh()
        setStatus('ok')
        setTimeout(() => navigate('/p', { replace: true }), 800)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Falha ao aceitar convite.')
      }
    })()
  }, [token, isAuthenticated, navigate, refresh])

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo variant="light" />
        <div>
          <h2 className="text-4xl font-bold leading-tight">Você foi convidado para uma equipe.</h2>
          <p className="mt-3 text-white/70">Aceite o convite para começar a operar propostas junto ao parceiro.</p>
        </div>
        <p className="text-xs text-white/40">© Mercurio Capital</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="card w-full max-w-md p-10 text-center">
          {!isAuthenticated ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold-600">
                <LogIn className="h-7 w-7" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-navy">Faça login para aceitar</h1>
              <p className="mt-2 text-sm text-silver-600">
                Use o mesmo e-mail que recebeu o convite. Após autenticar, você será automaticamente vinculado à equipe.
              </p>
              <button
                className="btn-gold mt-6 w-full"
                onClick={() => navigate(`/p/login?next=${encodeURIComponent(`/convite/${token}`)}`)}
              >
                Entrar
              </button>
            </>
          ) : status === 'aceitando' ? (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-gold" />
              <p className="mt-4 text-sm text-silver-600">Validando convite…</p>
            </>
          ) : status === 'ok' ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-navy">Convite aceito!</h1>
              <p className="mt-2 text-sm text-silver-600">Redirecionando…</p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle className="h-7 w-7 text-danger" />
              </div>
              <h1 className="mt-5 text-xl font-bold text-navy">Não foi possível aceitar</h1>
              <p className="mt-2 text-sm text-danger">{error}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
