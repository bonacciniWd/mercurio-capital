import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { TwoFactorSetup } from '@/components/TwoFactorSetup'
import { resolveRedirect } from '@/auth/authClient'

export function TwoFactorSetupPage() {
  const navigate = useNavigate()
  const { session, logout, refresh } = useAuth()

  async function handleVerified() {
    await refresh()
    // Recalcula destino pós-verificação. Como confirmTwoFactorEnrollment já atualizou
    // a sessão, basta resolver de novo a partir da sessão atual.
    if (session) navigate(resolveRedirect({ ...session, twoFactorEnrolled: true, twoFactorVerified: true }), { replace: true })
  }

  async function handleCancel() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
      <div className="card w-full p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Primeiro acesso seguro</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Configure a autenticação em duas etapas</h1>
        <p className="mt-2 text-sm text-silver-600">
          Sua conta exige 2FA. Ative agora para liberar o acesso ao painel.
        </p>

        <div className="mt-6">
          <TwoFactorSetup compact onVerified={handleVerified} />
        </div>

        <div className="mt-8 flex justify-end">
          <button type="button" className="btn-outline" onClick={handleCancel}>
            Cancelar e sair
          </button>
        </div>
      </div>
    </div>
  )
}

