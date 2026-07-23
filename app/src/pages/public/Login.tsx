import { FormEvent, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Logo'
import type { AppRole } from '@/auth/types'
import loginBackground from '@/assets/fundo-login.jpg'

type LoginProps = {
  /** Mantido por compatibilidade com o router; não é usado para selecionar perfil. */
  defaultRole?: AppRole
  /** Restringe quem pode entrar por esta URL (ex.: /admin/login só admin). */
  allowedRoles?: AppRole[]
  title?: string
  description?: string
}

type HeroContent = {
  eyebrow: string
  headline: ReactNode
  subline: string
  stats: Array<{ value: string; label: string }>
}

const HERO_BY_ROLE: Record<'admin' | 'partner' | 'client', HeroContent> = {
  admin: {
    eyebrow: 'Operação interna',
    headline: (
      <>
        Painel de <span className="text-red-600">controle</span> da esteira de crédito.
      </>
    ),
    subline: 'Aprovações, kanban global, financeiro e auditoria — tudo em um lugar.',
    stats: [
      { value: 'R$ 4,2B', label: 'volume operado' },
      { value: '+ 1.200', label: 'parceiros ativos' },
      { value: '98%', label: 'SLA de aprovação' },
    ],
  },
  partner: {
    eyebrow: 'Parceiro estratégico',
    headline: (
      <>
        Crédito Imobiliário <span className="text-red-600">para parceiros</span> estratégicos.
      </>
    ),
    subline: 'Home Equity, Construção e Financiamento — esteira completa, do funil ao registro.',
    stats: [
      { value: 'R$ 4,2B', label: 'volume operado' },
      { value: '+ 1.200', label: 'parceiros' },
      { value: '98%', label: 'satisfação' },
    ],
  },
  client: {
    eyebrow: 'Portal do cliente',
    headline: (
      <>
        Acompanhe sua <span className="text-red-600">proposta</span> com transparência.
      </>
    ),
    subline: 'Documentos, pendências e status em tempo real — direto da nossa esteira.',
    stats: [
      { value: '24/7', label: 'acompanhamento' },
      { value: '256-bit', label: 'criptografia' },
      { value: 'LGPD', label: 'em conformidade' },
    ],
  },
}

function pickHero(allowed?: AppRole[]): HeroContent {
  if (!allowed || allowed.length === 0) return HERO_BY_ROLE.partner
  if (allowed.includes('admin')) return HERO_BY_ROLE.admin
  if (allowed.includes('client')) return HERO_BY_ROLE.client
  return HERO_BY_ROLE.partner
}

function pickRegisterLink(allowed?: AppRole[]): { to: string; label: string } | null {
  if (!allowed || allowed.includes('partner') || allowed.includes('team_member')) {
    return { to: '/p/registro', label: 'Cadastrar como parceiro' }
  }
  return null
}

export function Login({
  allowedRoles,
  title = 'Entrar na plataforma',
  description = 'Use suas credenciais para acessar seu painel.',
}: LoginProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hero = pickHero(allowedRoles)
  const registerLink = pickRegisterLink(allowedRoles)
  const isAdminLogin = allowedRoles?.length === 1 && allowedRoles[0] === 'admin'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const redirectTo = await login({ email, password, allowedRoles })
      const fromState = (location.state as { from?: string } | null)?.from
      const nextQuery = new URLSearchParams(location.search).get('next')
      const safeNext = (fromState ?? nextQuery)?.startsWith('/') ? (fromState ?? nextQuery) : null
      navigate(safeNext ?? redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      <div className="col-span-2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex justify-center">
            <Logo />
          </div>
          <div className="card p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">{hero.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-bold text-navy">{title}</h1>
            <p className="mt-2 text-sm text-silver-600">{description}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                <div className="flex items-baseline justify-between">
                  <label className="label">Senha</label>
                  <Link to="/recuperar-senha" className="text-xs font-medium text-navy hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
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

              {error && (
                <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-gold w-full" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              {!isAdminLogin && (
                <Link
                  to="/admin/login"
                  className="btn-outline rounded-full flex w-full items-center justify-center gap-2 border-navy/20 text-navy hover:border-navy/40"
                >
                  É um Administrador?
                </Link>
              )}

              {registerLink && (
                <p className="text-center text-sm text-silver-600">
                  Ainda não tem conta?{' '}
                  <Link to={registerLink.to} className="font-medium text-navy underline">
                    {registerLink.label}
                  </Link>
                </p>
              )}

              <p className="text-center text-xs text-silver-500">
                Autenticação Supabase · sessão segura com RLS e 2FA opcional.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="relative col-span-3 hidden bg-black lg:block">
        <div className="absolute inset-0 opacity-55 bg-cover bg-center" style={{ backgroundImage: 'url(' + loginBackground + ')' }} />
        <div className="relative flex h-full flex-col justify-end p-16 text-white">
          <h2 className="max-w-xl text-4xl font-bold leading-tight">{hero.headline}</h2>
          <p className="mt-4 max-w-lg text-white/80">{hero.subline}</p>
          <div className="mt-12 flex gap-6 text-sm">
            {hero.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-red-600">{stat.value}</p>
                <p className="text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
