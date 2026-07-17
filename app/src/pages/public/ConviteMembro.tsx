import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Loader2, CheckCircle2, AlertTriangle, LogIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { publicAppUrl } from '@/lib/publicUrl'

type InvitePeek = {
  email: string
  nome: string | null
  equipe_id: string
  expires_at: string
}

function readErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export function ConviteMembro() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, refresh } = useAuth()
  const [status, setStatus] = useState<'idle' | 'validando' | 'aceitando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InvitePeek | null>(null)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Token não informado.')
      return
    }
    if (isAuthenticated) return

    setStatus('validando')
    setError(null)
    setMagicLinkSent(false)

    void (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc('membro_peek_convite', { p_token: token })
        if (rpcErr || !data) throw new Error(rpcErr?.message ?? 'Convite inválido ou expirado.')
        setInvite(data as InvitePeek)
        setStatus('idle')
      } catch (err) {
        setStatus('error')
        setError(readErrorMessage(err, 'Falha ao validar convite.'))
      }
    })()
  }, [token, isAuthenticated])

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
        setError(readErrorMessage(err, 'Falha ao aceitar convite.'))
      }
    })()
  }, [token, isAuthenticated, navigate, refresh])

  async function handleSendMagicLink() {
    if (!token || !invite?.email) return

    setSendingMagicLink(true)
    setError(null)

    try {
      const redirectTo = publicAppUrl(`/convite/${token}`)
      const displayName = invite.nome?.trim() || invite.email.split('@')[0]

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: invite.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
          data: {
            nome_completo: displayName,
            role: 'client',
          },
        },
      })

      if (otpError) throw new Error(otpError.message)
      setMagicLinkSent(true)
    } catch (err) {
      setError(readErrorMessage(err, 'Não foi possível enviar o link mágico.'))
    } finally {
      setSendingMagicLink(false)
    }
  }

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
              {status === 'validando' ? (
                <>
                  <h1 className="mt-5 text-xl font-bold text-navy">Validando convite</h1>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-silver-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aguarde um instante...
                  </div>
                </>
              ) : status === 'error' ? (
                <>
                  <h1 className="mt-5 text-xl font-bold text-navy">Convite inválido</h1>
                  <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                    {error ?? 'Não foi possível validar o convite.'}
                  </p>
                  <button
                    className="btn-outline mt-6 w-full"
                    onClick={() => navigate('/p/login')}
                  >
                    Ir para login
                  </button>
                </>
              ) : (
                <>
                  <h1 className="mt-5 text-xl font-bold text-navy">Faça login para aceitar</h1>
                  <p className="mt-2 text-sm text-silver-600">
                    Use o mesmo e-mail que recebeu o convite. Após autenticar, você será automaticamente vinculado à equipe.
                  </p>

                  {invite?.email && (
                    <p className="mt-3 text-xs text-silver-500">
                      Convite destinado a <span className="font-semibold text-silver-700">{invite.email}</span>
                    </p>
                  )}

                  <button
                    className="btn-gold mt-6 w-full"
                    onClick={() => navigate('/p/login', { state: { from: `/convite/${token}` } })}
                  >
                    Entrar com senha
                  </button>

                  <button
                    className="btn-outline mt-3 w-full"
                    onClick={() => { void handleSendMagicLink() }}
                    disabled={sendingMagicLink || !invite?.email}
                  >
                    {sendingMagicLink ? 'Enviando link mágico...' : 'Receber link mágico no e-mail'}
                  </button>

                  {magicLinkSent && invite?.email && (
                    <p className="mt-3 text-xs text-success">
                      Enviamos um link mágico para {invite.email}. Abra o e-mail e clique no link para concluir.
                    </p>
                  )}

                  {error && (
                    <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                      {error}
                    </p>
                  )}
                </>
              )}
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
