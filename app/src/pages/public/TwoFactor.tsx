import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function TwoFactor() {
  const navigate = useNavigate()
  const { submitTwoFactor, logout } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const redirectTo = await submitTwoFactor(code)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar o 2FA.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="card w-full p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Segurança adicional</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">Verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-silver-600">
          Informe o código TOTP do seu autenticador (Google Authenticator, 1Password, Authy etc.) para concluir o acesso.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Código 2FA</label>
            <input
              className="input tracking-widest text-center text-lg"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? 'Validando...' : 'Validar e entrar'}
          </button>
          <button type="button" className="btn-outline w-full" onClick={handleCancel} disabled={loading}>
            Cancelar e sair
          </button>
        </form>
      </div>
    </div>
  )
}
