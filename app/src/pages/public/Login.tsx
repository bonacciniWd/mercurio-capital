import { FormEvent, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import type { AppRole } from '@/auth/types'

type LoginProps = {
  defaultRole?: AppRole
  allowedRoles?: AppRole[]
  title?: string
  description?: string
}

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'team_member', label: 'Equipe (assistente)' },
  { value: 'client', label: 'Cliente' },
]

export function Login({
  defaultRole = 'partner',
  allowedRoles,
  title = 'Entrar na plataforma',
  description = 'Faça login no perfil correto para abrir o painel certo.',
}: LoginProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const roles = useMemo(() => {
    if (!allowedRoles || allowedRoles.length === 0) return ROLE_OPTIONS
    return ROLE_OPTIONS.filter((opt) => allowedRoles.includes(opt.value))
  }, [allowedRoles])

  const safeDefaultRole = roles.some((role) => role.value === defaultRole) ? defaultRole : roles[0].value

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AppRole>(safeDefaultRole)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const redirectTo = await login({ email, password, role })
      const from = location.state?.from as string | undefined
      navigate(from ?? redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível autenticar.')
    } finally {
      setLoading(false)
    }
  }

  const roleLocked = roles.length === 1

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="card w-full p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Acesso Mercurio</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">{title}</h1>
        <p className="mt-2 text-sm text-silver-600">{description}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Perfil de acesso</label>
            <select
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value as AppRole)}
              disabled={roleLocked}
            >
              {roles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com"
              required
            />
          </div>

          <div>
            <label className="label">Senha</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" className="btn-gold w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-silver-500">
          Autenticação Supabase · sessão segura com RLS e 2FA.
        </p>
      </div>
    </div>
  )
}
